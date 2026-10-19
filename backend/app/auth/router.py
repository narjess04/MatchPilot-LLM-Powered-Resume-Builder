import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import OAuthAccount, User
from . import oauth
from .deps import get_current_user
from .security import clear_session_cookie, hash_password, set_session_cookie, verify_password

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

STATE_COOKIE = "mp_oauth_state"


# ---------- Schemas ----------


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: str | None
    has_password: bool
    providers: list[str]


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        has_password=user.password_hash is not None,
        providers=sorted(a.provider for a in user.oauth_accounts),
    )


def _user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


# ---------- E-mail + password ----------


@router.get("/providers")
def providers() -> dict:
    return {"providers": oauth.enabled_providers()}


@router.post("/register", status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    email = body.email.strip().lower()
    if _user_by_email(db, email):
        raise HTTPException(409, "Un compte existe déjà avec cet e-mail.")
    user = User(email=email, password_hash=hash_password(body.password), full_name=body.full_name.strip())
    db.add(user)
    db.commit()
    set_session_cookie(response, user.id)
    return _to_out(user)


@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    user = _user_by_email(db, body.email)
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        raise HTTPException(401, "E-mail ou mot de passe incorrect.")
    set_session_cookie(response, user.id)
    return _to_out(user)


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    clear_session_cookie(response)


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> UserOut:
    return _to_out(user)


# ---------- Google / LinkedIn ----------


def _fail(reason: str) -> RedirectResponse:
    res = RedirectResponse(f"{get_settings().public_url}/login?error={reason}", status_code=303)
    res.delete_cookie(STATE_COOKIE, path="/")
    return res


@router.get("/{provider}/login")
def oauth_login(provider: str) -> RedirectResponse:
    if not oauth.is_enabled(provider):
        raise HTTPException(404, "Fournisseur de connexion non disponible.")
    state = secrets.token_urlsafe(32)
    res = RedirectResponse(oauth.authorization_url(provider, state), status_code=303)
    # Short-lived cookie binding this browser to the request (CSRF protection)
    res.set_cookie(
        STATE_COOKIE, f"{provider}:{state}", max_age=600, httponly=True,
        secure=get_settings().cookie_secure, samesite="lax", path="/",
    )
    return res


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not oauth.is_enabled(provider):
        return _fail("provider")
    if error or not code:
        return _fail("cancelled")
    expected = request.cookies.get(STATE_COOKIE)
    if not state or not expected or not secrets.compare_digest(expected, f"{provider}:{state}"):
        return _fail("state")

    try:
        identity = await oauth.fetch_identity(provider, code)
    except oauth.OAuthError:
        log.exception("OAuth exchange failed")
        return _fail("oauth")
    if not identity.email:
        return _fail("email")

    user = _find_or_create_oauth_user(db, provider, identity)
    if user is None:
        return _fail("email_in_use")

    res = RedirectResponse(f"{get_settings().public_url}/app", status_code=303)
    res.delete_cookie(STATE_COOKIE, path="/")
    set_session_cookie(res, user.id)
    return res


def _find_or_create_oauth_user(db: Session, provider: str, identity: oauth.Identity) -> User | None:
    account = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider, OAuthAccount.provider_user_id == identity.provider_user_id
        )
    )
    if account:
        return account.user

    user = _user_by_email(db, identity.email or "")
    if user and not identity.email_verified:
        # Never attach an unverified e-mail to an existing account (account takeover)
        return None
    if user is None:
        user = User(email=identity.email, password_hash=None, full_name=identity.name, avatar_url=identity.picture)
        db.add(user)
    elif not user.avatar_url and identity.picture:
        user.avatar_url = identity.picture

    db.add(OAuthAccount(user=user, provider=provider, provider_user_id=identity.provider_user_id))
    db.commit()
    return user
