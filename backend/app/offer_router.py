import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .agents import job_analyzer
from .auth.deps import get_current_user
from .config import get_settings
from .models import User
from .parsing import ParsingError, extract_offer_text
from .schemas import JobAnalysis, OfferAnalyzeRequest, OfferExtractResponse

log = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/offer", tags=["offer"])


@router.post("/extract")
async def extract_offer(
    images: list[UploadFile] = File(...),
    _user: User = Depends(get_current_user),
) -> OfferExtractResponse:
    """Screenshots of a job offer (in reading order) -> text of the offer, without the site's interface."""
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    shots = []
    for image in images:
        data = await image.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise HTTPException(413, f"Image trop lourde ({get_settings().max_upload_mb} Mo maximum).")
        shots.append((image.filename or "", data))

    try:
        text = await extract_offer_text(shots)
    except ParsingError as e:
        log.warning("Offer extraction rejected (%d images): %s", len(shots), e)
        raise HTTPException(400, str(e)) from e
    return OfferExtractResponse(text=text)


@router.post("/analyze")
async def analyze_offer(body: OfferAnalyzeRequest, _user: User = Depends(get_current_user)) -> JobAnalysis:
    """Text of the offer -> structured analysis (skills, ATS keywords, requirements)."""
    return await job_analyzer.analyze_job(body.text.strip())
