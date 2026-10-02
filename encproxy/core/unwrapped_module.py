import json
import logging
from typing import Dict, List, Optional, Callable, Any, Tuple
from dataclasses import dataclass, field

from .crypto_engine import CryptoEngine

logger = logging.getLogger(__name__)


@dataclass
class PeerTarget:
    user_id: str
    username: str = ""
    status: str = "active"  # "pending_approval", "active", "blocked"
    dh_public_key: Optional[str] = None
    created_at: float = field(default_factory=lambda: 0.0)


class UnwrappedModule:
    """
    Handles peer routing and unwrapping:
    - User specifies which peer user IDs must communicate via EncProxy.
    - Decrypts encrypted payloads for approved peers transparently before handing to UI.
    - Encrypts outbound messages to specified peers before dispatching to Vondic server.
    - Manages pending authorization handshakes from peers.
    """

    def __init__(self, crypto_engine: CryptoEngine):
        self.crypto_engine = crypto_engine
        self.targets: Dict[str, PeerTarget] = {}
        self.pending_approvals: List[Dict[str, Any]] = []
        self.approval_listeners: List[Callable[[Dict[str, Any]], None]] = []

    def add_target_peer(self, user_id: str, username: str = "", dh_public_key: Optional[str] = None):
        """Add or update a target peer for EncProxy encryption."""
        target = PeerTarget(
            user_id=user_id.strip(),
            username=username.strip() or user_id.strip(),
            status="active" if dh_public_key else "pending_approval",
            dh_public_key=dh_public_key,
        )
        self.targets[target.user_id] = target
        if dh_public_key:
            self.crypto_engine.derive_shared_secret(target.user_id, dh_public_key)

    def remove_target_peer(self, user_id: str):
        if user_id in self.targets:
            del self.targets[user_id]

    def is_peer_encrypted(self, user_id: str) -> bool:
        return user_id in self.targets and self.targets[user_id].status == "active"

    def approve_peer(self, user_id: str, dh_public_key: str):
        """Approve a peer and establish shared session key."""
        self.add_target_peer(user_id=user_id, dh_public_key=dh_public_key)
        self.pending_approvals = [p for p in self.pending_approvals if p.get("user_id") != user_id]

    def auto_approve_peer(self, user_id: str, username: str = "", dh_public_key: Optional[str] = None):
        """Automatically add peer to targets with intercepted key and activate encryption."""
        uid = str(user_id).strip()
        uname = str(username).strip() or uid
        self.add_target_peer(user_id=uid, username=uname, dh_public_key=dh_public_key)
        self.pending_approvals = [p for p in self.pending_approvals if p.get("user_id") != uid]
        logger.info(f"[EncProxy] Auto-paired peer {uname} ({uid}) with intercepted key!")
        for listener in self.approval_listeners:
            try:
                listener({"user_id": uid, "username": uname, "status": "active", "dh_public_key": dh_public_key})
            except Exception:
                pass


    def register_pending_request(self, user_id: str, username: str, dh_public_key: str):
        req = {
            "user_id": user_id,
            "username": username,
            "dh_public_key": dh_public_key,
        }
        self.pending_approvals.append(req)
        for listener in self.approval_listeners:
            try:
                listener(req)
            except Exception:
                pass

    def unwrap_inbound_message(self, sender_id: str, raw_content: str) -> Tuple[str, bool]:
        """
        If message is from an approved peer and is encrypted, decrypt it (unwrap).
        Returns: (unwrapped_content, was_unwrapped)
        """
        if not raw_content or not raw_content.startswith("encproxy:"):
            return raw_content, False

        key = self.crypto_engine.peer_shared_secrets.get(sender_id)
        if not key:
            # Try to see if target peer exists with known key
            target = self.targets.get(sender_id)
            if target and target.dh_public_key:
                key = self.crypto_engine.derive_shared_secret(sender_id, target.dh_public_key)

        if not key:
            return "[EncProxy: Ожидается одобрение ключа для расшифровки]", True

        decrypted = self.crypto_engine.decrypt_payload(raw_content, key)
        return decrypted, True

    def wrap_outbound_message(self, recipient_id: str, plaintext: str) -> Tuple[str, bool]:
        """
        If recipient is in the EncProxy target list, wrap with peer session key.
        Returns: (wrapped_content, was_wrapped)
        """
        if not self.is_peer_encrypted(recipient_id):
            return plaintext, False

        key = self.crypto_engine.peer_shared_secrets.get(recipient_id)
        if not key:
            return plaintext, False

        wrapped = self.crypto_engine.encrypt_payload(plaintext, key)
        return wrapped, True
