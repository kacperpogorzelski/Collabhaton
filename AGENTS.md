# AGENTS.md — Master SSOT & Twarde Reguły dla Agentów AI

> **SINGLE SOURCE OF TRUTH (SSOT):** Ten plik oraz 3 dokumenty w folderze `/docs` (wersja **v4**) stanowią jedyne i wiążące źródło prawdy dla projektu **Finance Quest** (Collabothon 2026 — Commerzbank). Jeśli agent ma wątpliwość, ma obowiązek oprzeć się wyłącznie na tych plikach i **nie wymyślać** dodatkowych funkcji, endpointów ani ekranów. Pliki `poprawki.txt` i `oprawki_claude.txt` są historią zmian — **nie są źródłem prawdy** (ich treść jest wcielona do `/docs`).

## 1. Hierarchia dokumentacji (Kolejność czytania dla agenta)
1. **`AGENTS.md`** (ten plik) — Produkt vs Demo, zakazy (*Out of Scope*), setup (Docker + PostgreSQL), podział plików, prompty startowe, Golden Path, workflow Git.
2. **`WORKLOG.md`** — aktywne blokery, statusy Issues, **Contract Lock** (ustalone decyzje techniczne).
3. **`docs/01_PRODUCT_AND_GUI_SPEC.md`** — 14-Day Confidence Sprint + kontynuacja po 14 dniach, personalizacja, business case, grywalizacja, dopaminowe GUI, maskotka Cora, mobile UX, ekrany, słownik sformułowań.
4. **`docs/02_TECH_API_AND_MATH.md`** — struktura folderów, PostgreSQL (2 tabele), deterministyczna matematyka, modele Pydantic, kontrakt API (absolutnie wiążące nazwy pól JSON).
5. **`docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`** — rola LLM (rygorystyczna 3-stanowa ocena wolnego tekstu + wyjaśnienia „Explain with real-life example”), maszyna Dni 1–4 + Checkpoint #1, prompty Cory, dane `demo_data.py`.

---

## 2. Cel projektu: Realistyczny Produkt vs. 5-Minutowe Demo
* **Wizja produktu (Model Speakly/Duolingo — Sprint Startowy + Dalsza Nauka):** aplikacja dla początkujących, samodzielnych inwestorów indywidualnych (wszystkie grupy wiekowe), którzy przez **14-dniowy sprint startowy (~5 minut dziennie)** budują pewność i wykonują pierwsze realne wpłaty (*„14-Day Confidence Sprint”*), a po Dniu 14 przechodzą do ścieżki ciągłej nauki (**„After Day 14 — Continuous Learning”**: rebalansowanie, IKE/IKZE, obligacje, miesięczne check-iny z AI Coachem **Corą**). **Dla banku:** depozyty z poduszki, pierwsze zlecenie testowe, plan cykliczny, długoterminowa retencja (docs/01 §4).
* **Zakres prototypu na 5-minutową prezentację:** w pełni interaktywna **Faza 1 — Dni 1–4 + codzienne mini-challenges + Checkpoint #1 (test wiedzy)** osadzone na czytelnej osi 3 faz 14-dniowego sprintu (Fazy 2–3 jako zablokowane etapy + sekcja kontynuacji po Dniu 14). Dzień 1 zawiera pełną 3-krokową symulację; Dni 2–4 to lżejsze moduły (1–2 mikro-lekcje + 2 kroki + mini-challenge dnia).
* **Priorytet absolutny:** co widać na ekranie: płynność, dopaminowe mikro-efekty, animowana maskotka Cora, wykres, awans, **100% niezawodności na scenie** (biblioteki frontendu lokalnie, klik karty bez LLM, fallback bazy i offline dla wyjaśnień).
* **Zasada uczciwości i AI Disclaimer:** żadnych gwarancji zysku, liczb bez jawnych założeń ani porównań w różnych jednostkach (docs/01 §8, docs/02 §3) oraz widoczny disclaimer: **AI Coach Cora może popełniać błędy** (*simulation only, not financial advice*).
* **Wymogi Commerzbank Challenge Card:**
  * kompletna działająca ścieżka edukacyjna (Dni 1–4 + Checkpoint #1 w ramach 14-dniowego sprintu i ciągłej nauki),
  * jasny profil odbiorcy i *learning objective*,
  * dowód zrozumienia (rygorystyczna 3-stanowa ocena odpowiedzi z odrzucaniem śmieciowych wpisów za `0 XP`, test Checkpoint #1, samoocena pewności przed/po, tryb *Explain simpler + mini-drill*) i zaangażowania (mikro-lekcje, symulacja, maskotka Cora, poziomy, streak, ranking, codzienne mini-challenges, konfetti),
  * *Innovations for all generations* — adaptacja horyzontu, tonu i pytań (wiek + wybrana obawa + samoocena pewności + typ planu).
* **Dwujęzyczność `EN / PL` (obowiązkowa, domyślnie `en`):** aplikacja startuje po **angielsku (`en`)** z przełącznikiem **`EN | PL`** w nagłówku i pełnym tłumaczeniem UI, treści backendowych (`demo_data.py`, `finance_math.py`) oraz promptów i fallbacków Cory (`luna_service.py`). Kwoty i obliczenia pozostają w **PLN** (bez przeliczania kursów; matematyka i `scripts/check_math.py` bez zmian). Specyfikacja: `docs/01` §9, `docs/02` §9, `docs/03` §10, `WORKLOG.md` §3 pkt 10–11.

---

## 3. TWARDE ZAKAZY (OUT OF SCOPE — NIE GENERUJ TEGO!)
* **ZERO autoryzacji:** rejestracja, logowanie, hasła, JWT, role, cookies sesyjne.
* **ZERO przekombinowania bazy danych:** wyłącznie lekki PostgreSQL z `docker-compose.yml` + proste SQLAlchemy z `Base.metadata.create_all(bind=engine)` i **maks. 2 tabelami** (`sessions`, `leaderboard_entries`) plus bezpieczne `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` w `init_db()`. Zero Alembica, migracji, Redis, skomplikowanych FK. *Jedyny wyjątek:* bezpiecznik demo w `database.py` — gdy PostgreSQL jest nieosiągalny, `init_db()` przełącza się na `sqlite://` w pamięci z tymi samymi modelami (docs/02 §2A).
* **ZERO narzędzi buildowania frontendu:** brak `package.json`, Node, Vite, Webpacka, Reacta, TypeScriptu. Frontend to czyste pliki w `/static`. Biblioteki (Tailwind, Chart.js, canvas-confetti, Lucide, font) zapisane **lokalnie w `static/vendor/`** (statyczne pliki, nie build) — **zakaz ładowania czegokolwiek z CDN w runtime**.
* **ZERO zbędnych podstron i pełnych 14 misji:** w pełni interaktywne są wyłącznie **Dni 1–4 + Checkpoint #1** (Dni 5–14 jako zablokowane kamienie milowe + sekcja podglądu „After Day 14”). Brak panelu admina i ustawień.
* **ZERO rozbudowanego security / testów jednostkowych.** *Jedyny dozwolony wyjątek:* `scripts/check_math.py` i `scripts/smoke_test.py` (docs/02 §8). Wystarczą modele Pydantic + `try/except` z fallbackiem w `luna_service.py`.
* **ZERO infrastruktury produkcyjnej** (Kubernetes, Nginx, mikroserwis AI): tylko jako diagram/roadmapa na slajdzie.
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
| **Osoba 1: Core Backend, Docker DB & API** | `.gitignore`, `docker-compose.yml`, `requirements.txt`, `.env.example`, `backend/__init__.py`, `backend/database.py`, `backend/models.py`, `backend/schemas.py`, `backend/finance_math.py`, `backend/main.py`, `scripts/smoke_test.py` | PostgreSQL w Dockerze + `ADD COLUMN IF NOT EXISTS` w `init_db()`, kolumny wielodniowe (`current_day`, `completed_days`, `completed_challenges`, `checkpoint_passed`), domyślny `lang: Literal["en", "pl"] = "en"`, kontrakt `answer_quality`/`allow_retry`, endpointy `/api/day/start`, `/api/checkpoint/submit`, `/api/coach/explain`, aktualizacja `scripts/smoke_test.py`. |
| **Osoba 2: AI Coach (Cora) & Dane Demo** | `backend/demo_data.py`, `backend/luna_service.py`, `scripts/check_math.py` | Rebranding `Luna` -> **Cora** i domyślny `lang="en"`, rygorystyczna 3-stanowa ocena wolnego tekstu (`optimal`/`partial`/`invalid` z `0 XP` i `allow_retry=True` dla `invalid`), rozszerzony dobór pytań (`self_confidence_start`, `plan_type`), treści Dni 2–4 + codzienne mini-challenges + Checkpoint #1 + ścieżki `POST_14_PATHS` + fazy czasowe, tryb `explain_with_drill` (LIVE + fallback offline), policzenie `HISTORICAL_WIN_RATE` ze źródłem (`docs/02` §3B). |
| **Osoba 3: Dopaminowe GUI & Mobile UX** | `static/index.html`, `static/styles.css`, `static/app.js`, `static/vendor/` | Domyślny `EN` + przełącznik `EN | PL`, przycisk `↺ Reset / Profile` + klikalne logo, rebranding **Cora** + AI disclaimer, czytelne fazy 14-dniowego sprintu, grywalne Dni 1–4 + codzienne mini-challenges + quiz Checkpoint #1 + sekcja „After Day 14”, obsługa `allow_retry`, animowana maskotka Cora inline SVG + drawer „Ask Cora / Explain with drill”, polish pod smartfony (`< 640px`), podbicie `?v=`. |

**Pitch i business case** (slajdy: docs/01 §4, 14-Day Confidence Sprint + dalsza nauka, compliance, architektura docelowa HA z K8s/Postgres/Nginx wyłącznie jako diagram) ma **jedna wyznaczona osoba** — do ustalenia przez zespół i wpisania w `WORKLOG.md`; nie powinna dźwigać jednocześnie najcięższego modułu kodu.

### Gotowe prompty startowe dla agentów (Roo Code / Copilot / Antigravity)
* **Osoba 1:** `@AGENTS.md @WORKLOG.md @docs/02_TECH_API_AND_MATH.md Przeczytaj SSOT v4 oraz WORKLOG (Issues #26, #27) i dokończ: domyślny lang="en" w schemas/models/database/finance_math/main, kolumny wielodniowe (current_day, completed_days, completed_challenges, checkpoint_passed + ADD COLUMN IF NOT EXISTS), rozszerzony MissionTurnResponse (answer_quality, allow_retry, day), obsługę POST /api/day/start, POST /api/challenge/accept (per dzień), POST /api/checkpoint/submit, POST /api/coach/explain oraz aktualizację scripts/smoke_test.py. Nie twórz autoryzacji ani Alembica.`
* **Osoba 2:** `@AGENTS.md @WORKLOG.md @docs/02_TECH_API_AND_MATH.md @docs/03_LUNA_INTEGRATION_AND_PROMPTS.md Przeczytaj SSOT v4 oraz WORKLOG (Issues #28, #29, #30) i zaimplementuj w backend/demo_data.py oraz backend/luna_service.py: rebranding Luna -> Cora i domyślny lang="en", lokalną pre-walidację + 3-stanowe LunaAssessment (optimal/partial/invalid; 0 XP i allow_retry=True dla invalid), rozszerzony dobór pytań wg self_confidence_start/plan_type, Dni 2–4 + codzienne mini-challenges + Checkpoint #1 + fazy czasowe + POST_14_PATHS, oraz explain_with_drill (LIVE + fallback offline). Zachowaj scripts/check_math.py 100% zielone.`
* **Osoba 3:** `@AGENTS.md @WORKLOG.md @docs/01_PRODUCT_AND_GUI_SPEC.md @docs/02_TECH_API_AND_MATH.md Przeczytaj SSOT v4 oraz WORKLOG (Issues #31, #32, #33) i zaktualizuj static/ (zero CDN, bez npm): domyślny EN + przełącznik EN | PL, przycisk Reset / Profile + klikalne logo, rebranding Cora + disclaimer AI, fazy czasowe sprintu, grywalne Dni 1–4 + mini-challenges + quiz Checkpoint #1 + sekcja After Day 14, obsługa allow_retry, animowana maskotka Cora inline SVG + drawer Ask Cora (z mini-zadaniem), oraz Mobile-first UX na smartfony. Podbij ?v= w index.html.`

---

## 6. Scenariusz 5-minutowej prezentacji na żywo (Golden Path, domyślnie EN)
Przetestujcie dwa razy z zegarem — także z `DEMO_OFFLINE=1` i bez Wi-Fi (na smartfonie i na rzutniku):

1. **0:00 – 0:45 (Problem i model 14-dniowego sprintu):** paraliż decyzyjny, brak pewności. Nie obiecujemy magii w 5 minut — **14-Day Confidence Sprint (~5 min/day)** prowadzący do pewności i pierwszych wpłat, a następnie ścieżka **After Day 14 — Continuous Learning**. Jedno zdanie o korzyści banku (depozyty + pierwsze mikrozlecenie + plan cykliczny + retencja).
2. **0:45 – 1:45 (Ankieta, Filtr, Mapa fazowa, Wehikuł czasu — `22y Student`):** klik `[22y Student]` (4 500 PLN netto, 1 000 PLN wolne, bez poduszki, obawa „freeze money”, samoocena 2/5 -> gotowość 10%) -> animacja przekreślania 6 zbędnych tematów („⚡ Skipped 6 topics”) i podział **poduszka 800 PLN + trening ETF 200 PLN/mies.** -> czytelna mapa 3 faz (`Days 1–4` → Checkpoint #1, `Days 5–9`, `Days 10–14` + podgląd po 14 dniach) -> 1 mikro-lekcja + klik **„Explain simpler / Ask Cora”** na maskotce SVG (przykład z życia + szybki mini-drill) -> suwak z 1 roku na 15 lat: ETF **ok. 33 844 PLN** vs wpłaty 0% **ok. 21 488 PLN**, pod wykresem założenia + MiFID II.
3. **1:45 – 3:00 (Symulacja z Corą + rygorystyczna ocena):** Krok 1: wpisanie losowego tekstu (np. `"asdf"`) -> Cora odrzuca jako `invalid` (`0 XP`, zostaje na kroku); następnie sensowna odpowiedź lub karta -> Krok 2 (zepsuty laptop -> płacę z poduszki) -> Krok 3 (spadek -20% -> trzymam plan). Gotowość **10% -> 40%**, XP **20 -> 155**.
4. **3:00 – 4:15 (Awans, mini-challenge, Dni 2–4, Checkpoint #1 i Commerzbank):** baner awansu + wyzwanie Dnia 1 (`+50 XP -> 205`), szybki skok Demo Mode do **Dnia 4 + Checkpoint #1** (pokazanie mini-wyzwania Dnia 2/3/4 i szybkiego testu wiedzy), sekcja **After Day 14**, modal bankowy z plakietką KYC, przycisk **`↺ Reset / Profile`** lub przełączenie na **`56y 50+`** + szybki test przełącznika **`EN | PL`**.
5. **4:15 – 5:00 (Innovations for all generations + Mobile):** pokaz na `56y 50+` (7 lat, `invest`, spokojniejszy ton) oraz widoku mobilnym / slajdzie biznesowym.

**Kontrola przed prezentacją:** `scripts/check_math.py` i `scripts/smoke_test.py` zielone; biblioteki w `static/vendor/` w repo; `docker compose up -d` (lub świadomy tryb SQLite-w-pamięci); serwer bez `--reload`; `.env` nie w repo.

---

## 7. Git & Multi-Agent Workflow (Zespół 3-osobowy)

* **Twarda własność plików:** każda osoba i jej agent edytują **WYŁĄCZNIE** pliki z §5. Pliki wspólne (`AGENTS.md`, `docs/*`, `WORKLOG.md`, wskaźniki agentów `.roorules`, `.agent/`, `.github/copilot-instructions.md`) zmieniamy po uzgodnieniu w małych, atomowych commitach; `WORKLOG.md` aktualizujemy po zamknięciu każdego Issue.
* **Kanoniczne nazwy:** `backend/database.py` (NIE `db.py`), `static/styles.css` (NIE `style.css`). Dla stabilności importów zachowujemy nazwę pliku `backend/luna_service.py` oraz klucz JSON `luna_message`.
* **Branche i commity:** **ZAKAZ edycji i commitów kodu aplikacji bezpośrednio na `main`** (przed pierwszą edycją sprawdź `git branch --show-current` i załóż branch). Każdy Issue realizuj na osobnym branchu **`feat/issue-<nr>-<krotka-nazwa>`**; 1 Issue = 1 mały PR/commit i szybki merge do `main`. Przed startem: `git checkout main && git pull --rebase origin main`. Nigdy nie commituj `.env` ani kluczy API.
* **Zamrożenie kontraktu:** **BEZWZGLĘDNY ZAKAZ** zmiany nazw pól JSON, ścieżek endpointów i modeli z `docs/02` bez jednoczesnej aktualizacji `backend/schemas.py`, wpisu w `WORKLOG.md` i powiadomienia pozostałych 2 osób.
* **Wiążące sygnatury międzymodułowe (wszystkie synchroniczne `def`):**
  * `backend/finance_math.py`: `get_age_group(age, lang="en")`, `calculate_safe_investment(age, net_income, free_cash, has_emergency_fund, lang="en")`, `generate_projection_series(monthly_amount)`, `calculate_half_year_etf_value(monthly_amount)`, `calculate_etf_value_after_months(monthly_amount, months)`, `historical_win_rate(year)`, `build_session_facts(session_columns)`.
  * `backend/demo_data.py`: `DEMO_PERSONAS`, `get_demo_personas(lang="en")`, `SEED_LEADERBOARD`, `SPEAKLY_FILTER_BY_GROUP`, `ROADMAP_BY_GROUP`, `MICRO_LESSONS_BY_GROUP`, `CHECKPOINT_1_QUESTIONS`, `POST_14_PATHS`, `get_age_group_content(age_group, lang="en")`, `get_day_content(day, session_facts, lang="en")`, `get_step_block(step, session_facts, lang="en", day=1)`, `get_initial_mission_turn(session_facts, day=1) -> (MissionTurnResponse, current_options)`, `shuffle_options(options, session_id, step)`, `get_real_world_challenge(has_emergency_fund, age_group, lang="en", day=1)`, `get_final_checklist(session_facts, lang="en")`, `get_bank_draft(session_facts, lang="en")`, `get_level_state(xp, lang="en")`, `grade_checkpoint(answers, lang="en")`, `build_leaderboard(db_rows, user_xp, user_level_title, leveled_up, lang="en")`.
  * `backend/luna_service.py`: `process_mission_turn(session_data: dict, user_message: str, leaderboard_rows: list[dict] | None = None, quick_reply_id: str | None = None, day: int | None = None) -> MissionTurnResponse` (modyfikuje `session_data` in place; czyta opcjonalne `session_data.get("lang", "en")`; zero SQLAlchemy) oraz `explain_with_drill(session_data: dict, question: str, topic_hint: str | None = None, lang: Language = "en") -> dict`.
  * **Dwujęzyczność (domyślnie `"en"`, wstecznie kompatybilna z `"pl"`):** każda funkcja zwracająca teksty przyjmuje opcjonalny parametr `lang: Language = "en"`, a `build_session_facts` przekazuje `lang` (domyślnie `"en"`).
  * **Wspólny format `MissionSession.history`:** `[{"role": "user" | "assistant", "content": str}]`.
