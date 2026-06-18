# Multi-stage Dockerfile: build frontend with Node, then build Python backend
### Stage 1: build the frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/vite.config.ts frontend/index.html frontend/postcss.config.js frontend/tailwind.config.ts ./
COPY frontend/tsconfig.json frontend/tsconfig.app.json ./
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm install --legacy-peer-deps
# Increase Node heap size for Vite build to avoid OOM in CI
ENV NODE_OPTIONS=--max_old_space_size=8192
RUN npm run build

### Stage 2: build the Python runtime and copy static assets
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y build-essential libpq-dev gcc curl --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/tastybites/requirements.txt ./requirements.txt
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the entire backend project
COPY backend/tastybites . 

# Copy built frontend files into Django staticfiles directory
COPY --from=frontend-build /app/dist ./staticfiles

# Collect static so Whitenoise can serve it
RUN python manage.py collectstatic --noinput || true

ENV PORT=8000
EXPOSE 8000

CMD ["gunicorn", "tastybites.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
