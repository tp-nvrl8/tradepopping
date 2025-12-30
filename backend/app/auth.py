# backend/app/auth.py
import os
from typing import Dict

from fastapi import HTTPException, Request

ALLOWED_EMAIL = os.getenv("TP_ALLOWED_EMAIL")
ACTIVE_TOKENS: set[str] = set()


def get_current_user(request: Request) -> Dict:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1]
    if token not in ACTIVE_TOKENS:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"email": ALLOWED_EMAIL}
