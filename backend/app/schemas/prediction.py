from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    algorithm: Literal["linear_regression", "decision_tree", "random_forest", "xgboost"]
    variant: Literal["model_A", "model_B", "model_C"] = "model_A"
    features: dict[str, float | None] = Field(min_length=1)
    model_version: str | None = None
