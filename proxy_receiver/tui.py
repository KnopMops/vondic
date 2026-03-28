import asyncio
import re
import sys
import time

from .config import PROXY_RECEIVER_VERSION, ProxyConfig, ProxyStats

def format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"

def color(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m"

def strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)

def draw_box(lines: list[str], width: int) -> str:
    top = "┌" + "─" * (width - 2) + "┐"
    bottom = "└" + "─" * (width - 2) + "┘"
    body = []
    for line in lines:
        visible = strip_ansi(line)
        padding = width - 2 - len(visible)
        if padding < 0:
            trimmed = visible[: width - 4] + "…"
            line = trimmed
            padding = width - 2 - len(trimmed)
        body.append("│" + line + " " * padding + "│")
    return "\n".join([top] + body + [bottom])

def combine_panels(left: str, right: str, gap: int = 4) -> str:
    left_lines = left.splitlines()
    right_lines = right.splitlines()
    max_lines = max(len(left_lines), len(right_lines))
    while len(left_lines) < max_lines:
        left_lines.append(
            " " * len(strip_ansi(left_lines[0])) if left_lines else "")
    while len(right_lines) < max_lines:
        right_lines.append(
            " " * len(strip_ansi(right_lines[0])) if right_lines else "")
    rows = []
    for left, right in zip(left_lines, right_lines):
        rows.append(left + " " * gap + right)
    return "\n".join(rows)

async def tui_loop(config: ProxyConfig, stats: ProxyStats) -> None:
    last_time = time.time()
    last_in = 0
    last_out = 0
    while True:
        await asyncio.sleep(1)
        now = time.time()
        async with stats.lock:
            total = stats.total_connections
            active = stats.active_connections
            accepted = stats.accepted_connections
            rejected = stats.rejected_connections
            bytes_in = stats.bytes_in
            bytes_out = stats.bytes_out
        dt = max(0.001, now - last_time)
        rate_in = (bytes_in - last_in) / dt
        rate_out = (bytes_out - last_out) / dt
        last_time = now
        last_in = bytes_in
        last_out = bytes_out
        upstream = (
            f"{config.upstream_host}:{config.upstream_port}"
            if config.upstream_host and config.upstream_port
            else "none"
        )
        channel_peer = (
            f"{config.channel_peer_host}:{config.channel_peer_port}"
            if config.channel_peer_host and config.channel_peer_port
            else "none"
        )
        left_stats = [
            f"{color('mode', '1;34')}: {color(config.mode, '1;33')}",
            f"{color('listen', '1;34')}: {color(f'{config.listen_host}:{config.listen_port}', '0;37')}",
            f"{color('upstream', '1;34')}: {color(upstream, '0;37')}",
            f"{color('channel', '1;34')}: {color(channel_peer, '0;37')}",
            f"{color('standalone', '1;34')}: {color(config.standalone_mode, '1;36')}",
        ]
        right_stats = [
            f"{color('connections', '1;35')}: "
            f"{color(str(active), '1;32')} active / {color(str(total), '1;36')} total",
            f"{color('auth', '1;35')}: "
            f"{color(str(accepted), '1;32')} ok / {color(str(rejected), '1;31')} fail",
            f"{color('traffic in', '1;35')}: "
            f"{color(format_bytes(bytes_in), '1;32')} "
            f"({color(format_bytes(int(rate_in)) + '/s', '0;32')})",
            f"{color('traffic out', '1;35')}: "
            f"{color(format_bytes(bytes_out), '1;36')} "
            f"({color(format_bytes(int(rate_out)) + '/s', '0;36')})",
        ]
        left_panel = draw_box(left_stats, 40)
        right_panel = draw_box(right_stats, 40)
        dashboard = combine_panels(left_panel, right_panel)
        banner_text = f" Proxy Receiver v{PROXY_RECEIVER_VERSION} "
        banner = color(banner_text, "1;30;46")
        output = banner + "\n\n" + dashboard
        sys.stdout.write("\033[2J\033[H" + output + "\n")
        sys.stdout.flush()
