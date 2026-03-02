from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:1chethan@PostgreSql@localhost:5432/carbon_db"
    APP_ENV: str = "development"
    APP_TITLE: str = "IPCC Carbon Accounting Engine"
    APP_VERSION: str = "3.0.0"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
