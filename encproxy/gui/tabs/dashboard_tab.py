from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QGroupBox, QGridLayout
)
from PyQt6.QtCore import pyqtSignal, Qt


class DashboardTab(QWidget):
    toggle_proxy_signal = pyqtSignal(bool, str, int, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.is_running = False
        self.total_packets = 0
        self.modified_packets = 0
        self.encrypted_packets = 0

        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Title & Status Banner
        status_box = QGroupBox("Состояние EncProxy Engine")
        status_layout = QHBoxLayout(status_box)

        self.status_indicator = QLabel("🔴 Остановлен")
        self.status_indicator.setStyleSheet("font-size: 16px; font-weight: bold; color: #f85149;")
        status_layout.addWidget(self.status_indicator)

        status_layout.addStretch()

        self.btn_toggle = QPushButton("Запустить прокси")
        self.btn_toggle.setObjectName("btn_success")
        self.btn_toggle.setFixedHeight(38)
        self.btn_toggle.clicked.connect(self.on_toggle_clicked)
        status_layout.addWidget(self.btn_toggle)

        layout.addWidget(status_box)

        # Network Settings Group
        net_box = QGroupBox("Сетевые настройки и маршрутизация")
        net_layout = QGridLayout(net_box)
        net_layout.setSpacing(12)

        net_layout.addWidget(QLabel("Слушающий адрес (Host):"), 0, 0)
        self.input_host = QLineEdit("127.0.0.1")
        net_layout.addWidget(self.input_host, 0, 1)

        net_layout.addWidget(QLabel("Слушающий порт (Port):"), 1, 0)
        self.input_port = QLineEdit("8888")
        net_layout.addWidget(self.input_port, 1, 1)

        net_layout.addWidget(QLabel("Целевой сервер Vondic:"), 2, 0)
        self.input_target = QLineEdit("https://vondic.ru")
        net_layout.addWidget(self.input_target, 2, 1)

        layout.addWidget(net_box)

        # Statistics Cards
        stats_box = QGroupBox("Метрики трафика в реальном времени")
        stats_layout = QGridLayout(stats_box)
        stats_layout.setSpacing(16)

        self.lbl_stat_total = self.create_stat_card("Перехвачено пакетов", "0", "#58a6ff")
        self.lbl_stat_modified = self.create_stat_card("Модифицировано (Header Rules)", "0", "#d29922")
        self.lbl_stat_encrypted = self.create_stat_card("Зашифровано / Unwrapped", "0", "#2ea043")

        stats_layout.addWidget(self.lbl_stat_total["card"], 0, 0)
        stats_layout.addWidget(self.lbl_stat_modified["card"], 0, 1)
        stats_layout.addWidget(self.lbl_stat_encrypted["card"], 0, 2)

        layout.addWidget(stats_box)
        layout.addStretch()

    def create_stat_card(self, title: str, initial_value: str, color: str) -> dict:
        card = QWidget()
        card.setStyleSheet(f"background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px;")
        l = QVBoxLayout(card)
        l.setContentsMargins(10, 10, 10, 10)
        l.setSpacing(4)

        lbl_val = QLabel(initial_value)
        lbl_val.setStyleSheet(f"font-size: 26px; font-weight: bold; color: {color};")
        lbl_val.setAlignment(Qt.AlignmentFlag.AlignCenter)

        lbl_title = QLabel(title)
        lbl_title.setStyleSheet("font-size: 11px; color: #8b949e;")
        lbl_title.setAlignment(Qt.AlignmentFlag.AlignCenter)

        l.addWidget(lbl_val)
        l.addWidget(lbl_title)
        return {"card": card, "val": lbl_val}

    def on_toggle_clicked(self):
        new_state = not self.is_running
        host = self.input_host.text().strip() or "127.0.0.1"
        try:
            port = int(self.input_port.text().strip())
        except ValueError:
            port = 8888
        target = self.input_target.text().strip() or "https://vondic.ru"

        self.toggle_proxy_signal.emit(new_state, host, port, target)

    def set_running_state(self, running: bool):
        self.is_running = running
        if running:
            self.status_indicator.setText("🟢 Работает (Слушает трафик)")
            self.status_indicator.setStyleSheet("font-size: 16px; font-weight: bold; color: #3fb950;")
            self.btn_toggle.setText("Остановить прокси")
            self.btn_toggle.setObjectName("btn_danger")
            self.input_host.setEnabled(False)
            self.input_port.setEnabled(False)
            self.input_target.setEnabled(False)
        else:
            self.status_indicator.setText("🔴 Остановлен")
            self.status_indicator.setStyleSheet("font-size: 16px; font-weight: bold; color: #f85149;")
            self.btn_toggle.setText("Запустить прокси")
            self.btn_toggle.setObjectName("btn_success")
            self.input_host.setEnabled(True)
            self.input_port.setEnabled(True)
            self.input_target.setEnabled(True)

        self.btn_toggle.style().unpolish(self.btn_toggle)
        self.btn_toggle.style().polish(self.btn_toggle)

    def update_stats(self, total: int, modified: int, encrypted: int):
        self.total_packets = total
        self.modified_packets = modified
        self.encrypted_packets = encrypted

        self.lbl_stat_total["val"].setText(str(total))
        self.lbl_stat_modified["val"].setText(str(modified))
        self.lbl_stat_encrypted["val"].setText(str(encrypted))
