import os

from app import create_app
from app.core.config import Config
from app.core.extensions import db

os.environ["SKIP_DB_BOOTSTRAP"] = "1"

db_path = os.path.join(Config.BASE_DIR, "database.db")

try:
    if os.path.exists(db_path):
        os.remove(db_path)
except Exception:
    pass

app = create_app()
with app.app_context():
    db.create_all()
    print("Production database created (empty).")
