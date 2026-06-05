"""Запуск команд в контейнере через Docker Engine API (unix socket), без docker CLI."""

from __future__ import annotations

import http.client
import json
import os
import socket
import time
from typing import Sequence

DEFAULT_SOCKET = "/var/run/docker.sock"


class DockerSocketConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: str = DEFAULT_SOCKET) -> None:
        super().__init__("localhost")
        self._socket_path = socket_path

    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self._socket_path)


def _request(
    method: str,
    path: str,
    body: dict | None = None,
    socket_path: str = DEFAULT_SOCKET,
) -> tuple[int, bytes]:
    conn = DockerSocketConnection(socket_path)
    payload = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if payload else {}
    conn.request(method, path, body=payload, headers=headers)
    resp = conn.getresponse()
    data = resp.read()
    conn.close()
    return resp.status, data


def container_exec(
    container: str,
    cmd: Sequence[str],
    socket_path: str = DEFAULT_SOCKET,
    timeout: float = 90.0,
) -> tuple[int, str]:
    """
    Выполняет команду в контейнере. Возвращает (exit_code, stderr+stdout текст ошибки).
    """
    if not os.path.exists(socket_path):
        return 127, f"Docker socket не найден: {socket_path}"

    status, raw = _request(
        "POST",
        f"/containers/{container}/exec",
        {
            "AttachStdout": True,
            "AttachStderr": True,
            "Cmd": list(cmd),
        },
        socket_path,
    )
    if status != 201:
        return 127, _parse_error(raw) or f"exec create HTTP {status}"

    try:
        exec_id = json.loads(raw.decode())["Id"]
    except (json.JSONDecodeError, KeyError) as e:
        return 127, f"exec create parse error: {e}"

    status, _ = _request(
        "POST",
        f"/exec/{exec_id}/start",
        {"Detach": True, "Tty": False},
        socket_path,
    )
    if status != 200 and status != 101:
        return 127, f"exec start HTTP {status}"

    deadline = time.time() + timeout
    exit_code = -1
    while time.time() < deadline:
        status, raw = _request(
            "GET", f"/exec/{exec_id}/json", socket_path=socket_path)
        if status != 200:
            time.sleep(0.3)
            continue
        info = json.loads(raw.decode())
        if not info.get("Running", True):
            exit_code = int(info.get("ExitCode", -1))
            break
        time.sleep(0.3)

    if exit_code < 0:
        return 124, "Таймаут ожидания exec"
    return exit_code, ""


def _parse_error(raw: bytes) -> str:
    try:
        data = json.loads(raw.decode())
        return str(data.get("message") or data)
    except Exception:
        return raw.decode(errors="replace")[:500]
