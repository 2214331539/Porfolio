"""Initialize data required by a fresh Inkfold installation.

This module is intentionally not called by FastAPI startup. Run it explicitly
after applying Alembic migrations:

    uv run python -m app.db.seed

Content managed by the admin panel is never inserted or restored here.
"""

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.content import AdminUser, SiteSetting


# Defaults copied from the current site's database configuration. These are
# used only when a brand-new database has no site_settings row yet.
DEFAULT_SITE = {
    "site_title": "小潘同学",
   "site_description": "思考 发呆 学习",
   "hero_kicker": "A quiet corner on the internet",
   "mottos": ["你好", "我认识你吗"],
   "footer_text": "小潘同学",
   "icp_number": "",
   "github_url": "https://github.com/",
   "email": "hello@example.com",
}


def seed(db: Session) -> None:
    """Create only required first-install records, without restoring content."""
    if db.query(AdminUser).first() is None:
        db.add(
            AdminUser(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
            )
        )

    if db.get(SiteSetting, 1) is None:
        db.add(SiteSetting(id=1, data=DEFAULT_SITE))

    db.commit()


if __name__ == "__main__":
    with SessionLocal() as db:
        seed(db)
    print("基础数据初始化完成")
