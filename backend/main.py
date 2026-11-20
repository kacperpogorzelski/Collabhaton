"""Szkielet FastAPI (Issue #2): CORS, init_db() na starcie, warunkowe /static i GET /.

Endpointy API (Issue #6). Wszystkie funkcje są synchroniczne (`def`).
`demo_data` i `luna_service` importowane są leniwie, żeby backend startował także przed ich merge'em.
"""
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend import finance_math
from backend.database import get_db, init_db
from backend.models import LeaderboardRow, MissionSession
from backend.schemas import (
    Assumptions,
    ChallengeAcceptRequest,
    ChallengeAcceptResponse,
    DemoPersona,
    MissionTurnRequest,
    MissionTurnResponse,
    OnboardingRequest,
    OnboardingResponse,
)

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


# ---------------------------------------------------------------------------
# Pomocnicze
# ---------------------------------------------------------------------------
_COLUMNS = [
    "id", "age", "age_group", "main_concern", "has_emergency_fund", "free_cash", "plan_type",
    "recommended_monthly", "emergency_savings_monthly", "horizon_years", "confidence_start",
    "confidence_score", "xp", "current_step", "mission_completed", "current_options",
    "challenge_accepted", "history",
]


def _columns(s: MissionSession) -> dict:
    cols = {c: getattr(s, c) for c in _COLUMNS}
    cols["history"] = list(s.history or [])
    cols["current_options"] = list(s.current_options or [])
    # kolumny nie przechowywane w bazie, potrzebne w szablonach
    cols["training_etf_monthly"] = 0 if s.plan_type == "savings_first" else s.recommended_monthly
    return cols


def _leaderboard_rows(db: Session) -> list[dict]:
    rows = db.scalars(select(LeaderboardRow).order_by(LeaderboardRow.xp.desc())).all()
    return [
        {"name": r.name, "level_title": r.level_title, "xp": r.xp, "streak_days": r.streak_days}
        for r in rows
    ]


def _get_session_or_404(db: Session, session_id: str) -> MissionSession:
    s = db.get(MissionSession, session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono sesji")
    return s


# ---------------------------------------------------------------------------
# Endpointy
# ---------------------------------------------------------------------------
@app.get("/api/demo-personas", response_model=list[DemoPersona])
def demo_personas():
    from backend import demo_data

    return demo_data.DEMO_PERSONAS


@app.post("/api/onboarding/analyze", response_model=OnboardingResponse)
def analyze(req: OnboardingRequest, db: Session = Depends(get_db)):
    from backend import demo_data

    age_group, horizon, persona_label = finance_math.get_age_group(req.age)
    advice = finance_math.calculate_safe_investment(
        req.age, req.net_income, req.free_cash, req.has_emergency_fund
    )
    confidence_start = finance_math.CONFIDENCE_START[req.self_confidence_start]
    session_id = uuid.uuid4().hex

    session = MissionSession(
        id=session_id,
        age=req.age,
        age_group=age_group,
        main_concern=req.main_concern,
        has_emergency_fund=req.has_emergency_fund,
        free_cash=req.free_cash,
        plan_type=advice.plan_type,
        recommended_monthly=advice.recommended_monthly,
        emergency_savings_monthly=advice.emergency_savings_monthly,
        horizon_years=horizon,
        confidence_start=confidence_start,
        confidence_score=confidence_start,
        xp=20,
        current_step=1,
        mission_completed=False,
        current_options=[],
        challenge_accepted=False,
        history=[],
    )
    facts = finance_math.build_session_facts(_columns(session))
    facts["xp"] = 20
    turn, options = demo_data.get_initial_mission_turn(facts)
    session.current_options = list(options)
    session.history = [{"role": "assistant", "content": turn.luna_message}]
    db.add(session)
    db.commit()

    assumptions = Assumptions(
        etf_gross_nominal_pct=finance_math.R_GROSS * 100,
        costs_pct=round(finance_math.R_COSTS * 100, 1),
        etf_net_nominal_pct=round(finance_math.R_ETF * 100, 1),
        inflation_pct=round(finance_math.R_INF * 100, 1),
        text=demo_data.ASSUMPTIONS_TEXT,
    )
    return OnboardingResponse(
        session_id=session_id,
        age_group=age_group,
        persona_label=persona_label,
        default_horizon_years=horizon,
        main_concern=req.main_concern,
        safe_investment=advice,
        speakly_filter=demo_data.SPEAKLY_FILTER_BY_GROUP[age_group],
        assumptions=assumptions,
        roadmap_milestones=demo_data.ROADMAP_BY_GROUP[age_group],
        micro_lessons=demo_data.MICRO_LESSONS_BY_GROUP[age_group],
        projection_series=finance_math.generate_projection_series(advice.recommended_monthly),
        initial_mission_turn=turn,
    )


@app.post("/api/mission/turn", response_model=MissionTurnResponse)
def mission_turn(req: MissionTurnRequest, db: Session = Depends(get_db)):
    from backend import luna_service

    session = _get_session_or_404(db, req.session_id)
    cols = _columns(session)
    session_data = {**cols, **finance_math.build_session_facts(cols)}
    session_data["session_id"] = session.id

    response = luna_service.process_mission_turn(
        session_data,
        req.user_message,
        _leaderboard_rows(db),
        quick_reply_id=req.quick_reply_id,
    )

    session.current_step = session_data["current_step"]
    session.confidence_score = session_data["confidence_score"]
    session.xp = session_data["xp"]
    session.mission_completed = session_data["mission_completed"]
    # nowe listy -> SQLAlchemy wykrywa zmianę kolumn JSON
    session.history = list(session_data["history"])
    session.current_options = list(session_data["current_options"])
    db.commit()
    return response


@app.post("/api/challenge/accept", response_model=ChallengeAcceptResponse)
def challenge_accept(req: ChallengeAcceptRequest, db: Session = Depends(get_db)):
    from backend import demo_data

    session = _get_session_or_404(db, req.session_id)
    reward = 0
    if not session.challenge_accepted:
        session.challenge_accepted = True
        session.xp += 50
        reward = 50
        db.commit()
    _, level_title, _ = demo_data.get_level_state(session.xp)
    leaderboard = demo_data.build_leaderboard(
        _leaderboard_rows(db), session.xp, level_title, session.xp >= 100
    )
    return ChallengeAcceptResponse(xp=session.xp, reward_xp=reward, leaderboard=leaderboard)
