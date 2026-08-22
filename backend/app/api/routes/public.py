from pathlib import Path
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.core.config import BASE_DIR
from app.db.session import get_db
from app.schemas.content import NoteOut, PostOut, RepositoryOut, ResumeVersionOut, SiteSettings
from app.services.content_service import ContentService
router = APIRouter(tags=['public'])
@router.get('/health')
def health(): return {'status': 'ok', 'service': 'inkfold'}
@router.get('/resumes', response_model=list[ResumeVersionOut])
def list_resume_versions(db: Session = Depends(get_db)): return ContentService(db).list_public_resume_versions()
@router.get('/resumes/{resume_id}/download')
def download_resume(resume_id: int, request: Request, db: Session = Depends(get_db)):
    resume = ContentService(db).get_public_resume_version(resume_id)
    if not resume.pdf_url: raise HTTPException(404, '该版本没有 PDF 文件')
    parsed = urlparse(resume.pdf_url)
    filename = Path(parsed.path).name
    local_file = (BASE_DIR.parent.parent / 'uploads' / filename).resolve()
    uploads_dir = (BASE_DIR.parent.parent / 'uploads').resolve()
    is_local_upload = parsed.path.startswith('/uploads/') and parsed.hostname in {None, request.url.hostname, 'localhost', '127.0.0.1'}
    if is_local_upload and filename and local_file.parent == uploads_dir and local_file.is_file():
        return FileResponse(local_file, media_type='application/pdf', filename=f'{resume.title}.pdf')
    if parsed.scheme in {'http', 'https'}: return RedirectResponse(resume.pdf_url)
    raise HTTPException(404, 'PDF 文件不存在')
@router.get('/repositories', response_model=list[RepositoryOut])
def list_repositories(content_type: str | None = None, db: Session = Depends(get_db)): return ContentService(db).list_repositories(content_type)
@router.get('/posts', response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db)): return ContentService(db).list_public_posts()
@router.get('/posts/{slug}', response_model=PostOut)
def get_post(slug: str, db: Session = Depends(get_db)): return ContentService(db).get_public_post(slug)
@router.get('/notes', response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db)): return ContentService(db).list_public_notes()
@router.get('/notes/{note_id}', response_model=NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db)): return ContentService(db).get_public_note(note_id)
@router.post('/notes/{note_id}/like', response_model=NoteOut)
def like_note(note_id: int, db: Session = Depends(get_db)): return ContentService(db).like_note(note_id)
@router.get('/settings', response_model=SiteSettings)
def get_settings(db: Session = Depends(get_db)): return ContentService(db).get_settings()
