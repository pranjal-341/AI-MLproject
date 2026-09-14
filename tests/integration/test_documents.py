import io
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

from backend.app.main import app
from backend.app.api import documents
from backend.app.services import descriptor_import as importer
from backend.app.schemas.documents import Extraction, ExtractedValue

client = TestClient(app)
QUERY = {"algorithm": "random_forest", "variant": "model_C", "model_version": "test-v1", "filename": "sample.csv"}
NAMES = ["LIG.MolWt", "LIG.MolLogP", "vina"]


@pytest.fixture
def import_model(monkeypatch):
    monkeypatch.setattr(documents, "model_version", lambda *args: "test-v1")
    monkeypatch.setattr(documents, "load_model", lambda *args: (object(), NAMES))


def pdf_bytes(text="Single sample S1; LIG.MolWt = 300.25"):
    # Minimal in-memory parser fixture, not a user-facing document artifact.
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream.set_data(f"BT /F1 10 Tf 40 740 Td ({escaped}) Tj ET".encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def candidate(name="LIG.MolWt", value=300.25, evidence="LIG.MolWt = 300.25", page=1):
    return ExtractedValue(feature=name, value=value, page=page, evidence=evidence)


def test_document_routes_require_login():
    assert client.get("/api/documents/status").status_code == 401
    assert client.post("/api/documents/extract", params=QUERY, content=b"a,b").status_code == 401


def test_csv_maps_only_selected_features(authenticated_user, import_model, monkeypatch):
    monkeypatch.setattr(importer, "ask_ollama", lambda *args: pytest.fail("CSV must not call LLM"))
    response = client.post("/api/documents/extract", params=QUERY, content=b"LIG.MolWt,LIG.MolLogP,DDG.EXP,SAMPLE_ID\n300.25,-1.5,999,S1\n")
    assert response.status_code == 200
    result = response.json()
    assert result["features"] == {"LIG.MolWt": 300.25, "LIG.MolLogP": -1.5, "vina": None}
    assert result["missing"] == ["vina"]
    assert result["review_required"] is True
    assert result["method"] == "csv" and result["llm_model"] is None
    assert len(result["source_sha256"]) == 64
    assert "no-store" in response.headers["cache-control"]


@pytest.mark.parametrize("csv", [
    "LIG.MolWt\n300\n301", "LIG.MolWt,LIG.MolWt\n300,300", "LIG.MolWt\nInfinity",
    "LIG.MolWt\n1e9999", "LIG.MolWt\n=1+2", "wrong\n300", "LIG.MolWt,vina\n1", "LIG.MolWt,vina\n,",
])
def test_csv_rejects_ambiguous_or_invalid_input(authenticated_user, import_model, csv):
    assert client.post("/api/documents/extract", params=QUERY, content=csv.encode()).status_code == 422


def test_upload_limits_versions_and_busy_state(authenticated_user, import_model):
    assert client.post("/api/documents/extract", params=QUERY, content=b"").status_code == 422
    assert client.post("/api/documents/extract", params={**QUERY, "filename": "a.exe"}, content=b"bad").status_code == 415
    assert client.post("/api/documents/extract", params=QUERY, content=b"x" * (importer.MAX_BYTES + 1)).status_code == 413
    assert client.post("/api/documents/extract", params={**QUERY, "model_version": "old"}, content=b"LIG.MolWt\n3").status_code == 409
    documents._import_lock.acquire()
    try:
        assert client.post("/api/documents/extract", params=QUERY, content=b"x").status_code == 429
    finally:
        documents._import_lock.release()


def test_real_pdf_reader_then_mocked_llm(authenticated_user, import_model, monkeypatch):
    def fake(pages, names):
        assert "LIG.MolWt = 300.25" in pages[0]
        assert names == NAMES
        return Extraction(single_sample=True, values=[candidate()])
    monkeypatch.setattr(importer, "ask_ollama", fake)
    response = client.post("/api/documents/extract", params={**QUERY, "filename": "sample.pdf"}, content=pdf_bytes())
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["features"]["LIG.MolWt"] == 300.25
    assert result["method"] == "pdf_llm"
    assert result["missing"] == ["LIG.MolLogP", "vina"]


def test_pdf_rejects_bad_encrypted_blank_and_excess_pages(authenticated_user, import_model):
    files = [b"not a PDF"]
    for count, encrypted in [(1, False), (1, True), (13, False)]:
        writer = PdfWriter()
        for _ in range(count):
            writer.add_blank_page(width=612, height=792)
        if encrypted:
            writer.encrypt("password")
        buffer = io.BytesIO()
        writer.write(buffer)
        files.append(buffer.getvalue())
    for content in files:
        response = client.post("/api/documents/extract", params={**QUERY, "filename": "sample.pdf"}, content=content)
        assert response.status_code == 422, response.text


def test_llm_cannot_invent_swap_or_use_target_values():
    pages = ["LIG.MolWt = 300.25; LIG.MolLogP = -1.5; DDG.EXP = 999"]
    extraction = Extraction(single_sample=True, values=[
        candidate(), candidate("LIG.MolLogP", 999., pages[0]), candidate("DDG.EXP", 999., "DDG.EXP = 999"),
        candidate("vina", 7., "vina = 7"),
    ])
    features, evidence, warnings = importer.verified_values(extraction, pages, NAMES)
    assert features == {"LIG.MolWt": 300.25, "LIG.MolLogP": None, "vina": None}
    assert len(evidence) == 1 and warnings


def test_conflicting_evidence_invalid_pages_and_multiple_samples_are_rejected():
    for pages, extraction in [
        (["LIG.MolWt = 300.25; LIG.MolWt = 400"], Extraction(single_sample=True, values=[candidate()])),
        (["LIG.MolWt = 300.25"], Extraction(single_sample=True, values=[candidate(page=2)])),
        (["LIG.MolWt = 300.25"], Extraction(single_sample=False, values=[candidate()])),
    ]:
        with pytest.raises(ValueError):
            importer.verified_values(extraction, pages, NAMES)


def test_pair_matching_preserves_exact_names_and_numeric_tokens():
    assert importer.pairs("vina1 = 5; vina10 = 7", "vina") == []
    assert importer.pairs("vina = -1.2e-3", "vina") == [-0.0012]
    assert importer.pairs("LIG.MolWt = 1,234", "LIG.MolWt") == []
    assert importer.pairs("LIG.MolWt = 3.4.5", "LIG.MolWt") == []


def test_ollama_failure_is_clear_and_never_fills(authenticated_user, import_model, monkeypatch):
    monkeypatch.setattr(importer, "pdf_pages", lambda _: ["LIG.MolWt = 300.25"])
    def unavailable(*args):
        raise importer.ImportUnavailable("Ollama unavailable")
    monkeypatch.setattr(importer, "ask_ollama", unavailable)
    response = client.post("/api/documents/extract", params={**QUERY, "filename": "sample.pdf"}, content=b"%PDF-test")
    assert response.status_code == 503 and "features" not in response.json()


def test_model_change_during_import_returns_conflict(authenticated_user, import_model, monkeypatch):
    versions = iter(["test-v1", "test-v2"])
    monkeypatch.setattr(documents, "model_version", lambda *args: next(versions))
    response = client.post("/api/documents/extract", params=QUERY, content=b"LIG.MolWt\n300")
    assert response.status_code == 409


@pytest.mark.parametrize("payload", [
    {"done": True, "message": {"content": "not JSON"}},
    {"done": True, "done_reason": "length", "message": {"content": "{}"}},
    {"done": False, "message": {"content": "{}"}},
])
def test_ollama_response_contract(monkeypatch, payload):
    class FakeClient:
        def __init__(self, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, url, json):
            assert json["think"] is False and json["stream"] is False
            assert "tools" not in json
            return httpx.Response(200, json=payload, request=httpx.Request("POST", url))
    monkeypatch.setattr(importer.httpx, "Client", FakeClient)
    with pytest.raises(importer.ImportUnavailable):
        importer.ask_ollama(["LIG.MolWt = 3"], NAMES)
