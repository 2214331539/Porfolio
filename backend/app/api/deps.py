from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.content import AdminUser

bearer_scheme = HTTPBearer(auto_error=False)

def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    if credentials is None:
        raise HTTPException(status_code=401, detail='请先登录')
    try:
        username = jwt.decode(credentials.credentials, settings.secret_key, algorithms=['HS256'])['sub']
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=401, detail='登录状态已过期') from error
    admin = db.query(AdminUser).filter_by(username=username).first()
    if admin is None:
        raise HTTPException(status_code=401, detail='管理员不存在')
    return admin

