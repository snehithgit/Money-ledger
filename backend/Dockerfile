FROM python:3.11-slim

WORKDIR /app

# System deps kept to the bare minimum this app actually needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite database + raw import archives live here; mounted as a
# volume in docker-compose.yml so data survives rebuilds.
RUN mkdir -p /data
ENV FINANCE_DATA_DIR=/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
