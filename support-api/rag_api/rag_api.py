from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class AskPayload(BaseModel):
    question: str


@app.post("/ask")
def ask(payload: AskPayload):
    q = (payload.question or "").strip()
    if not q:
        return {"answer": ""}
    if "yandex" in q.lower():
        return {"answer": "Для входа через Yandex нажмите кнопку «Войти через Yandex». После авторизации вас перенаправит в ленту."}
    if "2fa" in q.lower() or "код" in q.lower():
        return {"answer": "Если включена 2FA, отправьте код на почту и введите шестизначный код на странице входа."}
    if "telegram" in q.lower() or "телеграм" in q.lower():
        return {"answer": "Откройте «Настройки» и выберите привязку Telegram. Получите шестизначный ключ и введите его там, где будет предложено — после этого аккаунты будут связаны."}
    return {"answer": f"Вы спросили: {q}"}
