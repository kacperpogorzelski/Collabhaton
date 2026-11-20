"""Szkielet FastAPI (Issue #2): CORS, init_db() na starcie, warunkowe /static i GET /.

Endpointy API (/api/...) dochodzą w Issue #6. Wszystkie funkcje są synchroniczne (`def`).
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.database import init_db

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # sync: create_all + seed rankingu (+ bezpiecznik SQLite w pamięci)
    yield


app = FastAPI(title="Finance Quest", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prototyp demo; frontend serwowany z tego samego hosta
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "status": "ok",
        "message": "Backend działa. Frontend (static/index.html) nie został jeszcze zmergowany.",
        "docs": "/docs",
    }
