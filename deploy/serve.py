"""Production entry point: the model API plus the built web app on one origin.

The API routes from api/app.py are registered first, so /api/* reaches them and
every other path falls through to the static files in dist/.
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

from fastapi.staticfiles import StaticFiles  # noqa: E402
from app import app  # noqa: E402

app.mount("/", StaticFiles(directory=os.path.join(ROOT, "dist"), html=True), name="web")
