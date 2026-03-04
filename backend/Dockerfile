FROM python:3.12-slim

# Install system deps for detect-secrets and semgrep
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first for better Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY app/ ./app/
COPY scripts/ ./scripts/

# Non-root user for security
RUN useradd -m -u 1000 sentryops
USER sentryops

EXPOSE 8000

# Azure Container Apps health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
