import asyncio
import threading
from typing import Optional

from PyQt6.QtWidgets import (
    QMainWindow, QTabWidget, QStatusBar, QMessageBox
)
from PyQt6.QtCore import pyqtSignal, QObject

from .style import DARK_THEME_QSS
from .tabs.dashboard_tab import DashboardTab
from .tabs.inspector_tab import InspectorTab
from .tabs.rules_tab import RulesTab
from .tabs.crypto_tab import CryptoTab
from .tabs.peers_tab import PeersTab

from ..core.crypto_engine import CryptoEngine
from ..core.packet_engine import PacketEngine, PacketItem
from ..core.unwrapped_module import UnwrappedModule
from ..core.proxy_server import EncProxyServer


class ProxySignalBridge(QObject):
    packet_received = pyqtSignal(object)
    stats_updated = pyqtSignal(int, int, int)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("EncProxy — Zero-Trust Traffic & Cryptography Engine")
        self.resize(1050, 720)

        # Core Engines
        self.crypto_engine = CryptoEngine()
        self.packet_engine = PacketEngine()
        self.unwrapped_module = UnwrappedModule(self.crypto_engine)
        self.proxy_server: Optional[EncProxyServer] = None

        self.proxy_thread: Optional[threading.Thread] = None
        self.proxy_loop: Optional[asyncio.AbstractEventLoop] = None

        # Statistics
        self.total_packets = 0
        self.modified_packets = 0
        self.encrypted_packets = 0

        # Signal bridge
        self.bridge = ProxySignalBridge()
        self.bridge.packet_received.connect(self.on_packet_intercepted)
        self.bridge.stats_updated.connect(self.on_stats_updated)

        self.packet_engine.add_listener(self.on_packet_engine_event)

        # Apply dark theme
        self.setStyleSheet(DARK_THEME_QSS)

        self.init_ui()

    def init_ui(self):
        self.tabs = QTabWidget()

        self.tab_dashboard = DashboardTab()
        self.tab_dashboard.toggle_proxy_signal.connect(self.on_toggle_proxy)
        self.tabs.addTab(self.tab_dashboard, "Панель управления")

        self.tab_inspector = InspectorTab()
        self.tabs.addTab(self.tab_inspector, "Инспектор трафика")

        self.tab_rules = RulesTab(self.packet_engine)
        self.tabs.addTab(self.tab_rules, "Правила подмены заголовков")

        self.tab_crypto = CryptoTab(self.crypto_engine)
        self.tabs.addTab(self.tab_crypto, "Криптография и ключи")

        self.tab_peers = PeersTab(self.unwrapped_module)
        self.tabs.addTab(self.tab_peers, "Защищенные собеседники (Unwrapped)")

        self.setCentralWidget(self.tabs)

        self.status_bar = QStatusBar()
        self.status_bar.showMessage("EncProxy готов к работе. Статус: Остановлен.")
        self.setStatusBar(self.status_bar)

    def on_packet_engine_event(self, packet: PacketItem):
        self.total_packets += 1
        if packet.was_modified:
            self.modified_packets += 1
        if packet.is_encrypted:
            self.encrypted_packets += 1

        self.bridge.packet_received.emit(packet)
        self.bridge.stats_updated.emit(self.total_packets, self.modified_packets, self.encrypted_packets)

    def on_packet_intercepted(self, packet: PacketItem):
        self.tab_inspector.add_packet(packet)

    def on_stats_updated(self, total: int, mod: int, enc: int):
        self.tab_dashboard.update_stats(total, mod, enc)

    def on_toggle_proxy(self, start: bool, host: str, port: int, target: str):
        if start:
            self.start_proxy(host, port, target)
        else:
            self.stop_proxy()

    def start_proxy(self, host: str, port: int, target: str):
        try:
            self.proxy_server = EncProxyServer(
                host=host,
                port=port,
                target_backend=target,
                crypto_engine=self.crypto_engine,
                packet_engine=self.packet_engine,
                unwrapped_module=self.unwrapped_module,
            )

            def run_server():
                self.proxy_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.proxy_loop)
                self.proxy_loop.run_until_complete(self.proxy_server.start())
                self.proxy_loop.run_forever()

            self.proxy_thread = threading.Thread(target=run_server, daemon=True)
            self.proxy_thread.start()

            self.tab_dashboard.set_running_state(True)
            self.status_bar.showMessage(f"EncProxy активен: http://{host}:{port} -> {target}")
        except Exception as e:
            QMessageBox.critical(self, "Ошибка запуска", f"Не удалось запустить прокси: {str(e)}")
            self.tab_dashboard.set_running_state(False)

    def stop_proxy(self):
        if self.proxy_server and self.proxy_loop:
            asyncio.run_coroutine_threadsafe(self.proxy_server.stop(), self.proxy_loop)
            self.proxy_loop.call_soon_threadsafe(self.proxy_loop.stop)

        self.tab_dashboard.set_running_state(False)
        self.status_bar.showMessage("EncProxy остановлен.")

    def closeEvent(self, event):
        self.stop_proxy()
        event.accept()
