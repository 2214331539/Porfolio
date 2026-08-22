from datetime import datetime, timezone
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import create_token, verify_password
from app.models.content import AdminUser, LoginLog

class AuthService:
    def __init__(self, db: Session): self.db = db
    def login(self, username: str, password: str, request: Request) -> str:
        admin = self.db.query(AdminUser).filter_by(username=username).first()
        is_valid = bool(admin and verify_password(password, admin.password_hash))
        self.db.add(LoginLog(username=username, ip_address=request.client.host if request.client else 'unknown', success=is_valid))
        if not is_valid:
            self.db.commit(); raise HTTPException(401, '账号或密码错误')
        admin.last_login_at = datetime.now(timezone.utc); self.db.commit()
        return create_token(admin.username)

