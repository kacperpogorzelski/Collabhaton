"""Weryfikacja deterministycznej matematyki Finance Quest (SSOT v3).

Uruchomienie (z katalogu repo):

    python scripts/check_math.py

Skrypt porównuje ``backend/finance_math.py`` z:
* tabelą wartości referencyjnych ``docs/02`` §3H (3 persony: young_20, mid_38, senior_56),
* przykładem odpowiedzi końcowej ``docs/02`` §6 (56 700 / 33 844 / 21 488),
* trybem ``savings_first`` (bez ETF: ``training_etf_monthly == 0``, 100 zł ilustracyjnie),
* limitem ``historical_win_rate`` (nigdy powyżej 97).

Kod wyjścia ``0`` = wszystkie sprawdzenia OK, ``1`` = rozbieżność lub brak modułu.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    from backend import finance_math
except ImportError:  # pragma: no cover - zależność od Issue #5 (Osoba 1)
    print("BŁĄD: brak modułu backend/finance_math.py (Issue #5 — Osoba 1).")
    print("Nie można zweryfikować matematyki bez implementacji finance_math.")
    raise SystemExit(1) from None

WIN_RATE_DISPLAY_CAP = 97


@dataclass
class Report:
    """Zbiera wyniki sprawdzeń i decyduje o kodzie wyjścia."""

    passed: int = 0
    failures: list[str] = field(default_factory=list)

    def check(self, label: str, actual: object, expected: object) -> None:
        if actual == expected:
            self.passed += 1
            return
        self.failures.append(f"{label}: oczekiwano {expected!r}, otrzymano {actual!r}")

    def ok(self, label: str, condition: bool) -> None:
        self.check(label, bool(condition), True)


@dataclass(frozen=True)
class PersonaVector:
    """Wiersz tabeli ``docs/02`` §3H (wartości w zł, horyzont w latach).

    ``year3_value`` / ``year3_stress`` to kolumna „Rok 3: wartość / stres" —
    wartość **nominalna** i jej 80% (``build_session_facts``), bo
    ``portfolio_status.simulated_value`` jest zawsze nominalne (docs/02 §2).
    Nakładka ``etf_stress_real_value`` z projekcji (§3E) jest osobnym,
    realnym scenariuszem i jest sprawdzana relacją, nie tą tabelą.
    """

    name: str
    age: int
    net_income: int
    free_cash: int
    has_emergency_fund: bool
    plan_type: str
    min_monthly: int
    max_monthly: int
    recommended_monthly: int
    emergency_savings_monthly: int
    training_etf_monthly: int
    horizon_years: int
    total_paid: int
    etf_nominal: int
    etf_real: int
    cash_real: int
    real_gain: int
    half_year: int
    year3_paid: int
    year3_value: int
    year3_stress: int
    win_rate: int

PERSONAS: tuple[PersonaVector, ...] = (
    PersonaVector(
        name="young_20",
        age=22,
        net_income=4500,
        free_cash=1000,
        has_emergency_fund=False,
        plan_type="split",
        min_monthly=200,
        max_monthly=200,
        recommended_monthly=200,
        emergency_savings_monthly=800,
        training_etf_monthly=200,
        horizon_years=15,
        total_paid=36000,
        etf_nominal=56700,
        etf_real=33844,
        cash_real=21488,
        real_gain=12356,
        half_year=1214,
        year3_paid=7200,
        year3_value=7832,
        year3_stress=6266,
        win_rate=WIN_RATE_DISPLAY_CAP,
    ),
    PersonaVector(
        name="mid_38",
        age=38,
        net_income=11000,
        free_cash=2500,
        has_emergency_fund=True,
        plan_type="invest",
        min_monthly=1000,
        max_monthly=1500,
        recommended_monthly=1250,
        emergency_savings_monthly=0,
        training_etf_monthly=1250,
        horizon_years=10,
        total_paid=150000,
        etf_nominal=201548,
        etf_real=142881,
        cash_real=106338,
        real_gain=36543,
        half_year=7590,
        year3_paid=45000,
        year3_value=48950,
        year3_stress=39160,
        win_rate=96,
    ),
    PersonaVector(
        name="senior_56",
        age=56,
        net_income=9500,
        free_cash=3000,
        has_emergency_fund=True,
        plan_type="invest",
        min_monthly=900,
        max_monthly=1500,
        recommended_monthly=1200,
        emergency_savings_monthly=0,
        training_etf_monthly=1200,
        horizon_years=7,
        total_paid=100800,
        etf_nominal=123518,
        etf_real=97084,
        cash_real=79228,
        real_gain=17856,
        half_year=7286,
        year3_paid=43200,
        year3_value=46992,
        year3_stress=37594,
        win_rate=93,
    ),
)

AGE_GROUP_BY_PERSONA: dict[str, str] = {
    "young_20": "20+",
    "mid_38": "30-50",
    "senior_56": "50+",
}

# Przykład odpowiedzi końcowej docs/02 §6 (young_20, P = 200 zł, 15 lat).
SECTION_6_MONTHLY = 200
SECTION_6_HORIZON = 15
SECTION_6_ETF_NOMINAL = 56700
SECTION_6_ETF_REAL = 33844
SECTION_6_CASH_REAL = 21488


def _field(obj: object, name: str) -> object:
    """Czyta pole ze słownika albo z modelu Pydantic (bez wiązania z typem)."""
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def _check_age_group_boundaries(report: Report) -> None:
    cases = ((18, "20+"), (29, "20+"), (30, "30-50"), (50, "30-50"), (51, "50+"), (70, "50+"))
    for age, expected in cases:
        age_group, _, _ = finance_math.get_age_group(age)
        report.check(f"get_age_group({age})", age_group, expected)


def _check_persona(report: Report, persona: PersonaVector) -> None:
    advice = finance_math.calculate_safe_investment(
        persona.age, persona.net_income, persona.free_cash, persona.has_emergency_fund
    )

    report.check(f"{persona.name}: plan_type", _field(advice, "plan_type"), persona.plan_type)
    report.check(f"{persona.name}: min_monthly", _field(advice, "min_monthly"), persona.min_monthly)
    report.check(f"{persona.name}: max_monthly", _field(advice, "max_monthly"), persona.max_monthly)
    report.check(
        f"{persona.name}: recommended_monthly",
        _field(advice, "recommended_monthly"),
        persona.recommended_monthly,
    )
    report.check(
        f"{persona.name}: emergency_savings_monthly",
        _field(advice, "emergency_savings_monthly"),
        persona.emergency_savings_monthly,
    )
    report.check(
        f"{persona.name}: training_etf_monthly",
        _field(advice, "training_etf_monthly"),
        persona.training_etf_monthly,
    )
    report.check(
        f"{persona.name}: illustrative_only",
        _field(advice, "illustrative_only"),
        False,
    )

    age_group, horizon_years, persona_label = finance_math.get_age_group(persona.age)
    report.check(f"{persona.name}: age_group", age_group, AGE_GROUP_BY_PERSONA[persona.name])
    report.check(f"{persona.name}: default_horizon_years", horizon_years, persona.horizon_years)
    report.ok(f"{persona.name}: persona_label niepusty", bool(persona_label))

    series = finance_math.generate_projection_series(persona.recommended_monthly)
    report.check(f"{persona.name}: długość projekcji", len(series), 20)

    point = series[persona.horizon_years - 1]
    report.check(f"{persona.name}: total_paid", _field(point, "total_paid"), persona.total_paid)
    report.check(
        f"{persona.name}: etf_nominal_value",
        _field(point, "etf_nominal_value"),
        persona.etf_nominal,
    )
    report.check(
        f"{persona.name}: etf_real_value", _field(point, "etf_real_value"), persona.etf_real
    )
    report.check(
        f"{persona.name}: cash_real_value", _field(point, "cash_real_value"), persona.cash_real
    )
    report.check(
        f"{persona.name}: real_gain_vs_cash",
        _field(point, "real_gain_vs_cash"),
        persona.real_gain,
    )
    report.check(
        f"{persona.name}: historical_win_rate",
        _field(point, "historical_win_rate"),
        persona.win_rate,
    )

    year3 = series[2]
    report.check(
        f"{persona.name}: rok 3 total_paid", _field(year3, "total_paid"), persona.year3_paid
    )
    # docs/02 §3H kolumna „Rok 3: wartość" to wartość NOMINALNA (7 832 = 200 zł, 36 mies.),
    # a „stres" = 0,8 × wartość nominalna. Wartość realna w roku 3 (7 064) jest niższa od
    # wpłat — to celowy efekt edukacyjny, więc nie używamy jej do testu tabeli.
    report.check(
        f"{persona.name}: rok 3 etf_nominal_value (kolumna wartość §3H)",
        _field(year3, "etf_nominal_value"),
        persona.year3_value,
    )
    # docs/02 §3E: nakładka stresowa na serię realną to mnożnik × etf_real_value.
    # Stress liczony jest z niezaokrąglonej wartości realnej, więc dopuszczamy ±1 zł.
    report.ok(
        f"{persona.name}: §3E etf_stress_real_value ≈ round(etf_real_value × 0,80)",
        abs(_field(year3, "etf_stress_real_value") - int(round(_field(year3, "etf_real_value") * 0.80))) <= 1,
    )
    for year, multiplier in ((4, 0.85), (5, 0.90), (6, 0.95)):
        point_year = series[year - 1]
        report.ok(
            f"{persona.name}: §3E mnożnik stresu w roku {year}",
            abs(
                _field(point_year, "etf_stress_real_value")
                - int(round(_field(point_year, "etf_real_value") * multiplier))
            ) <= 1,
        )

    report.check(
        f"{persona.name}: calculate_half_year_etf_value",
        finance_math.calculate_half_year_etf_value(persona.recommended_monthly),
        persona.half_year,
    )
    report.check(
        f"{persona.name}: calculate_etf_value_after_months(…, 6)",
        finance_math.calculate_etf_value_after_months(persona.recommended_monthly, 6),
        persona.half_year,
    )

    facts = finance_math.build_session_facts(
        {
            "recommended_monthly": persona.recommended_monthly,
            "horizon_years": persona.horizon_years,
            "free_cash": persona.free_cash,
            "emergency_savings_monthly": persona.emergency_savings_monthly,
        }
    )
    report.check(
        f"{persona.name}: facts half_year_value",
        _field(facts, "half_year_value"),
        persona.half_year,
    )
    report.check(
        f"{persona.name}: facts year3_paid", _field(facts, "year3_paid"), persona.year3_paid
    )
    report.check(
        f"{persona.name}: facts year3_value", _field(facts, "year3_value"), persona.year3_value
    )
    report.check(
        f"{persona.name}: facts year3_stress_value",
        _field(facts, "year3_stress_value"),
        persona.year3_stress,
    )
    report.check(
        f"{persona.name}: facts etf_nominal_value",
        _field(facts, "etf_nominal_value"),
        persona.etf_nominal,
    )
    report.check(
        f"{persona.name}: facts etf_real_value", _field(facts, "etf_real_value"), persona.etf_real
    )
    report.check(
        f"{persona.name}: facts cash_real_value", _field(facts, "cash_real_value"), persona.cash_real
    )
    report.check(f"{persona.name}: facts diff_value", _field(facts, "diff_value"), persona.real_gain)
    report.check(f"{persona.name}: facts win_rate", _field(facts, "win_rate"), persona.win_rate)
    report.check(f"{persona.name}: facts free_cash", _field(facts, "free_cash"), persona.free_cash)
    report.check(
        f"{persona.name}: facts emergency_savings_monthly",
        _field(facts, "emergency_savings_monthly"),
        persona.emergency_savings_monthly,
    )
    report.check(
        f"{persona.name}: facts recommended_monthly",
        _field(facts, "recommended_monthly"),
        persona.recommended_monthly,
    )


def _check_section_6_example(report: Report) -> None:
    series = finance_math.generate_projection_series(SECTION_6_MONTHLY)
    point = series[SECTION_6_HORIZON - 1]

    report.check("§6 total_paid (15 lat × 200 zł)", _field(point, "total_paid"), 36000)
    report.check(
        "§6 etf_nominal_value", _field(point, "etf_nominal_value"), SECTION_6_ETF_NOMINAL
    )
    report.check("§6 etf_real_value", _field(point, "etf_real_value"), SECTION_6_ETF_REAL)
    report.check("§6 cash_real_value", _field(point, "cash_real_value"), SECTION_6_CASH_REAL)

    facts = finance_math.build_session_facts(
        {
            "recommended_monthly": SECTION_6_MONTHLY,
            "horizon_years": SECTION_6_HORIZON,
            "free_cash": 1000,
            "emergency_savings_monthly": 800,
        }
    )
    report.check("§6 facts etf_real_value", _field(facts, "etf_real_value"), SECTION_6_ETF_REAL)
    report.check(
        "§6 facts cash_real_value", _field(facts, "cash_real_value"), SECTION_6_CASH_REAL
    )
    report.check(
        "§6 facts etf_nominal_value", _field(facts, "etf_nominal_value"), SECTION_6_ETF_NOMINAL
    )

    first = series[0]
    report.ok(
        "§6 projekcja rośnie nominalnie (rok 1 < rok 2)",
        _field(series[1], "etf_nominal_value") > _field(first, "etf_nominal_value"),
    )
    report.ok(
        "§6 ETF realnie > gotówka realnie już w roku 1",
        _field(first, "etf_real_value") > _field(first, "cash_real_value"),
    )
    report.check("§6 punkt Rok 0 nie istnieje w projekcji (start od roku 1)", len(series), 20)


def _check_savings_first(report: Report) -> None:
    advice = finance_math.calculate_safe_investment(25, 4500, 250, False)

    report.check("savings_first: plan_type", _field(advice, "plan_type"), "savings_first")
    report.check("savings_first: training_etf_monthly", _field(advice, "training_etf_monthly"), 0)
    report.check("savings_first: recommended_monthly", _field(advice, "recommended_monthly"), 100)
    report.check("savings_first: min_monthly", _field(advice, "min_monthly"), 100)
    report.check("savings_first: max_monthly", _field(advice, "max_monthly"), 100)
    report.check(
        "savings_first: emergency_savings_monthly",
        _field(advice, "emergency_savings_monthly"),
        250,
    )
    report.check("savings_first: illustrative_only", _field(advice, "illustrative_only"), True)
    report.ok("savings_first: reasoning niepusty", bool(_field(advice, "reasoning")))


def _check_historical_win_rate(report: Report) -> None:
    report.check(
        "historical_win_rate(20) == 97",
        finance_math.historical_win_rate(20),
        WIN_RATE_DISPLAY_CAP,
    )
    report.check("historical_win_rate(1)", finance_math.historical_win_rate(1), 73)
    report.check("historical_win_rate(7)", finance_math.historical_win_rate(7), 93)
    report.check("historical_win_rate(10)", finance_math.historical_win_rate(10), 96)

    values = [finance_math.historical_win_rate(year) for year in range(1, 21)]
    report.ok(
        "historical_win_rate nigdy > 97",
        all(value <= WIN_RATE_DISPLAY_CAP for value in values),
    )
    report.ok("historical_win_rate nigdy < 1", all(value >= 1 for value in values))
    report.ok(
        "historical_win_rate niemalejący w latach 1..20",
        all(earlier <= later for earlier, later in zip(values, values[1:])),
    )


def main() -> int:
    report = Report()
    print("Finance Quest — weryfikacja matematyki (docs/02 §3H, §6, §8)")

    _check_age_group_boundaries(report)
    for persona in PERSONAS:
        _check_persona(report, persona)
    _check_section_6_example(report)
    _check_savings_first(report)
    _check_historical_win_rate(report)

    if report.failures:
        print(f"\n[BŁĄD] {len(report.failures)} rozbieżności (OK: {report.passed}):")
        for failure in report.failures:
            print(f"  - {failure}")
        return 1

    print(f"[OK] {report.passed} sprawdzeń zgodnych z SSOT.")
    for persona in PERSONAS:
        print(
            f"  {persona.name:<10} plan={persona.plan_type:<8} "
            f"P={persona.recommended_monthly:>5} zł/mies.  horyzont={persona.horizon_years:>2} lat  "
            f"wpłacono={persona.total_paid:>7} zł  ETF realnie={persona.etf_real:>6} zł  "
            f"gotówka realnie={persona.cash_real:>6} zł"
        )
    print("  tryb savings_first: training_etf_monthly=0, recommended_monthly=100 (ilustracyjnie)")
    print(f"  historical_win_rate: limit wyświetlania {WIN_RATE_DISPLAY_CAP}% działa poprawnie")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
