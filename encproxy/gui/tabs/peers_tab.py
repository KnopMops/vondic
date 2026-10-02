from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QTableWidget, QTableWidgetItem, QGroupBox,
    QHeaderView, QMessageBox
)
from PyQt6.QtGui import QColor

from ...core.unwrapped_module import UnwrappedModule


class PeersTab(QWidget):
    def __init__(self, unwrapped_module: UnwrappedModule, parent=None):
        super().__init__(parent)
        self.unwrapped_module = unwrapped_module
        self.unwrapped_module.approval_listeners.append(lambda _: self.load_peers_to_table())
        self.init_ui()
        self.load_peers_to_table()


    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Configured Peers Box
        peers_box = QGroupBox("Собеседники для шифрования (EncProxy to Unwrapped)")
        peers_layout = QVBoxLayout(peers_box)

        lbl_info = QLabel(
            "Сообщения, адресованные этим пользователям, автоматически шифруются перед отправкой на сервер.\n"
            "Входящие зашифрованные сообщения от них расшифровываются (Unwrapped) на лету."
        )
        lbl_info.setStyleSheet("color: #8b949e; font-size: 11px;")
        peers_layout.addWidget(lbl_info)

        self.table_peers = QTableWidget()
        self.table_peers.setColumnCount(4)
        self.table_peers.setHorizontalHeaderLabels(["User ID", "Имя / Ник", "Статус", "Публичный DH ключ"])
        self.table_peers.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.table_peers.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        peers_layout.addWidget(self.table_peers)

        btn_row = QHBoxLayout()
        self.btn_del = QPushButton("Удалить пользователя из защищенных")
        self.btn_del.setObjectName("btn_danger")
        self.btn_del.clicked.connect(self.delete_selected_peer)
        btn_row.addWidget(self.btn_del)
        btn_row.addStretch()

        peers_layout.addLayout(btn_row)
        layout.addWidget(peers_box)

        # Add Peer Form
        add_box = QGroupBox("Добавить собеседника в список EncProxy")
        add_layout = QVBoxLayout(add_box)

        r1 = QHBoxLayout()
        self.in_uid = QLineEdit()
        self.in_uid.setPlaceholderText("ID пользователя (UUID)")
        r1.addWidget(QLabel("User ID:"))
        r1.addWidget(self.in_uid)

        self.in_name = QLineEdit()
        self.in_name.setPlaceholderText("Имя или @username (для удобства)")
        r1.addWidget(QLabel("Имя:"))
        r1.addWidget(self.in_name)
        add_layout.addLayout(r1)

        r2 = QHBoxLayout()
        self.in_dh_key = QLineEdit()
        self.in_dh_key.setPlaceholderText("X25519 Public Key собеседника (Base64)")
        r2.addWidget(QLabel("DH Ключ:"))
        r2.addWidget(self.in_dh_key)

        self.btn_add = QPushButton("Добавить пользователя")
        self.btn_add.setObjectName("btn_primary")
        self.btn_add.clicked.connect(self.add_peer)
        r2.addWidget(self.btn_add)
        add_layout.addLayout(r2)

        layout.addWidget(add_box)

        # Pending Approvals Group
        appr_box = QGroupBox("Запросы одобрения сессий (Pending Handshakes)")
        appr_layout = QVBoxLayout(appr_box)

        self.table_appr = QTableWidget()
        self.table_appr.setColumnCount(3)
        self.table_appr.setHorizontalHeaderLabels(["User ID", "Имя", "Действие"])
        self.table_appr.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.table_appr.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        appr_layout.addWidget(self.table_appr)

        layout.addWidget(appr_box)

    def load_peers_to_table(self):
        self.table_peers.setRowCount(0)
        for uid, target in self.unwrapped_module.targets.items():
            row = self.table_peers.rowCount()
            self.table_peers.insertRow(row)

            self.table_peers.setItem(row, 0, QTableWidgetItem(target.user_id))
            self.table_peers.setItem(row, 1, QTableWidgetItem(target.username))

            status_item = QTableWidgetItem("Активен" if target.status == "active" else "Ожидание")
            status_item.setForeground(QColor("#3fb950" if target.status == "active" else "#d29922"))
            self.table_peers.setItem(row, 2, status_item)

            self.table_peers.setItem(row, 3, QTableWidgetItem(target.dh_public_key or "—"))

    def add_peer(self):
        uid = self.in_uid.text().strip()
        name = self.in_name.text().strip()
        key = self.in_dh_key.text().strip() or None
        if not uid:
            QMessageBox.warning(self, "Ошибка", "Укажите User ID собеседника")
            return

        self.unwrapped_module.add_target_peer(uid, name, key)
        self.load_peers_to_table()

        self.in_uid.clear()
        self.in_name.clear()
        self.in_dh_key.clear()
        QMessageBox.information(self, "Успех", f"Пользователь {name or uid} добавлен в защищенный список EncProxy!")

    def delete_selected_peer(self):
        selected = self.table_peers.selectedItems()
        if not selected:
            return
        row = selected[0].row()
        uid = self.table_peers.item(row, 0).text()
        self.unwrapped_module.remove_target_peer(uid)
        self.load_peers_to_table()
