"""Typed, evidence-backed descriptor extraction; never an LLM DDG prediction."""
from pydantic import BaseModel, ConfigDict, Field


class ExtractedValue(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    feature: str = Field(min_length=1, max_length=128)
    value: float
    page: int = Field(ge=1, le=12)
    evidence: str = Field(min_length=1, max_length=400)


class Extraction(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    single_sample: bool
    values: list[ExtractedValue] = Field(max_length=146)


class ImportResult(BaseModel):
    algorithm: str
    variant: str
    model_version: str
    source_sha256: str
    method: str
    llm_model: str | None = None
    features: dict[str, float | None]
    evidence: list[ExtractedValue]
    missing: list[str]
    warnings: list[str]
    review_required: bool = True
