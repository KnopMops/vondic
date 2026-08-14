from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import httpx

from app.core.deps import get_current_user
from app.core.config import settings

ai_router = APIRouter(prefix="/api/v1/ai", tags=["AI"])


class AutoCorrectRequest(BaseModel):
    text: str


class AutoCorrectResponse(BaseModel):
    corrected: str
    original: str


@ai_router.post("/autocorrect", response_model=AutoCorrectResponse)
async def autocorrect_text(
    payload: AutoCorrectRequest,
    current_user=Depends(get_current_user)
):
    # 1. Enforce Premium-only access
    is_premium = bool(getattr(current_user, "premium", False))
    expired_at = getattr(current_user, "premium_expired_at", None)
    if expired_at and expired_at < datetime.utcnow():
        is_premium = False

    if not is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ИИ-автоисправление доступно только для пользователей с подпиской Premium"
        )

    raw_text = (payload.text or "").strip()
    if not raw_text:
        return AutoCorrectResponse(corrected="", original="")

    # 2. Call NVIDIA NIM API
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    system_prompt = (
        "Ты — профессиональный редактор и корректор русского языка. "
        "Твоя единственная задача — исправить орфографические, грамматические, пунктуационные и стилистические ошибки в тексте пользователя, "
        "сохранив его первоначальный смысл, структуру и эмодзи. "
        "Верни ИСКЛЮЧИТЕЛЬНО исправленный текст. Не добавляй никаких кавычек вокруг текста, комментариев, приветствий или пояснений."
    )

    request_body = {
        "model": settings.NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": raw_text},
        ],
        "temperature": 0.2,
        "top_p": 1,
        "max_tokens": 4096,
        "seed": 42,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.NVIDIA_BASE_URL}/chat/completions",
                headers=headers,
                json=request_body,
            )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Ошибка ИИ-сервиса (статус {resp.status_code})"
            )

        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="ИИ-сервис вернул пустой ответ"
            )

        corrected = choices[0].get("message", {}).get("content", "").strip()
        if (corrected.startswith('"') and corrected.endswith('"')) or (corrected.startswith('«') and corrected.endswith('»')):
            corrected = corrected[1:-1].strip()

        return AutoCorrectResponse(corrected=corrected, original=raw_text)

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Время ожидания ответа ИИ истекло"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки ИИ: {str(e)}"
        )
