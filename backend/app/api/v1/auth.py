from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_master_db
from app.schemas.user import Token, UserCreate, UserResponse
from app.services.auth import AuthService

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account",
)
def register(payload: UserCreate, db: Session = Depends(get_master_db)):
    return AuthService(db).register(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        age=payload.age,
        gender=payload.gender,
    )


@router.post(
    "/login",
    response_model=Token,
    summary="Login and receive a JWT access token",
)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_master_db),
):
    # OAuth2PasswordRequestForm uses the 'username' field to carry the email
    return AuthService(db).login(email=form.username, password=form.password)
