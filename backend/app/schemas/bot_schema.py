from app.core.extensions import ma
from app.models.bot import Bot

class BotSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Bot
        load_instance = True
        exclude = ("bot_token_hash",)

bot_schema = BotSchema()
bots_schema = BotSchema(many=True)
