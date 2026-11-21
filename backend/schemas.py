from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator

AgeGroup = Literal["20+", "30-50", "50+"]
MainConcern = Literal["freeze_money", "no_time", "lose_money", "too_late"]
PlanType = Literal["savings_first", "split", "invest"]
Language = Literal["en", "pl"]
AnswerQuality = Literal["optimal", "partial", "invalid"]


class DemoPersona(BaseModel):
    id: str
    short_label: str
    full_label: str
    age: int
    net_income: int
    free_cash: int
    has_emergency_fund: bool
    main_concern: MainConcern
    self_confidence_start: int


class OnboardingRequest(BaseModel):
    age: int = Field(..., ge=18, le=70)
    net_income: int = Field(..., ge=2500, le=25000)
    free_cash: int = Field(..., ge=200, le=10000)
    has_emergency_fund: bool = False
    main_concern: MainConcern
    self_confidence_start: int = Field(..., ge=1, le=5)
    lang: Language = "en"

    @model_validator(mode="after")
    def free_cash_not_above_income(self):
        if self.free_cash > self.net_income:
            raise ValueError("free_cash nie może przekraczać net_income")
        return self


class Assumptions(BaseModel):
    etf_gross_nominal_pct: float      # 6.0
    costs_pct: float                  # 0.3
    etf_net_nominal_pct: float        # 5.7
    inflation_pct: float              # 3.5
    text: str


class SafeInvestmentAdvice(BaseModel):
    plan_type: PlanType
    min_monthly: int
    max_monthly: int
    recommended_monthly: int          # kwota użyta w symulacji (savings_first: 100, ilustracyjnie)
    emergency_savings_monthly: int = 0
    training_etf_monthly: int = 0
    illustrative_only: bool = False
    reasoning: str


class RoadmapMilestone(BaseModel):
    day: int
    title: str
    focus: str
    status: Literal["active", "locked"] = "locked"
    phase: Optional[str] = None         # np. "Phase 1: Days 1–4"
    duration_hint: str = "~5 min/day"


class Post14Path(BaseModel):
    id: str
    title: str
    description: str
    cadence: str
    badge: str


class MicroLessonCard(BaseModel):
    id: str
    title: str
    duration_sec: int = 20
    summary: str
    key_takeaway: str
    xp_reward: int = 15
    check_question: Optional[str] = None
    check_options: list[str] = Field(default_factory=list)
    correct_option_index: Optional[int] = Field(default=None, ge=0, le=2)
    check_explanation: Optional[str] = None


class SpeaklyFilter(BaseModel):
    kept_topics: list[str]            # dokładnie 3 (spójne z 3 mikro-lekcjami)
    removed_topics: list[str]         # 6


class ProjectionPoint(BaseModel):
    year: int
    total_paid: int                   # = gotówka nominalnie (konto 0%)
    etf_nominal_value: int
    etf_real_value: int               # w dzisiejszych zł
    etf_stress_real_value: int        # scenariusz -20% w roku 3 (edukacyjny)
    cash_real_value: int              # w dzisiejszych zł
    real_gain_vs_cash: int
    historical_win_rate: int          # ilustracyjne, max 97


class QuickReply(BaseModel):
    id: str
    text: str                         # is_optimal i feedback NIE są wysyłane do klienta


class PortfolioStatus(BaseModel):
    simulated_value: int              # nominalnie; wartość zależna od kroku (docs/03 §2)
    event_badge: str


class GamificationState(BaseModel):
    level: int = 1
    level_title: str = "Obserwator"
    xp: int = 20
    next_level_xp: int = 100
    xp_gained: int = 0
    leveled_up: bool = False
    streak_days: int = 1


class RealWorldChallenge(BaseModel):
    title: str
    description: str
    amount_pln: int
    target_account: str
    reward_xp: int = 50


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    level_title: str
    xp: int
    streak_days: int
    is_current_user: bool = False


class ChecklistItem(BaseModel):
    id: str
    text: str
    detail: str


class BankDraft(BaseModel):
    monthly_amount: int
    horizon_years: int
    instrument_category: str
    projected_etf_real_value: int
    projected_etf_nominal_value: int
    projected_cash_real_value: int
    historical_win_rate: int
    assumptions_text: str
    costs_note: str                   # koszty, podatek, brak gwarancji


class CheckpointQuestion(BaseModel):
    id: str
    question: str
    options: list[QuickReply]


class CheckpointQuestionResult(BaseModel):
    id: str
    correct: bool
    correct_option_id: str
    explanation: str


class CheckpointSubmitRequest(BaseModel):
    session_id: str
    answers: dict[str, str]
    lang: Optional[Language] = None


class CheckpointSubmitResponse(BaseModel):
    score_pct: int
    passed: bool
    correct_count: int
    total_questions: int
    reward_xp: int
    xp: int
    leveled_up: bool
    badge_title: str
    results: list[CheckpointQuestionResult]
    leaderboard: list[LeaderboardEntry]


class CoachExplainRequest(BaseModel):
    session_id: Optional[str] = None
    question: str = Field(..., min_length=1, max_length=400)
    topic_hint: Optional[str] = None
    lang: Optional[Language] = None
    current_screen: Optional[str] = Field(default=None, max_length=120)
    user_name: Optional[str] = Field(default=None, max_length=40)


class CoachExplainResponse(BaseModel):
    simple_explanation: str
    real_life_example: str
    drill_question: str
    drill_options: list[str]
    correct_option_index: int = Field(..., ge=0, le=2)
    drill_feedback: str
    is_fallback: bool = False


class DayStartRequest(BaseModel):
    session_id: str
    day: int = Field(..., ge=1, le=4)
    lang: Optional[Language] = None


class MissionTurnResponse(BaseModel):
    day: int = 1
    step_number: int = Field(..., ge=1, le=3)
    total_steps: int = 3
    confidence_score: int = Field(..., ge=0, le=100)   # w UI: „Gotowość"
    confidence_delta: int = 0
    confidence_start: int = Field(..., ge=0, le=100)
    understanding_feedback: Optional[str] = None
    is_optimal_choice: Optional[bool] = None           # None w turze startowej
    answer_quality: Optional[AnswerQuality] = None     # optimal | partial | invalid
    allow_retry: bool = False                          # True gdy invalid (0 XP, zostaje na kroku)
    luna_message: str
    quick_replies: list[QuickReply]
    portfolio_status: PortfolioStatus
    gamification: GamificationState
    trigger_confetti: bool = False
    mission_completed: bool = False
    completed_days: list[int] = Field(default_factory=list)
    real_world_challenge: Optional[RealWorldChallenge] = None
    leaderboard: Optional[list[LeaderboardEntry]] = None
    final_checklist: Optional[list[ChecklistItem]] = None
    bank_draft: Optional[BankDraft] = None
    post_14_paths: Optional[list[Post14Path]] = None


class OnboardingResponse(BaseModel):
    session_id: str
    lang: Language = "en"
    age_group: AgeGroup
    persona_label: str
    default_horizon_years: int
    current_day: int = 1
    total_program_days: int = 14
    main_concern: MainConcern
    safe_investment: SafeInvestmentAdvice
    speakly_filter: SpeaklyFilter
    assumptions: Assumptions
    roadmap_milestones: list[RoadmapMilestone]
    micro_lessons: list[MicroLessonCard]
    projection_series: list[ProjectionPoint]
    initial_mission_turn: MissionTurnResponse
    checkpoint_questions: list[CheckpointQuestion] = Field(default_factory=list)
    post_14_paths: list[Post14Path] = Field(default_factory=list)


class DayStartResponse(BaseModel):
    day: int
    micro_lessons: list[MicroLessonCard]
    initial_mission_turn: MissionTurnResponse


class MissionTurnRequest(BaseModel):
    session_id: str
    user_message: str = Field(..., min_length=1, max_length=600)
    quick_reply_id: Optional[str] = None   # gdy klik karty -> ocena deterministyczna (bez LLM)
    day: Optional[int] = Field(default=None, ge=1, le=4)
    lang: Optional[Language] = None


class ChallengeAcceptRequest(BaseModel):
    session_id: str
    day: int = Field(default=1, ge=1, le=4)
    lang: Optional[Language] = None


class ChallengeAcceptResponse(BaseModel):
    xp: int
    reward_xp: int
    leaderboard: list[LeaderboardEntry]


class ScamDrillClue(BaseModel):
    id: str
    text: str
    is_red_flag: bool
    explanation: str


class ScamDrillRequest(BaseModel):
    lang: Language = "en"
    age_group: AgeGroup = "50+"
    scenario_index: int = Field(default=0, ge=0, le=50)


class ScamDrillResponse(BaseModel):
    channel: str
    sender: str
    subject: str = ""
    message: str
    clues: list[ScamDrillClue]
    safe_action: str
    source: Literal["ai", "offline"] = "offline"
