from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String
from backend.database import Base


class MissionSession(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, index=True)
    age = Column(Integer, nullable=False)
    age_group = Column(String(16), nullable=False)
    main_concern = Column(String(16), nullable=False)
    has_emergency_fund = Column(Boolean, default=False, nullable=False)
    free_cash = Column(Integer, nullable=False)
    plan_type = Column(String(16), nullable=False)             # savings_first | split | invest
    recommended_monthly = Column(Integer, nullable=False)      # kwota użyta w symulacji
    emergency_savings_monthly = Column(Integer, default=0, nullable=False)
    horizon_years = Column(Integer, nullable=False)
    confidence_start = Column(Integer, nullable=False)         # z self_confidence_start (§3 mapa)
    confidence_score = Column(Integer, default=10, nullable=False)
    xp = Column(Integer, default=20, nullable=False)
    current_step = Column(Integer, default=1, nullable=False)  # 1..3, nigdy 4
    mission_completed = Column(Boolean, default=False, nullable=False)
    current_options = Column(JSON, default=list, nullable=False)  # opcje bieżącego kroku z is_optimal/feedback (tylko serwer)
    challenge_accepted = Column(Boolean, default=False, nullable=False)
    lang = Column(String(2), default="en", nullable=False)
    current_day = Column(Integer, default=1, nullable=False)          # 1..4
    completed_days = Column(JSON, default=list, nullable=False)       # np. [1, 2]
    completed_challenges = Column(JSON, default=list, nullable=False) # np. [1, 2]
    checkpoint_passed = Column(Boolean, default=False, nullable=False)
    history = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class LeaderboardRow(Base):
    __tablename__ = "leaderboard_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False)
    level_title = Column(String(64), nullable=False)
    xp = Column(Integer, nullable=False)
    streak_days = Column(Integer, default=1, nullable=False)
    is_seed = Column(Boolean, default=True, nullable=False)
