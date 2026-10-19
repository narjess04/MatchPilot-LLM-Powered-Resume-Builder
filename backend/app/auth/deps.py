from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from .security import SESSION_COOKIE, read_session_token


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Dependency for routes that require a signed-in user."""
    token = request.cookies.get(SESSION_COOKIE)
    user_id = read_session_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=401, detail="Vous n'êtes pas connecté.")
    return user
