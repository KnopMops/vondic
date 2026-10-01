import uuid
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QTableWidget, QTableWidgetItem, QComboBox,
    QGroupBox, QHeaderView, QCheckBox
)
from PyQt6.QtCore import Qt

from ...core.packet_engine import HeaderRule, PacketEngine


class RulesTab(QWidget):
    def __init__(self, packet_engine: PacketEngine, parent=None):
        super().__init__(parent)
        self.packet_engine = packet_engine
        self.init_ui()
        self.load_rules_to_table()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Rules List Group
        list_box = QGroupBox("Правила модификации и подмены HTTP заголовков")
        list_layout = QVBoxLayout(list_box)

        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels([
            "Вкл", "Название", "Заголовок", "Действие", "Значение", "URL Фильтр"
        ])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        list_layout.addWidget(self.table)

        btn_row = QHBoxLayout()
        self.btn_del = QPushButton("Удалить выбранное правило")
        self.btn_del.setObjectName("btn_danger")
        self.btn_del.clicked.connect(self.delete_selected_rule)
        btn_row.addWidget(self.btn_del)
        btn_row.addStretch()

        list_layout.addLayout(btn_row)
        layout.addWidget(list_box)

        # Add Rule Form
        add_box = QGroupBox("Добавить новое правило подмены")
        add_layout = QVBoxLayout(add_box)

        row1 = QHBoxLayout()
        self.in_name = QLineEdit()
        self.in_name.setPlaceholderText("Название (например: Скрыть IP)")
        row1.addWidget(QLabel("Название:"))
        row1.addWidget(self.in_name)

        self.in_header = QLineEdit()
        self.in_header.setPlaceholderText("Имя заголовка (например: X-Forwarded-For)")
        row1.addWidget(QLabel("Заголовок:"))
        row1.addWidget(self.in_header)

        self.combo_action = QComboBox()
        self.combo_action.addItems(["replace", "add", "remove"])
        row1.addWidget(QLabel("Действие:"))
        row1.addWidget(self.combo_action)
        add_layout.addLayout(row1)

        row2 = QHBoxLayout()
        self.in_value = QLineEdit()
        self.in_value.setPlaceholderText("Значение заголовка (для replace / add)")
        row2.addWidget(QLabel("Значение:"))
        row2.addWidget(self.in_value)

        self.in_pattern = QLineEdit(".*")
        row2.addWidget(QLabel("URL Regex:"))
        row2.addWidget(self.in_pattern)

        self.btn_add = QPushButton("Добавить правило")
        self.btn_add.setObjectName("btn_primary")
        self.btn_add.clicked.connect(self.add_rule)
        row2.addWidget(self.btn_add)
        add_layout.addLayout(row2)

        layout.addWidget(add_box)

    def load_rules_to_table(self):
        self.table.setRowCount(0)
        for rule in self.packet_engine.header_rules:
            row = self.table.rowCount()
            self.table.insertRow(row)

            chk = QCheckBox()
            chk.setChecked(rule.enabled)
            chk.stateChanged.connect(lambda state, r=rule: self.toggle_rule(r, state))
            cell_widget = QWidget()
            ch_layout = QHBoxLayout(cell_widget)
            ch_layout.addWidget(chk)
            ch_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
            ch_layout.setContentsMargins(0, 0, 0, 0)
            self.table.setCellWidget(row, 0, cell_widget)

            self.table.setItem(row, 1, QTableWidgetItem(rule.name))
            self.table.setItem(row, 2, QTableWidgetItem(rule.target_header))
            self.table.setItem(row, 3, QTableWidgetItem(rule.action))
            self.table.setItem(row, 4, QTableWidgetItem(rule.value))
            self.table.setItem(row, 5, QTableWidgetItem(rule.url_pattern))

    def toggle_rule(self, rule: HeaderRule, state: int):
        rule.enabled = (state == 2)

    def add_rule(self):
        name = self.in_name.text().strip() or "Новое правило"
        hdr = self.in_header.text().strip()
        if not hdr:
            return
        action = self.combo_action.currentText()
        val = self.in_value.text().strip()
        pattern = self.in_pattern.text().strip() or ".*"

        new_rule = HeaderRule(
            id=uuid.uuid4().hex[:8],
            name=name,
            target_header=hdr,
            action=action,
            value=val,
            url_pattern=pattern,
            enabled=True,
        )
        self.packet_engine.header_rules.append(new_rule)
        self.load_rules_to_table()

        self.in_name.clear()
        self.in_header.clear()
        self.in_value.clear()

    def delete_selected_rule(self):
        selected = self.table.selectedItems()
        if not selected:
            return
        row = selected[0].row()
        if 0 <= row < len(self.packet_engine.header_rules):
            self.packet_engine.header_rules.pop(row)
            self.load_rules_to_table()
