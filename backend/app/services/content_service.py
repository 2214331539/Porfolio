import re
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.content import Note, Post, RepositoryFolder, ResumeVersion, SiteSetting
from app.repositories.content_repository import ContentRepository
from app.schemas.content import BulkAction, NoteIn, NoteUpdate, PostCreate, PostUpdate, RepositoryCreate, RepositoryMove, RepositoryUpdate, ResumeVersionIn, ResumeVersionUpdate, SiteSettings

CJK = re.compile(r'[㐀-鿿豈-﫿]')
LATIN_WORD = re.compile(r'[A-Za-z0-9_]+')

def slugify(value: str) -> str:
    return re.sub(r'[^\w一-鿿]+', '-', value.strip().lower()).strip('-_')

def reading_minutes(content: str) -> int:
    """Roughly 400 CJK characters or 200 latin words per minute."""
    return max(1, round(len(CJK.findall(content)) / 400 + len(LATIN_WORD.findall(content)) / 200))

class ContentService:
    def __init__(self, db: Session): self.db = db; self.repository = ContentRepository(db)

    def _bump(self, item, column: str):
        """Count a view or like without touching `updated_at`, which tracks edits only."""
        model = type(item)
        self.db.execute(update(model).where(model.id == item.id).values({column: getattr(model, column) + 1, 'updated_at': model.updated_at}))
        self.db.commit(); self.db.refresh(item)
        return item

    def list_public_posts(self): return self.repository.list_public_posts()
    def list_admin_posts(self): return self.repository.list_all_posts()
    def get_admin_post(self, post_id: int):
        post = self.repository.get_post_by_id(post_id)
        if post is None: raise HTTPException(404, '文章不存在')
        return post
    def get_public_post(self, slug: str):
        post = self.repository.get_public_post_by_slug(slug)
        if post is None: raise HTTPException(404, '文章不存在')
        return self._bump(post, 'views')

    def _validate_repository(self, repository_id: int | None, content_type: str):
        if repository_id is None: return None
        repository = self.repository.get_repository(repository_id)
        if repository is None or repository.content_type != content_type:
            raise HTTPException(400, '所选仓库不存在或类型不匹配')
        return repository

    def _post_slug(self, requested: str | None, title: str, current_id: int | None = None) -> str:
        """Explicit slugs must be unique; slugs derived from the title get a numeric suffix instead."""
        taken = lambda slug: self.db.query(Post.id).filter(Post.slug == slug, Post.id != current_id).first() is not None
        if requested is not None and requested.strip():
            slug = slugify(requested)
            if not slug: raise HTTPException(400, '链接标识需要包含文字或数字')
            if taken(slug): raise HTTPException(409, f'链接标识“{slug}”已被其他文章使用')
            return slug
        base = slugify(title) or 'post'
        slug, suffix = base, 2
        while taken(slug): slug = f'{base}-{suffix}'; suffix += 1
        return slug

    def create_post(self, payload: PostCreate):
        self._validate_repository(payload.repository_id, 'post')
        values = payload.model_dump(exclude={'tag_names', 'slug', 'published_at'})
        post = Post(**values, slug=self._post_slug(payload.slug, payload.title), reading_time=reading_minutes(payload.content))
        post.published_at = payload.published_at or datetime.now(timezone.utc)
        post.tags = self.repository.find_or_create_tags(payload.tag_names)
        self.db.add(post); self.db.commit()
        return self.repository.get_post_by_id(post.id)

    def update_post(self, post_id: int, payload: PostUpdate):
        post = self.get_admin_post(post_id)
        values = payload.model_dump(exclude_unset=True); tag_names = values.pop('tag_names', None)
        if 'repository_id' in values: self._validate_repository(values['repository_id'], 'post')
        if 'slug' in values: values['slug'] = self._post_slug(values['slug'], values.get('title', post.title), post.id)
        if values.get('published_at') is None: values.pop('published_at', None)
        # Publishing a draft stamps the publish time, unless the editor picked one explicitly.
        if values.get('status') == 'published' and post.status != 'published' and 'published_at' not in values:
            values['published_at'] = datetime.now(timezone.utc)
        for field, value in values.items(): setattr(post, field, value)
        if 'content' in values: post.reading_time = reading_minutes(post.content)
        if tag_names is not None: post.tags = self.repository.find_or_create_tags(tag_names)
        self.db.commit()
        return self.repository.get_post_by_id(post_id)

    def _delete_orphan_tags(self, tag_ids: set[int]):
        for tag_id in tag_ids:
            if self.db.query(Post.id).filter(Post.tags.any(id=tag_id)).first() is None:
                tag = self.repository.get_tag(tag_id)
                if tag is not None: self.db.delete(tag)

    def delete_post(self, post_id: int):
        post = self.get_admin_post(post_id)
        tag_ids = {tag.id for tag in post.tags}
        self.db.delete(post); self.db.flush()
        self._delete_orphan_tags(tag_ids)
        self.db.commit()

    def _bulk(self, model, content_type: str, payload: BulkAction):
        items = self.db.query(model).filter(model.id.in_(payload.ids)).all()
        if len(items) != len(set(payload.ids)): raise HTTPException(404, '部分内容不存在，请刷新后重试')
        if payload.action == 'move': self._validate_repository(payload.repository_id, content_type)
        stamp = datetime.now(timezone.utc); tag_ids: set[int] = set()
        for item in items:
            if payload.action == 'move': item.repository_id = payload.repository_id
            elif payload.action == 'publish':
                if item.status != 'published': item.status = 'published'; item.published_at = stamp
            elif payload.action == 'draft': item.status = 'draft'
            else:
                if model is Post: tag_ids.update(tag.id for tag in item.tags)
                self.db.delete(item)
        self.db.flush()
        self._delete_orphan_tags(tag_ids)
        self.db.commit()
        return {'ok': True, 'count': len(items)}

    def bulk_posts(self, payload: BulkAction): return self._bulk(Post, 'post', payload)
    def bulk_notes(self, payload: BulkAction): return self._bulk(Note, 'note', payload)

    def list_public_notes(self): return self.repository.list_public_notes()
    def list_admin_notes(self): return self.repository.list_all_notes()
    def get_admin_note(self, note_id: int):
        note = self.repository.get_note(note_id)
        if note is None: raise HTTPException(404, '图文不存在')
        return note
    def get_public_note(self, note_id: int):
        note = self.repository.get_note(note_id)
        if note is None or note.status != 'published': raise HTTPException(404, '图文不存在')
        return self._bump(note, 'views')

    def create_note(self, payload: NoteIn):
        self._validate_repository(payload.repository_id, 'note')
        note = Note(**payload.model_dump()); self.db.add(note); self.db.commit(); self.db.refresh(note); return note
    def update_note(self, note_id: int, payload: NoteUpdate):
        note = self.get_admin_note(note_id)
        values = payload.model_dump(exclude_unset=True)
        if 'repository_id' in values: self._validate_repository(values['repository_id'], 'note')
        if values.get('status') == 'published' and note.status != 'published': values['published_at'] = datetime.now(timezone.utc)
        for field, value in values.items(): setattr(note, field, value)
        self.db.commit(); self.db.refresh(note); return note
    def delete_note(self, note_id: int):
        self.db.delete(self.get_admin_note(note_id)); self.db.commit()
    def like_note(self, note_id: int):
        note = self.repository.get_note(note_id)
        if note is None or note.status != 'published': raise HTTPException(404, '图文不存在')
        return self._bump(note, 'likes')

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
        base = slugify(requested or name) or 'repository'
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

    def _next_sort_order(self, content_type: str, parent_id: int | None) -> int:
        siblings = self.db.query(RepositoryFolder.sort_order).filter(
            RepositoryFolder.content_type == content_type,
            RepositoryFolder.parent_id.is_(None) if parent_id is None else RepositoryFolder.parent_id == parent_id,
        ).all()
        return max((row[0] for row in siblings), default=-1) + 1

    def create_repository(self, payload: RepositoryCreate):
        self._validate_parent(payload.parent_id, payload.content_type)
        values = payload.model_dump(exclude={'slug', 'sort_order'})
        # New repositories go to the end of their siblings, matching where the admin tree shows them.
        sort_order = payload.sort_order if 'sort_order' in payload.model_fields_set else self._next_sort_order(payload.content_type, payload.parent_id)
        folder = RepositoryFolder(**values, sort_order=sort_order, slug=self._repository_slug(payload.name, payload.slug, payload.content_type))
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

    def move_repository(self, repository_id: int, payload: RepositoryMove):
        """Place a repository under `parent_id` at `position` among its siblings and renumber them."""
        folder = self.repository.get_repository(repository_id)
        if folder is None: raise HTTPException(404, '仓库不存在')
        self._validate_parent(payload.parent_id, folder.content_type, folder.id)
        siblings = self.db.query(RepositoryFolder).filter(
            RepositoryFolder.content_type == folder.content_type,
            RepositoryFolder.parent_id.is_(None) if payload.parent_id is None else RepositoryFolder.parent_id == payload.parent_id,
            RepositoryFolder.id != folder.id,
        ).order_by(RepositoryFolder.sort_order, RepositoryFolder.name).all()
        siblings.insert(min(payload.position, len(siblings)), folder)
        folder.parent_id = payload.parent_id
        for index, item in enumerate(siblings): item.sort_order = index
        self.db.commit()
        return self.list_admin_repositories(folder.content_type)

    def delete_repository(self, repository_id: int, lift_contents: bool = False):
        """Delete a repository. With `lift_contents`, its items and sub-repositories move up one level first."""
        folder = self.repository.get_repository(repository_id)
        if folder is None: raise HTTPException(404, '仓库不存在')
        if not lift_contents and (folder.children or folder.posts or folder.notes): raise HTTPException(409, '请先移走仓库内的内容和子仓库')
        next_order = self._next_sort_order(folder.content_type, folder.parent_id)
        for offset, child in enumerate(sorted(folder.children, key=lambda item: (item.sort_order, item.name))):
            child.parent_id = folder.parent_id; child.sort_order = next_order + offset
        for item in [*folder.posts, *folder.notes]: item.repository_id = folder.parent_id
        self.db.flush()
        # Reload the (now empty) collections so deleting the folder cannot null out the moved rows.
        self.db.expire(folder, ['children', 'posts', 'notes'])
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
