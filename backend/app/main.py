import mimetypes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin, auth, public
from app.core.config import BASE_DIR, settings

UPLOADS_DIR = BASE_DIR.parent.parent / "uploads"

# Python's Windows MIME registry does not consistently include WebP. Without
# this explicit mapping StaticFiles may send uploaded images as text/plain,
# which can make browsers refuse to render otherwise valid resume previews.
mimetypes.add_type("image/webp", ".webp")


def create_app() -> FastAPI:
    application = FastAPI(
        title="Inkfold API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url, "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    UPLOADS_DIR.mkdir(exist_ok=True)
    application.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
    application.include_router(public.router, prefix="/api")
    application.include_router(auth.router, prefix="/api")
    application.include_router(admin.router, prefix="/api")
    return application


app = create_app()
