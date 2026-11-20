# 02. SSOT Architektury Python, Matematyki i Kontraktu API

Ten dokument jest **wiążącym kontraktem technicznym**. Nazwy plików, endpointów i pól JSON muszą zgadzać się co do znaku między backendem (Osoba 1 i 2) a frontendem (Osoba 3).

---

## 1. Dokładna struktura projektu
```text
finance-quest/
├── AGENTS.md
├── requirements.txt
├── .env
├── .env.example
├── docs/
│   ├── 01_PRODUCT_AND_GUI_SPEC.md
│   ├── 02_TECH_API_AND_MATH.md
│   └── 03_LUNA_INTEGRATION_AND_PROMPTS.md
├── backend/
│   ├── __init__.py
│   ├── main.py            # FastAPI app, CORS, trasy API, serwowanie /static
│   ├── schemas.py         # Wszystkie modele Pydantic (100% kontraktu poniżej)
│   ├── finance_math.py    # Deterministyczne obliczenia ETF, inflacji i widełek
│   ├── demo_data.py       # 3 persony, filtry Speakly i fallbacki misji
│   └── luna_service.py    # Adaptacja modułu Luny + System Prompt + fallback
└── static/
    ├── index.html         # Kompletny SPA (4 ekrany + modal)
    ├── app.js             # Logika UI, Chart.js, animacje, fetch API
    └── styles.css         # Animacje CSS (btn-3d, shimmer, strike, pulse)
```

---

## 2. Deterministyczna Matematyka Finansowa (`backend/finance_math.py`)

**ZASADA:** LLM nigdy nie liczy pieniędzy ani procentów. Wszystkie wartości oblicza `finance_math.py`, a Luna otrzymuje gotowe liczby w prompcie.

### A. Stałe edukacyjne (uśrednione dane historyczne szerokiego rynku globalnego)
* Nominalna średnia roczna stopa zwrotu szerokiego ETF: $r_{\text{etf}} = 0.08$ ($8.0\%$ rocznie).
* Średnia roczna inflacja (utrata siły nabywczej gotówki na koncie $0\%$): $r_{\text{inf}} = 0.035$ ($3.5\%$ rocznie).
* **Historyczny odsetek okresów kończących się zyskiem** (`HISTORICAL_WIN_RATE`):
  * $1$ rok: $73\%$
  * $3$ lata: $84\%$
  * $5$ lat: $90\%$
  * $7$ lat: $93\%$
  * $10$ lat: $96\%$
  * $15$ lat: $99\%$
  * $20$ lat: $100\%$
  *(Dla pozostałych lat $t \in \{1, \dots, 20\}$ stosować liniową interpolację zaokrągloną do liczby całkowitej `int`).*

### B. Klasyfikacja grupy wiekowej (`get_age_group`)
* `age < 30` -> `age_group = "20+"`, `default_horizon_years = 15`, `persona_label = "Młody Start (20+)"`
* `30 <= age <= 50` -> `age_group = "30-50"`, `default_horizon_years = 10`, `persona_label = "Kariera i Rodzina (30–50)"`
* `age > 50` -> `age_group = "50+"`, `default_horizon_years = 7`, `persona_label = "Ochrona Kapitału (50+)"`

### C. Wyliczanie bezpiecznej miesięcznej kwoty (`calculate_safe_investment`)
Wejście: `age: int`, `net_income: float`, `free_cash: float`, `has_emergency_fund: bool`.
1. Zabezpieczenie brzegowe: jeśli `free_cash < 100`, przyjmij `effective_free = 100`.
2. Dobór widełek procentowych od `effective_free`:
   * Jeśli `has_emergency_fund is False`:
     * `min_pct = 0.20`, `max_pct = 0.35`
     * `reasoning`: *"Budujesz jeszcze poduszkę bezpieczeństwa, więc na start wystarczy 20–35% wolnych środków. Resztę odkładaj na poduszkę, a małą kwotą bezpiecznie przełamiesz barierę startu."*
   * Jeśli `has_emergency_fund is True`:
     * Dla `20+`: `min_pct = 0.50`, `max_pct = 0.70`, `reasoning`: *"Masz już poduszkę i najcenniejszy zasób — czas. Przeznaczenie 50–70% wolnych środków na szeroki ETF uruchomi potężny efekt procentu składanego."*
     * Dla `30-50`: `min_pct = 0.40`, `max_pct = 0.60`, `reasoning`: *"Masz zabezpieczoną poduszkę rodzinną, więc 40–60% wolnych nadwyżek może automatycznie pracować w szerokich ETF-ach w tle, bez tracenia Twojego czasu."*
     * Dla `50+`: `min_pct = 0.30`, `max_pct = 0.50`, `reasoning`: *"Masz solidną poduszkę, dlatego 30–50% wolnych środków możesz bezpiecznie skierować do szerokich ETF-ów, aby chronić swój kapitał przed inflacją."*
3. Zaokrąglanie (czytelne kwoty na demo):
   * Funkcja pomocnicza `round_to_50(val) = max(100, int(round(val / 50.0) * 50))`.
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
* **Wartości zaokrąglamy do pełnych złotówek (`int(round(...))`).**

---

## 3. Pełne modele Pydantic (`backend/schemas.py`)
Skopiuj poniższy plik 1:1 do `backend/schemas.py` — gwarantuje pełną zgodność między backendem, Luną i frontendem:

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
    trigger_confetti: bool = False
    mission_completed: bool = False
    final_checklist: Optional[list[ChecklistItem]] = None
    bank_draft: Optional[BankDraft] = None


class OnboardingResponse(BaseModel):
    session_id: str
    age_group: AgeGroup
    persona_label: str
    default_horizon_years: int
    safe_investment: SafeInvestmentAdvice
    speakly_filter: SpeaklyFilter
    projection_series: list[ProjectionPoint]
    initial_mission_turn: MissionTurnResponse


class MissionTurnRequest(BaseModel):
    session_id: str
    user_message: str = Field(..., min_length=1, max_length=600)
```

---

## 4. Specyfikacja Endpointów (`backend/main.py`)

| Metoda i ścieżka | Opis działania | Model wejścia / wyjścia |
| :--- | :--- | :--- |
| `GET /` | Zwraca `static/index.html` (`FileResponse`). Dodatkowo zamontować `/static` przez `StaticFiles`. | HTML |
| `GET /api/demo-personas` | Zwraca listę 3 gotowych person (`young_20`, `mid_38`, `senior_56`) do paska Demo Mode. | `list[DemoPersona]` |
| `POST /api/onboarding/analyze` | Generuje `session_id` (`uuid4().hex[:8]`), wylicza `finance_math`, dobiera filtr Speakly, przygotowuje Krok 1 misji, zapisuje sesję w `SESSIONS[session_id]` i zwraca komplet danych dla Ekranu 2 i startu Ekranu 3. | `OnboardingRequest` -> `OnboardingResponse` |
| `POST /api/mission/turn` | Pobiera sesję z `SESSIONS` (jeśli brak `session_id` -> `404`), wywołuje `luna_service.process_mission_turn(session, req.user_message)`, aktualizuje `current_step` w sesji i zwraca kolejny krok lub zakończenie z `final_checklist` i `bank_draft`. | `MissionTurnRequest` -> `MissionTurnResponse` |

---

## 5. Przykład odpowiedzi końcowej (Krok 3 — `mission_completed: true`)
Aby frontendowiec (Osoba 3) mógł od razu zbudować Ekran 4 na 100% zgodny z backendem:

```json
{
  "step_number": 3,
  "total_steps": 3,
  "confidence_score": 100,
  "confidence_delta": 20,
  "understanding_feedback": "Świetne podejście! Widzisz już wyraźnie różnicę między spokojnym budowaniem kapitału w czasie a utratą wartości gotówki przez inflację.",
  "luna_message": "Misja ukończona! W 3 minuty opanowałeś najważniejsze zasady, które decydują o sukcesie początkującego inwestora. Odhacz swoją checklistę poniżej i zobacz gotowy szkic pierwszego kroku.",
  "quick_replies": [],
  "portfolio_status": {
    "simulated_value": 104515,
    "event_badge": "Horyzont 15 lat osiągnięty!"
  },
  "trigger_confetti": true,
  "mission_completed": true,
  "final_checklist": [
    {
      "id": "chk_1",
      "text": "Mam wyznaczoną bezpieczną kwotę startową: 300 zł/mies.",
      "detail": "Bez naruszania codziennego budżetu i budowy poduszki."
    },
    {
      "id": "chk_2",
      "text": "Rozumiem, że gotówka na koncie traci realną wartość przez inflację.",
      "detail": "Po 15 latach na zwykłym koncie tracisz tysiące złotych siły nabywczej."
    },
    {
      "id": "chk_3",
      "text": "Wiem, dlaczego szeroki ETF na 15 lat minimalizuje ryzyko.",
      "detail": "Historycznie aż 99% okresów 15-letnich kończyło się zyskiem."
    },
    {
      "id": "chk_4",
      "text": "Wiem, że środki w ETF są płynne i nie są zamrożone na zawsze.",
      "detail": "W nagłej sytuacji możesz sprzedać część jednostek w kilka dni roboczych."
    }
  ],
  "bank_draft": {
    "monthly_amount": 300,
    "horizon_years": 15,
    "instrument_category": "Szeroki globalny fundusz ETF (edukacyjny wzorzec)",
    "projected_etf_value": 104515,
    "projected_cash_real_value": 41890,
    "historical_win_rate": 99
  }
}
```