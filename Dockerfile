# Multi-stage Dockerfile: build frontend with Node, then build Python backend
### Stage 1: build the frontend
# Use a Debian-based Node image to avoid native/binary issues that occur on Alpine
FROM node:20-bullseye-slim AS frontend-build
ARG VITE_API_URL=http://localhost:8000
ARG VITE_BASE=/static/
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_BASE=${VITE_BASE}
WORKDIR /app/frontend
COPY frontend .
RUN npm install --legacy-peer-deps
# Verify lib files were copied and fail fast if missing
RUN if [ ! -d /app/frontend/src/lib ]; then echo "ERROR: frontend/src/lib is missing from build context" >&2; exit 1; fi && ls -la /app/frontend/src/lib/
# Increase Node heap size for Vite build to avoid OOM in CI
ENV NODE_OPTIONS=--max_old_space_size=8192
ENV NODE_ENV=production
RUN npm run build

### Stage 2: build the Python runtime and copy static assets
FROM python:3.12-slim
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

# Copy diagnostic scripts so they're available in the container
COPY scripts ./scripts

# Run migrations during build (will use SQLite during build, actual DB on deployment)
RUN python manage.py migrate --run-syncdb --noinput || true

# Copy built frontend files into Django staticfiles directory
COPY --from=frontend-build /app/frontend/dist ./staticfiles

# Collect static so Whitenoise can serve it
RUN python manage.py collectstatic --noinput

ENV PORT=8000
EXPOSE 8000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh", "-c", "gunicorn tastybites.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]
