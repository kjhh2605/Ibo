"""Metadata-only logging; opt-in text is projected, never a provider dump."""
import json
import logging
import math
import re

from pydantic import TypeAdapter
from app.errors import BODY_LIMITS
from app.schemas import SearchTurnResponse

_LOG = logging.getLogger('street_fitting.relay')
# Conservative omission is preferable to leaking location or opaque payloads.
_UNSAFE = re.compile(
    r'(?i)(?:\b(?:lat(?:itude)?|lon(?:gitude)?|lng|coordinates|gps|authorization|bearer|querytoken|appcheck|api[_ -]?key)\b|'
    r'https?://|data:|file:|[+-]?\d{1,3}(?:\.\d+)?\s*[,;/]\s*[+-]?\d{1,3}(?:\.\d+)?|'
    r'[+-]?\d{1,3}\.\d+\s+[+-]?\d{1,3}\.\d+|'
    r'\b\d{1,3}(?:\.\d+)?\s*[°º]\s*\d|\b\d{1,3}(?:\.\d+)?\s*(?:[°º]\s*)?[NSEW]\b|'
    r'[A-Za-z0-9_+/=-]{40,}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)'
)


def configure_logging():
    # urllib3/httpx access messages may embed OSRM coordinates. No SDK tracing.
    for name in ('httpx', 'httpcore', 'urllib3', 'firebase_admin', 'google.auth', 'uvicorn.access'):
        logger = logging.getLogger(name)
        logger.disabled = True
        logger.propagate = False
        logger.handlers.clear()
        logger.addHandler(logging.NullHandler())


def safe_text(value):
    if not isinstance(value, str) or len(value) > 2000 or _UNSAFE.search(value):
        return None
    return value


def log_request(*, endpoint, pseudonymous_id, latency_ms, status_code, spark_turns=None):
    record = {
        'endpoint': endpoint if endpoint in BODY_LIMITS else 'unknown',
        'pseudonymousId': pseudonymous_id if isinstance(pseudonymous_id, str) and re.fullmatch('[0-9a-f]{64}', pseudonymous_id) else None,
        'latencyMs': round(max(0, latency_ms), 3) if isinstance(latency_ms, (int, float)) and math.isfinite(latency_ms) else 0,
        'statusCode': status_code if type(status_code) is int and 100 <= status_code <= 599 else 500,
        'sparkTurns': spark_turns if type(spark_turns) is int and 0 <= spark_turns <= 4 else None,
    }
    _LOG.info(json.dumps(record, separators=(',', ':')))


def log_search_text(settings, *, query=None, response=None):
    if not settings.log_text:
        return
    record = {}
    text = safe_text(query)
    if text is not None:
        record['queryText'] = text
    if response is not None:
        try:
            validated = TypeAdapter(SearchTurnResponse).validate_python(response).model_dump(mode='json', exclude_none=True)
        except Exception:
            validated = {}
        # Only meaningful language fields; refs/vectors/tokens never enter logs.
        texts = {}
        for key in ('final', 'not_found'):
            if key in validated:
                for field in ('summary', 'concept', 'reason'):
                    text = safe_text(validated[key].get(field))
                    if text is not None:
                        texts[field] = text
        for call in validated.get('toolCalls', []):
            texts['tool'] = call['name']
            for field in ('phrase', 'concept'):
                text = safe_text(call['arguments'].get(field))
                if text is not None:
                    texts[field] = text
        if texts:
            record['sparkText'] = texts
    if record:
        _LOG.info(json.dumps(record, separators=(',', ':')))
