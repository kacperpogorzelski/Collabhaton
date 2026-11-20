# 01. SSOT Produktu i Dopaminowego GUI — Finance Quest

## 1. Filozofia Produktu (Model Speakly dla Inwestorów)
* **Główny wskaźnik (North Star):** Maksymalny stosunek **praktycznej wiedzy i pewności siebie** do **poświęconego czasu** (cała misja: **3–4 minuty**).
* **Główny cel biznesowy:** Przełamanie paraliżu decyzyjnego, aby klient możliwie najszybciej i świadomie rozpoczął inwestowanie przez bank (Commerzbank).
* **Zasada „4000 słów” przeniesiona na finanse:** Zamiast uczyć całej teorii rynków finansowych, system filtruje wiedzę do **3 krytycznych mechanizmów dla wieku użytkownika** i jawnie pokazuje, które zbędne tematy zostały wyrzucone.

### Uniwersalne 4 filary wiedzy (obowiązkowe dla każdej grupy wiekowej)
1. **Inflacja = pewna strata na koncie:** Pieniądze leżące bezczynnie na zwykłym koncie tracą realną siłę nabywczą każdego roku.
2. **Bezpieczna kwota startowa:** Wyliczona na podstawie wieku, zarobków, wolnych środków i posiadania poduszki finansowej.
3. **Prosty start (Szerokie ETF-y):** Szeroko zdywersyfikowany, tani ETF zamiast zgadywania pojedynczych spółek.
4. **Dowód historyczny:** Interaktywny wykres pokazujący historyczny wzrost ETF w czasie oraz jak drastycznie spada odsetek okresów ze stratą przy dłuższym horyzoncie.

---

## 2. Matryca 3 Pokoleń (*Innovations for all generations*)

| ID grupy | Etykieta Demo | Główny lęk | Learning Objective (Co uświadamiamy) | Domyślny horyzont | Co system jawnie WYRZUCA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `20+` | `22 l. Student` | „Zamrożę kasę na stałe” + „Mam za mało pieniędzy” | 1. **Płynność:** Wpłacone środki nie są tam permanentnie — można je wypłacić w kilka dni.<br>2. **Efekt skali:** Nawet małe kwoty od młodego wieku dają ogromny wynik dzięki czasowi.<br>3. Inflacja zjada gotówkę. | `15 lat` | Analiza sprawozdań, derywaty, optymalizacja podatkowa, obligacje emerytalne, day-trading, wybór pojedynczych akcji, strategie przedemerytalne |
| `30-50` | `38 l. Rodzina` | „Nie mam czasu na giełdę” + „Boję się o budżet rodziny” | 1. **Automatyzacja:** Pasywne ETF-y działają w tle bez codziennego patrzenia w wykresy.<br>2. **Bezpieczny podział:** Wyraźne oddzielenie nietykalnej poduszki od pracujących nadwyżek.<br>3. Inflacja zjada oszczędności. | `10 lat` | Day-trading, spekulacja krypto, analiza techniczna, podstawy obsługi konta, krótkoterminowy forex, opcje, lewarowanie |
| `50+` | `56 l. 50+` | „Jest już za późno na inwestowanie” + „Stracę dorobek” | 1. **Wiek nie wyklucza:** Inwestować można w każdym wieku — wystarczy dopasować horyzont i proporcje.<br>2. **Tarcza antyinflacyjna:** Ochrona siły nabywczej kapitału przed inflacją. | `7 lat` | Agresywne strategie na 30 lat, dźwignia finansowa, kryptowaluty, startupy wysokiego ryzyka, day-trading, spekulacja opcjami, modne spółki memowe |

---

## 3. System Wizualny i Zależności CDN (Do `static/index.html`)

### Obowiązkowe zasoby CDN (w `<head>`):
```html
<!-- Font: Plus Jakarta Sans -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<!-- Canvas Confetti -->
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
<!-- Lucide Icons -->
<script src="https://unpkg.com/lucide@latest"></script>
```

### Paleta kolorów (Konfiguracja Tailwind w `<script>`):
* **`brand-dark`:** `#002E3C` (głęboki petrol Commerzbanku — nagłówki, zaufanie, wysoki kontrast).
* **`brand-yellow`:** `#FFCC00` (akcent Commerzbanku — główne przyciski CTA 3D, badge'e).
* **`brand-yellow-dark`:** `#D9A900` (dolna krawędź 3D przycisków CTA).
* **`etf-green`:** `#10B981` (wzrost ETF, dobre odpowiedzi, odhaczone kroki, wysoka szansa na zysk).
* **`inflation-red`:** `#F43F5E` (utrata siły nabywczej przez inflację, przekreślane zbędne tematy).
* **`surface-bg`:** `#F8FAFC` (czyste, jasne tło — świetnie czytelne na rzutniku).
* **`card-bg`:** `#FFFFFF` (zaokrąglenie `rounded-3xl`, cień `shadow-xl shadow-slate-200/60`, obramowanie `border border-slate-100`).

### Obowiązkowe mikro-animacje CSS (`static/styles.css`):
1. **Przycisk 3D w stylu Duolingo/Speakly (`.btn-3d`):**
   * Tło `#FFCC00`, tekst `#002E3C` (`font-extrabold`), dolna krawędź `border-bottom: 4px solid #D9A900`, `border-radius: 1rem`.
   * Na `:hover` lekkie rozjaśnienie; na `:active` `transform: translateY(3px); border-bottom-width: 1px;`.
2. **Animacja wejścia ekranów (`.screen-enter`):**
   * `@keyframes fadeSlideUp`: od `opacity: 0; transform: translateY(16px)` do `opacity: 1; transform: translateY(0)` w `0.35s cubic-bezier(0.16, 1, 0.3, 1)`.
3. **Błysk na pasku Pewności Siebie (`.shimmer-bar`):**
   * Przesuwający się biały refleks świetlny po pasku postępu przy każdym wzroście `confidence_score`.
4. **Animacja „Cięcia Zbędnej Wiedzy” (`.topic-strike`):**
   * Kafelki zbędnych tematów z `speakly_filter.removed_topics` pojawiają się na `400ms`, po czym sekwencyjnie (co `120ms`) dostają linię przekreślenia (`line-through`), czerwony odcień i zmniejszają przezroczystość do `0.45`, a obok wybija się zielony badge **`⚡ Zaoszczędzono X h`**.
5. **Pulsowanie finałowego CTA (`.glow-pulse`):**
   * Po odhaczeniu wszystkich 4 punktów checklisty przycisk przejścia do Commerzbanku otrzymuje delikatny, złoty cień pulsujący.
6. **Cyfry tabelaryczne (`.tabular-nums`):**
   * Wszystkie animowane kwoty pieniędzy i procenty muszą mieć `font-variant-numeric: tabular-nums`, żeby tekst nie „skakał” na boki podczas animacji count-up.

---

## 4. Stały Nagłówek Aplikacji (Widoczny na każdym ekranie)
* **Lewa strona:** Logo/nazwa **`Finance Quest`** + podtytuł `by Commerzbank • Speakly Method`.
* **Środek (widoczny od Ekranu 2):** **Confidence Meter** — poziomy pasek postępu z etykietą `Pewność inwestycyjna: XX%` i małym animowanym badge'em `+XX%` przy każdym wzroście.
* **Prawa strona (DEMO MODE):** 3 kompaktowe pigułki (z ikoną iskry):
  * `[22 l. Student]` -> wypełnia profil `young_20` i przechodzi do Ekranu 1 (lub uruchamia analizę).
  * `[38 l. Rodzina]` -> wypełnia profil `mid_38`.
  * `[56 l. 50+]` -> wypełnia profil `senior_56`.

---

## 5. Specyfikacja 4 Ekranów + Modal Bankowy (Mapowanie 1:1 do API)

### Ekran 1: `screen_onboarding` (Szybki Profil — 30 sek.)
* **Nagłówek:** *„Zacznij inwestować w 4 minuty. Zero zbędnej teorii.”*
* **Podtytuł:** *„Podaj 4 liczby — wytniemy wszystko, czego nie potrzebujesz na Twoim etapie życia.”*
* **Formularz (w jednej eleganckiej karcie):**
  1. **Wiek:** suwak `18–70` + duży podgląd liczby + dynamiczny tag grupy (`20+` / `30–50` / `50+`). Pole API: `age`.
  2. **Miesięczne zarobki netto (zł):** suwak `2 500 – 25 000` (krok `500`) + pole edycji. Pole API: `net_income`.
  3. **Wolne środki miesięcznie po opłatach (zł):** suwak `200 – 10 000` (krok `100`). Pole API: `free_cash`.
  4. **Poduszka finansowa (min. 3 mies. wydatków):** 2 duże klikalne kafelki wyboru (`Tak, mam bezpieczną poduszkę` / `Jeszcze ją buduję`). Pole API: `has_emergency_fund`.
* **Akcja CTA:** Przycisk `.btn-3d`: **`Stwórz moją krótką ścieżkę ->`** -> wywołuje `POST /api/onboarding/analyze`. Podczas ładowania pokazuje 0,8s animację *„Filtruję zbędną teorię dla Twojego wieku...”*.

### Ekran 2: `screen_filter_and_timemachine` (Filtr Speakly + Wehikuł Czasu ETF)
Dane pochodzą w 100% z odpowiedzi `POST /api/onboarding/analyze`:
1. **Karta A — Filtr Speakly (Dowód ROI czasu):**
   * Badge: `⚡ Zaoszczędzono {speakly_filter.time_saved_hours}h zbędnej nauki`.
   * Lewa kolumna (zielona, wyraźna): **`Twoje 3 kluczowe rzeczy na dziś`** -> lista `speakly_filter.kept_topics`.
   * Prawa kolumna (animacja `.topic-strike`): **`Wyrzuciliśmy dla Ciebie`** -> lista `speakly_filter.removed_topics` przekreślana na oczach użytkownika.
2. **Karta B — Ile z wolnych środków warto zainwestować:**
   * Wielki animowany licznik (count-up): **`{safe_investment.min_monthly} – {safe_investment.max_monthly} zł / mies.`** (domyślnie do symulacji: `{safe_investment.recommended_monthly} zł`).
   * Jedno zdanie wyjaśnienia: `{safe_investment.reasoning}`.
3. **Karta C — Wehikuł Czasu: Inflacja vs Szeroki ETF:**
   * Duży suwak lat: **`1 rok` do `20 lat`** (domyślnie ustawiony na `default_horizon_years`: `15` / `10` / `7`).
   * **3 kafelki KPI aktualizowane na żywo przy przesuwaniu suwaka** (bez zapytań do API — czytane z `projection_series[year - 1]`):
     * Kafelek 1 (Czerwony): *„Gotówka na koncie (realnie po inflacji)”* -> `cash_real_value` zł.
     * Kafelek 2 (Zielony): *„Szeroki ETF (historyczna średnia)”* -> `etf_value` zł.
     * Kafelek 3 (Złoty/Zielony): *„Historyczna szansa, że inwestor nie stracił”* -> **`{historical_win_rate}%`** (z małym paskiem postępu i napisem: *„Tylko {100 - historical_win_rate}% okresów historycznych kończyło się stratą”*).
   * **Wykres `Chart.js` (Line Chart):** 2 gładkie linie od roku `1` do wybranego roku `year`:
     * Zielona z wypełnieniem gradientowym: `Szeroki ETF (historycznie)`.
     * Czerwona przerywana: `Gotówka na koncie (po inflacji)`.
* **Akcja CTA:** Przycisk `.btn-3d`: **`Przetestuj to w 2-minutowej sytuacji LIVE z Luną ->`** -> przejście do Ekranu 3.

### Ekran 3: `screen_mission_live` (Interaktywna Misja LIVE z Luną — 3 kroki)
* **Górny mini-panel misji:**
  * Badge kroku: `Krok {step_number} z 3`.
  * Symulowany portfel: `Portfel w symulacji: {portfolio_status.simulated_value} zł` (animowany count-up).
  * Etykieta zdarzenia: `{portfolio_status.event_badge}` (np. `Nagły wydatek • Test płynności`).
* **Karta feedbacku (pojawia się po Kroku 1 i 2):**
  * Zielony/niebieski dymek z ikoną mózgu/tarczy: `{understanding_feedback}` (dowód realnej oceny zrozumienia!).
* **Główna karta wypowiedzi Luny:**
  * Awatar **Luny** + krótki, wyrazisty tekst `{luna_message}` (max 2–3 zdania).
  * Podczas oczekiwania na API: animowane 3 kropki *„Luna analizuje Twoją decyzję...”*.
* **Interakcja użytkownika (dwie równorzędne ścieżki):**
  * **Karty szybkich decyzji (`quick_replies`):** 3 estetyczne, klikalne karty (`.hover:scale-[1.01]`). Kliknięcie od razu wysyła wybraną treść do `POST /api/mission/turn`.
  * **Własna odpowiedź:** Pole tekstowe (`placeholder="Lub napisz własnymi słowami, co robisz i dlaczego..."`) + przycisk `Wyślij`.
* **Efekt dopaminowy:** Gdy odpowiedź API ma `trigger_confetti: true`, odpala się lekki burst `confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } })`.
* **Zakończenie:** Gdy `mission_completed === true`, wyświetla się podsumowanie od Luny oraz duży przycisk **`Odbierz swoją Checklistę Pierwszego Kroku ->`** (przejście na Ekran 4).

### Ekran 4: `screen_checklist` (Checklista + Konwersja do Commerzbanku)
* **Nagłówek zwycięstwa:** Duży badge **`🎉 Gotowość Inwestycyjna: 100%`** + krótki wniosek końcowy od Luny.
* **Interaktywna Checklista (4 pozycje z `final_checklist`):**
  * Każdy punkt to klikalna karta z dużym checkboxem.
  * Kliknięcie zaznacza punkt z animacją podskoku (*bounce*), zmienia tło na jasną zieleń i odtwarza mikro-efekt.
  * Zaznaczenie wszystkich 4 punktów odpala **pełne konfetti w kolorach Commerzbanku** (`['#FFCC00', '#002E3C', '#10B981']`) i włącza klasę `.glow-pulse` na przycisku bankowym.
* **Karta „Twój Szkic Pierwszej Inwestycji” (z `bank_draft`):**
  * Pokazuje gotowe, spersonalizowane parametry:
    * Kwota miesięczna: `{bank_draft.monthly_amount} zł`
    * Horyzont: `{bank_draft.horizon_years} lat`
    * Typ instrumentu (edukacyjny): `{bank_draft.instrument_category}` (np. `Szeroki, globalny fundusz ETF (akumulujący)`)
    * Szacowany cel historyczny: `{bank_draft.projected_etf_value} zł`
  * Przycisk `.btn-3d`: **`Przenieś ten szkic do konta w Commerzbanku ->`** -> otwiera `modal_bank_order`.
* **Compliance Disclaimer (drobny, czytelny tekst na dole):**
  * *„Aplikacja Finance Quest ma charakter wyłącznie edukacyjny i symulacyjny. Wyliczenia bazują na uśrednionych danych historycznych, nie gwarantują przyszłych wyników i nie stanowią doradztwa inwestycyjnego w rozumieniu dyrektywy MiFID II.”*

### Modal końcowy: `modal_bank_order` (Ekran „Zero-Friction Handoff”)
* Estetyczny modal imitujący bezpieczny ekran bankowości Commerzbanku z już **wstępnie wypełnionym** planem regularnego inwestowania:
  * Miesięczna wpłata: `{bank_draft.monthly_amount} zł`
  * Horyzont: `{bank_draft.horizon_years} lat`
  * Status: `Gotowy do uruchomienia na koncie maklerskim Commerzbank`
  * Przycisk: **`Symuluj aktywację planu (Demo)`** -> wyświetla zielony ekran sukcesu *„Gratulacje! Zrobiłeś pierwszy krok w mniej niż 4 minuty”* + przycisk **`Przetestuj inne pokolenie (Demo)`**.