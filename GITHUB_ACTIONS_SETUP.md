# GitHub Actions Auto-Deploy Setup

This workflow automatically builds and pushes your Docker image to Docker Hub on every push to `main` or `master`.

## Prerequisites

1. **GitHub repository** — Your code is pushed here.
2. **Docker Hub account** — Free at https://hub.docker.com
3. **GitHub Secrets** — Configure credentials below.

---

## Setup (One-Time)

### Step 1: Create Docker Hub Personal Access Token

1. Go to https://hub.docker.com/settings/security
2. Click **New Access Token**
3. Name it: `github-actions`
4. Copy the token (you'll need it in Step 2)

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these two secrets:

| Secret Name | Value |
|-------------|-------|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | The personal access token from Step 1 |

**Example:**
- `DOCKER_USERNAME` = `johnsmith`
- `DOCKER_PASSWORD` = `dckr_pat_abc123xyz...`

### Step 3: Verify Workflow File

The workflow file is already committed to `.github/workflows/deploy.yml`.

---

## How It Works

1. **You push code** to `main` or `master` branch.
2. **GitHub detects the push**.
3. **GitHub Actions automatically:**
   - Checks out your code
   - Builds the Docker image (same as if you ran `docker build`)
   - Pushes to Docker Hub as `YOUR_USERNAME/tasty-bites:latest`
4. **You then deploy** the image to Sevalla from Docker Hub.

---

## Workflow Details

### Triggers

The workflow runs automatically on:
- ✅ Push to `main` or `master` branch
- ✅ Pull requests to `main` or `master` (builds but doesn't push)
- ✅ Manual trigger via "Run workflow" button in GitHub

### What Gets Built

- **Docker image**: Full-stack app (frontend + backend)
- **Tags pushed**:
  - `YOUR_USERNAME/tasty-bites:latest` — Latest build
  - `YOUR_USERNAME/tasty-bites:COMMIT_SHA` — Specific commit

### Build Cache

The workflow uses Docker's build cache to speed up subsequent builds (typically 30-60 seconds per build).

---

## Usage

### Option 1: Automatic on Push (Recommended)

```bash
# Make a code change
git add .
git commit -m "Your message"
git push origin main
```

✅ **GitHub Actions automatically builds and pushes.** No action needed.

Check progress:
1. Go to GitHub repository
2. Click **Actions** tab
3. Watch the workflow run in real-time

### Option 2: Manual Trigger

Go to **Actions** tab in GitHub → Select **Build and Push to Docker Hub** → Click **Run workflow**.

---

## After Build Succeeds

Once the image is pushed to Docker Hub:

1. Go to your Sevalla dashboard
2. Go to **Web Service → Deployment**
3. Update the image URL to:
   ```
   YOUR_USERNAME/tasty-bites:latest
   ```
4. Click **Deploy**

Sevalla will pull the latest image from Docker Hub and restart the app (2-5 minutes).

---

## Monitoring & Troubleshooting

### View Build Logs

1. Go to GitHub **Actions** tab
2. Click the latest workflow run
3. Click **build-and-push** to see logs

### Common Issues

| Issue | Solution |
|-------|----------|
| "Permission denied" | Verify `DOCKER_PASSWORD` is a personal access token, not your password |
| "Build failed" | Check logs for Dockerfile errors; same errors as if you ran `docker build` locally |
| Image not on Docker Hub | Check workflow run status in GitHub Actions tab |

### Manual Workflow Trigger

If you want to rebuild without pushing code:

1. Go to GitHub **Actions** tab
2. Select **Build and Push to Docker Hub**
3. Click **Run workflow** → **Run workflow**

---

## Workflow File Location

`.github/workflows/deploy.yml` — Automatically triggered on push.

---

## Next Steps

1. **Push your code**:
   ```bash
   git push origin main
   ```

2. **Monitor the build** in GitHub **Actions** tab (watch the workflow run).

3. **Confirm image on Docker Hub**:
   - Go to https://hub.docker.com/repository/docker/YOUR_USERNAME/tasty-bites
   - You should see `latest` tag

4. **Deploy to Sevalla**:
   - Update Sevalla deployment to use `YOUR_USERNAME/tasty-bites:latest`
   - Click Deploy

---

## Disable Workflow (Optional)

To temporarily stop auto-builds:

1. Go to `.github/workflows/deploy.yml` in GitHub
2. Add `# ` at the start of each trigger (comment it out)
3. Commit and push

To re-enable: Remove the `# ` comments.

---

## More Info

- GitHub Actions Docs: https://docs.github.com/en/actions
- Docker Build Action: https://github.com/docker/build-push-action
- Docker Hub: https://hub.docker.com

You're all set! Push code and GitHub will handle the Docker build automatically. 🚀
