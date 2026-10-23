import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .agents import layout_reader
from .auth.deps import get_current_user
from .config import get_settings
from .models import User
from .parsing import ParsingError
from .schemas import ExampleStyleResponse

log = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/template", tags=["template"])


@router.post("/from-example")
async def template_from_example(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> ExampleStyleResponse:
    """Example CV the candidate likes (PDF or image) -> its visual style, used by the "Mon modèle" template."""
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"Fichier trop lourd ({get_settings().max_upload_mb} Mo maximum).")
    try:
        return await layout_reader.read_example(file.filename or "", data)
    except ParsingError as e:
        log.warning("Example CV rejected (%s, %d bytes): %s", file.filename, len(data), e)
        raise HTTPException(400, str(e)) from e
