from sqlalchemy import Column, Integer, String, Text
from app.core.database import Base


class GiftCatalog(Base):
    __tablename__ = "gifts_catalog"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    price = Column(Integer, nullable=False, default=0)
    icon = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    total_supply = Column(Integer, nullable=True)
    minted_count = Column(Integer, nullable=False, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "icon": self.icon,
            "desc": self.description,
            "imageUrl": self.image_url,
            "totalSupply": self.total_supply,
            "mintedCount": self.minted_count,
        }
