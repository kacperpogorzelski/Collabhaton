# AGENTS.md — Master SSOT & Twarde Reguły dla Agentów AI

> **SINGLE SOURCE OF TRUTH (SSOT):** Ten plik oraz 3 dokumenty w folderze `/docs` stanowią jedyne i wiążące źródło prawdy dla całego projektu **Finance Quest** (Collabothon 2026 — Commerzbank). Jeśli agent ma wątpliwość, ma obowiązek oprzeć się wyłącznie na tych plikach i **nie wymyślać** dodatkowych funkcji, endpointów ani ekranów.

## 1. Hierarchia dokumentacji (Kolejność czytania dla agenta)

1. **`AGENTS.md`** (ten plik) — rozróżnienie Produkt vs. Demo, zakazy (*Out of Scope*), setup projektu (w tym Docker + PostgreSQL), komendy uruchomieniowe, podział plików na 3 osoby i gotowe prompty startowe.

2. **`docs/01_PRODUCT_AND_GUI_SPEC.md`** — filozofia 14-dniowej ścieżki Speakly (5–10 min dziennie), 3 grupy pokoleniowe, system grywalizacji (poziomy, streak, ranking, realne mikro-wyzwanie 5 zł, mikro-lekcje, mapa 14 dni) oraz pełny projekt dopaminowego GUI.

3. **`docs/02_TECH_API_AND_MATH.md`** — struktura folderów, lekka baza PostgreSQL w Dockerze (`docker-compose.yml` + 2 tabele SQLAlchemy), deterministyczna matematyka finansowa, pełne schematy Pydantic i kontrakt API (absolutnie wiążące nazwy pól JSON).

4. **`docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`** — przeróbka modułu Luny na codziennego AI Coacha, maszyna 3 stanów Dnia 1 zapisywana w PostgreSQL, mapa 14 dni, gotowy System Prompt i kompletne fallbacki dla 3 pokoleń.

## 2. Cel projektu: Realistyczny Produkt vs. 5-Minutowe Demo

* **Wizja produktu (Model Speakly — regularna nauka):** Aplikacja webowa dla początkujących, samodzielnych inwestorów indywidualnych, którzy uczą się **regularnie po 5–10 minut dziennie przez 14 dni** (*„Od zera do pierwszej świadomej inwestycji w 14 dni”*). Zamiast wielogodzinnych kursów maksymalizujemy stosunek wiedzy do poświęconego czasu: użytkownik każdego dnia robi krótkie mikro-lekcje, przechodzi życiową symulację wyborów z AI Coachem (Luną), utrzymuje streak, awansuje na kolejne poziomy i wykonuje realne mikro-wyzwania (od symbolicznych 5 zł pierwszego dnia po gotowy plan ETF w Commerzbanku w 14. dniu).

* **Zakres prototypu na 5-minutową prezentację:** Zgodnie z wymogiem Commerzbank Challenge Card budujemy **1 kompletną, w pełni interaktywną misję (Dzień 1 z 14)** osadzoną na tle widocznej **14-dniowej mapy postępu** (kolejne dni są widoczne jako nadchodzące etapy). Wskaźnik gotowości inwestycyjnej rośnie realistycznie (po Dniu 1 osiąga `40%`, a nie nierealne `100%` po jednej sesji!), ale już pierwszego dnia klient przełamuje barierę techniczną mikro-wyzwaniem (np. 5 zł).

* **Priorytet absolutny na hackathon:** Najważniejsze jest to, **co widać na ekranie**: płynność, dopaminowe mikro-efekty, animacja cięcia zbędnej wiedzy, czytelny wykres ETF vs. inflacja, awans poziomu i 100% niezawodności podczas prezentacji na żywo. Podstawowa baza PostgreSQL w Dockerze zapewnia realną trwałość sesji i rankingu bez komplikowania kodu.

* **Spełnienie wymogów Commerzbank Challenge Card:**

  * 1 kompletna, działająca misja edukacyjna (Dzień 1 z 14) w ramach realistycznego programu wdrożeniowego.

  * Jasny profil odbiorcy i cel edukacyjny (*learning objective*).

  * Dowód na zrozumienie (*understanding* — AI Coach ocenia wybory) i zaangażowanie (*engagement* — mikro-lekcje, symulacja wyborów, poziomy, streak, ranking, realne mikro-wyzwania, konfetti).

  * *Innovations for all generations* — natychmiastowa adaptacja pod `20+`, `30-50` i `50+`.

## 3. TWARDE ZAKAZY (OUT OF SCOPE — NIE GENERUJ TEGO!)

Agentom AI **kategorycznie zabrania się** implementowania poniższych rzeczy:

* **ZERO autoryzacji:** brak rejestracji, logowania, haseł, JWT, ról użytkowników, sesji w cookies.

* **ZERO przekombinowania bazy danych:** używamy **wyłącznie** lekkiego PostgreSQL z `docker-compose.yml` + prostego SQLAlchemy z `Base.metadata.create_all(bind=engine)` przy starcie aplikacji i **maksymalnie 2 tabel** (`sessions`, `leaderboard_entries`). **ZERO Alembica, ZERO migracji, ZERO Redis, ZERO skomplikowanych relacji FK.**

* **ZERO narzędzi buildowania frontendu (Zero Node/npm):** nie twórz `package.json`, Node.js, Vite, Webpacka, Reacta ani TypeScriptu. Frontend to czyste pliki w `/static` (`index.html`, `app.js`, `styles.css`) serwowane bezpośrednio przez FastAPI i korzystające wyłącznie z oficjalnych linków CDN (Tailwind, Chart.js, canvas-confetti, Lucide).

* **ZERO zbędnych podstron i pełnych 14 misji:** implementujemy w pełni interaktywnie **tylko Dzień 1** (dni 2–14 wyświetlają się wyłącznie jako zablokowane kamienie milowe na mapie ścieżki). Brak panelu admina i brak strony ustawień.

* **ZERO rozbudowanego security / testów jednostkowych:** wystarczą modele Pydantic + `try/except` z twardym fallbackiem w `luna_service.py`.

## 4. Środowisko, Docker, zależności i uruchamianie

### Plik `requirements.txt`

```text
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.9.0
sqlalchemy>=2.0.35
psycopg2-binary>=2.9.9
openai>=1.55.0
python-dotenv>=1.0.1
```

### Plik `.env.example`

```text
OPENAI_API_KEY=sk-twoj-klucz-lub-klucz-luny
LUNA_MODEL=gpt-4o-mini
LUNA_TIMEOUT_SECONDS=8
DATABASE_URL=postgresql://finance:finance@localhost:5432/finance_quest
```

### Plik `docker-compose.yml` (Tylko baza PostgreSQL — aplikację odpalamy lokalnie z `--reload`)

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: finance_quest_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: finance
      POSTGRES_PASSWORD: finance
      POSTGRES_DB: finance_quest
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Komendy startowe (lokalnie i na prezentacji)

```bash
docker compose up -d
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Aplikacja musi otwierać się bezpośrednio pod adresem **`http://localhost:8000`** (FastAPI serwuje `static/index.html` na trasie `GET /`, a na starcie tworzy tabele w PostgreSQL i zasiewa 3 przykładowych znajomych w rankingu).

## 5. Podział pracy na 3 osoby (Zero konfliktów w Git)

| Rola | Własność plików (WYŁĄCZNIE te pliki) | Zadanie |
| :--- | :--- | :--- |
| **Osoba 1: Core Backend, Docker DB & Matematyka** | `docker-compose.yml`, `requirements.txt`, `.env.example`, `backend/__init__.py`, `backend/database.py`, `backend/models.py`, `backend/schemas.py`, `backend/finance_math.py`, `backend/main.py` | Postawienie PostgreSQL w Dockerze, 2 proste tabele SQLAlchemy (`sessions`, `leaderboard_entries`) z `create_all` i seedem startowym, deterministyczna matematyka ETF/inflacji, modele Pydantic 1:1 ze specyfikacji, trasy API i serwowanie `/static`. |
| **Osoba 2: AI Coach (Luna) & Dane Demo** | `backend/demo_data.py`, `backend/luna_service.py` | Przeróbka istniejącego modułu Luny na codziennego AI Coacha (usunięcie Allegro), System Prompt pod Dzień 1 z 14, mapa 14 dni, mikro-lekcje, realne wyzwania (5 zł), dane seedowe rankingu znajomych i 100% niezawodne fallbacki. |
| **Osoba 3: Dopaminowe GUI & Pitch** | `static/index.html`, `static/styles.css`, `static/app.js` | Zbudowanie 4 ekranów + modala bankowego z efektami dopaminowymi (nagłówek z Dniem 1/14, poziomem, streakiem i gotowością, animacja cięcia wiedzy Speakly, mapa 14 dni, mikro-lekcje, suwak Wehikuł Czasu, symulacja wyborów z AI Coachem, awans poziomu, wyzwanie 5 zł, ranking znajomych i modal Commerzbanku). |

### Gotowe prompty startowe dla agentów (wklej w Roo Code / Copilot)

* **Prompt dla Osoby 1:**

  > `@AGENTS.md @WORKLOG.md @docs/02_TECH_API_AND_MATH.md Przeczytaj SSOT oraz WORKLOG i zaimplementuj pliki: docker-compose.yml, requirements.txt, .env.example, backend/__init__.py, backend/database.py, backend/models.py, backend/schemas.py, backend/finance_math.py oraz backend/main.py. Użyj lekkiego PostgreSQL z docker-compose.yml, synchronicznych funkcji def i 2 prostych tabel SQLAlchemy (sessions, leaderboard_entries) tworzonych przez create_all na starcie (bez Alembica). Ściśle trzymaj się nazw pól Pydantic, sygnatur z AGENTS.md §7 oraz wzorów matematycznych. Nie twórz autoryzacji.`

* **Prompt dla Osoby 2:**

  > `@AGENTS.md @WORKLOG.md @docs/02_TECH_API_AND_MATH.md @docs/03_LUNA_INTEGRATION_AND_PROMPTS.md Przeczytaj SSOT oraz WORKLOG i zaimplementuj backend/demo_data.py oraz backend/luna_service.py na bazie wzorców klienta OpenAI (synchroniczne def). Uwzględnij 3 persony, 14-dniową mapę postępu (ROADMAP_BY_GROUP), mikro-lekcje Dnia 1, dane seedowe rankingu znajomych, realne mikro-wyzwanie (5 zł / 50 zł), System Prompt codziennego AI Coacha Luny, strict json_schema (extra="forbid") oraz niezawodny fallback w try/except.`

* **Prompt dla Osoby 3:**

  > `@AGENTS.md @WORKLOG.md @docs/01_PRODUCT_AND_GUI_SPEC.md @docs/02_TECH_API_AND_MATH.md Przeczytaj SSOT oraz WORKLOG i stwórz kompletny, dopaminowy frontend w static/index.html, static/styles.css i static/app.js (czysty HTML/JS + Tailwind/Chart.js/Confetti/Lucide z CDN, bez npm). Zaimplementuj 4 ekrany, nagłówek (Dzień 1/14, poziom, streak, monotoniczne XP, gotowość), animację cięcia tematów Speakly, podgląd 14-dniowej mapy nauki, mikro-lekcje, suwak Wehikuł Czasu (z punktem Rok 0), symulację wyborów z AI Coachem, awans na Poziom 2, realne wyzwanie 5 zł, ranking znajomych oraz modal bankowy Commerzbanku.`

## 6. Scenariusz 5-minutowej prezentacji na żywo (Golden Path Demo)

1. **0:00 – 0:45 (Problem i realistyczny model Speakly):** Barierą początkujących inwestorów nie jest brak informacji, lecz paraliż decyzyjny. Nie obiecujemy magii w 5 minut — wzorem Speakly budujemy **14-dniowy nawyk (5–10 min dziennie)** o najwyższym stosunku wiedzy do czasu, który krok po kroku doprowadza klienta do inwestycji w Commerzbanku. Dziś pokażemy kompletny **Dzień 1**.

2. **0:45 – 1:45 (Ankieta + Filtr Speakly + Mapa 14 Dni + Wehikuł Czasu — Demo `22 l. Student`):** Kliknięcie `[22 l. Student]` -> animowane przekreślenie zbędnych tematów („Zaoszczędzono 3.5h”) -> podgląd 14-dniowej mapy nauki (Dzień 1 aktywny, Dni 4–14 jako kolejne etapy) -> odhaczenie 1–2 krótkich mikro-lekcji (+15 XP) -> przesunięcie suwaka „Wehikuł Czasu” z 1 roku na 15 lat (wzrost kwoty w ETF vs strata przez inflację + skok szansy na zysk do 99%).

3. **1:45 – 3:15 (AI Coach Luna & Symulacja Wyborów — Dzień 1):** 3 błyskawiczne kroki na żywo: Krok 1 (dywersyfikacja ETF), Krok 2 (zepsuty laptop -> uświadomienie płynności, że pieniądze nie są zamrożone), Krok 3 (efekt skali w młodym wieku). Realistyczny wzrost wskaźnika gotowości (`10% -> 40%` po pierwszym dniu!) i spersonalizowany feedback AI Coacha.

4. **3:15 – 4:15 (Awans, Realne Wyzwanie 5 zł, Ranking i Commerzbank):** Ekran ukończenia Dnia 1 z konfetti, awansem `Poziom 1 -> Poziom 2` (`+155 XP`) i podtrzymanym streakiem (`🔥 1 dzień`). Kliknięcie **Realnego Mikro-Wyzwania na Dzień 1 („Wpłać 5 zł na konto oszczędnościowe”)**, odhaczenie checklisty Dnia 1, podgląd skoku w Rankingu Znajomych + przycisk „Wyzwij znajomego” oraz otwarcie modala Commerzbanku (wybór: mikro-wpłata 5 zł dziś lub podgląd docelowego planu ETF na Dzień 14).

5. **4:15 – 5:00 (Innovations for all generations):** Jedno kliknięcie w górnym pasku na `[56 l. 50+]` -> natychmiastowa zmiana horyzontu na 7 lat, inna 14-dniowa mapa i inne odrzucone tematy, inny zestaw mikro-lekcji oraz spokojniejszy ton AI Coacha skupiony na ochronie przed inflacją i haśle „inwestować można w każdym wieku”.

## 7. Git & Multi-Agent Workflow (Zespół 3-osobowy)

Aby agenty AI (Antigravity, GitHub Copilot, Roo Code) 3 osób pracowały równolegle bez konfliktów przy merge'u, obowiązują poniższe twarde zasady:

* **Twarda własność plików (File Ownership):** Każda osoba i jej agent edytują **WYŁĄCZNIE** pliki przypisane swojej roli w Sekcji 5:
  * **Osoba 1 (`[INFRA]` / `[BE]`):** `.gitignore`, `docker-compose.yml`, `requirements.txt`, `.env.example`, `backend/__init__.py`, `backend/database.py`, `backend/models.py`, `backend/schemas.py`, `backend/finance_math.py`, `backend/main.py`.
  * **Osoba 2 (`[AI]`):** `backend/demo_data.py`, `backend/luna_service.py`.
  * **Osoba 3 (`[FE]`):** `static/index.html`, `static/styles.css`, `static/app.js`.
  * **Pliki wspólne (`AGENTS.md`, `docs/*`, `WORKLOG.md`, wskaźniki agentów):** modyfikowane wyłącznie po uzgodnieniu zespołu w małych, atomowych commitach; `WORKLOG.md` aktualizujemy po zamknięciu każdego Issue.
  * **Kanoniczne nazwy plików:** używamy wyłącznie `backend/database.py` (NIE `db.py`) oraz `static/styles.css` (NIE `style.css`).
* **Konwencja branchy i commitów:**
  * Każdy GitHub Issue realizujemy na osobnym branchu: **`feat/issue-<nr>-<krotka-nazwa>`** (np. `feat/issue-2-db-schemas`).
  * Zasada **1 Issue = 1 mały PR / commit** i szybki merge do `main`. Przed startem nowego zadania wykonaj `git checkout main && git pull --rebase origin main`.
  * Nigdy nie commituj `.env` ani kluczy API.
* **Zamrożenie kontraktu API i schematów:**
  * **BEZWZGLĘDNY ZAKAZ** modyfikowania nazw pól JSON, ścieżek endpointów ani modeli z `docs/02_TECH_API_AND_MATH.md` bez jednoczesnej aktualizacji `backend/schemas.py`, wpisu w `WORKLOG.md` i powiadomienia pozostałych 2 osób.
  * **Wiążące sygnatury międzymodułowe (wszystkie jako synchroniczne `def`):**
    * `backend/finance_math.py`: `get_age_group(age)`, `calculate_safe_investment(age, net_income, free_cash, has_emergency_fund)`, `generate_projection_series(monthly_amount)`, `calculate_half_year_etf_value(monthly_amount)`.
    * `backend/demo_data.py`: `DEMO_PERSONAS`, `SEED_LEADERBOARD`, `SPEAKLY_FILTER_BY_GROUP`, `ROADMAP_BY_GROUP`, `MICRO_LESSONS_BY_GROUP`, `get_initial_mission_turn(...)`, `get_real_world_challenge(...)`, `get_final_checklist(...)`, `build_leaderboard(...)`, `get_fallback_turn(...)`.
    * `backend/luna_service.py`: `process_mission_turn(session_data: dict, user_message: str, leaderboard_rows: list[dict] | None = None) -> MissionTurnResponse`.
  * **Wspólny format `MissionSession.history`:** `[{"role": "user" | "assistant", "content": str}]`.