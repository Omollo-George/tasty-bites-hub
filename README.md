# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Deployment

This project is pre-configured for automated deployment on **Render** (as indicated by your secrets script) and **Vercel**.

### Deploying to Render (Full Stack)
1.  **Generate Secrets**: Run `python generate_secrets.py` locally and save the output.
2.  **Create Blueprint**: Go to the Render Dashboard, click **New > Blueprint**, and connect this repository.
3.  **Automatic Provisioning**: Render will detect `render.yaml` and automatically set up the static frontend, the Python backend, and the PostgreSQL database.
4.  **Configuration**: Use the secrets generated in step 1 to fill in the required environment variables in the Render dashboard.

### Deploying to Vercel (Frontend Only)
1.  Connect your repository to Vercel.
2.  Vercel will automatically detect the **Vite** framework and configure the build settings.
3.  Set the `VITE_API_URL` environment variable in the Vercel dashboard to point to your live backend API.

## Deploying to Sevalla (Docker)

This repository includes a multi-stage `Dockerfile` that builds the frontend with Node and then builds the Python/Django backend. The frontend `dist` output is copied into Django's `staticfiles` folder so Whitenoise can serve assets in production.

Quick local test (build and run):

```bash
docker build -t tastybites:latest .
docker run -e DJANGO_DEBUG=False -e DJANGO_SECRET_KEY=changeme -p 8000:8000 tastybites:latest
```

For Sevalla you'll typically push an image to a container registry (Docker Hub, GHCR, or a private registry) and then configure your Sevalla service to pull and run that image. If you'd like, I can add a GitHub Actions workflow to build and push images to your registry.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
