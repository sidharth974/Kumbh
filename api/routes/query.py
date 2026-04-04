"""Text query route with session history and streaming."""

import time
import uuid
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from langdetect import detect

from api.models.schemas import QueryRequest, QueryResponse, SourceDoc
from api.services.llm import get_llm, LLMService
from api.services.rag import get_rag, RAGService

router = APIRouter(prefix="/query", tags=["query"])

# In-memory session history: session_id → deque of (role, text) pairs
_sessions: dict[str, deque] = defaultdict(lambda: deque(maxlen=10))


def detect_language(text: str, hint: Optional[str] = None) -> str:
    if hint and hint != "auto":
        return hint
    try:
        lang = detect(text)
        # Map langdetect codes to our supported set
        mapping = {
            "hi": "hi", "mr": "mr", "gu": "gu",
            "ta": "ta", "te": "te", "kn": "kn", "ml": "ml",
            "en": "en",
        }
        return mapping.get(lang, "en")
    except Exception:
        return "en"


@router.post("", response_model=QueryResponse)
async def text_query(
    req: QueryRequest,
    rag: RAGService = Depends(get_rag),
    llm: LLMService = Depends(get_llm),
):
    session_id = req.session_id or str(uuid.uuid4())
    language = detect_language(req.query, req.language)

    # Retrieve context
    docs = rag.retrieve(req.query, language=language, domain=req.domain, top_k=5)
    context_texts = [d["text"] for d in docs]

    # Add conversation history to context if session exists
    history = _sessions[session_id]
    if history:
        history_text = "\n".join(f"{role}: {text}" for role, text in history)
        context_texts = [f"Previous conversation:\n{history_text}"] + context_texts

    domain = docs[0]["domain"] if docs else "general"

    # Generate
    response_text = llm.generate(
        query=req.query,
        context=context_texts,
        language=language,
        domain=domain,
    )

    # Update session history
    _sessions[session_id].append(("User", req.query))
    _sessions[session_id].append(("Assistant", response_text))

    return QueryResponse(
        response=response_text,
        language=language,
        sources=[
            SourceDoc(text=d["text"][:200], domain=d["domain"], source=d["source"], score=d["score"])
            for d in docs[:3]
        ],
        domain=domain,
        confidence=docs[0]["score"] if docs else 0.0,
        session_id=session_id,
    )


@router.post("/stream")
async def text_query_stream(
    req: QueryRequest,
    rag: RAGService = Depends(get_rag),
    llm: LLMService = Depends(get_llm),
):
    """Server-Sent Events streaming response."""
    session_id = req.session_id or str(uuid.uuid4())
    language = detect_language(req.query, req.language)
    docs = rag.retrieve(req.query, language=language, domain=req.domain, top_k=5)
    context_texts = [d["text"] for d in docs]

    async def event_stream():
        full_response = []
        async for token in llm.generate_stream(req.query, context_texts, language):
            full_response.append(token)
            yield f"data: {token}\n\n"
        _sessions[session_id].append(("User", req.query))
        _sessions[session_id].append(("Assistant", "".join(full_response)))
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/history/{session_id}")
async def get_history(session_id: str):
    history = list(_sessions.get(session_id, []))
    return {"session_id": session_id, "turns": [{"role": r, "text": t} for r, t in history]}
