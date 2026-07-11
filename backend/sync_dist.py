"""
Copy frontend/dist contents into backend STATIC_ROOT (staticfiles) so Django serves pre-rendered pages.
Usage:
  python backend/sync_dist.py

This script is safe to run repeatedly; it will remove files in STATIC_ROOT that are not present in dist.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = ROOT / 'frontend' / 'dist'
STATIC_ROOT = ROOT / 'staticfiles'

if not FRONTEND_DIST.exists():
    print(f"Frontend dist folder not found at {FRONTEND_DIST}. Run 'npm run build' in frontend first.")
    raise SystemExit(1)

if STATIC_ROOT.exists():
    print(f"Removing existing static root at {STATIC_ROOT} ...")
    shutil.rmtree(STATIC_ROOT)

print(f"Copying {FRONTEND_DIST} -> {STATIC_ROOT} ...")
shutil.copytree(FRONTEND_DIST, STATIC_ROOT)
print("Done. Be sure to collectstatic or restart your app if necessary.")
