"""Job offer analysis. The LLM is replaced by fakes: these tests check the plumbing and the safety nets."""

import pytest

from app import llm
from app.agents import job_analyzer
from app.config import get_settings
from app.schemas import ExtractedProfile, JobAnalysis

from .test_auth import client, register  # noqa: F401  (fixture reuse)
from .test_profile_import import sample_profile

OFFER = (
    "Développeur Full Stack Junior (H/F) — NovaTech Solutions, Tunis\n"
    "Missions : développer des fonctionnalités en React et TypeScript, concevoir des API REST avec Node.js.\n"
    "Profil : Bac+5 en informatique, 0 à 2 ans d'expérience. Notions de Docker appréciées. "
    "Anglais technique courant."
)


def model_answer(**overrides) -> JobAnalysis:
    data = dict(
        job_title="Développeur Full Stack Junior (H/F)", company="NovaTech Solutions", location="Tunis",
        language="fr", seniority="junior", contract_type="", salary="", education="Bac+5 en informatique",
        experience="0 à 2 ans d'expérience", spoken_languages=["Anglais technique courant"],
        summary="Poste de développeur full stack junior.",
        required_skills=["React", "TypeScript", "Node.js", "API REST"], nice_to_have_skills=["Docker"],
        soft_skills=[], responsibilities=["Développer des fonctionnalités en React et TypeScript"],
        keywords=["React", "TypeScript", "Node.js", "API REST", "Docker"],
    )
    return JobAnalysis(**{**data, **overrides})


@pytest.fixture
def fake_structured(monkeypatch):
    answer = {"job": model_answer()}

    async def fake(*, system, user, schema, name="result"):
        assert schema is JobAnalysis
        assert OFFER in user
        return answer["job"]

    monkeypatch.setattr(llm, "structured", fake)
    return answer


# ---------- safety nets ----------


@pytest.mark.anyio
async def test_keywords_absent_from_the_offer_are_dropped(fake_structured):
    fake_structured["job"] = model_answer(keywords=["React", "Kubernetes", "Angular"])
    job = await job_analyzer.analyze_job(OFFER)
    assert job.keywords == ["React"]


@pytest.mark.anyio
async def test_company_name_is_not_a_keyword(fake_structured):
    fake_structured["job"] = model_answer(keywords=["NovaTech Solutions", "React"])
    job = await job_analyzer.analyze_job(OFFER)
    assert job.keywords == ["React"]


@pytest.mark.anyio
async def test_lists_are_deduplicated_and_skills_kept_in_one_list(fake_structured):
    fake_structured["job"] = model_answer(
        required_skills=["React", "react ", "Node.js", "Docker"],
        nice_to_have_skills=["Docker", "Docker"],
        keywords=["React", "REACT", "Node.js"],
    )
    job = await job_analyzer.analyze_job(OFFER)
    assert job.required_skills == ["React", "Node.js", "Docker"]
    assert job.nice_to_have_skills == []
    assert job.keywords == ["React", "Node.js"]


@pytest.mark.anyio
async def test_typographic_hyphens_are_normalized(fake_structured):
    fake_structured["job"] = model_answer(summary="Poste front‑end", required_skills=["CI‑CD"])
    job = await job_analyzer.analyze_job(OFFER)
    assert job.summary == "Poste front-end"
    assert job.required_skills == ["CI-CD"]


# ---------- route ----------


def test_analyze_requires_session(client):
    assert client.post("/api/offer/analyze", json={"text": OFFER}).status_code == 401


def test_analyze_returns_the_analysis(client, fake_structured):
    register(client)
    r = client.post("/api/offer/analyze", json={"text": f"  {OFFER}  "})
    assert r.status_code == 200
    body = r.json()
    assert body["job_title"] == "Développeur Full Stack Junior (H/F)"
    assert body["nice_to_have_skills"] == ["Docker"]
    assert body["spoken_languages"] == ["Anglais technique courant"]


def test_analyze_rejects_too_short_offer(client, fake_structured):
    register(client)
    assert client.post("/api/offer/analyze", json={"text": "Développeur React"}).status_code == 422


# ---------- Groq -> OpenRouter fallback ----------


@pytest.fixture
def fallback(monkeypatch):
    monkeypatch.setattr(get_settings(), "openrouter_api_key", "test-key")
    calls: list[str] = []

    async def fake_openrouter(*, models, messages, **kwargs):
        calls.append(models[0])
        assert kwargs["response_format"]["type"] == "json_schema"
        return sample_profile().model_dump_json()

    monkeypatch.setattr(llm, "openrouter_chat", fake_openrouter)
    return calls


@pytest.mark.anyio
@pytest.mark.parametrize("status", [429, 502, 503])
async def test_structured_falls_back_to_openrouter_when_groq_is_unavailable(monkeypatch, fallback, status):
    groq_calls = []

    async def saturated(**kwargs):
        groq_calls.append(kwargs)
        raise llm.LLMError("Limite de requêtes Groq atteinte", status)

    monkeypatch.setattr(llm, "_chat", saturated)
    result = await llm.structured(system="s", user="u", schema=ExtractedProfile)
    assert result.full_name == "Sarah Ben Ali"
    assert fallback == [get_settings().openrouter_fallback_model]
    # Groq's own retry-after waits are skipped when a fallback exists
    assert groq_calls[0]["_no_retry"] is True


@pytest.mark.anyio
async def test_structured_does_not_fall_back_on_bad_requests(monkeypatch, fallback):
    async def rejected(**kwargs):
        raise llm.LLMError("Requête refusée par Groq : context too long", 400)

    monkeypatch.setattr(llm, "_chat", rejected)
    with pytest.raises(llm.LLMError):
        await llm.structured(system="s", user="u", schema=ExtractedProfile)
    assert fallback == []
