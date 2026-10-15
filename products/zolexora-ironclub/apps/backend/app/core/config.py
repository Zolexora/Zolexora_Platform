import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Zolexora IronClub API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("IRONCLUB_SECRET_KEY", "ironclub-super-secret-jwt-key-2026-secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    GATE_HARDWARE_API_KEY: str = os.getenv("GATE_HARDWARE_API_KEY", "ironclub-iot-gate-secret-key-9981")
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://ironclub:ironclubpass@localhost:5452/ironclub_db"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6382/0")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3040", # Admin web
        "http://localhost:3041", # Member web
        "http://localhost:8085", # Nginx reverse proxy
        "http://127.0.0.1:3040",
        "http://127.0.0.1:3041",
        "http://127.0.0.1:8085",
        "*"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
