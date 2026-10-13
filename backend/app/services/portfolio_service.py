from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.content import Project, PortfolioProfile
from app.schemas.portfolio import ProjectIn, ProfileIn


class PortfolioService:
    def __init__(self, db: Session):
        self.db = db

    def portfolio(self, admin=False):
        query = self.db.query(Project)
        if not admin:
            query = query.filter(Project.status == 'published')
        profile = self.db.get(PortfolioProfile, 1)
        return {'profile': profile or ProfileIn(title='小潘同学'),
                'projects': query.order_by(Project.sort_order, Project.id).all()}

    def get(self, project_id: int):
        project = self.db.get(Project, project_id)
        if project is None:
            raise HTTPException(404, '作品不存在')
        return project

    def save(self, payload: ProjectIn, project_id: int | None = None):
        project = self.get(project_id) if project_id is not None else Project()
        for key, value in payload.model_dump().items():
            setattr(project, key, value)
        self.db.add(project)
        try:
            self.db.commit()
        except IntegrityError as error:
            self.db.rollback()
            raise HTTPException(409, '作品标识已存在，请使用另一个标识') from error
        self.db.refresh(project)
        return project

    def delete(self, project_id: int):
        self.db.delete(self.get(project_id))
        self.db.commit()

    def save_profile(self, payload: ProfileIn):
        profile = self.db.get(PortfolioProfile, 1) or PortfolioProfile(id=1)
        profile.title = payload.title
        profile.introduction = payload.introduction
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile
