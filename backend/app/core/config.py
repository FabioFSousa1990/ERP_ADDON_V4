from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ERP ADDON V4"
    environment: str = "development"
    database_url: str = "sqlite:///./storage/erp_addon_v4.db"
    storage_root: str = "storage/uploads"
    source_roots: str = "storage/source_files"
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()