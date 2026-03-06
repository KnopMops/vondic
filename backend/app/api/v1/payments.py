from datetime import datetime, timedelta

import pytz
import stripe
from app.core.config import Config
from app.core.extensions import db
from app.models.user import User
from flask import Blueprint, jsonify, request

payments_bp = Blueprint("payments", __name__, url_prefix="/api/v1/payments")

stripe.api_key = Config.STRIPE_SECRET_KEY

COINS_PRICING = {
    100: 1000,
    500: 4500,
    2000: 15000,
}


@payments_bp.route("/create-checkout-session", methods=["POST"])
def create_checkout_session():
    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        checkout_session = stripe.checkout.Session.create(
            client_reference_id=user_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": Config.STRIPE_PRICE_ID,
                    "quantity": 1,
                },
            ],
            mode="subscription",
            success_url="http://localhost:3000/premium/success",
            cancel_url="http://localhost:3000/premium/cancel",
        )
        return jsonify({"url": checkout_session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/create-payment-session", methods=["POST"])
def create_payment_session():
    data = request.get_json()
    buyer_id = data.get("buyer_id")
    items = data.get("items", [])
    success_url = data.get(
        "success_url") or "http://localhost:3000/shop/success"
    cancel_url = data.get("cancel_url") or "http://localhost:3000/shop/cancel"
    metadata = data.get("metadata") or {}

    if not buyer_id:
        return jsonify({"error": "Missing buyer_id"}), 400
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"error": "items must be a non-empty array"}), 400

    user = User.query.get(buyer_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        line_items = []
        for it in items:
            name = it.get("name")
            amount = it.get("amount")
            currency = it.get("currency", "rub")
            quantity = int(it.get("quantity", 1))
            if not name or not amount or amount <= 0 or quantity <= 0:
                return jsonify({"error": "Invalid item in items"}), 400
            line_items.append(
                {
                    "price_data": {
                        "currency": currency,
                        "unit_amount": amount,
                        "product_data": {"name": name},
                    },
                    "quantity": quantity,
                }
            )

        checkout_session = stripe.checkout.Session.create(
            client_reference_id=buyer_id,
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
        return jsonify({"url": checkout_session.url})
    except stripe.error.StripeError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/create-coins-session", methods=["POST"])
def create_coins_session():
    data = request.get_json() or {}
    buyer_id = data.get("buyer_id")
    coins = int(data.get("coins") or 0)
    amount = COINS_PRICING.get(coins, 0)
    currency = "rub"
    success_url = data.get(
        "success_url") or "http://localhost:3000/shop/success"
    cancel_url = data.get("cancel_url") or "http://localhost:3000/shop/cancel"
    if not buyer_id or coins <= 0 or amount <= 0:
        return jsonify({"error": "Invalid parameters"}), 400
    user = User.query.get(buyer_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    try:
        checkout_session = stripe.checkout.Session.create(
            client_reference_id=buyer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": currency,
                        "unit_amount": amount,
                        "product_data": {"name": f"Vondic Coins {coins}"},
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"type": "coins", "coins": str(coins)},
        )
        return jsonify({"url": checkout_session.url})
    except stripe.error.StripeError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/confirm-coins", methods=["POST"])
def confirm_coins():
    data = request.get_json() or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if not session:
            return jsonify({"error": "Session not found"}), 404
        if session.get("mode") != "payment" or session.get(
                "payment_status") != "paid":
            return jsonify({"error": "Payment not completed"}), 400
        buyer_id = session.get("client_reference_id")
        metadata = session.get("metadata") or {}
        if metadata.get("type") != "coins":
            return jsonify({"error": "Invalid session type"}), 400
        coins_str = metadata.get("coins") or "0"
        try:
            coins_val = int(coins_str)
        except Exception:
            coins_val = 0
        if not buyer_id or coins_val <= 0:
            return jsonify({"error": "Invalid session data"}), 400
        user = User.query.get(buyer_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        user.balance = (user.balance or 0) + coins_val
        db.session.commit()
        return jsonify({"success": True, "balance": user.balance})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature")
    endpoint_secret = Config.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret)
    except ValueError:
        return "Invalid payload", 400
    except stripe.error.SignatureVerificationError:
        return "Invalid signature", 400

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        handle_checkout_session(session)

    return jsonify(success=True)


def handle_checkout_session(session):
    user_id = session.get("client_reference_id")
    if not user_id:
        return

    user = User.query.get(user_id)
    if not user:
        return

    mode = session.get("mode")
    if mode == "subscription":
        moscow_tz = pytz.timezone("Europe/Moscow")
        now = datetime.now(moscow_tz)
        user.premium = 1
        user.premium_started_at = now
        user.premium_expired_at = now + timedelta(days=30)
        db.session.commit()
        return
    metadata = session.get("metadata") or {}
    t = metadata.get("type")
    if t == "coins":
        coins_str = metadata.get("coins") or "0"
        try:
            coins_val = int(coins_str)
        except Exception:
            coins_val = 0
        if coins_val > 0:
            user.balance = (user.balance or 0) + coins_val
            db.session.commit()
