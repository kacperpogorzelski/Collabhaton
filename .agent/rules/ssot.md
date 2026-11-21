---
trigger: always_on
---

# Reguła SSOT dla Antigravity — Finance Quest (Collabothon 2026)

Ten plik jest lekkim wskaźnikiem bez duplikowania treści. Jedynym źródłem prawdy (SSOT) dla projektu pozostają `AGENTS.md` i `docs/`.

## Przed każdą zmianą kodu
1. Przeczytaj `AGENTS.md` (szczególnie §3 *Out of Scope*, §5 *Podział pracy*, §7 *Git & Multi-Agent Workflow*).
2. Przeczytaj `WORKLOG.md` (aktualne blokery, statusy endpointów i *Contract Lock*).
3. Przeczytaj odpowiednie dokumenty w `docs/`:
   - `docs/01_PRODUCT_AND_GUI_SPEC.md` (Osoba 3 / GUI i grywalizacja)
   - `docs/02_TECH_API_AND_MATH.md` (wszyscy / baza, matematyka, Pydantic i API)
   - `docs/03_LUNA_INTEGRATION_AND_PROMPTS.md` (Osoba 2 i 1 / AI Coach Luna i fallbacki)

## Bezwzględne ograniczenia
- Przestrzegaj `AGENTS.md` §3 (*Out of Scope*): zero auth/JWT, zero Alembica/migracji, zero Node/npm/React/TS, pełna interaktywność tylko dla Dnia 1 z 14.
- Przestrzegaj `AGENTS.md` §5 i §7 (*File Ownership*): edytuj wyłącznie pliki przypisane swojej roli; używaj kanonicznych nazw `backend/database.py` (nie `db.py`) i `static/styles.css` (nie `style.css`).
- Nie zmieniaj kontraktu JSON/API z `docs/02_TECH_API_AND_MATH.md` bez jednoczesnej aktualizacji `backend/schemas.py`, wpisu w `WORKLOG.md` i powiadomienia zespołu.
- **Dwujęzyczność PL / EN (obowiązkowa):** każda treść widoczna dla użytkownika (UI, `demo_data.py`, `finance_math.py`, prompt i fallback Luny) musi mieć wersję `pl` oraz `en` zgodnie z kontraktem `lang: Literal["pl", "en"] = "pl"` (`docs/01` §9, `docs/02` §9, `docs/03` §10, `WORKLOG.md` §3 pkt 10); kwoty pozostają w PLN.
- Nie wymyślaj dodatkowych funkcji, ekranów ani endpointów spoza SSOT.
- **ZAKAZ edycji i commitów kodu bezpośrednio na `main`:** przed pierwszą edycją pliku sprawdź `git branch --show-current`; jeśli jesteś na `main`, załóż nowy branch `feat/issue-<nr>-<krotka-nazwa>` (1 Issue = 1 mały PR/commit), nie commituj `.env` i aktualizuj `WORKLOG.md` po zakończeniu zadania lub wykryciu blokera.
