import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.oauth_client import OAuthClient
from app.models.user import User

oauth_router = APIRouter(prefix="/oauth", tags=["OAuth2"])


class OAuthClientCreateSchema(BaseModel):
    name: str
    redirect_uris: str
    description: Optional[str] = None


@oauth_router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_oauth_client(
    payload: OAuthClientCreateSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    client_id = OAuthClient.generate_client_id()
    client_secret = OAuthClient.generate_client_secret()

    client = OAuthClient(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        client_id=client_id,
        client_secret_plain=client_secret,
        name=payload.name,
        description=payload.description,
        redirect_uris=payload.redirect_uris,
    )
    client.set_client_secret(client_secret)
    db.add(client)
    await db.commit()

    return {"client": client.to_dict(), "client_secret": client_secret}


@oauth_router.get("/clients")
async def list_oauth_clients(
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(OAuthClient).where(OAuthClient.user_id == current_user.id))
    clients = res.scalars().all()
    return {"clients": [c.to_dict() for c in clients]}
