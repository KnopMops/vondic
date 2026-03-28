import threading
from typing import Callable, Optional

import requests

DEFAULT_API_URL = "https://untortuously-hummel-arnoldo.ngrok-free.dev/ask"

class RequestThread:

    def __init__(
        self,
        api_url: str,
        question: str,
        on_success: Optional[Callable[[str], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ):
        self.api_url = api_url
        self.question = question
        self.on_success = on_success
        self.on_error = on_error
        self.thread = None

    def run(self):
        try:
            response = requests.post(
                self.api_url, json={"question": self.question}, timeout=60
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    ans = data.get("answer", "")
                except Exception:
                    ans = response.text or ""

                result = ans or ""
                if self.on_success:
                    self.on_success(result)
                return result
            else:
                error_msg = f"Ошибка API: {response.status_code}"
                if self.on_error:
                    self.on_error(error_msg)
                return error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"Ошибка соединения с API:\n{e}"
            if self.on_error:
                self.on_error(error_msg)
            return error_msg

    def start(self) -> threading.Thread:
        self.thread = threading.Thread(target=self.run)
        self.thread.start()
        return self.thread

    def execute(self):
        return self.run()

def simple_request(api_url: str, question: str) -> str:
    try:
        response = requests.post(
            api_url, json={"question": question}, timeout=60)

        if response.status_code == 200:
            try:
                data = response.json()
                return data.get("answer", "")
            except Exception:
                return response.text or ""
        else:
            return f"Ошибка API: {response.status_code}"

    except requests.exceptions.RequestException as e:
        return f"Ошибка соединения с API:\n{e}"
