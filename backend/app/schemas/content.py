from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class CategoryOut(BaseModel):
    id: int; name: str; slug: str; description: str = ""
    model_config = ConfigDict(from_attributes=True)
class TagOut(BaseModel):
    id: int; name: str; slug: str
    model_config = ConfigDict(from_attributes=True)
class RepositorySummary(BaseModel):
    id: int; name: str; slug: str; description: str = ""; content_type: Literal['post', 'note']; parent_id: int | None = None; sort_order: int = 0
    model_config = ConfigDict(from_attributes=True)
class RepositoryOut(RepositorySummary):
    item_count: int = 0; child_count: int = 0
class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80); slug: str | None = Field(default=None, max_length=100); description: str = ""
    content_type: Literal['post', 'note']; parent_id: int | None = None; sort_order: int = 0
class RepositoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80); slug: str | None = Field(default=None, max_length=100)
    description: str | None = None; parent_id: int | None = None; sort_order: int | None = None
class PostBase(BaseModel):
    title: str; slug: str; excerpt: str = ""; content: str = ""; cover_url: str | None = None
    status: Literal['draft', 'published'] = "draft"; is_pinned: bool = False; is_private: bool = False
    category_id: int | None = None; repository_id: int | None = None; tag_names: list[str] = Field(default_factory=list)
class PostCreate(PostBase): pass
class PostUpdate(BaseModel):
    title: str | None = None; slug: str | None = None; excerpt: str | None = None; content: str | None = None
    cover_url: str | None = None; status: Literal['draft', 'published'] | None = None; is_pinned: bool | None = None; is_private: bool | None = None
    category_id: int | None = None; repository_id: int | None = None; tag_names: list[str] | None = None
class PostOut(BaseModel):
    id: int; title: str; slug: str; excerpt: str; content: str; cover_url: str | None; status: str
    is_pinned: bool; is_private: bool; repository_id: int | None = None; views: int; reading_time: int; published_at: datetime; created_at: datetime
    category: CategoryOut | None = None; repository: RepositorySummary | None = None; tags: list[TagOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)
class NoteIn(BaseModel):
    title: str; content: str = ""; images: list[str] = Field(default_factory=list); topics: list[str] = Field(default_factory=list); repository_id: int | None = None; status: Literal['draft', 'published'] = "draft"; is_pinned: bool = False
class NoteUpdate(BaseModel):
    title: str | None = None; content: str | None = None; images: list[str] | None = None; topics: list[str] | None = None; repository_id: int | None = None
    status: Literal['draft', 'published'] | None = None; is_pinned: bool | None = None
class NoteOut(NoteIn):
    id: int; views: int; likes: int; published_at: datetime
    repository: RepositorySummary | None = None
    model_config = ConfigDict(from_attributes=True)
class ResumeVersionIn(BaseModel):
    title: str = Field(min_length=1, max_length=120); label: str = Field(default="个人简历", min_length=1, max_length=40)
    description: str = ""; image_url: str = Field(min_length=1, max_length=500); pdf_url: str | None = Field(default=None, max_length=500)
    version_date: date = Field(default_factory=date.today); status: Literal['draft', 'published'] = "draft"; is_current: bool = False; sort_order: int = 0
class ResumeVersionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120); label: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = None; image_url: str | None = Field(default=None, min_length=1, max_length=500); pdf_url: str | None = Field(default=None, max_length=500)
    version_date: date | None = None; status: Literal['draft', 'published'] | None = None; is_current: bool | None = None; sort_order: int | None = None
class ResumeVersionOut(ResumeVersionIn):
    id: int; created_at: datetime; updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
class LoginIn(BaseModel): username: str; password: str
class TokenOut(BaseModel): access_token: str; token_type: str = "bearer"
class SiteSettings(BaseModel):
    site_title: str = "纸上见山"; site_description: str = "记录代码、设计与日常。"; hero_kicker: str = "A quiet corner on the internet"
    mottos: list[str] = ["慢慢来，比较快。"]; footer_text: str = "写作、创造，偶尔发呆。"; icp_number: str = ""; github_url: str = "https://github.com/"; email: str = "hello@example.com"
    wechat_handle: str = "小潘的数字花园"; wechat_url: str = "https://weixin.qq.com/"
    douyin_handle: str = "@小潘"; douyin_url: str = "https://www.douyin.com/"
    xiaohongshu_handle: str = "@小潘"; xiaohongshu_url: str = "https://www.xiaohongshu.com/"
    github_handle: str = "@xiaopan"
