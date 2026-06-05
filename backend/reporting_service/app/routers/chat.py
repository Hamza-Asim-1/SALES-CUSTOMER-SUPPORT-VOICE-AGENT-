from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.chatbot_instance import get_chatbot
from services.simple_chat import chat_with_context, chat_response_payload

router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    context: Optional[dict[str, Any]] = None


@router.post("/chat")
async def handle_chat(request: ChatRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    has_context = bool(
        request.context
        and (
            request.context.get("has_analysis_data")
            or request.context.get("executive_summary")
            or request.context.get("lead_stats")
            or request.context.get("report_summary")
        )
    )

    if has_context:
        answer = await chat_with_context(request.query, request.context)
        return chat_response_payload(answer)

    chatbot = get_chatbot()
    if chatbot:
        answer = await chatbot.chat(request.query)
        return chat_response_payload(answer)

    raise HTTPException(
        status_code=400,
        detail="Generate a report first (CSV upload or dashboard leads), then ask questions about it.",
    )
