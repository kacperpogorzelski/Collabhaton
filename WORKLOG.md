# WORKLOG — Finance Quest (Collabothon 2026)

> **Instrukcja dla zespołu i agentów AI:** Aktualizuj ten plik po zamknięciu każdego Issue, uruchomieniu endpointu lub wykryciu blokera. Zawsze sprawdź poniższy status i sekcję *Contract Lock* przed rozpoczęciem pracy nad nowym zadaniem.

## 1. Aktywne Blokery (do zdjęcia w pierwszych 30 min)
- `[P0]` Pliki SSOT leżą obecnie w katalogu głównym jako `docs01_PRODUCT_AND_GUI_SPEC.md`, `docs02_TECH_API_AND_MATH.md`, `docs03_LUNA_INTEGRATION_AND_PROMPTS.md` zamiast w folderze `docs/` — do przeniesienia w **[Issue #1](https://github.com/kacperpogorzelski/Collabhaton/issues/1)** wraz z dodaniem `.gitignore`.
- `[P0]` Brak fundamentu backendu (`docker-compose.yml`, `backend/schemas.py`, `backend/database.py`, `backend/models.py`) blokujący pełną integrację Osoby 2 (`luna_service.py`) i Osoby 3 (podpięcie API) — **[Issue #1](https://github.com/kacperpogorzelski/Collabhaton/issues/1)** i **[Issue #2](https://github.com/kacperpogorzelski/Collabhaton/issues/2)**.

## 2. Tablica gotowości modułów, endpointów i Issues

| Moduł / Endpoint | Issue | Rola | Pliki | Status | Uwagi |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `Docker PostgreSQL + deps + docs/ + .gitignore` | [#1](https://github.com/kacperpogorzelski/Collabhaton/issues/1) | Osoba 1 (`[INFRA]`) | `docker-compose.yml`, `requirements.txt`, `.env.example`, `.gitignore`, `docs/` | ⬜ TODO | Bloker P0 (0–10 min) |
| `DB ORM + Schemas + FastAPI base + GET /` | [#2](https://github.com/kacperpogorzelski/Collabhaton/issues/2) | Osoba 1 (`[BE]`) | `backend/__init__.py`, `backend/database.py`, `backend/models.py`, `backend/schemas.py`, `backend/main.py` | ⬜ TODO | Bloker P0 (10–35 min) |
| `Dane demo, mapa 14 dni, mikro-lekcje, fallbacki` | [#3](https://github.com/kacperpogorzelski/Collabhaton/issues/3) | Osoba 2 (`[AI]`) | `backend/demo_data.py` | ⬜ TODO | Bloker P0 (po `schemas.py`) |
| `Szkielet SPA + design system + nagłówek Demo Mode` | [#4](https://github.com/kacperpogorzelski/Collabhaton/issues/4) | Osoba 3 (`[FE]`) | `static/index.html`, `static/styles.css`, `static/app.js` | ⬜ TODO | Bloker P0 (równolegle od 0 min) |
| `Deterministyczna matematyka finansowa` | [#5](https://github.com/kacperpogorzelski/Collabhaton/issues/5) | Osoba 1 (`[BE]`) | `backend/finance_math.py` | ⬜ TODO | P1-demo (po #2) |
| `Endpointy API (/api/demo-personas, analyze, turn, accept)` | [#6](https://github.com/kacperpogorzelski/Collabhaton/issues/6) | Osoba 1 (`[BE]`) | `backend/main.py` | ⬜ TODO | P1-demo (po #2, #3, #5) |
| `AI Coach Luna (strict JSON + fallback < 8s)` | [#7](https://github.com/kacperpogorzelski/Collabhaton/issues/7) | Osoba 2 (`[AI]`) | `backend/luna_service.py` | ⬜ TODO | P1-demo (po #2, #3) |
| `Ekran 1–2 (Ankieta, Speakly, Mikro-lekcje, Chart.js)` | [#8](https://github.com/kacperpogorzelski/Collabhaton/issues/8) | Osoba 3 (`[FE]`) | `static/index.html`, `static/styles.css`, `static/app.js` | ⬜ TODO | P1-demo (po #4) |
| `Ekran 3 (Symulacja Wyborów z Luną — 3 kroki)` | [#9](https://github.com/kacperpogorzelski/Collabhaton/issues/9) | Osoba 3 (`[FE]`) | `static/index.html`, `static/styles.css`, `static/app.js` | ⬜ TODO | P1-demo (po #8) |
| `Ekran 4 (Awans, Wyzwanie 5 zł, Ranking) + Modal` | [#10](https://github.com/kacperpogorzelski/Collabhaton/issues/10) | Osoba 3 (`[FE]`) | `static/index.html`, `static/styles.css`, `static/app.js` | ⬜ TODO | P1-demo (po #9) |
| `Próba E2E Backend + AI (Live & Offline fallback)` | [#11](https://github.com/kacperpogorzelski/Collabhaton/issues/11) | Osoba 1 + 2 (`[BE][AI]`) | `backend/main.py`, `backend/luna_service.py`, `backend/demo_data.py` | ⬜ TODO | P2-polish (po #6, #7) |
| `Polish dopaminowy + Golden Path Demo < 5 min` | [#12](https://github.com/kacperpogorzelski/Collabhaton/issues/12) | Osoba 3 (`[FE]`) | `static/index.html`, `static/styles.css`, `static/app.js` | ⬜ TODO | P2-polish (po #6, #10) |

## 3. Ustalone decyzje techniczne (Contract Lock)
1. **Kanoniczne nazwy plików:** wyłącznie `backend/database.py` (nie `db.py`) oraz `static/styles.css` (nie `style.css`).
2. **Synchroniczne `def` wszędzie w backendzie + `load_dotenv()`:** wszystkie trasy FastAPI i funkcje w `finance_math.py`, `demo_data.py`, `luna_service.py` to synchroniczne `def` (bez `async`/`await`). `load_dotenv()` wywoływane w `backend/database.py` i `backend/luna_service.py`.
3. **Warunkowe montowanie `/static` w `main.py`:** `if STATIC_DIR.is_dir(): app.mount("/static", ...)` — backend musi startować czysto jeszcze przed zmergowaniem Issue #4.
4. **Wiążące sygnatury międzymodułowe (`AGENTS.md` §7):**
   - `finance_math.py`: `get_age_group(age)`, `calculate_safe_investment(age, net_income, free_cash, has_emergency_fund)`, `generate_projection_series(monthly_amount)`, `calculate_half_year_etf_value(monthly_amount)`.
   - `demo_data.py`: `DEMO_PERSONAS`, `SEED_LEADERBOARD`, `SPEAKLY_FILTER_BY_GROUP`, `ROADMAP_BY_GROUP`, `MICRO_LESSONS_BY_GROUP`, `get_initial_mission_turn(...)`, `get_real_world_challenge(...)`, `get_final_checklist(...)`, `build_leaderboard(...)`, `get_fallback_turn(...)`.
   - `luna_service.py`: `process_mission_turn(session_data: dict, user_message: str, leaderboard_rows: list[dict] | None = None) -> MissionTurnResponse`.
5. **Format `MissionSession.history` i stan końcowy:** `[{"role": "user"|"assistant", "content": str}]` (nadpisanie nowej listy przy zapisie w SQLAlchemy). Po Kroku 3 `current_step` pozostaje równe `3` (idempotencja przy ponownym `POST /api/mission/turn`).
6. **Strict JSON Schema dla OpenAI + brak cennika:** `LunaLlmOutput` musi mieć `model_config = ConfigDict(extra="forbid")` (wymóg `strict: True`), `LUNA_MODEL` czytane z `.env`, `reasoning_effort="none"` wyłącznie dla `gpt-6-luna`, brak `Decimal` / `_usage_metrics` z AutoRespondera. W `get_fallback_turn()` formatować również `quick_replies` (`.format(**ctx)` dla `{horizon_years}`).
7. **Dokładne wektory matematyczne (`docs/02` §3D):**
   - `young_20` (`300 zł/mies.`, `15 lat`): `total_paid=54000`, `etf_value=103811`, `cash_real_value=42124`, `win_rate=99`, `6m_etf=1830`.
   - `mid_38` (`1250 zł/mies.`, `10 lat`): `total_paid=150000`, `etf_value=228683`, `cash_real_value=126738`, `win_rate=96`, `6m_etf=7626`.
   - `senior_56` (`1200 zł/mies.`, `7 lat`): `total_paid=100800`, `etf_value=134536`, `cash_real_value=89453`, `win_rate=93`, `6m_etf=7321`.
8. **Reguły UI (`docs/01`):** clamp `free_cash <= net_income`; punkt `Rok 0` (`0, 0`) w wykresie `Chart.js`; monotoniczne XP w nagłówku (`gamification.xp + microLessonBonusXp`); po wyzwaniu `+50 XP` użytkownik ma `205 XP` (5 XP za Kasią K. `210 XP`).

## 4. Dziennik wpisów
- **2026-11-20 (Setup):** Zakończony audyt SSOT i modułu `AutoResponder_Allegro`. Utworzono konfigurację multi-agent (`.github/copilot-instructions.md`, `.agent/rules/ssot.md`, `.roorules`, `AGENTS.md` §7, `WORKLOG.md`) oraz 12 GitHub Issues `#1`–`#12`.
- **2026-11-20 (Pogłębiony audyt SSOT):** Usunięto niespójności matematyczne (`104515/41890` -> `103811/42124`), zablokowano dokładne sygnatury `demo_data.py` i `finance_math.py`, synchroniczne `def`, format `history`, `extra="forbid"`, `Rok 0`, monotoniczne XP oraz `205 XP` po wyzwaniu; zaktualizowano dokumentację SSOT i opisy wszystkich 12 Issues na GitHubie.
