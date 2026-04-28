from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # ── Application ─────────────────────────────────────────────────────────
    APP_NAME: str = "TicketRush"
    DEBUG: bool = False
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Database — Master (writes) ───────────────────────────────────────────
    DB_MASTER_HOST: str = "localhost"
    DB_MASTER_PORT: int = 3306
    DB_MASTER_USER: str = "root"
    DB_MASTER_PASSWORD: str = "password"
    DB_NAME: str = "ticketrush"

    # ── Database — Slaves (reads) ────────────────────────────────────────────
    # Comma-separated "host:port" pairs; falls back to master when blank.
    DB_SLAVE_HOSTS: str = ""
    DB_SLAVE_USER: str = ""
    DB_SLAVE_PASSWORD: str = ""

    # ── Redis ────────────────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0

    # ── Business Rules ───────────────────────────────────────────────────────
    QUEUE_BATCH_SIZE: int = 50           # users admitted per batch release
    SEAT_LOCK_DURATION_SECONDS: int = 600  # 10-minute pessimistic lock TTL


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
