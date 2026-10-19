from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import oauth
from app.config import get_settings
from app.db import Base, get_db
from app.main import app


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register(client, email="sarah@example.com", password="motdepasse123", name="Sarah"):
    return client.post("/api/auth/register", json={"email": email, "password": password, "full_name": name})


# ---------- e-mail + password ----------


def test_register_signs_in_and_me_works(client):
    r = register(client)
    assert r.status_code == 201
    assert r.json()["email"] == "sarah@example.com"
    assert r.json()["has_password"] is True
    assert "mp_session" in r.cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["full_name"] == "Sarah"


def test_email_is_case_insensitive_and_unique(client):
    register(client, email="Sarah@Example.com")
    r = register(client, email="sarah@example.COM")
    assert r.status_code == 409


def test_short_password_rejected(client):
    assert register(client, password="court").status_code == 422


def test_login_logout(client):
    register(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    assert client.post("/api/auth/login", json={"email": "sarah@example.com", "password": "mauvais-mdp"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "inconnu@example.com", "password": "motdepasse123"}).status_code == 401

    r = client.post("/api/auth/login", json={"email": "SARAH@example.com", "password": "motdepasse123"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_tampered_session_cookie_rejected(client):
    client.cookies.set("mp_session", "not-a-valid-token")
    assert client.get("/api/auth/me").status_code == 401


# ---------- OAuth ----------


@pytest.fixture
def google_enabled(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "google_client_id", "test-client-id")
    monkeypatch.setattr(s, "google_client_secret", "test-secret")


def fake_identity(monkeypatch, **kw):
    identity = oauth.Identity(
        provider_user_id=kw.get("sub", "google-123"),
        email=kw.get("email", "sarah@example.com"),
        email_verified=kw.get("verified", True),
        name="Sarah Ben Ali",
        picture="https://example.com/sarah.jpg",
    )

    async def _fetch(provider, code):
        return identity

    monkeypatch.setattr(oauth, "fetch_identity", _fetch)


def start_oauth(client) -> str:
    r = client.get("/api/auth/google/login", follow_redirects=False)
    assert r.status_code == 303
    url = urlparse(r.headers["location"])
    assert url.netloc == "accounts.google.com"
    return parse_qs(url.query)["state"][0]


def test_disabled_provider_is_404(client, monkeypatch):
    s = get_settings()
    for field in ("google_client_id", "google_client_secret", "linkedin_client_id", "linkedin_client_secret"):
        monkeypatch.setattr(s, field, "")
    assert client.get("/api/auth/providers").json() == {"providers": []}
    assert client.get("/api/auth/google/login", follow_redirects=False).status_code == 404


def test_oauth_creates_account(client, google_enabled, monkeypatch):
    fake_identity(monkeypatch)
    state = start_oauth(client)
    r = client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"].endswith("/app")

    me = client.get("/api/auth/me").json()
    assert me["providers"] == ["google"]
    assert me["has_password"] is False
    assert me["avatar_url"] == "https://example.com/sarah.jpg"


def test_oauth_rejects_bad_state(client, google_enabled, monkeypatch):
    fake_identity(monkeypatch)
    start_oauth(client)
    r = client.get("/api/auth/google/callback?code=abc&state=forged", follow_redirects=False)
    assert "error=state" in r.headers["location"]
    assert client.get("/api/auth/me").status_code == 401


def test_oauth_links_existing_account_when_email_verified(client, google_enabled, monkeypatch):
    user_id = register(client).json()["id"]
    client.post("/api/auth/logout")
    fake_identity(monkeypatch)
    state = start_oauth(client)
    client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    me = client.get("/api/auth/me").json()
    assert me["id"] == user_id
    assert me["providers"] == ["google"] and me["has_password"] is True


def test_oauth_refuses_unverified_email_of_existing_account(client, google_enabled, monkeypatch):
    register(client)
    client.post("/api/auth/logout")
    fake_identity(monkeypatch, verified=False)
    state = start_oauth(client)
    r = client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    assert "error=email_in_use" in r.headers["location"]
    assert client.get("/api/auth/me").status_code == 401
