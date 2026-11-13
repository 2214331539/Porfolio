from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DoingIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=60)
    body: str = Field(default='', max_length=5000)
    started_on: date
    kind: Literal['main', 'side'] = 'main'


class DoingOut(DoingIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sort_order: int


class DoingOrder(BaseModel):
    """The full arrangement of the two lines: ids from left to right."""
    main: list[int] = Field(default_factory=list, max_length=500)
    side: list[int] = Field(default_factory=list, max_length=500)

    @model_validator(mode='after')
    def no_repeats(self):
        ids = [*self.main, *self.side]
        if len(ids) != len(set(ids)):
            raise ValueError('同一条记录不能出现两次')
        return self
