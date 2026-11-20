# AGENTS.md — Master SSOT & Twarde Reguły dla Agentów AI

> **SINGLE SOURCE OF TRUTH (SSOT):** Ten plik oraz 3 dokumenty w folderze `/docs` (wersja v2, po rewizji) stanowią jedyne i wiążące źródło prawdy dla projektu **Finance Quest** (Collabothon 2026 — Commerzbank). Jeśli agent ma wątpliwość, ma obowiązek oprzeć się wyłącznie na tych plikach i **nie wymyślać** dodatkowych funkcji, endpointów ani ekranów. Pliki `poprawki.txt` i `oprawki_claude.txt` są historią zmian — **nie są źródłem prawdy** (ich treść jest już wcielona do `/docs`).

## 1. Hierarchia dokumentacji (Kolejność czytania dla agenta)
1. **`AGENTS.md`** (ten plik) — zakazy (*Out of Scope*), setup projektu, komendy uruchomieniowe i podział plików.
2. **`docs/01_PRODUCT_AND_GUI_SPEC.md`** — wymagania biznesowe, metodologia Speakly, personalizacja (wiek + obawa), wartość dla banku, system wizualny, ekrany, słownik sformułowań.
3. **`docs/02_TECH_API_AND_MATH.md`** — struktura folderów, deterministyczna matematyka finansowa, modele Pydantic i kontrakt API (ważniejszy od wszystkiego przy nazwach pól JSON).
4. **`docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`** — rola LLM (tylko ocena wolnego tekstu), maszyna 3 kroków, treści misji i fallbacki.

---

## 2. Cel projektu (Kontekst dla każdego agenta)
* **Co budujemy:** Aplikację webową w Pythonie (FastAPI + frontend SPA bez bundlera), wzorowaną na **Speakly/Duolingo**, która w **3–4 minuty** buduje pewność siebie początkującego inwestora (wszystkie grupy wiekowe) i prowadzi go do pierwszego kroku w banku (konto oszczędnościowe / plan inwestycyjny).
* **Priorytet absolutny:** To jest **prototyp na 5-minutową prezentację na żywo**. Najważniejsze: co widać na ekranie, płynność, mikro-efekty i **100% niezawodności na scenie** (łącznie z brakiem Wi-Fi: biblioteki frontendu są lokalnie, kliknięcia kart nie używają LLM).
* **Zasada uczciwości:** żadnych gwarancji zysku, żadnych liczb bez jawnych założeń, ETF i gotówka zawsze porównywane w tej samej jednostce (docs/02 §2, docs/01 §7).
* **Wymogi Commerzbank Challenge Card:**
  * 1 kompletna, w pełni działająca misja edukacyjna,
  * jasny profil odbiorcy i *learning objective*,
  * dowód zrozumienia (ocena odpowiedzi + samoocena pewności przed/po) i zaangażowania,
  * *Innovations for all generations* — adaptacja horyzontu, tonu i scenariusza (wiek + wybrana obawa).

---

## 3. TWARDE ZAKAZY (OUT OF SCOPE — NIE GENERUJ TEGO!)
* **ZERO autoryzacji:** brak rejestracji, logowania, haseł, JWT, ról, cookies sesyjnych.
* **ZERO baz danych:** brak SQLite, PostgreSQL, SQLAlchemy, Alembic, Redis. Stan sesji tylko w `SESSIONS: dict[str, dict] = {}` w RAM.
* **ZERO narzędzi buildowania frontendu:** nie twórz `package.json`, Node.js, Vite, Webpacka, Reacta ani TypeScriptu. Frontend to czyste pliki w `/static`. Biblioteki (Tailwind, Chart.js, canvas-confetti, Lucide, font) są **zapisane lokalnie w `static/vendor/`** (statyczne pliki, nie build) — **zakaz ładowania czegokolwiek z CDN w runtime**.
* **ZERO zbędnych podstron:** brak panelu admina, ustawień, listy kursów (jest **1 misja** personalizowana; „następna misja" to tylko zablokowana karta).
* **ZERO rozbudowanego security i testów jednostkowych.** *Jedyny dozwolony wyjątek:* dwa skrypty `scripts/check_math.py` i `scripts/smoke_test.py` (opis w docs/02 §8). Wystarczają modele Pydantic + `try/except` z fallbackiem w `luna_service.py`.
* **ZERO infrastruktury produkcyjnej** (Kubernetes, Nginx, mikroserwis Luny): tylko jako diagram/roadmapa na slajdzie.
* **Nigdy nie commitować `.env`** ani klucza API.

---

## 4. Środowisko, zależności i uruchamianie
Pliki `requirements.txt`, `.env.example` i `.gitignore` są już w repo (zawartość: `.env.example` — docs/02 §7).

```bash
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # uzupełnij OPENAI_API_KEY (opcjonalne: DEMO_OFFLINE=1 działa bez klucza)
uvicorn backend.main:app --host 0.0.0.0 --port 8000   # BEZ --reload na prezentacji (restart kasuje sesje)
```
Aplikacja otwiera się pod **`http://localhost:8000`** (FastAPI serwuje `static/index.html` na `GET /`).
W trakcie developmentu `--reload` jest dozwolone; na scenie i na próbach generalnych — nie.

---

## 5. Podział plików dla 3-osobowego zespołu (Zero konfliktów Git)

| Osoba | Wyłączna własność plików | Pierwszy prompt do wklejenia agentowi |
| :--- | :--- | :--- |
| **Osoba 1: Backend & Luna** | `backend/main.py`<br>`backend/schemas.py`<br>`backend/luna_service.py` | *"Przeczytaj `AGENTS.md`, `docs/02_TECH_API_AND_MATH.md` i `docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`. Wygeneruj `backend/schemas.py` 1:1 z docs/02 §3, `backend/main.py` (z serwowaniem `/static`, endpointy z mockami w pierwszej kolejności, potem pełna logika) oraz `backend/luna_service.py` (LLM tylko dla wolnego tekstu, timeout z .env, `DEMO_OFFLINE`, neutralny fallback)."* |
| **Osoba 2: Matematyka & Dane** | `backend/finance_math.py`<br>`backend/demo_data.py`<br>`scripts/check_math.py`, `scripts/smoke_test.py` | *"Przeczytaj `AGENTS.md`, `docs/02_TECH_API_AND_MATH.md` i `docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`. Wygeneruj `backend/finance_math.py` dokładnie wg docs/02 §2 (trzy tryby planu, wspólny deflator, scenariusz stresowy) oraz `backend/demo_data.py` z treściami kroków 1–3 z docs/03 §6 (opcje z `is_optimal` i `feedback`), filtrem Speakly z docs/01 §2A i checklistą z docs/03 §7. Dodaj `scripts/check_math.py`."* |
| **Osoba 3: Frontend & Dopamine UX** | `static/index.html`<br>`static/app.js`<br>`static/styles.css`<br>`static/vendor/` | *"Przeczytaj `AGENTS.md`, `docs/01_PRODUCT_AND_GUI_SPEC.md` i `docs/02_TECH_API_AND_MATH.md`. Zbuduj kompletny frontend SPA w `/static` (biblioteki lokalnie w `static/vendor/`) dokładnie wg kontraktu API, palety i ekranów z docs/01, włącznie z samooceną 1–5, trybami planu i ponawianiem analizy po 404."* |

**Pitch i business case** (slajdy: docs/01 §3, roadmapa misji, compliance, architektura docelowa HA) ma **jedna wyznaczona osoba** — nie ta, która pisze `demo_data.py` (nierówny podział obciążenia). Po skończeniu backendu Osoba 1 przejmuje część tekstów `demo_data.py`.

**Zamrożenie kontraktu:** `schemas.py` po 1. godzinie pracy zmieniamy wyłącznie przez PR zatwierdzony przez Osobę 1 i uzgodniony z Osobami 2 i 3.

---

## 6. Scenariusz 5-minutowego demo (Golden Path — Checklista Akceptacyjna)
Przed oddaniem projektu przetestujcie tę ścieżkę dwa razy z zegarem (musi przejść bez zająknięcia, także z `DEMO_OFFLINE=1` i bez Wi-Fi):

1. **0:00 – 0:45 (Hook):** Otwarta strona `http://localhost:8000`. Problem: paraliż decyzyjny i brak pewności. Inspiracja: Speakly/Duolingo (maksimum praktyki w minimum czasu). Jedno zdanie o korzyści banku (docs/01 §3).
2. **0:45 – 1:30 (Onboarding + Filtr):** Klik **`22 l. Student`** (4 500 zł netto, 1 000 zł wolne, bez poduszki, obawa „zamrożę pieniądze", pewność 2/5) -> **`Stwórz moją krótką ścieżkę`** -> animacja przekreślania 6 zbędnych tematów („⚡ Pominęliśmy 6 tematów…") i podział **poduszka 800 zł + trening ETF 200 zł/mies.** (80/20).
3. **1:30 – 2:15 (Wehikuł czasu):** Suwak z `1 roku` na `15 lat`: wykres w dzisiejszych zł pokazuje ETF **ok. 33 844 zł** vs wpłaty na koncie 0% **ok. 21 488 zł** (wpłacono 36 000 zł) oraz przerywaną linię scenariusza -20% w roku 3. Pod wykresem widoczne założenia (5,7% po kosztach, przed podatkiem).
4. **2:15 – 3:30 (Misja LIVE z Luną — 3 kroki):** Krok 1: **wolny tekst raz** (przy działającej sieci) lub karta. Krok 2: test „zepsuty laptop" -> płacę z poduszki, ETF zostaje. Krok 3: spadek -20% -> trzymam plan. Confidence rośnie **25% -> 60% -> 85% -> 100%** z mikro-konfetti.
5. **3:30 – 4:15 (Checklista + Przykładowy plan):** Odhaczenie 4 punktów -> pełne konfetti -> pokazanie „Pewność: 25% -> 100%" i „Przed 2/5 -> Po Y/5" -> klik **`Przenieś ten przykładowy plan do konta w Commerzbanku`** -> modal z planem i plakietką „w wersji produkcyjnej: test odpowiedniości, KYC".
6. **4:15 – 5:00 (Innovations for all generations):** Klik **`56 l. 50+`** -> reset na Ekran 1/2: horyzont 7 lat, kwota ok. 1 200 zł/mies., inny ton, inne tematy i obawa „za późno" (po stronie slajdu: roadmapa kolejnych misji i business case).

**Kontrola przed prezentacją:** `scripts/check_math.py` i `scripts/smoke_test.py` przechodzą na zielono; biblioteki w `static/vendor/` są w repo; serwer uruchomiony **bez `--reload`**; `.env` nie jest commitowany.
