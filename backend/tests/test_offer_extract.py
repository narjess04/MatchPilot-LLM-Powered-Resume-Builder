"""Job offer screenshots -> text. The vision model is replaced by a fake: these tests check the plumbing."""

import pymupdf
import pytest

from app import llm, parsing

from .test_auth import client, register  # noqa: F401  (fixture reuse)


def screenshot(width: int, height: int, text: str = "Développeur React (H/F)") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=width, height=height)
    page.insert_text((20, 40), text, fontsize=14)
    return page.get_pixmap().tobytes("png")


def size(png: bytes) -> tuple[int, int]:
    pix = pymupdf.Pixmap(png)
    return pix.width, pix.height


@pytest.fixture
def fake_vision(monkeypatch):
    calls: list[int] = []
    answers: list[str] = []

    async def fake_read(pngs, instruction):
        calls.append(len(pngs))
        return answers.pop(0)

    monkeypatch.setattr(llm, "read_screenshots", fake_read)
    return calls, answers


# ---------- slicing ----------


def test_regular_screenshot_is_sent_whole():
    slices = parsing._slice_screenshot(screenshot(1280, 800), "png")
    assert [size(s) for s in slices] == [(1280, 800)]


def test_tall_screenshot_is_cut_in_overlapping_slices():
    slices = parsing._slice_screenshot(screenshot(800, 2600), "png")
    assert len(slices) == 3
    widths, heights = zip(*(size(s) for s in slices))
    assert set(widths) == {800}
    # Overlap: the slices cover more than the page
    assert sum(heights) > 2600


def test_very_long_capture_is_capped_to_one_request():
    slices = parsing._slice_screenshot(screenshot(400, 9000), "png")
    assert len(slices) == llm.MAX_IMAGES_PER_CALL
    assert sum(size(s)[1] for s in slices) >= 9000


def test_wide_screenshot_is_downscaled():
    (s,) = parsing._slice_screenshot(screenshot(2400, 1200), "png")
    assert size(s) == (parsing.MAX_SLICE_PX, 784)


# ---------- merging consecutive screenshots ----------


def test_merge_drops_lines_repeated_by_the_overlap():
    first = "Missions\n- Développer en React\n- Écrire des tests"
    second = "- Écrire des tests\nProfil\n- Bac+5"
    assert parsing.merge_overlapping(first, second) == (
        "Missions\n- Développer en React\n- Écrire des tests\nProfil\n- Bac+5"
    )


def test_merge_ignores_punctuation_differences_in_the_overlap():
    merged = parsing.merge_overlapping("Profil\n- Bac+5 en informatique.", "- Bac+5 en informatique\nAvantages")
    assert merged == "Profil\n- Bac+5 en informatique.\nAvantages"


def test_merge_without_overlap_keeps_both():
    assert parsing.merge_overlapping("A\nB", "C\nD") == "A\nB\n\nC\nD"


# ---------- route ----------


def post(client, *images):
    return client.post("/api/offer/extract", files=[("images", img) for img in images])


def test_extract_requires_session(client):
    assert post(client, ("a.png", screenshot(400, 300), "image/png")).status_code == 401


def test_extract_reads_screenshots_in_order(client, fake_vision):
    calls, answers = fake_vision
    answers += ["Développeur React\nMissions\n- Coder", "- Coder\nProfil\n- Bac+5"]
    register(client)
    r = post(client, ("1.png", screenshot(1280, 800), "image/png"), ("2.png", screenshot(1280, 800), "image/png"))
    assert r.status_code == 200
    assert r.json() == {"text": "Développeur React\nMissions\n- Coder\nProfil\n- Bac+5"}
    assert calls == [1, 1]


def test_extract_skips_screenshots_without_offer(client, fake_vision):
    _, answers = fake_vision
    answers += [parsing.NO_OFFER, "Data Engineer\n- Airflow"]
    register(client)
    r = post(client, ("1.png", screenshot(400, 300), "image/png"), ("2.png", screenshot(400, 300), "image/png"))
    assert r.json()["text"] == "Data Engineer\n- Airflow"


def test_extract_rejects_image_without_offer(client, fake_vision):
    fake_vision[1].append(parsing.NO_OFFER)
    register(client)
    r = post(client, ("1.png", screenshot(400, 300), "image/png"))
    assert r.status_code == 400
    assert "Aucune offre" in r.json()["detail"]


def test_extract_rejects_non_images(client, fake_vision):
    register(client)
    r = post(client, ("offre.pdf", b"%PDF-1.7", "application/pdf"))
    assert r.status_code == 400
    assert fake_vision[0] == []


def test_extract_limits_number_of_screenshots(client, fake_vision):
    register(client)
    shot = ("1.png", screenshot(200, 200), "image/png")
    r = post(client, *[shot] * (parsing.MAX_OFFER_SHOTS + 1))
    assert r.status_code == 400
    assert fake_vision[0] == []
