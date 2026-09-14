from fastapi import APIRouter, Depends, HTTPException
from ..core.auth import require_user
from ..schemas.assistant import ChatRequest, ChatResponse
from ..services.model_loader import ModelUnavailable
from ..services.research_assistant import answer_question, generation_lock

router = APIRouter(dependencies=[Depends(require_user)])


@router.post("/assistant/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if not generation_lock.acquire(blocking=False):
        raise HTTPException(429, "The assistant is processing another request. Please try again shortly.")
    try:
        return answer_question(request)
    except ModelUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        generation_lock.release()
