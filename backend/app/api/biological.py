import math
from fastapi import APIRouter, Depends, HTTPException
from ..core.auth import require_user
from ..schemas.biological import BiologicalRequest
from ..schemas.prediction import PredictionRequest
from ..services.biological_inputs import candidates, descriptors, public_record, dataset
from ..services.model_loader import feature_names, model_directory, ModelUnavailable
from .predict import prediction

router = APIRouter(dependencies=[Depends(require_user)])

@router.get("/biological/example")
def example():
    try:
        row = dataset().iloc[0]
        return {"protein_id": row.UNIPROT_ID, "mutation": row.MUTATION,
                "drug_type": "pubchem_cid", "drug": row.CID,
                "pdb_id": row.PDB_ID, "chain_id": row.CHAIN_ID, "sample_id": row.SAMPLE_ID}
    except (OSError, ValueError, IndexError) as exc:
        raise HTTPException(503, "MdrDB example is unavailable") from exc

@router.post("/predict/biological")
def biological_prediction(request: BiologicalRequest):
    try:
        matches = candidates(request)
        if matches.empty:
            raise HTTPException(422, detail={"code": "DESCRIPTOR_GENERATION_UNAVAILABLE", "message": "No exact MdrDB record matches these inputs. De novo structure preparation, PLIP, docking and MdrDB-compatible descriptor generation are not configured. No prediction was generated."})
        if len(matches) != 1:
            raise HTTPException(409, detail={"code": "AMBIGUOUS_RECORD", "message": "Multiple experimental complexes match. Select a sample or specify PDB and chain.", "total": len(matches), "candidates": [public_record(row) for _, row in matches.head(50).iterrows()]})
        row = matches.iloc[0]
        names = feature_names(model_directory(request.algorithm, request.variant))
        values = descriptors(row, names)
        result = prediction(PredictionRequest(algorithm=request.algorithm, variant=request.variant,
                            features=values, model_version=request.model_version))
        try:
            observed = float(row.get("DDG.EXP", float("nan")))
        except (ValueError, TypeError):
            observed = float("nan")
        return {**result.model_dump(), "units": "kcal/mol", "input_source": "MdrDB precomputed descriptors (exact record)",
                "record": public_record(row), "descriptor_count": len(values),
                "imputed_count": sum(value is None for value in values.values()),
                "experimental_ddg": observed if math.isfinite(observed) else None,
                "evaluation_note": "This record belongs to the source training dataset and may have been used for fitting. This prediction is not an independent validation."}
    except HTTPException:
        raise
    except ModelUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(503, "Dataset or descriptors are unavailable; check backend logs and dataset schema") from exc
