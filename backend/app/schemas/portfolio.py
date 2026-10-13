from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


def safe_url(value: str, local: bool = False) -> str:
    if not value:
        return value
    if any(char.isspace() for char in value) or '\\' in value:
        raise ValueError('链接不能包含空白或反斜杠')
    if local and value.startswith('/uploads/') and '..' not in value:
        return value
    parsed = urlsplit(value)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('请输入完整的 HTTP 或 HTTPS 地址')
    return value


class Screenshot(BaseModel):
    src: str = Field(min_length=1, max_length=500)
    alt: str = Field(default='', max_length=200)

    @field_validator('src')
    @classmethod
    def validate_src(cls, value):
        return safe_url(value, local=True)


class ProfileIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)
    title: str = Field(min_length=1, max_length=120)
    introduction: str = Field(default='', max_length=10000)


class ProjectIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)
    slug: str = Field(min_length=1, max_length=80, pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    name: str = Field(min_length=1, max_length=120)
    summary: str = Field(default='', max_length=300)
    category: str = Field(default='', max_length=100)
    description: str = Field(default='', max_length=20000)
    icon_key: Literal['default', 'couploc', 'soundtag', 'cooking', 'impromptu', 'shopify'] = 'default'
    icon_url: str = Field(default='', max_length=500)
    url: str = Field(default='', max_length=500)
    link_label: str = Field(default='访问作品', min_length=1, max_length=30)
    keywords: list[str] = Field(default_factory=list, max_length=12)
    screenshots: list[Screenshot] = Field(default_factory=list, max_length=20)
    status: Literal['draft', 'published'] = 'draft'
    sort_order: int = Field(default=0, ge=0, le=100000)

    @field_validator('url')
    @classmethod
    def validate_url(cls, value):
        return safe_url(value)

    @field_validator('icon_url')
    @classmethod
    def validate_icon(cls, value):
        return safe_url(value, local=True)

    @field_validator('keywords')
    @classmethod
    def validate_keywords(cls, value):
        if any(not word.strip() or len(word) > 40 for word in value):
            raise ValueError('每个标签需要 1–40 个字符')
        return list(dict.fromkeys(word.strip() for word in value))


class ProjectOut(ProjectIn):
    id: int


class PortfolioOut(BaseModel):
    profile: ProfileIn
    projects: list[ProjectOut]
