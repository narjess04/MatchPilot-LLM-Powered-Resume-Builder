from fastapi import APIRouter, Depends

from .agents import cover_letter, cv_writer
from .auth.deps import get_current_user
from .models import User
from .schemas import CoverLetterRequest, CoverLetterResponse, TailorRequest, TailorResponse

router = APIRouter(prefix="/api", tags=["generation"])


@router.post("/tailor-cv")
async def tailor_cv(body: TailorRequest, _user: User = Depends(get_current_user)) -> TailorResponse:
    """Profile + offer analysis -> CV rewritten for the offer, in the chosen language, with fact checks."""
    return await cv_writer.tailor_cv(body.profile, body.job, body.lang)


@router.post("/cover-letter")
async def write_cover_letter(body: CoverLetterRequest, _user: User = Depends(get_current_user)) -> CoverLetterResponse:
    """Profile + offer analysis (+ the candidate's notes) -> cover letter in the chosen language."""
    return await cover_letter.write_letter(body.profile, body.job, body.lang, body.notes)
