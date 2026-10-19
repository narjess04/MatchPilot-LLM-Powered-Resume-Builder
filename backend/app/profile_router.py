import logging
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from .agents import cv_parser
from .auth.deps import get_current_user
from .config import get_settings
from .models import User
from .nlp import profile_warnings
from .parsing import ParsingError, extract_text
from .schemas import ProfileImportResponse

log = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.post("/import")
async def import_profile(
    file: UploadFile = File(...),
    source: Literal["cv", "linkedin-pdf"] = Form("cv"),
    _user: User = Depends(get_current_user),
) -> ProfileImportResponse:
    """Old CV / LinkedIn PDF / photo -> structured profile, with warnings on anything not found in the document."""
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"Fichier trop lourd ({get_settings().max_upload_mb} Mo maximum).")

    try:
        extracted = await extract_text(file.filename or "", data)
    except ParsingError as e:
        log.warning("Profile import rejected (%s, %d bytes): %s", file.filename, len(data), e)
        raise HTTPException(400, str(e)) from e

    profile = await cv_parser.parse_profile(extracted.text, source)
    return ProfileImportResponse(
        profile=cv_parser.to_profile_out(profile),
        method=extracted.method,
        warnings=profile_warnings(profile, extracted.text),
    )
