# Deploying Tasty Bites (Supabase Postgres + Netlify frontend)

Overview
- Frontend: Netlify (Vite build in `frontend` directory)
- Backend datastore & storage: Supabase (Postgres + Storage)
- Backend application: Django — Supabase does not host Django apps directly. You must deploy the Django server to a host (Render, Fly, Railway, etc.) while using Supabase for the database and storage.

Quick steps

1. Create Supabase project
   - Go to https://app.supabase.com and create a new project.
   - From the project settings, copy the `Connection string` (Postgres) and Service Role / anon keys.
   - Create a Storage bucket if you want to store media files.

2. Update backend env and settings
   - Copy `backend/.env.example` to `backend/.env` and fill values (DATABASE_URL, DJANGO_SECRET_KEY, SUPABASE_URL, SUPABASE_KEY, CORS_ALLOWED_ORIGINS).
   - The project already reads `DATABASE_URL` in `backend/tastybites/tastybites/settings.py` using `dj_database_url`.

3. Migrate data from SQLite (optional)
   - From the repo root, create a fixture:
     ```bash
     python manage.py dumpdata --natural-primary --natural-foreign -e contenttypes -e auth.Permission --indent 2 > data.json
     ```
   - After deploying the Django app connected to Supabase, run:
     ```bash
     python manage.py migrate
     python manage.py loaddata data.json
     ```

4. Deploy Django app to a host (recommended: Render or Fly)
    - Use the repo Dockerfile (already present) or a Python environment.
    - Example start command: `gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT`
    - Set environment variables on the host:
       - `DATABASE_URL` (Supabase Postgres connection string)
       - `DJANGO_SECRET_KEY`
       - `CORS_ALLOWED_ORIGINS` (comma-separated frontend origin)
       - `CSRF_TRUSTED_ORIGINS` (comma-separated frontend origin)
       - `SUPABASE_URL` (optional, for SDK/storage usage)
       - `SUPABASE_KEY` (optional)
       - `AWS_STORAGE_BUCKET_NAME` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_ENDPOINT_URL` (optional, to enable S3-compatible media storage)
       - `RUN_MIGRATIONS=true` on first deploy to have the container run migrations automatically (the provided `docker-entrypoint.sh` supports this).
    - Render example (using `render.yaml` included in the repo):
       1. Push your repo to GitHub.
       2. In Render dashboard, click "New" → "Import from GitHub" and select the repo.
       3. Render will detect `render.yaml` and offer to create the service described there. Confirm and create.
       4. In the service settings, add the env vars listed above and set `RUN_MIGRATIONS=true` for the first deploy.
       5. Deploy. The Docker image build will run, the container will run migrations, and the app will start.
    - Alternatively, use Fly or Railway with similar env var configuration. The provided `Dockerfile` builds the frontend and backend together for a single deploy.

5. Deploy frontend to Netlify
   - Connect your GitHub repo to Netlify.
   - Netlify build settings (or `netlify.toml`):
     - Base directory: `frontend`
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Add Netlify environment variables:
     - `VITE_API_URL` → your backend's public URL (e.g. `https://api.example.com`)
     - `VITE_SUPABASE_URL` → your Supabase project URL, e.g. `https://rtlrypyuthywjdhvsuud.supabase.co`
     - `VITE_SUPABASE_KEY` → your Supabase publishable key, e.g. `sb_publishable_33DXdyWWsJJSuNx1h6ReUg_V7wxWyv_`

6. Test end-to-end
   - Verify the frontend can call the API endpoints.
   - Check CORS and CSRF trusted origins in `backend/.env`.

Notes and gotchas
- Supabase provides Postgres + Storage + Auth + Edge Functions. It does not run arbitrary Python WSGI apps. Use Supabase for DB/storage and host Django elsewhere.
- If you prefer to minimize hosting, consider containerizing Django and deploying to Render / Fly which are simple to configure.
- For media uploads with Supabase Storage, either use the Supabase HTTP API or configure an S3-compatible storage backend (check Supabase docs for the correct endpoint and credentials).

If you want, I can:
- add a sample `Procfile`/`Dockerfile` usage instructions for Render,
- add a `backend/.github/workflows/deploy.yml` CI file to run migrations and deploy,
- or prepare a step-by-step Render/Fly deploy guide with exact UI settings.
