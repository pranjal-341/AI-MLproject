"""Exact biological-identity resolution to existing MdrDB descriptors.

This is retrieval of published features, NOT a de novo docking pipeline.
Never use DDG.EXP, nearest records, or unrelated drugs as predictor inputs.
"""
from functools import lru_cache
import math
import pandas as pd
from ..core import config

IDENTITY = ("SAMPLE_ID", "PDB_ID", "UNIPROT_ID", "CHAIN_ID", "MUTATION", "CID", "DRUG", "SMILES")

@lru_cache(maxsize=1)
def _dataset(path, signature):
    frame = pd.read_csv(path, low_memory=False, dtype={key: str for key in IDENTITY})
    if not all(key in frame for key in IDENTITY):
        raise ValueError("Dataset is missing biological identity columns")
    for key in IDENTITY:
        frame[key] = frame[key].fillna("").str.strip()
    return frame


def dataset():
    path = config.PROJECT_ROOT / "data/raw/MdrDB_Full_Scraped.csv"
    stat = path.stat()
    return _dataset(str(path), (stat.st_mtime_ns, stat.st_size))


def candidates(request):
    frame = dataset()
    protein = request.protein_id.strip().upper()
    mask = ((frame.UNIPROT_ID.str.upper() == protein) | (frame.PDB_ID.str.upper() == protein))
    mask &= frame.MUTATION.str.upper() == request.mutation.strip().upper()
    drug = request.drug.strip()
    if request.drug_type == "pubchem_cid":
        mask &= frame.CID == str(int(drug))
    else:
        # Exact SMILES only; equivalent alternate encodings must use the same CID.
        mask &= frame.SMILES == drug
    if request.pdb_id:
        mask &= frame.PDB_ID.str.upper() == request.pdb_id.strip().upper()
    if request.chain_id:
        mask &= frame.CHAIN_ID == request.chain_id.strip()
    if request.sample_id:
        mask &= frame.SAMPLE_ID == request.sample_id.strip()
    return frame.loc[mask]


def public_record(row):
    return {key.lower(): str(row[key]) for key in IDENTITY if key != "SMILES"}


def descriptors(row, names):
    missing = [name for name in names if name not in row.index]
    if missing:
        raise ValueError("Dataset does not contain the model's required descriptors")
    values = {}
    for name in names:
        value = pd.to_numeric(row[name], errors="coerce")
        values[name] = float(value) if pd.notna(value) and math.isfinite(float(value)) else None
    return values
