"""Feedback route — sends user feedback to admin email."""

import logging
import threading
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from api.models.database import db

log = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])

ADMIN_EMAIL = "siddharthnavnath7@gmail.com"


class FeedbackRequest(BaseModel):
    name: str = "Anonymous"
    email: str = ""
    type: str = "feedback"  # feedback, bug, feature, support
    message: str
    rating: int = 0  # 1-5 stars, 0 = not rated


@router.post("")
async def submit_feedback(req: FeedbackRequest):
    """Submit feedback — saves to DB and emails admin."""
    now = datetime.now(timezone.utc).isoformat()

    # Save to DB
    import uuid
    feedback_id = str(uuid.uuid4())
    try:
        await db.execute(
            """INSERT INTO feedback (id, name, email, type, message, rating, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (feedback_id, req.name, req.email, req.type, req.message, req.rating, now),
        )
    except Exception as e:
        log.warning(f"Failed to save feedback to DB: {e}")

    # Email admin in background
    threading.Thread(
        target=send_feedback_email,
        args=(req.name, req.email, req.type, req.message, req.rating),
        daemon=True,
    ).start()

    return {"status": "received", "id": feedback_id, "message": "Thank you for your feedback!"}


def send_feedback_email(name, email, ftype, message, rating):
    smtp_user = os.environ.get("SMTP_EMAIL", ADMIN_EMAIL)
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    if not smtp_pass:
        log.info(f"SMTP not configured — feedback from {name} saved to DB only")
        return

    try:
        stars = "★" * rating + "☆" * (5 - rating) if rating > 0 else "Not rated"
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Yatri AI Feedback <{smtp_user}>"
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = f"[Yatri AI] {ftype.title()} from {name}"

        html = f"""
        <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;padding:24px">
          <h2 style="color:#E8652B;margin:0 0 16px">New {ftype.title()}</h2>
          <table style="font-size:14px;color:#333;line-height:2">
            <tr><td style="color:#888;padding-right:12px">From:</td><td><b>{name}</b></td></tr>
            <tr><td style="color:#888">Email:</td><td>{email or 'Not provided'}</td></tr>
            <tr><td style="color:#888">Type:</td><td>{ftype}</td></tr>
            <tr><td style="color:#888">Rating:</td><td style="color:#D4A017;font-size:18px">{stars}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#FFF8F0;border-radius:8px;border-left:4px solid #E8652B">
            <p style="font-size:14px;color:#333;line-height:1.7;margin:0">{message}</p>
          </div>
          <p style="font-size:11px;color:#aaa;margin-top:16px">Sent from Yatri AI — Nashik Kumbh Mela 2027</p>
        </div>
        """

        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, ADMIN_EMAIL, msg.as_string())
        log.info(f"Feedback email sent from {name}")
    except Exception as e:
        log.warning(f"Failed to send feedback email: {e}")
