"""Dane demo Finance Quest (SSOT v3) — persony, filtr Speakly, mapa 14 dni,
mikro-lekcje, bloki kroków misji Dnia 1, wyzwania, checklista i szkic bankowy.

Wszystkie funkcje są synchroniczne (``def``) i nie importują SQLAlchemy.
Treści pochodzą 1:1 z ``docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`` §6–§9;
szablony zawierają placeholdery uzupełniane przez ``.format(**session_facts)``.
"""

from __future__ import annotations

import random
import re
from typing import Literal

from backend.schemas import (
    AgeGroup,
    BankDraft,
    ChecklistItem,
    DemoPersona,
    GamificationState,
    LeaderboardEntry,
    MainConcern,
    MicroLessonCard,
    MissionTurnResponse,
    PortfolioStatus,
    QuickReply,
    RealWorldChallenge,
    RoadmapMilestone,
    SpeaklyFilter,
)

# ``Language`` jest zdefiniowany lokalnie (zgodnie z docs/02 §9 Osoba 1 dodaje go
# w ``schemas.py``); do tego czasu nie importujemy go z ``backend.schemas``.
Language = Literal["pl", "en"]


def _normalize_lang(lang: str | None) -> Language:
    """Zwraca ``"pl"`` wyłącznie dla ``"pl"``; ``None`` i każda inna wartość to ``"en"``."""
    return "pl" if str(lang or "").strip().lower() == "pl" else "en"


def _lang_of(session_facts: dict | None, lang: str | None = None) -> Language:
    """Jawny ``lang`` ma pierwszeństwo; inaczej ``session_facts["lang"]``, potem ``"en"``."""
    if lang is not None:
        return _normalize_lang(lang)
    return _normalize_lang((session_facts or {}).get("lang"))

__all__ = [
    "Language",
    "DEMO_PERSONAS",
    "SEED_LEADERBOARD",
    "SPEAKLY_FILTER_BY_GROUP",
    "SPEAKLY_FILTER_BY_GROUP_EN",
    "ROADMAP_BY_GROUP",
    "ROADMAP_BY_GROUP_EN",
    "MICRO_LESSONS_BY_GROUP",
    "MICRO_LESSONS_BY_GROUP_EN",
    "MICRO_LESSONS_BY_DAY",
    "MICRO_LESSONS_BY_DAY_EN",
    "MICRO_LESSON_CHECKS",
    "MICRO_LESSON_CHECKS_EN",
    "STEP1_BY_AGE_GROUP",
    "STEP1_BY_AGE_GROUP_EN",
    "STEP1_SAVINGS_FIRST",
    "STEP1_SAVINGS_FIRST_EN",
    "STEP1_CONFIDENT",
    "STEP1_CONFIDENT_EN",
    "STEP2_BY_CONCERN",
    "STEP2_BY_CONCERN_EN",
    "STEP3",
    "STEP3_EN",
    "DAY_STEPS",
    "DAY_STEPS_EN",
    "CHECKPOINT_1_QUESTIONS",
    "CHECKPOINT_1_QUESTIONS_EN",
    "CHECKPOINT_1_PASS_PCT",
    "CHECKPOINT_1_REWARD_XP",
    "EXPLAIN_FALLBACKS",
    "EXPLAIN_FALLBACKS_EN",
    "EXPLAIN_TOPIC_KEYWORDS",
    "EXPLAIN_SCREEN_LABELS",
    "POST_14_PATHS",
    "POST_14_PATHS_EN",
    "PLAN_SENTENCE",
    "FINAL_MESSAGE",
    "FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX",
    "FINAL_BADGE",
    "ASSUMPTIONS_TEXT",
    "COSTS_NOTE",
    "INSTRUMENT_CATEGORY",
    "get_age_group_content",
    "get_day_content",
    "get_demo_personas",
    "get_assumptions_text",
    "get_costs_note",
    "get_instrument_category",
    "get_step_block",
    "get_initial_mission_turn",
    "shuffle_options",
    "get_real_world_challenge",
    "get_final_checklist",
    "get_bank_draft",
    "get_final_message",
    "get_final_badge",
    "get_level_state",
    "get_checkpoint_questions",
    "grade_checkpoint",
    "get_post_14_paths",
    "get_explain_fallback",
    "build_leaderboard",
]

# --------------------------------------------------------------------------- #
# Persony demo
# --------------------------------------------------------------------------- #

DEMO_PERSONAS: list[DemoPersona] = [
    DemoPersona(
        id="young_20",
        short_label="22 l. Student",
        full_label="22 l. • Student (Start od zera)",
        age=22,
        net_income=4500,
        free_cash=1000,
        has_emergency_fund=False,
        main_concern="freeze_money",
        self_confidence_start=2,
    ),
    DemoPersona(
        id="mid_38",
        short_label="38 l. Rodzina",
        full_label="38 l. • Kariera i Rodzina",
        age=38,
        net_income=11000,
        free_cash=2500,
        has_emergency_fund=True,
        main_concern="no_time",
        self_confidence_start=2,
    ),
    DemoPersona(
        id="senior_56",
        short_label="56 l. 50+",
        full_label="56 l. • Ochrona Kapitału 50+",
        age=56,
        net_income=9500,
        free_cash=3000,
        has_emergency_fund=True,
        main_concern="too_late",
        self_confidence_start=2,
    ),
]

# --------------------------------------------------------------------------- #
# Ranking — seed 3 przykładowych znajomych (demo)
# --------------------------------------------------------------------------- #

SEED_LEADERBOARD: list[dict] = [
    {"name": "Kasia K.", "level_title": "Świadomy Start", "xp": 210, "streak_days": 5},
    {"name": "Tomek W.", "level_title": "Obserwator", "xp": 95, "streak_days": 2},
    {"name": "Marek Z.", "level_title": "Obserwator", "xp": 40, "streak_days": 1},
]

# --------------------------------------------------------------------------- #
# Filtr Speakly (3 kept_topics + 6 removed_topics, BEZ time_saved_hours)
# --------------------------------------------------------------------------- #

SPEAKLY_FILTER_BY_GROUP: dict[AgeGroup, SpeaklyFilter] = {
    "20+": SpeaklyFilter(
        kept_topics=[
            "Inflacja zjada gotówkę",
            "Poduszka na awarie, ETF na długi cel",
            "Efekt skali od małych kwot",
        ],
        removed_topics=[
            "Zgadywanie dołka i szczytu rynku",
            "Wybór pojedynczych akcji",
            "Modne kryptowaluty (FOMO)",
            "Codzienne sprawdzanie notowań",
            "Czytanie sprawozdań spółek",
            "Porównywanie dziesiątek funduszy",
        ],
    ),
    "30-50": SpeaklyFilter(
        kept_topics=[
            "Inflacja zjada oszczędności",
            "Automatyzacja w tle bez wykresów",
            "Poduszka osobno, nadwyżki osobno",
        ],
        removed_topics=[
            "Zgadywanie dołka i szczytu rynku",
            "Wybór pojedynczych akcji",
            "Aktywne zarządzanie portfelem w godzinach pracy",
            "Codzienne sprawdzanie notowań",
            "Czytanie sprawozdań spółek",
            "Porównywanie dziesiątek funduszy",
        ],
    ),
    "50+": SpeaklyFilter(
        kept_topics=[
            "Inwestować można w każdym wieku",
            "Tarcza antyinflacyjna dla kapitału",
            "Prostota i dywersyfikacja",
        ],
        removed_topics=[
            "Nadrabianie strat ryzykownymi zakładami",
            "Wybór pojedynczych akcji",
            "Zgadywanie dołka i szczytu rynku",
            "Codzienne sprawdzanie notowań",
            "Czytanie sprawozdań spółek",
            "Porównywanie dziesiątek funduszy",
        ],
    ),
}

# --------------------------------------------------------------------------- #
# Mapa 14 dni — 14-Day Confidence Sprint w 3 czytelnych fazach
# --------------------------------------------------------------------------- #

PHASE_1: str = "Faza 1: Dni 1–4 · Fundamenty i pierwszy krok"
PHASE_2: str = "Faza 2: Dni 5–9 · Ryzyko, bezpieczeństwo i emocje"
PHASE_3: str = "Faza 3: Dni 10–14 · Twój prawdziwy plan"
DURATION_HINT: str = "~5 min/day"


def _roadmap_milestone(
    day: int, title: str, focus: str, phase: str, status: str = "locked"
) -> RoadmapMilestone:
    """Buduje kamień milowy; ``phase``/``duration_hint`` tylko gdy schemat je zna."""
    fields = getattr(RoadmapMilestone, "model_fields", None) or {}
    kwargs: dict = {"day": day, "title": title, "focus": focus, "status": status}
    if "phase" in fields:
        kwargs["phase"] = phase
    if "duration_hint" in fields:
        kwargs["duration_hint"] = DURATION_HINT
    return RoadmapMilestone(**kwargs)


ROADMAP_BY_GROUP: dict[AgeGroup, list[RoadmapMilestone]] = {
    "20+": [
        _roadmap_milestone(
            1,
            "Inflacja, płynność i start",
            "Dziś: 5 min • Przełamanie mitu zamrożonej kasy",
            PHASE_1,
            "active",
        ),
        _roadmap_milestone(
            4,
            "Symulator pierwszego spadku -15%",
            "Po Dniu 4: Checkpoint #1 — szybki test wiedzy",
            PHASE_1,
        ),
        _roadmap_milestone(
            9,
            "Jak wybrać tani, szeroki ETF?",
            "Opłaty (TER), dywersyfikacja i Checkpoint #2",
            PHASE_2,
        ),
        _roadmap_milestone(
            14,
            "Twoja pierwsza inwestycja",
            "Finał sprintu • Uruchomienie planu w Commerzbanku",
            PHASE_3,
        ),
    ],
    "30-50": [
        _roadmap_milestone(
            1,
            "Inflacja i inwestowanie w tle",
            "Dziś: 5 min • Poduszka osobno, nadwyżki osobno",
            PHASE_1,
            "active",
        ),
        _roadmap_milestone(
            4,
            "Automatyzacja bez patrzenia w wykresy",
            "Po Dniu 4: Checkpoint #1 — koszty i pierwsze zlecenie",
            PHASE_1,
        ),
        _roadmap_milestone(
            9,
            "Bezpieczne proporcje dla rodziny",
            "Szeroki ETF z bezpieczną częścią i Checkpoint #2",
            PHASE_2,
        ),
        _roadmap_milestone(
            14,
            "Start automatycznego planu ETF",
            "Finał sprintu • Konfiguracja w Commerzbanku",
            PHASE_3,
        ),
    ],
    "50+": [
        _roadmap_milestone(
            1,
            "Tarcza antyinflacyjna w każdym wieku",
            "Dziś: 5 min • Dlaczego gotówka na koncie traci",
            PHASE_1,
            "active",
        ),
        _roadmap_milestone(
            4,
            "Spokojne reagowanie na wahania",
            "Po Dniu 4: Checkpoint #1 — spokój i horyzont",
            PHASE_1,
        ),
        _roadmap_milestone(
            9,
            "Prosty portfel ochrony kapitału",
            "Niskie koszty, przejrzystość i Checkpoint #2",
            PHASE_2,
        ),
        _roadmap_milestone(
            14,
            "Świadomy start w Commerzbanku",
            "Finał sprintu • Bezstresowe uruchomienie planu",
            PHASE_3,
        ),
    ],
}

# --------------------------------------------------------------------------- #
# 3 mikro-lekcje Dnia 1 na grupę (20 s, +15 XP)
# --------------------------------------------------------------------------- #

MICRO_LESSONS_BY_GROUP: dict[AgeGroup, list[MicroLessonCard]] = {
    "20+": [
        MicroLessonCard(
            id="ml_20_1",
            title="Inflacja zjada gotówkę",
            duration_sec=20,
            summary=(
                "Pieniądze leżące na koncie 0% tracą siłę nabywczą: przy inflacji 3,5% z 10 000 zł "
                "po roku kupisz towary warte dziś około 9 650 zł."
            ),
            key_takeaway="Brak decyzji to realna strata ok. 350 zł na każde 10 000 zł rocznie.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_2",
            title="Poduszka na awarie, ETF na długi cel",
            duration_sec=20,
            summary=(
                "Poduszka to 3 miesiące wydatków — przy 2 000 zł/mies. daje 6 000 zł na awarie. "
                "ETF zostaje osobno i nie jest zamrożony: w ostateczności sprzedasz jednostki, "
                "a wypłata zajmie zwykle kilka dni roboczych."
            ),
            key_takeaway="6 000 zł poduszki chroni plan — ETF to pieniądze na długi horyzont.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_3",
            title="Efekt skali od małych kwot",
            duration_sec=20,
            summary=(
                "200 zł/mies. przez 15 lat to 36 000 zł wpłat, a przy założeniu 5,7% netto rocznie "
                "historycznie ok. 56 700 zł nominalnie (przykład edukacyjny, bez gwarancji)."
            ),
            key_takeaway="Czas pracuje mocniej niż wielkość pierwszej wpłaty.",
            xp_reward=15,
        ),
    ],
    "30-50": [
        MicroLessonCard(
            id="ml_30_1",
            title="Inflacja zjada oszczędności",
            duration_sec=20,
            summary=(
                "20 000 zł na nieoprocentowanym koncie przy inflacji 3,5% to po roku o około "
                "700 zł mniejsza siła nabywcza — mimo że saldo się nie zmieniło."
            ),
            key_takeaway="Nadwyżki powinny pracować szybciej niż inflacja 3,5% rocznie.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_2",
            title="Automatyzacja w tle bez wykresów",
            duration_sec=20,
            summary=(
                "Stałe zlecenie 200 zł/mies. to 2 400 zł wpłat rocznie bez codziennego śledzenia "
                "giełdy. Szeroki ETF trzyma w środku setki firm, więc nie musisz ich wybierać."
            ),
            key_takeaway="2 400 zł rocznie wpada w tle — bez patrzenia w wykresy.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_3",
            title="Poduszka osobno, nadwyżki osobno",
            duration_sec=20,
            summary=(
                "Wydatki 2 500 zł/mies. × 3 miesiące = 7 500 zł poduszki. Dopiero kwoty powyżej "
                "tej granicy kierujesz na rynek — dlatego spadek portfela nie zmusza Cię do sprzedaży."
            ),
            key_takeaway="7 500 zł poduszki = spokojniejsze znoszenie chwilowych spadków.",
            xp_reward=15,
        ),
    ],
    "50+": [
        MicroLessonCard(
            id="ml_50_1",
            title="Inwestować można w każdym wieku",
            duration_sec=20,
            summary=(
                "Horyzont 7 lat to nadal czas na świadomy start: 1 200 zł/mies. daje 100 800 zł "
                "wpłat, a nawet przejściowe -20% w roku 3 zostawia czas na spokojne odbudowanie "
                "planu (scenariusz edukacyjny)."
            ),
            key_takeaway="Przy 7 latach horyzontu liczy się spokój, nie pośpiech.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_2",
            title="Tarcza antyinflacyjna dla kapitału",
            duration_sec=20,
            summary=(
                "50 000 zł na koncie 0% przy inflacji 3,5% traci rocznie około 1 750 zł siły "
                "nabywczej — im większy dorobek, tym bardziej to boli."
            ),
            key_takeaway="Ok. 1 750 zł rocznie na każde 50 000 zł — o tyle mniej kupuje gotówka.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_3",
            title="Prostota i dywersyfikacja",
            duration_sec=20,
            summary=(
                "Jedna spółka to jedno ryzyko, a szeroki ETF rozkłada kapitał na setki firm. "
                "TER 0,20% oznacza 20 zł rocznie od 10 000 zł — przewidywalny, jawny koszt."
            ),
            key_takeaway="Setki firm zamiast jednej, 20 zł kosztu od 10 000 zł, pełna przejrzystość.",
            xp_reward=15,
        ),
    ],
}

# --------------------------------------------------------------------------- #
# Szablony tekstów (placeholdery uzupełniane z session_facts)
# --------------------------------------------------------------------------- #

PLAN_SENTENCE: dict[str, str] = {
    "split": (
        "Z Twoich {free_cash} zł wolnych środków {emergency_savings_monthly} zł idzie na poduszkę, "
        "a {recommended_monthly} zł/mies. na trening w szeroki ETF."
    ),
    "invest": (
        "Masz już poduszkę, więc przykładowe {recommended_monthly} zł miesięcznie może pracować "
        "w szerokim ETF."
    ),
    "savings_first": (
        "Najpierw poduszka: {emergency_savings_monthly} zł/mies. na konto oszczędnościowe. "
        "ETF pokażemy na przykładzie {recommended_monthly} zł/mies."
    ),
}

FINAL_MESSAGE: str = (
    "Dzień 1 z 14 zaliczony! Przewijamy {horizon_years} lat: wpłaty na koncie 0% byłyby warte "
    "realnie ok. {cash_real_value} zł, a w szerokim ETF historycznie ok. {etf_real_value} zł "
    "(założenia edukacyjne). Zrób dziś małe wyzwanie i wróć jutro po Dzień 2."
)

FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX: str = (
    "Pamiętaj: najpierw poduszka — ETF to przykład na później."
)

FINAL_BADGE: str = "Dzień 1 ukończony • Cel: {horizon_years} lat"

# Finały Dni 2–4 (PL) — bez nowych liczb i bez obietnic zysku.
FINAL_MESSAGE_BY_DAY: dict[int, str] = {
    1: FINAL_MESSAGE,
    2: (
        "Dzień 2 z 14 zaliczony! Wiesz już, na co patrzeć w tabeli opłat i po co jest tryb demo. "
        "Jutro w Dniu 3 ustawimy pierwsze zlecenie stałe."
    ),
    3: (
        "Dzień 3 z 14 zaliczony! Stałe zlecenie i symboliczny test 10 zł to fundament "
        "regularności. Jutro w Dniu 4 zobaczysz pierwsze mikro-zlecenie na szeroki ETF."
    ),
    4: (
        "Dzień 4 z 14 zaliczony! Fundamenty i praktyka pierwszego zlecenia masz za sobą. "
        "Czas na Checkpoint #1 — krótki test wiedzy z Dni 1–4."
    ),
}

FINAL_BADGE_BY_DAY: dict[int, str] = {
    1: FINAL_BADGE,
    2: "Dzień 2 ukończony • Opłaty sprawdzone",
    3: "Dzień 3 ukończony • Test 10 zł",
    4: "Dzień 4 ukończony • Gotowość na Checkpoint #1",
}

ASSUMPTIONS_TEXT: str = (
    "Założenia edukacyjne: 5,7% rocznie po kosztach (przed podatkiem 19%), inflacja 3,5% rocznie, "
    "wartości w dzisiejszych złotych. To nie jest prognoza ani gwarancja."
)

COSTS_NOTE: str = (
    "Nie uwzględniono podatku od zysków, opłat brokera i ryzyka walutowego. "
    "Wyniki z przeszłości nie gwarantują przyszłych."
)

INSTRUMENT_CATEGORY: str = "Szeroki globalny fundusz ETF (przykład edukacyjny na Dzień 14)"

# --------------------------------------------------------------------------- #
# Bloki kroków misji (dokładnie jedna opcja z is_optimal=True w każdym bloku)
# --------------------------------------------------------------------------- #

STEP1_BADGE: str = "Dzień 1 • Start ({recommended_monthly} zł/mies.)"

STEP1_BY_AGE_GROUP: dict[AgeGroup, dict] = {
    "20+": {
        "badge": STEP1_BADGE,
        "step_question": "Co na start daje Ci większy spokój?",
        "luna_message": (
            "Cześć! Jestem Kita, Twój codzienny AI Coach — zaczynamy Dzień 1 z 14! {plan_sentence} "
            "Nie musisz zgadywać pojedynczych firm: szeroki ETF rozkłada pieniądze na setki spółek "
            "naraz. Co na start daje Ci większy spokój?"
        ),
        "optimal_criterion": (
            "rozłożenie pieniędzy na wiele spółek (dywersyfikacja) zamiast jednej firmy; "
            "nie eliminuje ryzyka rynku"
        ),
        "options": [
            {
                "id": "a",
                "text": "Szeroki ETF na cały rynek (dywersyfikacja)",
                "is_optimal": True,
                "feedback": (
                    "Tak! Rozłożenie pieniędzy na setki firm ogranicza wpływ wpadki jednej spółki — "
                    "ryzyka rynku nie usuwa, ale je łagodzi."
                ),
            },
            {
                "id": "b",
                "text": "Kupno akcji jednej znanej, stabilnej firmy",
                "is_optimal": False,
                "feedback": (
                    "Nawet znana firma może się potknąć, a wtedy cała kwota idzie razem z nią. "
                    "Szeroki ETF rozkłada to ryzyko na setki spółek."
                ),
            },
            {
                "id": "c",
                "text": "Zostawienie wszystkiego na zwykłym koncie",
                "is_optimal": False,
                "feedback": (
                    "Konto jest świetne na bieżące wydatki, ale przy inflacji ok. 3,5% rocznie "
                    "gotówka z roku na rok kupuje mniej."
                ),
            },
        ],
    },
    "30-50": {
        "badge": STEP1_BADGE,
        "step_question": "Co jest największą zaletą takiego podejścia, gdy brakuje czasu?",
        "luna_message": (
            "Cześć! Jestem Kita, Twój codzienny AI Coach — witaj w Dniu 1 z 14. {plan_sentence} "
            "Pasywny szeroki ETF działa w tle, bez codziennego śledzenia giełdy. Co jest jego "
            "największą zaletą, gdy brakuje czasu?"
        ),
        "optimal_criterion": (
            "automatyzacja i dywersyfikacja bez codziennego śledzenia; brak gwarancji braku strat"
        ),
        "options": [
            {
                "id": "a",
                "text": "Działa w tle: dywersyfikacja bez patrzenia w wykresy",
                "is_optimal": True,
                "feedback": (
                    "W punkt! Stały plan w szerokim ETF oszczędza czas i nie wymaga bycia ekspertem "
                    "od giełdy."
                ),
            },
            {
                "id": "b",
                "text": "Daje gwarancję, że w ciągu roku nie będzie straty",
                "is_optimal": False,
                "feedback": (
                    "Gwarancji nie ma — ETF może spadać. Jego siłą jest rozłożenie ryzyka i długi horyzont."
                ),
            },
            {
                "id": "c",
                "text": "Pozwala codziennie wyszukiwać okazje na rynku",
                "is_optimal": False,
                "feedback": (
                    "To dokładnie to, czego chcesz uniknąć — pasywny ETF ma Ci oszczędzać czas, "
                    "a nie go zabierać."
                ),
            },
        ],
    },
    "50+": {
        "badge": STEP1_BADGE,
        "step_question": "Dlaczego nie trzymać całego kapitału wyłącznie na zwykłym koncie?",
        "luna_message": (
            "Dzień dobry! Jestem Kita, Twój codzienny AI Coach — zaczynamy spokojny, 14-dniowy plan. "
            "Inwestować można w każdym wieku, wystarczy dopasowany horyzont. {plan_sentence} "
            "Dlaczego lepiej nie trzymać całego kapitału wyłącznie na zwykłym koncie?"
        ),
        "optimal_criterion": "inflacja co roku zmniejsza realną wartość gotówki",
        "options": [
            {
                "id": "a",
                "text": "Bo inflacja co roku realnie zmniejsza wartość gotówki",
                "is_optimal": True,
                "feedback": (
                    "Dokładnie. Brak decyzji też jest decyzją: gotówka na koncie 0% z roku na rok "
                    "kupuje mniej."
                ),
            },
            {
                "id": "b",
                "text": "Bo pieniądze w funduszach zawsze zarabiają więcej niż na koncie",
                "is_optimal": False,
                "feedback": (
                    "Nie zawsze — fundusze też mogą spadać. Chodzi o to, że sama gotówka traci na "
                    "inflacji, a fundusze mają szansę to ograniczyć."
                ),
            },
            {
                "id": "c",
                "text": "Bo lepiej szybko wrzucić wszystko w jedną firmę",
                "is_optimal": False,
                "feedback": (
                    "Skupienie wszystkiego w jednej firmie to duże ryzyko. Szeroki ETF rozkłada je "
                    "na setki spółek."
                ),
            },
        ],
    },
}

# Warianty personalizacji Kroku 1 (docs/03 §10, docs/02 §9):
# ``savings_first`` podkreśla priorytet poduszki, ``self_confidence_start >= 4``
# pogłębia pytanie o koszty i prostotę szerokiego ETF. Persony demo (2/5) oraz
# brak pola w faktach zachowują dotychczasowy blok wg ``age_group``.
STEP1_SAVINGS_FIRST: dict = {
    "badge": "Dzień 1 • Start ({emergency_savings_monthly} zł/mies. na poduszkę)",
    "step_question": "Od czego zaczynasz, gdy nie masz jeszcze poduszki?",
    "luna_message": (
        "Cześć! Jestem Kita, Twój codzienny AI Coach — zaczynamy Dzień 1 z 14! {plan_sentence} "
        "Zanim pieniądze trafią na rynek, warto mieć bezpieczną poduszkę na awarie. "
        "Od czego zaczynasz?"
    ),
    "optimal_criterion": (
        "najpierw buduje poduszkę na koncie oszczędnościowym, a inwestowanie startuje później "
        "i tylko z wolnych nadwyżek"
    ),
    "options": [
        {
            "id": "a",
            "text": "Najpierw {emergency_savings_monthly} zł/mies. na poduszkę, ETF później",
            "is_optimal": True,
            "feedback": (
                "Dokładnie! Poduszka chroni codzienny budżet, a szeroki ETF wchodzi spokojnie, "
                "gdy masz już bezpieczną bazę."
            ),
        },
        {
            "id": "b",
            "text": "Od razu całe wolne środki w jeden popularny fundusz",
            "is_optimal": False,
            "feedback": (
                "Bez poduszki każda awaria może zmusić Cię do sprzedaży w złym momencie. "
                "Najpierw bezpieczna baza, potem inwestowanie."
            ),
        },
        {
            "id": "c",
            "text": "Trzymam wszystko na koncie 0% i odkładam decyzję",
            "is_optimal": False,
            "feedback": (
                "Gotówka na koncie 0% traci realnie przez inflację ok. 3,5% rocznie. Poduszka "
                "jest potrzebna, ale nadwyżki mogą pracować w szerokim ETF."
            ),
        },
    ],
}

STEP1_CONFIDENT: dict = {
    "badge": "Dzień 1 • Start ({recommended_monthly} zł/mies.)",
    "step_question": "Który koszt i nawyk naprawdę decydują o wyniku szerokiego ETF?",
    "luna_message": (
        "Cześć! Jestem Kita, Twój codzienny AI Coach — zaczynamy Dzień 1 z 14! {plan_sentence} "
        "Skoro czujesz się pewniej, wejdźmy głębiej: w długim horyzoncie liczą się koszty "
        "i prostota, a nie próba pobicia rynku. Który koszt i nawyk naprawdę decydują o wyniku?"
    ),
    "optimal_criterion": (
        "niskie koszty (TER) i regularne wpłaty w szeroki ETF zamiast prób pobicia rynku "
        "i częstego handlu"
    ),
    "options": [
        {
            "id": "a",
            "text": "Niskie TER i regularne wpłaty w szeroki ETF zamiast pobicia rynku",
            "is_optimal": True,
            "feedback": (
                "W punkt! Koszty i regularność działają przez cały horyzont, a próba pobicia "
                "rynku zwykle zwiększa koszty i stres."
            ),
        },
        {
            "id": "b",
            "text": "Wysokie opłaty nie mają znaczenia, jeśli fundusz jest popularny",
            "is_optimal": False,
            "feedback": (
                "Opłaty (TER) obniżają wynik co roku, niezależnie od popularności. W długim "
                "horyzoncie właśnie one najmocniej odbijają się na kapitale."
            ),
        },
        {
            "id": "c",
            "text": "Częste kupowanie i sprzedawanie, żeby trafić lepszy moment",
            "is_optimal": False,
            "feedback": (
                "Częsty handel generuje koszty i emocje, a trafienie momentu jest bardzo trudne. "
                "Regularne wpłaty rozkładają ryzyko w czasie."
            ),
        },
    ],
}

STEP2_BY_CONCERN: dict[MainConcern, dict] = {
    "freeze_money": {
        "badge": "Nagły wydatek • Test płynności",
        "step_question": "Psuje się laptop. Co robisz?",
        "luna_message": (
            "Przewijamy o 6 miesięcy — w ETF masz już ok. {half_year_value} zł, a poduszka rośnie "
            "obok. Nagle psuje się laptop i potrzebujesz kilku tysięcy. Co robisz?"
        ),
        "optimal_criterion": (
            "płaci z poduszki; rozumie, że ETF nie jest zamrożony i w ostateczności można sprzedać "
            "jednostki (zwykle kilka dni roboczych)"
        ),
        "options": [
            {
                "id": "a",
                "text": "Płacę z poduszki — ETF zostaje i dalej pracuje",
                "is_optimal": True,
                "feedback": (
                    "Dokładnie! Poduszka jest na awarie. A gdyby nie wystarczyła, ETF też nie jest "
                    "zamrożony — sprzedaż i wypłata zajmują zwykle kilka dni roboczych."
                ),
            },
            {
                "id": "b",
                "text": "Sprzedaję część ETF i wypłacam w kilka dni roboczych",
                "is_optimal": False,
                "feedback": (
                    "To możliwe, bo środki w ETF nie są zamrożone. Ale na bieżące awarie lepiej użyć "
                    "poduszki — sprzedaż może wypaść w gorszym momencie rynku."
                ),
            },
            {
                "id": "c",
                "text": "Nic nie robię — pieniądze w ETF są zablokowane na lata",
                "is_optimal": False,
                "feedback": (
                    "To częsty mit: ETF można sprzedać w dowolnym dniu sesji, a pieniądze wpływają "
                    "zwykle po kilku dniach roboczych."
                ),
            },
        ],
    },
    "no_time": {
        "badge": "Brak czasu • Test automatu",
        "step_question": "W pracy urwanie głowy. Jak prowadzisz inwestycję?",
        "luna_message": (
            "Przewijamy o 6 miesięcy — masz ok. {half_year_value} zł w ETF. W pracy gorący okres "
            "i zero czasu na giełdę. Jak prowadzisz swoją inwestycję?"
        ),
        "optimal_criterion": (
            "stały, automatyczny plan działający w tle; brak codziennego sprawdzania i brak "
            "odkładania startu na później"
        ),
        "options": [
            {
                "id": "a",
                "text": "Zostawiam stałe zlecenie — plan działa w tle",
                "is_optimal": True,
                "feedback": "W punkt! Stały plan nie wymaga Twojego czasu, a regularność robi robotę.",
            },
            {
                "id": "b",
                "text": "Codziennie sprawdzam notowania w przerwie",
                "is_optimal": False,
                "feedback": (
                    "Codzienne zaglądanie zwykle zwiększa stres i pokusę pochopnych decyzji, "
                    "a nie wyniki."
                ),
            },
            {
                "id": "c",
                "text": "Wstrzymuję się, aż będę miał czas nauczyć się giełdy",
                "is_optimal": False,
                "feedback": (
                    "Czekanie na idealny moment kosztuje czas, a to czas jest tu głównym "
                    "sprzymierzeńcem. Wystarczy prosty, stały plan."
                ),
            },
        ],
    },
    "lose_money": {
        "badge": "Gorąca rada • Test dywersyfikacji",
        "step_question": "Kolega radzi kupić jedną popularną spółkę. Co robisz?",
        "luna_message": (
            "Przewijamy o 6 miesięcy — masz ok. {half_year_value} zł w ETF. Kolega przekonuje: "
            "„kup akcje jednej popularnej spółki, zarobisz szybciej”. Co robisz?"
        ),
        "optimal_criterion": (
            "pozostaje przy szerokim, zdywersyfikowanym funduszu; rozumie, że koncentracja "
            "w jednej spółce zwiększa ryzyko"
        ),
        "options": [
            {
                "id": "a",
                "text": "Zostaję przy szerokim ETF — jedna spółka to większe ryzyko",
                "is_optimal": True,
                "feedback": (
                    "Dobrze! Szeroki ETF rozkłada ryzyko na setki firm; jedna spółka może rosnąć, "
                    "ale równie dobrze mocno spaść."
                ),
            },
            {
                "id": "b",
                "text": "Przenoszę całość do tej spółki",
                "is_optimal": False,
                "feedback": (
                    "Cała kwota w jednej firmie to duże ryzyko — jej wpadka uderza w cały Twój portfel."
                ),
            },
            {
                "id": "c",
                "text": "Przenoszę połowę — ryzyko się rozłoży",
                "is_optimal": False,
                "feedback": (
                    "Połowa w jednej spółce to nadal wysoka koncentracja. Szeroki ETF rozkłada "
                    "ryzyko dużo skuteczniej."
                ),
            },
        ],
    },
    "too_late": {
        "badge": "Wiek nie wyklucza • Test horyzontu",
        "step_question": "Znajomy mówi, że to za późno. Co odpowiadasz?",
        "luna_message": (
            "Po 6 miesiącach masz ok. {half_year_value} zł w szerokim ETF. Znajomy mówi: „w Twoim "
            "wieku to już za późno”. Twój horyzont to {horizon_years} lat, a poduszka leży "
            "bezpiecznie obok. Co odpowiadasz?"
        ),
        "optimal_criterion": (
            "inwestować można w każdym wieku; kluczowe jest dopasowanie horyzontu i proporcji oraz "
            "oddzielna poduszka"
        ),
        "options": [
            {
                "id": "a",
                "text": "Wiek nie wyklucza — dopasowuję horyzont i proporcje, poduszkę trzymam osobno",
                "is_optimal": True,
                "feedback": (
                    "Świetna, dojrzała decyzja! Dopasowany horyzont i osobna poduszka to najlepsza "
                    "ochrona przed wahaniami."
                ),
            },
            {
                "id": "b",
                "text": "Faktycznie — zostawiam wszystko na koncie",
                "is_optimal": False,
                "feedback": (
                    "Rozumiem obawę, ale gotówka też traci — przez inflację. Można zacząć małą kwotą "
                    "i dopasować horyzont."
                ),
            },
            {
                "id": "c",
                "text": "Wkładam więcej w ryzykowną firmę, żeby szybko nadrobić",
                "is_optimal": False,
                "feedback": (
                    "Nadrabianie ryzykiem zwiększa szansę na dużą stratę, a przy krótszym horyzoncie "
                    "jest na nią mniej czasu."
                ),
            },
        ],
    },
}

STEP3: dict = {
    "badge": "Spadek -20% • Test spokoju",
    "step_question": "Po 3 latach portfel jest na papierze -20%. Co robisz?",
    "luna_message": (
        "Przewijamy o 3 lata. Wpłaciłeś {year3_paid} zł, rynek przejściowo spadł i na papierze "
        "portfel jest wart ok. {year3_stress_value} zł (-20% — to scenariusz edukacyjny). Co robisz?"
    ),
    "optimal_criterion": (
        "zachowuje plan i spokój; rozumie, że spadek na papierze to wahanie dopóki nie sprzeda; "
        "ma poduszkę osobno i nie musi sprzedawać; nie wpada w panikę"
    ),
    "options": [
        {
            "id": "a",
            "text": "Trzymam plan i dalej wpłacam — to wahanie, a mój horyzont to {horizon_years} lat",
            "is_optimal": True,
            "feedback": (
                "Dokładnie. Spadek na papierze to wahanie, a nie strata, dopóki nie sprzedajesz — "
                "i właśnie dlatego poduszka leży osobno. Historia nie gwarantuje przyszłości."
            ),
        },
        {
            "id": "b",
            "text": "Sprzedaję wszystko, żeby nie stracić więcej",
            "is_optimal": False,
            "feedback": (
                "To najczęstszy błąd: sprzedaż po spadku zamienia stratę na papierze w stratę realną."
            ),
        },
        {
            "id": "c",
            "text": "Przestaję wpłacać i czekam, aż rynek odbije",
            "is_optimal": False,
            "feedback": (
                "Zrozumiałe, ale wpłaty po spadku kupują więcej jednostek taniej; wstrzymanie zwykle "
                "odbiera tę przewagę."
            ),
        },
    ],
}

# --------------------------------------------------------------------------- #
# Dni 2–4 (PL): 2 kroki decyzyjne + 2 mikro-lekcje każdego dnia (docs/03 §2)
# --------------------------------------------------------------------------- #

DAY2_STEPS: dict[int, dict] = {
    1: {
        "badge": "Dzień 2 • Konto i opłaty",
        "step_question": "Co warto sprawdzić w tabeli opłat, zanim otworzysz konto maklerskie?",
        "luna_message": (
            "Dzień 2 z 14 — czas na praktykę. {plan_sentence} Zanim otworzysz konto maklerskie, "
            "zajrzyj do tabeli opłat. Co warto sprawdzić?"
        ),
        "optimal_criterion": (
            "patrzy na łączny koszt: opłatę za zlecenie i TER szerokiego ETF, a nie tylko na "
            "darmowe otwarcie konta"
        ),
        "options": [
            {
                "id": "a",
                "text": "Łączny koszt: opłata za zlecenie i TER szerokiego ETF",
                "is_optimal": True,
                "feedback": (
                    "Dokładnie. Opłata za zlecenie i TER działają razem — darmowe otwarcie konta "
                    "nie znaczy darmowe inwestowanie."
                ),
            },
            {
                "id": "b",
                "text": "Tylko to, czy otwarcie konta jest darmowe",
                "is_optimal": False,
                "feedback": (
                    "Darmowe otwarcie to dopiero początek. Liczy się koszt każdego zlecenia "
                    "i roczny koszt funduszu (TER)."
                ),
            },
            {
                "id": "c",
                "text": "Maksymalną dźwignię, żeby szybciej zarobić",
                "is_optimal": False,
                "feedback": (
                    "Dźwignia zwiększa zarówno szansę, jak i ryzyko straty. Na start liczy się "
                    "prostota i przewidywalne koszty."
                ),
            },
        ],
    },
    2: {
        "badge": "Dzień 2 • Pułapka opłat",
        "step_question": "Znajomy składa po 20 małych zleceń miesięcznie, żeby łapać okazje. Co jest rozsądniejsze?",
        "luna_message": (
            "Dzień 2 z 14 — koszty i dywersyfikacja. {plan_sentence} Znajomy mówi, że składa po 20 "
            "małych zleceń miesięcznie, żeby łapać okazje. Co jest rozsądniejsze?"
        ),
        "optimal_criterion": (
            "kilka regularnych zleceń w szeroki ETF zamiast wielu małych transakcji; częste zlecenia "
            "mnożą opłaty, a dywersyfikacji nie poprawiają"
        ),
        "options": [
            {
                "id": "a",
                "text": "Kilka regularnych zleceń w szeroki ETF — mniej opłat, ta sama dywersyfikacja",
                "is_optimal": True,
                "feedback": (
                    "Dokładnie. Każde zlecenie to opłata, a szeroki ETF już zawiera setki firm. "
                    "Mniej transakcji to niższy koszt bez utraty dywersyfikacji."
                ),
            },
            {
                "id": "b",
                "text": "20 zleceń miesięcznie, bo więcej okazji to więcej zysku",
                "is_optimal": False,
                "feedback": (
                    "20 zleceń × 3 zł to już 60 zł miesięcznie samych opłat. Więcej transakcji nie "
                    "zwiększa dywersyfikacji — szeroki ETF ma ją od razu."
                ),
            },
            {
                "id": "c",
                "text": "Jedno duże zlecenie w jedną spółkę, żeby ograniczyć opłaty",
                "is_optimal": False,
                "feedback": (
                    "Opłaty spadną, ale całe ryzyko trafi do jednej firmy. Szeroki ETF daje niskie "
                    "koszty i rozproszenie jednocześnie."
                ),
            },
        ],
    },
}

DAY3_STEPS: dict[int, dict] = {
    1: {
        "badge": "Dzień 3 • Zlecenie stałe",
        "step_question": "Co daje stałe zlecenie ustawione raz?",
        "luna_message": (
            "Dzień 3 z 14 — automatyzacja. {plan_sentence} Stałe zlecenie ustawiasz raz, a bank "
            "realizuje je regularnie. Co dzięki temu zyskujesz?"
        ),
        "optimal_criterion": (
            "regularne wpłaty bez codziennych decyzji; plan działa w tle i ogranicza emocje"
        ),
        "options": [
            {
                "id": "a",
                "text": "Regularne wpłaty bez codziennych decyzji — plan działa w tle",
                "is_optimal": True,
                "feedback": (
                    "Tak! Jedna decyzja zamiast codziennego stresu. Regularność zwykle waży "
                    "więcej niż próba trafienia idealnego momentu."
                ),
            },
            {
                "id": "b",
                "text": "Gwarancję, że portfel nigdy nie spadnie",
                "is_optimal": False,
                "feedback": (
                    "Gwarancji nie ma — szeroki ETF może spadać. Automatyzacja chroni przed "
                    "emocjami, nie przed wahaniami rynku."
                ),
            },
            {
                "id": "c",
                "text": "Możliwość kupowania wyłącznie w idealnym momencie",
                "is_optimal": False,
                "feedback": (
                    "Stałe zlecenie kupuje regularnie, także gdy nikt nie wie, czy to idealny "
                    "moment. Właśnie to rozkłada ryzyko w czasie."
                ),
            },
        ],
    },
    2: {
        "badge": "Dzień 3 • Gorący typ",
        "step_question": "Znajomy wysyła „gorący typ” na jedną spółkę. Co robisz ze swoim stałym planem?",
        "luna_message": (
            "Dzień 3 z 14 — emocje i gorące typy. {plan_sentence} Znajomy wysyła „gorący typ”: "
            "jedna spółka ma „na pewno” podwoić wartość. Co robisz ze swoim stałym planem?"
        ),
        "optimal_criterion": (
            "trzyma się prostego, zautomatyzowanego planu w szeroki ETF; nie ulega FOMO ani typom "
            "na pojedyncze spółki"
        ),
        "options": [
            {
                "id": "a",
                "text": "Trzymam stałe zlecenie w szeroki ETF — typ na jedną spółkę to duża koncentracja ryzyka",
                "is_optimal": True,
                "feedback": (
                    "Dokładnie. Stały plan nie potrzebuje typów, a jedna spółka to ryzyko, którego "
                    "szeroki ETF nie ma w takiej skali."
                ),
            },
            {
                "id": "b",
                "text": "Przerzucam cały plan w tę spółkę, bo okazja się nie powtórzy",
                "is_optimal": False,
                "feedback": (
                    "To klasyczne FOMO: cała kwota w jednej firmie oznacza, że jej wpadka zabiera "
                    "cały plan. Nikt nie gwarantuje wzrostu."
                ),
            },
            {
                "id": "c",
                "text": "Wstrzymuję wpłaty i czekam, aż typ się potwierdzi",
                "is_optimal": False,
                "feedback": (
                    "Czekanie na potwierdzenie typa to zgadywanie momentu. Regularne wpłaty "
                    "w szeroki ETF działają bez takich zakładów."
                ),
            },
        ],
    },
}

DAY4_STEPS: dict[int, dict] = {
    1: {
        "badge": "Dzień 4 • Pierwsze mikro-zlecenie",
        "step_question": "Jak w praktyce wygląda pierwsze mikro-zlecenie na szeroki ETF?",
        "luna_message": (
            "Dzień 4 z 14 — praktyka i przygotowanie do Checkpoint #1. {plan_sentence} "
            "Jak wygląda Twoje pierwsze mikro-zlecenie na szeroki globalny ETF?"
        ),
        "optimal_criterion": (
            "wybiera szeroki ETF (cały rynek), małą kwotę i zwykłe zlecenie; nie zgaduje momentu "
            "i nie kupuje pojedynczych spółek"
        ),
        "options": [
            {
                "id": "a",
                "text": "Kupuję szeroki ETF za małą kwotę, bez zgadywania momentu",
                "is_optimal": True,
                "feedback": (
                    "Świetnie! Szeroki ETF daje dywersyfikację, a mała kwota pozwala oswoić "
                    "proces bez presji."
                ),
            },
            {
                "id": "b",
                "text": "Czekam na idealny dołek i wtedy wchodzę całością",
                "is_optimal": False,
                "feedback": (
                    "Trafienie dołka jest bardzo trudne, a czekanie może trwać latami. "
                    "Regularne małe wpłaty rozkładają ryzyko w czasie."
                ),
            },
            {
                "id": "c",
                "text": "Kupuję akcje jednej spółki, bo tak jest prościej",
                "is_optimal": False,
                "feedback": (
                    "Jedna spółka to wysoka koncentracja ryzyka. Szeroki ETF rozkłada je na "
                    "setki firm."
                ),
            },
        ],
    },
    2: {
        "badge": "Dzień 4 • Plan pod kontrolą",
        "step_question": "Po miesiącu psuje się pralka, a ETF urósł z 20% do 28% portfela. Co robisz?",
        "luna_message": (
            "Dzień 4 z 14 — utrzymanie prostego planu przed Checkpoint #1. {plan_sentence} Po "
            "miesiącu psuje się pralka, a udział ETF w portfelu urósł z 20% do 28%. Co robisz?"
        ),
        "optimal_criterion": (
            "opłaca naprawę z poduszki i raz w kwartale wraca do ustalonych proporcji "
            "(rebalansowanie), bez codziennego handlu"
        ),
        "options": [
            {
                "id": "a",
                "text": "Płacę z poduszki i raz w kwartale wracam do proporcji 20% ETF / 80% poduszka",
                "is_optimal": True,
                "feedback": (
                    "W punkt! Poduszka obsługuje niespodzianki, a jedno spokojne rebalansowanie na "
                    "kwartał przywraca plan bez zbędnych transakcji."
                ),
            },
            {
                "id": "b",
                "text": "Sprzedaję cały ETF, żeby naprawić pralkę i zacząć plan od nowa",
                "is_optimal": False,
                "feedback": (
                    "Sprzedaż całego portfela to koszty i wyjście z planu. Poduszka istnieje po to, "
                    "żeby inwestycja mogła dalej pracować."
                ),
            },
            {
                "id": "c",
                "text": "Codziennie przestawiam proporcje, żeby złapać lepszy moment",
                "is_optimal": False,
                "feedback": (
                    "Codzienne przestawianie to koszty i emocje. Rebalansowanie raz na kwartał "
                    "wystarcza, żeby utrzymać proste proporcje."
                ),
            },
        ],
    },
}

DAY_STEPS: dict[int, dict[int, dict]] = {2: DAY2_STEPS, 3: DAY3_STEPS, 4: DAY4_STEPS}

DAY2_LESSONS: list[MicroLessonCard] = [
    MicroLessonCard(
        id="ml_d2_1",
        title="Konto maklerskie i tryb demo",
        duration_sec=20,
        summary=(
            "Konto maklerskie to miejsce, w którym składasz zlecenia. Tryb demo pozwala przejść "
            "cały proces za 0 zł realnego ryzyka — np. zlecenie testowe na 10 zł."
        ),
        key_takeaway="Najpierw proces za 0 zł ryzyka, potem prawdziwe pieniądze.",
        xp_reward=15,
    ),
    MicroLessonCard(
        id="ml_d2_2",
        title="Tabela opłat i TER",
        duration_sec=20,
        summary=(
            "Przykład: TER 0,20% od 10 000 zł to 20 zł rocznie, a 12 zleceń po 3 zł to 36 zł — "
            "razem około 56 zł. Darmowe otwarcie konta nie znaczy darmowe inwestowanie."
        ),
        key_takeaway="Razem ok. 56 zł rocznie na 10 000 zł — patrz na pełny koszt, nie jedną pozycję.",
        xp_reward=15,
    ),
]

DAY3_LESSONS: list[MicroLessonCard] = [
    MicroLessonCard(
        id="ml_d3_1",
        title="Zlecenie stałe",
        duration_sec=20,
        summary=(
            "Stałe zlecenie 100 zł/mies. daje 1 200 zł wpłat rocznie bez podejmowania 12 decyzji "
            "i bez śledzenia notowań. Decyzja podjęta raz chroni przed emocjami."
        ),
        key_takeaway="1 200 zł rocznie wpada automatycznie — regularność bije wyczucie momentu.",
        xp_reward=15,
    ),
    MicroLessonCard(
        id="ml_d3_2",
        title="10 zł, które uczy",
        duration_sec=20,
        summary=(
            "Przy opłacie 3 zł za zlecenie przelew 10 zł kosztuje aż 30% kwoty — dlatego pierwszy "
            "test jest symboliczny. Uczy procesu i pokazuje koszty, zanim wejdą większe kwoty."
        ),
        key_takeaway="10 zł + 3 zł opłaty = lekcja o kosztach, nie sposób na szybki zysk.",
        xp_reward=15,
    ),
]

DAY4_LESSONS: list[MicroLessonCard] = [
    MicroLessonCard(
        id="ml_d4_1",
        title="Szeroki ETF w praktyce",
        duration_sec=20,
        summary=(
            "Pierwsze mikro-zlecenie to np. 50–100 zł w szeroki globalny ETF: jedna transakcja, "
            "setki firm w środku i zero typowania pojedynczych spółek czy dołka."
        ),
        key_takeaway="50–100 zł i setki firm w środku — prostota zamiast trafiania w moment.",
        xp_reward=15,
    ),
    MicroLessonCard(
        id="ml_d4_2",
        title="Gotowość na Checkpoint #1",
        duration_sec=20,
        summary=(
            "Checkpoint #1 ma 4 pytania i próg 75%, czyli 3 poprawne odpowiedzi. Wystarczy "
            "powtórzyć: inflacja, poduszka, koszty i wahania — bez wkuwania tickerów."
        ),
        key_takeaway="3 z 4 poprawnych odpowiedzi = zdany Checkpoint #1.",
        xp_reward=15,
    ),
]

MICRO_LESSONS_BY_DAY: dict[int, list[MicroLessonCard]] = {
    2: DAY2_LESSONS,
    3: DAY3_LESSONS,
    4: DAY4_LESSONS,
}

# --------------------------------------------------------------------------- #
# Mini-checki mikro-lekcji Dni 1–4 (1 pytanie, 3 opcje, jeden poprawny indeks)
# --------------------------------------------------------------------------- #

MICRO_LESSON_CHECKS: dict[str, dict] = {
    # --- Dzień 1 ---
    "ml_20_1": {
        "check_question": "Ile realnie traci 10 000 zł na koncie 0% po roku przy inflacji 3,5%?",
        "check_options": [
            "Ok. 350 zł siły nabywczej",
            "Ok. 3 500 zł siły nabywczej",
            "Nic — saldo się nie zmienia",
        ],
        "correct_option_index": 0,
        "check_explanation": (
            "3,5% z 10 000 zł to ok. 350 zł. Saldo stoi, ale kupujesz za nie mniej."
        ),
    },
    "ml_20_2": {
        "check_question": "W 6. miesiącu psuje się laptop. Co robisz z poduszką 6 000 zł?",
        "check_options": [
            "Sprzedaję cały ETF, żeby mieć pewność",
            "Płacę z poduszki, a ETF zostaje i pracuje dalej",
            "Biorę kredyt, bo poduszki nie ruszam nigdy",
        ],
        "correct_option_index": 1,
        "check_explanation": (
            "Poduszka jest właśnie na awarie. ETF nie jest zamrożony, ale nie musi być ruszany."
        ),
    },
    "ml_20_3": {
        "check_question": "Co daje 200 zł/mies. przez 15 lat przy założeniu 5,7% netto?",
        "check_options": [
            "36 000 zł wpłat i gwarancję 100 000 zł",
            "36 000 zł wpłat i dokładnie 36 000 zł wartości",
            "36 000 zł wpłat i historycznie ok. 56 700 zł nominalnie (edukacyjnie)",
        ],
        "correct_option_index": 2,
        "check_explanation": (
            "200 zł × 180 miesięcy = 36 000 zł wpłat; przy 5,7% netto ok. 56 700 zł nominalnie, "
            "bez żadnej gwarancji."
        ),
    },
    "ml_30_1": {
        "check_question": "Ile siły nabywczej traci 20 000 zł na koncie 0% w rok przy 3,5% inflacji?",
        "check_options": [
            "Ok. 700 zł",
            "Ok. 70 zł",
            "Zero, bo saldo się nie zmienia",
        ],
        "correct_option_index": 0,
        "check_explanation": "3,5% z 20 000 zł to ok. 700 zł mniej siły nabywczej rocznie.",
    },
    "ml_30_2": {
        "check_question": "Ile wpłacisz w rok ze stałym zleceniem 200 zł/mies.?",
        "check_options": [
            "200 zł",
            "2 400 zł — bez patrzenia w wykresy",
            "24 000 zł",
        ],
        "correct_option_index": 1,
        "check_explanation": "200 zł × 12 miesięcy = 2 400 zł, a decyzję podejmujesz tylko raz.",
    },
    "ml_30_3": {
        "check_question": "Wydatki to 2 500 zł/mies. Jak duża jest poduszka na 3 miesiące?",
        "check_options": [
            "2 500 zł",
            "25 000 zł",
            "7 500 zł",
        ],
        "correct_option_index": 2,
        "check_explanation": "2 500 zł × 3 = 7 500 zł. Dopiero nadwyżki powyżej idą na rynek.",
    },
    "ml_50_1": {
        "check_question": "Ile wpłat daje 1 200 zł/mies. przez 7 lat?",
        "check_options": [
            "100 800 zł",
            "14 400 zł",
            "840 000 zł",
        ],
        "correct_option_index": 0,
        "check_explanation": "1 200 zł × 84 miesiące = 100 800 zł wpłat w 7-letnim horyzoncie.",
    },
    "ml_50_2": {
        "check_question": "Ile siły nabywczej traci 50 000 zł na koncie 0% w rok przy 3,5%?",
        "check_options": [
            "Ok. 175 zł",
            "Ok. 1 750 zł",
            "Nic — to duża kwota, więc strata nie występuje",
        ],
        "correct_option_index": 1,
        "check_explanation": "3,5% z 50 000 zł to ok. 1 750 zł rocznie mniej siły nabywczej.",
    },
    "ml_50_3": {
        "check_question": "Ile wynosi roczny koszt TER 0,20% od 10 000 zł?",
        "check_options": [
            "200 zł",
            "2 000 zł",
            "20 zł",
        ],
        "correct_option_index": 2,
        "check_explanation": "0,20% z 10 000 zł to 20 zł rocznie — jawny i przewidywalny koszt.",
    },
    # --- Dzień 2 ---
    "ml_d2_1": {
        "check_question": "Po co korzystać z trybu demo?",
        "check_options": [
            "Aby przećwiczyć zlecenia bez realnego ryzyka",
            "Aby mieć gwarantowany zysk",
            "Aby uniknąć wszystkich opłat",
        ],
        "correct_option_index": 0,
        "check_explanation": (
            "Tryb demo to trening procesu za 0 zł ryzyka — nie obietnica zysku i nie brak opłat."
        ),
    },
    "ml_d2_2": {
        "check_question": "TER 0,20% od 10 000 zł plus 12 zleceń po 3 zł to rocznie razem:",
        "check_options": [
            "Ok. 6 zł",
            "Ok. 56 zł",
            "Ok. 560 zł",
        ],
        "correct_option_index": 1,
        "check_explanation": "20 zł TER + 36 zł za zlecenia = ok. 56 zł rocznie.",
    },
    # --- Dzień 3 ---
    "ml_d3_1": {
        "check_question": "Ile wpłat daje stałe zlecenie 100 zł/mies. w ciągu roku?",
        "check_options": [
            "100 zł",
            "12 000 zł",
            "1 200 zł bez 12 decyzji",
        ],
        "correct_option_index": 2,
        "check_explanation": "100 zł × 12 = 1 200 zł, a decyzję podejmujesz raz, nie co miesiąc.",
    },
    "ml_d3_2": {
        "check_question": "Przy opłacie 3 zł za zlecenie przelew 10 zł to koszt:",
        "check_options": [
            "Ok. 30% kwoty",
            "Ok. 3% kwoty",
            "Zero, bo kwota jest mała",
        ],
        "correct_option_index": 0,
        "check_explanation": "3 zł z 10 zł to 30% — dlatego test jest symboliczny i pokazuje koszty.",
    },
    # --- Dzień 4 ---
    "ml_d4_1": {
        "check_question": "Jak wygląda rozsądne pierwsze mikro-zlecenie?",
        "check_options": [
            "Cała kwota w jedną spółkę z gorącego tipu",
            "50–100 zł w szeroki globalny ETF",
            "Pożyczona kwota z dźwignią",
        ],
        "correct_option_index": 1,
        "check_explanation": (
            "Mała kwota w szeroki ETF daje setki firm w środku, bez typowania i bez dźwigni."
        ),
    },
    "ml_d4_2": {
        "check_question": "Próg 75% w Checkpoint #1 z 4 pytań oznacza:",
        "check_options": [
            "3 poprawne odpowiedzi",
            "2 poprawne odpowiedzi",
            "Wszystkie 4 odpowiedzi",
        ],
        "correct_option_index": 0,
        "check_explanation": "75% z 4 pytań to 3 poprawne odpowiedzi — wystarczy rozumieć mechanizmy.",
    },
}


def _micro_lesson_fields() -> set[str]:
    """Nazwy pól ``MicroLessonCard`` (schema może jeszcze nie mieć pól ``check_*``)."""
    return set((getattr(MicroLessonCard, "model_fields", None) or {}).keys())


def _lesson_with_check(lesson: MicroLessonCard, check: dict | None) -> MicroLessonCard:
    """Dokleja mini-check do karty lekcji, jeśli schemat zna pola ``check_*``."""
    if not check:
        return lesson
    return lesson.model_copy(
        update={
            "check_question": check["check_question"],
            "check_options": list(check["check_options"]),
            "correct_option_index": int(check["correct_option_index"]),
            "check_explanation": check["check_explanation"],
        }
    )


def _apply_lesson_checks(checks: dict[str, dict], *tables: object) -> None:
    """Wzbogaca lekcje o mini-checki tylko przy schemacie z polami ``check_*``."""
    if not {"check_question", "check_options", "correct_option_index", "check_explanation"} <= _micro_lesson_fields():
        return
    for table in tables:
        if isinstance(table, dict):
            for key, lessons in list(table.items()):
                table[key] = [_lesson_with_check(lesson, checks.get(lesson.id)) for lesson in lessons]
        elif isinstance(table, list):
            table[:] = [_lesson_with_check(lesson, checks.get(lesson.id)) for lesson in table]


_apply_lesson_checks(
    MICRO_LESSON_CHECKS,
    MICRO_LESSONS_BY_GROUP,
    MICRO_LESSONS_BY_DAY,
    DAY2_LESSONS,
    DAY3_LESSONS,
    DAY4_LESSONS,
)

# --------------------------------------------------------------------------- #
# Checkpoint #1 (po Dniu 4) — 4 pytania ABCD, próg 75%, +100 XP (docs/03 §6D)
# --------------------------------------------------------------------------- #

_CHECKPOINT_1_QUESTIONS_BY_LANG: dict[str, list[dict]] = {
    "pl": [
        {
            "id": "cp1_inflation",
            "question": "Dlaczego gotówka na koncie 0% traci w długim horyzoncie?",
            "options": [
                {"id": "a", "text": "Bo inflacja co roku zmniejsza jej siłę nabywczą"},
                {"id": "b", "text": "Bo bank zawsze zabiera całe saldo"},
                {"id": "c", "text": "Bo gotówka jest zamrożona i nie można jej wypłacić"},
                {"id": "d", "text": "Bo odsetki na koncie są wyższe niż inflacja"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "Inflacja ok. 3,5% rocznie oznacza, że za te same pieniądze kupujesz mniej. "
                "To nie strata nominalna, ale realna."
            ),
        },
        {
            "id": "cp1_buffer",
            "question": "Do czego służy poduszka finansowa?",
            "options": [
                {"id": "a", "text": "Na nagłe wydatki, żeby nie sprzedawać ETF w złym momencie"},
                {"id": "b", "text": "Na codzienne zakupy i przyjemności"},
                {"id": "c", "text": "Do kupowania akcji jednej spółki"},
                {"id": "d", "text": "Wyłącznie do płacenia podatków"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "Poduszka jest osobnym buforem na awarie. ETF można sprzedać, ale wypłata "
                "zajmuje zwykle kilka dni roboczych."
            ),
        },
        {
            "id": "cp1_costs",
            "question": "Co jest największą zaletą szerokiego ETF?",
            "options": [
                {
                    "id": "a",
                    "text": "Dywersyfikacja na setki firm i niskie koszty w długim horyzoncie",
                },
                {"id": "b", "text": "Gwarancja zysku w każdym roku"},
                {"id": "c", "text": "Możliwość wyboru jednej najlepszej spółki"},
                {"id": "d", "text": "Brak jakichkolwiek kosztów"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "Szeroki ETF rozkłada ryzyko na wiele firm, a niskie TER mniej obniża wynik. "
                "Gwarancji zysku nie ma."
            ),
        },
        {
            "id": "cp1_drop",
            "question": "Portfel jest na papierze -20% po 3 latach. Co jest rozsądne?",
            "options": [
                {
                    "id": "a",
                    "text": "Trzymać plan i dalej wpłacać — to wahanie do momentu sprzedaży",
                },
                {"id": "b", "text": "Sprzedać wszystko, żeby uniknąć dalszych spadków"},
                {"id": "c", "text": "Przestać wpłacać i czekać na odbicie"},
                {"id": "d", "text": "Przenieść całość do jednej spółki, żeby szybciej odrobić"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "Spadek na papierze to wahanie, dopóki nie sprzedasz. Wpłaty po spadku kupują "
                "więcej jednostek taniej."
            ),
        },
    ],
    "en": [
        {
            "id": "cp1_inflation",
            "question": "Why does cash in a 0% account lose value over a long horizon?",
            "options": [
                {"id": "a", "text": "Because inflation reduces its purchasing power every year"},
                {"id": "b", "text": "Because the bank always takes the whole balance"},
                {"id": "c", "text": "Because cash is frozen and cannot be withdrawn"},
                {"id": "d", "text": "Because interest on the account is higher than inflation"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "Inflation of about 3.5% a year means the same money buys less. It is a real "
                "loss, not a nominal one."
            ),
        },
        {
            "id": "cp1_buffer",
            "question": "What is a financial buffer for?",
            "options": [
                {
                    "id": "a",
                    "text": "Unexpected expenses, so you do not sell an ETF at a bad moment",
                },
                {"id": "b", "text": "Everyday shopping and small pleasures"},
                {"id": "c", "text": "Buying shares of a single company"},
                {"id": "d", "text": "Paying taxes only"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "The buffer is a separate safety layer. An ETF can be sold, but the payout "
                "usually takes a few business days."
            ),
        },
        {
            "id": "cp1_costs",
            "question": "What is the biggest advantage of a broad ETF?",
            "options": [
                {
                    "id": "a",
                    "text": "Diversification across hundreds of companies and low costs over time",
                },
                {"id": "b", "text": "A guarantee of profit every year"},
                {"id": "c", "text": "The ability to pick one best company"},
                {"id": "d", "text": "No costs at all"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "A broad ETF spreads risk across many companies, and a low TER cuts the result "
                "less. There is no profit guarantee."
            ),
        },
        {
            "id": "cp1_drop",
            "question": "Your portfolio is -20% on paper after 3 years. What is sensible?",
            "options": [
                {
                    "id": "a",
                    "text": "Keep the plan and keep contributing — it is volatility until you sell",
                },
                {"id": "b", "text": "Sell everything to avoid further drops"},
                {"id": "c", "text": "Stop contributing and wait for a rebound"},
                {"id": "d", "text": "Move everything into one company to recover faster"},
            ],
            "correct_option_id": "a",
            "explanation": (
                "An on-paper drop is volatility until you sell. Contributions after a drop buy "
                "more units at a lower price."
            ),
        },
    ],
}

CHECKPOINT_1_PASS_PCT: int = 75
CHECKPOINT_1_REWARD_XP: int = 100


def _public_checkpoint_questions(lang: Language) -> list[dict]:
    """Pytania ``id``/``question``/``options`` bez klucza odpowiedzi."""
    return [
        {
            "id": question["id"],
            "question": question["question"],
            "options": [
                {"id": option["id"], "text": option["text"]}
                for option in question["options"]
            ],
        }
        for question in _CHECKPOINT_1_QUESTIONS_BY_LANG[lang]
    ]


# Publiczne stałe (konwencja repo: ``X`` = PL, ``X_EN`` = EN) — BEZ odpowiedzi.
CHECKPOINT_1_QUESTIONS: list[dict] = _public_checkpoint_questions("pl")
CHECKPOINT_1_QUESTIONS_EN: list[dict] = _public_checkpoint_questions("en")

# --------------------------------------------------------------------------- #
# After Day 14 — Continuous Learning (docs/03 §10, docs/01 §2)
# --------------------------------------------------------------------------- #

_POST_14_PATHS_BY_LANG: dict[str, list[dict]] = {
    "pl": [
        {
            "id": "rebalancing",
            "title": "Portfel i rebalansowanie",
            "description": (
                "Raz na kwartał sprawdzasz proporcje i delikatnie wracasz do ustalonego planu "
                "— bez prób trafienia momentu."
            ),
            "cadence": "Raz na kwartał · ~10 min",
            "badge": "Równowaga",
        },
        {
            "id": "tax_accounts",
            "title": "Konta z ulgą podatkową (IKE / IKZE)",
            "description": (
                "Poznajesz zasady kont emerytalnych i sprawdzasz, czy pasują do Twojej sytuacji. "
                "To materiał edukacyjny, nie rekomendacja produktu."
            ),
            "cadence": "Raz w roku · ~15 min",
            "badge": "Podatki pod kontrolą",
        },
        {
            "id": "bonds",
            "title": "Obligacje i ochrona przed inflacją",
            "description": (
                "Uczysz się, jak obligacje i instrumenty powiązane z inflacją mogą stabilizować "
                "część portfela — wyłącznie edukacyjnie."
            ),
            "cadence": "Raz w roku · ~10 min",
            "badge": "Stabilność",
        },
        {
            "id": "checkins",
            "title": "Miesięczne check-iny z Kitą",
            "description": (
                "Krótka rozmowa o postępach, emocjach i ewentualnych korektach planu. "
                "Pomaga utrzymać nawyk bez codziennego śledzenia giełdy."
            ),
            "cadence": "Co miesiąc · ~5 min",
            "badge": "Konsekwencja",
        },
    ],
    "en": [
        {
            "id": "rebalancing",
            "title": "Portfolio & Rebalancing",
            "description": (
                "Once a quarter you check the proportions and gently return to your plan — "
                "without trying to time the market."
            ),
            "cadence": "Once a quarter · ~10 min",
            "badge": "Balanced",
        },
        {
            "id": "tax_accounts",
            "title": "Tax-Advantaged Accounts (IKE / IKZE)",
            "description": (
                "Learn the rules of retirement accounts and check whether they fit your "
                "situation. Educational material, not a product recommendation."
            ),
            "cadence": "Once a year · ~15 min",
            "badge": "Tax Smart",
        },
        {
            "id": "bonds",
            "title": "Bonds & Inflation Protection",
            "description": (
                "Discover how bonds and inflation-linked instruments can stabilise part of a "
                "portfolio — educational only."
            ),
            "cadence": "Once a year · ~10 min",
            "badge": "Steady",
        },
        {
            "id": "checkins",
            "title": "Monthly AI Check-ins with Kita",
            "description": (
                "A short conversation about progress, emotions and any plan adjustments. "
                "It keeps the habit alive without watching the market daily."
            ),
            "cadence": "Monthly · ~5 min",
            "badge": "Consistent",
        },
    ],
}


POST_14_PATHS: list[dict] = [dict(path) for path in _POST_14_PATHS_BY_LANG["pl"]]
POST_14_PATHS_EN: list[dict] = [dict(path) for path in _POST_14_PATHS_BY_LANG["en"]]

# --------------------------------------------------------------------------- #
# Bank wyjaśnień offline „Explain with real-life example + mini-drill” (§11)
# --------------------------------------------------------------------------- #

EXPLAIN_FALLBACKS: dict[str, dict] = {
    # Nawigacja po aplikacji (Kita jako przewodnik po ekranach).
    "navigation": {
        "simple_explanation": (
            "Wszystko jest w jednej aplikacji: ankieta to krok pierwszy, mapa sprintu z mikro-lekcjami "
            "i Wehikułem Czasu to krok drugi, symulacja decyzji z Kitą to trzeci, a podsumowanie dnia, "
            "wyzwanie i ranking to czwarty."
        ),
        "real_life_example": (
            "To jak plan podróży na jednej mapie: najpierw ustalasz cel (ankieta), potem widzisz trasę "
            "(mapa sprintu), ćwiczysz kolejny krok (symulacja), a na końcu odhaczasz dzień i widzisz, "
            "ile już przeszedłeś."
        ),
        "drill_question": "Gdzie znajdziesz wykres porównujący gotówkę i szeroki ETF (Wehikuł Czasu)?",
        "drill_options": [
            "Na mapie sprintu, w karcie Wehikuł Czasu",
            "W ankiecie, przy pytaniu o wiek",
            "W rankingu znajomych",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Tak — wykres jest na mapie sprintu, tuż pod mikro-lekcjami, razem z suwakiem lat."
        ),
        "is_fallback": True,
    },
    # Wybór opcji / podział środków.
    "options": {
        "simple_explanation": (
            "Przy wyborze trzymaj kolejność: najpierw poduszka na 3 miesiące wydatków, potem szeroki "
            "ETF z małą, regularną kwotą. Podział 80/20 to tylko przykład, nie reguła dla każdego."
        ),
        "real_life_example": (
            "To jak pakowanie na wyjazd: najpierw dokumenty i leki (poduszka), a potem rzeczy na długą "
            "trasę (ETF). Bez pierwszej części druga nie ma sensu."
        ),
        "drill_question": "Od czego zaczynasz, jeśli nie masz jeszcze poduszki?",
        "drill_options": [
            "Od poduszki na 3 miesiące wydatków, ETF wchodzi później",
            "Od razu od szerokiego ETF z całą wolną kwotą",
            "Od jednej spółki z gorącego typa kolegi",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Dokładnie — najpierw bezpieczna baza, a inwestowanie startuje z wolnych nadwyżek."
        ),
        "is_fallback": True,
    },
    "inflation": {
        "simple_explanation": (
            "Inflacja to wzrost cen — te same pieniądze kupują z roku na rok coraz mniej. "
            "Gotówka na koncie 0% nie chroni przed tym zjawiskiem."
        ),
        "real_life_example": (
            "Twój koszyk zakupów kosztuje dziś 200 zł, a przy inflacji 3,5% za rok te same "
            "produkty to około 207 zł. Przy niezmienionej pensji kupujesz po prostu mniej."
        ),
        "drill_question": (
            "Co dzieje się z siłą nabywczą 1 000 zł leżących rok na koncie 0%, gdy inflacja "
            "wynosi 3,5%?"
        ),
        "drill_options": [
            "Kupuje mniej — realnie traci około 35 zł",
            "Kupuje dokładnie tyle samo",
            "Kupuje więcej, bo bank dolicza odsetki",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Dokładnie — przy inflacji 3,5% tysiąc złotych kupuje po roku mniej. Właśnie "
            "dlatego gotówka na koncie 0% traci realnie."
        ),
        "is_fallback": True,
    },
    "etf": {
        "simple_explanation": (
            "Szeroki ETF to jeden koszyk z setkami firm z całego świata. Kupuje się go jak "
            "każdy instrument, a roczny koszt (TER) bywa niski."
        ),
        "real_life_example": (
            "Zamiast stawiać wszystko na jedną restaurację z okolicy, kupujesz udział w całej "
            "galerii. Jeśli jedna restauracja podupadnie, reszta nadal działa."
        ),
        "drill_question": "Co oznacza niski wskaźnik TER w szerokim ETF?",
        "drill_options": [
            "Niższy roczny koszt, który mniej obniża wynik",
            "Gwarancję zysku w każdym roku",
            "Brak jakiegokolwiek ryzyka rynkowego",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Tak — TER to roczny koszt funduszu. Im niższy, tym mniej odbiera wynikowi, ale "
            "nie usuwa ryzyka rynkowego."
        ),
        "is_fallback": True,
    },
    "emergency_fund": {
        "simple_explanation": (
            "Poduszka finansowa to osobne pieniądze na nagłe wydatki. Dzięki niej nie musisz "
            "sprzedawać inwestycji w złym momencie."
        ),
        "real_life_example": (
            "To jak koło zapasowe w samochodzie: nie używasz go codziennie, ale gdy złapiesz "
            "gumę, podróż trwa dalej. Poduszka leży osobno od długoterminowego ETF."
        ),
        "drill_question": "Gdzie powinna być poduszka finansowa?",
        "drill_options": [
            "Na osobnym, łatwo dostępnym koncie oszczędnościowym",
            "Wyłącznie w szerokim ETF na wiele lat",
            "W jednej spółce, żeby szybciej rosła",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Właśnie tak — poduszka ma być szybko dostępna i oddzielona od inwestycji. ETF "
            "też nie jest zamrożony, ale wypłata zajmuje zwykle kilka dni roboczych."
        ),
        "is_fallback": True,
    },
    "volatility": {
        "simple_explanation": (
            "Wahania to normalna część inwestowania. Spadek na papierze nie jest stratą, "
            "dopóki nie sprzedasz jednostek w panice."
        ),
        "real_life_example": (
            "To jak chwilowa przecena mieszkania: jeśli nie sprzedajesz w tym momencie, cena "
            "na papierze nie zmienia tego, co masz."
        ),
        "drill_question": (
            "Portfel jest -20% na papierze, a Twój horyzont to wiele lat. Co jest rozsądne?"
        ),
        "drill_options": [
            "Trzymać plan i dalej regularnie wpłacać",
            "Sprzedać wszystko, żeby uniknąć dalszych spadków",
            "Przenieść całość do jednej spółki, żeby szybciej odrobić",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Dokładnie — spadek na papierze to wahanie aż do momentu sprzedaży. Historia nie "
            "gwarantuje przyszłości, dlatego liczy się plan i poduszka osobno."
        ),
        "is_fallback": True,
    },
    "diversification": {
        "simple_explanation": (
            "Dywersyfikacja to rozłożenie pieniędzy na wiele firm zamiast stawiania "
            "wszystkiego na jedną. Zmniejsza wpływ wpadki pojedynczej spółki, ale nie usuwa "
            "ryzyka rynku."
        ),
        "real_life_example": (
            "Nie wkładasz wszystkich jajek do jednego koszyka — jeśli jeden się przewróci, "
            "reszta zostaje. Szeroki ETF działa podobnie."
        ),
        "drill_question": "Co daje rozłożenie pieniędzy na setki firm?",
        "drill_options": [
            "Ogranicza wpływ wpadki jednej spółki",
            "Całkowicie usuwa ryzyko rynku",
            "Gwarantuje wyższy zysk niż jedna spółka",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Tak — dywersyfikacja łagodzi ryzyko, ale go nie eliminuje. Dlatego mówimy "
            "o „ograniczaniu”, a nie o gwarancji."
        ),
        "is_fallback": True,
    },
    "general": {
        "simple_explanation": (
            "Finance Quest opiera się na trzech filarach: inflacja realnie zjada gotówkę, "
            "poduszka chroni codzienny budżet, a szeroki ETF w długim horyzoncie pomaga "
            "pieniądzom pracować."
        ),
        "real_life_example": (
            "To jak plan podróży: gotówka w kieszeni na nagłe wydatki, mapa wiedzy w ręku "
            "i spokojny, regularny krok do celu — bez zgadywania idealnego momentu."
        ),
        "drill_question": "Który zestaw najlepiej opisuje trzy filary Finance Quest?",
        "drill_options": [
            "Inflacja, poduszka i szeroki ETF",
            "Kredyt, dźwignia i jedna spółka",
            "Konto 0% i trzymanie gotówki bez planu",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Właśnie tak — te trzy elementy tworzą spokojny, powtarzalny plan bez obietnic "
            "zysku."
        ),
        "is_fallback": True,
    },
}

EXPLAIN_FALLBACKS_EN: dict[str, dict] = {
    # App navigation (Kita as a guide through the screens).
    "navigation": {
        "simple_explanation": (
            "Everything lives in one app: the survey is step one, the sprint map with micro-lessons "
            "and the Time Machine is step two, the decision simulation with Kita is step three, and "
            "the day summary, challenge and leaderboard are step four."
        ),
        "real_life_example": (
            "It is like a trip planned on one map: first you set the goal (survey), then you see the "
            "route (sprint map), you practise the next step (simulation), and finally you tick the day "
            "off and see how far you have come."
        ),
        "drill_question": "Where do you find the chart that compares cash and a broad ETF (Time Machine)?",
        "drill_options": [
            "On the sprint map, in the Time Machine card",
            "In the survey, next to the age question",
            "In the friends leaderboard",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Yes — the chart sits on the sprint map, right under the micro-lessons, with the years slider."
        ),
        "is_fallback": True,
    },
    # Choosing options / splitting money.
    "options": {
        "simple_explanation": (
            "Keep this order when choosing: first a buffer for 3 months of expenses, then a broad ETF "
            "with a small, regular amount. An 80/20 split is only an example, not a rule for everyone."
        ),
        "real_life_example": (
            "It is like packing for a trip: documents and medicine first (buffer), long-route gear "
            "second (ETF). Without the first part, the second makes no sense."
        ),
        "drill_question": "Where do you start if you do not have a buffer yet?",
        "drill_options": [
            "With a buffer for 3 months of expenses; the ETF comes later",
            "Straight into a broad ETF with all free cash",
            "With one company from a friend's hot tip",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Exactly — a safe base first, and investing starts from free surplus."
        ),
        "is_fallback": True,
    },
    "inflation": {
        "simple_explanation": (
            "Inflation means rising prices — the same money buys less every year. Cash in a "
            "0% account does not protect you from that."
        ),
        "real_life_example": (
            "Your shopping basket costs 200 PLN today, and with 3.5% inflation the same "
            "products cost about 207 PLN a year later. With an unchanged salary you simply "
            "buy less."
        ),
        "drill_question": (
            "What happens to the purchasing power of 1,000 PLN left for a year in a 0% "
            "account when inflation is 3.5%?"
        ),
        "drill_options": [
            "It buys less — a real loss of about 35 PLN",
            "It buys exactly the same",
            "It buys more, because the bank adds interest",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Exactly — at 3.5% inflation, a thousand zloty buys less after a year. That is "
            "why cash in a 0% account loses in real terms."
        ),
        "is_fallback": True,
    },
    "etf": {
        "simple_explanation": (
            "A broad ETF is one basket holding hundreds of companies from around the world. "
            "You buy it like any instrument, and its yearly cost (TER) is often low."
        ),
        "real_life_example": (
            "Instead of betting everything on one local restaurant, you buy a share of the "
            "whole shopping mall. If one restaurant struggles, the rest still works."
        ),
        "drill_question": "What does a low TER in a broad ETF mean?",
        "drill_options": [
            "A lower yearly cost that trims the result less",
            "A guarantee of profit every year",
            "No market risk at all",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Yes — TER is the fund's yearly cost. The lower it is, the less it takes from "
            "the result, but it does not remove market risk."
        ),
        "is_fallback": True,
    },
    "emergency_fund": {
        "simple_explanation": (
            "A financial buffer is separate money for unexpected expenses. It means you never "
            "have to sell an investment at a bad moment."
        ),
        "real_life_example": (
            "It is like the spare wheel in a car: you do not use it daily, but when you get a "
            "flat tyre the journey continues. The buffer sits apart from the long-term ETF."
        ),
        "drill_question": "Where should the financial buffer sit?",
        "drill_options": [
            "In a separate, easily accessible savings account",
            "Only in a broad ETF for many years",
            "In one company, so it grows faster",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Exactly — the buffer must be quickly accessible and kept apart from investments. "
            "An ETF is not frozen either, but a payout usually takes a few business days."
        ),
        "is_fallback": True,
    },
    "volatility": {
        "simple_explanation": (
            "Volatility is a normal part of investing. A drop on paper is not a loss as long "
            "as you do not sell units in a panic."
        ),
        "real_life_example": (
            "It is like a temporary price cut on a flat you own: if you do not sell at that "
            "moment, the paper price does not change what you actually have."
        ),
        "drill_question": (
            "Your portfolio is -20% on paper and your horizon is many years. What is sensible?"
        ),
        "drill_options": [
            "Keep the plan and keep contributing regularly",
            "Sell everything to avoid further drops",
            "Move everything into one company to recover faster",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Exactly — an on-paper drop is volatility until you sell. History does not "
            "guarantee the future, which is why the plan and a separate buffer matter."
        ),
        "is_fallback": True,
    },
    "diversification": {
        "simple_explanation": (
            "Diversification means spreading money across many companies instead of betting "
            "everything on one. It reduces the impact of a single company stumbling, but it "
            "does not remove market risk."
        ),
        "real_life_example": (
            "You do not put all your eggs in one basket — if one basket tips over, the rest "
            "stays. A broad ETF works the same way."
        ),
        "drill_question": "What does spreading money across hundreds of companies give you?",
        "drill_options": [
            "It limits the impact of one company stumbling",
            "It removes market risk completely",
            "It guarantees a higher profit than one company",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Yes — diversification softens risk but does not eliminate it. That is why we say "
            "it limits it rather than guaranteeing anything."
        ),
        "is_fallback": True,
    },
    "general": {
        "simple_explanation": (
            "Finance Quest rests on three pillars: inflation really eats cash, a buffer "
            "protects your everyday budget, and a broad ETF over a long horizon helps money "
            "work."
        ),
        "real_life_example": (
            "It is like planning a trip: cash in your pocket for surprises, a map of knowledge "
            "in hand, and a calm, regular step towards the goal — without guessing the perfect "
            "moment."
        ),
        "drill_question": "Which set best describes the three pillars of Finance Quest?",
        "drill_options": [
            "Inflation, buffer and broad ETF",
            "Credit, leverage and one company",
            "A 0% account and cash without a plan",
        ],
        "correct_option_index": 0,
        "drill_feedback": (
            "Exactly — these three elements make a calm, repeatable plan without any promise "
            "of profit."
        ),
        "is_fallback": True,
    },
}

EXPLAIN_TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    # Nawigacja ma pierwszeństwo — pytania „gdzie…” nie powinny wpadać w tematy finansowe.
    "navigation": (
        "gdzie",
        "how do i get",
        "jak przej",
        "jak doj",
        "find ",
        "znajd",
        "screen",
        "ekran",
        "time machine",
        "wehikul",
        "simulator",
        "symulator",
        "micro-lesson",
        "micro lesson",
        "mikro-lekcj",
        "lesson",
        "lekcj",
        "ranking",
        "leaderboard",
        "checkpoint",
        "drawer",
        "szuflad",
        "checklist",
        "podsumowanie",
        "summary",
        "navigate",
        "nawigac",
    ),
    # Wybór opcji i podział środków.
    "options": (
        "which option",
        "option a",
        "option b",
        "opcj",
        "wybrac",
        "wybior",
        "wybierz",
        "choose",
        "choice",
        "od czego zacz",
        "start with",
        "buffer vs",
        "poduszka czy",
        "etf czy",
        "split",
        "podzial",
    ),
    "inflation": (
        "inflac",
        "inflation",
        "purchasing",
        "sila nabywcza",
        "cash",
        "gotowk",
    ),
    "emergency_fund": (
        "buffer",
        "cushion",
        "emergency",
        "poduszk",
        "awari",
        "freeze",
        "zamroz",
        "liquid",
        "plynnos",
        "laptop",
    ),
    "etf": (
        "etf",
        "fund",
        "fundusz",
        "index",
        "indeks",
        "oplat",
        "prowizj",
        "broker",
        "makler",
    ),
    "volatility": (
        "crash",
        "drop",
        "volatil",
        "spad",
        "wahani",
        "krach",
        "panic",
        "panik",
        "risk",
        "ryzyk",
        "loss",
    ),
    "diversification": (
        "diversif",
        "dywersyfik",
        "single stock",
        "jedna spolk",
        "spolk",
        "spolek",
        "spolka",
        "spolki",
        "concentrat",
        "koncentrac",
        "eggs",
        "jajk",
    ),
}

_PL_DIACRITICS: dict[int, int] = str.maketrans("ąćęłńóśźż", "acelnoszz")

# Wzorce wymagające granicy słowa (żeby „ter” nie łapało „after”, a „strat”
# nie łapało „strategii”, „dip” nie łapało „diploma”, „0%” nie łapało „-20%”).
_TOPIC_PATTERNS: dict[str, re.Pattern[str]] = {
    "navigation": re.compile(r"(?<![a-z])where(?![a-z])"),
    "options": re.compile(r"(?<![a-z])split(?![a-z])"),
    "inflation": re.compile(r"(?<![\d-])0\s?%"),
    "etf": re.compile(r"(?<![a-z])(?:ter|fees?)(?![a-z])"),
    "volatility": re.compile(r"(?<![a-z])dip(?![a-z])|(?<![a-z])strat(?!eg)|-\s?\d+\s?%"),
}

# Czytelne nazwy ekranów dla odpowiedzi nawigacyjnych Kity.
EXPLAIN_SCREEN_LABELS: dict[str, dict[str, str]] = {
    "pl": {
        "screen_onboarding": "ankieta (Ekran 1)",
        "screen_filter_and_timemachine": "mapa sprintu z mikro-lekcjami i Wehikułem Czasu (Ekran 2)",
        "screen_mission_live": "symulacja decyzji z Kitą (Ekran 3)",
        "screen_checkpoint": "Checkpoint #1 — test wiedzy",
        "screen_checklist": "podsumowanie dnia, wyzwanie i ranking (Ekran 4)",
        "modal_bank_order": "podgląd przykładowego planu w banku (modal)",
    },
    "en": {
        "screen_onboarding": "the survey (Screen 1)",
        "screen_filter_and_timemachine": "the sprint map with micro-lessons and Time Machine (Screen 2)",
        "screen_mission_live": "the decision simulation with Kita (Screen 3)",
        "screen_checkpoint": "Checkpoint #1 — the knowledge check",
        "screen_checklist": "the day summary, challenge and leaderboard (Screen 4)",
        "modal_bank_order": "the sample bank plan preview (modal)",
    },
}


def _screen_label(current_screen: str | None, lang: Language) -> str | None:
    """Czytelna nazwa bieżącego ekranu (albo ``None``, gdy nieznany)."""
    key = str(current_screen or "").strip()
    if not key:
        return None
    return EXPLAIN_SCREEN_LABELS[lang].get(key)


def _with_user_name(text: str, user_name: str | None, lang: Language) -> str:
    """Zwraca się do użytkownika po imieniu, jeśli zostało podane."""
    name = str(user_name or "").strip()
    if not name or name.lower() in {"none", "null", "-"}:
        return text
    prefix = "Cześć" if lang == "pl" else "Hi"
    return f"{prefix} {name} — {text}"


def _fold_text(text: str) -> str:
    """Lowercase + usunięcie polskich znaków (spójne dopasowanie EN/PL)."""
    return (text or "").lower().translate(_PL_DIACRITICS)


def _match_explain_topic(question: str, topic_hint: str | None = None) -> str:
    """Pierwszy pasujący temat po słowach kluczowych; inaczej ``general``."""
    haystack = _fold_text(f"{topic_hint or ''} {question or ''}")
    for topic, keywords in EXPLAIN_TOPIC_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return topic
        pattern = _TOPIC_PATTERNS.get(topic)
        if pattern is not None and pattern.search(haystack):
            return topic
    return "general"


def get_explain_fallback(
    question: str,
    topic_hint: str | None = None,
    lang: Language = "en",
    user_name: str | None = None,
    current_screen: str | None = None,
) -> dict:
    """Deterministyczne wyjaśnienie + 3-opcyjny mini-drill (kopia słownika).

    Obsługuje także pytania o nawigację po aplikacji i wybór opcji; gdy podano
    ``user_name`` Kita zwraca się po imieniu, a przy nawigacji dopowiada, na
    którym ekranie użytkownik jest teraz. ``session_data`` może być minimalne —
    wszystkie odczyty idą przez ``.get``.
    """
    active = _normalize_lang(lang)
    topic = _match_explain_topic(question, topic_hint)
    table = EXPLAIN_FALLBACKS_EN if active == "en" else EXPLAIN_FALLBACKS
    entry = table[topic]

    simple = str(entry["simple_explanation"])
    screen_text = _screen_label(current_screen, active)
    if topic == "navigation" and screen_text:
        simple = simple + (
            f" (Jesteś teraz w: {screen_text}.)" if active == "pl" else f" (You are now on: {screen_text}.)"
        )

    return {
        "simple_explanation": _with_user_name(simple, user_name, active),
        "real_life_example": entry["real_life_example"],
        "drill_question": entry["drill_question"],
        "drill_options": list(entry["drill_options"]),
        "correct_option_index": int(entry["correct_option_index"]),
        "drill_feedback": entry["drill_feedback"],
        "is_fallback": True,
    }

# --------------------------------------------------------------------------- #
# Wersja angielska (docs/03 §10) — te same id i wartości liczbowe, kwoty w PLN
# --------------------------------------------------------------------------- #

# Etykiety person (docs/03 §10 pkt 1).
PERSONA_LABELS_EN: dict[str, tuple[str, str]] = {
    "young_20": ("22y Student", "22y • Student (Fresh Start)"),
    "mid_38": ("38y Family", "38y • Career & Family"),
    "senior_56": ("56y 50+", "56y • Capital Protection 50+"),
}

SPEAKLY_FILTER_BY_GROUP_EN: dict[AgeGroup, SpeaklyFilter] = {
    "20+": SpeaklyFilter(
        kept_topics=[
            "Inflation eats your cash",
            "Emergency buffer for surprises, ETF for the long term",
            "The power of scale from small amounts",
        ],
        removed_topics=[
            "Timing the market top and bottom",
            "Picking individual stocks",
            "Trendy cryptocurrencies (FOMO)",
            "Checking quotes every day",
            "Reading company reports",
            "Comparing dozens of funds",
        ],
    ),
    "30-50": SpeaklyFilter(
        kept_topics=[
            "Inflation eats your savings",
            "Background automation without charts",
            "Buffer separately, surplus separately",
        ],
        removed_topics=[
            "Timing the market top and bottom",
            "Picking individual stocks",
            "Actively managing a portfolio during work hours",
            "Checking quotes every day",
            "Reading company reports",
            "Comparing dozens of funds",
        ],
    ),
    "50+": SpeaklyFilter(
        kept_topics=[
            "You can invest at any age",
            "An anti-inflation shield for your capital",
            "Simplicity and diversification",
        ],
        removed_topics=[
            "Chasing losses with risky bets",
            "Picking individual stocks",
            "Timing the market top and bottom",
            "Checking quotes every day",
            "Reading company reports",
            "Comparing dozens of funds",
        ],
    ),
}

PHASE_1_EN: str = "Phase 1: Days 1–4 · Foundations & First Step"
PHASE_2_EN: str = "Phase 2: Days 5–9 · Risk, Safety & Emotions"
PHASE_3_EN: str = "Phase 3: Days 10–14 · Your Real Plan"

ROADMAP_BY_GROUP_EN: dict[AgeGroup, list[RoadmapMilestone]] = {
    "20+": [
        _roadmap_milestone(
            1,
            "Inflation, liquidity and getting started",
            "Today: 5 min • Breaking the frozen-cash myth",
            PHASE_1_EN,
            "active",
        ),
        _roadmap_milestone(
            4,
            "Simulator of your first -15% drop",
            "After Day 4: Checkpoint #1 — a quick knowledge check",
            PHASE_1_EN,
        ),
        _roadmap_milestone(
            9,
            "How to choose a low-cost, broad ETF?",
            "Fees (TER), diversification and Checkpoint #2",
            PHASE_2_EN,
        ),
        _roadmap_milestone(
            14,
            "Your first investment",
            "Sprint finale • Launching the plan at Commerzbank",
            PHASE_3_EN,
        ),
    ],
    "30-50": [
        _roadmap_milestone(
            1,
            "Inflation and investing in the background",
            "Today: 5 min • Buffer separately, surplus separately",
            PHASE_1_EN,
            "active",
        ),
        _roadmap_milestone(
            4,
            "Automation without watching charts",
            "After Day 4: Checkpoint #1 — fees and your first order",
            PHASE_1_EN,
        ),
        _roadmap_milestone(
            9,
            "Sensible proportions for a family",
            "A broad ETF plus a safe part, and Checkpoint #2",
            PHASE_2_EN,
        ),
        _roadmap_milestone(
            14,
            "Start of the automatic ETF plan",
            "Sprint finale • Setup at Commerzbank",
            PHASE_3_EN,
        ),
    ],
    "50+": [
        _roadmap_milestone(
            1,
            "An anti-inflation shield at any age",
            "Today: 5 min • Why cash in an account loses value",
            PHASE_1_EN,
            "active",
        ),
        _roadmap_milestone(
            4,
            "Reacting calmly to volatility",
            "After Day 4: Checkpoint #1 — calm and horizon",
            PHASE_1_EN,
        ),
        _roadmap_milestone(
            9,
            "A simple capital-protection portfolio",
            "Low costs, transparency and Checkpoint #2",
            PHASE_2_EN,
        ),
        _roadmap_milestone(
            14,
            "A confident start at Commerzbank",
            "Sprint finale • Stress-free plan launch",
            PHASE_3_EN,
        ),
    ],
}

MICRO_LESSONS_BY_GROUP_EN: dict[AgeGroup, list[MicroLessonCard]] = {
    "20+": [
        MicroLessonCard(
            id="ml_20_1",
            title="Inflation eats your cash",
            duration_sec=20,
            summary=(
                "Money in a 0% account loses purchasing power: with 3.5% inflation, 10,000 PLN buys "
                "goods worth about 9,650 PLN a year later."
            ),
            key_takeaway="Not deciding is a real loss of about 350 PLN per 10,000 PLN a year.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_2",
            title="Emergency buffer for surprises, ETF for the long term",
            duration_sec=20,
            summary=(
                "A buffer is 3 months of expenses — at 2,000 PLN/mo that is 6,000 PLN for surprises. "
                "The ETF stays separate and is not frozen: as a last resort you sell units and the "
                "payout usually takes a few business days."
            ),
            key_takeaway="A 6,000 PLN buffer protects the plan; the ETF is long-horizon money.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_3",
            title="The power of scale from small amounts",
            duration_sec=20,
            summary=(
                "200 PLN/mo for 15 years is 36,000 PLN of contributions; at an assumed 5.7% net per "
                "year that is historically about 56,700 PLN nominal (educational example, no guarantee)."
            ),
            key_takeaway="Time works harder than the size of your first contribution.",
            xp_reward=15,
        ),
    ],
    "30-50": [
        MicroLessonCard(
            id="ml_30_1",
            title="Inflation eats your savings",
            duration_sec=20,
            summary=(
                "20,000 PLN in a 0% account at 3.5% inflation means roughly 700 PLN less purchasing "
                "power after a year — even though the balance looks unchanged."
            ),
            key_takeaway="Surplus should work faster than 3.5% yearly inflation.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_2",
            title="Background automation without charts",
            duration_sec=20,
            summary=(
                "A standing order of 200 PLN/mo puts 2,400 PLN to work each year without watching "
                "charts. A broad ETF holds hundreds of companies, so you do not have to pick them."
            ),
            key_takeaway="2,400 PLN lands every year in the background — no chart-watching.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_3",
            title="Buffer separately, surplus separately",
            duration_sec=20,
            summary=(
                "Expenses of 2,500 PLN/mo × 3 months = a 7,500 PLN buffer. Only amounts above that "
                "go to the market, so a portfolio drop never forces you to sell."
            ),
            key_takeaway="A 7,500 PLN buffer = calmer handling of temporary drops.",
            xp_reward=15,
        ),
    ],
    "50+": [
        MicroLessonCard(
            id="ml_50_1",
            title="You can invest at any age",
            duration_sec=20,
            summary=(
                "A 7-year horizon is still time for a conscious start: 1,200 PLN/mo is 100,800 PLN "
                "of contributions, and even a temporary -20% in year 3 leaves time to rebuild the "
                "plan calmly (educational scenario)."
            ),
            key_takeaway="With a 7-year horizon, calm matters more than speed.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_2",
            title="An anti-inflation shield for your capital",
            duration_sec=20,
            summary=(
                "50,000 PLN in a 0% account at 3.5% inflation loses about 1,750 PLN of purchasing "
                "power a year — the larger the savings, the more it hurts."
            ),
            key_takeaway="About 1,750 PLN a year per 50,000 PLN — that is how much less cash buys.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_3",
            title="Simplicity and diversification",
            duration_sec=20,
            summary=(
                "One company is one risk; a broad ETF spreads capital across hundreds of companies. "
                "A TER of 0.20% means 20 PLN a year per 10,000 PLN — a predictable, explicit cost."
            ),
            key_takeaway="Hundreds of companies instead of one, 20 PLN cost per 10,000 PLN, full clarity.",
            xp_reward=15,
        ),
    ],
}

PLAN_SENTENCE_EN: dict[str, str] = {
    "split": (
        "Of your {free_cash} PLN of free cash, {emergency_savings_monthly} PLN goes to the buffer, "
        "and {recommended_monthly} PLN/mo to training in a broad ETF."
    ),
    "invest": (
        "You already have a buffer, so an illustrative {recommended_monthly} PLN per month can work "
        "in a broad ETF."
    ),
    "savings_first": (
        "Buffer first: {emergency_savings_monthly} PLN/mo into a savings account. We will show the "
        "ETF using an illustrative {recommended_monthly} PLN/mo."
    ),
}

FINAL_MESSAGE_EN: str = (
    "Day 1 of 14 complete! Fast-forwarding {horizon_years} years: contributions in a 0% account "
    "would be worth about {cash_real_value} PLN in real terms, and about {etf_real_value} PLN "
    "historically for a broad ETF (educational assumptions). Do today's small challenge and come "
    "back tomorrow for Day 2."
)

FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX_EN: str = (
    "Remember: buffer first — the ETF is an illustrative example for later."
)

FINAL_BADGE_EN: str = "Day 1 complete • Goal: {horizon_years} years"

# Finały Dni 2–4 (EN) — bez nowych liczb i bez obietnic zysku.
FINAL_MESSAGE_BY_DAY_EN: dict[int, str] = {
    1: FINAL_MESSAGE_EN,
    2: (
        "Day 2 of 14 complete! You know what to look for in a fee table and why demo mode "
        "exists. Tomorrow on Day 3 we set up your first standing order."
    ),
    3: (
        "Day 3 of 14 complete! A standing order and a symbolic 10 PLN test are the foundation "
        "of consistency. Tomorrow on Day 4 you will preview your first micro-order into a "
        "broad ETF."
    ),
    4: (
        "Day 4 of 14 complete! The foundations and your first order practice are done. Time for "
        "Checkpoint #1 — a short knowledge check from Days 1–4."
    ),
}

FINAL_BADGE_BY_DAY_EN: dict[int, str] = {
    1: FINAL_BADGE_EN,
    2: "Day 2 complete • Fees checked",
    3: "Day 3 complete • 10 PLN test done",
    4: "Day 4 complete • Ready for Checkpoint #1",
}

ASSUMPTIONS_TEXT_EN: str = (
    "Educational assumptions: 5.7% per year after costs (before 19% tax), 3.5% inflation per year, "
    "values in today's PLN. This is not a forecast or a guarantee."
)

COSTS_NOTE_EN: str = (
    "Capital gains tax, brokerage fees and currency risk are not included. "
    "Past results do not guarantee future ones."
)

INSTRUMENT_CATEGORY_EN: str = "Broad global ETF (educational example for Day 14)"

STEP1_BADGE_EN: str = "Day 1 • Start ({recommended_monthly} PLN/mo)"

STEP1_BY_AGE_GROUP_EN: dict[AgeGroup, dict] = {
    "20+": {
        "badge": STEP1_BADGE_EN,
        "step_question": "What gives you more peace of mind at the start?",
        "luna_message": (
            "Hi! I'm Kita, your daily AI Coach — we're starting Day 1 of 14! {plan_sentence} You "
            "don't have to guess individual companies: a broad ETF spreads your money across "
            "hundreds of companies at once. What gives you more peace of mind at the start?"
        ),
        "optimal_criterion": (
            "spreading money across many companies (diversification) instead of one company; "
            "it does not remove market risk"
        ),
        "options": [
            {
                "id": "a",
                "text": "A broad ETF covering the whole market (diversification)",
                "is_optimal": True,
                "feedback": (
                    "Yes! Spreading money across hundreds of companies limits the impact of one "
                    "company stumbling — it does not remove market risk, but it softens it."
                ),
            },
            {
                "id": "b",
                "text": "Buying shares of one well-known, stable company",
                "is_optimal": False,
                "feedback": (
                    "Even a well-known company can stumble, and then the whole amount goes with it. "
                    "A broad ETF spreads that risk across hundreds of companies."
                ),
            },
            {
                "id": "c",
                "text": "Leaving everything in a regular account",
                "is_optimal": False,
                "feedback": (
                    "An account is great for everyday spending, but with inflation around 3.5% a "
                    "year, cash buys less year after year."
                ),
            },
        ],
    },
    "30-50": {
        "badge": STEP1_BADGE_EN,
        "step_question": "What is the biggest advantage of this approach when you are short on time?",
        "luna_message": (
            "Hi! I'm Kita, your daily AI Coach — welcome to Day 1 of 14. {plan_sentence} A passive "
            "broad ETF runs in the background, without tracking the market daily. What is its "
            "biggest advantage when you are short on time?"
        ),
        "optimal_criterion": (
            "automation and diversification without daily tracking; no guarantee of avoiding losses"
        ),
        "options": [
            {
                "id": "a",
                "text": "It runs in the background: diversification without watching charts",
                "is_optimal": True,
                "feedback": (
                    "Spot on! A steady plan in a broad ETF saves time and does not require being a "
                    "market expert."
                ),
            },
            {
                "id": "b",
                "text": "It removes the risk of losing money within a year",
                "is_optimal": False,
                "feedback": (
                    "There is no guarantee — an ETF can fall. Its strength is spreading risk over a "
                    "long horizon."
                ),
            },
            {
                "id": "c",
                "text": "It lets you hunt for market opportunities every day",
                "is_optimal": False,
                "feedback": (
                    "That is exactly what you want to avoid — a passive ETF is meant to save you "
                    "time, not take it."
                ),
            },
        ],
    },
    "50+": {
        "badge": STEP1_BADGE_EN,
        "step_question": "Why not keep all your capital in a regular account only?",
        "luna_message": (
            "Good day! I'm Kita, your daily AI Coach — we're starting a calm 14-day plan. You can "
            "invest at any age; you just need a matching horizon. {plan_sentence} Why is it better "
            "not to keep all your capital in a regular account only?"
        ),
        "optimal_criterion": "inflation reduces the real value of cash every year",
        "options": [
            {
                "id": "a",
                "text": "Because inflation reduces the real value of cash every year",
                "is_optimal": True,
                "feedback": (
                    "Exactly. Not deciding is also a decision: cash in a 0% account buys less year "
                    "after year."
                ),
            },
            {
                "id": "b",
                "text": "Because money in funds always earns more than in an account",
                "is_optimal": False,
                "feedback": (
                    "Not always — funds can fall too. The point is that cash alone loses to "
                    "inflation, while funds have a chance to limit that."
                ),
            },
            {
                "id": "c",
                "text": "Because it is better to put everything quickly into one company",
                "is_optimal": False,
                "feedback": (
                    "Concentrating everything in one company is a big risk. A broad ETF spreads it "
                    "across hundreds of companies."
                ),
            },
        ],
    },
}

# Krok 1 — warianty personalizacji EN (docs/03 §10).
STEP1_SAVINGS_FIRST_EN: dict = {
    "badge": "Day 1 • Start ({emergency_savings_monthly} PLN/mo to the buffer)",
    "step_question": "Where do you start when you do not have a buffer yet?",
    "luna_message": (
        "Hi! I'm Kita, your daily AI Coach — we're starting Day 1 of 14! {plan_sentence} "
        "Before money goes to the market, it is worth having a safe buffer for surprises. "
        "Where do you start?"
    ),
    "optimal_criterion": (
        "builds the buffer first in a savings account; investing starts later and only with "
        "free surplus"
    ),
    "options": [
        {
            "id": "a",
            "text": "First {emergency_savings_monthly} PLN/mo into the buffer, ETF later",
            "is_optimal": True,
            "feedback": (
                "Exactly! The buffer protects your everyday budget, and a broad ETF comes in "
                "calmly once you have a safe base."
            ),
        },
        {
            "id": "b",
            "text": "Put all free cash into one popular fund right away",
            "is_optimal": False,
            "feedback": (
                "Without a buffer, any surprise may force you to sell at a bad moment. "
                "A safe base comes first, investing after."
            ),
        },
        {
            "id": "c",
            "text": "Keep everything in a 0% account and postpone the decision",
            "is_optimal": False,
            "feedback": (
                "Cash in a 0% account loses about 3.5% a year in real terms. Keep the buffer, "
                "but the surplus can work in a broad ETF."
            ),
        },
    ],
}

STEP1_CONFIDENT_EN: dict = {
    "badge": "Day 1 • Start ({recommended_monthly} PLN/mo)",
    "step_question": "Which cost and habit really drive the long-term result of a broad ETF?",
    "luna_message": (
        "Hi! I'm Kita, your daily AI Coach — we're starting Day 1 of 14! {plan_sentence} "
        "Since you feel more confident, let's go deeper: over a long horizon, costs and "
        "simplicity matter more than trying to beat the market. Which cost and habit really "
        "drive the result?"
    ),
    "optimal_criterion": (
        "low costs (TER) and regular contributions into a broad ETF instead of trying to beat "
        "the market and trading often"
    ),
    "options": [
        {
            "id": "a",
            "text": "Low TER and regular contributions into a broad ETF instead of beating the market",
            "is_optimal": True,
            "feedback": (
                "Spot on! Costs and consistency work across the whole horizon, while trying to "
                "beat the market usually adds costs and stress."
            ),
        },
        {
            "id": "b",
            "text": "High fees do not matter as long as the fund is popular",
            "is_optimal": False,
            "feedback": (
                "Fees (TER) reduce the result every year, whatever the popularity. Over a long "
                "horizon they weigh most on your capital."
            ),
        },
        {
            "id": "c",
            "text": "Frequent buying and selling to catch a better moment",
            "is_optimal": False,
            "feedback": (
                "Frequent trading creates costs and emotions, and timing the market is very "
                "hard. Regular contributions spread the risk over time."
            ),
        },
    ],
}

STEP2_BY_CONCERN_EN: dict[MainConcern, dict] = {
    "freeze_money": {
        "badge": "Sudden expense • Liquidity test",
        "step_question": "Your laptop breaks. What do you do?",
        "luna_message": (
            "Fast-forward 6 months — you already have about {half_year_value} PLN in the ETF, and "
            "the buffer is growing next to it. Suddenly your laptop breaks and you need a few "
            "thousand. What do you do?"
        ),
        "optimal_criterion": (
            "pays from the buffer; understands the ETF is not frozen and, as a last resort, units "
            "can be sold (usually a few business days)"
        ),
        "options": [
            {
                "id": "a",
                "text": "I pay from the buffer — the ETF stays and keeps working",
                "is_optimal": True,
                "feedback": (
                    "Exactly! The buffer is for surprises. And if it were not enough, the ETF is not "
                    "frozen either — selling and payout usually take a few business days."
                ),
            },
            {
                "id": "b",
                "text": "I sell part of the ETF and withdraw within a few business days",
                "is_optimal": False,
                "feedback": (
                    "That is possible, because ETF money is not frozen. But for current surprises it "
                    "is better to use the buffer — the sale might land at a worse market moment."
                ),
            },
            {
                "id": "c",
                "text": "I do nothing — money in the ETF is locked for years",
                "is_optimal": False,
                "feedback": (
                    "That is a common myth: an ETF can be sold on any trading day, and the money "
                    "usually arrives after a few business days."
                ),
            },
        ],
    },
    "no_time": {
        "badge": "No time • Autopilot test",
        "step_question": "Work is chaotic. How do you run your investment?",
        "luna_message": (
            "Fast-forward 6 months — you have about {half_year_value} PLN in the ETF. Work is in a "
            "hot period and you have zero time for the market. How do you run your investment?"
        ),
        "optimal_criterion": (
            "a steady, automatic plan running in the background; no daily checking and no "
            "postponing the start"
        ),
        "options": [
            {
                "id": "a",
                "text": "I keep the standing order — the plan runs in the background",
                "is_optimal": True,
                "feedback": (
                    "Spot on! A steady plan does not need your time, and consistency does the work."
                ),
            },
            {
                "id": "b",
                "text": "I check quotes every day during my break",
                "is_optimal": False,
                "feedback": (
                    "Daily checking usually increases stress and the temptation to make hasty "
                    "decisions, not results."
                ),
            },
            {
                "id": "c",
                "text": "I will wait until I have time to learn about the market",
                "is_optimal": False,
                "feedback": (
                    "Waiting for the perfect moment costs time, and time is your main ally here. A "
                    "simple, steady plan is enough."
                ),
            },
        ],
    },
    "lose_money": {
        "badge": "Hot tip • Diversification test",
        "step_question": "A friend advises buying one popular stock. What do you do?",
        "luna_message": (
            "Fast-forward 6 months — you have about {half_year_value} PLN in the ETF. A friend "
            "insists: “buy shares of one popular company, you will earn faster”. What do you do?"
        ),
        "optimal_criterion": (
            "stays with a broad, diversified fund; understands that concentration in one company "
            "increases risk"
        ),
        "options": [
            {
                "id": "a",
                "text": "I stay with the broad ETF — one company means bigger risk",
                "is_optimal": True,
                "feedback": (
                    "Good! A broad ETF spreads risk across hundreds of companies; one company can "
                    "rise, but it can also fall hard."
                ),
            },
            {
                "id": "b",
                "text": "I move everything into that company",
                "is_optimal": False,
                "feedback": (
                    "The whole amount in one company is a big risk — its stumble hits your entire "
                    "portfolio."
                ),
            },
            {
                "id": "c",
                "text": "I move half — that spreads the risk",
                "is_optimal": False,
                "feedback": (
                    "Half in one company is still high concentration. A broad ETF spreads risk far "
                    "more effectively."
                ),
            },
        ],
    },
    "too_late": {
        "badge": "Age does not exclude • Horizon test",
        "step_question": "Someone says it is too late. What do you answer?",
        "luna_message": (
            "After 6 months you have about {half_year_value} PLN in a broad ETF. Someone says: “at "
            "your age it is too late”. Your horizon is {horizon_years} years, and the buffer sits "
            "safely next to it. What do you answer?"
        ),
        "optimal_criterion": (
            "you can invest at any age; the key is matching the horizon and proportions, plus a "
            "separate buffer"
        ),
        "options": [
            {
                "id": "a",
                "text": "Age does not exclude me — I match the horizon and proportions, and keep the buffer separate",
                "is_optimal": True,
                "feedback": (
                    "A great, mature decision! A matched horizon and a separate buffer are the best "
                    "protection against volatility."
                ),
            },
            {
                "id": "b",
                "text": "You are right — I will leave everything in the account",
                "is_optimal": False,
                "feedback": (
                    "I understand the concern, but cash loses too — to inflation. You can start with "
                    "a small amount and match the horizon."
                ),
            },
            {
                "id": "c",
                "text": "I will put more into a risky company to catch up quickly",
                "is_optimal": False,
                "feedback": (
                    "Trying to catch up with risk increases the chance of a big loss, and with a "
                    "shorter horizon there is less time to recover."
                ),
            },
        ],
    },
}

STEP3_EN: dict = {
    "badge": "Drop -20% • Calm test",
    "step_question": "After 3 years your portfolio is -20% on paper. What do you do?",
    "luna_message": (
        "Fast-forward 3 years. You contributed {year3_paid} PLN, the market dropped temporarily and "
        "on paper the portfolio is worth about {year3_stress_value} PLN (-20% — this is an "
        "educational scenario). What do you do?"
    ),
    "optimal_criterion": (
        "keeps the plan and stays calm; understands that an on-paper drop is volatility until they "
        "sell; has a separate buffer and does not have to sell; does not panic"
    ),
    "options": [
        {
            "id": "a",
            "text": "I keep the plan and keep contributing — it is volatility, and my horizon is {horizon_years} years",
            "is_optimal": True,
            "feedback": (
                "Exactly. An on-paper drop is volatility, not a loss, as long as you do not sell — "
                "and that is exactly why the buffer sits separately. History does not guarantee the "
                "future."
            ),
        },
        {
            "id": "b",
            "text": "I sell everything so I do not lose more",
            "is_optimal": False,
            "feedback": (
                "That is the most common mistake: selling after a drop turns an on-paper loss into a "
                "real one."
            ),
        },
        {
            "id": "c",
            "text": "I stop contributing and wait for the market to bounce",
            "is_optimal": False,
            "feedback": (
                "Understandable, but contributions after a drop buy more units at a lower price; "
                "pausing usually takes that advantage away."
            ),
        },
    ],
}

# --------------------------------------------------------------------------- #
# Dni 2–4 (EN): 2 kroki decyzyjne + 2 mikro-lekcje każdego dnia (docs/03 §2/§10)
# --------------------------------------------------------------------------- #

DAY2_STEPS_EN: dict[int, dict] = {
    1: {
        "badge": "Day 2 • Account & fees",
        "step_question": "What should you check in the fee table before opening a brokerage account?",
        "luna_message": (
            "Day 2 of 14 — time for practice. {plan_sentence} Before you open a brokerage "
            "account, look at the fee table. What should you check?"
        ),
        "optimal_criterion": (
            "looks at the total cost: the per-order fee and the TER of a broad ETF, not only "
            "at a free account opening"
        ),
        "options": [
            {
                "id": "a",
                "text": "The total cost: per-order fee and the TER of a broad ETF",
                "is_optimal": True,
                "feedback": (
                    "Exactly. The per-order fee and the TER work together — a free account "
                    "opening does not mean free investing."
                ),
            },
            {
                "id": "b",
                "text": "Only whether opening the account is free",
                "is_optimal": False,
                "feedback": (
                    "A free opening is only the beginning. What matters is the cost of each "
                    "order and the annual fund cost (TER)."
                ),
            },
            {
                "id": "c",
                "text": "The maximum leverage so you can earn faster",
                "is_optimal": False,
                "feedback": (
                    "Leverage increases both the chance and the risk of loss. At the start, "
                    "simplicity and predictable costs matter most."
                ),
            },
        ],
    },
    2: {
        "badge": "Day 2 • Fee trap",
        "step_question": "A friend places 20 small orders a month to catch opportunities. What is wiser?",
        "luna_message": (
            "Day 2 of 14 — costs and diversification. {plan_sentence} A friend says they place 20 "
            "small orders a month to catch opportunities. What is wiser?"
        ),
        "optimal_criterion": (
            "a few regular orders into a broad ETF instead of many small transactions; frequent "
            "orders multiply fees and do not improve diversification"
        ),
        "options": [
            {
                "id": "a",
                "text": "A few regular orders into a broad ETF — fewer fees, the same diversification",
                "is_optimal": True,
                "feedback": (
                    "Exactly. Every order costs a fee, and a broad ETF already holds hundreds of "
                    "companies. Fewer trades means a lower cost without losing diversification."
                ),
            },
            {
                "id": "b",
                "text": "20 orders a month, because more opportunities mean more profit",
                "is_optimal": False,
                "feedback": (
                    "20 orders × 3 PLN is already 60 PLN a month in fees alone. More trades do not "
                    "add diversification — a broad ETF has it from day one."
                ),
            },
            {
                "id": "c",
                "text": "One big order into a single company to limit the fees",
                "is_optimal": False,
                "feedback": (
                    "Fees drop, but all the risk lands on one company. A broad ETF gives low costs "
                    "and spreading at the same time."
                ),
            },
        ],
    },
}

DAY3_STEPS_EN: dict[int, dict] = {
    1: {
        "badge": "Day 3 • Standing order",
        "step_question": "What does a standing order set up once give you?",
        "luna_message": (
            "Day 3 of 14 — automation. {plan_sentence} You set a standing order once and the "
            "bank executes it regularly. What do you gain from that?"
        ),
        "optimal_criterion": (
            "regular contributions without daily decisions; the plan runs in the background "
            "and reduces emotions"
        ),
        "options": [
            {
                "id": "a",
                "text": "Regular contributions without daily decisions — the plan runs in the background",
                "is_optimal": True,
                "feedback": (
                    "Yes! One decision instead of daily stress. Consistency usually matters "
                    "more than trying to catch the perfect moment."
                ),
            },
            {
                "id": "b",
                "text": "A guarantee that the portfolio never drops",
                "is_optimal": False,
                "feedback": (
                    "There is no guarantee — a broad ETF can fall. Automation protects you from "
                    "emotions, not from market volatility."
                ),
            },
            {
                "id": "c",
                "text": "The ability to buy only at the perfect moment",
                "is_optimal": False,
                "feedback": (
                    "A standing order buys regularly, also when nobody knows whether it is the "
                    "perfect moment. That is what spreads risk over time."
                ),
            },
        ],
    },
    2: {
        "badge": "Day 3 • Hot tip",
        "step_question": "A friend sends a “hot tip” about one company. What do you do with your steady plan?",
        "luna_message": (
            "Day 3 of 14 — emotions and hot tips. {plan_sentence} A friend sends a “hot tip”: one "
            "company is “certain” to double. What do you do with your steady plan?"
        ),
        "optimal_criterion": (
            "keeps the simple, automated plan in a broad ETF; resists FOMO and single-company tips"
        ),
        "options": [
            {
                "id": "a",
                "text": "I keep the standing order in a broad ETF — a single-company tip is high concentration risk",
                "is_optimal": True,
                "feedback": (
                    "Exactly. A steady plan needs no tips, and one company carries risk that a broad "
                    "ETF does not have at that scale."
                ),
            },
            {
                "id": "b",
                "text": "I move the whole plan into that company, because the chance will not repeat",
                "is_optimal": False,
                "feedback": (
                    "That is textbook FOMO: all the money in one company means one stumble takes the "
                    "whole plan. Nobody guarantees growth."
                ),
            },
            {
                "id": "c",
                "text": "I pause contributions and wait until the tip is confirmed",
                "is_optimal": False,
                "feedback": (
                    "Waiting for a tip to be confirmed is timing the market. Regular contributions "
                    "into a broad ETF work without such bets."
                ),
            },
        ],
    },
}

DAY4_STEPS_EN: dict[int, dict] = {
    1: {
        "badge": "Day 4 • First micro-order",
        "step_question": "What does your first micro-order into a broad ETF look like in practice?",
        "luna_message": (
            "Day 4 of 14 — practice and Checkpoint #1 preparation. {plan_sentence} What does "
            "your first micro-order into a broad global ETF look like?"
        ),
        "optimal_criterion": (
            "chooses a broad ETF (whole market), a small amount and a regular order; does not "
            "time the market and does not buy single companies"
        ),
        "options": [
            {
                "id": "a",
                "text": "I buy a broad ETF with a small amount, without timing the market",
                "is_optimal": True,
                "feedback": (
                    "Great! A broad ETF gives diversification, and a small amount lets you get "
                    "comfortable with the process without pressure."
                ),
            },
            {
                "id": "b",
                "text": "I wait for the perfect bottom and then go all in",
                "is_optimal": False,
                "feedback": (
                    "Catching the bottom is very hard and waiting can take years. Regular small "
                    "contributions spread the risk over time."
                ),
            },
            {
                "id": "c",
                "text": "I buy shares of one company because it is simpler",
                "is_optimal": False,
                "feedback": (
                    "One company means high concentration risk. A broad ETF spreads it across "
                    "hundreds of companies."
                ),
            },
        ],
    },
    2: {
        "badge": "Day 4 • Plan under control",
        "step_question": "A month later the washing machine breaks, and the ETF grew from 20% to 28% of the portfolio. What do you do?",
        "luna_message": (
            "Day 4 of 14 — keeping the plan simple before Checkpoint #1. {plan_sentence} A month "
            "later the washing machine breaks, and the ETF share grew from 20% to 28%. What do you do?"
        ),
        "optimal_criterion": (
            "pays for the repair from the buffer and rebalances back to the agreed proportions once "
            "a quarter, without daily trading"
        ),
        "options": [
            {
                "id": "a",
                "text": "I pay from the buffer and once a quarter return to 20% ETF / 80% buffer",
                "is_optimal": True,
                "feedback": (
                    "Spot on! The buffer handles surprises, and one calm quarterly rebalancing "
                    "restores the plan without extra trades."
                ),
            },
            {
                "id": "b",
                "text": "I sell the whole ETF to fix the machine and restart the plan from scratch",
                "is_optimal": False,
                "feedback": (
                    "Selling the whole portfolio costs fees and breaks the plan. The buffer exists "
                    "so the investment can keep working."
                ),
            },
            {
                "id": "c",
                "text": "I move the proportions every day to catch a better moment",
                "is_optimal": False,
                "feedback": (
                    "Daily reshuffling means costs and emotions. Rebalancing once a quarter is "
                    "enough to keep simple proportions."
                ),
            },
        ],
    },
}

DAY_STEPS_EN: dict[int, dict[int, dict]] = {2: DAY2_STEPS_EN, 3: DAY3_STEPS_EN, 4: DAY4_STEPS_EN}

DAY2_LESSONS_EN: list[MicroLessonCard] = [
    MicroLessonCard(
        id="ml_d2_1",
        title="Brokerage account and demo mode",
        duration_sec=20,
        summary=(
            "A brokerage account is where you place orders. Demo mode walks you through the whole "
            "process at 0 PLN of real risk — for example with a 10 PLN test order."
        ),
        key_takeaway="First the process at zero risk, then real money.",
        xp_reward=15,
    ),
    MicroLessonCard(
        id="ml_d2_2",
        title="Fee table and TER",
        duration_sec=20,
        summary=(
            "Example: a 0.20% TER on 10,000 PLN is 20 PLN a year, and 12 orders at 3 PLN are 36 PLN "
            "— about 56 PLN together. A free account opening does not mean free investing."
        ),
        key_takeaway="About 56 PLN a year per 10,000 PLN — look at the full cost, not one line.",
        xp_reward=15,
    ),
]

DAY3_LESSONS_EN: list[MicroLessonCard] = [
    MicroLessonCard(
        id="ml_d3_1",
        title="Standing order",
        duration_sec=20,
        summary=(
            "A standing order of 100 PLN/mo is 1,200 PLN of contributions a year with no 12 monthly "
            "decisions and no quote-checking. One decision up front protects you from emotions."
        ),
        key_takeaway="1,200 PLN lands automatically each year — consistency beats timing.",
        xp_reward=15,
    ),
    MicroLessonCard(
        id="ml_d3_2",
        title="The 10 PLN lesson",
        duration_sec=20,
        summary=(
            "With a 3 PLN order fee, a 10 PLN transfer costs 30% of the amount — that is why the "
            "first test is symbolic. It teaches the process and reveals fees before larger amounts."
        ),
        key_takeaway="10 PLN + 3 PLN fee = a lesson about costs, not a way to quick profit.",
        xp_reward=15,
    ),
]

DAY4_LESSONS_EN: list[MicroLessonCard] = [
    MicroLessonCard(
        id="ml_d4_1",
        title="A broad ETF in practice",
        duration_sec=20,
        summary=(
            "Your first micro-order can be 50–100 PLN into a broad global ETF: one transaction, "
            "hundreds of companies inside, and no picking of single stocks or the perfect bottom."
        ),
        key_takeaway="50–100 PLN and hundreds of companies inside — simplicity instead of timing.",
        xp_reward=15,
    ),
    MicroLessonCard(
        id="ml_d4_2",
        title="Ready for Checkpoint #1",
        duration_sec=20,
        summary=(
            "Checkpoint #1 has 4 questions and a 75% threshold, so 3 correct answers. Revise four "
            "concepts: inflation, buffer, costs and volatility — no ticker memorising."
        ),
        key_takeaway="3 out of 4 correct answers = Checkpoint #1 passed.",
        xp_reward=15,
    ),
]

MICRO_LESSONS_BY_DAY_EN: dict[int, list[MicroLessonCard]] = {
    2: DAY2_LESSONS_EN,
    3: DAY3_LESSONS_EN,
    4: DAY4_LESSONS_EN,
}

# Mini-checki EN (1 pytanie, 3 opcje, jeden poprawny indeks) — te same id co PL.
MICRO_LESSON_CHECKS_EN: dict[str, dict] = {
    # --- Day 1 ---
    "ml_20_1": {
        "check_question": "How much does 10,000 PLN in a 0% account really lose in a year at 3.5% inflation?",
        "check_options": [
            "About 350 PLN of purchasing power",
            "About 3,500 PLN of purchasing power",
            "Nothing — the balance stays the same",
        ],
        "correct_option_index": 0,
        "check_explanation": (
            "3.5% of 10,000 PLN is about 350 PLN. The balance stands still, but it buys less."
        ),
    },
    "ml_20_2": {
        "check_question": "In month 6 the laptop breaks. What do you do with the 6,000 PLN buffer?",
        "check_options": [
            "I sell the whole ETF to be sure",
            "I pay from the buffer and the ETF keeps working",
            "I take a loan because the buffer must never be touched",
        ],
        "correct_option_index": 1,
        "check_explanation": (
            "The buffer exists for surprises. The ETF is not frozen, but it does not have to be sold."
        ),
    },
    "ml_20_3": {
        "check_question": "What does 200 PLN/mo for 15 years give at an assumed 5.7% net?",
        "check_options": [
            "36,000 PLN of contributions and a guaranteed 100,000 PLN",
            "36,000 PLN of contributions and exactly 36,000 PLN in value",
            "36,000 PLN of contributions and historically about 56,700 PLN nominal (educational)",
        ],
        "correct_option_index": 2,
        "check_explanation": (
            "200 PLN × 180 months = 36,000 PLN of contributions; at 5.7% net about 56,700 PLN "
            "nominal, with no guarantee."
        ),
    },
    "ml_30_1": {
        "check_question": "How much purchasing power does 20,000 PLN lose in a year at 3.5% inflation?",
        "check_options": [
            "About 700 PLN",
            "About 70 PLN",
            "Zero, because the balance does not change",
        ],
        "correct_option_index": 0,
        "check_explanation": "3.5% of 20,000 PLN is about 700 PLN less purchasing power per year.",
    },
    "ml_30_2": {
        "check_question": "How much do you contribute in a year with a 200 PLN/mo standing order?",
        "check_options": [
            "200 PLN",
            "2,400 PLN — without watching charts",
            "24,000 PLN",
        ],
        "correct_option_index": 1,
        "check_explanation": "200 PLN × 12 months = 2,400 PLN, and you decide only once.",
    },
    "ml_30_3": {
        "check_question": "Expenses are 2,500 PLN/mo. How big is a 3-month buffer?",
        "check_options": [
            "2,500 PLN",
            "25,000 PLN",
            "7,500 PLN",
        ],
        "correct_option_index": 2,
        "check_explanation": "2,500 PLN × 3 = 7,500 PLN. Only the surplus above that goes to the market.",
    },
    "ml_50_1": {
        "check_question": "How many contributions does 1,200 PLN/mo give over 7 years?",
        "check_options": [
            "100,800 PLN",
            "14,400 PLN",
            "840,000 PLN",
        ],
        "correct_option_index": 0,
        "check_explanation": "1,200 PLN × 84 months = 100,800 PLN of contributions over 7 years.",
    },
    "ml_50_2": {
        "check_question": "How much purchasing power does 50,000 PLN lose in a year at 3.5%?",
        "check_options": [
            "About 175 PLN",
            "About 1,750 PLN",
            "None — large amounts do not lose value",
        ],
        "correct_option_index": 1,
        "check_explanation": "3.5% of 50,000 PLN is about 1,750 PLN less purchasing power a year.",
    },
    "ml_50_3": {
        "check_question": "What is the yearly cost of a 0.20% TER on 10,000 PLN?",
        "check_options": [
            "200 PLN",
            "2,000 PLN",
            "20 PLN",
        ],
        "correct_option_index": 2,
        "check_explanation": "0.20% of 10,000 PLN is 20 PLN a year — an explicit, predictable cost.",
    },
    # --- Day 2 ---
    "ml_d2_1": {
        "check_question": "Why use demo mode?",
        "check_options": [
            "To rehearse orders without real risk",
            "To get a guaranteed profit",
            "To avoid every fee",
        ],
        "correct_option_index": 0,
        "check_explanation": (
            "Demo mode is a process rehearsal at zero risk — not a profit promise and not a fee waiver."
        ),
    },
    "ml_d2_2": {
        "check_question": "A 0.20% TER on 10,000 PLN plus 12 orders at 3 PLN cost per year:",
        "check_options": [
            "About 6 PLN",
            "About 56 PLN",
            "About 560 PLN",
        ],
        "correct_option_index": 1,
        "check_explanation": "20 PLN TER + 36 PLN in order fees = about 56 PLN a year.",
    },
    # --- Day 3 ---
    "ml_d3_1": {
        "check_question": "How much does a 100 PLN/mo standing order contribute in a year?",
        "check_options": [
            "100 PLN",
            "12,000 PLN",
            "1,200 PLN without 12 decisions",
        ],
        "correct_option_index": 2,
        "check_explanation": "100 PLN × 12 = 1,200 PLN, and you decide once instead of every month.",
    },
    "ml_d3_2": {
        "check_question": "With a 3 PLN order fee, a 10 PLN transfer costs:",
        "check_options": [
            "About 30% of the amount",
            "About 3% of the amount",
            "Nothing, because the amount is small",
        ],
        "correct_option_index": 0,
        "check_explanation": "3 PLN out of 10 PLN is 30% — that is why the test is symbolic and shows costs.",
    },
    # --- Day 4 ---
    "ml_d4_1": {
        "check_question": "What does a sensible first micro-order look like?",
        "check_options": [
            "Everything into one company from a hot tip",
            "50–100 PLN into a broad global ETF",
            "Borrowed money with leverage",
        ],
        "correct_option_index": 1,
        "check_explanation": (
            "A small amount in a broad ETF holds hundreds of companies inside, with no stock picking "
            "and no leverage."
        ),
    },
    "ml_d4_2": {
        "check_question": "A 75% threshold in Checkpoint #1 with 4 questions means:",
        "check_options": [
            "3 correct answers",
            "2 correct answers",
            "All 4 answers",
        ],
        "correct_option_index": 0,
        "check_explanation": "75% of 4 questions is 3 correct answers — understanding the mechanisms is enough.",
    },
}

_apply_lesson_checks(
    MICRO_LESSON_CHECKS_EN,
    MICRO_LESSONS_BY_GROUP_EN,
    MICRO_LESSONS_BY_DAY_EN,
    DAY2_LESSONS_EN,
    DAY3_LESSONS_EN,
    DAY4_LESSONS_EN,
)



# --------------------------------------------------------------------------- #
# Wartości domyślne placeholderów (zabezpieczenie przed brakiem klucza w faktach)
# --------------------------------------------------------------------------- #

_DEFAULT_FACTS: dict[str, object] = {
    "plan_type": "split",
    "age_group": "20+",
    "main_concern": "freeze_money",
    "free_cash": 1000,
    "emergency_savings_monthly": 0,
    "training_etf_monthly": 0,
    "recommended_monthly": 200,
    "horizon_years": 15,
    "half_year_value": 0,
    "year3_paid": 0,
    "year3_value": 0,
    "year3_stress_value": 0,
    "etf_nominal_value": 0,
    "etf_real_value": 0,
    "cash_real_value": 0,
    "diff_value": 0,
    "win_rate": 90,
}


def _format_value(value: object, lang: Language = "en") -> object:
    """PL: ``33 844`` (spacja), EN: ``33,844`` (przecinek) — zgodnie z docs/01 §9."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        grouped = f"{value:,}"
        return grouped if lang == "en" else grouped.replace(",", " ")
    return value


def _format_values(session_facts: dict | None, lang: str | None = None) -> dict:
    """Buduje mapę wartości do ``.format()``: fakty sesji + domyślne + ``plan_sentence``."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)

    raw = dict(_DEFAULT_FACTS)
    for key, value in facts.items():
        if value is not None:
            raw[key] = value

    if not facts or facts.get("training_etf_monthly") is None:
        raw["training_etf_monthly"] = (
            0 if str(raw.get("plan_type", "split")) == "savings_first" else raw["recommended_monthly"]
        )

    values = {key: _format_value(value, active) for key, value in raw.items()}
    plan_type = str(raw.get("plan_type", "split"))
    templates = PLAN_SENTENCE_EN if active == "en" else PLAN_SENTENCE
    template = templates.get(plan_type, templates["split"])
    values["plan_sentence"] = template.format(**values)
    return values


TOTAL_STEPS_BY_DAY: dict[int, int] = {1: 3, 2: 2, 3: 2, 4: 2}
MAX_DAY: int = 4


def _normalize_day(day: object) -> int:
    """Dzień w zakresie 1..4; każda inna wartość wraca do Dnia 1."""
    value = _as_int(day, 1)
    return value if 1 <= value <= MAX_DAY else 1


def total_steps_for_day(day: int = 1) -> int:
    """Liczba kroków dnia: 3 dla Dnia 1, 2 dla Dni 2–4 (docs/03 §2)."""
    return TOTAL_STEPS_BY_DAY[_normalize_day(day)]


def _select_step_one(facts: dict, lang: Language) -> dict:
    """Krok 1 Dnia 1: plan ``savings_first`` > pewność siebie > grupa wiekowa."""
    if str(facts.get("plan_type", "")) == "savings_first":
        return STEP1_SAVINGS_FIRST_EN if lang == "en" else STEP1_SAVINGS_FIRST
    if _as_int(facts.get("self_confidence_start"), 0) >= 4 or _as_int(
        facts.get("confidence_start"), 0
    ) >= 20:
        return STEP1_CONFIDENT_EN if lang == "en" else STEP1_CONFIDENT
    table = STEP1_BY_AGE_GROUP_EN if lang == "en" else STEP1_BY_AGE_GROUP
    age_group = str(facts.get("age_group", "20+"))
    return table.get(age_group, table["20+"])


def _select_step_block(
    step: int, session_facts: dict | None, lang: Language = "en", day: int = 1
) -> dict:
    facts = session_facts or {}
    active_day = _normalize_day(day)
    if active_day == 1:
        if step == 1:
            return _select_step_one(facts, lang)
        if step == 2:
            table = STEP2_BY_CONCERN_EN if lang == "en" else STEP2_BY_CONCERN
            concern = str(facts.get("main_concern", "freeze_money"))
            return table.get(concern, table["freeze_money"])
        if step == 3:
            return STEP3_EN if lang == "en" else STEP3
        raise ValueError("Krok misji musi być liczbą 1, 2 lub 3")

    steps = (DAY_STEPS_EN if lang == "en" else DAY_STEPS)[active_day]
    block = steps.get(step)
    if block is None:
        raise ValueError("Krok Dni 2–4 musi być liczbą 1 lub 2")
    return block


def _as_int(value: object, default: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# Funkcje publiczne
# --------------------------------------------------------------------------- #


def get_demo_personas(lang: Language = "en") -> list[DemoPersona]:
    """Persony demo z etykietami w danym języku (kwoty w PLN bez zmian)."""
    if _normalize_lang(lang) != "en":
        return list(DEMO_PERSONAS)
    return [
        DemoPersona(
            id=persona.id,
            short_label=PERSONA_LABELS_EN[persona.id][0],
            full_label=PERSONA_LABELS_EN[persona.id][1],
            age=persona.age,
            net_income=persona.net_income,
            free_cash=persona.free_cash,
            has_emergency_fund=persona.has_emergency_fund,
            main_concern=persona.main_concern,
            self_confidence_start=persona.self_confidence_start,
        )
        for persona in DEMO_PERSONAS
    ]


def get_age_group_content(age_group: str, lang: Language = "en") -> dict:
    """Zwraca filtr Speakly, mapę 14 dni i mikro-lekcje dla grupy wiekowej."""
    if _normalize_lang(lang) == "en":
        filters, roadmaps, lessons = (
            SPEAKLY_FILTER_BY_GROUP_EN,
            ROADMAP_BY_GROUP_EN,
            MICRO_LESSONS_BY_GROUP_EN,
        )
    else:
        filters, roadmaps, lessons = (
            SPEAKLY_FILTER_BY_GROUP,
            ROADMAP_BY_GROUP,
            MICRO_LESSONS_BY_GROUP,
        )
    key = age_group if age_group in filters else "20+"
    return {
        "speakly_filter": filters[key],
        "roadmap": roadmaps[key],
        "micro_lessons": lessons[key],
    }


def get_assumptions_text(lang: Language = "en") -> str:
    """Tekst jawnych założeń edukacyjnych pod wykresem."""
    return ASSUMPTIONS_TEXT_EN if _normalize_lang(lang) == "en" else ASSUMPTIONS_TEXT


def get_costs_note(lang: Language = "en") -> str:
    """Nota o kosztach, podatku i braku gwarancji."""
    return COSTS_NOTE_EN if _normalize_lang(lang) == "en" else COSTS_NOTE


def get_instrument_category(lang: Language = "en") -> str:
    """Kategoria instrumentu w przykładowym planie."""
    return INSTRUMENT_CATEGORY_EN if _normalize_lang(lang) == "en" else INSTRUMENT_CATEGORY


def get_step_block(
    step: int, session_facts: dict, lang: Language | None = None, day: int = 1
) -> dict:
    """Zwraca blok kroku z podstawionymi faktami sesji (stałe nie są mutowane)."""
    active = _lang_of(session_facts, lang)
    values = _format_values(session_facts, active)
    block = _select_step_block(step, session_facts, active, day)

    options = [
        {
            "id": option["id"],
            "text": option["text"].format(**values),
            "is_optimal": option["is_optimal"],
            "feedback": option["feedback"].format(**values),
        }
        for option in block["options"]
    ]

    return {
        "badge": block["badge"].format(**values),
        "step_question": block["step_question"].format(**values),
        "luna_message": block["luna_message"].format(**values),
        "optimal_criterion": block["optimal_criterion"].format(**values),
        "options": options,
    }


def get_day_content(day: int, session_facts: dict, lang: Language | None = None) -> dict:
    """Mikro-lekcje, liczba kroków i wyzwanie wybranego dnia (1..4)."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    active_day = _normalize_day(day)

    age_group = str(facts.get("age_group", "20+"))
    if active_day == 1:
        table = MICRO_LESSONS_BY_GROUP_EN if active == "en" else MICRO_LESSONS_BY_GROUP
        lessons = table.get(age_group, table["20+"])
    else:
        by_day = MICRO_LESSONS_BY_DAY_EN if active == "en" else MICRO_LESSONS_BY_DAY
        lessons = by_day[active_day]

    return {
        "day": active_day,
        "total_steps": total_steps_for_day(active_day),
        "micro_lessons": [lesson.model_copy(deep=True) for lesson in lessons],
        "challenge": get_real_world_challenge(
            bool(facts.get("has_emergency_fund", False)),
            age_group,
            lang=active,
            day=active_day,
        ),
    }


def shuffle_options(options: list[dict], session_id: str, step: int) -> list[dict]:
    """Deterministycznie tasuje KOPIĘ opcji dla pary ``(session_id, step)``."""
    shuffled = [dict(option) for option in options]
    random.Random(str(session_id) + str(step)).shuffle(shuffled)
    return shuffled


def get_level_state(xp: int, lang: Language = "en") -> tuple[int, str, int]:
    """Zwraca ``(level, level_title, next_level_xp)`` dla danej liczby XP."""
    english = _normalize_lang(lang) == "en"
    if xp >= 250:
        return 3, ("Steady Builder" if english else "Konsekwentny Start"), 500
    if xp >= 100:
        return 2, ("Confident Start" if english else "Świadomy Start"), 250
    return 1, ("Observer" if english else "Obserwator"), 100


def get_initial_mission_turn(
    session_facts: dict, lang: Language | None = None, day: int = 1
) -> tuple[MissionTurnResponse, list[dict]]:
    """Buduje turę startową Kroku 1 oraz opcje do zapisania w ``current_options``."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    active_day = _normalize_day(day)
    total_steps = total_steps_for_day(active_day)
    block = get_step_block(1, facts, active, active_day)

    session_id = facts.get("session_id") or facts.get("id") or "demo-session"
    shuffle_seed = 1 if active_day == 1 else active_day * 10 + 1
    options = shuffle_options(block["options"], session_id, shuffle_seed)

    confidence_start = _as_int(facts.get("confidence_start"), 10)
    xp = _as_int(facts.get("xp"), 20)
    level, level_title, next_level_xp = get_level_state(xp, active)

    fields = getattr(MissionTurnResponse, "model_fields", None) or {}
    extras: dict = {}
    if "day" in fields:
        extras["day"] = active_day
    if "completed_days" in fields:
        extras["completed_days"] = sorted(
            {
                _as_int(value, 0)
                for value in (facts.get("completed_days") or [])
                if 1 <= _as_int(value, 0) <= MAX_DAY
            }
        )

    response = MissionTurnResponse(
        step_number=1,
        total_steps=total_steps,
        confidence_score=confidence_start,
        confidence_delta=0,
        confidence_start=confidence_start,
        understanding_feedback=None,
        is_optimal_choice=None,
        luna_message=block["luna_message"],
        quick_replies=[QuickReply(id=option["id"], text=option["text"]) for option in options],
        portfolio_status=PortfolioStatus(simulated_value=0, event_badge=block["badge"]),
        gamification=GamificationState(
            level=level,
            level_title=level_title,
            xp=xp,
            next_level_xp=next_level_xp,
            xp_gained=0,
            leveled_up=False,
            streak_days=_as_int(facts.get("streak_days"), 1),
        ),
        trigger_confetti=False,
        mission_completed=False,
        **extras,
    )
    return response, options


def get_real_world_challenge(
    has_emergency_fund: bool,
    age_group: str,
    lang: Language = "en",
    day: int = 1,
) -> RealWorldChallenge:
    """Codzienne, compliance-safe mikro-wyzwanie Dni 1–4 (docs/03 §6C)."""
    english = _normalize_lang(lang) == "en"
    active_day = _normalize_day(day)

    if active_day == 2:
        return RealWorldChallenge(
            title=(
                "Day 2 real-world challenge: Check your brokerage account or demo mode"
                if english
                else "Realne wyzwanie Dnia 2: Sprawdź konto maklerskie lub tryb demo"
            ),
            description=(
                "Open or review a brokerage account (or its demo mode) in your bank and read the "
                "fee table: per-order fees and the ETF's annual TER. No purchase required today."
                if english
                else (
                    "Otwórz lub przejrzyj konto maklerskie (albo tryb demo) w swoim banku i zajrzyj "
                    "do tabeli opłat: prowizja za zlecenie i roczny koszt TER funduszu. Dziś nie "
                    "musisz nic kupować."
                )
            ),
            amount_pln=0,
            target_account=(
                "Commerzbank Brokerage Account (demo mode)"
                if english
                else "Konto Maklerskie Commerzbank (tryb demo)"
            ),
            reward_xp=50,
        )

    if active_day == 3:
        return RealWorldChallenge(
            title=(
                "Day 3 real-world challenge: Fund the account with a 10 PLN test"
                if english
                else "Realne wyzwanie Dnia 3: Zasil konto testowymi 10 zł"
            ),
            description=(
                "Transfer a symbolic 10 PLN to your account or subaccount and check how a "
                "standing order is set up. The goal is the habit and the process, not a profit."
                if english
                else (
                    "Przelej symboliczne 10 zł na konto lub subkonto i zobacz, jak ustawia się "
                    "zlecenie stałe. Celem jest nawyk i proces, a nie zysk."
                )
            ),
            amount_pln=10,
            target_account=(
                "Commerzbank Investment Subaccount"
                if english
                else "Subkonto Inwestycyjne Commerzbank"
            ),
            reward_xp=50,
        )

    if active_day == 4:
        return RealWorldChallenge(
            title=(
                "Day 4 real-world challenge: Preview your first micro-ETF order"
                if english
                else "Realne wyzwanie Dnia 4: Przećwicz pierwsze mikro-zlecenie na szeroki ETF"
            ),
            description=(
                "In demo mode (or with a symbolic 10 PLN) walk through a preview of an order for "
                "a broad global ETF. Educational example only — no product or ticker "
                "recommendation."
                if english
                else (
                    "W trybie demo (lub za symboliczne 10 zł) przejdź podgląd zlecenia na szeroki "
                    "globalny ETF. To wyłącznie przykład edukacyjny — bez rekomendacji produktu "
                    "ani tickera."
                )
            ),
            amount_pln=10,
            target_account=(
                "Commerzbank Brokerage Account (demo mode)"
                if english
                else "Konto Maklerskie Commerzbank (tryb demo)"
            ),
            reward_xp=50,
        )

    if not has_emergency_fund or age_group == "20+":
        return RealWorldChallenge(
            title=(
                "Day 1 real-world challenge: Transfer 5 PLN to your savings account"
                if english
                else "Realne wyzwanie Dnia 1: Wpłać 5 zł na konto oszczędnościowe"
            ),
            description=(
                "Before you start the full plan in two weeks, break the barrier of your first "
                "transfer today with a symbolic 5 PLN and start your streak!"
                if english
                else (
                    "Zanim za 2 tygodnie ruszysz z pełnym planem, przełam dziś barierę pierwszego "
                    "przelewu symboliczną kwotą 5 zł i zacznij swoją serię!"
                )
            ),
            amount_pln=5,
            target_account=(
                "Commerzbank Savings Account"
                if english
                else "Konto Oszczędnościowe Commerzbank"
            ),
            reward_xp=50,
        )
    return RealWorldChallenge(
        title=(
            "Day 1 real-world challenge: Send a test 50 PLN to your starter subaccount"
            if english
            else "Realne wyzwanie Dnia 1: Przelej próbne 50 zł na subkonto startowe"
        ),
        description=(
            "You already have a buffer! Make a symbolic, stress-free test transfer of 50 PLN today "
            "to get comfortable with the first step before the target plan on Day 14."
            if english
            else (
                "Masz już poduszkę! Wykonaj dziś symboliczny, bezstresowy przelew testowy 50 zł, "
                "aby oswoić pierwszy krok przed docelowym planem w Dniu 14."
            )
        ),
        amount_pln=50,
        target_account=(
            "Commerzbank Starter Investment Subaccount"
            if english
            else "Subkonto Inwestycyjne Commerzbank"
        ),
        reward_xp=50,
    )


_CHECKLIST_CHK1: dict[str, dict[str, tuple[str, str]]] = {
    "pl": {
        "invest": (
            "Mam przykładową kwotę docelową: {recommended_monthly} zł/mies.",
            "Kwota dopasowana do wolnych środków, przy zachowanej poduszce.",
        ),
        "savings_first": (
            "Wiem, że najpierw buduję poduszkę: {emergency_savings_monthly} zł/mies. "
            "na konto oszczędnościowe.",
            "Do ETF wrócimy, gdy poduszka będzie gotowa — to rozsądny pierwszy krok.",
        ),
        "split": (
            "Mam przykładowy plan startowy: {emergency_savings_monthly} zł/mies. na poduszkę "
            "i {training_etf_monthly} zł/mies. na trening w szeroki ETF.",
            "Najpierw bezpieczeństwo, potem inwestowanie — bez naruszania codziennego budżetu.",
        ),
    },
    "en": {
        "invest": (
            "I have an illustrative target amount: {recommended_monthly} PLN/mo.",
            "The amount is matched to your free cash, with the buffer kept intact.",
        ),
        "savings_first": (
            "I know I build the buffer first: {emergency_savings_monthly} PLN/mo into a savings "
            "account.",
            "We will come back to the ETF once the buffer is ready — a sensible first step.",
        ),
        "split": (
            "I have a sample starting plan: {emergency_savings_monthly} PLN/mo for the buffer and "
            "{training_etf_monthly} PLN/mo for training in a broad ETF.",
            "Buffer first, then investing — without disturbing your everyday budget.",
        ),
    },
}

_CHECKLIST_CHK2: dict[str, tuple[str, str]] = {
    "pl": (
        "Rozumiem, że gotówka na zwykłym koncie traci realną wartość przez inflację.",
        "W horyzoncie {horizon_years} lat wpłaty na koncie 0% mają realnie ok. {cash_real_value} zł, "
        "a w szerokim ETF historycznie ok. {etf_real_value} zł (założenia edukacyjne).",
    ),
    "en": (
        "I understand that cash in a regular account loses real value to inflation.",
        "Over {horizon_years} years, contributions in a 0% account are worth about "
        "{cash_real_value} PLN in real terms, and about {etf_real_value} PLN historically for a "
        "broad ETF (educational assumptions).",
    ),
}

_CHECKLIST_CHK3: dict[str, dict[str, tuple[str, str]]] = {
    "pl": {
        "freeze_money": (
            "Wiem, że poduszka służy na awarie, a środki w ETF nie są zamrożone.",
            "W ostateczności sprzedaż jednostek i wypłata zajmują zwykle kilka dni roboczych.",
        ),
        "no_time": (
            "Wiem, że stały plan w szerokim ETF działa w tle — bez codziennego śledzenia giełdy.",
            "Regularność jest ważniejsza niż wyczucie momentu.",
        ),
        "lose_money": (
            "Wiem, że szeroki ETF rozkłada ryzyko, a jedna spółka to większa koncentracja.",
            "Dywersyfikacja nie usuwa ryzyka, ale je łagodzi.",
        ),
        "too_late": (
            "Wiem, że inwestować można w każdym wieku, dopasowując horyzont i proporcje.",
            "Poduszka i część bezpieczna zostają osobno.",
        ),
    },
    "en": {
        "freeze_money": (
            "I know the buffer is for surprises and that money in an ETF is not frozen.",
            "As a last resort, selling units and withdrawing usually takes a few business days.",
        ),
        "no_time": (
            "I know a steady plan in a broad ETF runs in the background — without tracking the "
            "market daily.",
            "Consistency matters more than timing.",
        ),
        "lose_money": (
            "I know a broad ETF spreads risk, while one company means higher concentration.",
            "Diversification does not remove risk, but it softens it.",
        ),
        "too_late": (
            "I know you can invest at any age by matching the horizon and proportions.",
            "The buffer and the cash cushion stay separate.",
        ),
    },
}

_CHECKLIST_CHK4: dict[str, tuple[str, str]] = {
    "pl": (
        "Wiem, że wahania (nawet -20%) są normalne — jutro na Dniu 2 ćwiczymy spokojne reagowanie.",
        "Regularność w 14 dni buduje prawdziwą pewność siebie.",
    ),
    "en": (
        "I know that volatility (even -20%) is normal — tomorrow on Day 2 we practise reacting calmly.",
        "Consistency over 14 days builds real confidence.",
    ),
}


def get_final_checklist(session_facts: dict, lang: Language | None = None) -> list[ChecklistItem]:
    """4-punktowa checklista Dnia 1 (``chk_1`` wg planu, ``chk_3`` wg obawy)."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    values = _format_values(facts, active)

    plan_type = str(facts.get("plan_type", "split"))
    concern = str(facts.get("main_concern", "freeze_money"))

    chk1_table = _CHECKLIST_CHK1[active]
    chk1_text, chk1_detail = chk1_table.get(plan_type, chk1_table["split"])
    chk_1 = ChecklistItem(
        id="chk_1", text=chk1_text.format(**values), detail=chk1_detail.format(**values)
    )

    chk2_text, chk2_detail = _CHECKLIST_CHK2[active]
    chk_2 = ChecklistItem(
        id="chk_2", text=chk2_text.format(**values), detail=chk2_detail.format(**values)
    )

    chk3_table = _CHECKLIST_CHK3[active]
    chk3_text, chk3_detail = chk3_table.get(concern, chk3_table["freeze_money"])
    chk_3 = ChecklistItem(
        id="chk_3", text=chk3_text.format(**values), detail=chk3_detail.format(**values)
    )

    chk4_text, chk4_detail = _CHECKLIST_CHK4[active]
    chk_4 = ChecklistItem(
        id="chk_4", text=chk4_text.format(**values), detail=chk4_detail.format(**values)
    )

    return [chk_1, chk_2, chk_3, chk_4]


def get_bank_draft(session_facts: dict, lang: Language | None = None) -> BankDraft:
    """Szkic przykładowego planu bankowego (wartości realne + nominalne)."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)

    return BankDraft(
        monthly_amount=_as_int(facts.get("recommended_monthly"), 200),
        horizon_years=_as_int(facts.get("horizon_years"), 15),
        instrument_category=get_instrument_category(active),
        projected_etf_real_value=_as_int(facts.get("etf_real_value"), 0),
        projected_etf_nominal_value=_as_int(facts.get("etf_nominal_value"), 0),
        projected_cash_real_value=_as_int(facts.get("cash_real_value"), 0),
        historical_win_rate=min(97, _as_int(facts.get("win_rate"), 90)),
        assumptions_text=get_assumptions_text(active),
        costs_note=get_costs_note(active),
    )


def get_final_message(session_facts: dict, lang: Language | None = None, day: int = 1) -> str:
    """Finałowy komunikat Kity dla dnia; ``savings_first`` dopisek tylko w Dniu 1."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    values = _format_values(facts, active)
    active_day = _normalize_day(day)

    table = FINAL_MESSAGE_BY_DAY_EN if active == "en" else FINAL_MESSAGE_BY_DAY
    message = table[active_day].format(**values)
    if active_day == 1 and str(facts.get("plan_type", "")) == "savings_first":
        suffix = (
            FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX_EN
            if active == "en"
            else FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX
        )
        message = f"{message} {suffix}"
    return message


def get_final_badge(session_facts: dict, lang: Language | None = None, day: int = 1) -> str:
    """Badge zdarzenia w turze finałowej wybranego dnia (Dni 1–4)."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    table = FINAL_BADGE_BY_DAY_EN if active == "en" else FINAL_BADGE_BY_DAY
    return table[_normalize_day(day)].format(**_format_values(facts, active))


# --------------------------------------------------------------------------- #
# Checkpoint #1 i ścieżki po 14 dniach (docs/03 §6D, §10)
# --------------------------------------------------------------------------- #


def get_checkpoint_questions(lang: Language = "en") -> list[dict]:
    """Pytania Checkpoint #1 BEZ ``correct_option_id`` (bezpieczne dla klienta)."""
    active = _normalize_lang(lang)
    public = CHECKPOINT_1_QUESTIONS_EN if active == "en" else CHECKPOINT_1_QUESTIONS
    return [
        {
            "id": question["id"],
            "question": question["question"],
            "options": [dict(option) for option in question["options"]],
        }
        for question in public
    ]


def grade_checkpoint(answers: dict[str, str], lang: Language = "en") -> dict:
    """Ocenia Checkpoint #1: próg 75% i bonus +100 XP (idempotencję robi ``main.py``)."""
    active = _normalize_lang(lang)
    questions = _CHECKPOINT_1_QUESTIONS_BY_LANG[active]
    submitted = answers or {}

    results: list[dict] = []
    correct_count = 0
    for question in questions:
        given = str(submitted.get(question["id"], "") or "").strip().lower()
        is_correct = given == question["correct_option_id"]
        if is_correct:
            correct_count += 1
        results.append(
            {
                "id": question["id"],
                "correct": is_correct,
                "correct_option_id": question["correct_option_id"],
                "explanation": question["explanation"],
            }
        )

    total = len(questions)
    score_pct = round(correct_count * 100 / total) if total else 0
    passed = score_pct >= CHECKPOINT_1_PASS_PCT
    if passed:
        badge_title = "Foundation Ready" if active == "en" else "Fundamenty Opanowane"
    else:
        badge_title = "Keep practising" if active == "en" else "Warto powtórzyć"

    return {
        "score_pct": score_pct,
        "passed": passed,
        "correct_count": correct_count,
        "total_questions": total,
        "reward_xp": CHECKPOINT_1_REWARD_XP if passed else 0,
        "badge_title": badge_title,
        "results": results,
    }


def get_post_14_paths(lang: Language = "en") -> list[dict]:
    """4 moduły „After Day 14 — Continuous Learning” w danym języku."""
    active = _normalize_lang(lang)
    source = POST_14_PATHS_EN if active == "en" else POST_14_PATHS
    return [dict(path) for path in source]


_LEVEL_TITLES_EN: dict[str, str] = {
    "Świadomy Start": "Confident Start",
    "Obserwator": "Observer",
    "Konsekwentny Start": "Steady Builder",
}
_LEVEL_TITLES_PL: dict[str, str] = {
    "Confident Start": "Świadomy Start",
    "Observer": "Obserwator",
    "Steady Builder": "Konsekwentny Start",
}


def _translate_level_title(title: str, lang: Language) -> str:
    """Tłumaczy tytuł poziomu dwukierunkowo w locie (bez modyfikowania wierszy bazy)."""
    table = _LEVEL_TITLES_EN if lang == "en" else _LEVEL_TITLES_PL
    return table.get(title, title)


def build_leaderboard(
    db_rows: list[dict],
    user_xp: int,
    user_level_title: str,
    leveled_up: bool,
    lang: Language = "en",
) -> list[LeaderboardEntry]:
    """Łączy seed rankingu z wierszem użytkownika i nadaje pozycje (malejąco po XP)."""
    active = _normalize_lang(lang)
    entries = [
        {
            "name": str(row.get("name", "")),
            "level_title": _translate_level_title(str(row.get("level_title", "")), active),
            "xp": _as_int(row.get("xp"), 0),
            "streak_days": _as_int(row.get("streak_days"), 1),
            "is_current_user": False,
        }
        for row in (db_rows or [])
    ]

    if active == "en":
        user_name = "You (Level Up!)" if leveled_up else "You"
    else:
        user_name = "Ty (Awans!)" if leveled_up else "Ty"

    entries.append(
        {
            "name": user_name,
            "level_title": _translate_level_title(user_level_title, active),
            "xp": _as_int(user_xp, 0),
            "streak_days": 1,
            "is_current_user": True,
        }
    )

    entries.sort(key=lambda entry: entry["xp"], reverse=True)

    return [
        LeaderboardEntry(rank=rank, **entry) for rank, entry in enumerate(entries, start=1)
    ]
