import uuid
import json
from datetime import datetime

from sqlalchemy import INTEGER, TEXT, TIMESTAMP, ForeignKey
from werkzeug.security import generate_password_hash, check_password_hash

from app.core.extensions import db


class OAuthClient(db.Model):
    __tablename__ = "oauth_clients"

    id = db.Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(TEXT, ForeignKey("users.id"), nullable=False)
    client_id = db.Column(TEXT, unique=True, nullable=False)
    client_secret_hash = db.Column(TEXT, nullable=False)
    client_secret_plain = db.Column(TEXT, nullable=True)
    name = db.Column(TEXT, nullable=False)
    description = db.Column(TEXT, default=None)
    redirect_uris = db.Column(TEXT, nullable=False)
    is_active = db.Column(INTEGER, default=1)
    created_at = db.Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = db.Column(
        TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    _META_PREFIX = "__VONDIC_OAUTH_META__:"

    def set_client_secret(self, secret):
        self.client_secret_hash = generate_password_hash(secret)

    def check_client_secret(self, secret):
        return check_password_hash(self.client_secret_hash, secret)

    @staticmethod
    def generate_client_id():
        return str(uuid.uuid4())

    @staticmethod
    def generate_client_secret():
        return str(uuid.uuid4()) + str(uuid.uuid4()).replace("-", "")

    def _parse_description(self):
        raw = self.description or ""
        if isinstance(raw, str) and raw.startswith(self._META_PREFIX):
            payload = raw[len(self._META_PREFIX):]
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, dict):
                    text = parsed.get("text") or ""
                    logo_url = parsed.get("logo_url") or ""
                    default_scopes = parsed.get("default_scopes") or []
                    if not isinstance(default_scopes, list):
                        default_scopes = []
                    default_scopes = [str(s).strip()
                                      for s in default_scopes if str(s).strip()]
                    return text, logo_url, default_scopes
            except Exception:
                pass
        return raw, "", []

    def set_description_fields(
            self,
            text="",
            logo_url="",
            default_scopes=None):
        if default_scopes is None:
            default_scopes = []
        clean_scopes = [str(s).strip()
                        for s in default_scopes if str(s).strip()]
        data = {
            "text": text or "",
            "logo_url": logo_url or "",
            "default_scopes": clean_scopes,
        }
        self.description = self._META_PREFIX + \
            json.dumps(data, ensure_ascii=False)

    def get_public_description(self):
        text, _, _ = self._parse_description()
        return text

    def get_logo_url(self):
        _, logo_url, _ = self._parse_description()
        return logo_url

    def get_default_scopes(self):
        _, _, default_scopes = self._parse_description()
        return default_scopes

    def to_dict(self):
        desc_text, logo_url, default_scopes = self._parse_description()
        return {
            "id": self.id,
            "client_id": self.client_id,
            "client_secret": self.client_secret_plain,
            "name": self.name,
            "description": desc_text,
            "logo_url": logo_url,
            "default_scopes": default_scopes,
            "redirect_uris": self.redirect_uris.split(",") if self.redirect_uris else [],
            "is_active": bool(
                self.is_active),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
