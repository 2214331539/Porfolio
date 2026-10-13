from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.schemas.portfolio import PortfolioOut, ProfileIn, ProjectIn, ProjectOut
from app.services.portfolio_service import PortfolioService

router = APIRouter(tags=['portfolio'])
admin_router = APIRouter(prefix='/admin', tags=['portfolio admin'], dependencies=[Depends(get_current_admin)])


def no_cache(response: Response):
    response.headers['Cache-Control'] = 'no-store'


@router.get('/portfolio', response_model=PortfolioOut, dependencies=[Depends(no_cache)])
def public_portfolio(db: Session = Depends(get_db)):
    return PortfolioService(db).portfolio()


@admin_router.get('/portfolio', response_model=PortfolioOut, dependencies=[Depends(no_cache)])
def admin_portfolio(db: Session = Depends(get_db)):
    return PortfolioService(db).portfolio(admin=True)


@admin_router.put('/portfolio/profile', response_model=ProfileIn)
def save_profile(payload: ProfileIn, db: Session = Depends(get_db)):
    return PortfolioService(db).save_profile(payload)


@admin_router.get('/projects/{project_id}', response_model=ProjectOut, dependencies=[Depends(no_cache)])
def get_project(project_id: int, db: Session = Depends(get_db)):
    return PortfolioService(db).get(project_id)


@admin_router.post('/projects', response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectIn, db: Session = Depends(get_db)):
    return PortfolioService(db).save(payload)


@admin_router.put('/projects/{project_id}', response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectIn, db: Session = Depends(get_db)):
    return PortfolioService(db).save(payload, project_id)


@admin_router.delete('/projects/{project_id}')
def delete_project(project_id: int, db: Session = Depends(get_db)):
    PortfolioService(db).delete(project_id)
    return {'ok': True}
