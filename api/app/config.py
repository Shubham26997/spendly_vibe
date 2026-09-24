from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_fallback_model: str = "gemini-2.5-flash"
    gemini_fallback_v2_model: str = "gemini-3.5-flash-lite"
    enable_bot: bool = False
    telegram_token: str = ""
    telegram_chat_id: str = ""   # your personal Telegram chat ID for daily insight push
    api_base_url: str = "http://api:8001"

    monthly_salary_target: float = 95000
    saving_target_pct: int = 30

    postgres_db: str = "spendly"
    postgres_user: str = "spendly_user"
    postgres_password: str = "changeme"

    # SMTP Onboarding Email settings
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = "ainotifiy@gmail.com"
    smtp_password: str = "qbbf ixwz bshe koor"
    smtp_use_tls: bool = True
    smtp_from_email: str = "ainotifiy@gmail.com"
    admin_notify_email: str = "shubham.goelshopping@gmail.com"

settings = Settings()
