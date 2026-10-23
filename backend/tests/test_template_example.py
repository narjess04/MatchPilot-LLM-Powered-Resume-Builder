"""Template from an example CV. The vision model is replaced by a fake: these tests check the rendering and the guards."""

import pymupdf
import pytest

from app import llm
from app.agents import layout_reader
from app.schemas import ExampleStyle

from .test_auth import client, register  # noqa: F401  (fixture reuse)


def style(**overrides) -> ExampleStyle:
    data = dict(
        font="serif", header_align="center", name_size="large", name_uppercase=True, accent="#1f3a68",
        name_in_accent=True, headings_in_accent=True, heading_style="underline", heading_uppercase=True,
        density="normal", photo="none", two_columns=False, description="Style sobre en serif.",
    )
    return ExampleStyle(**{**data, **overrides})


def example_pdf(font: str = "sans-serif") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    text = "Sarah Ben Ali, ingénieure logiciel. Expérience : stage de développement web chez WebNova."
    page.insert_htmlbox(pymupdf.Rect(50, 50, 545, 400), f'<p style="font-family: {font}">{text}</p>')
    return doc.tobytes()


@pytest.fixture
def fake_vision(monkeypatch):
    answer = {"style": style(), "pngs": []}

    async def fake(png, instruction, schema, name="result"):
        assert schema is ExampleStyle
        answer["pngs"].append(png)
        return answer["style"]

    monkeypatch.setattr(llm, "look_structured", fake)
    return answer


@pytest.mark.anyio
async def test_example_page_is_sent_as_an_image_and_previewed(fake_vision):
    result = await layout_reader.read_example("cv.pdf", example_pdf())
    assert fake_vision["pngs"][0].startswith(b"\x89PNG")
    assert result.preview.startswith("data:image/jpeg;base64,")
    assert result.style.accent == "#1f3a68" and result.notes == []


@pytest.mark.anyio
async def test_the_pdf_fonts_decide_the_typeface(fake_vision):
    fake_vision["style"] = style(font="sans")
    assert (await layout_reader.read_example("cv.pdf", example_pdf("serif"))).style.font == "serif"
    fake_vision["style"] = style(font="serif")
    assert (await layout_reader.read_example("cv.pdf", example_pdf("sans-serif"))).style.font == "sans"


def test_light_or_invalid_accents_become_readable():
    assert layout_reader.clean_style(style(accent="bleu")).style.accent == layout_reader.DEFAULT_ACCENT
    light = layout_reader.clean_style(style(accent="#a8d8ff")).style.accent
    assert light != "#a8d8ff" and light.startswith("#") and len(light) == 7


def test_two_column_examples_are_explained():
    notes = layout_reader.clean_style(style(two_columns=True)).notes
    assert len(notes) == 1 and "une seule colonne" in notes[0]


def test_example_route(client, fake_vision):
    files = {"file": ("cv.pdf", example_pdf(), "application/pdf")}
    assert client.post("/api/template/from-example", files=files).status_code == 401
    register(client)
    r = client.post("/api/template/from-example", files=files)
    assert r.status_code == 200
    assert r.json()["style"]["accent"] == "#1f3a68"


def test_example_route_rejects_word_files(client, fake_vision):
    register(client)
    r = client.post("/api/template/from-example", files={"file": ("cv.docx", b"PK..", "application/octet-stream")})
    assert r.status_code == 400
    assert fake_vision["pngs"] == []
