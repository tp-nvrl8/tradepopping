import os
from dataclasses import asdict, dataclass


@dataclass
class AppConfig:
    app_name: str = os.getenv("APP_NAME", "TradePopping")
    app_env: str = os.getenv("APP_ENV", "development")
    app_version: str = os.getenv("APP_VERSION", "0.0.0")
    api_env: str = os.getenv("API_ENV", "unknown")
    allowed_email: str | None = os.getenv("TP_ALLOWED_EMAIL")

    def public_dict(self) -> dict:
        """
        Only expose safe fields to the frontend.
        Never include secrets or raw codes here.
        """
        base = asdict(self)
        # Don't leak entry codes or secrets; allowed_email is okay-ish for single-user
        return {
            "app_name": base["app_name"],
            "environment": base["app_env"],
            "version": base["app_version"],
            "backend_environment": base["api_env"],
            "auth": {
                "mode": "single-user",
                "email": base["allowed_email"],
            },
        }


CONFIG = AppConfig()
