from uuid import uuid4
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PIL import Image
from sqlalchemy.orm import Session
from app.api.deps import get_current_admin
from app.core.config import BASE_DIR
from app.db.session import get_db
from app.models.content import AdminUser
from app.schemas.content import NoteIn, NoteOut, NoteUpdate, PostCreate, PostOut, PostUpdate, RepositoryCreate, RepositoryOut, RepositoryUpdate, ResumeVersionIn, ResumeVersionOut, ResumeVersionUpdate, SiteSettings
from app.services.content_service import ContentService
router = APIRouter(prefix='/admin', tags=['admin'], dependencies=[Depends(get_current_admin)])
UPLOADS_DIR = BASE_DIR.parent.parent / 'uploads'
@router.get('/dashboard')
def dashboard(db: Session = Depends(get_db)): return ContentService(db).dashboard()
@router.get('/resumes', response_model=list[ResumeVersionOut])
def list_resume_versions(db: Session = Depends(get_db)): return ContentService(db).list_admin_resume_versions()
@router.post('/resumes', response_model=ResumeVersionOut)
def create_resume_version(payload: ResumeVersionIn, db: Session = Depends(get_db)): return ContentService(db).create_resume_version(payload)
@router.put('/resumes/{resume_id}', response_model=ResumeVersionOut)
def update_resume_version(resume_id: int, payload: ResumeVersionUpdate, db: Session = Depends(get_db)): return ContentService(db).update_resume_version(resume_id, payload)
@router.delete('/resumes/{resume_id}')
def delete_resume_version(resume_id: int, db: Session = Depends(get_db)): ContentService(db).delete_resume_version(resume_id); return {'ok': True}
@router.get('/repositories', response_model=list[RepositoryOut])
def list_repositories(content_type: str | None = None, db: Session = Depends(get_db)): return ContentService(db).list_admin_repositories(content_type)
@router.post('/repositories', response_model=RepositoryOut)
def create_repository(payload: RepositoryCreate, db: Session = Depends(get_db)): return ContentService(db).create_repository(payload)
@router.put('/repositories/{repository_id}', response_model=RepositoryOut)
def update_repository(repository_id: int, payload: RepositoryUpdate, db: Session = Depends(get_db)): return ContentService(db).update_repository(repository_id, payload)
@router.delete('/repositories/{repository_id}')
def delete_repository(repository_id: int, db: Session = Depends(get_db)): ContentService(db).delete_repository(repository_id); return {'ok': True}
@router.get('/posts', response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db)): return ContentService(db).list_admin_posts()
@router.get('/posts/{post_id}', response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)): return ContentService(db).get_admin_post(post_id)
@router.post('/posts', response_model=PostOut)
def create_post(payload: PostCreate, db: Session = Depends(get_db)): return ContentService(db).create_post(payload)
@router.put('/posts/{post_id}', response_model=PostOut)
def update_post(post_id: int, payload: PostUpdate, db: Session = Depends(get_db)): return ContentService(db).update_post(post_id, payload)
@router.delete('/posts/{post_id}')
def delete_post(post_id: int, db: Session = Depends(get_db)): ContentService(db).delete_post(post_id); return {'ok': True}
@router.get('/notes', response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db)): return ContentService(db).list_admin_notes()
@router.post('/notes', response_model=NoteOut)
def create_note(payload: NoteIn, db: Session = Depends(get_db)): return ContentService(db).create_note(payload)
@router.put('/notes/{note_id}', response_model=NoteOut)
def update_note(note_id: int, payload: NoteUpdate, db: Session = Depends(get_db)): return ContentService(db).update_note(note_id, payload)
@router.delete('/notes/{note_id}')
def delete_note(note_id: int, db: Session = Depends(get_db)): ContentService(db).delete_note(note_id); return {'ok': True}
@router.put('/settings', response_model=SiteSettings)
def update_settings(payload: SiteSettings, db: Session = Depends(get_db)): return ContentService(db).update_settings(payload)
@router.post('/upload')
def upload_image(request: Request, file: UploadFile = File(...), _: AdminUser = Depends(get_current_admin)):
    if file.content_type not in {'image/jpeg', 'image/png', 'image/webp'}: raise HTTPException(400, '仅支持 JPG、PNG、WebP')
    UPLOADS_DIR.mkdir(exist_ok=True); filename = f'{uuid4().hex}.webp'
    with Image.open(file.file) as image: image.thumbnail((2000, 2000)); image.convert('RGB').save(UPLOADS_DIR / filename, 'WEBP', quality=84, method=6)
    return {'url': f'{str(request.base_url).rstrip("/")}/uploads/{filename}'}
@router.post('/upload-document')
def upload_document(request: Request, file: UploadFile = File(...), _: AdminUser = Depends(get_current_admin)):
    if file.content_type != 'application/pdf' or not file.filename or not file.filename.lower().endswith('.pdf'): raise HTTPException(400, '仅支持 PDF 文件')
    file.file.seek(0, 2); size = file.file.tell(); file.file.seek(0)
    if size > 15 * 1024 * 1024: raise HTTPException(400, 'PDF 文件不能超过 15MB')
    if file.file.read(5) != b'%PDF-': raise HTTPException(400, 'PDF 文件格式无效')
    file.file.seek(0); UPLOADS_DIR.mkdir(exist_ok=True); filename = f'{uuid4().hex}.pdf'
    with (UPLOADS_DIR / filename).open('wb') as target:
        while chunk := file.file.read(1024 * 1024): target.write(chunk)
    return {'url': f'{str(request.base_url).rstrip("/")}/uploads/{filename}'}
