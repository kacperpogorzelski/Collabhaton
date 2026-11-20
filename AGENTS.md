# AGENTS.md — Master SSOT & Twarde Reguły dla Agentów AI

> **SINGLE SOURCE OF TRUTH (SSOT):** Ten plik oraz 3 dokumenty w folderze `/docs` stanowią jedyne i wiążące źródło prawdy dla całego projektu **Finance Quest** (Collabothon 2026 — Commerzbank). Jeśli agent ma wątpliwość, ma obowiązek oprzeć się wyłącznie na tych plikach i **nie wymyślać** dodatkowych funkcji, endpointów ani ekranów.

## 1. Hierarchia dokumentacji (Kolejność czytania dla agenta)
1. **`AGENTS.md`** (ten plik) — zakazy (*Out of Scope*), setup projektu, komendy uruchomieniowe i podział plików.
2. **`docs/01_PRODUCT_AND_GUI_SPEC.md`** — wymagania biznesowe, metodologia Speakly, 3 grupy pokoleniowe, dokładny system wizualny, efekty dopaminowe i mapowanie ekranów.
3. **`docs/02_TECH_API_AND_MATH.md`** — struktura folderów, deterministyczna matematyka finansowa, pełne schematy Pydantic i kontrakt API (ważniejszy od wszystkiego przy nazwach pól JSON).
4. **`docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`** — przeróbka modułu Luny, maszyna 3 stanów, gotowy System Prompt i kompletne fallbacki dla 3 pokoleń.

---

## 2. Cel projektu (Kontekst dla każdego agenta)
* **Co budujemy:** Ultrapraktyczną aplikację webową w Pythonie (FastAPI + nowoczesny frontend SPA bez bundlera), wzorowaną na **Speakly**, która w **3–4 minuty** buduje pewność siebie (*Confidence*) samodzielnego inwestora i doprowadza go do gotowości wykonania pierwszej inwestycji w banku.
* **Priorytet absolutny:** To jest **prototyp na 5-minutową prezentację na żywo**. Najważniejsze jest to, **co widać na ekranie**: płynność, dopaminowe mikro-efekty, błyskawiczne działanie wykresów i 100% niezawodności na scenie.
* **Spełnienie wymogów Commerzbank Challenge Card:**
  * 1 kompletna, w pełni działająca misja edukacyjna.
  * Jasny profil odbiorcy i cel edukacyjny (*learning objective*).
  * Dowód na zrozumienie (*understanding* — ocena odpowiedzi przez Lunę) i zaangażowanie (*engagement* — interaktywny wykres, symulacja LIVE, dopaminowy UX).
  * *Innovations for all generations* — natychmiastowa adaptacja treści, horyzontu i scenariuszy pod `20+`, `30-50` i `50+`.

---

## 3. TWARDE ZAKAZY (OUT OF SCOPE — NIE GENERUJ TEGO!)
Agentom AI **kategorycznie zabrania się** implementowania poniższych rzeczy:
* **ZERO autoryzacji:** brak rejestracji, logowania, haseł, JWT, ról użytkowników, sesji w cookies.
* **ZERO baz danych:** brak SQLite, PostgreSQL, SQLAlchemy, Alembic, Redis. Cały stan sesji żyje wyłącznie w słowniku Pythona w pamięci RAM (`SESSIONS: dict[str, dict] = {}`).
* **ZERO narzędzi buildowania frontendu:** nie twórz `package.json`, Node.js, Vite, Webpacka, Reacta ani TypeScriptu. Frontend to czyste pliki w `/static` (`index.html`, `app.js`, `styles.css`) korzystające wyłącznie z oficjalnych linków CDN.
* **ZERO zbędnych podstron:** brak panelu admina, brak strony ustawień, brak listy 20 kursów (jest **1 kompletna misja** dynamicznie personalizowana pod profil).
* **ZERO rozbudowanego security / testów jednostkowych:** wystarczą modele Pydantic + `try/except` z twardym fallbackiem w `luna_service.py`.

---

## 4. Środowisko, zależności i uruchamianie

### Plik `requirements.txt`
```text
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.9.0
openai>=1.55.0
python-dotenv>=1.0.1
```

### Plik `.env.example`
```env
OPENAI_API_KEY=sk-twoj-klucz-lub-klucz-luny
LUNA_MODEL=gpt-4o-mini
LUNA_TIMEOUT_SECONDS=8
```

### Komenda startowa (lokalnie i na prezentacji)
```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Aplikacja musi otwierać się bezpośrednio pod adresem **`http://localhost:8000`** (FastAPI serwuje `static/index.html` na trasie `GET /`).

---

## 5. Podział plików dla 3-osobowego zespołu (Zero konfliktów Git)

| Osoba | Wyłączna własność plików | Pierwszy prompt do wklejenia agentowi (Roo Code / Copilot) |
| :--- | :--- | :--- |
| **Osoba 1: Backend & Luna** | `backend/main.py`<br>`backend/schemas.py`<br>`backend/luna_service.py` | *"Przeczytaj `AGENTS.md`, `docs/02_TECH_API_AND_MATH.md` i `docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`. Wygeneruj `backend/schemas.py`, `backend/main.py` (z serwowaniem `/static`) oraz `backend/luna_service.py` z pełnym JSON mode i bezpiecznym fallbackiem z `demo_data.py`."* |
| **Osoba 2: Matematyka, Dane & Pitch** | `backend/finance_math.py`<br>`backend/demo_data.py`<br>+ slajdy do pitchu | *"Przeczytaj `AGENTS.md`, `docs/02_TECH_API_AND_MATH.md` i `docs/03_LUNA_INTEGRATION_AND_PROMPTS.md`. Wygeneruj `backend/finance_math.py` z dokładnymi wzorami ETF vs Inflacja oraz `backend/demo_data.py` zawierający 3 persony demo, filtry Speakly i kompletne fallbacki dla kroków 1–3."* |
| **Osoba 3: Frontend & Dopamine UX** | `static/index.html`<br>`static/app.js`<br>`static/styles.css` | *"Przeczytaj `AGENTS.md`, `docs/01_PRODUCT_AND_GUI_SPEC.md` i `docs/02_TECH_API_AND_MATH.md`. Zbuduj kompletny, dopaminowy frontend SPA w `/static` (Tailwind CDN, Chart.js, canvas-confetti, Lucide Icons) dokładnie według kontraktu API i palety Commerzbanku."* |

---

## 6. Scenariusz 5-minutowego demo (Golden Path — Checklista Akceptacyjna)
Przed oddaniem projektu przetestujcie dokładnie tę 6-krokową ścieżkę (musi przejść w 100% bez zająknięcia):

1. **0:00 – 0:45 (Hook):** Otwarta strona `http://localhost:8000`. Krótkie wyjaśnienie problemu (paraliż decyzyjny, brak czasu) i inspiracji **Speakly** (maksimum praktyki w minimum czasu).
2. **0:45 – 1:30 (Onboarding `20+` + Filtr Speakly):** Kliknięcie przycisku Demo Mode **`22 l. Student`** w nagłówku -> klik **`Stwórz moją krótką ścieżkę`** -> na ekranie odpala się animacja **przekreślania 7 zbędnych tematów („⚡ Oszczędzasz 4,5h”)** i licznik wyliczonej bezpiecznej kwoty (`300 zł/mies.`).
3. **1:30 – 2:15 (Wehikuł Czasu ETF vs Inflacja):** Przesunięcie suwaka z `1 roku` na `15 lat` -> wykres na żywo pokazuje rozjazd między rosnącym ETF a topniejącą przez inflację gotówką, a szansa na zysk skacze z `73%` do `99%`.
4. **2:15 – 3:30 (Misja LIVE z Luną — 3 tury):** Przejście symulacji (w tym test płynności: zepsuty laptop -> uświadomienie, że pieniądze z ETF można wypłacić!). Pokazanie, że można kliknąć kartę LUB wpisać własną odpowiedź. Pasek **Confidence Meter** rośnie płynnie z `25%` do `100%` z mikro-konfetti.
5. **3:30 – 4:15 (Checklista + Most do Banku):** Odhaczenie 4 punktów checklisty -> wybuch **konfetti** -> klik **`Otwórz szkic pierwszego zlecenia w Commerzbanku`** -> pokazanie gotowego, spersonalizowanego ekranu pierwszego kroku.
6. **4:15 – 5:00 (Innovations for all generations):** Kliknięcie w pasku Demo Mode **`56 l. Ochrona kapitału`** -> natychmiastowy reset na Ekran 1/2 z zupełnie innym horyzontem, tonem, kwotą i odrzuconymi tematami.