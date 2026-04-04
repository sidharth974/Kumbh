"""
Session / history routes — list sessions, stats, log new entries.
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from api.models.database import db
from api.models.schemas import SessionLog, UserStats
from api.services.auth import get_current_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/", response_model=list[SessionLog])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    """List the user's recent sessions (last 50)."""
    rows = await db.fetch_all(
        """SELECT id, query_text, response_text, language, query_type, created_at
           FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50""",
        (current_user["user_id"],),
    )
    return [SessionLog(**r) for r in rows]


@router.get("/stats", response_model=UserStats)
async def user_stats(current_user: dict = Depends(get_current_user)):
    """Get aggregated stats for the authenticated user."""
    user_id = current_user["user_id"]

    total_row = await db.fetch_one(
        "SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ?", (user_id,)
    )
    total_queries = total_row["cnt"] if total_row else 0

    lang_rows = await db.fetch_all(
        "SELECT DISTINCT language FROM sessions WHERE user_id = ? AND language IS NOT NULL",
        (user_id,),
    )
    languages_used = [r["language"] for r in lang_rows]

    fav_row = await db.fetch_one(
        "SELECT COUNT(*) as cnt FROM favorites WHERE user_id = ?", (user_id,)
    )
    favorite_places = fav_row["cnt"] if fav_row else 0

    return UserStats(
        total_queries=total_queries,
        languages_used=languages_used,
        favorite_places=favorite_places,
    )


@router.post("/log", response_model=SessionLog)
async def log_session(
    query_text: str,
    response_text: str,
    language: str = "en",
    query_type: str = "text",
    current_user: dict = Depends(get_current_user),
):
    """Log a new session entry (called after each query)."""
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    await db.execute(
        """INSERT INTO sessions (id, user_id, query_text, response_text, language, query_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (session_id, current_user["user_id"], query_text, response_text, language, query_type, now),
    )

    return SessionLog(
        id=session_id, query_text=query_text, response_text=response_text,
        language=language, query_type=query_type, created_at=now,
    )
