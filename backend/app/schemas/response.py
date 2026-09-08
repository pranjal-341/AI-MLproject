from pydantic import BaseModel

class PredictionResponse(BaseModel):
    algorithm: str
    variant: str
    prediction: float
    model_version: str
    elapsed_ms: float
