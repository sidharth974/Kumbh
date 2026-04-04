"""
Auth routes — register, login, profile, logout.
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from api.models.database import db
from api.models.schemas import (
    RegisterRequest, LoginRequest, AuthResponse,
    UserProfile, UpdateProfileRequest,
)
from api.services.auth import (
    hash_password, verify_password, create_token, get_current_user,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    """Create a new user account."""
    # Check if email already exists
    existing = await db.fetch_one("SELECT id FROM users WHERE email = ?", (req.email,))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    pw_hash = hash_password(req.password)

    await db.execute(
        """INSERT INTO users (id, name, email, phone, password_hash, preferred_language, created_at, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (user_id, req.name, req.email, req.phone, pw_hash, req.preferred_language, now, now),
    )

    token = create_token(user_id, req.email)
    user = UserProfile(
        id=user_id, name=req.name, email=req.email,
        phone=req.phone, preferred_language=req.preferred_language,
        avatar_url=None, created_at=now,
    )
    return AuthResponse(token=token, user=user)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Authenticate with email and password."""
    row = await db.fetch_one("SELECT * FROM users WHERE email = ?", (req.email,))
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last_login
    now = datetime.now(timezone.utc).isoformat()
    await db.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, row["id"]))

    token = create_token(row["id"], row["email"])
    user = UserProfile(
        id=row["id"], name=row["name"], email=row["email"],
        phone=row["phone"], preferred_language=row["preferred_language"],
        avatar_url=row["avatar_url"], created_at=row["created_at"],
    )
    return AuthResponse(token=token, user=user)


@router.get("/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    row = await db.fetch_one("SELECT * FROM users WHERE id = ?", (current_user["user_id"],))
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return UserProfile(
        id=row["id"], name=row["name"], email=row["email"],
        phone=row["phone"], preferred_language=row["preferred_language"],
        avatar_url=row["avatar_url"], created_at=row["created_at"],
    )


@router.put("/profile", response_model=UserProfile)
async def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """Update the authenticated user's profile fields."""
    user_id = current_user["user_id"]
    row = await db.fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    name = req.name if req.name is not None else row["name"]
    phone = req.phone if req.phone is not None else row["phone"]
    lang = req.preferred_language if req.preferred_language is not None else row["preferred_language"]

    await db.execute(
        "UPDATE users SET name = ?, phone = ?, preferred_language = ? WHERE id = ?",
        (name, phone, lang, user_id),
    )

    return UserProfile(
        id=row["id"], name=name, email=row["email"],
        phone=phone, preferred_language=lang,
        avatar_url=row["avatar_url"], created_at=row["created_at"],
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout — client should discard the token."""
    return {"detail": "Logged out. Please discard the token on the client."}
