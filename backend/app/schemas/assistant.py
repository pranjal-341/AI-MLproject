from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .prediction import PredictionRequest
from .response import PredictionResponse


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    sample: PredictionRequest | None = None
    explain_prediction: bool = False

    @model_validator(mode="after")
    def bounded_context(self):
        if sum(len(item.content) for item in self.history) > 12000:
            raise ValueError("Conversation context is too long. Start a new chat.")
        if self.explain_prediction and self.sample is None:
            raise ValueError("A reviewed sample is required to explain a prediction.")
        if self.sample is not None and (not self.sample.model_version or len(self.sample.features) > 146):
            raise ValueError("A versioned sample with at most 146 descriptors is required.")
        return self


class ChatResponse(BaseModel):
    answer: str
    model: str
    verified_prediction: PredictionResponse | None = None
