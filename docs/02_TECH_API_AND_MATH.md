# 02. SSOT Architektury Python, Bazy Docker, Matematyki i Kontraktu API

Ten dokument jest **wiążącym kontraktem technicznym**. Nazwy plików, tabel, endpointów i pól JSON muszą zgadzać się co do znaku między backendem (Osoba 1 i 2) a frontendem (Osoba 3).

> **Wersja v3 (scalona).** Łączy wersję zespołu (PostgreSQL, 14 dni, grywalizacja, Contract Lock) z poprawkami jakościowymi z `oprawki_claude.txt` (uczciwe porównanie ETF vs gotówka, tryby planu 80/20, deterministyczna ocena kart, `main_concern`). Wszystkie zmiany kontraktu względem poprzedniej wersji są wypisane w `WORKLOG.md` (sekcja 3, punkt 9).

---

## 1. Dokładna struktura projektu
```text
finance-quest/
├── AGENTS.md
├── WORKLOG.md
├── docker-compose.yml     # Lekki PostgreSQL 16 (docker compose up -d)
├── requirements.txt
├── .env                   # NIGDY w repo
├── .env.example
├── .gitignore
├── docs/
│   ├── 01_PRODUCT_AND_GUI_SPEC.md
│   ├── 02_TECH_API_AND_MATH.md
│   └── 03_LUNA_INTEGRATION_AND_PROMPTS.md
├── scripts/
│   ├── check_math.py      # wzory vs przykład JSON i tabela §3G (Osoba 2)
│   └── smoke_test.py      # Golden Path dla 3 person z DEMO_OFFLINE=1 (Osoba 1)
├── backend/
│   ├── __init__.py
│   ├── database.py        # SQLAlchemy + init_db() z seedem (+ bezpiecznik, §2A)
│   ├── models.py          # 2 tabele ORM: MissionSession, LeaderboardRow
│   ├── main.py            # FastAPI app, trasy API, serwowanie /static
│   ├── schemas.py         # Wszystkie modele Pydantic (100% kontraktu poniżej)
│   ├── finance_math.py    # Deterministyczne obliczenia ETF, inflacji, podziału 80/20
│   ├── demo_data.py       # Persony, mapa 14 dni, mikro-lekcje, kroki misji, wyzwania, seed rankingu
│   └── luna_service.py    # AI Coach: ocena wolnego tekstu (LLM) + proces tury + fallback
└── static/
    ├── index.html         # SPA bez npm (4 ekrany + modal)
    ├── app.js             # Logika UI, Chart.js, animacje, grywalizacja, fetch API
    ├── styles.css         # Animacje CSS + @font-face
    └── vendor/            # Biblioteki LOKALNIE (offline-safe) — docs/01 §5
```

---

## 2. Podstawowa Baza Danych w Dockerze (`backend/database.py` i `backend/models.py`)

**ZASADA PROSTOTY:** Zero Alembica, zero migracji. Przy starcie FastAPI (`lifespan` lub `on_event("startup")`) wołamy `init_db()`: `Base.metadata.create_all(bind=engine)` + seed tabeli `leaderboard_entries` 3 znajomymi (jeśli pusta).

### A. Konfiguracja połączenia (`backend/database.py`)
* `load_dotenv()`, `DATABASE_URL` z `.env` (domyślnie `postgresql+psycopg2://finance:finance@localhost:5432/finance_quest`; **jawny sterownik `+psycopg2` jest obowiązkowy** — SQLAlchemy 2.1 dla gołego `postgresql://` używa `psycopg` v3, którego nie ma w `requirements.txt`).
* Udostępnia `engine`, `SessionLocal`, `Base`, generator `get_db()`.
* **Bezpiecznik prezentacji (nowość v3):** jeśli przy starcie połączenie z PostgreSQL zawiedzie (np. Docker nie uruchomiony), `init_db()` loguje wyraźny komunikat `Uruchom bazę: docker compose up -d` i **przełącza się na SQLAlchemy `sqlite://` w pamięci** (`StaticPool`, te same modele) — dzięki temu demo nie umiera z powodu jednego niewłączonego kontenera. To plan B, nie docelowa baza; środowisko docelowe i opis architektury to nadal PostgreSQL.

### B. Dokładne 2 tabele ORM (`backend/models.py`)
```python
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
Wartości pochodne (ETF nominalny/realny, gotówka realna, `half_year_value`, itd.) **nie są przechowywane** — `main.py` wylicza je przy każdej turze funkcją `finance_math.build_session_facts(...)` (§F) i dokleja do `session_data`.

### C. Jak aplikacja korzysta z bazy
1. **Start (`init_db`):** jeśli `leaderboard_entries` jest pusta -> 3 rekordy seed (`Kasia K.` 210 XP / 5 dni / „Świadomy Start", `Tomek W.` 95 XP / 2 dni, `Marek Z.` 40 XP / 1 dzień).
2. **`POST /api/onboarding/analyze`:** liczy plan, wylicza fakty, buduje turę startową, **zapisuje `MissionSession`** (łącznie z `current_options` kroku 1) i `commit()`.
3. **`POST /api/mission/turn`:** wczytuje `MissionSession`, buduje `session_data` (kolumny + fakty), wywołuje `luna_service.process_mission_turn(...)`. Funkcja **modyfikuje `session_data` in place** (pola: `current_step`, `confidence_score`, `xp`, `mission_completed`, `current_options`, `history`); `main.py` zapisuje te pola do bazy (dla `history` nadpisuje nową listę: `session.history = list(...)`, żeby SQLAlchemy wykrył zmianę JSON) i `commit()`.
4. **`POST /api/challenge/accept`:** idempotentnie ustawia `challenge_accepted = True`, `xp += 50`, zwraca `leaderboard`.

### D. Konwencje wykonawcze i kontrakt międzymodułowy
* **Synchroniczne `def` w całym backendzie** (trasy, `finance_math`, `demo_data`, `luna_service`) — współpraca z sync SQLAlchemy (`psycopg2-binary`) i klientem `openai.OpenAI`.
* **`load_dotenv()`** w `backend/database.py` i `backend/luna_service.py` przed odczytem zmiennych.
* **Warunkowe montowanie `/static`:** `if STATIC_DIR.is_dir(): app.mount("/static", ...)`; `GET /` zwraca `static/index.html` albo tymczasowy JSON z linkiem do `/docs`.
* **Format `MissionSession.history`:** `[{"role": "assistant" | "user", "content": str}]`. W `analyze` zapisujemy `[{"role": "assistant", "content": initial_mission_turn.luna_message}]`; w `turn` dopisujemy wiadomość użytkownika i odpowiedź Luny.
* **Idempotencja po zakończeniu misji:** gdy `mission_completed == True`, `POST /api/mission/turn` zwraca niezmienioną odpowiedź finałową Kroku 3 (bez zmiany XP/gotowości i bez błędu walidacji). `current_step` nigdy nie przekracza `3`.
* **Niezależność Osoby 2 od SQLAlchemy:** `luna_service.py` i `demo_data.py` nie importują nic z SQLAlchemy; całym zapisem zajmuje się `main.py` (Osoba 1).

---

## 3. Deterministyczna Matematyka Finansowa (`backend/finance_math.py`)

**ZASADA:** LLM nigdy nie liczy pieniędzy ani procentów. Wszystkie wartości oblicza `finance_math.py`, teksty z liczbami składa Python (`demo_data.py`).

**ZASADA UCZCIWEGO PORÓWNANIA:** ETF i gotówka są **zawsze porównywane w tej samej jednostce** — domyślnie w „dzisiejszych złotych" (wartości *realne*, wspólny deflator). Wartość nominalną ETF pokazujemy tylko jako informację dodatkową.

### A. Stałe edukacyjne (jawne założenia pokazywane użytkownikowi)
* Nominalna średnia roczna stopa ETF **brutto**: `R_GROSS = 0.06`; roczne koszty (TER + spread): `R_COSTS = 0.003`; stopa symulacji **netto, przed podatkiem**: `R_ETF = 0.057` (5,7%).
* Inflacja: `R_INF = 0.035` (3,5%). Gotówka na koncie: 0% odsetek.
* **Nie uwzględniamy** podatku od zysków (19% w PL), opłat brokera i ryzyka walutowego — UI informuje o tym jawnie.
* `Assumptions.text`: *„Założenia edukacyjne: 5,7% rocznie po kosztach (przed podatkiem 19%), inflacja 3,5% rocznie, wartości w dzisiejszych złotych. To nie jest prognoza ani gwarancja."*

### B. Historyczny odsetek okresów z dodatnim wynikiem realnym — **WARTOŚCI ILUSTRACYJNE**
> **Osoba 2 (przed demo):** tabela poniżej jest **placeholderem bez źródła**. Zastąp ją wartościami policzonymi z publicznych danych (np. kroczące okna miesięczne MSCI World, wynik realny, regularne wpłaty), wpisz źródło/okres/walutę do stopki Ekranu 2 i usuń limit, gdy dane są policzone. Do tego czasu UI oznacza wartość jako „ilustracyjna".

Klucze: 1→73, 3→84, 5→90, 7→93, 10→96, 15→99, 20→100 (interpolacja liniowa, `int(round(...))`). **Limit wyświetlania `min(97, wartość)`** — nigdy 98–100% ani sformułowanie „bez straty".

```python
_WR_KEYS = {1: 73, 3: 84, 5: 90, 7: 93, 10: 96, 15: 99, 20: 100}
DISPLAY_CAP = 97

def historical_win_rate(year: int) -> int:
    keys = sorted(_WR_KEYS)
    if year <= keys[0]:
        v = _WR_KEYS[keys[0]]
    else:
        for a, b in zip(keys, keys[1:]):
            if a <= year <= b:
                v = _WR_KEYS[a] + (_WR_KEYS[b] - _WR_KEYS[a]) * (year - a) / (b - a)
                break
    return min(DISPLAY_CAP, int(round(v)))
```

### C. Klasyfikacja grupy wiekowej (`get_age_group`) — jedyna funkcja klasyfikacji
Wiek określa **horyzont i ton**, nie lęk (lęk wybiera użytkownik: `main_concern`).
* `age < 30` -> `("20+", 15, "Młody Start (20+)")`
* `30 <= age <= 50` -> `("30-50", 10, "Kariera i Rodzina (30–50)")`
* `age > 50` -> `("50+", 7, "Ochrona Kapitału (50+)")`

### D. Podział wolnych środków i kwota startowa (`calculate_safe_investment`)
Wejście: `age`, `net_income`, `free_cash`, `has_emergency_fund`. Pomocnicza: `round_to_50(val) = max(100, int(round(val / 50.0) * 50))`. Trzy tryby (`plan_type`):

1. **`savings_first`** — brak poduszki **i** `free_cash < 300`: `training_etf_monthly = 0`, `emergency_savings_monthly = free_cash`, `recommended_monthly = 100` z `illustrative_only = True` (kwota **wyłącznie do przykładowego wykresu**, nie zalecenie). `reasoning`: *„Najpierw poduszka. Przy Twoich wolnych środkach najlepszy pierwszy krok to konto oszczędnościowe, a nie inwestycja. Poniżej pokazujemy na przykładzie 100 zł miesięcznie, jak mogłoby to wyglądać, gdy poduszka będzie gotowa."*
2. **`split`** — brak poduszki i `free_cash >= 300` (80/20): `training_etf_monthly = min(free_cash, max(100, round_to_50(free_cash * 0.20)))`, `emergency_savings_monthly = free_cash - training_etf_monthly`, `recommended = min = max = training_etf_monthly`. Dla `free_cash >= 500` ścisłe 80/20 (1000 zł -> 800 + 200). `reasoning`: *„Najpierw budujesz warstwę bezpieczeństwa: ok. 80% wolnych środków odkładasz na poduszkę, a ok. 20% (co najmniej 100 zł) kierujesz na symboliczny trening w szeroki ETF. To kwota edukacyjna, nie zalecenie zainwestowania wszystkich wolnych środków."*
3. **`invest`** — jest poduszka: procenty wg grupy (`20+`: 0.50–0.70; `30-50`: 0.40–0.60; `50+`: 0.30–0.50). `min_monthly = round_to_50(free_cash*min_pct)`, `max_monthly = max(min_monthly + 50, round_to_50(free_cash*max_pct))`, `recommended_monthly = round_to_50((min+max)/2)`, `emergency_savings_monthly = 0`, `training_etf_monthly = recommended_monthly`. `reasoning`: `20+` *„Masz już poduszkę i najcenniejszy zasób — czas. 50–70% wolnych środków w szerokim ETF pokazuje, jak działa efekt czasu."* · `30-50` *„Masz zabezpieczoną poduszkę rodzinną, więc 40–60% wolnych nadwyżek może pracować w szerokich ETF-ach w tle."* · `50+` *„Masz solidną poduszkę, dlatego 30–50% wolnych środków możesz skierować do szerokich ETF-ów jako potencjalną ochronę przed inflacją; resztę zostaw w bezpiecznych, dostępnych formach."*

> UI nazywa kwotę **„przykładową kwotą docelową"**, nigdy „bezpieczną".

```python
def calculate_safe_investment(age, net_income, free_cash, has_emergency_fund) -> SafeInvestmentAdvice:
    age_group, _, _ = get_age_group(age)
    if not has_emergency_fund and free_cash < 300:
        return SafeInvestmentAdvice(plan_type="savings_first", min_monthly=100, max_monthly=100,
            recommended_monthly=100, emergency_savings_monthly=int(free_cash), training_etf_monthly=0,
            illustrative_only=True, reasoning=REASONING_SAVINGS_FIRST)
    if not has_emergency_fund:
        etf = min(free_cash, max(100, round_to_50(free_cash * 0.20)))
        return SafeInvestmentAdvice(plan_type="split", min_monthly=etf, max_monthly=etf,
            recommended_monthly=etf, emergency_savings_monthly=int(free_cash - etf),
            training_etf_monthly=etf, illustrative_only=False, reasoning=REASONING_SPLIT)
    min_pct, max_pct, reasoning = INVEST_RULES[age_group]
    lo = round_to_50(free_cash * min_pct)
    hi = max(lo + 50, round_to_50(free_cash * max_pct))
    rec = round_to_50((lo + hi) / 2.0)
    return SafeInvestmentAdvice(plan_type="invest", min_monthly=lo, max_monthly=hi,
        recommended_monthly=rec, emergency_savings_monthly=0, training_etf_monthly=rec,
        illustrative_only=False, reasoning=reasoning)
```

### E. Projekcja 20-letnia (`generate_projection_series(monthly_amount)`)
Dla $P$ = `monthly_amount`, $i = R_{\text{etf}}/12$, roku $t \in \{1..20\}$ ($n=12t$):
* $V_{\text{paid}} = P\cdot n$ (to także gotówka nominalnie na koncie 0%)
* $V_{\text{etf,nom}} = P\cdot\frac{(1+i)^n-1}{i}$
* Wspólny deflator: $D(t) = (1+R_{\text{inf}})^t$
* $V_{\text{etf,real}} = V_{\text{etf,nom}}/D(t)$, $V_{\text{cash,real}} = V_{\text{paid}}/D(t)$, `real_gain_vs_cash` = różnica
* **Stres (edukacyjny):** `etf_stress_real_value = etf_real_value * mnożnik(t)`: `y3: 0.80`, `y4: 0.85`, `y5: 0.90`, `y6: 0.95`, pozostałe `1.00`. To nakładka ilustrująca spadek -20% w roku 3, **nie** pełna symulacja rynku.
* Wszystko `int(round(...))`.

```python
STRESS_MULTIPLIER = {3: 0.80, 4: 0.85, 5: 0.90, 6: 0.95}

def generate_projection_series(monthly_amount: int) -> list[dict]:
    i = R_ETF / 12
    pts = []
    for year in range(1, 21):
        n = 12 * year
        paid = monthly_amount * n
        nominal = monthly_amount * (((1 + i) ** n - 1) / i)
        d = (1 + R_INF) ** year
        etf_real, cash_real = nominal / d, paid / d
        pts.append({
            "year": year, "total_paid": paid,
            "etf_nominal_value": int(round(nominal)),
            "etf_real_value": int(round(etf_real)),
            "etf_stress_real_value": int(round(etf_real * STRESS_MULTIPLIER.get(year, 1.0))),
            "cash_real_value": int(round(cash_real)),
            "real_gain_vs_cash": int(round(etf_real)) - int(round(cash_real)),
            "historical_win_rate": historical_win_rate(year),
        })
    return pts

def calculate_etf_value_after_months(monthly_amount: int, months: int) -> int:
    i = R_ETF / 12
    return int(round(monthly_amount * (((1 + i) ** months - 1) / i)))

def calculate_half_year_etf_value(monthly_amount: int) -> int:   # sygnatura z Contract Lock
    return calculate_etf_value_after_months(monthly_amount, 6)
```

### F. Fakty sesji (`build_session_facts(session_columns) -> dict`)
Zwraca słownik doklejany do `session_data` (używany w tekstach `demo_data`):
`half_year_value`, `year3_paid = P*36`, `year3_value`, `year3_stress_value = int(round(year3_value*0.80))`, `etf_nominal_value`, `etf_real_value`, `cash_real_value`, `diff_value` (= `real_gain_vs_cash`), `win_rate`, wszystko dla `horizon_years` z `projection_series`; plus `free_cash`, `emergency_savings_monthly`, `recommended_monthly`.

### G. Mapy stałych
* Samoocena -> gotowość startowa: `CONFIDENCE_START = {1: 5, 2: 10, 3: 15, 4: 20, 5: 25}` (persony demo: `self_confidence_start = 2` -> **10%**).
* Gotowość po odpowiedzi: **+10** (optymalna) lub **+2** (nieoptymalna/nieoceniona), maks. 100. Po Dniu 1 z samymi dobrymi odpowiedziami: `start + 30` (dla demo **40%**).
* XP po odpowiedzi: krok 1 **+40**, krok 2 **+35**, krok 3 **+60** (odpowiedź nieoptymalna: połowa, zaokrąglona w dół: 20/17/30). XP startowe: 20.
* Poziomy: `xp < 100` -> poziom 1 „Obserwator" (`next_level_xp = 100`); `xp >= 100` -> poziom 2 „Świadomy Start" (`next_level_xp = 250`). `leveled_up = True` tylko w turze, w której próg 100 został przekroczony (praktycznie krok 3).

### H. Wartości referencyjne (do `scripts/check_math.py`; założenia z §A)

| Persona | P (zł/mies.) | Horyzont | Wpłacono | ETF nominalnie | ETF realnie | Gotówka realnie | Przewaga realna | Po 6 mies. | Rok 3: wpłacono / wartość / stres |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| `young_20` (22 l., 1000 wolne, brak poduszki) -> `split` 800 + 200 | 200 | 15 lat | 36 000 | 56 700 | 33 844 | 21 488 | 12 356 | 1 214 | 7 200 / 7 832 / 6 266 |
| `mid_38` (38 l., 2500 wolne, ma poduszkę) -> `invest` 1000–1500 | 1 250 | 10 lat | 150 000 | 201 548 | 142 881 | 106 338 | 36 543 | 7 590 | 45 000 / 48 950 / 39 160 |
| `senior_56` (56 l., 3000 wolne, ma poduszkę) -> `invest` 900–1500 | 1 200 | 7 lat | 100 800 | 123 518 | 97 084 | 79 228 | 17 856 | 7 286 | 43 200 / 46 992 / 37 594 |

---

## 4. Pełne modele Pydantic (`backend/schemas.py`)
Skopiuj poniższy plik 1:1 do `backend/schemas.py`:

```python
from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator

AgeGroup = Literal["20+", "30-50", "50+"]
MainConcern = Literal["freeze_money", "no_time", "lose_money", "too_late"]
PlanType = Literal["savings_first", "split", "invest"]


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


class MicroLessonCard(BaseModel):
    id: str
    title: str
    duration_sec: int = 20
    summary: str
    key_takeaway: str
    xp_reward: int = 15


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


class MissionTurnResponse(BaseModel):
    step_number: int = Field(..., ge=1, le=3)
    total_steps: int = 3
    confidence_score: int = Field(..., ge=0, le=100)   # w UI: „Gotowość"
    confidence_delta: int = 0
    confidence_start: int = Field(..., ge=0, le=100)
    understanding_feedback: Optional[str] = None
    is_optimal_choice: Optional[bool] = None           # None w turze startowej
    luna_message: str
    quick_replies: list[QuickReply]
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
    main_concern: MainConcern
    safe_investment: SafeInvestmentAdvice
    speakly_filter: SpeaklyFilter
    assumptions: Assumptions
    roadmap_milestones: list[RoadmapMilestone]
    micro_lessons: list[MicroLessonCard]
    projection_series: list[ProjectionPoint]
    initial_mission_turn: MissionTurnResponse


class MissionTurnRequest(BaseModel):
    session_id: str
    user_message: str = Field(..., min_length=1, max_length=600)
    quick_reply_id: Optional[str] = None   # gdy klik karty -> ocena deterministyczna (bez LLM)


class ChallengeAcceptRequest(BaseModel):
    session_id: str


class ChallengeAcceptResponse(BaseModel):
    xp: int
    reward_xp: int
    leaderboard: list[LeaderboardEntry]
```
Model `LunaAssessment` (odpowiedź LLM) jest zdefiniowany w docs/03 §4.

---

## 5. Specyfikacja Endpointów (`backend/main.py`)

| Metoda i ścieżka | Opis działania | Model wejścia / wyjścia |
| :--- | :--- | :--- |
| `GET /` | `static/index.html` (`FileResponse`) lub tymczasowy JSON z linkiem do `/docs`; `/static` montowany warunkowo. | HTML |
| `GET /api/demo-personas` | 3 persony: `young_20` (22 l., 4500/1000 zł, bez poduszki, `freeze_money`, samoocena 2), `mid_38` (38 l., 11000/2500, ma poduszkę, `no_time`, 2), `senior_56` (56 l., 9500/3000, ma poduszkę, `too_late`, 2). | `list[DemoPersona]` |
| `POST /api/onboarding/analyze` | Liczy `finance_math` (§3), wybiera filtr Speakly, 4 kamienie milowe, 3 mikro-lekcje i Krok 1 (gotowość = `confidence_start`, `GamificationState`: poziom 1, 20 XP, streak 1). Zero LLM. **Zapisuje `MissionSession`.** | `OnboardingRequest` -> `OnboardingResponse` |
| `POST /api/mission/turn` | Wczytuje sesję (brak -> `404`), buduje `session_data`, wywołuje `luna_service.process_mission_turn(...)`; zapisuje zmienione pola; w Kroku 3 odpowiedź zawiera `real_world_challenge`, `leaderboard`, `final_checklist`, `bank_draft`. | `MissionTurnRequest` -> `MissionTurnResponse` |
| `POST /api/challenge/accept` | Idempotentne: pierwsze wywołanie `+50 XP` i `challenge_accepted=True`; kolejne `reward_xp=0`. Zwraca posortowany `leaderboard`. | `ChallengeAcceptRequest` -> `ChallengeAcceptResponse` |

Obsługa błędów:
* Walidacja -> `422` (frontend pokazuje komunikat przy polu).
* **`404` dla `session_id`:** frontend **po cichu ponawia** `POST /api/onboarding/analyze` z ostatnio wysłanym profilem i odtwarza bieżący stan.
* **Nie uruchamiać `uvicorn --reload` na prezentacji i próbach generalnych** (restart procesu zrywa połączenia; w trybie SQLite-w-pamięci kasuje sesje).

---

## 6. Przykład odpowiedzi końcowej (Krok 3, `mission_completed: true`, `young_20`, wszystkie odpowiedzi optymalne)
Wartości z wzorów §3 (P = 200 zł, 15 lat, 5,7% netto, inflacja 3,5%). Gotowość 10 -> 40, XP 95 -> 155:

```json
{
  "step_number": 3,
  "total_steps": 3,
  "confidence_score": 40,
  "confidence_delta": 10,
  "confidence_start": 10,
  "understanding_feedback": "Dokładnie. Spadek na papierze to wahanie, a nie strata, dopóki nie sprzedajesz — i właśnie dlatego poduszka leży osobno. Historia nie gwarantuje przyszłości.",
  "is_optimal_choice": true,
  "luna_message": "Dzień 1 z 14 zaliczony! Przewijamy 15 lat: wpłaty na koncie 0% byłyby warte realnie ok. 21 488 zł, a w szerokim ETF historycznie ok. 33 844 zł (założenia edukacyjne). Zrób dziś małe wyzwanie i wróć jutro po Dzień 2.",
  "quick_replies": [],
  "portfolio_status": {
    "simulated_value": 56700,
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
    "description": "Zanim za 2 tygodnie ruszysz z pełnym planem, przełam dziś barierę pierwszego przelewu symboliczną kwotą 5 zł i zacznij swoją serię!",
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
    {"id": "chk_1", "text": "Mam przykładowy plan startowy: 800 zł/mies. na poduszkę i 200 zł/mies. na trening w szeroki ETF.", "detail": "Najpierw bezpieczeństwo, potem inwestowanie — bez naruszania codziennego budżetu."},
    {"id": "chk_2", "text": "Rozumiem, że gotówka na zwykłym koncie traci realną wartość przez inflację.", "detail": "W horyzoncie 15 lat wpłaty na koncie 0% mają realnie ok. 21 488 zł, a w szerokim ETF historycznie ok. 33 844 zł (założenia edukacyjne)."},
    {"id": "chk_3", "text": "Wiem, że poduszka służy na awarie, a środki w ETF nie są zamrożone.", "detail": "W ostateczności sprzedaż jednostek i wypłata zajmują zwykle kilka dni roboczych."},
    {"id": "chk_4", "text": "Wiem, że wahania (nawet -20%) są normalne — jutro na Dniu 2 ćwiczymy spokojne reagowanie.", "detail": "Regularność w 14 dni buduje prawdziwą pewność siebie."}
  ],
  "bank_draft": {
    "monthly_amount": 200,
    "horizon_years": 15,
    "instrument_category": "Szeroki globalny fundusz ETF (przykład edukacyjny na Dzień 14)",
    "projected_etf_real_value": 33844,
    "projected_etf_nominal_value": 56700,
    "projected_cash_real_value": 21488,
    "historical_win_rate": 97,
    "assumptions_text": "Założenia edukacyjne: 5,7% rocznie po kosztach (przed podatkiem 19%), inflacja 3,5% rocznie, wartości w dzisiejszych złotych. To nie jest prognoza ani gwarancja.",
    "costs_note": "Nie uwzględniono podatku od zysków, opłat brokera i ryzyka walutowego. Wyniki z przeszłości nie gwarantują przyszłych."
  }
}
```
> `scripts/check_math.py` porównuje te liczby z `generate_projection_series(200)[14]` (56 700 / 33 844 / 21 488) oraz z tabelą §3H.

---

## 7. Zmienne środowiskowe (`.env.example`)
```env
OPENAI_API_KEY=sk-twoj-klucz-lub-klucz-luny
LUNA_MODEL=gpt-4o-mini
LUNA_TIMEOUT_SECONDS=3.5
DATABASE_URL=postgresql+psycopg2://finance:finance@localhost:5432/finance_quest
DEMO_OFFLINE=0     # 1 = LLM wyłączony; wolny tekst dostaje od razu neutralny fallback (0 ms)
POSTGRES_PORT=5432 # port bazy na hoście (zmień, jeśli 5432 jest zajęty, i dopasuj DATABASE_URL)
```

---

## 8. Skrypty kontrolne (jedyny dozwolony „test")
* **`scripts/check_math.py` (Osoba 2):** porównuje `finance_math` z tabelą §3H i przykładem §6.
* **`scripts/smoke_test.py` (Osoba 1):** dla 3 person, `DEMO_OFFLINE=1`, na `TestClient`/HTTP: ścieżka gotowości 10 -> 20 -> 30 -> 40 i XP 20 -> 60 -> 95 -> 155 przy samych optymalnych kartach; dla `savings_first` brak ETF (`training_etf_monthly == 0`); odpowiedź nieoptymalna daje `+2` gotowości i brak konfetti; wolny tekst przy `DEMO_OFFLINE=1` daje neutralny fallback; po Kroku 3 `quick_replies == []`, komplet `final_checklist`/`bank_draft`/`leaderboard`; powtórne `POST /api/mission/turn` jest idempotentne; `POST /api/challenge/accept` dwukrotnie -> `+50` i `0` XP.

---

## 9. Kontrakt dwujęzyczności (`PL / EN`)

* **Typ i wartość domyślna (`backend/schemas.py`):**
  * `Language = Literal["pl", "en"]` (domyślnie `"pl"` — 100% wstecznej kompatybilności z istniejącymi testami i `scripts/check_math.py`).
  * `OnboardingRequest.lang: Language = "pl"`
  * `OnboardingResponse.lang: Language = "pl"`
  * `MissionTurnRequest.lang: Optional[Language] = None` (gdy podane, pozwala zmienić język aktywnej sesji od tej tury).
  * `ChallengeAcceptRequest.lang: Optional[Language] = None`
* **Baza danych (`backend/models.py`, `backend/database.py`):**
  * Kolumna `MissionSession.lang = Column(String(2), default="pl", nullable=False)`.
  * W `init_db()` (po `Base.metadata.create_all`, dla dialektu `postgresql`): wykonać bezpieczne `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lang VARCHAR(2) NOT NULL DEFAULT 'pl'` (bez Alembica; gwarantuje kompatybilność z istniejącym wolumenem `pgdata` w Dockerze).
* **Matematyka (`backend/finance_math.py`):**
  * Opcjonalny parametr `lang: Language = "pl"` w `get_age_group(age, lang="pl")` (`persona_label`) oraz `calculate_safe_investment(..., lang="pl")` (`reasoning`).
  * `build_session_facts(session_columns)` przekazuje `lang = s.get("lang", "pl")` do słownika faktów sesji.
  * **Brak przeliczania walut:** wszystkie liczby referencyjne (§3H) i `scripts/check_math.py` pozostają identyczne; w wersji EN UI używa etykiety `PLN`.
* **Endpointy (`backend/main.py`):**
  * `GET /api/demo-personas?lang=pl` (`lang: Language = "pl"`) — zwraca persony z przetłumaczonymi etykietami (`demo_data.get_demo_personas(lang)`).
  * `POST /api/onboarding/analyze` — zapisuje `session.lang = req.lang` i przekazuje `lang=req.lang` do `finance_math` i `demo_data`.
  * `POST /api/mission/turn` i `POST /api/challenge/accept` — jeśli `req.lang is not None`, aktualizują `session.lang = req.lang`; przekazują aktualny `lang` sesji do `luna_service` i `demo_data`.
