from sqlalchemy.dialects.sqlite import INTEGER, TEXT

from app.core.extensions import db


class GiftCatalog(db.Model):
    __tablename__ = "gifts_catalog"

    id = db.Column(TEXT, primary_key=True)
    name = db.Column(TEXT, nullable=False)
    coin_price = db.Column(INTEGER, nullable=False, default=0)
    icon = db.Column(TEXT, nullable=True)
    description = db.Column(TEXT, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "coinPrice": self.coin_price,
            "icon": self.icon,
            "desc": self.description,
        }
