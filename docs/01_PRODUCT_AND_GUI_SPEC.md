# 01. SSOT Produktu i Dopaminowego GUI — Finance Quest

> **Wersja po rewizji (v2).** Zawiera poprawki z `poprawki.txt` i `oprawki_claude.txt`. Kontrakt pól API i matematyka: `02_TECH_API_AND_MATH.md`.

## 1. Filozofia Produktu (Model Speakly dla Inwestorów)
* **Główny wskaźnik (North Star):** Maksymalny stosunek **praktycznej wiedzy i pewności siebie** do **poświęconego czasu** (cała misja: **3–4 minuty**).
* **Główny cel biznesowy:** Przełamanie paraliżu decyzyjnego, aby klient możliwie najszybciej i świadomie rozpoczął **oszczędzanie i inwestowanie** przez bank (Commerzbank). Patrz §3 (wartość dla banku).
* **Zasada „4000 słów" przeniesiona na finanse:** Zamiast uczyć całej teorii rynków, system filtruje wiedzę do **3 priorytetowych tematów** dla użytkownika i jawnie pokazuje, **czego nie musi robić** na starcie.
* **Zasada uczciwości (twarda):** Aplikacja ma budować pewność **opartą na rozumieniu**, nie na obietnicach. Nigdy nie pokazujemy gwarantowanego zysku, 100% pewności ani liczb bez jawnych założeń (patrz §7).

### Uniwersalne 4 filary wiedzy (minimum dla każdego; odpowiadają 4 punktom checklisty)
1. **Inflacja = realna strata wartości gotówki na koncie 0%.**
2. **Poduszka najpierw:** poduszka służy na awarie; inwestowanie to osobne pieniądze na długi horyzont.
3. **Prosty start:** szeroki, tani, zdywersyfikowany ETF zamiast zgadywania pojedynczych spółek.
4. **Wahania są normalne:** dane historyczne pokazują wahania i to, że dłuższy horyzont historycznie ograniczał ryzyko straty — **bez gwarancji**.

Filtr Speakly (Ekran 2) wskazuje spośród nich **3 priorytety** dla danej osoby (tabela §2A).

---

## 2. Personalizacja: wiek określa horyzont i ton, **obawa** określa scenariusz

### 2A. Wiek (3 grupy — *Innovations for all generations*)

| ID grupy | Etykieta Demo | Domyślny horyzont | Ton | 3 priorytetowe tematy (`kept_topics`) | Zbędne na start (`removed_topics`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `20+` | `22 l. Student` | `15 lat` | Energiczny, swobodny | 1. Dlaczego gotówka na koncie traci (inflacja)<br>2. Mała kwota + długi czas = efekt skali<br>3. Poduszka vs inwestycja: które pieniądze do czego | Zgadywanie dołka i szczytu rynku; wybór pojedynczych akcji; podążanie za modnymi kryptowalutami (FOMO); codzienne sprawdzanie notowań; czytanie sprawozdań spółek; porównywanie dziesiątek funduszy |
| `30-50` | `38 l. Rodzina` | `10 lat` | Rzeczowy, oszczędza czas | 1. Automat: stały plan działa w tle<br>2. Poduszka osobno, nadwyżki osobno<br>3. Wahania rynku bez paniki | Zgadywanie dołka i szczytu rynku; wybór pojedynczych akcji; aktywne zarządzanie portfelem w godzinach pracy; codzienne sprawdzanie notowań; czytanie sprawozdań spółek; porównywanie dziesiątek funduszy |
| `50+` | `56 l. 50+` | `7 lat` | Spokojny, z szacunkiem, bardzo klarowny | 1. Wiek nie wyklucza: liczy się horyzont i proporcje<br>2. Ochrona siły nabywczej przed inflacją<br>3. Poduszka i część bezpieczna osobno | Nadrabianie strat ryzykownymi zakładami; wybór pojedynczych akcji; zgadywanie dołka i szczytu rynku; codzienne sprawdzanie notowań; czytanie sprawozdań spółek; porównywanie dziesiątek funduszy |

> Lista `removed_topics` zawiera wyłącznie rzeczy, które początkujący **faktycznie myśli, że musi robić** (nie „strawmen" typu opcje i derywaty). Nie podajemy żadnej liczby „zaoszczędzonych godzin" (brak wiarygodnej podstawy).

### 2B. Główna obawa użytkownika (`main_concern`) — wybiera scenariusz Kroku 2
Wiek **nie** zakłada lęku (unikamy stereotypów). Lęk wskazuje użytkownik na Ekranie 1.

| `main_concern` | Kafelek na Ekranie 1 | Learning Objective Kroku 2 | Domyślnie dla persony |
| :--- | :--- | :--- | :--- |
| `freeze_money` | „Boję się, że zamrożę pieniądze" | **Płynność:** poduszka na awarie; środki w ETF nie są zamrożone (sprzedaż i wypłata zwykle kilka dni roboczych) | `22 l. Student` |
| `no_time` | „Nie mam czasu na giełdę" | **Automatyzacja:** stały plan w tle, bez codziennego patrzenia w wykresy | `38 l. Rodzina` |
| `lose_money` | „Boję się, że stracę pieniądze" | **Dywersyfikacja:** szeroki ETF zamiast jednej „gorącej" spółki | — |
| `too_late` | „Chyba za późno na start" | **Wiek nie wyklucza:** dopasowanie horyzontu i proporcji | `56 l. 50+` |

---

## 3. Wartość dla Commerzbanku i KPI (do slajdu „Business case")
Co bank realnie zyskuje:
* **Depozyty:** w trybach `savings_first` i `split` ok. 80% wolnych środków kierowane jest na konto oszczędnościowe (poduszka) — to zasilenie bazy depozytowej, nie tylko inwestycji.
* **Plan cykliczny:** miesięczne zlecenie stałe na ETF = powtarzalny przychód/AuM i niski odpływ klientów.
* **Segment:** klienci trzymający gotówkę na koncie, którzy nie wiedzą, jak zacząć. W wersji produkcyjnej onboarding byłby w ~80% wypełniony danymi banku (wiek, dochody, saldo) — przewaga nad aplikacjami zewnętrznymi.
* **Retencja:** powiadomienie z banku po 3 dniach („Twoja następna misja czeka") — kanał niedostępny dla zewnętrznych aplikacji edukacyjnych.

KPI lejka (pokazać na slajdzie, w prototypie nie mierzone):
1. **Completion rate** misji,
2. **Wzrost samooceny pewności** (pytanie 1–5 na starcie i na końcu — pkt Ekran 1 i Ekran 4),
3. **CTR** przycisku „Przenieś przykładowy plan do konta",
4. **Konwersja** do otwarcia konta oszczędnościowego/maklerskiego lub planu cyklicznego.

> Do zweryfikowania w karcie wyzwania/z mentorem: jakie produkty i jaką markę (Commerzbank/mBank, konto maklerskie, IKE/IKZE) bank faktycznie oferuje na rynku docelowym. Do tego czasu „konto maklerskie" w UI występuje jako element **demo**, a nie obietnica produktu.

---

## 4. System Wizualny i Zależności (Do `static/index.html`)

### Zasoby — **LOKALNIE w `static/vendor/`** (gwarancja działania bez Wi-Fi)
Strona **nie może** ładować nic z CDN w czasie działania. Przed demo pobrać i zapisać pliki (to nie jest „build tool", tylko statyczne pliki):

| Plik lokalny | Źródło (jednorazowe pobranie) |
| :--- | :--- |
| `static/vendor/tailwind.js` | skrypt z `https://cdn.tailwindcss.com` (zapisany lokalnie) |
| `static/vendor/chart.umd.min.js` | `chart.js@4.4.4/dist/chart.umd.min.js` |
| `static/vendor/confetti.browser.min.js` | `canvas-confetti@1.9.3/dist/confetti.browser.min.js` |
| `static/vendor/lucide.min.js` | `lucide` w **przypiętej** wersji (zakaz `@latest`) |
| `static/vendor/fonts/PlusJakartaSans-{400,500,600,700,800}.woff2` | Google Fonts / pakiet fontsource; deklaracje `@font-face` w `styles.css` |

```html
<script src="/static/vendor/tailwind.js"></script>
<script src="/static/vendor/chart.umd.min.js"></script>
<script src="/static/vendor/confetti.browser.min.js"></script>
<script src="/static/vendor/lucide.min.js"></script>
```

### Paleta kolorów (Konfiguracja Tailwind w `<script>`):
* **`brand-dark`:** `#002E3C` (głęboki petrol Commerzbanku — nagłówki, zaufanie, wysoki kontrast).
* **`brand-yellow`:** `#FFCC00` (akcent Commerzbanku — główne przyciski CTA 3D, badge'e).
* **`brand-yellow-dark`:** `#D9A900` (dolna krawędź 3D przycisków CTA).
* **`etf-green`:** `#10B981` (ETF, dobre odpowiedzi, odhaczone kroki).
* **`inflation-red`:** `#F43F5E` (utrata siły nabywczej przez inflację, przekreślane zbędne tematy).
* **`stress-amber`:** `#F59E0B` (scenariusz stresowy, ciepły feedback przy nieoptymalnej odpowiedzi).
* **`surface-bg`:** `#F8FAFC`, **`card-bg`:** `#FFFFFF` (`rounded-3xl`, `shadow-xl shadow-slate-200/60`, `border border-slate-100`).

### Układ responsywny (mobile-first, rzutnik OK)
* Główny kontener: `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8`.
* Układy dwukolumnowe: `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`.
* Nagłówek i Demo Mode przechodzą do układu pionowego na małym ekranie.
* Elementy dotykowe min. **44 px** wysokości. Brak osobnej aplikacji natywnej.

### Obowiązkowe mikro-animacje CSS (`static/styles.css`):
1. **Przycisk 3D (`.btn-3d`):** tło `#FFCC00`, tekst `#002E3C` (`font-extrabold`), `border-bottom: 4px solid #D9A900`, `border-radius: 1rem`; `:hover` lekkie rozjaśnienie; `:active` `transform: translateY(3px); border-bottom-width: 1px;`.
2. **Wejście ekranów (`.screen-enter`):** `@keyframes fadeSlideUp`: `opacity: 0; translateY(16px)` -> `opacity: 1; translateY(0)` w `0.35s cubic-bezier(0.16, 1, 0.3, 1)`.
3. **Błysk paska pewności (`.shimmer-bar`):** przesuwający się biały refleks przy każdym wzroście `confidence_score`.
4. **„Cięcie zbędnej wiedzy" (`.topic-strike`):** kafelki `speakly_filter.removed_topics` pojawiają się po `400ms`, po czym sekwencyjnie (co `120ms`) dostają `line-through`, czerwony odcień i `opacity: 0.45`; obok zielony badge **`⚡ Pominęliśmy {n} tematów, których nie potrzebujesz na start`** (`n = removed_topics.length`).
5. **Pulsowanie finałowego CTA (`.glow-pulse`):** po odhaczeniu 4 punktów checklisty złoty, pulsujący cień przycisku bankowego.
6. **Cyfry tabelaryczne (`.tabular-nums`):** `font-variant-numeric: tabular-nums` dla wszystkich animowanych kwot i procentów.

---

## 5. Stały Nagłówek Aplikacji (Widoczny na każdym ekranie)
* **Lewa strona:** `Finance Quest` + podtytuł `by Commerzbank • Speakly Method`.
* **Środek (od Ekranu 2):** **Confidence Meter** — pasek z etykietą `Pewność siebie: XX%` (wartość z `confidence_score`, startuje od samooceny użytkownika) i badge'em `+XX` przy wzroście.
* **Prawa strona (DEMO MODE):** 3 pigułki z ikoną iskry: `[22 l. Student]` (`young_20`), `[38 l. Rodzina]` (`mid_38`), `[56 l. 50+]` (`senior_56`) — wypełniają profil z `GET /api/demo-personas` i uruchamiają analizę.

---

## 6. Specyfikacja 4 Ekranów + Modal Bankowy (Mapowanie 1:1 do API)

### Ekran 1: `screen_onboarding` (Szybki Profil — 30–40 sek.)
* **Nagłówek:** *„Zacznij w 4 minuty. Zero zbędnej teorii."*
* **Podtytuł:** *„Odpowiedz na 6 szybkich pytań — pominiemy wszystko, czego nie potrzebujesz na początek."*
* **Formularz (jedna karta):**
  1. **Wiek:** suwak `18–70` + duży podgląd + tag grupy (`20+` / `30–50` / `50+`). Pole API: `age`.
  2. **Miesięczne zarobki netto (zł):** suwak `2 500 – 25 000` (krok `500`) + pole edycji. Pole: `net_income`.
  3. **Wolne środki miesięcznie po opłatach (zł):** suwak `200 – 10 000` (krok `100`); **maksimum suwaka = min(10 000, `net_income`)**. Pole: `free_cash`.
  4. **Poduszka finansowa (min. 3 mies. wydatków):** 2 kafelki (`Tak, mam poduszkę` / `Jeszcze ją buduję`). Pole: `has_emergency_fund`.
  5. **„Czego najbardziej się obawiasz?"** 4 kafelki z §2B. Pole: `main_concern`.
  6. **„Jak pewnie czujesz się na myśl o zainwestowaniu pierwszych pieniędzy?"** skala `1–5` (klikalne kółka). Pole: `self_confidence_start`.
* **CTA:** `.btn-3d` **`Stwórz moją krótką ścieżkę ->`** -> `POST /api/onboarding/analyze`. Podczas ładowania 0,8 s animacja *„Filtruję zbędną teorię..."*.

### Ekran 2: `screen_filter_and_timemachine` (Filtr Speakly + Plan + Wehikuł Czasu)
Dane w 100% z odpowiedzi `POST /api/onboarding/analyze`:
1. **Karta A — Filtr Speakly:**
   * Badge: `⚡ Pominęliśmy {removed_topics.length} tematów, których nie potrzebujesz na start`.
   * Lewa kolumna (zielona): **`Twoje 3 priorytety na dziś`** -> `kept_topics`.
   * Prawa kolumna (`.topic-strike`): **`Nie musisz tego robić na starcie`** -> `removed_topics` przekreślane na oczach użytkownika.
2. **Karta B — Przykładowy podział wolnych środków** (zależnie od `safe_investment.plan_type`):
   * `split`: dwa paski/liczniki: **`Poduszka: {emergency_savings_monthly} zł/mies.`** + **`Trening w szeroki ETF: {training_etf_monthly} zł/mies.`**
   * `invest`: licznik **`{min_monthly} – {max_monthly} zł / mies.`** (do symulacji `recommended_monthly`).
   * `savings_first`: licznik **`Poduszka: {emergency_savings_monthly} zł/mies.`** i szara plakietka **„ETF później — poniżej przykład na 100 zł/mies."** (`illustrative_only`).
   * Jedno zdanie wyjaśnienia: `reasoning`. Etykieta kwoty: **„przykładowa kwota startowa"**.
3. **Karta C — Wehikuł Czasu: gotówka vs szeroki ETF (w dzisiejszych złotych):**
   * Suwak lat **`1 rok` – `20 lat`** (domyślnie `default_horizon_years`).
   * **3 kafelki KPI na żywo** (z `projection_series[year - 1]`, bez zapytań do API):
     * Czerwony: *„Wpłaty na koncie 0% (realnie, w dzisiejszych zł)"* -> `cash_real_value` zł. Pod spodem mała szara linia: *„wpłacono łącznie {total_paid} zł"*.
     * Zielony: *„Szeroki ETF (realnie, założenia poniżej)"* -> `etf_real_value` zł. Pod spodem: *„nominalnie ok. {etf_nominal_value} zł"*.
     * Złoty/zielony: *„W ilustracyjnych oknach historycznych {historical_win_rate}% kończyło się dodatnim wynikiem realnym"* z małym paskiem i dopiskiem *„ilustracyjne dane edukacyjne; źródło: {źródło po policzeniu}"*. **Nigdy** nie pisać „bez straty" ani wartości >97%.
   * **Wykres `Chart.js` (Line Chart, oś Y w dzisiejszych zł):** 3 linie od roku `1` do wybranego `year`:
     * Zielona z gradientem: `etf_real_value` — *Szeroki ETF (historycznie, realnie)*.
     * Czerwona przerywana: `cash_real_value` — *Wpłaty na koncie 0% (realnie)*.
     * Bursztynowa kropkowana: `etf_stress_real_value` — **„Scenariusz wahania -20% w roku 3 (edukacyjny)"**.
   * **Pod wykresem (stały tekst, czytelny):** `assumptions.text` oraz *„Symulacja historyczna; wyniki są zmienne i nie gwarantują przyszłych zysków."*
* **CTA:** `.btn-3d` **`Przetestuj to w 2-minutowej sytuacji LIVE z Luną ->`** -> Ekran 3.

### Ekran 3: `screen_mission_live` (Misja LIVE z Luną — 3 kroki)
* **Górny mini-panel:**
  * Badge: `Krok {step_number} z 3`.
  * `Portfel w symulacji: {portfolio_status.simulated_value} zł` (count-up, wartość nominalna; patrz docs03 §2).
  * Etykieta: `{portfolio_status.event_badge}`.
* **Karta feedbacku (po Kroku 1 i 2 i po 3):** dymek z ikoną mózgu/tarczy z `{understanding_feedback}`. **Kolor:** zielony gdy `is_optimal_choice == true`; **ciepły bursztynowy** gdy `false` (nigdy czerwony, nigdy zawstydzający).
* **Karta Luny:** awatar + `{luna_message}` (max 2–3 zdania). Podczas oczekiwania na API (tylko dla wolnego tekstu): 3 kropki *„Luna analizuje Twoją odpowiedź..."*. Kliknięcie karty odpowiada **natychmiast** (0 ms, bez LLM).
* **Interakcja (dwie równorzędne ścieżki):**
  * **Karty (`quick_replies`):** 3 karty (`hover:scale-[1.01]`). Kliknięcie wysyła `user_message = text` i `quick_reply_id = id` do `POST /api/mission/turn`. Kolejność kart ustala backend.
  * **Własna odpowiedź:** pole tekstowe (`placeholder="Lub napisz własnymi słowami, co robisz i dlaczego..."`) + `Wyślij` (bez `quick_reply_id`).
* **Efekt dopaminowy:** `trigger_confetti: true` (tylko przy odpowiedzi optymalnej) -> `confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } })`.
* **Zakończenie:** gdy `mission_completed === true` -> podsumowanie + przycisk **`Odbierz swoją Checklistę Pierwszego Kroku ->`** (Ekran 4).

### Ekran 4: `screen_checklist` (Checklista + Przykładowy plan)
* **Nagłówek:** badge **`🎉 Misja ukończona`** + pasek **`Pewność: {confidence_start}% -> {confidence_score}%`** (wartości z API; **nie wpisywać na sztywno 100%**).
* **Samoocena „po":** *„Jak pewnie czujesz się teraz? (1–5)"* + wyświetlenie **„Przed: X/5 -> Po: Y/5"** (tylko frontend; w wersji produkcyjnej metryka dla banku).
* **Interaktywna checklista (4 pozycje z `final_checklist`):** klikalne karty z checkboxem, animacja *bounce*, zielone tło, mikro-efekt. Zaznaczenie wszystkich 4 -> **pełne konfetti** `['#FFCC00', '#002E3C', '#10B981']` i `.glow-pulse` na przycisku bankowym.
* **Karta „Przykładowy plan pierwszej inwestycji" (z `bank_draft`):**
  * Kwota miesięczna: `{monthly_amount} zł` · Horyzont: `{horizon_years} lat` · Instrument (edukacyjny): `{instrument_category}`.
  * Szacunek edukacyjny w dzisiejszych zł: **ETF `{projected_etf_real_value}` zł vs wpłaty na koncie 0% `{projected_cash_real_value}` zł** (nominalnie ETF: `{projected_etf_nominal_value}` zł).
  * Pod spodem małym drukiem: `{assumptions_text}` oraz `{costs_note}`.
  * W trybie `savings_first` karta pokazuje **plan poduszki** (`{emergency_savings_monthly} zł/mies.`) zamiast planu ETF, a przykład ETF opisany jako „na później".
  * Przycisk `.btn-3d`: **`Przenieś ten przykładowy plan do konta w Commerzbanku ->`** -> `modal_bank_order`.
* **Karta zablokowana „Następna misja":** wyszarzona, z ikoną kłódki: *„Następna misja: Co zrobić, gdy rynek spada o 20%"* (zero logiki; sygnalizuje ścieżkę nauki w stylu Duolingo — patrz roadmapa w pitchu: Poduszka -> Inflacja -> Pierwszy ETF -> Koszty -> Spadek rynku -> Podatki/IKE -> Automat).
* **Compliance Disclaimer (czytelny, dół ekranu):**
  * *„Aplikacja Finance Quest ma charakter wyłącznie edukacyjny i symulacyjny. Wyliczenia opierają się na uproszczonych założeniach i danych historycznych, nie uwzględniają podatku od zysków, opłat ani ryzyka walutowego, nie gwarantują przyszłych wyników i nie stanowią doradztwa inwestycyjnego ani rekomendacji w rozumieniu dyrektywy MiFID II. Inwestowanie wiąże się z ryzykiem utraty części lub całości kapitału."*

### Modal końcowy: `modal_bank_order` (Ekran „Zero-Friction Handoff", DEMO)
* Modal imitujący bezpieczny ekran banku z **wstępnie wypełnionym przykładowym planem**:
  * Miesięczna wpłata: `{bank_draft.monthly_amount} zł` · Horyzont: `{bank_draft.horizon_years} lat`.
  * Status: `Przykładowy plan — gotowy do konfiguracji w Commerzbanku (demo)`.
  * Plakietka: *„W wersji produkcyjnej: test odpowiedniości, weryfikacja tożsamości (KYC), informacja o kosztach i ryzyku."*
  * Przycisk: **`Symuluj aktywację planu (Demo)`** -> zielony ekran sukcesu *„Gratulacje! Zrobiłeś pierwszy krok w mniej niż 4 minuty"* + przycisk **`Przetestuj inne pokolenie (Demo)`**.

---

## 7. Słownik sformułowań (obowiązkowy — compliance i uczciwość)

| Zamiast | Używaj |
| :--- | :--- |
| „bezpieczna kwota startowa" | „przykładowa kwota startowa" / „rozsądny początek" |
| „Twój szkic inwestycji" | „przykładowy plan" |
| „ETF drastycznie obniża ryzyko straty" | „szerokie fundusze historycznie wahały się mniej niż pojedyncze spółki; ryzyko straty nadal istnieje" |
| „tylko X% okresów kończyło się stratą" / „99% bez straty" | „w ilustracyjnych oknach historycznych X% kończyło się dodatnim wynikiem realnym" (max 97%) |
| „Gotowość inwestycyjna: 100%" | „Pewność: {start}% -> {score}%" |
| „Oszczędzasz 4,5 h" | „Pominęliśmy {n} tematów" |
| „gwarantowany zysk", nazwy tickerów | „dane historyczne", „szerokie fundusze ETF" |
| „Jestem za stary…" (jako opcja odpowiedzi) | „Wiek nie wyklucza — dopasowuję horyzont i proporcje" |
