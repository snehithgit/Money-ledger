# Single-container build: the React frontend is compiled to static
# files in the first stage, then baked into the FastAPI backend image
# in the second stage. The backend serves the API under /api/* and the
# built frontend for everything else (see backend/app/main.py) - one
# process, one port, one container.
#
# Build from the REPO ROOT (this file needs both backend/ and
# frontend/ in its build context):
#   docker build -t finance-tracker .

FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /frontend/dist ./static

# SQLite database + raw import archives live here; mounted as a volume
# in docker-compose.yml so data survives rebuilds.
RUN mkdir -p /data
ENV FINANCE_DATA_DIR=/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
