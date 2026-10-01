import re
import time
from typing import List, Dict, Any, Optional, Callable, Tuple
from dataclasses import dataclass, field


@dataclass
class HeaderRule:
    id: str
    name: str
    target_header: str
    action: str  # "replace", "add", "remove"
    value: str = ""
    url_pattern: str = ".*"
    enabled: bool = True

    def matches(self, url: str) -> bool:
        if not self.enabled:
            return False
        try:
            return bool(re.search(self.url_pattern, url))
        except Exception:
            return True


@dataclass
class PacketItem:
    id: str
    timestamp: float
    method: str
    url: str
    status_code: Optional[int] = None
    request_headers: Dict[str, str] = field(default_factory=dict)
    response_headers: Dict[str, str] = field(default_factory=dict)
    request_body: Optional[str] = None
    response_body: Optional[str] = None
    content_type: str = "text/plain"
    latency_ms: float = 0.0
    was_modified: bool = False
    is_encrypted: bool = False


class PacketEngine:
    """
    Packet capture, inspection, and manipulation engine.
    """

    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.packets: List[PacketItem] = []
        self.header_rules: List[HeaderRule] = []
        self.listeners: List[Callable[[PacketItem], None]] = []

        # Default rules
        self.load_default_rules()

    def load_default_rules(self):
        self.header_rules = [
            HeaderRule(
                id="rule_ua",
                name="Маскировка User-Agent",
                target_header="User-Agent",
                action="replace",
                value="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                url_pattern=".*",
                enabled=False,
            ),
            HeaderRule(
                id="rule_encproxy_tag",
                name="EncProxy Zero-Trust Заголовок",
                target_header="X-EncProxy-Protected",
                action="add",
                value="1",
                url_pattern=".*",
                enabled=True,
            ),
            HeaderRule(
                id="rule_strip_fingerprints",
                name="Удаление Client-Hints телеметрии",
                target_header="Sec-Ch-Ua-Platform",
                action="remove",
                value="",
                url_pattern=".*",
                enabled=False,
            ),
        ]

    def add_listener(self, callback: Callable[[PacketItem], None]):
        self.listeners.append(callback)

    def record_packet(self, packet: PacketItem):
        self.packets.append(packet)
        if len(self.packets) > self.max_history:
            self.packets.pop(0)

        for listener in self.listeners:
            try:
                listener(packet)
            except Exception:
                pass

    def apply_header_rules(self, url: str, headers: Dict[str, str]) -> Tuple[Dict[str, str], bool]:
        """
        Applies rules to incoming or outgoing headers dictionary.
        Returns modified headers and boolean flag if any change occurred.
        """
        modified = False
        new_headers = dict(headers)

        for rule in self.header_rules:
            if not rule.matches(url):
                continue

            header_lower = rule.target_header.lower()
            matching_key = next((k for k in new_headers if k.lower() == header_lower), None)

            if rule.action == "remove":
                if matching_key:
                    del new_headers[matching_key]
                    modified = True
            elif rule.action == "replace":
                if matching_key:
                    new_headers[matching_key] = rule.value
                    modified = True
                else:
                    new_headers[rule.target_header] = rule.value
                    modified = True
            elif rule.action == "add":
                if not matching_key:
                    new_headers[rule.target_header] = rule.value
                    modified = True

        return new_headers, modified
