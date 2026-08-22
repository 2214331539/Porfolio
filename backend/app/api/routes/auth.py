from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.content import LoginIn, TokenOut
from app.services.auth_service import AuthService
router = APIRouter(prefix='/auth', tags=['authentication'])
@router.post('/login', response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    return TokenOut(access_token=AuthService(db).login(payload.username, payload.password, request))

