from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import pytz
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_async_db
from app.core.deps import get_current_user
from app.models.user import User

payments_router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])

if getattr(settings, "STRIPE_SECRET_KEY", None):
    stripe.api_key = settings.STRIPE_SECRET_KEY


class CheckoutSessionSchema(BaseModel):
    user_id: Optional[str] = None


class PaymentSessionSchema(BaseModel):
    buyer_id: Optional[str] = None
    items: List[Dict[str, Any]]
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@payments_router.post("/create-checkout-session")
async def create_checkout_session(
    payload: CheckoutSessionSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    uid = payload.user_id or current_user.id
    res = await db.execute(select(User).where(User.id == uid))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        price_id = getattr(settings, "STRIPE_PRICE_ID", "price_default")
        checkout_session = stripe.checkout.Session.create(
            client_reference_id=uid,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{settings.FRONTEND_URL}/premium/success",
            cancel_url=f"{settings.FRONTEND_URL}/premium/cancel",
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@payments_router.post("/create-payment-session")
async def create_payment_session(
    payload: PaymentSessionSchema,
    current_user=Depends(get_current_user)
):
    try:
        stripe_items = []
        for item in payload.items:
            stripe_items.append({
                "price_data": {
                    "currency": item.get("currency", "rub"),
                    "product_data": {
                        "name": item.get("name", "Vondic Product"),
                    },
                    "unit_amount": int(item.get("price", 0) * 100),
                },
                "quantity": int(item.get("quantity", 1)),
            })

        checkout_session = stripe.checkout.Session.create(
            client_reference_id=payload.buyer_id or current_user.id,
            payment_method_types=["card"],
            line_items=stripe_items,
            mode="payment",
            success_url=payload.success_url or f"{settings.FRONTEND_URL}/shop/success",
            cancel_url=payload.cancel_url or f"{settings.FRONTEND_URL}/shop/cancel",
            metadata=payload.metadata or {},
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
