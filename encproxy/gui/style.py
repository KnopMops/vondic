"""
Dark Theme Stylesheet for EncProxy PyQt6 Interface
"""

DARK_THEME_QSS = """
QMainWindow, QDialog {
    background-color: #0d1117;
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
}

QWidget {
    background-color: transparent;
    color: #e6edf3;
}

QTabWidget::pane {
    border: 1px solid #30363d;
    background-color: #161b22;
    border-radius: 12px;
    top: -1px;
}

QTabBar::tab {
    background-color: #0d1117;
    color: #8b949e;
    padding: 10px 20px;
    margin-right: 4px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    font-weight: 600;
    font-size: 12px;
}

QTabBar::tab:selected {
    background-color: #161b22;
    color: #58a6ff;
    border-bottom: 2px solid #58a6ff;
}

QTabBar::tab:hover:!selected {
    color: #c9d1d9;
    background-color: #1f242c;
}

QGroupBox {
    border: 1px solid #30363d;
    border-radius: 10px;
    margin-top: 18px;
    padding: 16px;
    font-weight: bold;
    color: #58a6ff;
    background-color: #161b22;
}

QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 14px;
    padding: 0 6px;
}

QPushButton {
    background-color: #21262d;
    border: 1px solid #30363d;
    color: #c9d1d9;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 600;
}

QPushButton:hover {
    background-color: #30363d;
    color: #ffffff;
    border-color: #8b949e;
}

QPushButton:pressed {
    background-color: #161b22;
}

QPushButton#btn_primary {
    background-color: #1f6feb;
    border: 1px solid #388bfd;
    color: #ffffff;
}

QPushButton#btn_primary:hover {
    background-color: #388bfd;
}

QPushButton#btn_danger {
    background-color: #da3633;
    border: 1px solid #f85149;
    color: #ffffff;
}

QPushButton#btn_danger:hover {
    background-color: #f85149;
}

QPushButton#btn_success {
    background-color: #238636;
    border: 1px solid #2ea043;
    color: #ffffff;
}

QPushButton#btn_success:hover {
    background-color: #2ea043;
}

QLineEdit, QTextEdit, QPlainTextEdit, QSpinBox, QComboBox {
    background-color: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 8px 12px;
    color: #e6edf3;
    selection-background-color: #1f6feb;
}

QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus, QComboBox:focus {
    border: 1px solid #58a6ff;
}

QTableWidget {
    background-color: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    gridline-color: #21262d;
    selection-background-color: #1f6feb;
    selection-color: #ffffff;
}

QHeaderView::section {
    background-color: #161b22;
    color: #8b949e;
    padding: 8px;
    border: none;
    border-bottom: 1px solid #30363d;
    font-weight: 600;
    font-size: 11px;
}

QScrollBar:vertical {
    border: none;
    background: #0d1117;
    width: 10px;
    border-radius: 5px;
}

QScrollBar::handle:vertical {
    background: #30363d;
    border-radius: 5px;
    min-height: 20px;
}

QScrollBar::handle:vertical:hover {
    background: #58a6ff;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}

QLabel {
    color: #e6edf3;
}

QStatusBar {
    background-color: #161b22;
    border-top: 1px solid #30363d;
    color: #8b949e;
    font-size: 11px;
}
"""
