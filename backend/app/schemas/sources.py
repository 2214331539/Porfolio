from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.portfolio import safe_url


class SourceIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=60)
    url: str = Field(min_length=1, max_length=500)
    description: str = Field(default='', max_length=500)
    category: str = Field(default='', max_length=40)
    color: str = Field(default='', max_length=20, pattern=r'^(#[0-9a-fA-F]{6})?$')
    icon_url: str = Field(default='', max_length=500)
    weight: int = Field(default=3, ge=1, le=5)
    sort_order: int = Field(default=0, ge=0, le=100000)
    is_visible: bool = True

    @field_validator('url')
    @classmethod
    def validate_url(cls, value):
        return safe_url(value)

    @field_validator('icon_url')
    @classmethod
    def validate_icon(cls, value):
        return safe_url(value, local=True)


class SourceOut(SourceIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
