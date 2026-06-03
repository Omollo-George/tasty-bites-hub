# Multi-stage Dockerfile: build frontend with Node, then build Python backend
### Stage 1: build the frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY vite.config.ts index.html ./
COPY src ./src
RUN npm install --legacy-peer-deps
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
COPY tastybites/requirements.txt ./tastybites/requirements.txt
RUN pip install --upgrade pip
RUN pip install -r tastybites/requirements.txt

# Copy the entire project
COPY . .

# Copy built frontend files into Django staticfiles directory
COPY --from=frontend-build /app/dist ./staticfiles

# Collect static so Whitenoise can serve it
RUN python tastybites/manage.py collectstatic --noinput || true

ENV PORT=8000
EXPOSE 8000

CMD ["gunicorn", "tastybites.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
