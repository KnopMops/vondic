from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class StickerItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: Optional[str] = None
    url: str
    type: str = "sticker"
    created_at: Optional[str] = None


class StickerCategorySchema(BaseModel):
    category: str
    items: List[StickerItemSchema]


class StickersResponseSchema(BaseModel):
    success: bool = True
    categories: List[StickerCategorySchema]


class StickerUploadResponseSchema(BaseModel):
    success: bool = True
    sticker: StickerItemSchema
