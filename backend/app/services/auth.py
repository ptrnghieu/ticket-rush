"""
AuthService — registration, login, and FastAPI dependency injection for
current-user extraction and role checks.
"""

from typing import Optional

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_master_db
from app.core.exceptions import (
    AdminRequiredError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidTokenError,
)
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.user import GenderEnum, User
from app.repositories.user import UserRepository

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    def register(
        self,
        email: str,
        password: str,
        full_name: str,
        age: Optional[int] = None,
        gender: Optional[GenderEnum] = None,
    ) -> User:
        if self.user_repo.email_exists(email):
            raise EmailAlreadyRegisteredError()

        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            age=age,
            gender=gender,
            role="customer",
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, email: str, password: str) -> dict:
        user = self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": user.role,
        }


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(_oauth2_scheme),
    db: Session = Depends(get_master_db),
) -> User:
    """Decode JWT and return the authenticated User. Raises 401 on failure."""
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise InvalidTokenError()
    user = UserRepository(db).get_by_id(int(user_id))
    if not user:
        raise InvalidTokenError()
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Raises 403 unless the authenticated user has the 'admin' role."""
    if current_user.role != "admin":
        raise AdminRequiredError()
    return current_user
