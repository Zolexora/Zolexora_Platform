import asyncio
import logging
import resend
from core.config import settings

logger = logging.getLogger("zolexora.email")

if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

_WRAP = """<div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto;
background:#FAFAF8;padding:32px;">
  <div style="background:#1C1C1C;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
    <span style="color:#FFB800;font-size:24px;font-weight:900;">ZOLEXORA</span>
    <p style="color:#888;font-size:12px;margin:4px 0 0;">Watch. Earn. Shop.</p>
  </div>
  <div style="background:#fff;border:1.5px solid #E8E5DF;border-radius:16px;padding:32px;">{body}</div>
</div>"""


async def _send(to: str, subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": f"Zolexora <{settings.SENDER_EMAIL}>",
            "to": [to], "subject": subject, "html": html,
        })
        logger.info("Email sent → %s | %s", to, subject)
    except Exception as e:
        logger.error("Email failed → %s | %s | %s", to, subject, e)
        raise


async def send_otp_email(email: str, name: str, otp: str) -> None:
    body = f"""
    <h2 style="font-weight:800;color:#1C1C1C;margin:0 0 8px;">Hi {name} 👋</h2>
    <p style="color:#666;margin:0 0 24px;">Your verification code expires in <strong>5 minutes</strong>.</p>
    <div style="background:#1C1C1C;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
      <span style="color:#FFB800;font-size:48px;font-weight:900;letter-spacing:12px;">{otp}</span>
    </div>
    <p style="color:#999;font-size:12px;">Didn't request this? Ignore safely.</p>"""
    await _send(email, f"{otp} – Your Zolexora verification code", _WRAP.format(body=body))


async def send_reset_email(email: str, name: str, reset_url: str) -> None:
    body = f"""
    <h2 style="font-weight:800;color:#1C1C1C;margin:0 0 8px;">Hi {name} 👋</h2>
    <p style="color:#666;margin:0 0 24px;">Click the button below to reset your password.
       The link expires in <strong>1 hour</strong>.</p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="{reset_url}" style="display:inline-block;background:#FFB800;color:#1C1C1C;
         font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Reset My Password
      </a>
    </div>
    <p style="color:#999;font-size:12px;">Didn't request this? Ignore safely.</p>"""
    await _send(email, "Reset your Zolexora password", _WRAP.format(body=body))
