"""Profile import pipeline. The LLM is replaced by fakes: these tests check the plumbing, not the model."""

import io

import pymupdf
import pytest
from docx import Document

from app import llm
from app.agents import cv_parser
from app.nlp import profile_warnings
from app.schemas import (
    ExtractedAssociation, ExtractedEducation, ExtractedExperience, ExtractedLanguage, ExtractedProfile, ExtractedProject, ExtractedSkillGroup,
)

from .test_auth import client, register  # noqa: F401  (fixture reuse)

CV_TEXT = (
    "Sarah Ben Ali\nsarah.benali@email.com · +216 20 123 456 · Tunis\n"
    "EXPÉRIENCE\nStagiaire développeuse web — WebNova\n02/2025 – 07/2025\n"
    "Développement de l'interface React du site de l'entreprise\n"
    "FORMATION\nDiplôme d'ingénieur en génie logiciel — École Supérieure d'Ingénierie de Tunis\n"
    "COMPÉTENCES\nReact, Node.js, SQL\nLANGUES\nFrançais : courant\n"
)


def sample_profile(**overrides) -> ExtractedProfile:
    data = dict(
        full_name="Sarah Ben Ali", headline="", email="sarah.benali@email.com", phone="+216 20 123 456",
        location="Tunis", linkedin="linkedin.com/in/sarah\u2011benali", website="", summary="",
        experiences=[ExtractedExperience(
            title="Stagiaire développeuse web", company="WebNova", location="", start="02/2025", end="07/2025",
            bullets=["Développement de l'interface React du site de l'entreprise"],
        )],
        education=[ExtractedEducation(
            degree="Diplôme d'ingénieur en génie logiciel", institution="École Supérieure d'Ingénierie de Tunis",
            location="", start="", end="", details=[],
        )],
        projects=[ExtractedProject(
            name="MediBook", technologies=["React", "PostgreSQL"], link="github.com/sarah/medibook", description=["App web", "API REST"],
        )],
        skills=[ExtractedSkillGroup(category="", items=["React", "Node.js", "SQL"])],
        languages=[ExtractedLanguage(language="Français", level="courant")],
        hackathons=[], associations=[], interests=[],
    )
    data.update(overrides)
    return ExtractedProfile(**data)


def pdf_with_text(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(40, 40, 560, 800), text, fontsize=10)
    return doc.tobytes()


def image_only_pdf() -> bytes:
    src = pymupdf.open()
    src.new_page().insert_textbox(pymupdf.Rect(40, 40, 560, 800), CV_TEXT, fontsize=10)
    png = src[0].get_pixmap(dpi=100).tobytes("png")
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_image(page.rect, stream=png)
    return doc.tobytes()


@pytest.fixture
def fake_llm(monkeypatch):
    calls = {"structured": [], "ocr": 0}

    async def fake_structured(*, system, user, schema, name="result"):
        calls["structured"].append(user)
        return sample_profile()

    async def fake_ocr(png, instruction):
        calls["ocr"] += 1
        return CV_TEXT

    monkeypatch.setattr(llm, "structured", fake_structured)
    monkeypatch.setattr(llm, "transcribe_image", fake_ocr)
    return calls


def upload(client, name: str, data: bytes, source: str = "cv"):  # noqa: F811
    return client.post("/api/profile/import", files={"file": (name, data)}, data={"source": source})


# ---------- endpoint ----------


def test_requires_login(client, fake_llm):  # noqa: F811
    assert upload(client, "cv.txt", CV_TEXT.encode()).status_code == 401


def test_text_pdf_uses_text_layer(client, fake_llm):  # noqa: F811
    register(client)
    r = upload(client, "cv.pdf", pdf_with_text(CV_TEXT))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["method"] == "text"
    assert fake_llm["ocr"] == 0
    assert "WebNova" in fake_llm["structured"][0]
    p = body["profile"]
    assert p["experiences"][0]["bullets"] == "Développement de l'interface React du site de l'entreprise"
    assert p["projects"][0] == {
        "name": "MediBook", "technologies": "React, PostgreSQL", "link": "github.com/sarah/medibook", "description": "App web\nAPI REST",
    }
    assert p["skills"] == [{"category": "", "items": ["React", "Node.js", "SQL"]}]
    assert p["linkedin"] == "linkedin.com/in/sarah-benali"  # typographic hyphen normalized


def test_scanned_pdf_goes_through_ocr(client, fake_llm):  # noqa: F811
    register(client)
    r = upload(client, "scan.pdf", image_only_pdf())
    assert r.status_code == 200, r.text
    assert r.json()["method"] == "ocr"
    assert fake_llm["ocr"] == 1


def test_docx_and_linkedin_source(client, fake_llm):  # noqa: F811
    register(client)
    doc = Document()
    for line in CV_TEXT.splitlines():
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    r = upload(client, "cv.docx", buf.getvalue(), source="linkedin-pdf")
    assert r.status_code == 200, r.text
    assert "LinkedIn profile" in fake_llm["structured"][0]


def test_rejects_unsupported_and_empty_files(client, fake_llm):  # noqa: F811
    register(client)
    assert upload(client, "cv.exe", b"MZ...").status_code == 400
    assert upload(client, "cv.txt", b"  ").status_code == 400


# ---------- anti-invention check ----------


def test_no_warning_when_everything_is_in_the_source():
    assert profile_warnings(sample_profile(), CV_TEXT) == []


def test_warns_about_invented_items():
    invented = sample_profile(
        experiences=[ExtractedExperience(title="Lead Developer", company="Google", location="", start="", end="", bullets=[])],
        skills=[ExtractedSkillGroup(category="Outils", items=["React", "Kubernetes"])],
    )
    warnings = profile_warnings(invented, CV_TEXT)
    assert any("Google" in w for w in warnings)
    assert any("Kubernetes" in w and "React" not in w for w in warnings)


def test_matching_ignores_accents_and_punctuation():
    p = sample_profile(skills=[ExtractedSkillGroup(category="", items=["node js", "Developpement"])])
    warnings = profile_warnings(p, CV_TEXT + "\nNode.js — Développement")
    assert not any("Compétences" in w for w in warnings)


def test_strict_schema_keeps_fields_named_title():
    schema = llm.strict_schema(ExtractedProfile)
    exp = schema["properties"]["experiences"]["items"]
    assert "title" in exp["properties"] and "title" in exp["required"]
    assert exp["additionalProperties"] is False
    assert "$defs" not in schema


def test_to_profile_out_dedupes_skills():
    out = cv_parser.to_profile_out(sample_profile(skills=[
        ExtractedSkillGroup(category="Langages", items=["React", "React", " SQL "]),
        ExtractedSkillGroup(category="Vide", items=[" "]),
    ]))
    assert out.skills == [{"category": "Langages", "items": ["React", "SQL"]}]


def test_project_link_restored_from_document():
    fixed = cv_parser.restore_contacts(sample_profile(), CV_TEXT + "\nhttps://github.com/sarah/medibook")
    assert fixed.projects[0].link == "https://github.com/sarah/medibook"


def test_contact_fields_restored_from_document():
    p = sample_profile(email="sarah.benali@email.com", linkedin="linkedin.com/in/sarah\u00adbenali", website="")
    source = CV_TEXT + "\nhttps://www.linkedin.com/in/sarah-benali"
    fixed = cv_parser.restore_contacts(p, source)
    assert fixed.linkedin == "https://www.linkedin.com/in/sarah-benali"
    assert fixed.email == "sarah.benali@email.com"
    assert fixed.website == ""


def test_optional_sections_enabled_only_when_present():
    empty = cv_parser.to_profile_out(sample_profile())
    assert empty.sections == {"hackathons": False, "associations": False, "interests": False}
    full = cv_parser.to_profile_out(sample_profile(
        associations=[ExtractedAssociation(organization="GDSC", role="Membre", start="2023", end="2025", description=["Ateliers"])],
        interests=["Randonnée"],
    ))
    assert full.sections == {"hackathons": False, "associations": True, "interests": True}
    assert full.associations[0]["description"] == "Ateliers"


# ---------- resilience of structured output ----------


@pytest.mark.anyio
async def test_structured_retries_then_falls_back_to_json_mode(monkeypatch):
    calls = []

    async def fake_chat(**kwargs):
        calls.append(kwargs["response_format"]["type"])
        if kwargs["response_format"]["type"] == "json_schema":
            raise llm.LLMError("Requête refusée par Groq : json_validate_failed", 400)
        return sample_profile().model_dump_json()

    monkeypatch.setattr(llm, "_chat", fake_chat)
    result = await llm.structured(system="s", user="u", schema=ExtractedProfile)
    assert result.full_name == "Sarah Ben Ali"
    assert calls == ["json_schema", "json_schema", "json_object"]


@pytest.mark.anyio
async def test_structured_does_not_retry_other_errors(monkeypatch):
    async def fake_chat(**kwargs):
        raise llm.LLMError("Limite de requêtes Groq atteinte", 429)

    monkeypatch.setattr(llm, "_chat", fake_chat)
    with pytest.raises(llm.LLMError) as err:
        await llm.structured(system="s", user="u", schema=ExtractedProfile)
    assert err.value.status_code == 429
