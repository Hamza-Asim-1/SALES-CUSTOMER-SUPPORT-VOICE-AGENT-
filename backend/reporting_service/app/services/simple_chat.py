from datetime import datetime, timezone

from groq import AsyncGroq

from core.config import settings


async def chat_with_context(query: str, context: dict | None) -> str:
    context_text = _format_context(context)

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        temperature=0.3,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an AI business analyst for a sales automation platform. "
                    "Answer using only the report context provided. Be concise, use bullet points "
                    "when helpful, and cite numbers from the context when available."
                ),
            },
            {
                "role": "user",
                "content": f"Report context:\n{context_text}\n\nUser question: {query}",
            },
        ],
    )
    return response.choices[0].message.content or "I couldn't generate a response."


def _format_context(context: dict | None) -> str:
    if not context:
        return "No report has been generated yet."

    parts: list[str] = []

    if context.get("report_type"):
        parts.append(f"Report type: {context['report_type']}")

    if context.get("executive_summary"):
        summary = context["executive_summary"]
        if isinstance(summary, list):
            parts.append("Executive summary:\n" + "\n".join(f"- {s}" for s in summary))
        else:
            parts.append(f"Executive summary: {summary}")

    if context.get("report_summary"):
        parts.append(f"Summary: {context['report_summary']}")

    lead_stats = context.get("lead_stats")
    if isinstance(lead_stats, dict):
        parts.append("Lead statistics:")
        for key, value in lead_stats.items():
            parts.append(f"  - {key}: {value}")

    if context.get("total_leads") is not None:
        parts.append(f"Total leads: {context['total_leads']}")

    return "\n".join(parts) if parts else "A report exists but no detailed context was supplied."


def chat_response_payload(answer: str) -> dict:
    return {
        "response": answer,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
