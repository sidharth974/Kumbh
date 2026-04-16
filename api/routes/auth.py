"""
Auth routes — register, login, Google Sign-In, profile.
"""

import os
import uuid
import logging
import threading
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

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

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


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

    # Send welcome email in background (non-blocking)
    threading.Thread(target=send_welcome_email, args=(req.name, req.email), daemon=True).start()

    return AuthResponse(token=token, user=user)


def send_welcome_email(name: str, email: str):
    """Send welcome email after signup. Fails silently if SMTP not configured."""
    import smtplib, os
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    smtp_user = os.environ.get("SMTP_EMAIL", "siddharthnavnath7@gmail.com")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")  # Gmail App Password
    if not smtp_pass:
        log.info(f"SMTP not configured — skipping welcome email to {email}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Yatri AI <{smtp_user}>"
        msg["To"] = email
        msg["Subject"] = "Welcome to Yatri AI — Nashik Kumbh Mela 2027"

        html = f"""
        <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0e0d0">
          <div style="background:linear-gradient(135deg,#6B0F1A,#E8652B);padding:30px;text-align:center">
            <h1 style="color:white;font-size:28px;margin:0">Yatri AI</h1>
            <p style="color:#F0C75E;font-size:14px;margin:4px 0 0">Nashik Kumbh Mela 2027</p>
          </div>
          <div style="padding:24px 30px">
            <h2 style="color:#1a1a2e;font-size:20px">Namaste, {name}!</h2>
            <p style="color:#4A4A6A;font-size:14px;line-height:1.7">
              Welcome to Yatri AI — your multilingual AI companion for Nashik Kumbh Mela 2027.
            </p>
            <p style="color:#4A4A6A;font-size:14px;line-height:1.7">With Yatri AI you can:</p>
            <ul style="color:#4A4A6A;font-size:14px;line-height:2">
              <li>Ask questions in Hindi, Marathi, English & 5 more languages</li>
              <li>Navigate 178+ Nashik locations on the map</li>
              <li>Get instant emergency help with one tap</li>
              <li>Explore temples, ghats, food spots & wineries</li>
            </ul>
            <div style="text-align:center;margin:20px 0">
              <a href="https://siddharthnavnath7-yatri-ai.hf.space" style="background:#E8652B;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Yatri AI</a>
            </div>
            <p style="color:#8888A8;font-size:12px;text-align:center">Har Har Mahadev</p>
          </div>
        </div>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, email, msg.as_string())
        log.info(f"Welcome email sent to {email}")
    except Exception as e:
        log.warning(f"Failed to send welcome email to {email}: {e}")


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


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token


@router.post("/google", response_model=AuthResponse)
async def google_signin(req: GoogleAuthRequest):
    """Authenticate with Google Sign-In. Creates account if first time."""
    # Verify the Google ID token
    try:
        resp = httpx.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}",
            timeout=10.0,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as e:
        log.warning(f"Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google token")

    # Validate audience (client ID)
    if GOOGLE_CLIENT_ID and payload.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Invalid token audience")

    email = payload.get("email")
    name = payload.get("name", email.split("@")[0])
    avatar = payload.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    now = datetime.now(timezone.utc).isoformat()

    # Check if user exists
    row = await db.fetch_one("SELECT * FROM users WHERE email = ?", (email,))

    if row:
        # Existing user — login
        await db.execute("UPDATE users SET last_login = ?, avatar_url = ? WHERE id = ?",
                         (now, avatar, row["id"]))
        user_id = row["id"]
        user = UserProfile(
            id=row["id"], name=row["name"], email=row["email"],
            phone=row["phone"], preferred_language=row["preferred_language"],
            avatar_url=avatar or row["avatar_url"], created_at=row["created_at"],
        )
    else:
        # New user — register
        user_id = str(uuid.uuid4())
        pw_hash = hash_password(str(uuid.uuid4()))  # Random password (Google auth only)
        await db.execute(
            """INSERT INTO users (id, name, email, phone, password_hash, preferred_language, avatar_url, created_at, last_login)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, name, email, "", pw_hash, "en", avatar, now, now),
        )
        user = UserProfile(
            id=user_id, name=name, email=email,
            phone="", preferred_language="en",
            avatar_url=avatar, created_at=now,
        )
        # Welcome email
        threading.Thread(target=send_welcome_email, args=(name, email), daemon=True).start()

    token = create_token(user_id, email)
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
