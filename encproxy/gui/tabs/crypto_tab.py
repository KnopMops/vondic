from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QGroupBox, QComboBox, QMessageBox, QApplication
)
from ...core.crypto_engine import CryptoEngine


class CryptoTab(QWidget):
    def __init__(self, crypto_engine: CryptoEngine, parent=None):
        super().__init__(parent)
        self.crypto_engine = crypto_engine
        self.init_ui()
        self.refresh_keys()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Cipher Selection Group
        cipher_box = QGroupBox("Метод шифрования пакетов (Symmetric Cipher)")
        cipher_layout = QHBoxLayout(cipher_box)

        cipher_layout.addWidget(QLabel("Алгоритм симметричного шифрования:"))
        self.combo_cipher = QComboBox()
        self.combo_cipher.addItems(["ChaCha20-Poly1305", "AES-256-GCM"])
        self.combo_cipher.currentTextChanged.connect(self.on_cipher_changed)
        cipher_layout.addWidget(self.combo_cipher)
        cipher_layout.addStretch()

        layout.addWidget(cipher_box)

        # Blind Auth / Ed25519 Keys Group
        auth_box = QGroupBox("Ключ подписи слепой авторизации (Ed25519)")
        auth_layout = QVBoxLayout(auth_box)

        lbl_desc = QLabel(
            "Этот публичный ключ используется сервером Vondic для верификации отправителя.\n"
            "Сервер проверяет подпись метаданных, но не может прочесть содержимое сообщения."
        )
        lbl_desc.setStyleSheet("color: #8b949e; font-size: 11px;")
        auth_layout.addWidget(lbl_desc)

        row_ed = QHBoxLayout()
        self.in_ed_pub = QLineEdit()
        self.in_ed_pub.setReadOnly(True)
        row_ed.addWidget(self.in_ed_pub)

        btn_copy_ed = QPushButton("Копировать")
        btn_copy_ed.clicked.connect(lambda: self.copy_to_clipboard(self.in_ed_pub.text()))
        row_ed.addWidget(btn_copy_ed)
        auth_layout.addLayout(row_ed)

        self.lbl_fingerprint = QLabel("Отпечаток ключа (Fingerprint): —")
        self.lbl_fingerprint.setStyleSheet("color: #58a6ff; font-family: monospace; font-size: 12px;")
        auth_layout.addWidget(self.lbl_fingerprint)

        layout.addWidget(auth_box)

        # Diffie-Hellman / X25519 Group
        dh_box = QGroupBox("Ключ обмена секретами (X25519 DH)")
        dh_layout = QVBoxLayout(dh_box)

        lbl_dh_desc = QLabel(
            "Передайте этот открытый ключ собеседникам для сквозного шифрования (EncProxy to Unwrapped)."
        )
        lbl_dh_desc.setStyleSheet("color: #8b949e; font-size: 11px;")
        dh_layout.addWidget(lbl_dh_desc)

        row_x = QHBoxLayout()
        self.in_x_pub = QLineEdit()
        self.in_x_pub.setReadOnly(True)
        row_x.addWidget(self.in_x_pub)

        btn_copy_x = QPushButton("Копировать")
        btn_copy_x.clicked.connect(lambda: self.copy_to_clipboard(self.in_x_pub.text()))
        row_x.addWidget(btn_copy_x)
        dh_layout.addLayout(row_x)

        layout.addWidget(dh_box)

        # Actions
        btn_regen = QPushButton("Перегенерировать ключевую пару")
        btn_regen.setObjectName("btn_danger")
        btn_regen.clicked.connect(self.regenerate_keys)
        layout.addWidget(btn_regen)

        layout.addStretch()

    def refresh_keys(self):
        keys = self.crypto_engine.get_public_keys()
        self.in_ed_pub.setText(keys["signing_public_key"])
        self.in_x_pub.setText(keys["dh_public_key"])
        self.lbl_fingerprint.setText(f"Отпечаток ключа (Fingerprint): {keys['fingerprint']}")
        self.combo_cipher.setCurrentText(self.crypto_engine.cipher_mode)

    def on_cipher_changed(self, text: str):
        self.crypto_engine.cipher_mode = text

    def copy_to_clipboard(self, text: str):
        if text:
            QApplication.clipboard().setText(text)

    def regenerate_keys(self):
        confirm = QMessageBox.question(
            self,
            "Подтверждение",
            "Вы уверены, что хотите перегенерировать криптографические ключи?\n"
            "Все предыдущие сессии с пирами потребуют повторного обмена ключами.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if confirm == QMessageBox.StandardButton.Yes:
            import os
            ed_path = os.path.join(self.crypto_engine.key_dir, "ed25519.key")
            x_path = os.path.join(self.crypto_engine.key_dir, "x25519.key")
            if os.path.exists(ed_path):
                os.remove(ed_path)
            if os.path.exists(x_path):
                os.remove(x_path)
            self.crypto_engine.load_or_generate_keys()
            self.refresh_keys()
            QMessageBox.information(self, "Успех", "Новые ключи сгенерированы и сохранены.")
