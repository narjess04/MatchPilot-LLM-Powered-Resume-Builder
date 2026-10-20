import pytest

from app.config import get_settings


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def no_openrouter_fallback(monkeypatch):
    # Tests never reach the network: the Groq -> OpenRouter fallback is enabled only by the tests that fake it
    monkeypatch.setattr(get_settings(), "openrouter_api_key", "")
