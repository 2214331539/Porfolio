from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.content import Doing
from app.schemas.doing import DoingIn, DoingOrder, DoingOut

router = APIRouter(tags=['doing'])
admin_router = APIRouter(prefix='/admin', tags=['doing admin'], dependencies=[Depends(get_current_admin)])


def ordered(db: Session):
    # Newest first within a position tie, so a freshly added note never hides behind an older one.
    return db.query(Doing).order_by(Doing.sort_order, Doing.id.desc())


def get_doing(db: Session, doing_id: int) -> Doing:
    doing = db.get(Doing, doing_id)
    if doing is None:
        raise HTTPException(404, '这条记录不存在')
    return doing


def make_room_at_front(db: Session, kind: str):
    """Shift a line right by one so a note can take the leftmost slot (sort_order 0)."""
    db.query(Doing).filter(Doing.kind == kind).update({Doing.sort_order: Doing.sort_order + 1})


@router.get('/doing', response_model=list[DoingOut])
def public_doing(db: Session = Depends(get_db)):
    return ordered(db).all()


@admin_router.get('/doing', response_model=list[DoingOut])
def admin_doing(db: Session = Depends(get_db)):
    return ordered(db).all()


@admin_router.post('/doing', response_model=DoingOut, status_code=201)
def create_doing(payload: DoingIn, db: Session = Depends(get_db)):
    make_room_at_front(db, payload.kind)
    doing = Doing(**payload.model_dump(), sort_order=0)
    db.add(doing)
    db.commit()
    db.refresh(doing)
    return doing


# Declared before /doing/{doing_id} so "order" is not read as an id.
@admin_router.put('/doing/order', response_model=list[DoingOut])
def arrange_doing(payload: DoingOrder, db: Session = Depends(get_db)):
    wanted = [*payload.main, *payload.side]
    found = {row.id: row for row in db.query(Doing).filter(Doing.id.in_(wanted))}
    if any(doing_id not in found for doing_id in wanted):
        raise HTTPException(404, '有记录已经不存在，请刷新后再试')
    for kind, ids in (('main', payload.main), ('side', payload.side)):
        for position, doing_id in enumerate(ids):
            found[doing_id].kind = kind
            found[doing_id].sort_order = position
    db.commit()
    return ordered(db).all()


@admin_router.put('/doing/{doing_id}', response_model=DoingOut)
def update_doing(doing_id: int, payload: DoingIn, db: Session = Depends(get_db)):
    doing = get_doing(db, doing_id)
    if payload.kind != doing.kind:
        make_room_at_front(db, payload.kind)
        doing.sort_order = 0
    for field, value in payload.model_dump().items():
        setattr(doing, field, value)
    db.commit()
    db.refresh(doing)
    return doing


@admin_router.delete('/doing/{doing_id}')
def delete_doing(doing_id: int, db: Session = Depends(get_db)):
    db.delete(get_doing(db, doing_id))
    db.commit()
    return {'ok': True}
