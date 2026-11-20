# AGENTS.md — Master SSOT & Twarde Reguły dla Agentów AI

> **SINGLE SOURCE OF TRUTH (SSOT):** Ten plik oraz 3 dokumenty w folderze `/docs` (wersja **v3, scalona**) stanowią jedyne i wiążące źródło prawdy dla projektu **Finance Quest** (Collabothon 2026 — Commerzbank). Jeśli agent ma wątpliwość, ma obowiązek oprzeć się wyłącznie na tych plikach i **nie wymyślać** dodatkowych funkcji, endpointów ani ekranów. Pliki `poprawki.txt` i `oprawki_claude.txt` są historią zmian — **nie są źródłem prawdy** (ich treść jest wcielona do `/docs`).

## 1. Hierarchia dokumentacji (Kolejność czytania dla agenta)
1. **`AGENTS.md`** (ten plik) — Produkt vs Demo, zakazy (*Out of Scope*), setup (Docker + PostgreSQL), podział plików, prompty startowe, Golden Path, workflow Git.
2. **`WORKLOG.md`** — aktywne blokery, statusy Issues, **Contract Lock** (ustalone decyzje techniczne).
3. **`docs/01_PRODUCT_AND_GUI_SPEC.md`** — 14-dniowa ścieżka Speakly, personalizacja (wiek + obawa), business case, grywalizacja, dopaminowe GUI, ekrany, słownik sformułowań.
4. **`docs/02_TECH_API_AND_MATH.md`** — struktura folderów, PostgreSQL (2 tabele), deterministyczna matematyka, modele Pydantic, kontrakt API (absolutnie wiążące nazwy pól JSON).
5. **`docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`** — rola LLM (tylko ocena wolnego tekstu), maszyna 3 kroków Dnia 1, prompt, dane `demo_data.py`, treści kroków.

---

## 2. Cel projektu: Realistyczny Produkt vs. 5-Minutowe Demo
* **Wizja produktu (Model Speakly/Duolingo — regularna nauka):** aplikacja dla początkujących, samodzielnych inwestorów indywidualnych (wszystkie grupy wiekowe), którzy uczą się **5–10 minut dziennie przez 14 dni** (*„Od zera do pierwszej świadomej inwestycji w 14 dni"*): mikro-lekcje, życiowa symulacja wyborów z AI Coachem (Luną), streak, poziomy, ranking i realne mikro-wyzwania (od 5 zł na konto oszczędnościowe po plan ETF w 14. dniu). **Dla banku:** depozyty z poduszki, plan cykliczny, retencja (docs/01 §4).
* **Zakres prototypu na 5-minutową prezentację:** **1 kompletna misja — Dzień 1 z 14**, osadzona na widocznej 14-dniowej mapie (Dni 2–14 jako zablokowane kamienie milowe). Gotowość rośnie realistycznie (demo: **10% -> 40%**, nie „100% w 3 minuty").
* **Priorytet absolutny:** co widać na ekranie: płynność, dopaminowe mikro-efekty, wykres, awans, **100% niezawodności na scenie** (biblioteki frontendu lokalnie, klik karty bez LLM, fallback bazy).
* **Zasada uczciwości:** żadnych gwarancji zysku, liczb bez jawnych założeń ani porównań w różnych jednostkach (docs/01 §8, docs/02 §3).
* **Wymogi Commerzbank Challenge Card:**
  * 1 kompletna, działająca misja edukacyjna (Dzień 1 z 14) w ramach realistycznego programu,
  * jasny profil odbiorcy i *learning objective*,
  * dowód zrozumienia (ocena odpowiedzi + samoocena pewności przed/po) i zaangażowania (mikro-lekcje, symulacja, poziomy, streak, ranking, wyzwania, konfetti),
  * *Innovations for all generations* — adaptacja horyzontu, tonu i scenariusza (wiek + wybrana obawa).

---

## 3. TWARDE ZAKAZY (OUT OF SCOPE — NIE GENERUJ TEGO!)
* **ZERO autoryzacji:** rejestracja, logowanie, hasła, JWT, role, cookies sesyjne.
* **ZERO przekombinowania bazy danych:** wyłącznie lekki PostgreSQL z `docker-compose.yml` + proste SQLAlchemy z `Base.metadata.create_all(bind=engine)` i **maks. 2 tabelami** (`sessions`, `leaderboard_entries`). Zero Alembica, migracji, Redis, skomplikowanych FK. *Jedyny wyjątek:* bezpiecznik demo w `database.py` — gdy PostgreSQL jest nieosiągalny, `init_db()` przełącza się na `sqlite://` w pamięci z tymi samymi modelami (docs/02 §2A).
* **ZERO narzędzi buildowania frontendu:** brak `package.json`, Node, Vite, Webpacka, Reacta, TypeScriptu. Frontend to czyste pliki w `/static`. Biblioteki (Tailwind, Chart.js, canvas-confetti, Lucide, font) zapisane **lokalnie w `static/vendor/`** (statyczne pliki, nie build) — **zakaz ładowania czegokolwiek z CDN w runtime**.
* **ZERO zbędnych podstron i pełnych 14 misji:** w pełni interaktywny tylko **Dzień 1** (Dni 2–14 wyłącznie jako zablokowane kamienie milowe). Brak panelu admina i ustawień.
* **ZERO rozbudowanego security / testów jednostkowych.** *Jedyny dozwolony wyjątek:* `scripts/check_math.py` i `scripts/smoke_test.py` (docs/02 §8). Wystarczą modele Pydantic + `try/except` z fallbackiem w `luna_service.py`.
* **ZERO infrastruktury produkcyjnej** (Kubernetes, Nginx, mikroserwis Luny): tylko jako diagram/roadmapa na slajdzie.
* **Nigdy nie commituj `.env`** ani kluczy API.

---

## 4. Środowisko, Docker, zależności i uruchamianie
Pliki `docker-compose.yml`, `requirements.txt`, `.env.example` i `.gitignore` są w repo (zawartość `.env.example`: docs/02 §7).

```bash
docker compose up -d                                  # PostgreSQL 16 (finance_quest_db)
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # uzupełnij OPENAI_API_KEY; DEMO_OFFLINE=1 działa bez klucza
uvicorn backend.main:app --host 0.0.0.0 --port 8000   # --reload tylko w trakcie developmentu
```
Aplikacja pod **`http://localhost:8000`** (FastAPI serwuje `static/index.html` na `GET /`, na starcie tworzy tabele i zasiewa 3 znajomych w rankingu). **Na prezentacji i próbach generalnych NIE używać `--reload`.**

---

## 5. Podział pracy na 3 osoby (Zero konfliktów w Git)

| Rola | Własność plików (WYŁĄCZNIE te pliki) | Zadanie |
| :--- | :--- | :--- |
| **Osoba 1: Core Backend, Docker DB & API** | `.gitignore`, `docker-compose.yml`, `requirements.txt`, `.env.example`, `backend/__init__.py`, `backend/database.py`, `backend/models.py`, `backend/schemas.py`, `backend/finance_math.py`, `backend/main.py`, `scripts/smoke_test.py` | PostgreSQL w Dockerze, 2 tabele SQLAlchemy z `create_all` i seedem, bezpiecznik SQLite-w-pamięci, matematyka ETF/inflacji i tryby planu, modele Pydantic 1:1, trasy API, serwowanie `/static`. |
| **Osoba 2: AI Coach (Luna) & Dane Demo** | `backend/demo_data.py`, `backend/luna_service.py`, `scripts/check_math.py` | Przeróbka modułu Luny (usunięcie Allegro; LLM tylko dla wolnego tekstu), treści kroków z opcjami `is_optimal`/`feedback`, mapa 14 dni, mikro-lekcje, wyzwania, seed rankingu, **policzenie `HISTORICAL_WIN_RATE` ze źródłem** (docs/02 §3B). |
| **Osoba 3: Dopaminowe GUI** | `static/index.html`, `static/styles.css`, `static/app.js`, `static/vendor/` | 4 ekrany + modal bankowy, nagłówek (Dzień 1/14, poziom, streak, gotowość), cięcie tematów, mapa 14 dni, mikro-lekcje, wykres z `Rok 0`, symulacja z kartami, awans, wyzwanie, ranking, modal; lokalne biblioteki w `static/vendor/`. |

**Pitch i business case** (slajdy: docs/01 §4, roadmapa 14 dni, compliance, architektura docelowa HA z K8s/Postgres/Nginx wyłącznie jako diagram) ma **jedna wyznaczona osoba** — do ustalenia przez zespół i wpisania w `WORKLOG.md`; nie powinna dźwigać jednocześnie najcięższego modułu kodu.

### Gotowe prompty startowe dla agentów (Roo Code / Copilot / Antigravity)
* **Osoba 1:** `@AGENTS.md @WORKLOG.md @docs/02_TECH_API_AND_MATH.md Przeczytaj SSOT oraz WORKLOG i zaimplementuj: backend/__init__.py, database.py (z bezpiecznikiem SQLite-w-pamięci), models.py, schemas.py (1:1 z docs/02 §4), finance_math.py (trzy tryby planu, wspólny deflator, scenariusz stresowy, build_session_facts) oraz main.py (sync def, mocki endpointów w pierwszej kolejności, idempotencja po zakończeniu misji, 404 -> frontend ponawia analyze). Nie twórz autoryzacji ani migracji.`
* **Osoba 2:** `@AGENTS.md @WORKLOG.md @docs/02_TECH_API_AND_MATH.md @docs/03_LUNA_INTEGRATION_AND_PROMPTS.md Przeczytaj SSOT oraz WORKLOG i zaimplementuj backend/demo_data.py (persony, filtr Speakly, mapa 14 dni, mikro-lekcje, wyzwania, seed rankingu, bloki kroków 1–3 z opcjami is_optimal/feedback, checklista, bank_draft) oraz backend/luna_service.py (process_mission_turn: klik karty = ocena deterministyczna, LLM tylko dla wolnego tekstu ze strict json_schema extra="forbid" bez wartości domyślnych, timeout z .env, DEMO_OFFLINE, neutralny fallback). Dodaj scripts/check_math.py.`
* **Osoba 3:** `@AGENTS.md @WORKLOG.md @docs/01_PRODUCT_AND_GUI_SPEC.md @docs/02_TECH_API_AND_MATH.md Przeczytaj SSOT oraz WORKLOG i stwórz frontend w static/ (czysty HTML/JS, biblioteki LOKALNIE w static/vendor/, zero CDN, bez npm). Zaimplementuj 4 ekrany + modal, ankietę z obawą i samooceną 1–5, trzy tryby planu (split/invest/savings_first), wykres w dzisiejszych zł z punktem Rok 0, linią stresową i podpisem założeń, karty quick_replies z quick_reply_id, kolor feedbacku zależny od is_optimal_choice, monotoniczne XP, baner awansu zależny od leveled_up, ranking oraz ciche ponowienie analyze po 404.`

---

## 6. Scenariusz 5-minutowej prezentacji na żywo (Golden Path)
Przetestujcie dwa razy z zegarem — także z `DEMO_OFFLINE=1` i bez Wi-Fi:

1. **0:00 – 0:45 (Problem i realistyczny model):** paraliż decyzyjny, brak pewności. Nie obiecujemy magii w 5 minut — **14-dniowy nawyk (5–10 min dziennie)** prowadzący do inwestycji w Commerzbanku; dziś kompletny **Dzień 1**. Jedno zdanie o korzyści banku (depozyty + plan cykliczny + retencja).
2. **0:45 – 1:45 (Ankieta, Filtr, Mapa, Wehikuł czasu — `22 l. Student`):** klik `[22 l. Student]` (4 500 zł netto, 1 000 zł wolne, bez poduszki, obawa „zamrożę pieniądze", samoocena 2/5 -> gotowość 10%) -> animacja przekreślania 6 zbędnych tematów („⚡ Pominęliśmy 6 tematów") i podział **poduszka 800 zł + trening ETF 200 zł/mies.** -> mapa 14 dni (Dzień 1 aktywny, 4/9/14 zablokowane) -> 1–2 mikro-lekcje (+15 XP) -> suwak z 1 roku na 15 lat: ETF **ok. 33 844 zł** vs wpłaty na koncie 0% **ok. 21 488 zł** (w dzisiejszych zł; wpłacono 36 000 zł), przerywana linia scenariusza -20% w roku 3, pod wykresem widoczne założenia.
3. **1:45 – 3:15 (Symulacja z Luną):** Krok 1 (wolny tekst **raz**, przy działającej sieci, lub karta), Krok 2 (zepsuty laptop -> płacę z poduszki, ETF zostaje), Krok 3 (spadek -20% -> trzymam plan). Gotowość **10% -> 20% -> 30% -> 40%**, XP **20 -> 60 -> 95 -> 155**, mikro-konfetti przy dobrych odpowiedziach.
4. **3:15 – 4:15 (Awans, wyzwanie, ranking, Commerzbank):** baner `🏆 AWANS: Poziom 2 Świadomy Start` i „Gotowość 10% -> 40%", wyzwanie „Wpłać 5 zł" (+50 XP -> 205, 5 XP za liderem `Kasia K.`), checklista -> pełne konfetti, „Przed 2/5 -> Po Y/5", ranking, modal z przykładowym planem i plakietką „w wersji produkcyjnej: test odpowiedniości, KYC".
5. **4:15 – 5:00 (Innovations for all generations):** klik `[56 l. 50+]` -> horyzont 7 lat, kwota ok. 1 200 zł/mies. (tryb `invest`), inna mapa, inne tematy, obawa „za późno", spokojniejszy ton; slajd: roadmapa 14 dni i business case.

**Kontrola przed prezentacją:** `scripts/check_math.py` i `scripts/smoke_test.py` zielone; biblioteki w `static/vendor/` w repo; `docker compose up -d` (lub świadomy tryb SQLite-w-pamięci); serwer bez `--reload`; `.env` nie w repo.

---

## 7. Git & Multi-Agent Workflow (Zespół 3-osobowy)

* **Twarda własność plików:** każda osoba i jej agent edytują **WYŁĄCZNIE** pliki z §5. Pliki wspólne (`AGENTS.md`, `docs/*`, `WORKLOG.md`, wskaźniki agentów `.roorules`, `.agent/`, `.github/copilot-instructions.md`) zmieniamy po uzgodnieniu w małych, atomowych commitach; `WORKLOG.md` aktualizujemy po zamknięciu każdego Issue.
* **Kanoniczne nazwy:** `backend/database.py` (NIE `db.py`), `static/styles.css` (NIE `style.css`).
* **Branche i commity:** **ZAKAZ edycji i commitów kodu aplikacji bezpośrednio na `main`** (przed pierwszą edycją sprawdź `git branch --show-current` i załóż branch). Każdy Issue realizuj na osobnym branchu **`feat/issue-<nr>-<krotka-nazwa>`**; 1 Issue = 1 mały PR/commit i szybki merge do `main`. Przed startem: `git checkout main && git pull --rebase origin main`. Nigdy nie commituj `.env` ani kluczy API.
* **Zamrożenie kontraktu:** **BEZWZGLĘDNY ZAKAZ** zmiany nazw pól JSON, ścieżek endpointów i modeli z `docs/02` bez jednoczesnej aktualizacji `backend/schemas.py`, wpisu w `WORKLOG.md` i powiadomienia pozostałych 2 osób.
* **Wiążące sygnatury międzymodułowe (wszystkie synchroniczne `def`):**
  * `backend/finance_math.py`: `get_age_group(age)`, `calculate_safe_investment(age, net_income, free_cash, has_emergency_fund)`, `generate_projection_series(monthly_amount)`, `calculate_half_year_etf_value(monthly_amount)`, `calculate_etf_value_after_months(monthly_amount, months)`, `historical_win_rate(year)`, `build_session_facts(session_columns)`.
  * `backend/demo_data.py`: `DEMO_PERSONAS`, `SEED_LEADERBOARD`, `SPEAKLY_FILTER_BY_GROUP`, `ROADMAP_BY_GROUP`, `MICRO_LESSONS_BY_GROUP`, `get_step_block(step, session_facts)`, `get_initial_mission_turn(session_facts) -> (MissionTurnResponse, current_options)`, `shuffle_options(options, session_id, step)`, `get_real_world_challenge(has_emergency_fund, age_group)`, `get_final_checklist(session_facts)`, `get_bank_draft(session_facts)`, `build_leaderboard(db_rows, user_xp, user_level_title, leveled_up)`.
  * `backend/luna_service.py`: `process_mission_turn(session_data: dict, user_message: str, leaderboard_rows: list[dict] | None = None, quick_reply_id: str | None = None) -> MissionTurnResponse` (modyfikuje `session_data` in place; zero SQLAlchemy).
  * **Wspólny format `MissionSession.history`:** `[{"role": "user" | "assistant", "content": str}]`.
