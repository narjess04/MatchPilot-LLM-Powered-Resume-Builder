"""Groq client helpers: schema-constrained JSON output and image transcription (OCR)."""

import base64
import json
import logging
import re
from typing import Any, TypeVar

import groq
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


async def _chat(**kwargs: Any) -> str:
    try:
        response = await get_client().chat.completions.create(**kwargs)
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
            content = await _chat(
                model=get_settings().groq_model, messages=messages, response_format=response_format, temperature=0
            )
            return schema.model_validate_json(content)
        except LLMError as e:
            if not _is_json_failure(e):
                raise
            log.warning("Structured output attempt %d/%d failed: %s", i, len(attempts), e.message[:200])
        except ValidationError as e:
            log.warning("Structured output attempt %d/%d invalid: %s", i, len(attempts), str(e)[:200])
    raise LLMError("Le modèle n'a pas réussi à structurer ce document, réessayez dans un instant.", 502)


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
