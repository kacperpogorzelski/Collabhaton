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
    CheckpointSubmitRequest,
    CheckpointSubmitResponse,
    CoachExplainRequest,
    CoachExplainResponse,
    DayStartRequest,
    DayStartResponse,
    DemoPersona,
    Language,
    MissionTurnRequest,
    MissionTurnResponse,
    OnboardingRequest,
    OnboardingResponse,
    ScamDrillRequest,
    ScamDrillResponse,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # sync: create_all + seed rankingu (+ bezpiecznik SQLite w pamięci)
    yield


app = FastAPI(title="Investly", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prototyp demo; frontend serwowany z tego samego hosta
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok", "app": "investly"}


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
    "challenge_accepted", "history", "lang", "current_day", "completed_days",
    "completed_challenges", "checkpoint_passed",
]


def _columns(s: MissionSession) -> dict:
    cols = {c: getattr(s, c) for c in _COLUMNS}
    cols["history"] = list(s.history or [])
    cols["current_options"] = list(s.current_options or [])
    cols["completed_days"] = list(s.completed_days or [])
    cols["completed_challenges"] = list(s.completed_challenges or [])
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
def demo_personas(lang: Language = "en"):
    from backend import demo_data

    return demo_data.get_demo_personas(lang)


@app.post("/api/onboarding/analyze", response_model=OnboardingResponse)
def analyze(req: OnboardingRequest, db: Session = Depends(get_db)):
    from backend import demo_data

    age_group, horizon, persona_label = finance_math.get_age_group(req.age, req.lang)
    advice = finance_math.calculate_safe_investment(
        req.age, req.net_income, req.free_cash, req.has_emergency_fund, req.lang
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
        lang=req.lang,
        current_day=1,
        completed_days=[],
        completed_challenges=[],
        checkpoint_passed=False,
    )
    facts = finance_math.build_session_facts(_columns(session))
    facts["xp"] = 20
    turn, options = demo_data.get_initial_mission_turn(facts, req.lang)
    session.current_options = list(options)
    session.history = [{"role": "assistant", "content": turn.luna_message}]
    db.add(session)
    db.commit()

    content = demo_data.get_age_group_content(age_group, req.lang)
    assumptions = Assumptions(
        etf_gross_nominal_pct=finance_math.R_GROSS * 100,
        costs_pct=round(finance_math.R_COSTS * 100, 1),
        etf_net_nominal_pct=round(finance_math.R_ETF * 100, 1),
        inflation_pct=round(finance_math.R_INF * 100, 1),
        text=demo_data.get_assumptions_text(req.lang),
    )
    return OnboardingResponse(
        session_id=session_id,
        lang=req.lang,
        age_group=age_group,
        persona_label=persona_label,
        default_horizon_years=horizon,
        main_concern=req.main_concern,
        safe_investment=advice,
        speakly_filter=content["speakly_filter"],
        assumptions=assumptions,
        roadmap_milestones=content["roadmap"],
        micro_lessons=content["micro_lessons"],
        projection_series=finance_math.generate_projection_series(advice.recommended_monthly),
        initial_mission_turn=turn,
        checkpoint_questions=demo_data.get_checkpoint_questions(req.lang),
        post_14_paths=demo_data.get_post_14_paths(req.lang),
    )


@app.post("/api/mission/turn", response_model=MissionTurnResponse)
def mission_turn(req: MissionTurnRequest, db: Session = Depends(get_db)):
    from backend import luna_service

    session = _get_session_or_404(db, req.session_id)
    if req.lang is not None:
        session.lang = req.lang
    cols = _columns(session)
    session_data = {**cols, **finance_math.build_session_facts(cols)}
    session_data["session_id"] = session.id

    response = luna_service.process_mission_turn(
        session_data,
        req.user_message,
        _leaderboard_rows(db),
        quick_reply_id=req.quick_reply_id,
        day=req.day,
    )

    session.current_day = session_data.get("current_day", session.current_day)
    session.completed_days = list(session_data.get("completed_days") or [])
    session.current_step = session_data["current_step"]
    session.confidence_score = session_data["confidence_score"]
    session.xp = session_data["xp"]
    session.mission_completed = session_data["mission_completed"]
    # nowe listy -> SQLAlchemy wykrywa zmianę kolumn JSON
    session.history = list(session_data["history"])
    session.current_options = list(session_data["current_options"])
    db.commit()
    return response


def _session_data(session: MissionSession) -> dict:
    cols = _columns(session)
    data = {**cols, **finance_math.build_session_facts(cols)}
    data["session_id"] = session.id
    return data


@app.post("/api/day/start", response_model=DayStartResponse)
def day_start(req: DayStartRequest, db: Session = Depends(get_db)):
    from backend import demo_data

    session = _get_session_or_404(db, req.session_id)
    if req.lang is not None:
        session.lang = req.lang
    data = _session_data(session)
    turn, options = demo_data.get_initial_mission_turn(data, session.lang, req.day)
    # tura startowa dnia pokazuje bieżący stan, nie stan z początku programu
    turn.confidence_score = session.confidence_score
    turn.gamification.streak_days = max(1, len(session.completed_days or []) + 1)

    session.current_day = req.day
    session.current_step = 1
    session.mission_completed = False
    session.current_options = list(options)
    session.history = list(session.history or []) + [
        {"role": "assistant", "content": turn.luna_message}
    ]
    db.commit()
    content = demo_data.get_day_content(req.day, data, session.lang)
    return DayStartResponse(
        day=req.day, micro_lessons=content["micro_lessons"], initial_mission_turn=turn
    )


@app.post("/api/challenge/accept", response_model=ChallengeAcceptResponse)
def challenge_accept(req: ChallengeAcceptRequest, db: Session = Depends(get_db)):
    from backend import demo_data

    session = _get_session_or_404(db, req.session_id)
    if req.lang is not None:
        session.lang = req.lang
    done = list(session.completed_challenges or [])
    already = req.day in done or (req.day == 1 and session.challenge_accepted)
    reward = 0
    if not already:
        done.append(req.day)
        session.completed_challenges = sorted(done)  # nowa lista -> zmiana JSON wykryta
        if req.day == 1:
            session.challenge_accepted = True
        session.xp += 50
        reward = 50
    elif req.day == 1 and 1 not in done:
        session.completed_challenges = sorted(done + [1])
    db.commit()
    _, level_title, _ = demo_data.get_level_state(session.xp, session.lang)
    leaderboard = demo_data.build_leaderboard(
        _leaderboard_rows(db), session.xp, level_title, session.xp >= 100, session.lang
    )
    return ChallengeAcceptResponse(xp=session.xp, reward_xp=reward, leaderboard=leaderboard)


@app.post("/api/checkpoint/submit", response_model=CheckpointSubmitResponse)
def checkpoint_submit(req: CheckpointSubmitRequest, db: Session = Depends(get_db)):
    from backend import demo_data

    session = _get_session_or_404(db, req.session_id)
    if req.lang is not None:
        session.lang = req.lang
    graded = demo_data.grade_checkpoint(req.answers, session.lang)
    prev_level = demo_data.get_level_state(session.xp, session.lang)[0]
    reward = 0
    if graded["passed"] and not session.checkpoint_passed:
        session.checkpoint_passed = True
        reward = graded["reward_xp"]
        session.xp += reward
    db.commit()
    level, level_title, _ = demo_data.get_level_state(session.xp, session.lang)
    leaderboard = demo_data.build_leaderboard(
        _leaderboard_rows(db), session.xp, level_title, level > prev_level, session.lang
    )
    return CheckpointSubmitResponse(
        score_pct=graded["score_pct"],
        passed=graded["passed"],
        correct_count=graded["correct_count"],
        total_questions=graded["total_questions"],
        reward_xp=reward,
        xp=session.xp,
        leveled_up=level > prev_level,
        badge_title=graded["badge_title"],
        results=graded["results"],
        leaderboard=leaderboard,
    )


@app.post("/api/coach/explain", response_model=CoachExplainResponse)
def coach_explain(req: CoachExplainRequest, db: Session = Depends(get_db)):
    from backend import luna_service

    sid = (req.session_id or "").strip()
    if sid:
        session = _get_session_or_404(db, sid)
        if req.lang is not None:
            session.lang = req.lang
            db.commit()
        data = _session_data(session)
        lang = session.lang
    else:
        data = {"lang": req.lang or "en"}
        lang = req.lang or "en"

    if req.current_screen:
        data["current_screen"] = req.current_screen
    if req.user_name:
        data["user_name"] = req.user_name

    explain = getattr(luna_service, "explain_with_drill", None)
    if explain is None:  # Issue #30 jeszcze nie zmergowany
        raise HTTPException(status_code=501, detail="explain_with_drill niedostępne")
    result = explain(data, req.question, req.topic_hint, lang)
    return CoachExplainResponse(**result)


@app.post("/api/scam/drill", response_model=ScamDrillResponse)
def scam_drill(req: ScamDrillRequest):
    """Generuje edukacyjną wiadomość phishingową do ćwiczenia rozpoznawania oszustw."""
    from backend import luna_service

    gen = getattr(luna_service, "generate_scam_drill", None)
    if gen is None:
        raise HTTPException(status_code=501, detail="generate_scam_drill niedostępne")
    result = gen(lang=req.lang, age_group=req.age_group, scenario_index=req.scenario_index)
    return ScamDrillResponse(**result)
