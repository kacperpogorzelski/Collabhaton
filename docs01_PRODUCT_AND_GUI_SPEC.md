# 01. SSOT Produktu, Grywalizacji i Dopaminowego GUI — Finance Quest

## 1. Filozofia Produktu (Realistyczny Model Speakly dla Początkujących Inwestorów)
* **Odbiorca:** Początkujący, samodzielni inwestorzy indywidualni (*self-directed investors*) na różnych etapach życia.
* **Realistyczny rytm nauki (Produkt docelowy):** Nie budujemy jednorazowego quizu „zostań inwestorem w 5 minut”, bo prawdziwa pewność siebie wymaga powtarzalności. Wzorem **Speakly** klient korzysta z aplikacji regularnie — **5–10 minut dziennie przez 14 dni** (*„Od zera do pierwszej świadomej inwestycji w 14 dni”*).
* **Główny wskaźnik (North Star):** Maksymalny stosunek **praktycznej wiedzy i realnej gotowości** do **poświęconego czasu** — zero zbędnej teorii, wyłącznie decyzje i nawyki potrzebne do świadomego startu w banku.
* **Zakres prototypu na hackathon:** Prototyp demonstruje w 100% interaktywnie **kompletną misję Dnia 1 z 14** (którą jury przechodzi w 3–4 minuty na prezentacji) oraz wyświetla **14-dniową mapę dalszej ścieżki**, dzięki czemu mechaniki nawykowe (streak, poziomy, ranking, realne mikro-wyzwania) są w pełni spójne i wiarygodne biznesowo.

### Uniwersalne 4 filary wiedzy (wdrażane od Dnia 1 dla każdej grupy wiekowej)
1. **Inflacja = pewna strata na koncie:** Pieniądze leżące bezczynnie na zwykłym koncie realnie tracą wartość każdego roku.
2. **Bezpieczna kwota docelowa:** Wyliczona na podstawie wieku, zarobków, wolnych środków i poduszki finansowej — klient od pierwszego dnia wie, do jakiej kwoty dąży.
3. **Prosty start (Szerokie ETF-y):** Szeroko zdywersyfikowany, tani ETF zamiast zgadywania pojedynczych spółek.
4. **Dowód historyczny:** Interaktywny wykres pokazujący wzrost szerokiego ETF w czasie oraz drastyczny spadek ryzyka straty przy dłuższym horyzoncie.

---

## 2. Mechaniki Grywalizacji i Budowania Nawyku (Dopamina bez zbędnego backendu)
Każdy element grywalizacji wspiera regularny powrót do aplikacji przez 14 dni oraz płynne przejście od wiedzy do działania w banku:
1. **Ankieta na początku (Ekran 1):** 4 proste suwaki/wybory układające spersonalizowany 14-dniowy plan Speakly i bezpieczną kwotę docelową.
2. **Mapa 14-Dniowej Ścieżki (Ekran 2):** Kompaktowa oś 4 kamieni milowych (`Dzień 1` aktywny + `Dzień 4`, `Dzień 9`, `Dzień 14` jako zablokowane kłódką kolejne etapy), jasno pokazująca, że to regularny program wdrożeniowy.
3. **Mikro-lekcje „w pigułce” na Dzień 1 (Ekran 2):** 3 wyselekcjonowane tematy prezentowane jako klikalne, 20-sekundowe karty („1 fakt + 1 konkret”), które użytkownik odhacza za `+15 XP` każda przed wejściem do symulacji.
4. **Codzienny AI Coach (Luna) + Symulacja Wyborów (Ekran 3):** 3-krokowa symulacja życiowych decyzji finansowych dla Dnia 1, dopasowana do wieku i kwot użytkownika.
5. **Realistyczny Wskaźnik Gotowości Inwestycyjnej (`Confidence / Readiness`):** W przeciwieństwie do nierealnych „100% w 3 minuty”, pasek gotowości rośnie w Dniu 1 z **`10%`** do **`40%` (`+30%` w pierwszy dzień!)**, jasno komunikując, że kolejne dni podniosą gotowość do `100%` (Dzień 14).
6. **Poziomy, XP i Awansowanie (Nagłówek + Ekran 4):**
   * Start w Dniu 1: **`Poziom 1: Obserwator`** (`20 / 100 XP`).
   * Ukończenie misji Dnia 1 podbija XP do `155` i wyzwala spektakularną kartę **`🏆 AWANS! Poziom 2: Świadomy Start`**.
7. **Streak (Seria dni) — Nagłówek:** Pigułka **`🔥 Dzień 1`** (po ukończeniu sesji animuje się komunikatem *„Seria rozpoczęta! Wróć jutro po Dzień 2”*).
8. **Realne Mikro-Wyzwanie „Zero Strachu” na Dzień 1 (Ekran 4):** Aby budować nawyk działania od pierwszego dnia (zanim klient zainwestuje pełną kwotę w Dniu 14), dostaje natychmiastowe, mikroskopijne zadanie: np. ***„Realne wyzwanie na Dzień 1: Wpłać 5 zł na konto oszczędnościowe”*** (dla `20+` lub bez poduszki: 5 zł; dla `30-50` / `50+` z poduszką: 50 zł testowo na subkonto startowe). Kliknięcie **`Podejmuję wyzwanie (+50 XP)`** odpala konfetti i podnosi wynik w backendzie ze `155` do `205 XP` (tuż za 1. miejscem `Kasia K. — 210 XP`, brakuje już tylko `5 XP`, co motywuje do powrotu na Dzień 2!).
9. **Ranking i Wyzwania z Kolegami (Ekran 4 — Mockowany widget społecznościowy):**
   * Tabela „Ranking znajomych (Ten tydzień)” z 4 pozycjami (3 zmockowanych znajomych + **Ty**). Po Dniu 1 użytkownik awansuje w tabeli na **#2 miejsce** (`155 XP`), a po przyjęciu mikro-wyzwania (`+50 XP`) zbliża się na `205 XP` do lidera (`Kasia K. — 210 XP`).
   * Przycisk **`⚔️ Wyzwij znajomego`**: kopiuje do schowka zaproszenie (np. *„Ukończyłem Dzień 1 z 14 w Finance Quest i awansowałem na Poziom 2! Dołącz do mojego 14-dniowego wyzwania inwestycyjnego -> [link]”*) i pokazuje zielony toast.

---

## 3. Matryca 3 Pokoleń (*Innovations for all generations*)

| ID grupy | Etykieta Demo | Główny lęk | Learning Objective (Dzień 1 z 14) | Domyślny horyzont | Realne Mikro-Wyzwanie (Dzień 1) | Co system jawnie WYRZUCA z 14-dniowego planu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `20+` | `22 l. Student` | „Zamrożę kasę na stałe” + „Mam za mało pieniędzy” | 1. **Płynność:** Wpłacone środki nie są tam permanentnie — można je wypłacić w kilka dni.<br>2. **Efekt skali:** Małe kwoty od młodego wieku dają ogromny wynik.<br>3. Inflacja zjada gotówkę. | `15 lat` | **Wpłać 5 zł na konto oszczędnościowe** dziś wieczorem, aby przełamać barierę pierwszego przelewu. | Analiza sprawozdań, derywaty, optymalizacja podatkowa, obligacje emerytalne, day-trading, wybór pojedynczych akcji, strategie przedemerytalne |
| `30-50` | `38 l. Rodzina` | „Nie mam czasu na giełdę” + „Boję się o budżet rodziny” | 1. **Automatyzacja:** Pasywne ETF-y działają w tle bez patrzenia w wykresy.<br>2. **Bezpieczny podział:** Oddzielenie poduszki od pracujących nadwyżek.<br>3. Inflacja zjada oszczędności. | `10 lat` | **Przelej próbne 50 zł na subkonto celowe** (lub ustaw mikro-zlecenie), by poczuć automatyzację bez wysiłku. | Day-trading, spekulacja krypto, analiza techniczna, podstawy obsługi konta, krótkoterminowy forex, opcje, lewarowanie |
| `50+` | `56 l. 50+` | „Jest już za późno na inwestowanie” + „Stracę dorobek” | 1. **Wiek nie wyklucza:** Inwestować można w każdym wieku — wystarczy dopasować horyzont.<br>2. **Tarcza antyinflacyjna:** Ochrona siły nabywczej kapitału przed inflacją. | `7 lat` | **Wydziel pierwsze 50 zł na bezpieczne subkonto startowe**, aby bez stresu oswoić pierwszy ruch w banku. | Agresywne strategie na 30 lat, dźwignia finansowa, kryptowaluty, startupy wysokiego ryzyka, day-trading, spekulacja opcjami, spółki memowe |

---

## 4. System Wizualny i Zależności CDN (Do `static/index.html`)

### Obowiązkowe zasoby CDN (w `<head>`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
<script src="https://unpkg.com/lucide@latest"></script>
```

### Paleta kolorów (Konfiguracja Tailwind w `<script>`):
* **`brand-dark`:** `#002E3C` (głęboki petrol Commerzbanku — nagłówki, zaufanie, wysoki kontrast).
* **`brand-yellow`:** `#FFCC00` (akcent Commerzbanku — główne przyciski CTA 3D, badge'e poziomu).
* **`brand-yellow-dark`:** `#D9A900` (dolna krawędź 3D przycisków CTA).
* **`etf-green`:** `#10B981` (wzrost ETF, dobre odpowiedzi, odhaczone kroki, awans w rankingu).
* **`inflation-red`:** `#F43F5E` (utrata siły nabywczej przez inflację, przekreślane zbędne tematy).
* **`streak-orange`:** `#F97316` (ikona płomienia streaka i wyzwania z kolegami).
* **`surface-bg`:** `#F8FAFC` (czyste, jasne tło — świetnie czytelne na rzutniku).
* **`card-bg`:** `#FFFFFF` (zaokrąglenie `rounded-3xl`, cień `shadow-xl shadow-slate-200/60`, obramowanie `border border-slate-100`).

### Obowiązkowe mikro-animacje CSS (`static/styles.css`):
1. **Przycisk 3D (`.btn-3d`):** Tło `#FFCC00`, tekst `#002E3C` (`font-extrabold`), `border-bottom: 4px solid #D9A900`, `border-radius: 1rem`. Na `:active`: `transform: translateY(3px); border-bottom-width: 1px;`.
2. **Animacja wejścia ekranów (`.screen-enter`):** `@keyframes fadeSlideUp` (`0.35s cubic-bezier(0.16, 1, 0.3, 1)`).
3. **Błysk na pasku Gotowości i XP (`.shimmer-bar`):** Przesuwający się biały refleks świetlny przy każdym wzroście.
4. **Animacja „Cięcia Zbędnej Wiedzy” (`.topic-strike`):** Kafelki zbędnych tematów sekwencyjnie (co `120ms`) dostają `line-through`, czerwony akcent i `opacity: 0.45`, a obok wybija się zielony badge **`⚡ Zaoszczędzono X h`**.
5. **Animacja „LEVEL UP” (`.level-pop`):** Dynamiczny bounce + złota poświata karty awansu na Ekranie 4.
6. **Pulsowanie finałowego CTA (`.glow-pulse`):** Po odhaczeniu checklisty Dnia 1 przycisk bankowy dostaje pulsujący złoty cień.
7. **Cyfry tabelaryczne (`.tabular-nums`):** Dla wszystkich kwot, XP i procentów.

---

## 5. Stały Nagłówek Aplikacji (Widoczny na każdym ekranie)
* **Lewa strona:** Logo/nazwa **`Finance Quest`** + podtytuł `by Commerzbank • Plan 14 Dni`.
* **Środek (Pasek Postępu i Grywalizacji):**
  * **Badge Programu:** `📅 Dzień 1 z 14` (jasny sygnał regularnej ścieżki nauki).
  * **Badge Poziomu:** `⭐ Poz. 1: Obserwator (20 XP)` -> zmienia się w `🏆 Poz. 2: Świadomy Start` po Dniu 1!
  * **Badge Streaka:** `🔥 1 dzień` (pigułka w kolorze `#F97316`).
  * **Readiness / Confidence Meter (od Ekranu 2):** Pasek `Gotowość: XX%` (rośnie realistycznie z `10%` do `40%` w Dniu 1 z animowanym `+10%`).
* **Prawa strona (DEMO MODE):** 3 kompaktowe pigułki: `[22 l. Student]`, `[38 l. Rodzina]`, `[56 l. 50+]`.

---

## 6. Specyfikacja 4 Ekranów + Modal Bankowy (Mapowanie 1:1 do API)

### Ekran 1: `screen_onboarding` (Ankieta na początku — ułożenie 14-dniowej ścieżki)
* **Nagłówek:** *„Zbuduj pewność inwestycyjną w 14 dni. Po 5 minut dziennie.”*
* **Podtytuł:** *„Krótka ankieta wytnie zbędną teorię w stylu Speakly i ułoży Twój codzienny plan z mikro-lekcjami, symulacjami i bezpieczną kwotą docelową.”*
* **Formularz:**
  1. **Wiek:** suwak `18–70` + tag grupy (`20+` / `30–50` / `50+`). Pole API: `age`.
  2. **Miesięczne zarobki netto (zł):** suwak `2 500 – 25 000` (krok `500`). Pole API: `net_income`.
  3. **Wolne środki miesięcznie po opłatach (zł):** suwak `200 – 10 000` (krok `100`). Pole API: `free_cash`. UI pilnuje `free_cash <= net_income` (obniżenie `net_income` poniżej `free_cash` automatycznie dopasowuje suwak `free_cash` w dół).
  4. **Poduszka finansowa (min. 3 mies. wydatków):** 2 duże kafelki (`Tak, mam poduszkę` / `Jeszcze ją buduję`). Pole API: `has_emergency_fund`.
* **Akcja CTA:** `.btn-3d`: **`Ułóż mój 14-dniowy plan Speakly ->`** -> wywołuje `POST /api/onboarding/analyze`.

### Ekran 2: `screen_filter_and_timemachine` (Mapa 14 Dni + Filtr Speakly + Mikro-Lekcje Dnia 1 + Wehikuł Czasu)
Dane pochodzą z `POST /api/onboarding/analyze`:
1. **Karta A — Twoja 14-Dniowa Mapa Nauki (`roadmap_milestones` — pasek 4 kroków na górze):**
   * Pozioma oś pokazująca 4 kluczowe kamienie milowe (np. `Dzień 1: Inflacja i pierwszy krok [Aktywny - Dziś]`, `Dzień 4: ... [🔒]`, `Dzień 9: ... [🔒]`, `Dzień 14: Pierwsza inwestycja w Commerzbanku [🔒]`).
2. **Karta B — Filtr Speakly + 3 Mikro-Lekcje Dnia 1:**
   * Badge: `⚡ Zaoszczędzono {speakly_filter.time_saved_hours}h zbędnej nauki`.
   * **Lewa kolumna (3 klikalne Mikro-Lekcje Dnia 1 z `micro_lessons`):** Każda karta pokazuje tytuł, czas (`20 sek.`), 1-zdaniowy konkret oraz przycisk `Rozumiem! (+15 XP)` — kliknięcie odhacza kartę na zielono i podbija lokalny bonus `microLessonBonusXp` w stanie UI (maks. `+45 XP`, opcjonalne — nie blokuje przejścia dalej). **Reguła monotonicznego XP w nagłówku:** pasek XP zawsze wyświetla `gamification.xp + microLessonBonusXp`, aby po wejściu na Ekran 3 (gdzie backend zwraca bazowe `xp = 60 / 95 / 155`) licznik XP w nagłówku nigdy nie cofnął się w dół; poziom i awans (`Poziom 2`) wynikają zawsze z `gamification.level` / `gamification.leveled_up` z backendu.
   * **Prawa kolumna (`.topic-strike`):** Lista `speakly_filter.removed_topics` przekreślana na oczach użytkownika (*„Wyrzuciliśmy to z Twojego 14-dniowego planu”*).
3. **Karta C — Twoja Docelowa Bezpieczna Kwota:**
   * Animowany licznik: **`{safe_investment.min_monthly} – {safe_investment.max_monthly} zł / mies.`** (kwota do symulacji: `{safe_investment.recommended_monthly} zł`).
   * Wyjaśnienie: `{safe_investment.reasoning}`.
4. **Karta D — Wehikuł Czasu: Inflacja vs Szeroki ETF:**
   * Suwak lat `1 – 20` (domyślnie `default_horizon_years`).
   * 3 kafelki KPI aktualizowane na żywo z `projection_series[year - 1]`:
     * Czerwony: *„Gotówka na koncie (po inflacji)”* -> `cash_real_value` zł.
     * Zielony: *„Szeroki ETF (historycznie)”* -> `etf_value` zł.
     * Złoty/Zielony: *„Historyczna szansa bez straty”* -> **`{historical_win_rate}%`**.
   * Wykres `Chart.js` (2 linie: zielony ETF vs czerwona gotówka po inflacji): przed `projection_series.slice(0, year)` wykres zawsze dopina punkt początkowy `Rok 0` (`etf=0`, `cash=0`), dzięki czemu nawet przy suwaku na `1 rok` widać wyraźnie dwie rozchodzące się krzywe. Wywołania `fetch` w `app.js` używają ścieżek względnych `/api/...` (z fallbackiem na `http://localhost:8000` przy uruchomieniu przez `file://`).
* **Akcja CTA:** `.btn-3d`: **`Rozpocznij Symulację Dnia 1 z AI Coachem ->`** -> Ekran 3.

### Ekran 3: `screen_mission_live` (Symulacja Wyborów Dnia 1 z AI Coachem Luną — 3 kroki)
* **Górny mini-panel:**
  * Badge kroku: `Dzień 1 z 14 • Symulacja wyborów • Krok {step_number} z 3`.
  * Symulowany portfel: `{portfolio_status.simulated_value} zł` (count-up).
  * Etykieta zdarzenia: `{portfolio_status.event_badge}`.
* **Karta feedbacku AI Coacha (po Kroku 1 i 2):** Zielony/niebieski dymek z `{understanding_feedback}` + pigułka `+35 XP`.
* **Główna karta AI Coacha (Luny):** Awatar z podpisem **`Luna • Twój codzienny AI Coach`** + krótki scenariusz `{luna_message}`.
* **Interakcja (Symulacja Wyborów):**
  * 3 klikalne karty decyzji (`quick_replies`).
  * Pole tekstowe dla własnej odpowiedzi (`placeholder="Lub napisz AI Coachowi własnymi słowami, co robisz i dlaczego..."`).
* **Dopamina:** Gdy `trigger_confetti: true` -> lekki burst konfetti + podbicie paska Gotowości (`10% -> 20% -> 30% -> 40%`) i XP w nagłówku.
* **Zakończenie Dnia 1 (`mission_completed === true`):** Przycisk `.btn-3d`: **`Zakończ Dzień 1 i odbierz Awans ->`** -> Ekran 4.

### Ekran 4: `screen_checklist` (Ukończenie Dnia 1, Awans, Realne Wyzwanie 5 zł, Ranking i Commerzbank)
Układ 2-kolumnowy na desktopie (1 kolumna na mobile), zaprojektowany na mocny finał prezentacji:
1. **Baner Ukończenia Dnia 1 i Awansu (`.level-pop`, pełna szerokość na górze):**
   * **`🏆 DZIEŃ 1 Z 14 UKOŃCZONY! AWANS: {gamification.level_title}`** (`Poziom {gamification.level}` • `{gamification.xp} XP` • `🔥 Seria: 1 dzień` • `Gotowość inwestycyjna: 40% (+30% dziś!)`).
   * Podpis: *„Świetny start! Wróć jutro na 5-minutowy Dzień 2, a dziś przełam pierwszą barierę małym realnym wyzwaniem poniżej.”*
2. **Lewa kolumna — Realne Działanie Dziś:**
   * **Karta 1: Realne Mikro-Wyzwanie na Dzień 1 (`real_world_challenge`):**
     * Wyróżniona złotą ramką `#FFCC00` z ikoną błyskawicy: np. **`Realne Wyzwanie Dnia 1: Wpłać 5 zł na konto oszczędnościowe`** (`description`: *„Zanim za 2 tygodnie ruszysz z regularnym ETF-em, przełam dziś barierę pierwszego przelewu symboliczną kwotą 5 zł!”*).
     * Przycisk: **`Podejmuję wyzwanie (+{reward_xp} XP)`** -> wywołuje `POST /api/challenge/accept`, zmienia się w zielony badge `✅ Wyzwanie przyjęte! +50 XP`, odpala konfetti, podnosi XP w backendzie ze `155` do `205 XP` (brakuje tylko `5 XP` do 1. miejsca `Kasia K. — 210 XP`) i odświeża tabelę Rankingu Znajomych!
   * **Karta 2: Interaktywna Checklista Dnia 1 (`final_checklist` — 4 pozycje):**
     * Odhaczenie wszystkich 4 punktów odpala pełne konfetti Commerzbanku i włącza `.glow-pulse` na przycisku bankowym.
3. **Prawa kolumna — Bank i Społeczność:**
   * **Karta 3: Podgląd Twojego Planu w Commerzbanku (`bank_draft`):**
     * Pokazuje 2 konkretne kroki: mikro-ruch już dziś (`{real_world_challenge.amount_pln} zł`) oraz docelowy plan regularny na koniec 14-dniowej ścieżki (`{bank_draft.monthly_amount} zł/mies.`, horyzont `{bank_draft.horizon_years} lat`, prognoza historyczna) + przycisk `.btn-3d`: **`Wykonaj krok Dnia 1 lub zobacz szkic w Commerzbanku ->`** (otwiera `modal_bank_order`).
   * **Karta 4: Ranking Znajomych & Wyzwanie (`leaderboard`):**
     * Lista 4 osób z punktami XP i serią `🔥`. Wiersz użytkownika (`is_current_user: true`) podświetlony na żółto-zielono z badge'em **`⬆️ Awans!`** (`155 XP` na #2 miejscu, a po przyjęciu mikro-wyzwania `205 XP` — zaledwie `5 XP` za 1. miejscem).
     * Przycisk **`⚔️ Wyzwij znajomego`** -> kopiuje zaproszenie do 14-dniowego wyzwania do schowka i pokazuje zielony toast.
4. **Stopka (Compliance):** Krótki disclaimer edukacyjny (brak doradztwa inwestycyjnego MiFID II).

### Modal końcowy: `modal_bank_order` (Ekran „Zero-Friction Handoff”)
* Imituje czysty ekran aplikacji Commerzbanku z dwoma czytelnymi opcjami:
  * **Opcja A — Krok na Dziś (Dzień 1, polecane dla początkujących):** Jednorazowy mikro-przelew z Realnego Wyzwania (`{real_world_challenge.amount_pln} zł` na `{real_world_challenge.target_account}`) — zero stresu, natychmiastowe przełamanie lęku.
  * **Opcja B — Docelowy Plan ETF (Cel na Dzień 14, lub dla gotowych już dziś):** Regularnie `{bank_draft.monthly_amount} zł / mies.` na horyzont `{bank_draft.horizon_years} lat` (`{bank_draft.instrument_category}`).
* Przycisk: **`Symuluj wykonanie kroku w banku (Demo)`** -> ekran sukcesu *„Brawo! Krok Dnia 1 zaliczony — Twoja seria trwa, widzimy się jutro na Dniu 2!”* + przycisk **`Przetestuj inne pokolenie (Demo)`**.