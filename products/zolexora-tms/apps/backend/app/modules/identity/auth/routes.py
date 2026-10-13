from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
import redis.asyncio as redis
from app.core.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Initialize Redis client
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

class ResendOTPRequest(BaseModel):
    email: EmailStr

@router.post("/resend-otp")
async def resend_otp(request: ResendOTPRequest, req: Request):
    email = request.email.lower().strip()
    redis_key = f"otp_resend_count:{email}"

    # 1. Check current resend count
    current_count_str = await redis_client.get(redis_key)
    current_count = int(current_count_str) if current_count_str else 0

    if current_count >= 5:
        ttl = await redis_client.ttl(redis_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"OTP resend limit exceeded. Try again in {ttl // 3600} hours and {(ttl % 3600) // 60} minutes."
        )

    # 2. Increment counter and rate limit
    new_count = await redis_client.incr(redis_key)
    if new_count >= 5:
        await redis_client.expire(redis_key, 86400)
    elif new_count == 1:
        await redis_client.expire(redis_key, 3600)

    return {
        "message": "OTP resend registered. Verification is handled via Firebase Auth.",
        "attempts_remaining": 5 - new_count
    }
