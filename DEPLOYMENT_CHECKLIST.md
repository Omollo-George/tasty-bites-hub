# Deployment Checklist

## Pre-Deployment Setup (One-Time)

- [ ] Download and install Docker Desktop from https://www.docker.com/products/docker-desktop
- [ ] Create Docker Hub account at https://hub.docker.com
- [ ] Create Sevalla account at https://sevalla.app
- [ ] Create PostgreSQL database on Sevalla and copy connection string
- [ ] Create Web Service on Sevalla dashboard

## Deployment Execution

### Option A: Automated (Recommended)

```powershell
cd "c:\Users\omoll\OneDrive\Desktop\tasty-bites-hub"
powershell -ExecutionPolicy Bypass -File deploy-sevalla.ps1
```

Follow the on-screen prompts.

### Option B: Manual Steps

- [ ] **Step 1**: Generate Django Secret Key
  ```powershell
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```

- [ ] **Step 2**: Build Docker image
  ```powershell
  cd "c:\Users\omoll\OneDrive\Desktop\tasty-bites-hub"
  docker build -t tasty-bites:latest .
  ```

- [ ] **Step 3**: Log in to Docker Hub
  ```powershell
  docker login
  ```

- [ ] **Step 4**: Tag image
  ```powershell
  docker tag tasty-bites:latest YOUR_USERNAME/tasty-bites:latest
  ```

- [ ] **Step 5**: Push to Docker Hub
  ```powershell
  docker push YOUR_USERNAME/tasty-bites:latest
  ```

- [ ] **Step 6**: Configure Sevalla
  - Go to dashboard → Web Service
  - Set deployment source to: `YOUR_USERNAME/tasty-bites:latest`
  - Add environment variables (see [DEPLOY_SEVALLA.md](DEPLOY_SEVALLA.md) Step 7)

- [ ] **Step 7**: Deploy
  - Click Deploy on Sevalla dashboard
  - Wait 2-5 minutes

- [ ] **Step 8**: Run migrations
  - Open Sevalla Console
  - Run: `python manage.py migrate`
  - Run: `python manage.py collectstatic --noinput`

- [ ] **Step 9**: Test endpoints
  ```powershell
  Invoke-WebRequest -Uri "https://<your-sevalla-domain>/api/health/" -UseBasicParsing
  Invoke-WebRequest -Uri "https://<your-sevalla-domain>/" -UseBasicParsing
  ```

## Post-Deployment

- [ ] Verify backend API returns 200 OK
- [ ] Verify frontend loads successfully
- [ ] Test login functionality
- [ ] Test placing an order
- [ ] Check Sevalla logs for errors
- [ ] Enable monitoring and alerts

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker not found | Install Docker Desktop and restart |
| Authentication failed | Run `docker login` and enter credentials |
| Build fails | Check Dockerfile paths; ensure `frontend/dist` exists |
| Push fails | Verify Docker Hub login and internet connection |
| App crashes after deploy | Check Sevalla logs; verify DATABASE_URL is correct |
| Static files missing | Run `python manage.py collectstatic --noinput` on console |
| CORS errors | Verify CORS_ALLOWED_ORIGINS matches your domain |

## References

- Complete guide: [DEPLOY_SEVALLA.md](DEPLOY_SEVALLA.md)
- Sevalla docs: https://docs.sevalla.app
- Django deployment: https://docs.djangoproject.com/en/6.0/howto/deployment/
