FROM python:3.11-slim

RUN groupadd -r qk7 && useradd -r -g qk7 qk7

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gcc g++ libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY boxchat/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY boxchat/ ./

RUN mkdir -p /app/local_storage/qdrant_data && chown -R qk7:qk7 /app
USER qk7

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://127.0.0.1:8001/ai/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
