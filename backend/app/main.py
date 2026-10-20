from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import oauth
from .auth.router import router as auth_router
from .config import get_settings
from .generation_router import router as generation_router
from .llm import LLMError
from .offer_router import router as offer_router
from .profile_router import router as profile_router

settings = get_settings()
app = FastAPI(title="MatchPilot API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(offer_router)
app.include_router(generation_router)


@app.exception_handler(LLMError)
async def llm_error_handler(_request: Request, exc: LLMError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm_model": settings.groq_model,
        "llm_key_configured": bool(settings.groq_api_key),
        "oauth_providers": oauth.enabled_providers(),
    }


def _todo():
    raise HTTPException(501, "Pas encore implémenté")


@app.post("/api/analyze")  # profil + offre -> score, compétences, mots-clés ATS
def analyze():
    _todo()


@app.post("/api/export/cover-letter")  # ExportLetterRequest -> fichier .docx
def export_cover_letter():
    _todo()
