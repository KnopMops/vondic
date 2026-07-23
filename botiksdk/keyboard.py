"""Reply keyboard support for BotikSDK."""
from typing import Any, Dict, List, Optional


class KeyboardButton:
    """A button for reply keyboard."""
    def __init__(self, text: str, request_location: bool = False,
                 request_contact: bool = False, request_poll: bool = False):
        self.text = text
        self.request_location = request_location
        self.request_contact = request_contact
        self.request_poll = request_poll

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"text": self.text}
        if self.request_location:
            d["request_location"] = True
        if self.request_contact:
            d["request_contact"] = True
        if self.request_poll:
            d["request_poll"] = True
        return d


class ReplyKeyboardBuilder:
    """Builder for reply keyboard markup."""
    def __init__(self, resize_keyboard: bool = True, one_time_keyboard: bool = False):
        self._rows: list[list[Dict[str, Any]]] = []
        self._current_row: list[Dict[str, Any]] = []
        self._resize = resize_keyboard
        self._one_time = one_time_keyboard

    def row(self, *buttons: KeyboardButton) -> "ReplyKeyboardBuilder":
        if self._current_row:
            self._rows.append(self._current_row)
            self._current_row = []
        for btn in buttons:
            self._current_row.append(btn.to_dict())
        return self

    def add(self, button: KeyboardButton) -> "ReplyKeyboardBuilder":
        self._current_row.append(button.to_dict())
        return self

    def as_markup(self) -> Dict[str, Any]:
        if self._current_row:
            self._rows.append(self._current_row)
            self._current_row = []
        return {
            "keyboard": self._rows,
            "resize_keyboard": self._resize,
            "one_time_keyboard": self._one_time,
            "is_keyboard": True,
        }


class ReplyKeyboardRemove:
    """Removes the reply keyboard."""
    def as_markup(self) -> Dict[str, Any]:
        return {"remove_keyboard": True, "is_keyboard": True}
