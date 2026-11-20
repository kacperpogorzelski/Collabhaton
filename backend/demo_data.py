"""Dane demo Finance Quest (SSOT v3) — persony, filtr Speakly, mapa 14 dni,
mikro-lekcje, bloki kroków misji Dnia 1, wyzwania, checklista i szkic bankowy.

Wszystkie funkcje są synchroniczne (``def``) i nie importują SQLAlchemy.
Treści pochodzą 1:1 z ``docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`` §6–§9;
szablony zawierają placeholdery uzupełniane przez ``.format(**session_facts)``.
"""

from __future__ import annotations

import random

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


def _format_value(value: object) -> object:
    """Grupuje tysiące spacją (np. ``33 844``) — zgodnie z przykładem docs/02 §6."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return f"{value:,}".replace(",", " ")
    return value


def _format_values(session_facts: dict | None) -> dict:
    """Buduje mapę wartości do ``.format()``: fakty sesji + domyślne + ``plan_sentence``."""
    raw = dict(_DEFAULT_FACTS)
    for key, value in (session_facts or {}).items():
        if value is not None:
            raw[key] = value

    if not session_facts or session_facts.get("training_etf_monthly") is None:
        raw["training_etf_monthly"] = (
            0 if str(raw.get("plan_type", "split")) == "savings_first" else raw["recommended_monthly"]
        )

    values = {key: _format_value(value) for key, value in raw.items()}
    plan_type = str(raw.get("plan_type", "split"))
    template = PLAN_SENTENCE.get(plan_type, PLAN_SENTENCE["split"])
    values["plan_sentence"] = template.format(**values)
    return values


def _select_step_block(step: int, session_facts: dict | None) -> dict:
    facts = session_facts or {}
    if step == 1:
        age_group = str(facts.get("age_group", "20+"))
        return STEP1_BY_AGE_GROUP.get(age_group, STEP1_BY_AGE_GROUP["20+"])
    if step == 2:
        concern = str(facts.get("main_concern", "freeze_money"))
        return STEP2_BY_CONCERN.get(concern, STEP2_BY_CONCERN["freeze_money"])
    if step == 3:
        return STEP3
    raise ValueError("Krok misji musi być liczbą 1, 2 lub 3")


def _as_int(value: object, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# Funkcje publiczne
# --------------------------------------------------------------------------- #


def get_age_group_content(age_group: str) -> dict:
    """Zwraca filtr Speakly, mapę 14 dni i mikro-lekcje dla grupy wiekowej."""
    key = age_group if age_group in SPEAKLY_FILTER_BY_GROUP else "20+"
    return {
        "speakly_filter": SPEAKLY_FILTER_BY_GROUP[key],
        "roadmap": ROADMAP_BY_GROUP[key],
        "micro_lessons": MICRO_LESSONS_BY_GROUP[key],
    }


def get_step_block(step: int, session_facts: dict) -> dict:
    """Zwraca blok kroku z podstawionymi faktami sesji (stałe nie są mutowane)."""
    values = _format_values(session_facts)
    block = _select_step_block(step, session_facts)

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


def get_level_state(xp: int) -> tuple[int, str, int]:
    """Zwraca ``(level, level_title, next_level_xp)`` dla danej liczby XP."""
    if xp >= 100:
        return 2, "Świadomy Start", 250
    return 1, "Obserwator", 100


def get_initial_mission_turn(session_facts: dict) -> tuple[MissionTurnResponse, list[dict]]:
    """Buduje turę startową Kroku 1 oraz opcje do zapisania w ``current_options``."""
    facts = session_facts or {}
    block = get_step_block(1, facts)

    session_id = facts.get("session_id") or facts.get("id") or "demo-session"
    options = shuffle_options(block["options"], session_id, 1)

    confidence_start = _as_int(facts.get("confidence_start"), 10)
    xp = _as_int(facts.get("xp"), 20)
    level, level_title, next_level_xp = get_level_state(xp)

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


def get_real_world_challenge(has_emergency_fund: bool, age_group: str) -> RealWorldChallenge:
    """Mikro-wyzwanie Dnia 1: 5 zł (bez poduszki lub 20+) albo 50 zł (z poduszką, 30-50/50+)."""
    if not has_emergency_fund or age_group == "20+":
        return RealWorldChallenge(
            title="Realne wyzwanie Dnia 1: Wpłać 5 zł na konto oszczędnościowe",
            description=(
                "Zanim za 2 tygodnie ruszysz z pełnym planem, przełam dziś barierę pierwszego "
                "przelewu symboliczną kwotą 5 zł i zacznij swoją serię!"
            ),
            amount_pln=5,
            target_account="Konto Oszczędnościowe Commerzbank",
            reward_xp=50,
        )
    return RealWorldChallenge(
        title="Realne wyzwanie Dnia 1: Przelej próbne 50 zł na subkonto startowe",
        description=(
            "Masz już poduszkę! Wykonaj dziś symboliczny, bezstresowy przelew testowy 50 zł, "
            "aby oswoić pierwszy krok przed docelowym planem w Dniu 14."
        ),
        amount_pln=50,
        target_account="Subkonto Inwestycyjne Commerzbank",
        reward_xp=50,
    )


def get_final_checklist(session_facts: dict) -> list[ChecklistItem]:
    """4-punktowa checklista Dnia 1 (``chk_1`` wg planu, ``chk_3`` wg obawy)."""
    facts = session_facts or {}
    values = _format_values(facts)

    plan_type = str(facts.get("plan_type", "split"))
    concern = str(facts.get("main_concern", "freeze_money"))

    if plan_type == "invest":
        chk_1 = ChecklistItem(
            id="chk_1",
            text="Mam przykładową kwotę docelową: {recommended_monthly} zł/mies.".format(**values),
            detail="Kwota dopasowana do wolnych środków, przy zachowanej poduszce.",
        )
    elif plan_type == "savings_first":
        chk_1 = ChecklistItem(
            id="chk_1",
            text=(
                "Wiem, że najpierw buduję poduszkę: {emergency_savings_monthly} zł/mies. "
                "na konto oszczędnościowe."
            ).format(**values),
            detail="Do ETF wrócimy, gdy poduszka będzie gotowa — to rozsądny pierwszy krok.",
        )
    else:
        chk_1 = ChecklistItem(
            id="chk_1",
            text=(
                "Mam przykładowy plan startowy: {emergency_savings_monthly} zł/mies. na poduszkę "
                "i {training_etf_monthly} zł/mies. na trening w szeroki ETF."
            ).format(**values),
            detail="Najpierw bezpieczeństwo, potem inwestowanie — bez naruszania codziennego budżetu.",
        )

    chk_2 = ChecklistItem(
        id="chk_2",
        text="Rozumiem, że gotówka na zwykłym koncie traci realną wartość przez inflację.",
        detail=(
            "W horyzoncie {horizon_years} lat wpłaty na koncie 0% mają realnie ok. {cash_real_value} zł, "
            "a w szerokim ETF historycznie ok. {etf_real_value} zł (założenia edukacyjne)."
        ).format(**values),
    )

    concern_facts = {
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
    }
    chk_3_text, chk_3_detail = concern_facts.get(concern, concern_facts["freeze_money"])
    chk_3 = ChecklistItem(id="chk_3", text=chk_3_text, detail=chk_3_detail)

    chk_4 = ChecklistItem(
        id="chk_4",
        text=(
            "Wiem, że wahania (nawet -20%) są normalne — jutro na Dniu 2 ćwiczymy spokojne reagowanie."
        ),
        detail="Regularność w 14 dni buduje prawdziwą pewność siebie.",
    )

    return [chk_1, chk_2, chk_3, chk_4]


def get_bank_draft(session_facts: dict) -> BankDraft:
    """Szkic przykładowego planu bankowego (wartości realne + nominalne)."""
    facts = session_facts or {}

    return BankDraft(
        monthly_amount=_as_int(facts.get("recommended_monthly"), 200),
        horizon_years=_as_int(facts.get("horizon_years"), 15),
        instrument_category=INSTRUMENT_CATEGORY,
        projected_etf_real_value=_as_int(facts.get("etf_real_value"), 0),
        projected_etf_nominal_value=_as_int(facts.get("etf_nominal_value"), 0),
        projected_cash_real_value=_as_int(facts.get("cash_real_value"), 0),
        historical_win_rate=min(97, _as_int(facts.get("win_rate"), 90)),
        assumptions_text=ASSUMPTIONS_TEXT,
        costs_note=COSTS_NOTE,
    )


def get_final_message(session_facts: dict) -> str:
    """Finałowy komunikat Luny (dla ``savings_first`` z dopiskiem o poduszce)."""
    facts = session_facts or {}
    values = _format_values(facts)
    message = FINAL_MESSAGE.format(**values)
    if str(facts.get("plan_type", "")) == "savings_first":
        message = f"{message} {FINAL_MESSAGE_SAVINGS_FIRST_SUFFIX}"
    return message


def get_final_badge(session_facts: dict) -> str:
    """Badge zdarzenia w turze finałowej (``Dzień 1 ukończony • Cel: X lat``)."""
    return FINAL_BADGE.format(**_format_values(session_facts or {}))


def build_leaderboard(
    db_rows: list[dict],
    user_xp: int,
    user_level_title: str,
    leveled_up: bool,
) -> list[LeaderboardEntry]:
    """Łączy seed rankingu z wierszem użytkownika i nadaje pozycje (malejąco po XP)."""
    entries = [
        {
            "name": str(row.get("name", "")),
            "level_title": str(row.get("level_title", "")),
            "xp": _as_int(row.get("xp"), 0),
            "streak_days": _as_int(row.get("streak_days"), 1),
            "is_current_user": False,
        }
        for row in (db_rows or [])
    ]

    entries.append(
        {
            "name": "Ty (Awans!)" if leveled_up else "Ty",
            "level_title": user_level_title,
            "xp": _as_int(user_xp, 0),
            "streak_days": 1,
            "is_current_user": True,
        }
    )

    entries.sort(key=lambda entry: entry["xp"], reverse=True)

    return [
        LeaderboardEntry(rank=rank, **entry) for rank, entry in enumerate(entries, start=1)
    ]
