# 02. SSOT Architektury Python, Matematyki i Kontraktu API

Ten dokument jest **wiążącym kontraktem technicznym**. Nazwy plików, endpointów i pól JSON muszą zgadzać się co do znaku między backendem (Osoba 1 i 2) a frontendem (Osoba 3).

---

## 1. Dokładna struktura projektu
```text
finance-quest/
├── AGENTS.md
├── requirements.txt
├── .env                    # NIGDY w repo
├── .env.example
├── .gitignore              # .env, __pycache__/, .venv/, .idea/   (static/vendor/ NIE ignorować!)
├── docs/
│   ├── 01_PRODUCT_AND_GUI_SPEC.md
│   ├── 02_TECH_API_AND_MATH.md
│   └── 03_LUNA_INTEGRATION_AND_PROMPTS.md
├── scripts/
│   ├── check_math.py       # porównuje wzory z przykładem JSON z §6 (30 linii)
│   └── smoke_test.py       # Golden Path dla 3 person z wyłączonym LLM (patrz §8)
├── backend/
│   ├── __init__.py
│   ├── main.py             # FastAPI app, CORS, trasy API, serwowanie /static
│   ├── schemas.py          # Wszystkie modele Pydantic (100% kontraktu poniżej)
│   ├── finance_math.py     # Deterministyczne obliczenia ETF, inflacji, podziału 80/20
│   ├── demo_data.py        # 3 persony, filtry Speakly, kroki misji, fallbacki
│   └── luna_service.py     # Ocena wolnego tekstu przez LLM + System Prompt + fallback
└── static/
    ├── index.html          # Kompletny SPA (4 ekrany + modal)
    ├── app.js              # Logika UI, Chart.js, animacje, fetch API
    ├── styles.css          # Animacje CSS + @font-face
    └── vendor/             # Biblioteki LOKALNIE (offline-safe) — patrz docs01 §4
```

---

## 2. Deterministyczna Matematyka Finansowa (`backend/finance_math.py`)

**ZASADA:** LLM nigdy nie liczy pieniędzy ani procentów. Wszystkie wartości oblicza `finance_math.py`, a treści z liczbami składa Python (`demo_data.py`).

**ZASADA UCZCIWEGO PORÓWNANIA:** ETF i gotówka są **zawsze porównywane w tej samej jednostce**. Domyślnie w „dzisiejszych złotych" (siła nabywcza, wartości *realne*). Wartość nominalną ETF pokazujemy tylko jako informację dodatkową.

### A. Stałe edukacyjne (jawne założenia — pokazywane użytkownikowi pod wykresem)
* Nominalna średnia roczna stopa zwrotu szerokiego ETF **brutto**: `R_GROSS = 0.06`.
* Roczne koszty (TER + spread, uśrednione): `R_COSTS = 0.003`.
* Stopa używana w symulacji (**netto po kosztach**, przed podatkiem): `R_ETF = R_GROSS - R_COSTS = 0.057` (5,7% rocznie).
* Średnia roczna inflacja: `R_INF = 0.035` (3,5% rocznie). Gotówka na zwykłym koncie: 0% odsetek.
* **Podatek (19% od zysku w PL), ryzyko walutowe i opłaty brokera NIE są uwzględnione** — informacja o tym ma być widoczna w UI (patrz docs01 §6).
* Tekst założeń zwracany w API (`Assumptions.text`): *„Założenia edukacyjne: 5,7% rocznie po kosztach (przed podatkiem 19%), inflacja 3,5% rocznie, wartości w dzisiejszych złotych. To nie jest prognoza ani gwarancja."*

### B. Historyczny odsetek okresów z dodatnim wynikiem realnym (`historical_win_rate`) — **WARTOŚCI ILUSTRACYJNE**
> **Uwaga (Osoba 2, obowiązkowe przed demo):** poniższa tabela jest **tymczasowym placeholderem** bez źródła. Należy ją zastąpić wartościami policzonymi z publicznych danych (np. kroczące okna miesięczne indeksu MSCI World, zwrot realny, z regularnymi wpłatami) i wpisać źródło + okres + walutę do stopki Ekranu 2. Do tego czasu UI oznacza wartość jako „ilustracyjna".

* Klucze: 1→73, 3→84, 5→90, 7→93, 10→96, 15→99, 20→100 (liniowa interpolacja dla pozostałych lat, `int(round(...))`).
* **Twardy limit wyświetlania: `min(97, wartość)`** — aplikacja nigdy nie pokazuje 98–100% ani sformułowania „bez straty". (Gdy dane zostaną policzone, limit można usunąć lub zmienić.)

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

### C. Klasyfikacja grupy wiekowej (`get_age_group`)
Jedyna funkcja klasyfikacji (nie tworzyć `get_age_context`). Wiek określa **horyzont i ton**, a nie lęk użytkownika (lęk wybiera użytkownik — patrz `main_concern`).
* `age < 30` -> `("20+", 15, "Młody Start (20+)")`
* `30 <= age <= 50` -> `("30-50", 10, "Kariera i Rodzina (30–50)")`
* `age > 50` -> `("50+", 7, "Ochrona Kapitału (50+)")`

### D. Podział wolnych środków i kwota startowa (`calculate_safe_investment`)
Wejście: `age`, `net_income`, `free_cash`, `has_emergency_fund`.

Pomocnicza: `round_to_50(val) = max(100, int(round(val / 50.0) * 50))`.

Są **trzy tryby planu** (`plan_type`):

1. **`savings_first`** — `has_emergency_fund == False` **i** `free_cash < 300`:
   * `training_etf_monthly = 0`, `emergency_savings_monthly = free_cash`.
   * `recommended_monthly = 100` i `illustrative_only = True` (kwota używana **wyłącznie do przykładowego wykresu**, nie jest zaleceniem inwestowania).
   * `reasoning`: *„Najpierw poduszka. Przy Twoich wolnych środkach najlepszy pierwszy krok to konto oszczędnościowe, a nie inwestycja. Poniżej pokazujemy, jak mogłoby to wyglądać na przykładzie 100 zł miesięcznie, gdy poduszka będzie gotowa."*
2. **`split`** — `has_emergency_fund == False` **i** `free_cash >= 300` (reguła 80/20):
   * `training_etf_monthly = min(free_cash, max(100, round_to_50(free_cash * 0.20)))`
   * `emergency_savings_monthly = free_cash - training_etf_monthly`
   * `recommended_monthly = min_monthly = max_monthly = training_etf_monthly`, `illustrative_only = False`.
   * Dla `free_cash >= 500` ścisłe 80/20 (np. 1000 zł -> 800 zł poduszka + 200 zł ETF). Dla 300–450 zł: 100 zł ETF + reszta poduszka.
   * `reasoning`: *„Najpierw budujesz warstwę bezpieczeństwa: ok. 80% wolnych środków odkładasz na poduszkę, a ok. 20% (co najmniej 100 zł) kierujesz na symboliczny trening w szeroki ETF. To kwota edukacyjna, nie zalecenie zainwestowania wszystkich wolnych środków."*
3. **`invest`** — `has_emergency_fund == True`:
   * Procenty zależą od grupy: `20+`: 0.50–0.70; `30-50`: 0.40–0.60; `50+`: 0.30–0.50.
   * `min_monthly = round_to_50(free_cash * min_pct)`, `max_monthly = max(min_monthly + 50, round_to_50(free_cash * max_pct))`, `recommended_monthly = round_to_50((min_monthly + max_monthly) / 2.0)`.
   * `emergency_savings_monthly = 0`, `training_etf_monthly = recommended_monthly`, `illustrative_only = False`.
   * `reasoning`: `20+`: *„Masz już poduszkę i najcenniejszy zasób — czas. Przeznaczenie 50–70% wolnych środków na szeroki ETF pokazuje, jak działa efekt czasu."* · `30-50`: *„Masz zabezpieczoną poduszkę rodzinną, więc 40–60% wolnych nadwyżek może pracować w szerokich ETF-ach w tle."* · `50+`: *„Masz solidną poduszkę, dlatego 30–50% wolnych środków możesz skierować do szerokich ETF-ów jako potencjalną ochronę przed inflacją; pozostałą część zostaw w bezpiecznych, dostępnych formach."*

> Nazewnictwo UI: kwota to **„przykładowa kwota startowa"**, nigdy „bezpieczna kwota".

```python
def calculate_safe_investment(age, net_income, free_cash, has_emergency_fund) -> SafeInvestmentAdvice:
    age_group, _, _ = get_age_group(age)

    if not has_emergency_fund and free_cash < 300:
        return SafeInvestmentAdvice(
            plan_type="savings_first", min_monthly=100, max_monthly=100, recommended_monthly=100,
            emergency_savings_monthly=int(free_cash), training_etf_monthly=0,
            illustrative_only=True, reasoning=REASONING_SAVINGS_FIRST)

    if not has_emergency_fund:
        etf = min(free_cash, max(100, round_to_50(free_cash * 0.20)))
        return SafeInvestmentAdvice(
            plan_type="split", min_monthly=etf, max_monthly=etf, recommended_monthly=etf,
            emergency_savings_monthly=int(free_cash - etf), training_etf_monthly=etf,
            illustrative_only=False, reasoning=REASONING_SPLIT)

    min_pct, max_pct, reasoning = INVEST_RULES[age_group]
    lo = round_to_50(free_cash * min_pct)
    hi = max(lo + 50, round_to_50(free_cash * max_pct))
    rec = round_to_50((lo + hi) / 2.0)
    return SafeInvestmentAdvice(
        plan_type="invest", min_monthly=lo, max_monthly=hi, recommended_monthly=rec,
        emergency_savings_monthly=0, training_etf_monthly=rec,
        illustrative_only=False, reasoning=reasoning)
```

### E. Projekcja 20-letnia (`generate_projection_series`)
Dla miesięcznej wpłaty $P = \text{recommended\_monthly}$, miesięcznej stopy $i = R_{\text{etf}} / 12$ i roku $t \in \{1,\dots,20\}$ ($n = 12t$):

* Wpłacone łącznie (nominalnie, to samo co gotówka na koncie 0%): $V_{\text{paid}} = P \cdot n$
* ETF nominalnie: $V_{\text{etf,nom}} = P \cdot \dfrac{(1+i)^n - 1}{i}$
* **Wspólny deflator** (siła nabywcza w dzisiejszych złotych): $D(t) = (1 + R_{\text{inf}})^t$
* ETF realnie: $V_{\text{etf,real}} = V_{\text{etf,nom}} / D(t)$
* Gotówka realnie: $V_{\text{cash,real}} = V_{\text{paid}} / D(t)$
* Przewaga realna: $\text{real\_gain\_vs\_cash} = V_{\text{etf,real}} - V_{\text{cash,real}}$
* **Scenariusz stresowy (edukacyjny):** `etf_stress_real_value = etf_real_value * mnożnik(t)`, gdzie `y1–2: 1.00`, `y3: 0.80`, `y4: 0.85`, `y5: 0.90`, `y6: 0.95`, `y7–20: 1.00`. To nakładka ilustrująca przejściowy spadek -20% w roku 3, **nie** pełna symulacja ścieżki rynku (od roku 7 wartości wracają do bazowych).
* Wszystkie wartości `int(round(...))`.

```python
STRESS_MULTIPLIER = {3: 0.80, 4: 0.85, 5: 0.90, 6: 0.95}

def generate_projection_series(monthly: int) -> list[dict]:
    i = R_ETF / 12
    points = []
    for year in range(1, 21):
        n = 12 * year
        total_paid = monthly * n
        etf_nominal = monthly * (((1 + i) ** n - 1) / i)
        deflator = (1 + R_INF) ** year
        etf_real = etf_nominal / deflator
        cash_real = total_paid / deflator
        points.append({
            "year": year,
            "total_paid": total_paid,
            "etf_nominal_value": int(round(etf_nominal)),
            "etf_real_value": int(round(etf_real)),
            "etf_stress_real_value": int(round(etf_real * STRESS_MULTIPLIER.get(year, 1.0))),
            "cash_real_value": int(round(cash_real)),
            "real_gain_vs_cash": int(round(etf_real)) - int(round(cash_real)),
            "historical_win_rate": historical_win_rate(year),
        })
    return points

def value_after_months(monthly: int, months: int) -> int:
    """Wartość nominalna ETF po `months` miesiącach — do half_year_value i year3_value."""
    i = R_ETF / 12
    return int(round(monthly * (((1 + i) ** months - 1) / i)))
```

### F. Fakty sesji dla treści misji (`build_session_facts`)
Funkcja zwraca słownik używany do wypełniania tekstów w `demo_data.py`:
* `half_year_value = value_after_months(P, 6)`
* `year3_paid = P * 36`, `year3_value = value_after_months(P, 36)`, `year3_stress_value = int(round(year3_value * 0.80))`
* `etf_real_value`, `etf_nominal_value`, `cash_real_value`, `diff_value` (= `real_gain_vs_cash`) dla `horizon_years` z `projection_series`
* `win_rate = historical_win_rate(horizon_years)`

### G. Wartości referencyjne (do `scripts/check_math.py`)
Dla założeń z §A (5,7% netto, inflacja 3,5%, deflator końcowy):

| Persona | P (zł/mies.) | Horyzont | Wpłacono | ETF nominalnie | ETF realnie | Gotówka realnie | Przewaga realna |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `young_20` | 200 | 15 lat | 36 000 | 56 700 | 33 844 | 21 488 | 12 356 |
| `mid_38` | 1 250 | 10 lat | 150 000 | 201 548 | 142 881 | 106 338 | 36 543 |
| `senior_56` | 1 200 | 7 lat | 100 800 | 123 518 | 97 084 | 79 228 | 17 856 |

Pozostałe: `young_20` po 6 mies. = 1 214 zł, po 3 latach: wpłacono 7 200 zł, wartość 7 832 zł, stres 6 266 zł.

---

## 3. Pełne modele Pydantic (`backend/schemas.py`)
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
    recommended_monthly: int          # kwota użyta w symulacji (przy savings_first: 100, ilustracyjnie)
    emergency_savings_monthly: int = 0
    training_etf_monthly: int = 0
    illustrative_only: bool = False
    reasoning: str


class SpeaklyFilter(BaseModel):
    kept_topics: list[str]            # dokładnie 3
    removed_topics: list[str]         # 5-6


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
    text: str                         # is_optimal NIE jest wysyłane do klienta


class PortfolioStatus(BaseModel):
    simulated_value: int              # nominalnie; patrz docs03 §2 (wartość zależna od kroku)
    event_badge: str


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
    confidence_score: int = Field(..., ge=0, le=100)
    confidence_delta: int = 0
    confidence_start: int = Field(..., ge=0, le=100)
    understanding_feedback: Optional[str] = None
    is_optimal_choice: Optional[bool] = None   # None w turze startowej
    luna_message: str
    quick_replies: list[QuickReply]
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
    main_concern: MainConcern
    safe_investment: SafeInvestmentAdvice
    speakly_filter: SpeaklyFilter
    assumptions: Assumptions
    projection_series: list[ProjectionPoint]
    initial_mission_turn: MissionTurnResponse


class MissionTurnRequest(BaseModel):
    session_id: str
    user_message: str = Field(..., min_length=1, max_length=600)
    quick_reply_id: Optional[str] = None   # gdy użytkownik kliknął kartę -> ocena deterministyczna
```

LLM-owa ocena wolnego tekstu (`LunaAssessment`) jest zdefiniowana w docs03 §4.

---

## 4. Specyfikacja Endpointów (`backend/main.py`)

| Metoda i ścieżka | Opis działania | Model wejścia / wyjścia |
| :--- | :--- | :--- |
| `GET /` | Zwraca `static/index.html` (`FileResponse`). Dodatkowo zamontować `/static` przez `StaticFiles`. | HTML |
| `GET /api/demo-personas` | Zwraca 3 persony: `young_20` (22 l., 4500/1000 zł, bez poduszki, obawa `freeze_money`, pewność 2), `mid_38` (38 l., 11000/2500 zł, ma poduszkę, `no_time`, 3), `senior_56` (56 l., 9500/3000 zł, ma poduszkę, `too_late`, 2). | `list[DemoPersona]` |
| `POST /api/onboarding/analyze` | Generuje `session_id` (`uuid4().hex[:8]`), liczy `finance_math` (§2), dobiera filtr Speakly, przygotowuje Krok 1 misji i zapisuje sesję w `SESSIONS`. Zero LLM. | `OnboardingRequest` -> `OnboardingResponse` |
| `POST /api/mission/turn` | Pobiera sesję (brak -> `404`). Jeśli `quick_reply_id` pasuje do bieżących opcji: ocena **deterministyczna** (bez LLM). W przeciwnym razie wolny tekst -> `luna_service.assess_free_text(...)` (LLM, z fallbackiem). Następnie `apply_confidence`, przejście kroku, ew. dołączenie `final_checklist`/`bank_draft`. | `MissionTurnRequest` -> `MissionTurnResponse` |

Obsługa błędów:
* Walidacja Pydantic -> `422` (frontend pokazuje komunikat przy polu).
* **`404` dla `session_id`** (np. po restarcie serwera): frontend **po cichu ponawia** `POST /api/onboarding/analyze` z ostatnio wysłanym profilem i odtwarza bieżący krok.
* **Nie uruchamiać `uvicorn --reload` na prezentacji** (restart kasuje `SESSIONS`).

---

## 5. Stan sesji (`SESSIONS[session_id]`)
```python
{
    "session_id": str,
    "age": int,
    "age_group": "20+" | "30-50" | "50+",
    "main_concern": "freeze_money" | "no_time" | "lose_money" | "too_late",
    "plan_type": "savings_first" | "split" | "invest",
    "free_cash": int,
    "recommended_monthly": int,
    "emergency_savings_monthly": int,
    "horizon_years": int,
    "etf_nominal_value": int,
    "etf_real_value": int,
    "cash_real_value": int,
    "diff_value": int,
    "win_rate": int,
    "half_year_value": int,
    "year3_paid": int,
    "year3_value": int,
    "year3_stress_value": int,
    "current_step": 1,               # krok, na który użytkownik właśnie odpowiada
    "confidence_start": int,         # z self_confidence_start: {1:15, 2:25, 3:35, 4:45, 5:55}
    "confidence_score": int,         # startuje od confidence_start
    "current_options": [             # opcje bieżącego kroku (z is_optimal po stronie serwera)
        {"id": str, "text": str, "is_optimal": bool, "feedback": str}
    ],
    "history": []
}
```
Kolejność `current_options` zwracanych w `quick_replies` jest **tasowana deterministycznie** (`random.Random(session_id + str(step)).shuffle`), żeby poprawna odpowiedź nie była zawsze pierwsza, a demo było powtarzalne.

---

## 6. Przykład odpowiedzi końcowej (Krok 3 — `mission_completed: true`, persona `young_20`, wszystkie odpowiedzi optymalne)
Wartości wygenerowane ze wzorów z §2 (P = 200 zł, 15 lat, 5,7% netto, inflacja 3,5%):

```json
{
  "step_number": 3,
  "total_steps": 3,
  "confidence_score": 100,
  "confidence_delta": 15,
  "confidence_start": 25,
  "understanding_feedback": "Dokładnie. Spadek na papierze to wahanie, a nie strata, dopóki nie sprzedajesz — i właśnie dlatego poduszka leży osobno. Historia nie gwarantuje przyszłości.",
  "is_optimal_choice": true,
  "luna_message": "Misja ukończona! Przewijamy 15 lat: Twoje wpłaty na koncie 0% byłyby warte realnie ok. 21 488 zł, a w szerokim ETF historycznie ok. 33 844 zł (założenia: 5,7% rocznie po kosztach, przed podatkiem). To scenariusz edukacyjny, nie obietnica. Odhacz checklistę.",
  "quick_replies": [],
  "portfolio_status": {
    "simulated_value": 56700,
    "event_badge": "Horyzont 15 lat osiągnięty"
  },
  "trigger_confetti": true,
  "mission_completed": true,
  "final_checklist": [
    {
      "id": "chk_1",
      "text": "Mam przykładowy plan startowy: 800 zł/mies. na poduszkę i 200 zł/mies. na trening w szeroki ETF.",
      "detail": "Najpierw bezpieczeństwo, potem inwestowanie — bez naruszania codziennego budżetu."
    },
    {
      "id": "chk_2",
      "text": "Rozumiem, że gotówka na zwykłym koncie traci realną wartość przez inflację.",
      "detail": "W horyzoncie 15 lat Twoje wpłaty na koncie 0% mają realnie ok. 21 488 zł, a w szerokim ETF historycznie ok. 33 844 zł (przy założeniach edukacyjnych)."
    },
    {
      "id": "chk_3",
      "text": "Wiem, że szeroki ETF na 15 lat historycznie ograniczał ryzyko straty, choć jej nie wyklucza.",
      "detail": "Wahania, nawet -20%, są normalne; ważne, by mieć poduszkę osobno i nie sprzedawać w panice."
    },
    {
      "id": "chk_4",
      "text": "Wiem, że poduszka służy na awarie, a środki w ETF nie są zamrożone.",
      "detail": "W ostateczności sprzedaż jednostek i wypłata zajmują zwykle kilka dni roboczych."
    }
  ],
  "bank_draft": {
    "monthly_amount": 200,
    "horizon_years": 15,
    "instrument_category": "Szeroki globalny fundusz ETF (przykład edukacyjny)",
    "projected_etf_real_value": 33844,
    "projected_etf_nominal_value": 56700,
    "projected_cash_real_value": 21488,
    "historical_win_rate": 97,
    "assumptions_text": "Założenia edukacyjne: 5,7% rocznie po kosztach (przed podatkiem 19%), inflacja 3,5% rocznie, wartości w dzisiejszych złotych. To nie jest prognoza ani gwarancja.",
    "costs_note": "Nie uwzględniono podatku od zysków, opłat brokera i ryzyka walutowego. Wyniki z przeszłości nie gwarantują przyszłych."
  }
}
```
> `scripts/check_math.py` ma porównać te liczby z wynikiem `generate_projection_series(200)[14]` (ETF nominalnie 56 700; ETF realnie 33 844; gotówka realnie 21 488).

---

## 7. Zmienne środowiskowe (`.env.example`)
```env
OPENAI_API_KEY=sk-twoj-klucz-lub-klucz-luny
LUNA_MODEL=gpt-4o-mini
LUNA_TIMEOUT_SECONDS=3.5
DEMO_OFFLINE=0          # 1 = LLM wyłączony, wolny tekst dostaje od razu neutralny fallback (0 ms)
```

---

## 8. Zasady współpracy (kontrakt)
* **Zamrożenie kontraktu po 1. godzinie pracy.** Zmiany w `schemas.py` tylko przez PR zatwierdzony przez właściciela pliku (Osoba 1); zmiana wynikająca z matematyki wymaga uzgodnienia Osoby 2 i 3.
* **Osoba 1 wystawia w pierwszej kolejności** endpointy zwracające statyczne mocki (z przykładu §6), żeby Osoba 3 nie czekała na backend.
* **`scripts/check_math.py`** i **`scripts/smoke_test.py`** to jedyny dozwolony „test". `smoke_test.py` (dla 3 person, `DEMO_OFFLINE=1`, 4 wywołania API) sprawdza: ścieżka pewności 25/60/85/100 przy samych optymalnych kartach; brak ETF dla `savings_first`; `+5` i brak konfetti przy odpowiedzi nieoptymalnej; `quick_replies == []` oraz komplet `final_checklist`/`bank_draft` po Kroku 3.
