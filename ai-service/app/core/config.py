from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    models_dir: Path = Field(default=Path("models"), alias="MODELS_DIR")
    transaction_model_path: Path = Field(
        default=Path("models/transaction-classifier"), alias="TRANSACTION_MODEL_PATH"
    )
    profile_model_path: Path = Field(
        default=Path("models/profile-classifier"), alias="PROFILE_MODEL_PATH"
    )
    evaluation_report_dir: Path = Field(
        default=Path("reports/final-test"), alias="MODEL_EVALUATION_REPORT_DIR"
    )

    enable_llm: bool = Field(default=False, alias="ENABLE_LLM")
    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_model: str = Field(default="gpt-4o-mini", alias="LLM_MODEL")
    llm_base_url: str = Field(default="https://api.openai.com/v1", alias="LLM_BASE_URL")
    llm_timeout_seconds: int = Field(default=30, alias="LLM_TIMEOUT_SECONDS")
    llm_max_tokens: int = Field(default=1024, alias="LLM_MAX_TOKENS")
    llm_temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")

    agent_system_prompt_path: Path = Field(
        default=Path("app/agent/prompts/system_prompt.txt"), alias="AGENT_SYSTEM_PROMPT_PATH"
    )
    agent_enable_recommendations: bool = Field(default=True, alias="AGENT_ENABLE_RECOMMENDATIONS")
    agent_enable_simulations: bool = Field(default=True, alias="AGENT_ENABLE_SIMULATIONS")

    dataset_raw_dir: Path = Field(
        default=Path("../finance_ai_dataset"), alias="DATASET_RAW_DIR"
    )
    data_processed_dir: Path = Field(
        default=Path("data/processed"), alias="DATA_PROCESSED_DIR"
    )
    data_samples_dir: Path = Field(
        default=Path("data/samples"), alias="DATA_SAMPLES_DIR"
    )


settings = Settings()
