from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.content import Category, Note, Post, RepositoryFolder, ResumeVersion, SiteSetting, Tag

class ContentRepository:
    def __init__(self, db: Session): self.db = db

    def posts_query(self):
        return self.db.query(Post).options(selectinload(Post.category), selectinload(Post.repository), selectinload(Post.tags))

    def notes_query(self):
        return self.db.query(Note).options(selectinload(Note.repository))

    def list_public_posts(self):
        return self.posts_query().filter(Post.status == 'published', Post.is_private.is_(False)).order_by(Post.is_pinned.desc(), Post.published_at.desc()).all()

    def list_all_posts(self): return self.posts_query().order_by(Post.created_at.desc()).all()
    def get_post_by_id(self, post_id: int): return self.posts_query().filter(Post.id == post_id).first()
    def get_public_post_by_slug(self, slug: str): return self.posts_query().filter(Post.slug == slug, Post.status == 'published', Post.is_private.is_(False)).first()
    def list_public_notes(self): return self.notes_query().filter(Note.status == 'published').order_by(Note.is_pinned.desc(), Note.published_at.desc()).all()
    def list_all_notes(self): return self.notes_query().order_by(Note.created_at.desc()).all()
    def get_note(self, note_id: int): return self.notes_query().filter(Note.id == note_id).first()
    def get_tag(self, tag_id: int): return self.db.get(Tag, tag_id)
    def get_settings(self): return self.db.get(SiteSetting, 1)
    def list_public_resume_versions(self): return self.db.query(ResumeVersion).filter(ResumeVersion.status == 'published').order_by(ResumeVersion.is_current.desc(), ResumeVersion.sort_order.desc(), ResumeVersion.version_date.desc(), ResumeVersion.id.desc()).all()
    def list_all_resume_versions(self): return self.db.query(ResumeVersion).order_by(ResumeVersion.is_current.desc(), ResumeVersion.sort_order.desc(), ResumeVersion.version_date.desc(), ResumeVersion.id.desc()).all()
    def get_resume_version(self, resume_id: int): return self.db.get(ResumeVersion, resume_id)

    def list_repositories(self, content_type: str | None = None):
        query = self.db.query(RepositoryFolder).options(selectinload(RepositoryFolder.children), selectinload(RepositoryFolder.posts), selectinload(RepositoryFolder.notes))
        if content_type is not None: query = query.filter(RepositoryFolder.content_type == content_type)
        return query.order_by(RepositoryFolder.sort_order, RepositoryFolder.name).all()

    def get_repository(self, repository_id: int): return self.db.get(RepositoryFolder, repository_id)

    def find_or_create_tags(self, names: list[str]) -> list[Tag]:
        tags: list[Tag] = []
        for raw_name in names:
            name = raw_name.strip()
            if not name: continue
            slug = name.lower().replace(' ', '-')
            tag = self.db.query(Tag).filter_by(slug=slug).first()
            tags.append(tag or Tag(name=name, slug=slug))
        return tags

    def dashboard_counts(self):
        posts = self.db.query(func.count(Post.id)).scalar() or 0
        notes = self.db.query(func.count(Note.id)).scalar() or 0
        post_views = self.db.query(func.coalesce(func.sum(Post.views), 0)).scalar() or 0
        note_views = self.db.query(func.coalesce(func.sum(Note.views), 0)).scalar() or 0
        published = (self.db.query(func.count(Post.id)).filter(Post.status == 'published').scalar() or 0) + (self.db.query(func.count(Note.id)).filter(Note.status == 'published').scalar() or 0)
        return posts, notes, post_views + note_views, published
