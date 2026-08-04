import secrets
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

SERVICE_USER_ID_HEADER = "X-FinVise-User-Id"

_bearer = HTTPBearer(auto_error=False)


def require_service_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer),
    ],
) -> None:
    valid_credentials = (
        credentials is not None
        and credentials.scheme.lower() == "bearer"
        and secrets.compare_digest(credentials.credentials, settings.service_token)
    )
    if not valid_credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def trusted_user_id(
    raw_user_id: Annotated[
        str | None,
        Header(alias=SERVICE_USER_ID_HEADER),
    ] = None,
) -> str:
    if raw_user_id is None or not raw_user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{SERVICE_USER_ID_HEADER} header is required",
        )
    try:
        return str(UUID(raw_user_id.strip()))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{SERVICE_USER_ID_HEADER} header must be a valid UUID",
        ) from exc
