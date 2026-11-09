from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.content import InfoSource
from app.schemas.sources import SourceIn, SourceOut

router = APIRouter(tags=['sources'])
admin_router = APIRouter(prefix='/admin', tags=['sources admin'], dependencies=[Depends(get_current_admin)])


def ordered(db: Session):
    return db.query(InfoSource).order_by(InfoSource.sort_order, InfoSource.id)


def get_source(db: Session, source_id: int) -> InfoSource:
    source = db.get(InfoSource, source_id)
    if source is None:
        raise HTTPException(404, '网站不存在')
    return source


@router.get('/sources', response_model=list[SourceOut])
def public_sources(db: Session = Depends(get_db)):
    return ordered(db).filter(InfoSource.is_visible.is_(True)).all()


@admin_router.get('/sources', response_model=list[SourceOut])
def admin_sources(db: Session = Depends(get_db)):
    return ordered(db).all()


@admin_router.post('/sources', response_model=SourceOut, status_code=201)
def create_source(payload: SourceIn, db: Session = Depends(get_db)):
    values = payload.model_dump()
    if 'sort_order' not in payload.model_fields_set:
        values['sort_order'] = (max((row.sort_order for row in db.query(InfoSource.sort_order)), default=-1)) + 1
    source = InfoSource(**values)
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@admin_router.put('/sources/{source_id}', response_model=SourceOut)
def update_source(source_id: int, payload: SourceIn, db: Session = Depends(get_db)):
    source = get_source(db, source_id)
    for field, value in payload.model_dump().items():
        setattr(source, field, value)
    db.commit()
    db.refresh(source)
    return source


@admin_router.delete('/sources/{source_id}')
def delete_source(source_id: int, db: Session = Depends(get_db)):
    db.delete(get_source(db, source_id))
    db.commit()
    return {'ok': True}
