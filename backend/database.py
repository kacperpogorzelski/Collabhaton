"""Połączenie SQLAlchemy z PostgreSQL + init_db() z seedem i bezpiecznikiem prezentacji.

Zasady (docs/02 §2):
* zero Alembica — tabele tworzy `Base.metadata.create_all`,
* `load_dotenv()` przed odczytem `DATABASE_URL`,
* gdy PostgreSQL jest nieosiągalny (np. Docker nie uruchomiony), `init_db()` loguje
  komunikat `Uruchom bazę: docker compose up -d` i przełącza się na SQLite w pamięci
  (te same modele) — plan B na prezentację, nie docelowa baza.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

logger = logging.getLogger("finance_quest.database")

DEFAULT_DATABASE_URL = "postgresql+psycopg2://finance:finance@localhost:5432/finance_quest"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
SQLITE_MEMORY_URL = "sqlite://"

# Lokalna lista awaryjna — używana, gdy backend/demo_data.py nie jest jeszcze w repo (Issue #3).
SEED_LEADERBOARD_FALLBACK = [
    {"name": "Kasia K.", "level_title": "Świadomy Start", "xp": 210, "streak_days": 5},
    {"name": "Tomek W.", "level_title": "Obserwator", "xp": 95, "streak_days": 2},
    {"name": "Marek Z.", "level_title": "Obserwator", "xp": 40, "streak_days": 1},
]

Base = declarative_base()


def _build_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        # Jedno współdzielone połączenie w pamięci (StaticPool), dostępne z wątków FastAPI.
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    # Krótki timeout, żeby brak Dockera nie wieszał startu aplikacji.
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 3})


engine: Engine = _build_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    """Generator zależności FastAPI (sync)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_rows() -> list[dict]:
    try:
        from backend.demo_data import SEED_LEADERBOARD  # type: ignore

        rows = [dict(r) for r in SEED_LEADERBOARD]
        if rows:
            return rows
    except Exception:  # demo_data jeszcze nie zmergowany albo błąd importu -> lista lokalna
        pass
    return [dict(r) for r in SEED_LEADERBOARD_FALLBACK]


def _seed_leaderboard() -> None:
    """Jednorazowy seed 3 znajomych; nie dubluje się przy restarcie."""
    from backend.models import LeaderboardRow

    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(LeaderboardRow)):
            return
        for row in _seed_rows():
            db.add(
                LeaderboardRow(
                    name=row["name"],
                    level_title=row["level_title"],
                    xp=row["xp"],
                    streak_days=row.get("streak_days", 1),
                    is_seed=True,
                )
            )
        db.commit()


def _switch_to_memory_sqlite() -> None:
    """Przełącza moduł na SQLite w pamięci (StaticPool) — bezpiecznik prezentacji."""
    global engine
    engine = _build_engine(SQLITE_MEMORY_URL)
    SessionLocal.configure(bind=engine)


def init_db() -> str:
    """Tworzy tabele i zasiewa ranking. Zwraca nazwę użytego dialektu ('postgresql' lub 'sqlite')."""
    from backend import models  # noqa: F401  (rejestruje tabele w Base.metadata)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # brak Dockera / zły URL / brak sterownika
        logger.warning(
            "Nie można połączyć się z bazą (%s: %s). Uruchom bazę: docker compose up -d. "
            "Przełączam się na SQLite w pamięci (bezpiecznik prezentacji) — sesje znikną po restarcie.",
            type(exc).__name__,
            str(exc).splitlines()[0] if str(exc) else "",
        )
        _switch_to_memory_sqlite()

    Base.metadata.create_all(bind=engine)
    _seed_leaderboard()
    dialect = engine.dialect.name
    logger.info("Baza gotowa (dialekt: %s).", dialect)
    return dialect
