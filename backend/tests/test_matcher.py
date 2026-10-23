"""Match score. The LLM is replaced by fakes: these tests check the evidence checks and the score computed by code."""

import pytest

from app import llm
from app.agents import matcher
from app.schemas import CriterionVerdict, JobAnalysis, MatchDraft, SkillVerdict

from .test_auth import client, register  # noqa: F401  (fixture reuse)
from .test_generation import PROFILE

# French profile, English offer
JOB_EN = JobAnalysis(
    job_title="Junior Full Stack Developer", language="en", summary="Full stack role.",
    required_skills=["React", "Node.js", "Database queries", "Machine learning"], nice_to_have_skills=["Docker"],
    spoken_languages=["Fluent English"], keywords=["React", "Node.js"],
)


def draft(skills: list[SkillVerdict], criteria: list[CriterionVerdict] | None = None) -> MatchDraft:
    return MatchDraft(
        skills=skills, criteria=criteria or [], strengths=["Stage en React"], tips=["Mettez MediBook en avant"],
        verdict="Bonne correspondance.",
    )


@pytest.fixture
def fake_structured(monkeypatch):
    answer = {"draft": draft([])}

    async def fake(*, system, user, schema, name="result"):
        assert schema is MatchDraft
        return answer["draft"]

    monkeypatch.setattr(llm, "structured", fake)
    return answer


@pytest.mark.anyio
async def test_skills_in_another_language_count_when_the_profile_proves_them(fake_structured):
    fake_structured["draft"] = draft(
        [SkillVerdict(index=2, status="match", evidence="Requêtes SQL pour 3 tableaux de bord")],
        [CriterionVerdict(criterion="spoken_languages", status="partial", note="Anglais B2.")],
    )
    report = await matcher.match(PROFILE, JOB_EN)
    status = {s.skill: s.status for s in report.skills}
    assert status == {
        "React": "match", "Node.js": "match", "Database queries": "match", "Machine learning": "missing", "Docker": "missing",
    }
    assert report.skills_score == 67  # 3 of 4 required, nice-to-have missing: 3 / 4.5
    assert report.criteria_score == 50
    assert report.score == 63


@pytest.mark.anyio
async def test_evidence_absent_from_the_profile_is_not_counted(fake_structured):
    fake_structured["draft"] = draft([SkillVerdict(index=3, status="match", evidence="Apprentissage automatique avec TensorFlow")])
    report = await matcher.match(PROFILE, JOB_EN)
    ml = next(s for s in report.skills if s.skill == "Machine learning")
    assert ml.status == "missing" and ml.evidence == ""


@pytest.mark.anyio
async def test_skills_written_in_the_profile_match_without_the_model(fake_structured):
    report = await matcher.match(PROFILE, JOB_EN)
    assert [s.skill for s in report.skills if s.status == "match"] == ["React", "Node.js"]


def test_criteria_the_offer_does_not_ask_are_left_out():
    report = matcher.build_report(PROFILE, JOB_EN, draft([], [CriterionVerdict(criterion="education", status="unmet", note="")]))
    assert [c.criterion for c in report.criteria] == ["spoken_languages"]
    assert report.criteria_score is None  # model gave no verdict for it: unknown, not counted
    assert report.score == report.skills_score


def test_match_route(client, fake_structured):
    body = {"profile": PROFILE.model_dump(), "job": JOB_EN.model_dump()}
    assert client.post("/api/match", json=body).status_code == 401
    register(client)
    r = client.post("/api/match", json=body)
    assert r.status_code == 200
    assert 0 <= r.json()["score"] <= 100
