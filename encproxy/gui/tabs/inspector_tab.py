import json
import time
from typing import Optional

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QTableWidget, QTableWidgetItem, QSplitter,
    QTabWidget, QTextEdit, QHeaderView
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor

from ...core.packet_engine import PacketItem


class InspectorTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.packets_map = {}
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Filter bar
        top_bar = QHBoxLayout()
        self.input_filter = QLineEdit()
        self.input_filter.setPlaceholderText("Фильтр по URL или методу (например: /api/v1/messages)...")
        self.input_filter.textChanged.connect(self.filter_table)
        top_bar.addWidget(self.input_filter)

        self.btn_clear = QPushButton("Очистить журнал")
        self.btn_clear.clicked.connect(self.clear_table)
        top_bar.addWidget(self.btn_clear)

        layout.addLayout(top_bar)

        # Splitter: Table above, Inspector below
        splitter = QSplitter(Qt.Orientation.Vertical)

        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(8)
        self.table.setHorizontalHeaderLabels([
            "ID", "Время", "Метод", "Статус", "Латентность", "Защита", "Правка", "URL"
        ])
        self.table.horizontalHeader().setSectionResizeMode(7, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.itemSelectionChanged.connect(self.on_row_selected)
        splitter.addWidget(self.table)

        # Detail Viewer Tabs
        self.detail_tabs = QTabWidget()

        self.txt_req_headers = QTextEdit()
        self.txt_req_headers.setReadOnly(True)
        self.detail_tabs.addTab(self.txt_req_headers, "Request Headers")

        self.txt_req_body = QTextEdit()
        self.txt_req_body.setReadOnly(True)
        self.detail_tabs.addTab(self.txt_req_body, "Request Body")

        self.txt_resp_headers = QTextEdit()
        self.txt_resp_headers.setReadOnly(True)
        self.detail_tabs.addTab(self.txt_resp_headers, "Response Headers")

        self.txt_resp_body = QTextEdit()
        self.txt_resp_body.setReadOnly(True)
        self.detail_tabs.addTab(self.txt_resp_body, "Response Body")

        splitter.addWidget(self.detail_tabs)
        splitter.setSizes([350, 250])

        layout.addWidget(splitter)

    def add_packet(self, packet: PacketItem):
        self.packets_map[packet.id] = packet

        filter_text = self.input_filter.text().lower()
        if filter_text and filter_text not in packet.url.lower() and filter_text not in packet.method.lower():
            return

        row = self.table.rowCount()
        self.table.insertRow(row)

        time_str = time.strftime("%H:%M:%S", time.localtime(packet.timestamp))

        # Status item with color
        status_item = QTableWidgetItem(str(packet.status_code or "—"))
        if packet.status_code:
            if packet.status_code < 300:
                status_item.setForeground(QColor("#3fb950"))
            elif packet.status_code < 400:
                status_item.setForeground(QColor("#58a6ff"))
            elif packet.status_code < 500:
                status_item.setForeground(QColor("#d29922"))
            else:
                status_item.setForeground(QColor("#f85149"))

        enc_item = QTableWidgetItem("🔒 Да" if packet.is_encrypted else "—")
        if packet.is_encrypted:
            enc_item.setForeground(QColor("#2ea043"))

        mod_item = QTableWidgetItem("✏️ Да" if packet.was_modified else "—")
        if packet.was_modified:
            mod_item.setForeground(QColor("#d29922"))

        self.table.setItem(row, 0, QTableWidgetItem(packet.id))
        self.table.setItem(row, 1, QTableWidgetItem(time_str))
        self.table.setItem(row, 2, QTableWidgetItem(packet.method))
        self.table.setItem(row, 3, status_item)
        self.table.setItem(row, 4, QTableWidgetItem(f"{packet.latency_ms} ms"))
        self.table.setItem(row, 5, enc_item)
        self.table.setItem(row, 6, mod_item)
        self.table.setItem(row, 7, QTableWidgetItem(packet.url))

        # Keep max 500 rows in table
        if self.table.rowCount() > 500:
            self.table.removeRow(0)

    def on_row_selected(self):
        selected = self.table.selectedItems()
        if not selected:
            return
        row = selected[0].row()
        pkt_id = self.table.item(row, 0).text()
        packet = self.packets_map.get(pkt_id)
        if not packet:
            return

        # Render request headers
        req_hdr_lines = [f"{k}: {v}" for k, v in packet.request_headers.items()]
        self.txt_req_headers.setText("\n".join(req_hdr_lines))

        # Render request body (format JSON if applicable)
        self.txt_req_body.setText(self.format_body(packet.request_body))

        # Render response headers
        resp_hdr_lines = [f"{k}: {v}" for k, v in packet.response_headers.items()]
        self.txt_resp_headers.setText("\n".join(resp_hdr_lines))

        # Render response body
        self.txt_resp_body.setText(self.format_body(packet.response_body))

    def format_body(self, body: Optional[str]) -> str:
        if not body:
            return "[Empty Body]"
        try:
            parsed = json.loads(body)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except Exception:
            return body

    def clear_table(self):
        self.table.setRowCount(0)
        self.packets_map.clear()
        self.txt_req_headers.clear()
        self.txt_req_body.clear()
        self.txt_resp_headers.clear()
        self.txt_resp_body.clear()

    def filter_table(self):
        filter_text = self.input_filter.text().lower()
        for row in range(self.table.rowCount()):
            url_item = self.table.item(row, 7)
            method_item = self.table.item(row, 2)
            url_text = url_item.text().lower() if url_item else ""
            method_text = method_item.text().lower() if method_item else ""

            match = (not filter_text) or (filter_text in url_text) or (filter_text in method_text)
            self.table.setRowHidden(row, not match)
