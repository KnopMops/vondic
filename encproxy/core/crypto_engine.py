import base64
import hashlib
import json
import os
import time
from typing import Dict, Any, Optional, Tuple

from cryptography.hazmat.primitives.asymmetric import ed25519, x25519
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305, AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import serialization


class CryptoEngine:
    """
    Cryptographic engine for EncProxy:
    - Ed25519 for metadata signing and blind authentication to Vondic server.
    - X25519 for peer Diffie-Hellman key exchange.
    - ChaCha20-Poly1305 and AES-256-GCM for packet payload encryption.
    """

    def __init__(self, key_dir: Optional[str] = None):
        self.key_dir = key_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "keys")
        os.makedirs(self.key_dir, exist_ok=True)

        self.cipher_mode = "ChaCha20-Poly1305"  # or "AES-256-GCM"
        self.ed25519_priv: Optional[ed25519.Ed25519PrivateKey] = None
        self.x25519_priv: Optional[x25519.X25519PrivateKey] = None
        self.peer_shared_secrets: Dict[str, bytes] = {}

        self.load_or_generate_keys()

    def load_or_generate_keys(self):
        ed_path = os.path.join(self.key_dir, "ed25519.key")
        x_path = os.path.join(self.key_dir, "x25519.key")

        if os.path.exists(ed_path):
            with open(ed_path, "rb") as f:
                self.ed25519_priv = serialization.load_pem_private_key(f.read(), password=None)
        else:
            self.ed25519_priv = ed25519.Ed25519PrivateKey.generate()
            with open(ed_path, "wb") as f:
                f.write(self.ed25519_priv.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                ))

        if os.path.exists(x_path):
            with open(x_path, "rb") as f:
                self.x25519_priv = serialization.load_pem_private_key(f.read(), password=None)
        else:
            self.x25519_priv = x25519.X25519PrivateKey.generate()
            with open(x_path, "wb") as f:
                f.write(self.x25519_priv.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                ))

    def get_public_keys(self) -> Dict[str, str]:
        """Returns base64-encoded public keys."""
        ed_pub_bytes = self.ed25519_priv.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        x_pub_bytes = self.x25519_priv.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return {
            "signing_public_key": base64.b64encode(ed_pub_bytes).decode("ascii"),
            "dh_public_key": base64.b64encode(x_pub_bytes).decode("ascii"),
            "fingerprint": hashlib.sha256(ed_pub_bytes).hexdigest()[:16],
        }

    def sign_metadata(self, metadata: Dict[str, Any]) -> str:
        """
        Sign message metadata for server verification without revealing text.
        Server verifies signature over canonical JSON string of metadata.
        """
        canon_bytes = json.dumps(metadata, sort_keys=True, separators=(",", ":")).encode("utf-8")
        signature = self.ed25519_priv.sign(canon_bytes)
        return base64.b64encode(signature).decode("ascii")

    def derive_shared_secret(self, peer_user_id: str, peer_dh_pub_base64: str) -> bytes:
        """
        Compute Diffie-Hellman shared key from peer's X25519 public key.
        """
        peer_bytes = base64.b64decode(peer_dh_pub_base64)
        peer_pub = x25519.X25519PublicKey.from_public_bytes(peer_bytes)
        shared_raw = self.x25519_priv.exchange(peer_pub)

        # Derive 32-byte symmetric key using HKDF-SHA256
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"vondic-encproxy-v1",
            info=peer_user_id.encode("utf-8"),
        )
        derived_key = hkdf.derive(shared_raw)
        self.peer_shared_secrets[peer_user_id] = derived_key
        return derived_key

    def encrypt_payload(self, plaintext: str, key: bytes) -> str:
        """
        Encrypt plaintext string using selected cipher mode (ChaCha20 or AES-GCM).
        Returns base64 encoded payload: nonce (12B) + ciphertext + tag.
        """
        data = plaintext.encode("utf-8")
        nonce = os.urandom(12)

        if self.cipher_mode == "AES-256-GCM":
            aesgcm = AESGCM(key)
            ct = aesgcm.encrypt(nonce, data, None)
        else:
            chacha = ChaCha20Poly1305(key)
            ct = chacha.encrypt(nonce, data, None)

        blob = nonce + ct
        return "encproxy:" + base64.b64encode(blob).decode("ascii")

    def decrypt_payload(self, payload: str, key: bytes) -> str:
        """
        Decrypt payload string using symmetric key.
        """
        if not payload.startswith("encproxy:"):
            return payload

        raw_b64 = payload[len("encproxy:"):]
        blob = base64.b64decode(raw_b64)
        nonce = blob[:12]
        ct = blob[12:]

        try:
            if self.cipher_mode == "AES-256-GCM":
                aesgcm = AESGCM(key)
                pt = aesgcm.decrypt(nonce, ct, None)
            else:
                chacha = ChaCha20Poly1305(key)
                pt = chacha.decrypt(nonce, ct, None)
            return pt.decode("utf-8")
        except Exception as e:
            return f"[EncProxy Decryption Failed: {str(e)}]"
