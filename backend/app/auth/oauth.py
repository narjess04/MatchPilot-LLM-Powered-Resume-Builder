"""OAuth 2.0 / OpenID Connect "authorization code" flow for Google and LinkedIn."""

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from ..config import get_settings


@dataclass(frozen=True)
class ProviderSpec:
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str
    extra_params: tuple[tuple[str, str], ...] = ()


PROVIDERS: dict[str, ProviderSpec] = {
    "google": ProviderSpec(
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
        scope="openid email profile",
        extra_params=(("prompt", "select_account"),),
    ),
    # "Sign In with LinkedIn using OpenID Connect" product
    "linkedin": ProviderSpec(
        authorize_url="https://www.linkedin.com/oauth/v2/authorization",
        token_url="https://www.linkedin.com/oauth/v2/accessToken",
        userinfo_url="https://api.linkedin.com/v2/userinfo",
        scope="openid profile email",
    ),
}


@dataclass
class Identity:
    provider_user_id: str
    email: str | None
    email_verified: bool
    name: str
    picture: str | None


class OAuthError(Exception):
    pass


def _credentials(provider: str) -> tuple[str, str]:
    s = get_settings()
    return {
        "google": (s.google_client_id, s.google_client_secret),
        "linkedin": (s.linkedin_client_id, s.linkedin_client_secret),
    }.get(provider, ("", ""))


def is_enabled(provider: str) -> bool:
    client_id, client_secret = _credentials(provider)
    return provider in PROVIDERS and bool(client_id and client_secret)


def enabled_providers() -> list[str]:
    return [p for p in PROVIDERS if is_enabled(p)]


def redirect_uri(provider: str) -> str:
    return f"{get_settings().public_url}/api/auth/{provider}/callback"


def authorization_url(provider: str, state: str) -> str:
    spec = PROVIDERS[provider]
    params = {
        "response_type": "code",
        "client_id": _credentials(provider)[0],
        "redirect_uri": redirect_uri(provider),
        "scope": spec.scope,
        "state": state,
        **dict(spec.extra_params),
    }
    return f"{spec.authorize_url}?{urlencode(params)}"


async def fetch_identity(provider: str, code: str) -> Identity:
    """Exchange the authorization code for a token, then read the user's OpenID profile."""
    spec = PROVIDERS[provider]
    client_id, client_secret = _credentials(provider)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_res = await client.post(
                spec.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri(provider),
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            access_token = token_res.json()["access_token"]

            info_res = await client.get(spec.userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
            info_res.raise_for_status()
            info = info_res.json()
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise OAuthError(f"{provider}: {e}") from e

    return Identity(
        provider_user_id=str(info["sub"]),
        email=(info.get("email") or "").strip().lower() or None,
        email_verified=bool(info.get("email_verified")),
        name=info.get("name") or " ".join(filter(None, [info.get("given_name"), info.get("family_name")])),
        picture=info.get("picture"),
    )
