"""Text extraction from uploaded documents.

Strategy: read the embedded text first (exact, fast). OCR through the vision model is only
used for scanned PDFs and photos, where no text layer exists.
"""

import asyncio
import io
import math
import re
from dataclasses import dataclass
from typing import Literal

import pymupdf
from docx import Document

from . import llm

TEXT_EXT = {".pdf", ".docx", ".txt", ".md"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
SUPPORTED = TEXT_EXT | IMAGE_EXT

MAX_OCR_PAGES = 4
MIN_TEXT_CHARS = 200  # below this, a PDF is considered scanned
MAX_TEXT_CHARS = 60_000
OCR_DPI = 150

OCR_INSTRUCTION = (
    "Transcris fidèlement tout le texte de ce document, dans l'ordre de lecture "
    "(si la mise en page a plusieurs colonnes, transcris une colonne après l'autre). "
    "Conserve les accents, les dates, les adresses e-mail et les liens exactement. "
    "N'ajoute, ne résume et ne corrige rien. Réponds uniquement avec le texte transcrit."
)


class ParsingError(Exception):
    pass


@dataclass
class ExtractedText:
    text: str
    method: Literal["text", "ocr"]


def file_ext(filename: str) -> str:
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


async def extract_text(filename: str, data: bytes) -> ExtractedText:
    ext = file_ext(filename)
    if ext not in SUPPORTED:
        raise ParsingError(f"Format non supporté ({ext or 'inconnu'}). Utilisez PDF, DOCX, TXT ou une image.")

    if ext == ".pdf":
        doc = _open(data, "pdf")
        text = "\n".join(page.get_text() for page in doc).strip()
        if len(text) >= MIN_TEXT_CHARS:
            return _checked(ExtractedText(text, "text"))
        if doc.page_count > MAX_OCR_PAGES:
            raise ParsingError(f"Ce PDF scanné dépasse {MAX_OCR_PAGES} pages : envoyez la version Word ou PDF d'origine.")
        return _checked(await _ocr_pages(doc))

    if ext in IMAGE_EXT:
        return _checked(await _ocr_pages(_open(data, ext[1:])))

    if ext == ".docx":
        return _checked(ExtractedText(_docx_text(data), "text"))

    return _checked(ExtractedText(data.decode("utf-8", errors="replace").strip(), "text"))


def _open(data: bytes, filetype: str) -> pymupdf.Document:
    try:
        doc = pymupdf.open(stream=data, filetype=filetype)
    except Exception as e:
        raise ParsingError("Fichier illisible ou corrompu.") from e
    if doc.needs_pass:
        raise ParsingError("Ce PDF est protégé par un mot de passe.")
    return doc


async def _ocr_pages(doc: pymupdf.Document) -> ExtractedText:
    # Images are rendered to PNG at a fixed resolution so photos of any size are normalized
    pages = [page.get_pixmap(dpi=OCR_DPI).tobytes("png") for page in doc][:MAX_OCR_PAGES]
    texts = await asyncio.gather(*(llm.transcribe_image(png, OCR_INSTRUCTION) for png in pages))
    return ExtractedText("\n\n".join(t for t in texts if t).strip(), "ocr")


# --- Job offer screenshots ---

MAX_OFFER_SHOTS = 6
SLICE_RATIO = 1.4  # slice height / width: tall screenshots are cut so the model sees the text full size
SLICE_OVERLAP = 0.06  # share of a slice repeated in the next one, so no line is lost at a cut
MAX_SLICE_PX = 1568  # output width; larger images get downscaled by the model anyway
NO_OFFER = "AUCUNE_OFFRE"

OFFER_OCR_INSTRUCTION = (
    "Ces images sont des captures d'écran d'une offre d'emploi (site d'emploi, LinkedIn, page carrière…). "
    "Si plusieurs images sont fournies, ce sont des morceaux consécutifs de la même page, de haut en bas, "
    "qui se chevauchent légèrement : transcris chaque ligne une seule fois.\n"
    "Transcris mot pour mot, sans en omettre aucun (y compris le contenu entre parenthèses), le texte de "
    "l'offre : intitulé du poste, entreprise, lieu, type de contrat, salaire, présentation, missions, "
    "profil recherché, compétences, avantages, processus de recrutement.\n"
    "Ignore tout ce qui ne fait pas partie de l'annonce : menus, barre de recherche, boutons et liens "
    "d'action (Postuler, Candidature simplifiée, Enregistrer, Partager, Signaler…), bandeaux de cookies, "
    "publicités, offres similaires, suggestions de contacts, date de publication, nombre de candidats, "
    "pied de page.\n"
    "Conserve la langue d'origine, les accents, les chiffres et les intitulés exactement. Garde la structure : "
    "un titre de section par ligne et chaque élément de liste sur sa propre ligne précédé de « - ». "
    "N'ajoute, ne résume, ne traduis et ne corrige rien. Réponds uniquement avec le texte transcrit, sans markdown.\n"
    f"Si aucune offre d'emploi n'est lisible sur les images, réponds uniquement : {NO_OFFER}"
)


async def extract_offer_text(shots: list[tuple[str, bytes]]) -> str:
    """Screenshots of a job offer, in reading order -> text of the offer only (without the site's interface)."""
    if not shots:
        raise ParsingError("Ajoutez au moins une capture d'écran.")
    if len(shots) > MAX_OFFER_SHOTS:
        raise ParsingError(f"{MAX_OFFER_SHOTS} captures maximum.")
    slices = []
    for filename, data in shots:
        ext = file_ext(filename)
        if ext not in IMAGE_EXT:
            raise ParsingError(f"« {filename} » n'est pas une image (PNG, JPG ou WEBP).")
        slices.append(_slice_screenshot(data, ext[1:]))

    texts = await asyncio.gather(*(llm.read_screenshots(s, OFFER_OCR_INSTRUCTION) for s in slices))
    texts = [t.strip() for t in texts if t.strip() and t.strip() != NO_OFFER]
    if not texts:
        raise ParsingError("Aucune offre d'emploi lisible sur cette capture.")
    text = texts[0]
    for t in texts[1:]:
        text = merge_overlapping(text, t)
    if len(text) > MAX_TEXT_CHARS:
        raise ParsingError("Offre trop longue.")
    return text


def _slice_screenshot(data: bytes, filetype: str) -> list[bytes]:
    """One screenshot -> PNG slices of readable proportions (at most llm.MAX_IMAGES_PER_CALL)."""
    page = _open(data, filetype)[0]
    w, h = page.rect.width, page.rect.height
    # Page units depend on the image's DPI: zoom is computed from the real pixel width
    px_width = pymupdf.Pixmap(data).width
    zoom = min(px_width, MAX_SLICE_PX) / w

    slice_h = w * SLICE_RATIO
    step = slice_h * (1 - SLICE_OVERLAP)
    count = 1 if h <= slice_h else math.ceil((h - slice_h) / step) + 1
    if count > llm.MAX_IMAGES_PER_CALL:
        # Very long full-page capture: taller slices rather than more of them
        count = llm.MAX_IMAGES_PER_CALL
        slice_h = h / (count - (count - 1) * SLICE_OVERLAP)
        step = slice_h * (1 - SLICE_OVERLAP)

    matrix = pymupdf.Matrix(zoom, zoom)
    return [
        page.get_pixmap(matrix=matrix, clip=pymupdf.Rect(0, top, w, min(h, top + slice_h))).tobytes("png")
        for top in (i * step for i in range(count))
    ]


def merge_overlapping(first: str, second: str) -> str:
    """Join two transcriptions, dropping the lines repeated where consecutive screenshots overlap."""
    a, b = first.splitlines(), second.splitlines()
    key = lambda line: re.sub(r"\W+", "", line.lower())  # noqa: E731
    ka, kb = [key(x) for x in a], [key(x) for x in b]
    for n in range(min(len(a), len(b)), 0, -1):
        if ka[-n:] == kb[:n] and any(ka[-n:]):
            return "\n".join(a + b[n:])
    return f"{first}\n\n{second}"


def _docx_text(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
    except Exception as e:
        raise ParsingError("Fichier Word illisible.") from e
    lines = [p.text for p in doc.paragraphs if p.text.strip()]
    # Many CV templates put content in tables (often with merged cells repeated)
    for table in doc.tables:
        for row in table.rows:
            seen: set[str] = set()
            for cell in row.cells:
                if cell.text.strip() and cell.text not in seen:
                    seen.add(cell.text)
                    lines.append(cell.text)
    return "\n".join(lines).strip()


def _checked(result: ExtractedText) -> ExtractedText:
    if len(result.text) < 50:
        raise ParsingError("Aucun texte lisible n'a été trouvé dans ce document.")
    if len(result.text) > MAX_TEXT_CHARS:
        raise ParsingError("Document trop long pour un CV.")
    return result


# --- Example CV (template model) ---

EXAMPLE_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
EXAMPLE_WIDTH_PX = 1240  # the vision model needs to see rules and colours, not read small text
PREVIEW_WIDTH_PX = 360


SANS_FONTS = (
    "sans", "arial", "helvetica", "calibri", "carlito", "lato", "roboto", "segoe", "verdana", "tahoma", "inter",
    "montserrat", "poppins", "nunito", "raleway", "ubuntu", "futura", "gill", "avenir", "frutiger", "myriad", "aptos",
)
SERIF_FONTS = (
    "serif", "times", "georgia", "garamond", "cambria", "roman", "charis", "minion", "palatino", "antiqua",
    "baskerville", "caslon", "bodoni", "didot", "merriweather", "playfair", "crimson", "charter", "tinos", "constantia",
    "bookman", "century", "cmr", "lmroman",
)


def pdf_font_family(page: pymupdf.Page) -> Literal["serif", "sans"] | None:
    """Typeface family of a PDF page, from the names of the fonts that carry most of its text (None if unsure)."""
    chars = {"serif": 0, "sans": 0}
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                name = span["font"].split("+")[-1].lower().replace(" ", "").replace("-", "")
                # "sans" first: "NotoSansSerif"-like names do not exist, but "SourceSerif" and "DejaVuSans" do
                family = "sans" if any(f in name for f in SANS_FONTS) else "serif" if any(f in name for f in SERIF_FONTS) else None
                if family:
                    chars[family] += len(span["text"].strip())
    total = sum(chars.values())
    if total < 50:
        return None
    family = max(chars, key=chars.get)
    return family if chars[family] / total >= 0.6 else None


@dataclass
class ExamplePage:
    png: bytes  # first page, for the vision model
    preview: bytes  # small JPEG for the app
    font: Literal["serif", "sans"] | None  # read from the PDF's fonts; None for images


def example_first_page(filename: str, data: bytes) -> ExamplePage:
    ext = file_ext(filename)
    if ext not in EXAMPLE_EXT:
        raise ParsingError("Envoyez le CV exemple en PDF ou en image (PNG, JPG).")
    page = _open(data, ext[1:])[0]

    def render(width: int) -> pymupdf.Pixmap:
        zoom = width / page.rect.width
        return page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)

    return ExamplePage(
        png=render(EXAMPLE_WIDTH_PX).tobytes("png"),
        preview=render(PREVIEW_WIDTH_PX).tobytes("jpeg", jpg_quality=80),
        font=pdf_font_family(page) if ext == ".pdf" else None,
    )
