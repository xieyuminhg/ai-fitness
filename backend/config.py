from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "mysql+pymysql://root:123456@localhost:3306/AI_Fitness"
    secret_key: str = "change-me-to-a-random-secret-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_auth_token: str = "your-anthropic-auth-token"
    anthropic_model: str = "claude-sonnet-4-6"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
