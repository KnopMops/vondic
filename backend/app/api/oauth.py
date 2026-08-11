import uuid
import time
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.oauth_client import OAuthClient
from app.models.user import User

oauth_router = APIRouter(prefix="/oauth", tags=["OAuth2"])

# In-memory stores for OAuth authorization codes & access tokens
OAUTH_CODES: Dict[str, Dict[str, Any]] = {}
OAUTH_TOKENS: Dict[str, Dict[str, Any]] = {}


class OAuthClientCreateSchema(BaseModel):
    name: str
    redirect_uris: str
    description: Optional[str] = None


class OAuthAuthorizeRequestSchema(BaseModel):
    client_id: str
    redirect_uri: str
    scope: Optional[str] = "basic"
    state: Optional[str] = None
    confirm: bool = True


class OAuthTokenRequestSchema(BaseModel):
    grant_type: str = "authorization_code"
    code: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    refresh_token: Optional[str] = None


@oauth_router.get("/authorize")
async def get_oauth_authorize(
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    response_type: str = Query("code"),
    scope: Optional[str] = Query("basic"),
    state: Optional[str] = Query(None),
    current_user=Depends(get_optional_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(OAuthClient).where(OAuthClient.client_id == client_id))
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="OAuth client not found")

    return {
        "client": client.to_dict(),
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": response_type,
        "scope": scope,
        "state": state,
        "user": current_user.to_dict() if current_user else None,
    }


@oauth_router.post("/authorize")
async def post_oauth_authorize(
    payload: OAuthAuthorizeRequestSchema,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Authorization denied by user")

    res = await db.execute(select(OAuthClient).where(OAuthClient.client_id == payload.client_id))
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="OAuth client not found")

    code = f"code_{uuid.uuid4().hex}"
    OAUTH_CODES[code] = {
        "user_id": current_user.id,
        "client_id": payload.client_id,
        "redirect_uri": payload.redirect_uri,
        "scope": payload.scope or "basic",
        "expires_at": time.time() + 600,
    }

    sep = "&" if "?" in payload.redirect_uri else "?"
    redirect_url = f"{payload.redirect_uri}{sep}code={code}"
    if payload.state:
        redirect_url += f"&state={payload.state}"

    return {
        "code": code,
        "state": payload.state,
        "redirect_url": redirect_url,
    }


@oauth_router.post("/token")
async def post_oauth_token(
    request: Request,
    payload: Optional[OAuthTokenRequestSchema] = None,
    db=Depends(get_async_db)
):
    # Form data fallback
    form_data = {}
    try:
        form = await request.form()
        form_data = dict(form)
    except Exception:
        pass

    grant_type = (payload.grant_type if payload else None) or form_data.get("grant_type") or "authorization_code"
    code = (payload.code if payload else None) or form_data.get("code")
    client_id = (payload.client_id if payload else None) or form_data.get("client_id")
    client_secret = (payload.client_secret if payload else None) or form_data.get("client_secret")

    if grant_type == "authorization_code":
        if not code or code not in OAUTH_CODES:
            raise HTTPException(status_code=400, detail="Invalid or expired authorization code")

        code_info = OAUTH_CODES.pop(code)
        if time.time() > code_info["expires_at"]:
            raise HTTPException(status_code=400, detail="Authorization code expired")

        user_id = code_info["user_id"]
        access_token = f"oauth_at_{uuid.uuid4().hex}"
        refresh_token = f"oauth_rt_{uuid.uuid4().hex}"

        OAUTH_TOKENS[access_token] = {
            "user_id": user_id,
            "client_id": client_id,
            "scope": code_info.get("scope", "basic"),
            "expires_at": time.time() + 86400 * 30,
        }

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": 2592000,
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported grant_type: {grant_type}")


@oauth_router.get("/userinfo")
@oauth_router.get("/me")
async def get_oauth_userinfo(
    request: Request,
    access_token: Optional[str] = Query(None),
    db=Depends(get_async_db)
):
    token = access_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]

    if not token or token not in OAUTH_TOKENS:
        raise HTTPException(status_code=401, detail="Invalid access token")

    token_info = OAUTH_TOKENS[token]
    if time.time() > token_info["expires_at"]:
        raise HTTPException(status_code=401, detail="Access token expired")

    res = await db.execute(select(User).where(User.id == token_info["user_id"]))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "sub": user.id,
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "email": user.email,
    }


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


@oauth_router.delete("/clients/{client_id}")
async def delete_oauth_client(
    client_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_async_db)
):
    res = await db.execute(select(OAuthClient).where(OAuthClient.client_id == client_id, OAuthClient.user_id == current_user.id))
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="OAuth client not found")

    await db.delete(client)
    await db.commit()
    return {"message": "Client deleted successfully"}
