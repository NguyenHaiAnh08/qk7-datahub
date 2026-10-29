"""
metrics.py — Prometheus metrics cho boxchat QK7.
Tracking: request rate, latency, LLM fallback, citation quality, Ollama health.
"""
from prometheus_client import (
    Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
)
from fastapi import Response

# ─── Request metrics ───
REQUEST_TOTAL = Counter(
    'boxchat_requests_total',
    'Total requests to boxchat endpoints',
    ['endpoint', 'status', 'retrieval_mode']
)

REQUEST_DURATION = Histogram(
    'boxchat_request_duration_seconds',
    'Request duration by endpoint',
    ['endpoint'],
    buckets=[0.5, 1, 2, 5, 10, 20, 30, 60, 120]
)

# ─── LLM metrics ───
LLM_FALLBACK_TOTAL = Counter(
    'boxchat_llm_fallback_total',
    'LLM fallback to extractive by reason',
    ['reason']  # ollama_unreachable | answer_too_short | timeout | unknown
)

LLM_SYNTHESIS_MODE = Counter(
    'boxchat_synthesis_mode_total',
    'Synthesis mode used',
    ['mode']  # llm | extractive
)

ANSWER_LENGTH = Histogram(
    'boxchat_answer_length_chars',
    'Answer length in chars',
    buckets=[50, 100, 200, 500, 1000, 2000, 5000]
)

# ─── Citation quality ───
CITATIONS_EMITTED = Counter(
    'boxchat_citations_emitted_total',
    'Total inline citations emitted by LLM'
)

CITATIONS_FABRICATED = Counter(
    'boxchat_citations_fabricated_total',
    'Fabricated citations removed by _verify_inline_citations'
)

CITATIONS_VALID = Counter(
    'boxchat_citations_valid_total',
    'Valid citations passed verification'
)

# ─── Security metrics ───
BIOMETRIC_BLOCKS = Counter(
    'boxchat_biometric_blocks_total',
    'Requests blocked by Biometric Guard (Cấp 3-5 chưa quét vân tay)'
)

CLEARANCE_LEAKS = Counter(
    'boxchat_clearance_leaks_total',
    'CRITICAL: Clearance leaks detected (should always be 0)'
)

ADVERSARIAL_REFUSALS = Counter(
    'boxchat_adversarial_refusals_total',
    'Adversarial queries properly refused'
)

# ─── System health gauges ───
OLLAMA_UP = Gauge(
    'boxchat_ollama_up',
    'Is Ollama reachable (1=up, 0=down)'
)

QDRANT_UP = Gauge(
    'boxchat_qdrant_up',
    'Is Qdrant client initialized (1=up, 0=fallback to BM25)'
)

TOTAL_CHUNKS = Gauge(
    'boxchat_total_chunks',
    'Total chunks in vector store'
)

ACTIVE_MODEL = Gauge(
    'boxchat_model_info',
    'Model info (labels carry details)',
    ['model_name', 'model_size']
)


def update_system_gauges(vector_store, agent_tutor):
    """Cập nhật các gauge từ state thực tế. Gọi định kỳ hoặc theo request."""
    try:
        OLLAMA_UP.set(1 if agent_tutor.warm_up() else 0)
    except Exception:
        OLLAMA_UP.set(0)

    try:
        QDRANT_UP.set(1 if getattr(vector_store, 'qdrant_client', None) is not None else 0)
    except Exception:
        QDRANT_UP.set(0)

    try:
        TOTAL_CHUNKS.set(vector_store.get_total_chunks())
    except Exception:
        TOTAL_CHUNKS.set(0)

    try:
        ACTIVE_MODEL.labels(
            model_name=agent_tutor.model_name,
            model_size="3b" if "3b" in agent_tutor.model_name else "unknown"
        ).set(1)
    except Exception:
        pass


def metrics_response():
    """Trả về Response chuẩn Prometheus format."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
