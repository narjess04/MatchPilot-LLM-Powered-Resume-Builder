"""LLM client helpers.

Groq: schema-constrained JSON output and OCR of scanned CVs.
OpenRouter: OCR of job offer screenshots (and later, writing).
"""

import asyncio
import base64
import json
import logging
import re
import time
from typing import Any, TypeVar

import groq
import httpx
from pydantic import BaseModel, ValidationError

from .config import get_settings

T = TypeVar("T", bound=BaseModel)
log = logging.getLogger("uvicorn.error")


class LLMError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_client: groq.AsyncGroq | None = None


def get_client() -> groq.AsyncGroq:
    global _client
    if _client is None:
        key = get_settings().groq_api_key
        if not key:
            raise LLMError("Clé API Groq manquante (GROQ_API_KEY dans backend/.env).", 503)
        _client = groq.AsyncGroq(api_key=key, timeout=90, max_retries=2)
    return _client


async def _chat(*, _no_retry: bool = False, **kwargs: Any) -> str:
    client = get_client().with_options(max_retries=0) if _no_retry else get_client()
    try:
        response = await client.chat.completions.create(**kwargs)
    except groq.AuthenticationError as e:
        # Not a 401: the user's own session is fine, the server's key is not
        raise LLMError("Clé API Groq invalide (backend/.env).", 502) from e
    except groq.RateLimitError as e:
        raise LLMError("Limite de requêtes Groq atteinte, réessayez dans un instant.", 429) from e
    except groq.BadRequestError as e:
        log.warning("Groq rejected the request: %s", e.message)
        raise LLMError(f"Requête refusée par Groq : {e.message}", 400) from e
    except groq.APIStatusError as e:
        raise LLMError(f"Erreur du service Groq ({e.status_code}).", 502) from e
    except groq.APIConnectionError as e:
        raise LLMError("Impossible de joindre Groq.", 503) from e

    choice = response.choices[0]
    if choice.finish_reason == "length":
        raise LLMError("Réponse du modèle tronquée (document trop long).", 502)
    # Some reasoning models may leave their thoughts inline
    return re.sub(r"<think>.*?</think>", "", choice.message.content or "", flags=re.S).strip()


async def _chat_with_fallback(**kwargs: Any) -> str:
    """Groq first (free tier); if it is saturated or down, the same model through OpenRouter (paid key)."""
    settings = get_settings()
    fallback = settings.openrouter_fallback_model if settings.openrouter_api_key else ""
    try:
        # With a fallback available, don't sit through Groq's rate-limit waits
        return await _chat(model=settings.groq_model, **({"_no_retry": True} if fallback else {}), **kwargs)
    except LLMError as e:
        if not fallback or e.status_code not in (429, 502, 503):
            raise
        log.warning("Groq unavailable (%s), falling back to OpenRouter %s", e.message, fallback)
    return await openrouter_chat(models=[fallback], **kwargs)


def strict_schema(model: type[BaseModel]) -> dict:
    """Pydantic JSON schema -> self-contained strict schema (no $ref, all fields required, no extras)."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, list):
            return [walk(x) for x in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return walk(defs[node["$ref"].rsplit("/", 1)[-1]])
        # Drop Pydantic's decorative "title"/"default" keywords, but keep fields that happen to be named "title"
        out = {k: walk(v) for k, v in node.items() if k not in ("title", "default", "properties")}
        if "properties" in node:
            out["properties"] = {name: walk(prop) for name, prop in node["properties"].items()}
        if out.get("type") == "object":
            out["additionalProperties"] = False
            out["required"] = list(out.get("properties", {}))
        return out

    return walk(schema)


def _is_json_failure(e: LLMError) -> bool:
    # Groq answers 400 "json_validate_failed" when the model's output breaks the enforced schema
    return e.status_code == 400 and ("json" in e.message.lower() or "schema" in e.message.lower())


async def structured(*, system: str, user: str, schema: type[T], name: str = "result") -> T:
    """Chat call constrained to `schema`.

    Two attempts in strict JSON-schema mode, then a fallback in plain JSON mode with the schema
    given in the prompt; every answer is validated with Pydantic before being returned.
    """
    json_schema = strict_schema(schema)
    strict_format = {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": json_schema}}
    fallback_system = (
        f"{system}\n\nAnswer with a single JSON object that matches exactly this JSON schema "
        f"(every property required):\n{json.dumps(json_schema, ensure_ascii=False)}"
    )
    attempts = [
        (system, strict_format),
        (system, strict_format),
        (fallback_system, {"type": "json_object"}),
    ]
    for i, (sys_prompt, response_format) in enumerate(attempts, 1):
        messages = [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user}]
        try:
            content = await _chat_with_fallback(messages=messages, response_format=response_format, temperature=0)
            return schema.model_validate_json(content)
        except LLMError as e:
            if not _is_json_failure(e):
                raise
            log.warning("Structured output attempt %d/%d failed: %s", i, len(attempts), e.message[:200])
        except ValidationError as e:
            log.warning("Structured output attempt %d/%d invalid: %s", i, len(attempts), str(e)[:200])
    raise LLMError("Le modèle n'a pas réussi à structurer ce document, réessayez dans un instant.", 502)


MAX_IMAGES_PER_CALL = 5  # slices of one screenshot sent together

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_TIMEOUT = 90
WRITING_TIMEOUT = 180
REASONING_ROOM = 8000  # tokens the writing model may spend reasoning before its answer
MAX_WRITING_TOKENS = 4000  # a full tailored CV is ~1.2k tokens of JSON
_http: httpx.AsyncClient | None = None


async def openrouter_chat(
    *, models: list[str], messages: list[dict], timeout: float = OPENROUTER_TIMEOUT, **kwargs: Any
) -> str:
    """Chat call through OpenRouter; the next model in `models` is used if the first one fails or is saturated."""
    key = get_settings().openrouter_api_key
    if not key:
        raise LLMError("Clé API OpenRouter manquante (OPENROUTER_API_KEY dans backend/.env).", 503)
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT)
    body = {
        "models": models,
        "messages": messages,
        # Default routing can land on a slow host that ignores response_format: only hosts that honour every
        # parameter, fastest first
        "provider": {"require_parameters": True, "sort": "latency"},
        **kwargs,
    }
    started = time.monotonic()
    try:
        # Overall deadline: OpenRouter keeps the connection alive while queued, so read timeouts never fire
        response = await asyncio.wait_for(
            _http.post(OPENROUTER_URL, json=body, headers={"Authorization": f"Bearer {key}"}, timeout=timeout), timeout
        )
    except TimeoutError as e:
        raise LLMError("Le service de génération ne répond pas, réessayez dans un instant.", 504) from e
    except httpx.HTTPError as e:
        raise LLMError("Impossible de joindre OpenRouter.", 503) from e

    data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if response.status_code != 200 or "choices" not in data:
        message = (data.get("error") or {}).get("message", "")
        log.warning("OpenRouter error %s: %s", response.status_code, message or response.text[:200])
        if response.status_code == 401:
            raise LLMError("Clé API OpenRouter invalide (backend/.env).", 502)
        if response.status_code == 402:
            raise LLMError("Crédit OpenRouter épuisé.", 502)
        if response.status_code == 429:
            raise LLMError("Service de lecture saturé, réessayez dans un instant.", 429)
        raise LLMError(f"Erreur du service OpenRouter ({response.status_code}).", 502)

    usage = data.get("usage") or {}
    log.info(
        "OpenRouter %s: %.1fs, %s tokens out (%s reasoning)", data.get("model"), time.monotonic() - started,
        usage.get("completion_tokens"), (usage.get("completion_tokens_details") or {}).get("reasoning_tokens"),
    )
    choice = data["choices"][0]
    if choice.get("finish_reason") == "length":
        raise LLMError("Réponse du modèle tronquée (document trop long).", 502)
    return re.sub(r"<think>.*?</think>", "", choice["message"].get("content") or "", flags=re.S).strip()


async def write_structured(
    *, system: str, user: str, schema: type[T], temperature: float, name: str = "result",
    max_output: int = MAX_WRITING_TOKENS, attempts: int = 2, timeout: float = WRITING_TIMEOUT,
) -> T:
    """Writing call (OpenRouter writing model) constrained to `schema`, validated with Pydantic.

    Optional passes (with a fallback of their own) use attempts=1 and a shorter timeout: the writing model
    sometimes reasons for minutes, and retrying the same call rarely helps.
    """
    response_format = {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": strict_schema(schema)}}
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    model = get_settings().openrouter_model
    if not model:
        raise LLMError("Modèle de rédaction manquant (OPENROUTER_MODEL dans backend/.env).", 503)
    for attempt in range(1, attempts + 1):
        try:
            content = await openrouter_chat(
                models=[model], messages=messages, response_format=response_format, temperature=temperature,
                # The writing model always reasons and its host ignores reasoning budgets: "low" effort keeps it
                # around 1k reasoning tokens (default effort: ~9k, 4 min per CV); the room left for reasoning in
                # max_tokens absorbs the occasional long one instead of cutting the answer
                reasoning={"effort": get_settings().openrouter_reasoning_effort}, timeout=timeout,
                max_tokens=REASONING_ROOM + max_output,
            )
        except LLMError as e:
            if attempt == attempts or e.status_code != 502:
                raise
            log.warning("Writing attempt %d/%d failed (%s), retrying", attempt, attempts, e.message)
            continue
        try:
            return schema.model_validate_json(content)
        except ValidationError as e:
            log.warning("Writing output attempt %d/%d invalid: %s", attempt, attempts, str(e)[:200])
    raise LLMError("Le modèle de rédaction a renvoyé une réponse invalide, réessayez.", 502)


async def look_structured(png: bytes, instruction: str, schema: type[T], name: str = "result") -> T:
    """Vision call (OpenRouter vision models) answering about one image with JSON constrained to `schema`."""
    response_format = {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": strict_schema(schema)}}
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(png).decode()}}
    for attempt in (1, 2):
        content = await openrouter_chat(
            models=get_settings().openrouter_vision_models,
            messages=[{"role": "user", "content": [{"type": "text", "text": instruction}, image]}],
            response_format=response_format, temperature=0,
        )
        try:
            return schema.model_validate_json(content)
        except ValidationError as e:
            log.warning("Vision output attempt %d/2 invalid: %s", attempt, str(e)[:200])
    raise LLMError("La mise en page de l'exemple n'a pas pu être analysée, réessayez.", 502)


async def read_screenshots(pngs: list[bytes], instruction: str) -> str:
    """OCR of screenshots through OpenRouter vision models (no per-minute token cap, unlike Groq's free tier)."""
    if not 1 <= len(pngs) <= MAX_IMAGES_PER_CALL:
        raise ValueError(f"read_screenshots takes 1 to {MAX_IMAGES_PER_CALL} images")
    images = [
        {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(png).decode()}}
        for png in pngs
    ]
    return await openrouter_chat(
        models=get_settings().openrouter_vision_models,
        messages=[{"role": "user", "content": [{"type": "text", "text": instruction}, *images]}],
        temperature=0,
    )


async def transcribe_image(png: bytes, instruction: str) -> str:
    """OCR through the vision model: returns the text read on the image."""
    url = "data:image/png;base64," + base64.b64encode(png).decode()
    return await _chat(
        model=get_settings().groq_vision_model,
        messages=[{
            "role": "user",
            "content": [{"type": "text", "text": instruction}, {"type": "image_url", "image_url": {"url": url}}],
        }],
        temperature=0,
    )
