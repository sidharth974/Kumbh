FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 build-essential && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything
COPY api/ ./api/
COPY data/ ./data/
COPY static/ ./static/
COPY vectordb/ ./vectordb/
RUN mkdir -p models
COPY knowledge_base/ ./knowledge_base/

# HF Spaces uses 7860, standard uses 8000
ENV PORT=7860
EXPOSE 7860

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT}
