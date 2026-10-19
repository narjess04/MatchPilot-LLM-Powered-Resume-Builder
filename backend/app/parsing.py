"""Text extraction from uploaded documents.

Strategy: read the embedded text first (exact, fast). OCR through the vision model is only
used for scanned PDFs and photos, where no text layer exists.
"""

import asyncio
import io
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
