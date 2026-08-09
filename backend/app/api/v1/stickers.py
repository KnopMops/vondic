from flask import Blueprint, jsonify

stickers_bp = Blueprint("stickers", __name__, url_prefix="/api/v1/stickers")

# Встроенная подборка трендовых стикеров и GIF для чата
FEATURED_STICKERS = [
    {
        "category": "Реакции",
        "items": [
            {"id": "stk_cat_love", "name": "Влюбленный котик", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExODg1dzR5dDNsbXB3NmI3ZnptOHVqMndtdzFwOHgwdXUzeWZ6ZWs2ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/MDJ9IbxxvDUQM/giphy.gif", "type": "sticker"},
            {"id": "stk_doge_wow", "name": "Doge Wow", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpqa2k0dXNmcnduaDRxdTFxYnRocmxlOWU3Z2FmdDVkbmYxN2EwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/oF5oUYTOhvZOE/giphy.gif", "type": "sticker"},
            {"id": "stk_cat_dance", "name": "Танцующий кот", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWVubW0ydmtidGJxczg5bmtzZmZzaWRhMnRnbXlscHdzajc4cGc2ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/CjmvTCZf2U3p09Cn0h/giphy.gif", "type": "sticker"},
            {"id": "stk_thumbs_up", "name": "Класс!", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHlnenBqenF0ZWF1OHMza3ZwbzQ0dzIxa2w5MXp0dnE3M3p2dzRtbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/111ebonMs90YLu/giphy.gif", "type": "sticker"},
            {"id": "stk_popcorn", "name": "Попкорн", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMml2ODV5dnhvbjRjNzFmdm41cGc1eHFmOGI0emNwbWh6eXdtNnloNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/NipFetnQOuKhW/giphy.gif", "type": "sticker"},
            {"id": "stk_heart_sparkle", "name": "Сердечко", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW11bXVsa2p5eHVwbWRocWpyMjQzYzJ6ZmlmZWVnZjFxdmpubTN1YSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/LpDmM2w9aE9DW/giphy.gif", "type": "sticker"},
        ]
    },
    {
        "category": "Трендовые GIF",
        "items": [
            {"id": "gif_mind_blown", "name": "Mind Blown", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbms1ODBsZmxyOGo5czI4ZnhuYmx4cm1iOHJ0aGozNnJsaXUyaWhuaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipQqU2lhNA4g/giphy.gif", "type": "gif"},
            {"id": "gif_cat_typing", "name": "Кот печатает", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2R4OTBxc2I0bzhrNWRrcXFsbHNvaXRxdXZiNDB0MXBwYmludnllZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif", "type": "gif"},
            {"id": "gif_cheers", "name": "Ди Каприо салют", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWk3amFqODg5dWdrOTdnbmIxeWV0ZjdzdmhxcmFncmY3azFrcnlzaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif", "type": "gif"},
            {"id": "gif_homer_bush", "name": "Гомер в кустах", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGxxc2RxdHhsbGVkZnFzYXFsemlwbWwza3NkdW4waDVidjJydmJucCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/COYGe9rZvfRQc/giphy.gif", "type": "gif"},
            {"id": "gif_rock_eyebrow", "name": "Скалолаз Скала", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNm0zb2sxeWpvc2Vybms1ZHdxYXdtcGkyOHY3NGgxaHhsdWpzcTF5NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ghbWoXv3G6ypo8U/giphy.gif", "type": "gif"},
            {"id": "gif_snoopy_dance", "name": "Танец Снупи", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZhcGVxZ3AyaG40Nm05NXBsaWs1cWV6b2ZzZ28yaTRtOGlhODU1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/134vVkHV9wQtaw/giphy.gif", "type": "gif"},
        ]
    }
]

@stickers_bp.route("", methods=["GET"])
def get_stickers():
    return jsonify({
        "success": True,
        "categories": FEATURED_STICKERS
    })
