"""Deterministyczna matematyka finansowa (docs/02 §3). LLM nigdy nie liczy pieniędzy."""
from backend.schemas import AgeGroup, SafeInvestmentAdvice

# --- Stałe edukacyjne (§3A) ---
R_GROSS = 0.06
R_COSTS = 0.003
R_ETF = 0.057
R_INF = 0.035
DISPLAY_CAP = 97

# samoocena 1-5 -> gotowość startowa (%)
CONFIDENCE_START = {1: 5, 2: 10, 3: 15, 4: 20, 5: 25}
STRESS_MULTIPLIER = {3: 0.80, 4: 0.85, 5: 0.90, 6: 0.95}

# --- §3B: wartości ILUSTRACYJNE (placeholder do czasu policzenia z danych) ---
_WR_KEYS = {1: 73, 3: 84, 5: 90, 7: 93, 10: 96, 15: 99, 20: 100}

REASONING_SAVINGS_FIRST = (
    "Najpierw poduszka. Przy Twoich wolnych środkach najlepszy pierwszy krok to konto "
    "oszczędnościowe, a nie inwestycja. Poniżej pokazujemy na przykładzie 100 zł miesięcznie, "
    "jak mogłoby to wyglądać, gdy poduszka będzie gotowa."
)
REASONING_SPLIT = (
    "Najpierw budujesz warstwę bezpieczeństwa: ok. 80% wolnych środków odkładasz na poduszkę, "
    "a ok. 20% (co najmniej 100 zł) kierujesz na symboliczny trening w szeroki ETF. "
    "To kwota edukacyjna, nie zalecenie zainwestowania wszystkich wolnych środków."
)
# grupa -> (min_pct, max_pct, reasoning)
INVEST_RULES = {
    "20+": (0.50, 0.70,
            "Masz już poduszkę i najcenniejszy zasób — czas. 50–70% wolnych środków w szerokim ETF "
            "pokazuje, jak działa efekt czasu."),
    "30-50": (0.40, 0.60,
              "Masz zabezpieczoną poduszkę rodzinną, więc 40–60% wolnych nadwyżek może pracować "
              "w szerokich ETF-ach w tle."),
    "50+": (0.30, 0.50,
            "Masz solidną poduszkę, dlatego 30–50% wolnych środków możesz skierować do szerokich "
            "ETF-ów jako potencjalną ochronę przed inflacją; resztę zostaw w bezpiecznych, "
            "dostępnych formach."),
}


def historical_win_rate(year: int) -> int:
    keys = sorted(_WR_KEYS)
    if year <= keys[0]:
        v = _WR_KEYS[keys[0]]
    elif year >= keys[-1]:
        v = _WR_KEYS[keys[-1]]
    else:
        v = _WR_KEYS[keys[0]]
        for a, b in zip(keys, keys[1:]):
            if a <= year <= b:
                v = _WR_KEYS[a] + (_WR_KEYS[b] - _WR_KEYS[a]) * (year - a) / (b - a)
                break
    return min(DISPLAY_CAP, int(round(v)))


def get_age_group(age: int) -> tuple[AgeGroup, int, str]:
    if age < 30:
        return ("20+", 15, "Młody Start (20+)")
    if age <= 50:
        return ("30-50", 10, "Kariera i Rodzina (30–50)")
    return ("50+", 7, "Ochrona Kapitału (50+)")


def round_to_50(val: float) -> int:
    return max(100, int(round(val / 50.0) * 50))


def calculate_safe_investment(age: int, net_income: float, free_cash: float,
                              has_emergency_fund: bool) -> SafeInvestmentAdvice:
    age_group, _, _ = get_age_group(age)
    if not has_emergency_fund and free_cash < 300:
        return SafeInvestmentAdvice(
            plan_type="savings_first", min_monthly=100, max_monthly=100, recommended_monthly=100,
            emergency_savings_monthly=int(free_cash), training_etf_monthly=0,
            illustrative_only=True, reasoning=REASONING_SAVINGS_FIRST)
    if not has_emergency_fund:
        etf = int(min(free_cash, max(100, round_to_50(free_cash * 0.20))))
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


def generate_projection_series(monthly_amount: int) -> list[dict]:
    i = R_ETF / 12
    pts = []
    for year in range(1, 21):
        n = 12 * year
        paid = monthly_amount * n
        nominal = monthly_amount * (((1 + i) ** n - 1) / i)
        d = (1 + R_INF) ** year
        etf_real, cash_real = nominal / d, paid / d
        etf_real_i, cash_real_i = int(round(etf_real)), int(round(cash_real))
        pts.append({
            "year": year,
            "total_paid": paid,
            "etf_nominal_value": int(round(nominal)),
            "etf_real_value": etf_real_i,
            "etf_stress_real_value": int(round(etf_real * STRESS_MULTIPLIER.get(year, 1.0))),
            "cash_real_value": cash_real_i,
            "real_gain_vs_cash": etf_real_i - cash_real_i,
            "historical_win_rate": historical_win_rate(year),
        })
    return pts


def calculate_etf_value_after_months(monthly_amount: int, months: int) -> int:
    i = R_ETF / 12
    return int(round(monthly_amount * (((1 + i) ** months - 1) / i)))


def calculate_half_year_etf_value(monthly_amount: int) -> int:
    return calculate_etf_value_after_months(monthly_amount, 6)


def build_session_facts(session_columns: dict) -> dict:
    """Fakty pochodne + bazowe pola sesji potrzebne w szablonach demo_data.py."""
    s = session_columns
    p = int(s["recommended_monthly"])
    horizon = int(s["horizon_years"])
    series = generate_projection_series(p)
    at_h = series[horizon - 1]
    year3_value = series[2]["etf_nominal_value"]
    return {
        # bazowe pola sesji (do szablonów)
        "session_id": s.get("id", s.get("session_id")),
        "id": s.get("id", s.get("session_id")),
        "age": s.get("age"),
        "age_group": s.get("age_group"),
        "main_concern": s.get("main_concern"),
        "plan_type": s.get("plan_type"),
        "has_emergency_fund": s.get("has_emergency_fund"),
        "horizon_years": horizon,
        "confidence_start": s.get("confidence_start"),
        "training_etf_monthly": s.get("training_etf_monthly", p if s.get("plan_type") != "savings_first" else 0),
        # fakty pochodne
        "free_cash": s.get("free_cash"),
        "emergency_savings_monthly": s.get("emergency_savings_monthly", 0),
        "recommended_monthly": p,
        "half_year_value": calculate_half_year_etf_value(p),
        "year3_paid": p * 36,
        "year3_value": year3_value,
        "year3_stress_value": int(round(year3_value * 0.80)),
        "total_paid": at_h["total_paid"],
        "etf_nominal_value": at_h["etf_nominal_value"],
        "etf_real_value": at_h["etf_real_value"],
        "cash_real_value": at_h["cash_real_value"],
        "diff_value": at_h["real_gain_vs_cash"],
        "win_rate": at_h["historical_win_rate"],
    }
