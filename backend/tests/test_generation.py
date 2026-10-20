"""Tailored CV and cover letter. The writing model is replaced by fakes: these tests check the safety nets."""

import pytest

from app import llm
from app.agents import cover_letter, cv_writer, style
from app.schemas import (
    CoverLetter, DraftEducation, DraftExperience, DraftLanguage, DraftProject, DraftSkill, DraftSkillGroup,
    JobAnalysis, ProfileIn, TailorDraft,
)

from .test_auth import client, register  # noqa: F401  (fixture reuse)

PROFILE = ProfileIn(
    full_name="Sarah Ben Ali", headline="Ingénieure logiciel", email="sarah@example.com", phone="+216 20 000 000",
    location="Tunis", summary="",
    experiences=[
        {"title": "Stagiaire développeuse web", "company": "WebNova", "location": "Tunis", "start": "02/2025",
         "end": "Présent", "bullets": "Développement de l'interface React\nRequêtes SQL pour 3 tableaux de bord"},
        {"title": "Stagiaire support", "company": "Banque Atlas", "location": "Tunis", "start": "07/2023", "end": "08/2023",
         "bullets": "Gestion des tickets"},
    ],
    education=[
        {"degree": "Diplôme d'ingénieur", "institution": "ESIT", "location": "Tunis", "start": "2022", "end": "2025", "details": ""},
        {"degree": "Licence", "institution": "FST", "location": "Tunis", "start": "2019", "end": "2022", "details": ""},
    ],
    projects=[{"name": "MediBook", "technologies": "React, Node.js, PostgreSQL", "link": "github.com/s/medibook",
               "description": "Application de rendez-vous"}],
    skills=[{"category": "Frameworks", "items": ["ReactJS", "Node.js"]}],
    languages=[{"language": "Français", "level": "courant"}, {"language": "Anglais", "level": "B2"}],
    sections={"hackathons": False, "associations": False, "interests": False},
)

JOB = JobAnalysis(
    job_title="Développeur Full Stack", language="fr", summary="Poste full stack.",
    required_skills=["React", "Node.js", "TypeScript"], keywords=["React", "Node.js", "TypeScript", "PostgreSQL"],
)


def draft(**overrides) -> TailorDraft:
    data = dict(
        headline="Développeuse full stack junior", summary="Ingénieure logiciel, stages en React et SQL.",
        experiences=[
            DraftExperience(source=1, title="IT support intern", bullets=["Ticket handling"]),
            DraftExperience(source=0, title="Web developer intern", bullets=["Built the React interface", "SQL queries for 3 dashboards"]),
        ],
        projects=[DraftProject(source=0, name="MediBook", description=["Appointment app with React, Node.js and PostgreSQL"])],
        education=[DraftEducation(source=0, degree="Software engineering degree", details=[])],
        skills=[DraftSkillGroup(category="Frameworks", items=[
            DraftSkill(source="ReactJS", label="React"), DraftSkill(source="Node.js", label="Node.js"),
            DraftSkill(source="PostgreSQL", label="PostgreSQL"), DraftSkill(source="TypeScript", label="TypeScript"),
        ])],
        languages=[DraftLanguage(source=0, language="French", level="fluent")],
        hackathons=[], associations=[], interests=[], changes=["Expériences réécrites en anglais"],
    )
    return TailorDraft(**{**data, **overrides})


# ---------- tailored CV ----------


def test_facts_come_from_the_profile_not_the_model():
    tailored, _ = cv_writer.build_profile(PROFILE, draft(), "en")
    first = tailored.experiences[0]
    # Chronological order of the profile is kept, whatever order the model used
    assert [x["company"] for x in tailored.experiences] == ["WebNova", "Banque Atlas"]
    assert first["title"] == "Web developer intern"
    assert (first["start"], first["location"]) == ("02/2025", "Tunis")
    assert first["end"] == "Present"
    assert tailored.projects[0]["link"] == "github.com/s/medibook"
    assert (tailored.email, tailored.phone) == (PROFILE.email, PROFILE.phone)


def test_education_and_languages_are_never_dropped():
    tailored, _ = cv_writer.build_profile(PROFILE, draft(), "en")
    assert [x["institution"] for x in tailored.education] == ["ESIT", "FST"]
    assert tailored.education[0]["degree"] == "Software engineering degree"
    assert [x["language"] for x in tailored.languages] == ["French", "Anglais"]


def test_skills_absent_from_the_profile_are_removed_and_reported():
    tailored, warnings = cv_writer.build_profile(PROFILE, draft(), "en")
    # PostgreSQL is in a project's technologies: allowed. TypeScript is nowhere: removed.
    assert tailored.skills == [{"category": "Frameworks", "items": ["React", "Node.js", "PostgreSQL"]}]
    assert any("TypeScript" in w for w in warnings)


def test_invalid_or_duplicate_sources_are_ignored():
    d = draft(experiences=[
        DraftExperience(source=0, title="A", bullets=[]), DraftExperience(source=0, title="B", bullets=[]),
        DraftExperience(source=7, title="Invented", bullets=["Led a team of 12"]),
    ])
    tailored, _ = cv_writer.build_profile(PROFILE, d, "fr")
    assert [x["title"] for x in tailored.experiences] == ["A"]


def test_figures_not_in_the_profile_are_flagged():
    d = draft(summary="Plus de 40 % de temps de chargement gagné sur 3 tableaux de bord.")
    _, warnings = cv_writer.build_profile(PROFILE, d, "fr")
    # 3 is in the profile ("3 tableaux de bord"), 40 is not
    assert "Chiffres absents de votre profil, à vérifier : 40." in warnings


def test_dashes_are_removed_from_written_text():
    d = draft(summary="Ingénieure logiciel — React et SQL")
    tailored, _ = cv_writer.build_profile(PROFILE, d, "fr")
    assert tailored.summary == "Ingénieure logiciel, React et SQL"


@pytest.mark.anyio
async def test_tailor_cv_reports_keyword_coverage(monkeypatch):
    async def fake_write(*, system, user, schema, temperature, name="result", **_):
        assert "English" in user and "TypeScript" in user
        return draft()

    monkeypatch.setattr(llm, "write_structured", fake_write)
    result = await cv_writer.tailor_cv(PROFILE, JOB, "en")
    assert "React" in result.coverage_after.found
    assert result.coverage_after.missing == ["TypeScript"]
    assert result.coverage_after.percent >= result.coverage_before.percent


# ---------- style ----------


def test_lint_finds_stock_phrases_and_dashes():
    found = style.lint("Passionnée par le web — je suis convaincue de pouvoir aider.", "fr")
    assert {"passionnée", "je suis convaincue", "—"} <= set(found)
    found = style.lint("I am writing to express my interest. Moreover, I leverage React.", "en")
    assert {"i am writing to express", "moreover", "leverage"} <= set(found)
    assert style.lint("J'ai développé l'interface React de WebNova, de 02/2025 à 07/2025.", "fr") == []


# ---------- cover letter ----------


def letter(*paragraphs: str) -> CoverLetter:
    return CoverLetter(subject="Candidature au poste de Développeur Full Stack", greeting="Madame, Monsieur,",
                       paragraphs=list(paragraphs), closing="Je vous prie d'agréer mes salutations distinguées.")


@pytest.fixture
def fake_writer(monkeypatch):
    calls: list[tuple[str, float]] = []
    answers: list[CoverLetter] = []

    async def fake_write(*, system, user, schema, temperature, name="result", **_):
        calls.append((system.split("\n")[0], temperature))
        return answers.pop(0)

    monkeypatch.setattr(llm, "write_structured", fake_write)
    return calls, answers


@pytest.mark.anyio
async def test_letter_is_drafted_then_edited(fake_writer):
    calls, answers = fake_writer
    answers += [letter("Brouillon."), letter("J'ai développé l'interface React de WebNova.")]
    result = await cover_letter.write_letter(PROFILE, JOB, "fr", "Disponible dès janvier.")
    assert len(calls) == 2
    assert calls[0][0].startswith("You write a cover letter") and calls[1][0].startswith("You are an editor")
    assert result.letter.paragraphs == ["J'ai développé l'interface React de WebNova."]
    assert result.warnings == []


@pytest.mark.anyio
async def test_leftover_stock_phrases_trigger_a_fix_pass(fake_writer):
    calls, answers = fake_writer
    answers += [
        letter("Brouillon."),
        letter("Je suis passionnée par le web — et je suis convaincue de pouvoir aider."),
        letter("J'aime le web — j'ai construit MediBook."),
    ]
    result = await cover_letter.write_letter(PROFILE, JOB, "fr")
    assert len(calls) == 3
    assert calls[2][0].startswith("You correct a cover letter")
    # Dashes the model kept are turned into commas
    assert result.letter.paragraphs == ["J'aime le web, j'ai construit MediBook."]


@pytest.mark.anyio
async def test_letter_flags_invented_figures(fake_writer):
    _, answers = fake_writer
    answers += [letter("x"), letter("J'ai réduit de 30 % le temps de chargement de 3 tableaux de bord.")]
    result = await cover_letter.write_letter(PROFILE, JOB, "fr")
    assert result.warnings == ["Chiffres absents de votre profil, à vérifier : 30."]


# ---------- routes ----------


def test_generation_requires_session(client):
    body = {"profile": PROFILE.model_dump(), "job": JOB.model_dump(), "lang": "fr"}
    assert client.post("/api/tailor-cv", json=body).status_code == 401
    assert client.post("/api/cover-letter", json=body).status_code == 401


def test_cover_letter_route(client, fake_writer):
    _, answers = fake_writer
    answers += [letter("x"), letter("J'ai développé l'interface React de WebNova.")]
    register(client)
    body = {"profile": PROFILE.model_dump(), "job": JOB.model_dump(), "lang": "fr", "notes": "Disponible en janvier."}
    r = client.post("/api/cover-letter", json=body)
    assert r.status_code == 200
    assert r.json()["letter"]["greeting"] == "Madame, Monsieur,"


def test_tailor_cv_route_rejects_unknown_language(client):
    register(client)
    body = {"profile": PROFILE.model_dump(), "job": JOB.model_dump(), "lang": "de"}
    assert client.post("/api/tailor-cv", json=body).status_code == 422


def test_stuffed_role_and_result_fall_back_to_the_profile():
    p = PROFILE.model_copy(update={
        "hackathons": [{"name": "Hack4Health", "result": "2e place", "date": "2024", "description": "Prototype en 24 h"}],
        "associations": [{"organization": "GDSC", "role": "Responsable événements", "start": "2023", "end": "2025",
                          "description": "Ateliers pour 80 étudiants"}],
    })
    from app.schemas import DraftAssociation, DraftHackathon
    d = draft(
        hackathons=[DraftHackathon(source=0, result="2nd place at Hack4Health (2024), prototype built in 24 hours", project="")],
        associations=[DraftAssociation(source=0, role="Events lead, GDSC (2023-2025)", description=["Workshops for 80 students"])],
    )
    tailored, warnings = cv_writer.build_profile(p, d, "en")
    assert tailored.hackathons[0]["result"] == "2e place"
    assert tailored.associations[0]["role"] == "Responsable événements"
    # Dates of the profile are not "invented figures"
    assert not any("Chiffres" in w for w in warnings)


@pytest.mark.anyio
async def test_letter_keeps_the_draft_when_the_editing_pass_fails(monkeypatch):
    calls = []

    async def flaky_write(*, system, user, schema, temperature, name="result", **_):
        calls.append(system.split("\n")[0])
        if len(calls) == 1:
            return letter("J'ai développé l'interface React de WebNova.")
        raise llm.LLMError("Le service de génération ne répond pas, réessayez dans un instant.", 504)

    monkeypatch.setattr(llm, "write_structured", flaky_write)
    result = await cover_letter.write_letter(PROFILE, JOB, "fr")
    assert result.letter.paragraphs == ["J'ai développé l'interface React de WebNova."]
    assert len(calls) == 2


def test_content_moved_from_another_entry_is_removed():
    d = draft(projects=[DraftProject(source=0, name="MediBook", description=[
        "Application de rendez-vous en React, Node.js et PostgreSQL",
        # Belongs to the Banque Atlas internship, not to the project
        "Gestion des tickets support des utilisateurs de Banque Atlas",
    ])])
    tailored, warnings = cv_writer.build_profile(PROFILE, d, "fr")
    assert tailored.projects[0]["description"] == "Application de rendez-vous en React, Node.js et PostgreSQL"
    assert any("autre rubrique" in w for w in warnings)


def test_hackathon_project_line_comes_from_its_own_description():
    from app.schemas import DraftHackathon
    p = PROFILE.model_copy(update={"hackathons": [{"name": "Hack4Health", "result": "2e place", "date": "2024",
                                                   "description": "Prototype d'application de suivi des rendez-vous en 24 h"}]})
    ok = draft(hackathons=[DraftHackathon(source=0, result="2nd place", project="Appointment tracking app prototype built in 24 h")])
    tailored, _ = cv_writer.build_profile(p, ok, "en")
    assert tailored.hackathons == [{"name": "Hack4Health", "result": "2nd place", "date": "2024",
                                    "description": "Appointment tracking app prototype built in 24 h"}]
    # A project line taken from another entry (the WebNova internship) is dropped
    moved = draft(hackathons=[DraftHackathon(source=0, result="2e place", project="Interface React et requêtes SQL pour 3 tableaux de bord")])
    tailored, _ = cv_writer.build_profile(p, moved, "fr")
    assert tailored.hackathons[0]["description"] == ""


def test_translated_lines_are_not_mistaken_for_moved_content():
    tailored, warnings = cv_writer.build_profile(PROFILE, draft(), "en")
    assert tailored.experiences[0]["bullets"] == "Built the React interface\nSQL queries for 3 dashboards"
    assert not any("autre rubrique" in w for w in warnings)


@pytest.mark.anyio
async def test_letter_is_told_which_skills_the_candidate_lacks(fake_writer, monkeypatch):
    seen = []

    async def spy(*, system, user, schema, temperature, name="result", **_):
        seen.append(user)
        return letter("J'aimerais apprendre TypeScript chez vous.")

    monkeypatch.setattr(llm, "write_structured", spy)
    result = await cover_letter.write_letter(PROFILE, JOB, "fr")
    assert "<not_in_profile>\nTypeScript\n</not_in_profile>" in seen[0]
    # Mentioning a missing skill is allowed (to say it will be learned) but the candidate is asked to check
    assert any("TypeScript" in w for w in result.warnings)


@pytest.mark.anyio
async def test_letter_flags_availability_the_candidate_did_not_give(fake_writer):
    _, answers = fake_writer
    answers += [letter("x"), letter("Je suis disponible immédiatement.")]
    result = await cover_letter.write_letter(PROFILE, JOB, "fr", notes="")
    assert any("disponibilité" in w for w in result.warnings)


@pytest.mark.anyio
async def test_truncated_writing_answer_is_retried_once(monkeypatch):
    calls = []

    async def fake_openrouter(**kwargs):
        calls.append(kwargs["reasoning"])
        if len(calls) == 1:
            raise llm.LLMError("Réponse du modèle tronquée (document trop long).", 502)
        return letter("Texte.").model_dump_json()

    monkeypatch.setattr(llm, "openrouter_chat", fake_openrouter)
    monkeypatch.setattr(llm.get_settings(), "openrouter_model", "test/model")
    result = await llm.write_structured(system="s", user="u", schema=CoverLetter, temperature=0.5)
    assert result.paragraphs == ["Texte."]
    assert calls == [{"effort": "low"}, {"effort": "low"}]


def test_pdf_export_requires_session(client):
    assert client.post("/api/export/cv-pdf", json={"html": "<p>x</p>"}).status_code == 401


def test_pdf_export_returns_a_named_pdf(client, monkeypatch):
    from app import generation_router

    async def fake_pdf(html):
        assert "<h1>Sarah</h1>" in html
        return b"%PDF-1.7 fake"

    monkeypatch.setattr(generation_router, "html_to_pdf", fake_pdf)
    register(client)
    r = client.post("/api/export/cv-pdf", json={"html": "<h1>Sarah</h1>", "filename": "CV_Sarah-Ben-Ali"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"] == 'attachment; filename="CV_Sarah-Ben-Ali.pdf"'
    assert r.content == b"%PDF-1.7 fake"


@pytest.mark.anyio
async def test_pdf_render_blocks_network_and_keeps_links():
    from app.pdf import html_to_pdf
    import pymupdf
    html = ('<html><body style="margin:0"><p>Réseau <a href="https://linkedin.com/in/sarah">linkedin.com/in/sarah</a></p>'
            '<img src="http://127.0.0.1:9/leak.png"></body></html>')
    try:
        pdf = await html_to_pdf(html)
    except Exception as e:  # no browser on this machine
        pytest.skip(f"PDF browser unavailable: {e}")
    page = pymupdf.open(stream=pdf, filetype="pdf")[0]
    assert abs(page.rect.width - 595) < 2 and abs(page.rect.height - 842) < 2  # A4 in points
    assert "Réseau" in page.get_text()
    assert [link["uri"] for link in page.get_links()] == ["https://linkedin.com/in/sarah"]
