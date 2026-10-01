#!/usr/bin/env python3
"""
EncProxy — Standalone Zero-Trust Encryption Proxy & GUI Console for Vondic
"""

import argparse
import asyncio
import os
import sys

# Ensure parent directory is on sys.path for direct script execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from encproxy.core.crypto_engine import CryptoEngine
from encproxy.core.packet_engine import PacketEngine
from encproxy.core.unwrapped_module import UnwrappedModule
from encproxy.core.proxy_server import EncProxyServer


def run_gui():
    try:
        from PyQt6.QtWidgets import QApplication
        from encproxy.gui.main_window import MainWindow

        app = QApplication(sys.argv)
        app.setApplicationName("EncProxy")
        window = MainWindow()
        window.show()
        sys.exit(app.exec())
    except ImportError as e:
        print("[!] Ошибка: PyQt6 не установлен. Установите зависимости: pip install -r encproxy/requirements.txt")
        print(f"    Детали: {e}")
        print("[*] Запуск в консольном (headless) режиме на 127.0.0.1:8888...")
        run_headless("127.0.0.1", 8888, "https://vondic.ru")


def run_headless(host: str, port: int, target: str):
    crypto_engine = CryptoEngine()
    packet_engine = PacketEngine()
    unwrapped_module = UnwrappedModule(crypto_engine)

    server = EncProxyServer(
        host=host,
        port=port,
        target_backend=target,
        crypto_engine=crypto_engine,
        packet_engine=packet_engine,
        unwrapped_module=unwrapped_module,
    )

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    print(f"[+] EncProxy Headless Server запущен на http://{host}:{port} -> {target}", flush=True)
    keys = crypto_engine.get_public_keys()
    print(f"[*] Публичный ключ подписи Ed25519: {keys['signing_public_key']}", flush=True)
    print(f"[*] Публичный ключ обмена X25519:   {keys['dh_public_key']}", flush=True)
    print(f"[*] Отпечаток (Fingerprint):        {keys['fingerprint']}", flush=True)
    print("[*] Нажмите Ctrl+C для остановки...", flush=True)

    try:
        loop.run_until_complete(server.start())
        loop.run_forever()
    except KeyboardInterrupt:
        print("\n[!] Остановка сервера...")
        loop.run_until_complete(server.stop())


def main():
    parser = argparse.ArgumentParser(description="EncProxy — Zero-Trust Proxy & Traffic Engine for Vondic")
    parser.add_argument("--headless", action="store_true", help="Запуск в фоновом/консольном режиме без графического интерфейса")
    parser.add_argument("--host", default="127.0.0.1", help="Слушающий адрес (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8888, help="Слушающий порт (default: 8888)")
    parser.add_argument("--target", default="https://vondic.ru", help="Целевой сервер Vondic (default: https://vondic.ru)")

    args = parser.parse_args()

    if args.headless:
        run_headless(args.host, args.port, args.target)
    else:
        run_gui()


if __name__ == "__main__":
    main()
