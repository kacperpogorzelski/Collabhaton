# Instrukcje SSOT dla GitHub Copilot — Finance Quest (Collabothon 2026)

Ten plik jest wyłącznie lekkim wskaźnikiem. **Nie duplikuje dokumentacji** — jedynym źródłem prawdy (SSOT) jest `AGENTS.md` oraz folder `docs/`.

## 1. Obowiązkowa kolejność czytania przed każdą zmianą kodu
1. `AGENTS.md` — zakres demo vs produkt, zakazy *Out of Scope* (§3), *File Ownership* (§5) i zasady Git (§7).
2. `WORKLOG.md` — bieżący status modułów, działające endpointy, decyzje *Contract Lock* i aktywne blokery.
3. Dokumenty SSOT dla Twojej roli w `docs/`:
   - `docs/01_PRODUCT_AND_GUI_SPEC.md` — produkt, grywalizacja, dopaminowe GUI (**Osoba 3**)
   - `docs/02_TECH_API_AND_MATH.md` — PostgreSQL w Dockerze, matematyka, kontrakt Pydantic/API (**wszyscy**)
   - `docs/03_LUNA_INTEGRATION_AND_PROMPTS.md` — AI Coach Luna, mapa 14 dni, fallbacki (**Osoba 2 i Osoba 1**)

> **Uwaga tymczasowa:** Do czasu zamknięcia Issue #1 (`[INFRA]`) pliki `docs/` leżą w katalogu głównym jako `docs01_PRODUCT_AND_GUI_SPEC.md`, `docs02_TECH_API_AND_MATH.md`, `docs03_LUNA_INTEGRATION_AND_PROMPTS.md`.

## 2. Twarde reguły pracy (zobacz szczegóły w `AGENTS.md`)
- **Out of Scope (`AGENTS.md` §3):** ZERO autoryzacji/JWT/logowania, ZERO Alembica/migracji, ZERO Node/npm/React/TS. W pełni interaktywny jest wyłącznie Dzień 1 z 14.
- **File Ownership (`AGENTS.md` §5 i §7):** Edytuj **WYŁĄCZNIE** pliki przypisane Twojej roli. Kanoniczne nazwy plików to `backend/database.py` (NIE `db.py`) oraz `static/styles.css` (NIE `style.css`).
- **Zamrożenie kontraktu API:** Nie zmieniaj nazw pól JSON, modeli ani endpointów z `docs/02_TECH_API_AND_MATH.md` bez aktualizacji `backend/schemas.py`, wpisu w `WORKLOG.md` i powiadomienia zespołu.
- **Git & Status:** Pracuj na osobnym branchu `feat/issue-<nr>-<krotka-nazwa>` (1 Issue = 1 mały PR/commit), nie commituj `.env` i po zamknięciu zadania zaktualizuj `WORKLOG.md`.
