"""Dane demo Finance Quest (SSOT v3) — persony, filtr Speakly, mapa 14 dni,
mikro-lekcje, bloki kroków misji Dnia 1, wyzwania, checklista i szkic bankowy.

Wszystkie funkcje są synchroniczne (``def``) i nie importują SQLAlchemy.
Treści pochodzą 1:1 z ``docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`` §6–§9;
szablony zawierają placeholdery uzupełniane przez ``.format(**session_facts)``.
"""

from __future__ import annotations

import random
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
    """Zwraca ``"en"`` wyłącznie dla ``"en"``; każda inna wartość to ``"pl"``."""
    return "en" if str(lang or "").strip().lower() == "en" else "pl"


def _lang_of(session_facts: dict | None, lang: str | None = None) -> Language:
    """Jawny ``lang`` ma pierwszeństwo; inaczej ``session_facts["lang"]``, potem ``"pl"``."""
    if lang is not None:
        return _normalize_lang(lang)
    return _normalize_lang((session_facts or {}).get("lang"))

__all__ = [
    "DEMO_PERSONAS",
    "SEED_LEADERBOARD",
    "SPEAKLY_FILTER_BY_GROUP",
    "ROADMAP_BY_GROUP",
    "MICRO_LESSONS_BY_GROUP",
    "STEP1_BY_AGE_GROUP",
    "STEP2_BY_CONCERN",
    "STEP3",
    "PLAN_SENTENCE",
    "FINAL_MESSAGE",
    "FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX",
    "FINAL_BADGE",
    "ASSUMPTIONS_TEXT",
    "COSTS_NOTE",
    "INSTRUMENT_CATEGORY",
    "get_age_group_content",
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
# Mapa 14 dni — 4 kamienie milowe na grupę (Dzień 1 aktywny, reszta zablokowana)
# --------------------------------------------------------------------------- #

ROADMAP_BY_GROUP: dict[AgeGroup, list[RoadmapMilestone]] = {
    "20+": [
        RoadmapMilestone(
            day=1,
            title="Inflacja, płynność i start",
            focus="Dziś: 5 min • Przełamanie mitu zamrożonej kasy",
            status="active",
        ),
        RoadmapMilestone(
            day=4,
            title="Symulator pierwszego spadku -15%",
            focus="Trening zimnej krwi na realnych wykresach",
        ),
        RoadmapMilestone(
            day=9,
            title="Jak wybrać tani, szeroki ETF?",
            focus="Opłaty (TER) i proste zasady dywersyfikacji",
        ),
        RoadmapMilestone(
            day=14,
            title="Twoja pierwsza inwestycja",
            focus="Gotowość 100% • Uruchomienie planu w Commerzbanku",
        ),
    ],
    "30-50": [
        RoadmapMilestone(
            day=1,
            title="Inflacja i inwestowanie w tle",
            focus="Dziś: 5 min • Poduszka osobno, nadwyżki osobno",
            status="active",
        ),
        RoadmapMilestone(
            day=4,
            title="Automatyzacja bez patrzenia w wykresy",
            focus="Zlecenia stałe i oszczędność czasu",
        ),
        RoadmapMilestone(
            day=9,
            title="Bezpieczne proporcje dla rodziny",
            focus="Łączenie szerokiego ETF z bezpieczną częścią",
        ),
        RoadmapMilestone(
            day=14,
            title="Start automatycznego planu ETF",
            focus="Gotowość 100% • Konfiguracja w Commerzbanku",
        ),
    ],
    "50+": [
        RoadmapMilestone(
            day=1,
            title="Tarcza antyinflacyjna w każdym wieku",
            focus="Dziś: 5 min • Dlaczego gotówka na koncie traci",
            status="active",
        ),
        RoadmapMilestone(
            day=4,
            title="Spokojne reagowanie na wahania",
            focus="Jak horyzont 7 lat wygładza spadki rynku",
        ),
        RoadmapMilestone(
            day=9,
            title="Prosty portfel ochrony kapitału",
            focus="Niskie koszty, przejrzystość i bezpieczeństwo",
        ),
        RoadmapMilestone(
            day=14,
            title="Świadomy start w Commerzbanku",
            focus="Gotowość 100% • Bezstresowe uruchomienie planu",
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
            summary="Pieniądze leżące na zwykłym koncie 0% co roku kupią mniej przez inflację.",
            key_takeaway="Brak decyzji to pewna strata siły nabywczej.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_2",
            title="Poduszka na awarie, ETF na długi cel",
            duration_sec=20,
            summary=(
                "Na nagłe wydatki służy poduszka. ETF to pieniądze na długi horyzont — ale nie są "
                "zamrożone: w ostateczności sprzedasz jednostki, a wypłata zajmie zwykle kilka dni "
                "roboczych."
            ),
            key_takeaway="Wiesz, które pieniądze są do czego.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_3",
            title="Efekt skali od małych kwot",
            duration_sec=20,
            summary=(
                "Startując młodo, nawet małe kwoty (np. 100–300 zł) mogą pracować przez dekady "
                "dzięki procentowi składanemu."
            ),
            key_takeaway="Czas jest ważniejszy niż wielki kapitał na starcie.",
            xp_reward=15,
        ),
    ],
    "30-50": [
        MicroLessonCard(
            id="ml_30_1",
            title="Inflacja zjada oszczędności",
            duration_sec=20,
            summary="Trzymanie nadwyżek na nieoprocentowanym koncie systematycznie obniża ich realną wartość.",
            key_takeaway="Nadwyżki powinny pracować szybciej niż inflacja.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_2",
            title="Automatyzacja w tle bez wykresów",
            duration_sec=20,
            summary="Szeroki ETF inwestuje w setki firm naraz i nie wymaga codziennego śledzenia giełdy.",
            key_takeaway="Oszczędzasz czas — stały plan działa w tle.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_3",
            title="Poduszka osobno, nadwyżki osobno",
            duration_sec=20,
            summary="Bezpieczeństwo rodziny chroni poduszka; na rynek kierujesz tylko wolne nadwyżki.",
            key_takeaway="Spokojniej znosisz chwilowe spadki.",
            xp_reward=15,
        ),
    ],
    "50+": [
        MicroLessonCard(
            id="ml_50_1",
            title="Inwestować można w każdym wieku",
            duration_sec=20,
            summary="Horyzont 5–10 lat to nadal czas, by kapitał mądrze pracował bez zbędnego ryzyka.",
            key_takeaway="Nigdy nie jest za późno na świadomy start.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_2",
            title="Tarcza antyinflacyjna dla kapitału",
            duration_sec=20,
            summary=(
                "Gotówka na zwykłym koncie traci siłę nabywczą co roku, co najbardziej boli przy "
                "większym dorobku."
            ),
            key_takeaway="Szeroki ETF historycznie pomagał chronić wartość pieniędzy (bez gwarancji).",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_3",
            title="Prostota i dywersyfikacja",
            duration_sec=20,
            summary=(
                "Zamiast ryzykować w jednej firmie, szeroki ETF rozkłada kapitał na cały globalny rynek."
            ),
            key_takeaway="Mniejsza koncentracja ryzyka, niskie koszty, przejrzystość.",
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
            "Cześć! Jestem Luna, Twój codzienny AI Coach — zaczynamy Dzień 1 z 14! {plan_sentence} "
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
            "Cześć! Jestem Luna, Twój codzienny AI Coach — witaj w Dniu 1 z 14. {plan_sentence} "
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
            "Dzień dobry! Jestem Luna, Twój codzienny AI Coach — zaczynamy spokojny, 14-dniowy plan. "
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

ROADMAP_BY_GROUP_EN: dict[AgeGroup, list[RoadmapMilestone]] = {
    "20+": [
        RoadmapMilestone(
            day=1,
            title="Inflation, liquidity and getting started",
            focus="Today: 5 min • Breaking the frozen-cash myth",
            status="active",
        ),
        RoadmapMilestone(
            day=4,
            title="Simulator of your first -15% drop",
            focus="Practising a steady hand on real charts",
        ),
        RoadmapMilestone(
            day=9,
            title="How to choose a low-cost, broad ETF?",
            focus="Fees (TER) and simple diversification rules",
        ),
        RoadmapMilestone(
            day=14,
            title="Your first investment",
            focus="100% readiness • Launching the plan at Commerzbank",
        ),
    ],
    "30-50": [
        RoadmapMilestone(
            day=1,
            title="Inflation and investing in the background",
            focus="Today: 5 min • Buffer separately, surplus separately",
            status="active",
        ),
        RoadmapMilestone(
            day=4,
            title="Automation without watching charts",
            focus="Standing orders and saved time",
        ),
        RoadmapMilestone(
            day=9,
            title="Sensible proportions for a family",
            focus="Combining a broad ETF with a cash cushion",
        ),
        RoadmapMilestone(
            day=14,
            title="Start of the automatic ETF plan",
            focus="100% readiness • Setup at Commerzbank",
        ),
    ],
    "50+": [
        RoadmapMilestone(
            day=1,
            title="An anti-inflation shield at any age",
            focus="Today: 5 min • Why cash in an account loses value",
            status="active",
        ),
        RoadmapMilestone(
            day=4,
            title="Reacting calmly to volatility",
            focus="How a 7-year horizon smooths market drops",
        ),
        RoadmapMilestone(
            day=9,
            title="A simple capital-protection portfolio",
            focus="Low costs, transparency and peace of mind",
        ),
        RoadmapMilestone(
            day=14,
            title="A confident start at Commerzbank",
            focus="100% readiness • Stress-free plan launch",
        ),
    ],
}

MICRO_LESSONS_BY_GROUP_EN: dict[AgeGroup, list[MicroLessonCard]] = {
    "20+": [
        MicroLessonCard(
            id="ml_20_1",
            title="Inflation eats your cash",
            duration_sec=20,
            summary="Money sitting in a regular 0% account buys less every year because of inflation.",
            key_takeaway="Not deciding is a certain loss of purchasing power.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_2",
            title="Emergency buffer for surprises, ETF for the long term",
            duration_sec=20,
            summary=(
                "The buffer covers unexpected expenses. An ETF is money for the long horizon — but it "
                "is not frozen: as a last resort you can sell units, and the payout usually takes a "
                "few business days."
            ),
            key_takeaway="You know which money is for what.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_20_3",
            title="The power of scale from small amounts",
            duration_sec=20,
            summary=(
                "Starting young, even small amounts (e.g. 100–300 PLN) can work for decades thanks to "
                "compound interest."
            ),
            key_takeaway="Time matters more than a large starting capital.",
            xp_reward=15,
        ),
    ],
    "30-50": [
        MicroLessonCard(
            id="ml_30_1",
            title="Inflation eats your savings",
            duration_sec=20,
            summary=(
                "Keeping surplus in a non-interest-bearing account steadily lowers its real value."
            ),
            key_takeaway="Surplus should work faster than inflation.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_2",
            title="Background automation without charts",
            duration_sec=20,
            summary=(
                "A broad ETF invests in hundreds of companies at once and does not require tracking "
                "the market daily."
            ),
            key_takeaway="You save time — a steady plan runs in the background.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_30_3",
            title="Buffer separately, surplus separately",
            duration_sec=20,
            summary=(
                "The buffer protects your family's security; you only send free surplus to the market."
            ),
            key_takeaway="You handle temporary drops more calmly.",
            xp_reward=15,
        ),
    ],
    "50+": [
        MicroLessonCard(
            id="ml_50_1",
            title="You can invest at any age",
            duration_sec=20,
            summary=(
                "A 5–10 year horizon is still time for capital to work wisely without unnecessary risk."
            ),
            key_takeaway="It is never too late for a conscious start.",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_2",
            title="An anti-inflation shield for your capital",
            duration_sec=20,
            summary=(
                "Cash in a regular account loses purchasing power every year, which hurts most with "
                "larger savings."
            ),
            key_takeaway="A broad ETF has historically helped protect the value of money (no guarantee).",
            xp_reward=15,
        ),
        MicroLessonCard(
            id="ml_50_3",
            title="Simplicity and diversification",
            duration_sec=20,
            summary=(
                "Instead of betting on one company, a broad ETF spreads capital across the entire "
                "global market."
            ),
            key_takeaway="Lower concentration risk, low costs, transparency.",
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
            "Hi! I'm Luna, your daily AI Coach — we're starting Day 1 of 14! {plan_sentence} You "
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
            "Hi! I'm Luna, your daily AI Coach — welcome to Day 1 of 14. {plan_sentence} A passive "
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
            "Good day! I'm Luna, your daily AI Coach — we're starting a calm 14-day plan. You can "
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


def _format_value(value: object, lang: Language = "pl") -> object:
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


def _select_step_block(step: int, session_facts: dict | None, lang: Language = "pl") -> dict:
    facts = session_facts or {}
    if step == 1:
        table = STEP1_BY_AGE_GROUP_EN if lang == "en" else STEP1_BY_AGE_GROUP
        age_group = str(facts.get("age_group", "20+"))
        return table.get(age_group, table["20+"])
    if step == 2:
        table = STEP2_BY_CONCERN_EN if lang == "en" else STEP2_BY_CONCERN
        concern = str(facts.get("main_concern", "freeze_money"))
        return table.get(concern, table["freeze_money"])
    if step == 3:
        return STEP3_EN if lang == "en" else STEP3
    raise ValueError("Krok misji musi być liczbą 1, 2 lub 3")


def _as_int(value: object, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# Funkcje publiczne
# --------------------------------------------------------------------------- #


def get_demo_personas(lang: Language = "pl") -> list[DemoPersona]:
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


def get_age_group_content(age_group: str, lang: Language = "pl") -> dict:
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


def get_assumptions_text(lang: Language = "pl") -> str:
    """Tekst jawnych założeń edukacyjnych pod wykresem."""
    return ASSUMPTIONS_TEXT_EN if _normalize_lang(lang) == "en" else ASSUMPTIONS_TEXT


def get_costs_note(lang: Language = "pl") -> str:
    """Nota o kosztach, podatku i braku gwarancji."""
    return COSTS_NOTE_EN if _normalize_lang(lang) == "en" else COSTS_NOTE


def get_instrument_category(lang: Language = "pl") -> str:
    """Kategoria instrumentu w przykładowym planie."""
    return INSTRUMENT_CATEGORY_EN if _normalize_lang(lang) == "en" else INSTRUMENT_CATEGORY


def get_step_block(step: int, session_facts: dict, lang: Language | None = None) -> dict:
    """Zwraca blok kroku z podstawionymi faktami sesji (stałe nie są mutowane)."""
    active = _lang_of(session_facts, lang)
    values = _format_values(session_facts, active)
    block = _select_step_block(step, session_facts, active)

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


def shuffle_options(options: list[dict], session_id: str, step: int) -> list[dict]:
    """Deterministycznie tasuje KOPIĘ opcji dla pary ``(session_id, step)``."""
    shuffled = [dict(option) for option in options]
    random.Random(str(session_id) + str(step)).shuffle(shuffled)
    return shuffled


def get_level_state(xp: int, lang: Language = "pl") -> tuple[int, str, int]:
    """Zwraca ``(level, level_title, next_level_xp)`` dla danej liczby XP."""
    english = _normalize_lang(lang) == "en"
    if xp >= 100:
        return 2, ("Confident Start" if english else "Świadomy Start"), 250
    return 1, ("Observer" if english else "Obserwator"), 100


def get_initial_mission_turn(
    session_facts: dict, lang: Language | None = None
) -> tuple[MissionTurnResponse, list[dict]]:
    """Buduje turę startową Kroku 1 oraz opcje do zapisania w ``current_options``."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    block = get_step_block(1, facts, active)

    session_id = facts.get("session_id") or facts.get("id") or "demo-session"
    options = shuffle_options(block["options"], session_id, 1)

    confidence_start = _as_int(facts.get("confidence_start"), 10)
    xp = _as_int(facts.get("xp"), 20)
    level, level_title, next_level_xp = get_level_state(xp, active)

    response = MissionTurnResponse(
        step_number=1,
        total_steps=3,
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
    )
    return response, options


def get_real_world_challenge(
    has_emergency_fund: bool, age_group: str, lang: Language = "pl"
) -> RealWorldChallenge:
    """Mikro-wyzwanie Dnia 1: 5 PLN (bez poduszki lub 20+) albo 50 PLN (z poduszką, 30-50/50+)."""
    english = _normalize_lang(lang) == "en"
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


def get_final_message(session_facts: dict, lang: Language | None = None) -> str:
    """Finałowy komunikat Luny (dla ``savings_first`` z dopiskiem o poduszce)."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    values = _format_values(facts, active)

    if active == "en":
        message = FINAL_MESSAGE_EN.format(**values)
        if str(facts.get("plan_type", "")) == "savings_first":
            message = f"{message} {FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX_EN}"
        return message

    message = FINAL_MESSAGE.format(**values)
    if str(facts.get("plan_type", "")) == "savings_first":
        message = f"{message} {FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX}"
    return message


def get_final_badge(session_facts: dict, lang: Language | None = None) -> str:
    """Badge zdarzenia w turze finale (``Dzień 1 ukończony • Cel: X lat``)."""
    facts = session_facts or {}
    active = _lang_of(facts, lang)
    template = FINAL_BADGE_EN if active == "en" else FINAL_BADGE
    return template.format(**_format_values(facts, active))


_LEVEL_TITLES_EN: dict[str, str] = {
    "Świadomy Start": "Confident Start",
    "Obserwator": "Observer",
}


def _translate_level_title(title: str, lang: Language) -> str:
    """Tłumaczy tytuł poziomu w locie (bez modyfikowania wierszy bazy)."""
    if lang != "en":
        return title
    return _LEVEL_TITLES_EN.get(title, title)


def build_leaderboard(
    db_rows: list[dict],
    user_xp: int,
    user_level_title: str,
    leveled_up: bool,
    lang: Language = "pl",
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
