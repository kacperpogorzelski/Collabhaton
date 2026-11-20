# 03. SSOT Integracji AI Coacha (Luny), Mapy 14 Dni i Fallbacków

## 1. Plan szybkiej przeróbki istniejącego modułu Luny na codziennego AI Coacha (15–20 minut)

Z istniejącego projektu wirtualnego asystenta (Allegro, `C:\Projekty\AutoResponder_Allegro\src\autoresponder`) przenosimy wyłącznie wzorce połączenia z LLM oraz fail-safe walidacji JSON do pliku `backend/luna_service.py`:

* **ZACHOWUJEMY (i upraszczamy pod synchroniczne `def`):**

  * Wywołanie `load_dotenv()` przed odczytem zmiennych środowiskowych: `OPENAI_API_KEY`, `LUNA_MODEL` (domyślnie `"gpt-4o-mini"`, wspiera też `"gpt-6-luna"`), `LUNA_TIMEOUT_SECONDS` (domyślnie `8.0`).

  * Inicjalizację synchronicznego klienta `OpenAI(api_key=api_key, timeout=timeout, max_retries=0)` (brak ukrytych retry SDK na prezentacji, wyciszenie loggera `openai` do `WARNING`).

  * Wymuszenie ścisłego schematu JSON (`response_format={"type": "json_schema", "json_schema": {"name": "LunaLlmOutput", "schema": ..., "strict": True}}`), gdzie model Pydantic `LunaLlmOutput` **MUSI** mieć `model_config = ConfigDict(extra="forbid")` (generuje `additionalProperties: false` i wszystkie pola w `required` — bez tego OpenAI API odrzuci request błędem `400`).

  * Warunkowe przekazywanie `reasoning_effort="none"` **wyłącznie** wtedy, gdy `model == "gpt-6-luna"`.

  * Przekazywanie krótkiej listy `messages` (`system` + ostatnie max 6 wpisów z `session_data["history"]` + bieżący `user_message`) oraz sprawdzanie `choice.message.refusal` / `finish_reason != "stop"` wzorem `openai_adapter.py` i bezpiecznej klasyfikacji błędów bez logowania promptów ani klucza.

* **USUWAMY:**

  * Całą logikę Allegro, pobieranie aukcji/zamówień, stare bazy danych SQLite/Alembic, workera/outboxa, Discorda, RAG, wyszukiwanie produktów oraz cały moduł cennika tokenowego (`_usage_metrics`, `Decimal`).

* **DODAJEMY (OBOWIĄZKOWY BEZPIECZNIK NA DEMO):**

  * Całe wywołanie LLM owinięte w `try ... except Exception:`.

  * Jeśli API przekroczy `8 sekund`, zwróci błąd sieci, odmowę (`refusal`), zły JSON albo brak/błędny klucz w `.env` -> `luna_service.py` natychmiast zwraca gotowy, dopracowany obiekt `MissionTurnResponse` zbudowany na bazie `get_fallback_turn()` z `demo_data.py` dla `(age_group, answered_step)` uzupełniony o realne liczby użytkownika!

## 2. Maszyna Stanów Misji Dnia 1 i Realistyczna Progresja (Zawsze 3 kroki)

Stan sesji jest przechowywany w PostgreSQL w tabeli `sessions` (`backend/models.py` -> `MissionSession`). Do synchronicznej funkcji `luna_service.process_mission_turn(session_data: dict, user_message: str, leaderboard_rows: list[dict] | None = None) -> MissionTurnResponse` `main.py` przekazuje słownik z polami sesji wczytanymi z bazy:

```python
{
    "session_id": str,
    "age": int,
    "age_group": "20+" | "30-50" | "50+",
    "has_emergency_fund": bool,
    "recommended_monthly": int,
    "horizon_years": int,
    "etf_future_value": int,
    "cash_real_value": int,
    "win_rate": int,
    "current_step": 1,       # wartości w bazie: 1, 2 lub 3 (nigdy 4)
    "confidence_score": 10,  # 10 -> 20 -> 30 -> 40
    "xp": 20,                # 20 -> 60 -> 95 -> 155
    "history": [             # format OpenAI messages; do LLM przekazuj ostatnie max 6 wpisów
        {"role": "assistant", "content": "..."},
        {"role": "user", "content": "..."},
    ],
}
```

*(Dzięki takiemu rozdzieleniu Osoba 2 pracująca nad `luna_service.py` nie importuje SQLAlchemy — zapisem do PostgreSQL zajmuje się wyłącznie `backend/main.py` Osoby 1!)*

### Wiążąca wartość `portfolio_status.simulated_value` i reguły bezpieczeństwa odpowiedzi LLM

* **Wartość portfela symulacji (`simulated_value`):**
  * **Krok 1 (Start):** `recommended_monthly`
  * **Krok 2 (po 6 mies.):** `half_year_value = int(round(recommended_monthly * (((1 + 0.08/12) ** 6 - 1) / (0.08/12))))`
  * **Krok 3 oraz Finał Dnia 1:** `etf_future_value`
* **Twarde reguły nadpisywania w Pythonie (ochrona UI przed halucynacjami LLM):**
  * Gdy `answered_step == 3` (finał): w Pythonie **ZAWSZE** nadpisuj `step_number = 3`, `quick_replies = []`, `mission_completed = True`, `trigger_confetti = True`, `confidence_score = 40`, `xp = 155`, `level = 2`, `leveled_up = True`.
  * Gdy `answered_step in (1, 2)` i LLM zwróci puste `quick_replies` (lub `< 2` opcje): podmień `quick_replies` z fallbacku w `demo_data.py`, aby użytkownik nigdy nie został bez przycisków wyboru.
  * Gdy sesja ma już `current_step == 3` i `confidence_score >= 40`: zwróć idempotentnie odpowiedź finałową bez podnoszenia `step_number` powyżej `3`.

### Logika przejść, realistycznej gotowości (`10% -> 40%`), XP i awansu w `POST /api/mission/turn`:

1. **Start Dnia 1 (zwracany już w `onboarding/analyze` i zapisany w PostgreSQL):**

   * `step_number = 1`, `confidence_score = 10` (punkt wyjścia w Dniu 1 z 14), `gamification = {level: 1, level_title: "Obserwator", xp: 20, next_level_xp: 100, xp_gained: 20, leveled_up: False, streak_days: 1}`.

2. **Po odpowiedzi na Krok 1 (`session["current_step"] == 1` -> przejście do Kroku 2):**

   * `confidence_score = 20` (`confidence_delta = +10`), `xp = 60` (`xp_gained = 40`), `level = 1`, `leveled_up = False`.

3. **Po odpowiedzi na Krok 2 (`session["current_step"] == 2` -> przejście do Kroku 3):**

   * `confidence_score = 30` (`confidence_delta = +10`), `xp = 95` (`xp_gained = 35`), `level = 1`, `leveled_up = False`.

4. **Po odpowiedzi na Krok 3 (`session["current_step"] == 3` -> UKOŃCZENIE DNIA 1 I AWANS):**

   * Backend **deterministycznie** (zawsze, niezależnie od LLM!) ustawia:

     * `confidence_score = 40` (`confidence_delta = +10` — łącznie realistyczne `+30%` gotowości po pierwszym dniu z 14!)

     * `gamification = {level: 2, level_title: "Świadomy Start", xp: 155, next_level_xp: 250, xp_gained: 60, leveled_up: True, streak_days: 1}`

     * `mission_completed = True`, `trigger_confetti = True`, `quick_replies = []`

     * Dokleja: `real_world_challenge`, `leaderboard` (zbudowany z rekordów pobranych z PostgreSQL + wynik użytkownika), `final_checklist`, `bank_draft`.

## 3. Gotowy System Prompt dla Codziennego AI Coacha Luny (`LUNA_SYSTEM_PROMPT`)

```
Jesteś Luna — nowoczesny, ciepły i ultrakonkretny codzienny AI Coach finansowy w aplikacji Finance Quest (wzorowanej na metodologii Speakly).
Prowadzisz użytkownika przez 14-dniowy program budowania pewności inwestycyjnej (5–10 minut dziennie). Obecnie realizujecie DZIEŃ 1 z 14.
Twoim celem jest maksymalny stosunek zdobytej wiedzy do poświęconego czasu poprzez życiową symulację wyborów, bez nierealnych obietnic „zostań ekspertem w 5 minut” — budujesz solidny nawyk dzień po dniu.

DANE UŻYTKOWNIKA (LICZBY OBLICZONE PRZEZ SYSTEM — UŻYWAJ DOKŁADNIE TYCH WARTOŚCI, NIE LICZ SAMODZIELNIE):
- Grupa wiekowa: {age_group} (wiek: {age} lat)
- Docelowa bezpieczna kwota miesięczna: {recommended_monthly} zł
- Domyślny horyzont: {horizon_years} lat
- Symulowana wartość szerokiego ETF po {horizon_years} latach: {etf_future_value} zł
- Realna siła nabywcza tej samej gotówki na koncie po inflacji: {cash_real_value} zł
- Historyczny odsetek okresów z zyskiem po {horizon_years} latach: {win_rate}%

ZADANIE NA TĘ TURĘ (DZIEŃ 1 Z 14):
- Użytkownik właśnie podjął decyzję w Kroku {answered_step} z 3 dzisiejszej symulacji.
- Teraz oceniasz jego wybór i prowadzisz do Kroku {next_step} z 3 (lub gratulujesz ukończenia Dnia 1 i awansu na Poziom 2, jeśli answered_step == 3).

KONKRETNA SYMULACJA WYBORÓW DLA GRUPY "{age_group}":
- Dla "20+":
  * Krok 2 (test płynności): Przewijamy w symulacji o 6 miesięcy (masz ok. {half_year_value} zł w ETF). Psuje się laptop i potrzebujesz części pieniędzy. Sprawdź, czy użytkownik wie, że środki w ETF NIE są zamrożone na stałe i można je wypłacić w kilka dni.
  * Krok 3 (efekt skali): Przewiń o {horizon_years} lat. Pokaż efekt skali w młodym wieku: {etf_future_value} zł w ETF vs {cash_real_value} zł realnie na zwykłym koncie po inflacji (historycznie {win_rate}% okresów z zyskiem). Zapytaj, czy zamyka Dzień 1 i odbiera awans.
- Dla "30-50":
  * Krok 2 (test spokoju i czasu): Przewijamy o 6 miesięcy (masz ok. {half_year_value} zł w ETF). W pracy brak czasu na śledzenie giełdy, rynek spadł o -10%, ale masz oddzielną poduszkę rodzinną. Sprawdź, czy trzyma automatyczny plan w tle bez paniki.
  * Krok 3 (czas bez stresu): Przewiń o {horizon_years} lat: {etf_future_value} zł w ETF vs {cash_real_value} zł po inflacji ({win_rate}% okresów na plusie). Zapytaj o zamknięcie Dnia 1 i odbiór awansu.
- Dla "50+":
  * Krok 2 (ochrona przed inflacją): Przewijamy o 6 miesięcy (masz ok. {half_year_value} zł w ETF). Inflacja zjada gotówkę na koncie, a ETF chwilowo waha się o -6%. Sprawdź, czy pamięta, że inwestować można w każdym wieku i horyzont {horizon_years} lat chroni kapitał.
  * Krok 3 (każdy wiek jest dobry): Przewiń o {horizon_years} lat: {etf_future_value} zł vs {cash_real_value} zł po inflacji ({win_rate}% na plusie). Zapytaj o zamknięcie Dnia 1 i bezpieczne podsumowanie.

TWARDE REGUŁY STYLU (SPEAKLY + CODZIENNY AI COACH):
1. ZWIĘZŁOŚĆ: "understanding_feedback" MAX 1–2 krótkie zdania. "luna_message" MAX 2–3 krótkie zdania. ZERO ścian tekstu!
2. OCENA WYBORU: W "understanding_feedback" odnieś się wprost do decyzji użytkownika (pochwal dobry refleks lub ciepło naprostuj błędny w 1 zdaniu).
3. JĘZYK: Naturalny, motywujący polski, zero angielskiego żargonu. Dla "50+" mów spokojnie i klarownie.
4. COMPLIANCE: Nie obiecuj gwarantowanego zysku i nie podawaj nazw konkretnych tickerów. Mów o "szerokich funduszach ETF" i "danych historycznych".
5. Jeśli answered_step == 3: pogratuluj ukończenia Dnia 1 z 14, awansu na Poziom 2 ("Świadomy Start") i wzrostu gotowości do 40%. Zachęć do zrobienia dziś małego realnego wyzwania startowego i powrotu jutro po Dzień 2 (utrzymanie serii).

WYMAGANY FORMAT WYJŚCIOWY (WYŁĄCZNIE CZYSTY JSON):
{{
  "understanding_feedback": "Krótka ocena wyboru użytkownika (1-2 zdania).",
  "luna_message": "Krótki scenariusz kolejnego kroku lub gratulacje ukończenia Dnia 1 (2-3 zdania).",
  "quick_replies": ["Krótki wybór 1", "Krótki wybór 2", "Krótki wybór 3"],
  "event_badge": "Krótki tag zdarzenia (max 4 słowa)",
  "trigger_confetti": true
}}

```

## 4. Dane do `backend/demo_data.py` (Persony, Filtr Speakly, Mapa 14 Dni, Mikro-lekcje, Wyzwania 5 zł, Seed Rankingu i Fallbacki)

### 0. Persony Demo (`DEMO_PERSONAS`) i Filtr Speakly (`SPEAKLY_FILTER_BY_GROUP`)

* **`DEMO_PERSONAS: list[DemoPersona]`:**
  1. `id="young_20"`, `short_label="22 l. Student"`, `full_label="22 l. • Student (Start od zera)"`, `age=22`, `net_income=4500`, `free_cash=1000`, `has_emergency_fund=False`
  2. `id="mid_38"`, `short_label="38 l. Rodzina"`, `full_label="38 l. • Kariera i Rodzina"`, `age=38`, `net_income=11000`, `free_cash=2500`, `has_emergency_fund=True`
  3. `id="senior_56"`, `short_label="56 l. 50+"`, `full_label="56 l. • Ochrona Kapitału 50+"`, `age=56`, `net_income=9500`, `free_cash=3000`, `has_emergency_fund=True`

* **`SPEAKLY_FILTER_BY_GROUP: dict[AgeGroup, SpeaklyFilter]`** (spójny 1:1 z tabelą pokoleń w `01_PRODUCT_AND_GUI_SPEC.md` §3):
  * `"20+"`: `time_saved_hours=3.5`, `kept_topics=["Inflacja zjada gotówkę", "Płynność ETF (wypłata w 2–3 dni)", "Efekt skali od małych kwot"]`, `removed_topics=["Analiza sprawozdań finansowych", "Derywaty i opcje", "Optymalizacja podatkowa", "Obligacje emerytalne", "Day-trading", "Wybór pojedynczych akcji", "Strategie przedemerytalne"]`
  * `"30-50"`: `time_saved_hours=4.0`, `kept_topics=["Inflacja zjada oszczędności", "Automatyzacja w tle bez wykresów", "Oddzielenie poduszki od inwestycji"]`, `removed_topics=["Day-trading", "Spekulacja krypto", "Analiza techniczna", "Podstawy obsługi konta", "Krótkoterminowy forex", "Opcje", "Lewarowanie"]`
  * `"50+"`: `time_saved_hours=3.5`, `kept_topics=["Inwestować można w każdym wieku", "Tarcza antyinflacyjna kapitału", "Prostota i globalna dywersyfikacja"]`, `removed_topics=["Agresywne strategie na 30 lat", "Dźwignia finansowa", "Kryptowaluty", "Startupy wysokiego ryzyka", "Day-trading", "Spekulacja opcjami", "Spółki memowe"]`

### A. 14-Dniowa Mapa Postępu (`ROADMAP_BY_GROUP`)

Każda grupa otrzymuje listę 4 obiektów `RoadmapMilestone`:

* **Dla `20+`:**

  1. `day=1`, `title="Inflacja, płynność i start"`, `focus="Dziś: 5 min • Przełamanie mitu zamrożonej kasy"`, `status="active"`

  2. `day=4`, `title="Symulator pierwszego spadku -15%"`, `focus="Trening zimnej krwi na realnych wykresach"`, `status="locked"`

  3. `day=9`, `title="Jak wybrać tani, szeroki ETF?"`, `focus="Opłaty (TER) i proste zasady dywersyfikacji"`, `status="locked"`

  4. `day=14`, `title="Twoja pierwsza inwestycja"`, `focus="Gotowość 100% • Uruchomienie planu w Commerzbanku"`, `status="locked"`

* **Dla `30-50`:**

  1. `day=1`, `title="Inflacja i inwestowanie w tle"`, `focus="Dziś: 5 min • Poduszka osobno, nadwyżki osobno"`, `status="active"`

  2. `day=4`, `title="Automatyzacja bez patrzenia w wykresy"`, `focus="Zlecenia stałe i oszczędność czasu"`, `status="locked"`

  3. `day=9`, `title="Bezpieczne proporcje dla rodziny"`, `focus="Łączenie szerokiego ETF z bezpieczną częścią"`, `status="locked"`

  4. `day=14`, `title="Start automatycznego planu ETF"`, `focus="Gotowość 100% • Konfiguracja w Commerzbanku"`, `status="locked"`

* **Dla `50+`:**

  1. `day=1`, `title="Tarcza antyinflacyjna w każdym wieku"`, `focus="Dziś: 5 min • Dlaczego gotówka na koncie traci"`, `status="active"`

  2. `day=4`, `title="Spokojne reagowanie na wahania"`, `focus="Jak horyzont 7 lat wygładza spadki rynku"`, `status="locked"`

  3. `day=9`, `title="Prosty portfel ochrony kapitału"`, `focus="Niskie koszty, przejrzystość i bezpieczeństwo"`, `status="locked"`

  4. `day=14`, `title="Świadomy start w Commerzbanku"`, `focus="Gotowość 100% • Bezstresowe uruchomienie planu"`, `status="locked"`

### B. 3 Mikro-Lekcje Dnia 1 w pigułce (`MICRO_LESSONS_BY_GROUP`)
Każda karta używa modelu `MicroLessonCard` (`duration_sec=20`, `xp_reward=15`) z wiążącymi identyfikatorami `"ml_20_1".."ml_20_3"`, `"ml_30_1".."ml_30_3"`, `"ml_50_1".."ml_50_3"`:

* **Dla `20+`:**

  1. `Inflacja zjada gotówkę` (`20 sek.`): *„Pieniądze leżące na zwykłym koncie 0% co roku kupią mniej przez inflację.”* -> takeaway: *„Brak decyzji to pewna strata siły nabywczej.”*

  2. `Twoje pieniądze nie są zamrożone` (`20 sek.`): *„Szeroki ETF to nie lokata na kłódkę — możesz go sprzedać i wypłacić pieniądze na konto w 2–3 dni robocze.”* -> takeaway: *„Masz pełną płynność w nagłej sytuacji.”*

  3. `Magia skali w młodym wieku` (`20 sek.`): *„Startując w wieku 20+, nawet małe kwoty (np. 200–300 zł) pracują przez dekady dzięki procentowi składanemu.”* -> takeaway: *„Czas jest ważniejszy niż wielki kapitał na starcie.”*

* **Dla `30-50`:**

  1. `Inflacja zjada oszczędności` (`20 sek.`): *„Trzymanie nadwyżek na nieoprocentowanym koncie systematycznie obniża ich realną wartość.”* -> takeaway: *„Nadwyżki powinny pracować szybciej niż inflacja.”*

  2. `Inwestowanie w tle (bez wykresów)` (`20 sek.`): *„Szeroki ETF inwestuje w setki firm naraz i nie wymaga codziennego śledzenia giełdy.”* -> takeaway: *„Oszczędzasz czas — system działa automatycznie.”*

  3. `Poduszka osobno, inwestycje osobno` (`20 sek.`): *„Bezpieczeństwo rodziny chroni poduszka gotówkowa; na rynek kierujesz tylko wolne nadwyżki.”* -> takeaway: *„Śpisz spokojnie nawet przy chwilowych spadkach.”*

* **Dla `50+`:**

  1. `Inwestować można w każdym wieku` (`20 sek.`): *„Horyzont 5–10 lat to nadal świetny czas, by kapitał mądrze pracował bez podejmowania zbędnego ryzyka.”* -> takeaway: *„Nigdy nie jest za późno na świadomy start.”*

  2. `Tarcza przed inflacją` (`20 sek.`): *„Gotówka na zwykłym koncie traci siłę nabywczą każdego roku, co najbardziej boli przy większym dorobku.”* -> takeaway: *„Szeroki ETF historycznie pomaga chronić wartość pieniędzy.”*

  3. `Prostota i dywersyfikacja` (`20 sek.`): *„Zamiast ryzykować w jednej firmie, szeroki ETF rozkłada kapitał na cały globalny rynek.”* -> takeaway: *„Mniejsze ryzyko, niskie opłaty i pełna przejrzystość.”*

### C. Realne Mikro-Wyzwanie na Dzień 1 (`get_real_world_challenge`)

* Jeśli `has_emergency_fund is False` lub `age_group == "20+"`:

  * `title`: `"Realne wyzwanie Dnia 1: Wpłać 5 zł na konto oszczędnościowe"`

  * `description`: `"Zanim za 2 tygodnie ruszysz z pełnym planem ETF, przełam dziś barierę pierwszego przelewu symboliczną kwotą 5 zł i zacznij swoją serię!"`

  * `amount_pln`: `5`

  * `target_account`: `"Konto Oszczędnościowe Commerzbank"`

  * `reward_xp`: `50`

* Jeśli `has_emergency_fund is True` i `age_group in ("30-50", "50+")`:

  * `title`: `"Realne wyzwanie Dnia 1: Przelej próbne 50 zł na subkonto startowe"`

  * `description`: `"Masz już poduszkę! Wykonaj dziś symboliczny, bezstresowy przelew testowy 50 zł, aby oswoić pierwszy krok przed docelowym planem ETF w Dniu 14."`

  * `amount_pln`: `50`

  * `target_account`: `"Subkonto Inwestycyjne Commerzbank"`

  * `reward_xp`: `50`

### D. Dane seedowe Rankingu Znajomych (`SEED_LEADERBOARD` i `build_leaderboard`)

Rekordy wrzucane do tabeli PostgreSQL `leaderboard_entries` przez `init_db()` przy pierwszym starcie:

1. `{"name": "Kasia K.", "level_title": "Świadomy Start", "xp": 210, "streak_days": 5}`

2. `{"name": "Tomek W.", "level_title": "Obserwator", "xp": 95, "streak_days": 2}`

3. `{"name": "Marek Z.", "level_title": "Obserwator", "xp": 40, "streak_days": 1}`

Funkcja pomocnicza `build_leaderboard(db_rows: list[dict], user_xp: int, user_level_title: str = "Świadomy Start") -> list[LeaderboardEntry]` łączy rekordy z bazy z wierszem `{"name": "Ty (Awans!)", "level_title": user_level_title, "xp": user_xp, "streak_days": 1, "is_current_user": True}`, sortuje malejąco po `xp` i nadaje `rank: 1..N`.

### D2. Pozostałe wiążące funkcje eksportowane przez `backend/demo_data.py`
* `get_initial_mission_turn(age_group: AgeGroup, recommended_monthly: int) -> MissionTurnResponse` — zwraca Krok 1 startowy Dnia 1 (`confidence_score=10`, `xp=20`, `simulated_value=recommended_monthly`).
* `get_final_checklist(age_group: AgeGroup, recommended_monthly: int, horizon_years: int) -> list[ChecklistItem]` — zwraca 4 pozycje `chk_1`..`chk_4` (wzór z `02_TECH_API_AND_MATH.md` §6, gdzie `chk_3` adresuje główny lęk generacji: płynność 2–3 dni dla `20+`, automatyzacja w tle bez patrzenia w wykresy dla `30-50`, spokojny horyzont `{horizon_years} lat` i brak limitu wieku dla `50+`).
* `get_fallback_turn(session_data: dict, answered_step: int) -> dict` — zwraca słownik 5 pól (`understanding_feedback`, `luna_message`, `quick_replies`, `event_badge`, `trigger_confetti`) dla kroku po odpowiedzi użytkownika (`answered_step=1` -> Krok 2, `2` -> Krok 3, `3` -> Finał Dnia 1). **UWAGA:** funkcja musi wywołać `.format(**ctx)` również dla każdego elementu `quick_replies`, ponieważ w grupie `50+` (Krok 2) jedna z szybkich odpowiedzi zawiera placeholder `{horizon_years}`!

### E. Kompletne Fallbacki i Kroki Startowe Symulacji Dnia 1

* **Grupa `20+` (`young_20`: 22 l., 4500 zł netto, 1000 zł wolne, brak poduszki):**

  * **Krok 1 (Start Dnia 1):** *"Cześć! Jestem Luna, Twój codzienny AI Coach. Zaczynamy Dzień 1 z 14! Przy docelowej kwocie {recommended_monthly} zł/mies. szeroki ETF rozkłada pieniądze na setki firm naraz zamiast zgadywania jednej spółki. Co wybierasz w naszej pierwszej symulacji?"* | `quick_replies`: `["Szeroki ETF na cały rynek (dywersyfikacja)", "Kupno akcji jednej głośnej firmy", "Zostawiam całość na zwykłym koncie 0%"]` | `event_badge`: `"Dzień 1 • Start ({recommended_monthly} zł/mies.)"`

  * **Fallback Krok 2 (Test płynności — Laptop):** `understanding_feedback`: *"Świetny wybór! Dywersyfikacja w szerokim ETF chroni Cię przed wpadką pojedynczej spółki."* | `luna_message`: *"Przewijamy w symulacji o 6 miesięcy — masz już ok. {half_year_value} zł w ETF! Nagle psuje się laptop i potrzebujesz części środków. Wiele młodych osób boi się, że pieniądze są zamrożone na stałe. Co robisz?"* | `quick_replies`: `["Sprzedaję część ETF — wypłacam kasę w 2–3 dni robocze", "Nic nie zrobię, pieniądze są zablokowane na 15 lat", "Biorę drogą pożyczkę, bo ETF nie da się ruszyć"]` | `event_badge`: `"Nagły wydatek • Test płynności"`

  * **Fallback Krok 3 (Efekt skali):** `understanding_feedback`: *"Dokładnie! Pieniądze w ETF nie są zamrożone permanentnie — zawsze możesz je wypłacić."* | `luna_message`: *"Przewijamy o {horizon_years} lat! Dzięki startowi w młodym wieku Twoje {recommended_monthly} zł/mies. urosło historycznie do ok. {etf_future_value} zł, podczas gdy gotówka po inflacji byłaby warta realnie tylko {cash_real_value} zł ({win_rate}% okresów na plusie). Zamykamy Dzień 1 z awansem na Poziom 2?"* | `quick_replies`: `["Tak! Kończę Dzień 1 i biorę wyzwanie za 5 zł", "Efekt skali robi wrażenie — pokaż podsumowanie Dnia 1"]` | `event_badge`: `"Wehikuł czasu • +{horizon_years} lat"`

  * **Fallback Finał Dnia 1 (po odpowiedzi na Krok 3):** `understanding_feedback`: *"Świetny start! W 5 minut przełamałeś mit zamrożonej kasy i zobaczyłeś siłę procentu składanego."* | `luna_message`: *"Dzień 1 z 14 zaliczony i awansujesz na Poziom 2! Twoja gotowość wzrosła dziś do 40%. Zrób teraz małe realne wyzwanie za 5 zł i widzimy się jutro na Dniu 2!"* | `event_badge`: `"Dzień 1 ukończony • Gotowość 40%"`

* **Grupa `30-50` (`mid_38`: 38 l., 11000 zł netto, 2500 zł wolne, ma poduszkę):**

  * **Krok 1 (Start Dnia 1):** *"Cześć! Jestem Luna, Twój codzienny AI Coach — witaj w Dniu 1 z 14. Masz już poduszkę, więc Twoje docelowe {recommended_monthly} zł/mies. może pracować w szerokim ETF zupełnie w tle, bez śledzenia giełdy. Co cenisz w tym najbardziej?"* | `quick_replies`: `["Automatyzację i spokój bez patrzenia w wykresy", "Codzienne szukanie okazji na giełdzie", "Trzymanie wszystkich nadwyżek na koncie 0%"]` | `event_badge`: `"Dzień 1 • Start ({recommended_monthly} zł/mies.)"`

  * **Fallback Krok 2 (Spadek -10%):** `understanding_feedback`: *"W punkt! Pasywny ETF szanuje Twój czas i nie wymaga bycia analitykiem giełdowym."* | `luna_message`: *"Mija 6 miesięcy w symulacji, masz ok. {half_year_value} zł w ETF. W pracy urwanie głowy, media straszą spadkiem rynku o -10%, a Twoja poduszka rodzinna jest nienaruszona. Jaki jest Twój wybór?"* | `quick_replies`: `["Trzymam plan w tle — mam poduszkę i spokój", "Sprzedaję wszystko w panice ze stratą", "Zaczynam codziennie sprawdzać kursy w pracy"]` | `event_badge`: `"Spadek -10% • Test spokoju"`

  * **Fallback Krok 3 (Wynik w czasie):** `understanding_feedback`: *"Brawo! Oddzielenie poduszki od inwestycji chroni przed emocjonalnymi błędami."* | `luna_message`: *"Przewijamy o {horizon_years} lat! Bez zaglądania w wykresy Twoje {recommended_monthly} zł/mies. dało historycznie ok. {etf_future_value} zł zamiast {cash_real_value} zł realnie po inflacji ({win_rate}% szans bez straty). Zamykamy Dzień 1 i odbierasz awans?"* | `quick_replies`: `["Tak! Kończę Dzień 1 i odbieram awans", "Pokaż moje wyzwanie i podsumowanie Dnia 1"]` | `event_badge`: `"Wehikuł czasu • +{horizon_years} lat"`

  * **Fallback Finał Dnia 1 (po odpowiedzi na Krok 3):** `understanding_feedback`: *"Znakomicie! Widzisz już, że inwestowanie w tle nie zabiera czasu rodzinie ani pracy."* | `luna_message`: *"Dzień 1 z 14 zaliczony — awansujesz na Poziom 2, a Twoja gotowość rośnie do 40%! Zrób dziś próbne wyzwanie i wróć jutro po 5-minutowy Dzień 2."* | `event_badge`: `"Dzień 1 ukończony • Gotowość 40%"`

* **Grupa `50+` (`senior_56`: 56 l., 9500 zł netto, 3000 zł wolne, ma poduszkę):**

  * **Krok 1 (Start Dnia 1):** *"Dzień dobry! Jestem Luna, Twój codzienny AI Coach — zaczynamy spokojny, 14-dniowy plan. Inwestować można w każdym wieku, wystarczy dopasowany horyzont. Dlaczego przy kwocie {recommended_monthly} zł/mies. lepiej nie zostawiać wszystkiego na zwykłym koncie?"* | `quick_replies`: `["Bo inflacja co roku realnie zmniejsza wartość gotówki", "Bo na koncie gotówka nigdy nie traci na wartości", "Lepiej zainwestować całość w jedną ryzykowną spółkę"]` | `event_badge`: `"Dzień 1 • Start ({recommended_monthly} zł/mies.)"`

  * **Fallback Krok 2 (Wahanie -6%):** `understanding_feedback`: *"Dokładnie tak! Trzymanie całej gotówki na zwykłym koncie to pewna utrata siły nabywczej przez inflację."* | `luna_message`: *"Po 6 miesiącach w symulacji masz ok. {half_year_value} zł w szerokim ETF. Inflacja nadal działa, a rynek przejściowo drgnął o -6%. Twój horyzont to {horizon_years} lat, a poduszka jest bezpieczna. Jak reagujesz?"* | `quick_replies`: `["Zachowuję spokój — lekkie wahania w horyzoncie {horizon_years} lat są naturalne", "Wycofuję wszystko na zwykłe konto ze strachu", "Jestem za stary na inwestowanie, rezygnuję"]` | `event_badge`: `"Wahanie -6% • Ochrona kapitału"`

  * **Fallback Krok 3 (Każdy wiek jest dobry):** `understanding_feedback`: *"Dojrzała, spokojna decyzja! Konsekwencja to najlepsza tarcza ochronna przed inflacją."* | `luna_message`: *"Po {horizon_years} latach Twoje {recommended_monthly} zł/mies. urosło historycznie do ok. {etf_future_value} zł vs {cash_real_value} zł realnie po inflacji ({win_rate}% okresów na plusie). Wiek nie jest przeszkodą — zamykamy Dzień 1 z awansem na Poziom 2?"* | `quick_replies`: `["Tak, pokaż podsumowanie Dnia 1 i awans", "Zaczynamy — pokaż moje dzisiejsze wyzwanie"]` | `event_badge`: `"Wehikuł czasu • +{horizon_years} lat"`

  * **Fallback Finał Dnia 1 (po odpowiedzi na Krok 3):** `understanding_feedback`: *"Brawo za spokojne, rozsądne podejście! To najlepszy fundament przed pierwszą inwestycją."* | `luna_message`: *"Dzień 1 z 14 za nami — awansujesz na Poziom 2, a Twoja gotowość wzrosła do 40%. Zrób dziś spokojne mikro-wyzwanie startowe i widzimy się jutro na Dniu 2!"* | `event_badge`: `"Dzień 1 ukończony • Gotowość 40%"`