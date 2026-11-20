# 02. SSOT Architektury Python, Bazy Docker, Matematyki i Kontraktu API

Ten dokument jest **wiążącym kontraktem technicznym**. Nazwy plików, tabel, endpointów i pól JSON muszą zgadzać się co do znaku między backendem (Osoba 1 i 2) a frontendem (Osoba 3).

---

## 1. Dokładna struktura projektu
```text
finance-quest/
├── AGENTS.md
├── docker-compose.yml     # Lekki PostgreSQL 16 (uruchamiany: docker compose up -d)
├── requirements.txt
├── .env
├── .env.example
├── docs/
│   ├── 01_PRODUCT_AND_GUI_SPEC.md
│   ├── 02_TECH_API_AND_MATH.md
│   └── 03_LUNA_INTEGRATION_AND_PROMPTS.md
├── backend/
│   ├── __init__.py
│   ├── database.py        # Połączenie SQLAlchemy z PostgreSQL + init_db() z seedem
│   ├── models.py          # 2 proste tabele ORM: MissionSession, LeaderboardRow
│   ├── main.py            # FastAPI app, CORS, trasy API, serwowanie /static
│   ├── schemas.py         # Wszystkie modele Pydantic (100% kontraktu poniżej)
│   ├── finance_math.py    # Deterministyczne obliczenia ETF, inflacji i widełek
│   ├── demo_data.py       # 3 persony, mapa 14 dni, mikro-lekcje, seed rankingu, wyzwania 5 zł, fallbacki
│   └── luna_service.py    # Adaptacja modułu Luny (AI Coach) + System Prompt + fallback
└── static/
    ├── index.html         # Kompletny SPA bez npm (4 ekrany + modal)
    ├── app.js             # Logika UI, Chart.js, animacje, grywalizacja, fetch API
    └── styles.css         # Animacje CSS (btn-3d, shimmer, strike, level-pop, pulse)
```

---

## 2. Podstawowa Baza Danych w Dockerze (`backend/database.py` i `backend/models.py`)

**ZASADA PROSTOTY:** Zero Alembica, zero ręcznych migracji SQL. Przy starcie FastAPI (`lifespan` lub `on_event("startup")`) wywołujemy `init_db()`, które odpala `Base.metadata.create_all(bind=engine)` i zasiewa tabelę `leaderboard_entries` 3 początkowymi znajomymi (jeśli jest pusta).

### A. Konfiguracja połączenia (`backend/database.py`)
* Pobiera `DATABASE_URL` z `.env` (domyślnie: `"postgresql://finance:finance@localhost:5432/finance_quest"`).
* Udostępnia standardowe `engine`, `SessionLocal`, `Base` oraz generator zależności `get_db()` dla FastAPI.
* Jeśli podczas szybkiego testu lokalnego bez uruchomionego Dockera połączenie z Postgres zawiedzie, `init_db()` może zalogować jasny komunikat `Uruchom bazę komendą: docker compose up -d`.

### B. Dokładne 2 tabele ORM (`backend/models.py`)
Skopiuj poniższy schemat 1:1 do `backend/models.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String
from backend.database import Base


class MissionSession(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, index=True)
    age = Column(Integer, nullable=False)
    age_group = Column(String(16), nullable=False)
    has_emergency_fund = Column(Boolean, default=False, nullable=False)
    recommended_monthly = Column(Integer, nullable=False)
    horizon_years = Column(Integer, nullable=False)
    etf_future_value = Column(Integer, nullable=False)
    cash_real_value = Column(Integer, nullable=False)
    win_rate = Column(Integer, nullable=False)
    current_step = Column(Integer, default=1, nullable=False)
    confidence_score = Column(Integer, default=10, nullable=False)
    xp = Column(Integer, default=20, nullable=False)
    challenge_accepted = Column(Boolean, default=False, nullable=False)
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
```

### C. Jak aplikacja korzysta z PostgreSQL (Minimum pracy, maksimum efektu)
1. **Start aplikacji (`init_db`):** Jeśli tabela `leaderboard_entries` jest pusta, wrzuca 3 rekordy seedowe (`Kasia K.` 210 XP / 5 dni, `Tomek W.` 95 XP / 2 dni, `Marek Z.` 40 XP / 1 dzień).
2. **`POST /api/onboarding/analyze`:** Tworzy nowy wiersz `MissionSession` w PostgreSQL i robi `db.commit()`.
3. **`POST /api/mission/turn`:** Pobiera `MissionSession` z bazy po `session_id`, aktualizuje `current_step`, `confidence_score`, `xp` oraz `history` (pamiętaj o nadpisaniu nowej listy `session.history = list(session.history) + [...]`, aby SQLAlchemy wykrył zmianę w kolumnie JSON) i robi `db.commit()`. W Kroku 3 pobiera z tabeli `leaderboard_entries` rekordy seedowe, łączy je z aktualnym wynikiem użytkownika (`xp = 155`) i sortuje malejąco do pola `leaderboard`.
4. **Opcjonalny zapis wyzwania (`POST /api/challenge/accept`):** Jeśli użytkownik kliknie na Ekranie 4 przycisk `Podejmuję wyzwanie (+50 XP)`, frontend wysyła `{"session_id": "..."}` — backend ustawia `challenge_accepted = True`, podbija `xp += 50` (ze `155` do `205 XP`) w PostgreSQL i zwraca zaktualizowany `leaderboard`.

### D. Konwencje wykonawcze i kontrakt międzymodułowy (Zero błędów integracji)
* **Synchroniczne `def` w całym backendzie:** Wszystkie trasy FastAPI (`backend/main.py`) oraz funkcje w `finance_math.py`, `demo_data.py` i `luna_service.py` definiujemy jako zwykłe **synchroniczne `def`** (nie `async def`). FastAPI automatycznie uruchamia je w threadpoolu, co idealnie współpracuje z synchronicznym SQLAlchemy (`psycopg2-binary`) oraz synchronicznym klientem `openai.OpenAI` i eliminuje błędy typu `coroutine was never awaited`.
* **Wczytywanie `.env`:** `load_dotenv()` z `python-dotenv` wywołujemy zarówno w `backend/database.py`, jak i w `backend/luna_service.py` przed odczytem zmiennych środowiskowych (`DATABASE_URL`, `OPENAI_API_KEY`, `LUNA_MODEL`, `LUNA_TIMEOUT_SECONDS`).
* **Warunkowe montowanie `/static` w `backend/main.py`:** Montujemy `StaticFiles` wyłącznie wtedy, gdy folder `static/` istnieje (`if STATIC_DIR.is_dir(): app.mount("/static", ...)`), a `GET /` zwraca `static/index.html` lub tymczasową odpowiedź JSON z adresem `/docs`, jeśli frontend nie został jeszcze zmergowany.
* **Wiążący format `MissionSession.history`:** Lista słowników zgodna z formatem wiadomości OpenAI: `[{"role": "assistant" | "user", "content": "..."}]`. W `POST /api/onboarding/analyze` zapisujemy wpis startowy `[{"role": "assistant", "content": initial_mission_turn.luna_message}]`. W `POST /api/mission/turn` nadpisujemy nową listę: `session.history = list(session.history or []) + [{"role": "user", "content": req.user_message}, {"role": "assistant", "content": turn.luna_message}]`.
* **Stan po ukończeniu Kroku 3 (`current_step` capped at `3`):** Gdy `answered_step == 3`, `mission_completed = True` i `confidence_score = 40`, w bazie `session.current_step` pozostaje równe `3` (nigdy `4` — schemat `MissionTurnResponse.step_number` wymaga `1 <= step_number <= 3`). Ewentualne ponowne wywołanie `POST /api/mission/turn` dla już ukończonej sesji zwraca idempotentnie odpowiedź finałową Kroku 3 bez błędu walidacji.

---

## 3. Deterministyczna Matematyka Finansowa (`backend/finance_math.py`)

**ZASADA:** LLM nigdy nie liczy pieniędzy ani procentów. Wszystkie wartości oblicza `finance_math.py`, a AI Coach Luna otrzymuje gotowe liczby w prompcie.

### A. Stałe edukacyjne (uśrednione dane historyczne szerokiego rynku globalnego)
* Nominalna średnia roczna stopa zwrotu szerokiego ETF: $r_{\text{etf}} = 0.08$ ($8.0\%$ rocznie).
* Średnia roczna inflacja (utrata siły nabywczej gotówki na koncie $0\%$): $r_{\text{inf}} = 0.035$ ($3.5\%$ rocznie).
* **Historyczny odsetek okresów kończących się zyskiem** (`HISTORICAL_WIN_RATE`):
  * $1$ rok: $73\%$, $3$ lata: $84\%$, $5$ lat: $90\%$, $7$ lat: $93\%$, $10$ lat: $96\%$, $15$ lat: $99\%$, $20$ lat: $100\%$.
  *(Dla pozostałych lat $t \in \{1, \dots, 20\}$ stosować liniową interpolację zaokrągloną do `int`).*

### B. Klasyfikacja grupy wiekowej (`get_age_group`)
* $age < 30$ -> `age_group = "20+"`, `default_horizon_years = 15`, `persona_label = "Młody Start (20+)"`
* $30 \le age \le 50$ -> `age_group = "30-50"`, `default_horizon_years = 10`, `persona_label = "Kariera i Rodzina (30–50)"`
* $age > 50$ -> `age_group = "50+"`, `default_horizon_years = 7`, `persona_label = "Ochrona Kapitału (50+)"`

### C. Wyliczanie bezpiecznej miesięcznej kwoty docelowej (`calculate_safe_investment`)
Wejście: `age: int`, `net_income: float`, `free_cash: float`, `has_emergency_fund: bool`.
1. Zabezpieczenie brzegowe: jeśli `free_cash < 100`, przyjmij `effective_free = 100`.
2. Dobór widełek procentowych od `effective_free`:
   * Jeśli `has_emergency_fund is False`:
     * `min_pct = 0.20`, `max_pct = 0.35`
     * `reasoning`: *"Budujesz jeszcze poduszkę bezpieczeństwa, więc docelowo na start wystarczy 20–35% wolnych środków. Resztę kieruj na poduszkę, a w ciągu 14 dni bezpiecznie przygotujesz się do pierwszej wpłaty."*
   * Jeśli `has_emergency_fund is True`:
     * Dla `20+`: `min_pct = 0.50`, `max_pct = 0.70`, `reasoning`: *"Masz już poduszkę i najcenniejszy zasób — czas. Docelowe 50–70% wolnych środków w szerokim ETF uruchomi potężny efekt procentu składanego."*
     * Dla `30-50`: `min_pct = 0.40`, `max_pct = 0.60`, `reasoning`: *"Masz zabezpieczoną poduszkę rodzinną, więc 40–60% wolnych nadwyżek może automatycznie pracować w szerokich ETF-ach w tle, bez tracenia Twojego czasu."*
     * Dla `50+`: `min_pct = 0.30`, `max_pct = 0.50`, `reasoning`: *"Masz solidną poduszkę, dlatego 30–50% wolnych środków możesz bezpiecznie skierować do szerokich ETF-ów, aby chronić swój kapitał przed inflacją."*
3. Zaokrąglanie:
   * `round_to_50(val) = max(100, int(round(val / 50.0) * 50))`
   * `min_monthly = round_to_50(effective_free * min_pct)`
   * `max_monthly = max(min_monthly + 50, round_to_50(effective_free * max_pct))`
   * `recommended_monthly = round_to_50((min_monthly + max_monthly) / 2.0)`

### D. Projekcja 20-letnia (`generate_projection_series`)
Dla miesięcznej wpłaty $P = \text{recommended\_monthly}$, miesięcznej stopy $i = r_{\text{etf}} / 12$, dla każdego roku $t \in \{1, 2, \dots, 20\}$ (gdzie $n = 12 \cdot t$):

* **Łącznie wpłacone pieniądze:**
  $$V_{\text{paid}}(t) = P \cdot n$$
* **Wartość portfela ETF (procent składany z regularną wpłatą):**
  $$V_{\text{etf}}(t) = P \cdot \frac{(1 + i)^n - 1}{i}$$
* **Realna siła nabywcza tej samej gotówki na zwykłym koncie $0\%$ (po inflacji):**
  $$V_{\text{cash\_real}}(t) = \sum_{m=1}^{n} \frac{P}{(1 + r_{\text{inf}})^{m/12}}$$
* Różnica (`inflation_loss_vs_etf`):
  $$\Delta(t) = V_{\text{etf}}(t) - V_{\text{cash\_real}}(t)$$
* Zaokrąglić wszystkie wartości do `int(round(...))`.
* **Pomocnik po 6 miesiącach (`calculate_half_year_etf_value`):** $V_{\text{etf, 6m}} = \text{int}(\text{round}(P \cdot \frac{(1 + i)^6 - 1}{i}))$.

#### Tabela referencyjna dokładnych wyników wzorów (Wektory testowe dla 3 person demo)

| Persona | `recommended_monthly` (widełki) | Horyzont $h$ | `total_paid` | `etf_value` | `cash_real_value` | `inflation_loss_vs_etf` | `win_rate` | `6m_etf` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `young_20` (22 l., 1000 wolne, brak poduszki) | `300` (`200–350`) | `15 lat` | `54 000` | `103 811` | `42 124` | `61 687` | `99%` | `1 830` |
| `mid_38` (38 l., 2500 wolne, ma poduszkę) | `1 250` (`1000–1500`) | `10 lat` | `150 000` | `228 683` | `126 738` | `101 945` | `96%` | `7 626` |
| `senior_56` (56 l., 3000 wolne, ma poduszkę) | `1 200` (`900–1500`) | `7 lat` | `100 800` | `134 536` | `89 453` | `45 083` | `93%` | `7 321` |

---

## 4. Pełne modele Pydantic (`backend/schemas.py`)
Skopiuj poniższy kod 1:1 do `backend/schemas.py`:

```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

AgeGroup = Literal["20+", "30-50", "50+"]


class DemoPersona(BaseModel):
    id: str
    short_label: str
    full_label: str
    age: int
    net_income: int
    free_cash: int
    has_emergency_fund: bool


class OnboardingRequest(BaseModel):
    age: int = Field(..., ge=18, le=85)
    net_income: int = Field(..., ge=1000, le=100000)
    free_cash: int = Field(..., ge=100, le=50000)
    has_emergency_fund: bool = False


class SafeInvestmentAdvice(BaseModel):
    min_monthly: int
    max_monthly: int
    recommended_monthly: int
    reasoning: str


class RoadmapMilestone(BaseModel):
    day: int
    title: str
    focus: str
    status: Literal["active", "locked"] = "locked"


class MicroLessonCard(BaseModel):
    id: str
    title: str
    duration_sec: int = 20
    summary: str
    key_takeaway: str
    xp_reward: int = 15


class SpeaklyFilter(BaseModel):
    time_saved_hours: float
    kept_topics: list[str]
    removed_topics: list[str]


class ProjectionPoint(BaseModel):
    year: int
    total_paid: int
    etf_value: int
    cash_real_value: int
    inflation_loss_vs_etf: int
    historical_win_rate: int


class PortfolioStatus(BaseModel):
    simulated_value: int
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
    projected_etf_value: int
    projected_cash_real_value: int
    historical_win_rate: int


class MissionTurnResponse(BaseModel):
    step_number: int = Field(..., ge=1, le=3)
    total_steps: int = 3
    confidence_score: int = Field(..., ge=0, le=100)
    confidence_delta: int = 0
    understanding_feedback: Optional[str] = None
    luna_message: str
    quick_replies: list[str]
    portfolio_status: PortfolioStatus
    gamification: GamificationState
    trigger_confetti: bool = False
    mission_completed: bool = False
    real_world_challenge: Optional[RealWorldChallenge] = None
    leaderboard: Optional[list[LeaderboardEntry]] = None
    final_checklist: Optional[list[ChecklistItem]] = None
    bank_draft: Optional[BankDraft] = None


class OnboardingResponse(BaseModel):
    session_id: str
    age_group: AgeGroup
    persona_label: str
    default_horizon_years: int
    current_day: int = 1
    total_program_days: int = 14
    safe_investment: SafeInvestmentAdvice
    speakly_filter: SpeaklyFilter
    roadmap_milestones: list[RoadmapMilestone]
    micro_lessons: list[MicroLessonCard]
    projection_series: list[ProjectionPoint]
    initial_mission_turn: MissionTurnResponse


class MissionTurnRequest(BaseModel):
    session_id: str
    user_message: str = Field(..., min_length=1, max_length=600)


class ChallengeAcceptRequest(BaseModel):
    session_id: str


class ChallengeAcceptResponse(BaseModel):
    xp: int
    reward_xp: int
    leaderboard: list[LeaderboardEntry]
```

---

## 5. Specyfikacja Endpointów (`backend/main.py`)

| Metoda i ścieżka | Opis działania | Model wejścia / wyjścia |
| :--- | :--- | :--- |
| `GET /` | Zwraca `static/index.html` (`FileResponse`), a gdy `static/` nie istnieje jeszcze w trakcie dev — tymczasowy JSON ze statusem i linkiem do `/docs`. Zamontować `/static` warunkowo (`if STATIC_DIR.is_dir():`). | HTML |
| `GET /api/demo-personas` | Zwraca listę 3 gotowych person (`young_20`, `mid_38`, `senior_56`). | `list[DemoPersona]` |
| `POST /api/onboarding/analyze` | Generuje `session_id`, wylicza `finance_math`, dobiera filtr Speakly, 4 kamienie milowe mapy 14 dni (`roadmap_milestones`), 3 `micro_lessons` i Krok 1 symulacji Dnia 1 (`confidence_score = 10`, `GamificationState`: Poziom 1, 20 XP, Streak 1), **zapisuje `MissionSession` w PostgreSQL**. | `OnboardingRequest` -> `OnboardingResponse` |
| `POST /api/mission/turn` | Pobiera `MissionSession` z PostgreSQL (`404` jeśli brak), pobiera rekordy `leaderboard_entries`, wywołuje `luna_service.process_mission_turn(session_dict, req.user_message, leaderboard_rows)`, zapisuje zaktualizowany krok (`<= 3`), `confidence_score`, `xp` i `history` w PostgreSQL, a w Kroku 3 dokleja `real_world_challenge`, `leaderboard`, `final_checklist` i `bank_draft`. | `MissionTurnRequest` -> `MissionTurnResponse` |
| `POST /api/challenge/accept` | Pobiera `MissionSession` z PostgreSQL (`404` jeśli brak). Jeśli `challenge_accepted` jest `False` -> ustawia `True`, dodaje `+50 XP`, zapisuje w bazie i zwraca `reward_xp=50` + posortowany `leaderboard`. Przy ponownym wywołaniu jest idempotentny: zwraca `reward_xp=0`, niezmienione `xp` i aktualny `leaderboard`. | `ChallengeAcceptRequest` -> `ChallengeAcceptResponse` |

---

## 6. Przykład finałowej odpowiedzi Kroku 3 Dnia 1 (`mission_completed: true`)
Aby frontendowiec (Osoba 3) miał 100% jasności przy budowaniu Ekranu 4:

```json
{
  "step_number": 3,
  "total_steps": 3,
  "confidence_score": 40,
  "confidence_delta": 10,
  "understanding_feedback": "Świetny refleks! Widzisz już, jak czas i procent składany budują przewagę nad gotówką zjadaną przez inflację.",
  "luna_message": "Dzień 1 z 14 zaliczony i awansujesz na Poziom 2! Twoja gotowość inwestycyjna wzrosła dziś z 10% do 40%. Zrób dziś małe wyzwanie za 5 zł, utrzymaj serię i widzimy się jutro na Dniu 2!",
  "quick_replies": [],
  "portfolio_status": {
    "simulated_value": 103811,
    "event_badge": "Dzień 1 ukończony • Cel: 15 lat"
  },
  "gamification": {
    "level": 2,
    "level_title": "Świadomy Start",
    "xp": 155,
    "next_level_xp": 250,
    "xp_gained": 60,
    "leveled_up": true,
    "streak_days": 1
  },
  "trigger_confetti": true,
  "mission_completed": true,
  "real_world_challenge": {
    "title": "Realne wyzwanie Dnia 1: Wpłać 5 zł na konto oszczędnościowe",
    "description": "Zanim za 2 tygodnie ruszysz z regularnym ETF-em, przełam dziś barierę pierwszego przelewu symboliczną kwotą 5 zł i podtrzymaj swoją serię!",
    "amount_pln": 5,
    "target_account": "Konto Oszczędnościowe Commerzbank",
    "reward_xp": 50
  },
  "leaderboard": [
    {"rank": 1, "name": "Kasia K.", "level_title": "Świadomy Start", "xp": 210, "streak_days": 5, "is_current_user": false},
    {"rank": 2, "name": "Ty (Awans!)", "level_title": "Świadomy Start", "xp": 155, "streak_days": 1, "is_current_user": true},
    {"rank": 3, "name": "Tomek W.", "level_title": "Obserwator", "xp": 95, "streak_days": 2, "is_current_user": false},
    {"rank": 4, "name": "Marek Z.", "level_title": "Obserwator", "xp": 40, "streak_days": 1, "is_current_user": false}
  ],
  "final_checklist": [
    {"id": "chk_1", "text": "Znam swoją docelową kwotę miesięczną: 300 zł/mies.", "detail": "Bez naruszania codziennego budżetu i poduszki."},
    {"id": "chk_2", "text": "Wiem, że gotówka na koncie traci wartość przez inflację.", "detail": "Różnica po 15 latach sięga kilkudziesięciu tysięcy zł."},
    {"id": "chk_3", "text": "Rozumiem, że środki w ETF są płynne i nie są zamrożone.", "detail": "W nagłej potrzebie mogę je wypłacić w 2–3 dni robocze."},
    {"id": "chk_4", "text": "Wracam jutro na 5-minutowy Dzień 2 (temat: jak reagować na spadki).", "detail": "Regularność w 14 dni buduje prawdziwą pewność siebie."}
  ],
  "bank_draft": {
    "monthly_amount": 300,
    "horizon_years": 15,
    "instrument_category": "Szeroki globalny fundusz ETF (edukacyjny wzorzec na Dzień 14)",
    "projected_etf_value": 103811,
    "projected_cash_real_value": 42124,
    "historical_win_rate": 99
  }
}
```

*(Wartości `103811` i `42124` pochodzą bezpośrednio z deterministycznych wzorów w §3D dla `recommended_monthly = 300` i `horizon_years = 15`.)*