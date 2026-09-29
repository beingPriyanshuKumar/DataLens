from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    tavily_api_key: str = ""
    database_url: str = "sqlite:///./datalens.db"
    max_pages_per_run: int = 50
    fetch_concurrency: int = 5
    per_domain_delay_seconds: float = 2.0
    spec_model: str = "claude-sonnet-4-20250514"
    extract_model: str = "claude-sonnet-4-20250514"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
