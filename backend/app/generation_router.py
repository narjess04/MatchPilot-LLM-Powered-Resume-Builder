import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from .agents import cover_letter, cv_writer
from .auth.deps import get_current_user
from .models import User
from .pdf import PdfError, html_to_pdf
from .schemas import CoverLetterRequest, CoverLetterResponse, PdfRequest, TailorRequest, TailorResponse

router = APIRouter(prefix="/api", tags=["generation"])


@router.post("/tailor-cv")
async def tailor_cv(body: TailorRequest, _user: User = Depends(get_current_user)) -> TailorResponse:
    """Profile + offer analysis -> CV rewritten for the offer, in the chosen language, with fact checks."""
    return await cv_writer.tailor_cv(body.profile, body.job, body.lang)


@router.post("/cover-letter")
async def write_cover_letter(body: CoverLetterRequest, _user: User = Depends(get_current_user)) -> CoverLetterResponse:
    """Profile + offer analysis (+ the candidate's notes) -> cover letter in the chosen language."""
    return await cover_letter.write_letter(body.profile, body.job, body.lang, body.notes)


@router.post("/export/cv-pdf")
async def export_cv_pdf(body: PdfRequest, _user: User = Depends(get_current_user)) -> Response:
    """CV page rendered by the app (HTML) -> A4 PDF file, with real text and clickable links."""
    try:
        pdf = await html_to_pdf(body.html)
    except PdfError as e:
        raise HTTPException(400 if "lourd" in str(e) else 503, str(e)) from e
    name = re.sub(r"[^\w-]+", "", body.filename.replace(" ", "-")) or "CV"
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})
