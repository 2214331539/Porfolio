import re
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.content import Note, Post, RepositoryFolder, ResumeVersion, SiteSetting
from app.repositories.content_repository import ContentRepository
from app.schemas.content import NoteIn, NoteUpdate, PostCreate, PostUpdate, RepositoryCreate, RepositoryUpdate, ResumeVersionIn, ResumeVersionUpdate, SiteSettings

class ContentService:
    def __init__(self, db: Session): self.db = db; self.repository = ContentRepository(db)

    def list_public_posts(self): return self.repository.list_public_posts()
    def list_admin_posts(self): return self.repository.list_all_posts()
    def get_admin_post(self, post_id: int):
        post = self.repository.get_post_by_id(post_id)
        if post is None: raise HTTPException(404, '文章不存在')
        return post
    def get_public_post(self, slug: str):
        post = self.repository.get_public_post_by_slug(slug)
        if post is None: raise HTTPException(404, '文章不存在')
        post.views += 1; self.db.commit(); self.db.refresh(post)
        return post

    def _validate_repository(self, repository_id: int | None, content_type: str):
        if repository_id is None: return None
        repository = self.repository.get_repository(repository_id)
        if repository is None or repository.content_type != content_type:
            raise HTTPException(400, '所选仓库不存在或类型不匹配')
        return repository

    def create_post(self, payload: PostCreate):
        self._validate_repository(payload.repository_id, 'post')
        post = Post(**payload.model_dump(exclude={'tag_names'}), reading_time=max(1, len(payload.content) // 500))
        post.tags = self.repository.find_or_create_tags(payload.tag_names)
        self.db.add(post); self.db.commit()
        return self.repository.get_post_by_id(post.id)

    def update_post(self, post_id: int, payload: PostUpdate):
        post = self.repository.get_post_by_id(post_id)
        if post is None: raise HTTPException(404, '文章不存在')
        values = payload.model_dump(exclude_unset=True); tag_names = values.pop('tag_names', None)
        if 'repository_id' in values: self._validate_repository(values['repository_id'], 'post')
        for field, value in values.items(): setattr(post, field, value)
        if 'content' in values: post.reading_time = max(1, len(post.content) // 500)
        if tag_names is not None: post.tags = self.repository.find_or_create_tags(tag_names)
        self.db.commit()
        return self.repository.get_post_by_id(post_id)

    def delete_post(self, post_id: int):
        post = self.repository.get_post_by_id(post_id)
        if post is None: raise HTTPException(404, '文章不存在')
        tag_ids = [tag.id for tag in post.tags]
        self.db.delete(post)
        self.db.flush()
        for tag_id in tag_ids:
            has_other_posts = self.db.query(Post.id).filter(Post.tags.any(id=tag_id)).first() is not None
            if not has_other_posts:
                tag = self.repository.get_tag(tag_id)
                if tag is not None:
                    self.db.delete(tag)
        self.db.commit()

    def list_public_notes(self): return self.repository.list_public_notes()
    def list_admin_notes(self): return self.repository.list_all_notes()
    def get_public_note(self, note_id: int):
        note = self.repository.get_note(note_id)
        if note is None or note.status != 'published': raise HTTPException(404, '图文不存在')
        note.views += 1; self.db.commit(); self.db.refresh(note)
        return note

    def create_note(self, payload: NoteIn):
        self._validate_repository(payload.repository_id, 'note')
        note = Note(**payload.model_dump()); self.db.add(note); self.db.commit(); self.db.refresh(note); return note
    def update_note(self, note_id: int, payload: NoteUpdate):
        note = self.repository.get_note(note_id)
        if note is None: raise HTTPException(404, '图文不存在')
        values = payload.model_dump(exclude_unset=True)
        if 'repository_id' in values: self._validate_repository(values['repository_id'], 'note')
        for field, value in values.items(): setattr(note, field, value)
        self.db.commit(); self.db.refresh(note); return note
    def delete_note(self, note_id: int):
        note = self.repository.get_note(note_id)
        if note is None: raise HTTPException(404, '图文不存在')
        self.db.delete(note); self.db.commit()
    def like_note(self, note_id: int):
        note = self.repository.get_note(note_id)
        if note is None: raise HTTPException(404, '图文不存在')
        note.likes += 1; self.db.commit(); self.db.refresh(note); return note

    def list_public_resume_versions(self): return self.repository.list_public_resume_versions()
    def list_admin_resume_versions(self): return self.repository.list_all_resume_versions()
    def get_public_resume_version(self, resume_id: int):
        resume = self.repository.get_resume_version(resume_id)
        if resume is None or resume.status != 'published': raise HTTPException(404, '简历版本不存在')
        return resume
    def _demote_resume_versions(self, except_id: int | None = None):
        query = self.db.query(ResumeVersion).filter(ResumeVersion.is_current.is_(True))
        if except_id is not None: query = query.filter(ResumeVersion.id != except_id)
        query.update({ResumeVersion.is_current: False}, synchronize_session=False)
    def _promote_latest_resume(self):
        if self.db.query(ResumeVersion.id).filter(ResumeVersion.is_current.is_(True)).first(): return
        latest = self.db.query(ResumeVersion).filter(ResumeVersion.status == 'published').order_by(ResumeVersion.sort_order.desc(), ResumeVersion.version_date.desc(), ResumeVersion.id.desc()).first()
        if latest is not None: latest.is_current = True
    def create_resume_version(self, payload: ResumeVersionIn):
        values = payload.model_dump()
        if values['is_current'] and values['status'] != 'published': raise HTTPException(400, '当前最新版必须先发布')
        if values['is_current']: self._demote_resume_versions()
        resume = ResumeVersion(**values); self.db.add(resume); self.db.flush(); self._promote_latest_resume(); self.db.commit(); self.db.refresh(resume); return resume
    def update_resume_version(self, resume_id: int, payload: ResumeVersionUpdate):
        resume = self.repository.get_resume_version(resume_id)
        if resume is None: raise HTTPException(404, '简历版本不存在')
        values = payload.model_dump(exclude_unset=True)
        was_current = resume.is_current
        final_status = values.get('status', resume.status)
        if values.get('is_current') is True and final_status != 'published': raise HTTPException(400, '当前最新版必须先发布')
        if was_current and final_status != 'published': values['is_current'] = False
        if values.get('is_current') is True: self._demote_resume_versions(resume.id)
        for field, value in values.items(): setattr(resume, field, value)
        self.db.flush()
        self._promote_latest_resume()
        self.db.commit(); self.db.refresh(resume); return resume
    def delete_resume_version(self, resume_id: int):
        resume = self.repository.get_resume_version(resume_id)
        if resume is None: raise HTTPException(404, '简历版本不存在')
        was_current = resume.is_current
        self.db.delete(resume); self.db.flush()
        if was_current: self._promote_latest_resume()
        self.db.commit()

    def list_repositories(self, content_type: str | None = None):
        if content_type not in {None, 'post', 'note'}: raise HTTPException(400, '不支持的仓库类型')
        folders = self.repository.list_repositories(content_type)
        direct_counts: dict[int, int] = {}
        children: dict[int, list[int]] = {}
        for folder in folders:
            items = folder.posts if folder.content_type == 'post' else folder.notes
            visible_items = [item for item in items if item.status == 'published' and (folder.content_type != 'post' or not item.is_private)]
            direct_counts[folder.id] = len(visible_items)
            if folder.parent_id is not None: children.setdefault(folder.parent_id, []).append(folder.id)

        visible_cache: dict[int, bool] = {}
        def is_visible(folder_id: int, trail: set[int] | None = None) -> bool:
            if folder_id in visible_cache: return visible_cache[folder_id]
            path = trail or set()
            if folder_id in path: return False
            visible = direct_counts.get(folder_id, 0) > 0 or any(is_visible(child_id, path | {folder_id}) for child_id in children.get(folder_id, []))
            visible_cache[folder_id] = visible
            return visible

        result = []
        for folder in folders:
            if not is_visible(folder.id): continue
            result.append({
                'id': folder.id, 'name': folder.name, 'slug': folder.slug, 'description': folder.description,
                'content_type': folder.content_type, 'parent_id': folder.parent_id, 'sort_order': folder.sort_order,
                'item_count': direct_counts[folder.id], 'child_count': sum(is_visible(child_id) for child_id in children.get(folder.id, [])),
            })
        return result

    def list_admin_repositories(self, content_type: str | None = None):
        folders = self.repository.list_repositories(content_type)
        return [{
            'id': folder.id, 'name': folder.name, 'slug': folder.slug, 'description': folder.description,
            'content_type': folder.content_type, 'parent_id': folder.parent_id, 'sort_order': folder.sort_order,
            'item_count': len(folder.posts if folder.content_type == 'post' else folder.notes), 'child_count': len(folder.children),
        } for folder in folders]

    def _repository_slug(self, name: str, requested: str | None, content_type: str, current_id: int | None = None):
        base = re.sub(r'[^\w\u4e00-\u9fff]+', '-', (requested or name).strip().lower()).strip('-') or 'repository'
        slug = base; suffix = 2
        while self.db.query(RepositoryFolder.id).filter(RepositoryFolder.content_type == content_type, RepositoryFolder.slug == slug, RepositoryFolder.id != current_id).first():
            slug = f'{base}-{suffix}'; suffix += 1
        return slug

    def _validate_parent(self, parent_id: int | None, content_type: str, current_id: int | None = None):
        if parent_id is None: return
        if parent_id == current_id: raise HTTPException(400, '仓库不能放入自身')
        parent = self._validate_repository(parent_id, content_type)
        visited: set[int] = set()
        while parent is not None:
            if parent.id in visited or parent.id == current_id: raise HTTPException(400, '仓库层级不能形成循环')
            visited.add(parent.id)
            parent = parent.parent

    def create_repository(self, payload: RepositoryCreate):
        self._validate_parent(payload.parent_id, payload.content_type)
        folder = RepositoryFolder(**payload.model_dump(exclude={'slug'}), slug=self._repository_slug(payload.name, payload.slug, payload.content_type))
        self.db.add(folder); self.db.commit(); self.db.refresh(folder)
        return next(item for item in self.list_admin_repositories(payload.content_type) if item['id'] == folder.id)

    def update_repository(self, repository_id: int, payload: RepositoryUpdate):
        folder = self.repository.get_repository(repository_id)
        if folder is None: raise HTTPException(404, '仓库不存在')
        values = payload.model_dump(exclude_unset=True)
        self._validate_parent(values.get('parent_id', folder.parent_id), folder.content_type, folder.id)
        if 'slug' in values or 'name' in values:
            values['slug'] = self._repository_slug(values.get('name', folder.name), values.pop('slug', None), folder.content_type, folder.id)
        for field, value in values.items(): setattr(folder, field, value)
        self.db.commit(); self.db.refresh(folder)
        return next(item for item in self.list_admin_repositories(folder.content_type) if item['id'] == folder.id)

    def delete_repository(self, repository_id: int):
        folder = self.repository.get_repository(repository_id)
        if folder is None: raise HTTPException(404, '仓库不存在')
        if folder.children or folder.posts or folder.notes: raise HTTPException(409, '请先移走仓库内的内容和子仓库')
        self.db.delete(folder); self.db.commit()
    def get_settings(self):
        setting = self.repository.get_settings()
        return SiteSettings(**(setting.data if setting else {}))
    def update_settings(self, payload: SiteSettings):
        setting = self.repository.get_settings() or SiteSetting(id=1)
        setting.data = payload.model_dump(); self.db.add(setting); self.db.commit(); return payload
    def dashboard(self):
        posts, notes, views, published = self.repository.dashboard_counts()
        return {'posts': posts, 'notes': notes, 'views': views, 'published': published, 'recent_posts': self.repository.posts_query().order_by(Post.created_at.desc()).limit(5).all()}
