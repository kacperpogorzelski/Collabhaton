# 01. SSOT Produktu, Grywalizacji i Dopaminowego GUI — Finance Quest

> **Wersja v4.** Rozszerza v3 o: domyślny język angielski (`EN | PL`, kwoty w PLN), zmianę imienia AI Coacha na **Cora** + animowaną maskotkę SVG, rygorystyczną 3-stanową ocenę odpowiedzi (`0 XP` za śmieciowe wpisy), grywalne **Dni 1–4 + codzienne mini-challenges + Checkpoint #1**, tryb **„Ask Cora / Explain simpler + mini-drill”**, sekcję **„After Day 14 — Continuous Learning”**, czytelniejsze fazy czasowe, **Reset/Profile** w nagłówku, **AI Disclaimer** oraz **Mobile-first UX na smartfony**. Kontrakt pól i matematyka: `02_TECH_API_AND_MATH.md`.

## 1. Filozofia Produktu (14-Day Confidence Sprint + Dalsza Nauka)
* **Odbiorca:** początkujący, samodzielni inwestorzy indywidualni, wszystkie grupy wiekowe, którzy boją się zacząć.
* **Realistyczny rytm nauki (Sprint Startowy + Kontynuacja):** **14-Day Confidence Sprint (~5 minut dziennie)** to **wstępny cel**, który pomaga klientowi zyskać pewność siebie i wykonać pierwsze małe, realne wpłaty. Po zakończeniu Dnia 14 aplikacja **nie kończy nauki** — otwiera dalszą ścieżkę (**„After Day 14 — Continuous Learning”**: rebalansowanie, IKE/IKZE, obligacje, miesięczne check-iny z Corą).
* **Czytelne przedziały czasowe (3 fazy sprintu, ~5 min/day):**
  * **Phase 1 (Days 1–4):** Foundations & First Step → **Checkpoint #1**
  * **Phase 2 (Days 5–9):** Risk, Safety & Emotions → **Checkpoint #2**
  * **Phase 3 (Days 10–14):** Your Real Plan → **Sprint Finale → Continuous Learning**
* **North Star:** maksymalny stosunek **praktycznej wiedzy i realnej gotowości** do **poświęconego czasu**.
* **Zakres prototypu:** w pełni interaktywna **Faza 1: Dni 1–4 + codzienne mini-challenges + test wiedzy Checkpoint #1**, osadzone na widocznej mapie 3 faz + sekcji *After Day 14* (Fazy 2–3 jako zablokowane kamienie milowe).
* **Cel biznesowy:** doprowadzić klienta do pierwszego świadomego kroku w banku (konto oszczędnościowe, testowa wpłata 10 PLN, podgląd konta maklerskiego / mikro-ETF, a następnie plan cykliczny). Patrz §4.
* **Zasada uczciwości i AI Disclaimer (twarda):** budujemy pewność opartą na **rozumieniu**, nie na obietnicach. Nigdy: gwarantowany zysk, „100% pewności", liczby bez jawnych założeń, porównania w różnych jednostkach (patrz §8 i docs/02 §3). Wszędzie przy interakcjach AI widnieje disclaimer: **„AI Coach Cora can make mistakes. Educational simulation only — not financial advice (MiFID II).”**

### Uniwersalne 4 filary wiedzy (minimum dla każdej grupy, od Dnia 1)
1. **Inflacja = realna strata wartości gotówki** na koncie 0%.
2. **Poduszka najpierw:** poduszka służy na awarie; inwestowanie to osobne pieniądze na długi horyzont.
3. **Prosty start:** szeroki, tani, zdywersyfikowany ETF zamiast zgadywania pojedynczych spółek.
4. **Wahania są normalne:** dane historyczne pokazują wahania oraz to, że dłuższy horyzont historycznie ograniczał ryzyko straty — **bez gwarancji**.

---

## 2. Mechaniki Grywalizacji i Budowania Nawyku
1. **Ankieta (Ekran 1):** 6 szybkich pytań (wiek, zarobki, wolne środki, poduszka, główna obawa, samoocena pewności 1–5).
2. **Mapa 14-Dniowej Ścieżki w 3 Fazach (Ekran 2):** czytelne przedziały czasowe (`Phase 1: Days 1–4`, `Phase 2: Days 5–9`, `Phase 3: Days 10–14`, oznaczone `~5 min/day`) + sekcja podglądu **After Day 14 — Continuous Learning**. Dni 1–4 odblokowują się kolejno (plus szybki skok w Demo Mode do Dnia 4 / Checkpointu #1).
3. **Mikro-lekcje dnia + Tryb „Explain simpler / Ask Cora”:** 1–3 karty „1 fakt + 1 konkret" (20 s) za `+15 XP`. Przy każdej lekcji przycisk **„Explain simpler”** otwiera panel Cory: użytkownik wpisuje, czego nie rozumie, dostaje prostą analogię z życia oraz **1 mini-zadanie utrwalające (3 opcje)**.
4. **Codzienny AI Coach (Cora) + Rozszerzone Dobieranie Pytań (Ekran 3):**
   * Dzień 1 ma 3 kroki; Dni 2–4 po 2 kroki.
   * Dobór pytań po quizie zależy od: `age_group` (horyzont/ton), `main_concern` (scenariusz lęku), **`self_confidence_start`** (poziom 1–2 podstawy vs 4–5 pogłębione pytania o koszty/dywersyfikację) oraz **`plan_type`** (`savings_first` podkreśla najpierw poduszkę).
   * **Rygorystyczna ocena 3-stanowa (`optimal` | `partial` | `invalid`):** losowy lub bezsensowny tekst (`invalid`) daje **`0 XP`, `0` gotowości i `allow_retry=True`** (zostaje na tym samym kroku z prośbą o poprawę lub wybranie karty).
5. **Wskaźnik Gotowości (`confidence_score`):** startuje od **samooceny użytkownika** (1–5 -> 5–25%; persony demo: 10%), w Dniu 1 rośnie maks. o **+30 pkt** (10% -> 40%), a w kolejnych dniach i po Checkpoincie #1 zbliża się dalej (pełną gotowość daje dopiero Dzień 14).
6. **Poziomy i XP:** start `Level 1: Observer` (`Obserwator`, 20 XP); próg Poziomu 2 (`Confident Start` / `Świadomy Start`) to `100 XP` (wyższe poziomy od `250 XP` przy przejściu Dni 2–4 i Checkpointu #1).
7. **Streak:** pigułka `🔥 Day 1` (`1 dzień`), rośnie przy kolejnych dniach sprintu.
8. **Codzienne Mini-Wyzwania „Zero Strachu” (po każdym dniu, `+50 XP`, compliance-safe):**
   * **Day 1:** wpłata `5 PLN` na konto oszczędnościowe (lub `50 PLN` na subkonto startowe, gdy jest poduszka).
   * **Day 2:** sprawdź / otwórz konto maklerskie (lub tryb demo) i zweryfikuj tabelę opłat.
   * **Day 3:** zasil konto / subkonto testową kwotą `10 PLN` i obejrzyj zlecenie stałe.
   * **Day 4:** przećwicz podgląd lub pierwsze mikro-zlecenie na szeroki fundusz ETF (w trybie demo lub za symboliczną kwotę — bez rekomendacji konkretnego instrumentu).
9. **Checkpoint #1 (Test wiedzy po Dniu 4):** krótki quiz 4–5 pytań ABCD sprawdzający fundamenty z Dni 1–4 (próg 75%, wyjaśnienie odpowiedzi, odznaka *Foundation Ready*, `+100 XP`).
10. **Ranking Znajomych (Ekran 4, widget demo):** tabela 4 pozycji (3 przykładowych znajomych + `You` / `Ty`) + przycisk `⚔️ Challenge a friend`.

---

## 3. Personalizacja: wiek określa horyzont i ton, **obawa** określa scenariusz

### 3A. Wiek (3 grupy — *Innovations for all generations*)

| ID grupy | Etykieta Demo | Horyzont | Ton | 3 priorytety (`kept_topics`, spójne z mikro-lekcjami) | Zbędne na start (`removed_topics`) | Mikro-wyzwanie Dnia 1 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `20+` | `22 l. Student` | `15 lat` | Energiczny | Inflacja zjada gotówkę · Poduszka na awarie, ETF na długi cel · Efekt skali od małych kwot | Zgadywanie dołka i szczytu rynku; wybór pojedynczych akcji; modne kryptowaluty (FOMO); codzienne sprawdzanie notowań; czytanie sprawozdań spółek; porównywanie dziesiątek funduszy | 5 zł na konto oszczędnościowe |
| `30-50` | `38 l. Rodzina` | `10 lat` | Rzeczowy, oszczędza czas | Inflacja zjada oszczędności · Automatyzacja w tle bez wykresów · Poduszka osobno, nadwyżki osobno | Zgadywanie dołka i szczytu rynku; wybór pojedynczych akcji; aktywne zarządzanie portfelem w godzinach pracy; codzienne sprawdzanie notowań; czytanie sprawozdań spółek; porównywanie dziesiątek funduszy | 50 zł na subkonto (z poduszką) lub 5 zł (bez) |
| `50+` | `56 l. 50+` | `7 lat` | Spokojny, z szacunkiem, bardzo klarowny | Inwestować można w każdym wieku · Tarcza antyinflacyjna dla kapitału · Prostota i dywersyfikacja | Nadrabianie strat ryzykownymi zakładami; wybór pojedynczych akcji; zgadywanie dołka i szczytu rynku; codzienne sprawdzanie notowań; czytanie sprawozdań spółek; porównywanie dziesiątek funduszy | 50 zł na subkonto (z poduszką) lub 5 zł (bez) |

> `removed_topics` zawiera wyłącznie rzeczy, które początkujący **faktycznie myśli, że musi robić** (nie „strawmeny" typu opcje/derywaty). **Nie podajemy liczby „zaoszczędzonych godzin"** (brak wiarygodnej podstawy) — używamy liczby pominiętych tematów.

### 3B. Główna obawa (`main_concern`) — wybiera scenariusz Kroku 2
Wiek **nie** zakłada lęku (unikamy stereotypów). Lęk wskazuje użytkownik na Ekranie 1.

| `main_concern` | Kafelek | Learning Objective Kroku 2 | Domyślnie dla persony |
| :--- | :--- | :--- | :--- |
| `freeze_money` | „Boję się, że zamrożę pieniądze" | **Płynność:** poduszka na awarie; środki w ETF nie są zamrożone (sprzedaż i wypłata zwykle kilka dni roboczych) | `22 l. Student` |
| `no_time` | „Nie mam czasu na giełdę" | **Automatyzacja:** stały plan w tle, bez codziennego patrzenia w wykresy | `38 l. Rodzina` |
| `lose_money` | „Boję się, że stracę pieniądze" | **Dywersyfikacja:** szeroki ETF zamiast jednej „gorącej" spółki | — |
| `too_late` | „Chyba za późno na start" | **Wiek nie wyklucza:** dopasowanie horyzontu i proporcji | `56 l. 50+` |

---

## 4. Wartość dla Commerzbanku i KPI (slajd „Business case")
* **Depozyty:** w trybach `savings_first` i `split` ok. 80% wolnych środków trafia na konto oszczędnościowe (poduszka), a mikro-wyzwanie Dnia 1 to **pierwsza wpłata na konto banku**. To zasilenie bazy depozytowej, nie tylko inwestycji.
* **Plan cykliczny:** stałe zlecenie na ETF = powtarzalny przychód/AuM i niski churn.
* **Segment i dane:** klienci trzymający gotówkę, którzy nie wiedzą, jak zacząć; w wersji produkcyjnej ankieta byłaby w ~80% wypełniona danymi banku (wiek, dochody, saldo) — przewaga nad aplikacjami zewnętrznymi.
* **Retencja:** powiadomienie z banku po 3 dniach („Twoja następna misja czeka") — kanał niedostępny dla aplikacji zewnętrznych.
* **KPI lejka (na slajdzie; w prototypie niemierzone):** completion rate Dnia 1; **wzrost samooceny pewności** (pytanie 1–5 na Ekranie 1 i 4); odsetek przyjętych mikro-wyzwań; CTR „Przenieś przykładowy plan do konta"; konwersja do konta oszczędnościowego/maklerskiego lub planu cyklicznego; powroty na Dzień 2.
* **Do weryfikacji z mentorem/kartą wyzwania:** jakie produkty i jaką markę (Commerzbank/mBank, konto maklerskie, IKE/IKZE) bank faktycznie oferuje na rynku docelowym. Do tego czasu elementy bankowe w UI są **demo**, a nie obietnicą produktu.

---

## 5. System Wizualny i Zależności

### Zasoby — **LOKALNIE w `static/vendor/`** (działanie bez Wi-Fi)
Strona **nie może** ładować niczego z CDN w czasie działania. Przed demo pobrać pliki raz i zapisać w repo (to statyczne pliki, nie build tool):

| Plik lokalny | Źródło (jednorazowe pobranie) |
| :--- | :--- |
| `static/vendor/tailwind.js` | skrypt z `https://cdn.tailwindcss.com` zapisany lokalnie |
| `static/vendor/chart.umd.min.js` | `chart.js@4.4.4/dist/chart.umd.min.js` |
| `static/vendor/confetti.browser.min.js` | `canvas-confetti@1.9.3/dist/confetti.browser.min.js` |
| `static/vendor/lucide.min.js` | `lucide` w **przypiętej** wersji (zakaz `@latest`) |
| `static/vendor/fonts/PlusJakartaSans-{400,500,600,700,800}.woff2` | Google Fonts / fontsource; `@font-face` w `styles.css` |

```html
<script src="/static/vendor/tailwind.js"></script>
<script src="/static/vendor/chart.umd.min.js"></script>
<script src="/static/vendor/confetti.browser.min.js"></script>
<script src="/static/vendor/lucide.min.js"></script>
```

### Paleta kolorów (Tailwind w `<script>`)
`brand-dark #002E3C` · `brand-yellow #FFCC00` · `brand-yellow-dark #D9A900` · `etf-green #10B981` · `inflation-red #F43F5E` · `streak-orange #F97316` · `stress-amber #F59E0B` (scenariusz stresowy, ciepły feedback) · `surface-bg #F8FAFC` · `card-bg #FFFFFF` (`rounded-3xl`, `shadow-xl shadow-slate-200/60`, `border border-slate-100`).

### Układ responsywny i Wersja na Smartfony (Mobile-first, `360px–430px` & Rzutnik)
* Kontener `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8`; układy `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`; elementy dotykowe min. **44 px**; brak poziomego przewijania (`375px` / `1280px` / `1920px`).
* **Smartfony (`< 640px`):**
  * Menu `Demo Mode` zwijane do kompaktowego przełącznika / menu `Demo ▾`, żeby nie zajmować połowy ekranu telefonu.
  * Kompaktowy pasek statusu (Dzień, XP, Streak, Readiness) mieszczący się czytelnie w max 2 wierszach.
  * Główne przyciski CTA wygodne pod kciuk (pełna szerokość lub sticky bar na dole).
  * Responsywna wysokość wykresu `Chart.js` bez ucinania podpisów osi.
  * Pływająca maskotka **Cora** zmniejszona na mobile (`~48–52 px`) z odpowiednim marginesem od przycisków CTA, by niczego nie zasłaniała.

### Animowana Maskotka Cora (Inline SVG, zero CDN)
* Lekka maskotka wektorowa **Cora** w palecie `#002E3C` / `#FFCC00` umieszczona na stałe w prawym dolnym rogu ekranu (`z-index` poniżej modali). Kliknięcie otwiera/zamyka drawer **„Ask Cora”**.
* **4 stany CSS (`data-cora-mood`):**
  1. `idle` — delikatne unoszenie/mruganie,
  2. `thinking` — pulsowanie podczas analizy LLM / ładowania wyjaśnienia,
  3. `happy` — radosny podskok przy `optimal` / konfetti / zaliczeniu wyzwania,
  4. `encourage` — łagodne kiwanie przy `partial` / `invalid` (bez zawstydzania).

### Obowiązkowe mikro-animacje CSS (`static/styles.css`)
1. **`.btn-3d`:** tło `#FFCC00`, tekst `#002E3C` (`font-extrabold`), `border-bottom: 4px solid #D9A900`, `border-radius: 1rem`; `:active` `translateY(3px); border-bottom-width: 1px`.
2. **`.screen-enter`:** `@keyframes fadeSlideUp` (`0.35s cubic-bezier(0.16, 1, 0.3, 1)`).
3. **`.shimmer-bar`:** biały refleks na paskach Gotowości i XP przy każdym wzroście.
4. **`.topic-strike`:** `removed_topics` pojawiają się po `400ms`, potem co `120ms` `line-through`, czerwony akcent, `opacity: 0.45`; obok zielony badge **`⚡ Skipped {n} topics you don't need at the start`**.
5. **`.level-pop`:** bounce + złota poświata karty awansu (Ekran 4).
6. **`.glow-pulse`:** pulsujący złoty cień przycisku bankowego po odhaczeniu checklisty.
7. **`.tabular-nums`:** `font-variant-numeric: tabular-nums` dla kwot, XP i procentów.

---

## 6. Stały Nagłówek Aplikacji (każdy ekran)
* **Lewa (klikalne logo -> powrót do Ekranu 1):** `Finance Quest` + podtytuł `by Commerzbank • 14-Day Confidence Sprint`.
* **Środek (`#status-bar`):**
  * Badge `📅 Day {current_day} of 14` (PL: `Dzień {current_day} z 14`).
  * Badge poziomu: `⭐ Lvl 1: Observer ({xp} XP)` -> `🏆 Lvl 2: Confident Start` po awansie.
  * Badge streaka `🔥 1 day` (`#F97316`).
  * **Readiness / Gotowość (od Ekranu 2):** pasek z animowanym przyrostem (wartość z `confidence_score`).
* **Prawa (Język + Reset/Profile + DEMO MODE):**
  * Przełącznik języka **`EN | PL`** (przyciski min. `44 px` wysokości, `aria-pressed`, zapis w `localStorage`), **domyślnie `EN`**.
  * Przycisk **`↺ Reset / Profile`** (PL: **`↺ Reset / Profil`**) — czyści stan sesji, zamyka modal/drawer, odznacza pigułki Demo Mode i wraca czysto na Ekran 1 (wybór profilu).
  * 3 pigułki `[22y Student]`, `[38y Family]`, `[56y 50+]` (w PL: `[22 l. Student]`, `[38 l. Rodzina]`, `[56 l. 50+]`) + opcjonalny skrót Demo Mode `Day 4 / Quiz` (na mobile zwijane w `Demo ▾`).

---

## 7. Specyfikacja 4 Ekranów + Modal Bankowy (mapowanie 1:1 do API)

### Ekran 1: `screen_onboarding` (Ankieta — 30–40 s)
* **Nagłówek:** *„Zbuduj pewność inwestycyjną w 14 dni. Po 5 minut dziennie."* · **Podtytuł:** *„6 szybkich pytań wytnie zbędną teorię w stylu Speakly i ułoży Twój plan."*
* **Formularz:**
  1. **Wiek:** suwak `18–70` + tag grupy. `age`.
  2. **Zarobki netto:** suwak `2 500 – 25 000` (krok `500`). `net_income`.
  3. **Wolne środki miesięcznie:** suwak `200 – 10 000` (krok `100`); **maksimum = min(10 000, `net_income`)**, a obniżenie `net_income` poniżej `free_cash` dopasowuje suwak w dół. `free_cash`.
  4. **Poduszka (min. 3 mies. wydatków):** 2 kafelki (`Tak, mam poduszkę` / `Jeszcze ją buduję`). `has_emergency_fund`.
  5. **„Czego najbardziej się obawiasz?"** 4 kafelki z §3B. `main_concern`.
  6. **„Jak pewnie czujesz się na myśl o zainwestowaniu pierwszych pieniędzy?"** skala `1–5`. `self_confidence_start`.
* **CTA:** `.btn-3d` **`Ułóż mój 14-dniowy plan Speakly ->`** -> `POST /api/onboarding/analyze` (0,8 s animacja *„Filtruję zbędną teorię..."*).

### Ekran 2: `screen_filter_and_timemachine`
Dane z `POST /api/onboarding/analyze`:
1. **Karta A — Mapa 14 dni w 3 Fazach (`roadmap_milestones`):**
   * Wyraźnie pogrupowana w **3 fazy czasowe (`~5 min/day`)**: **Phase 1: Days 1–4** (Foundations & First Step → **Checkpoint #1**), **Phase 2: Days 5–9** (Risk & Emotions → **Checkpoint #2**), **Phase 3: Days 10–14** (Real Plan → **Sprint Finale**).
   * Dni 1–4 interaktywne i klikalne po odblokowaniu; pod mapą krótka zapowiedź **After Day 14 — Continuous Learning**.
2. **Karta B — Filtr Speakly + Mikro-lekcje dnia + „Explain simpler”:**
   * Badge `⚡ Skipped {removed_topics.length} topics you don't need at the start`.
   * **Lewa:** klikalne mikro-lekcje (`micro_lessons`, tytuł, `20 sec`, konkret, `Got it! (+15 XP)`) + przycisk **`Explain simpler / Ask Cora`** przy karcie (otwiera drawer z przykładem z życia i mini-zadaniem). **Reguła monotonicznego XP:** nagłówek zawsze wyświetla `gamification.xp + microLessonBonusXp`.
   * **Prawa (`.topic-strike`):** `removed_topics`, podpis *„Nie musisz tego robić na starcie"*. Nad listą `kept_topics`: **„Twoje 3 priorytety na dziś"**.
3. **Karta C — Przykładowy podział wolnych środków** (wg `safe_investment.plan_type`):
   * `split`: dwa liczniki **`Poduszka: {emergency_savings_monthly} zł/mies.`** i **`Trening w szeroki ETF: {training_etf_monthly} zł/mies.`**
   * `invest`: licznik **`{min_monthly} – {max_monthly} zł / mies.`** (do symulacji `recommended_monthly`).
   * `savings_first`: **`Poduszka: {emergency_savings_monthly} zł/mies.`** + szara plakietka *„ETF później — poniżej przykład na 100 zł/mies."* (`illustrative_only`).
   * Zdanie wyjaśnienia `reasoning`; etykieta kwoty: **„przykładowa kwota docelowa"**.
4. **Karta D — Wehikuł Czasu: gotówka vs szeroki ETF (w dzisiejszych złotych):**
   * Suwak lat `1 – 20` (domyślnie `default_horizon_years`).
   * **3 kafelki KPI na żywo** (z `projection_series[year - 1]`):
     * Czerwony: *„Wpłaty na koncie 0% (realnie, w dzisiejszych zł)"* -> `cash_real_value`; pod spodem szare *„wpłacono łącznie {total_paid} zł"*.
     * Zielony: *„Szeroki ETF (realnie, założenia poniżej)"* -> `etf_real_value`; pod spodem *„nominalnie ok. {etf_nominal_value} zł"*.
     * Złoty: *„W ilustracyjnych oknach historycznych {historical_win_rate}% kończyło się dodatnim wynikiem realnym"* + mały pasek i dopisek *„ilustracyjne dane edukacyjne; źródło: …"*. **Nigdy** nie pisać „bez straty" ani wartości >97%.
   * **Wykres `Chart.js` (oś Y w dzisiejszych zł), 3 linie:** zielona z gradientem `etf_real_value`; czerwona przerywana `cash_real_value`; bursztynowa kropkowana `etf_stress_real_value` z podpisem **„Scenariusz wahania -20% w roku 3 (edukacyjny)"**. Przed `projection_series.slice(0, year)` zawsze dopinamy punkt `Rok 0` (`0, 0, 0`), żeby przy suwaku na `1 rok` widać było rozchodzące się krzywe. `fetch` używa ścieżek względnych `/api/...` (fallback `http://localhost:8000` przy `file://`).
   * **Pod wykresem (stały tekst):** `assumptions.text` oraz *„Symulacja historyczna; wyniki są zmienne i nie gwarantują przyszłych zysków."*
* **CTA:** `.btn-3d` **`Rozpocznij Symulację Dnia 1 z AI Coachem ->`** -> Ekran 3.

### Ekran 3: `screen_mission_live` (Symulacja Wyborów z Corą — Dni 1–4)
* **Górny mini-panel:** `Day {day} of 14 • Decision Simulation • Step {step_number} of {total_steps}`; `{portfolio_status.simulated_value} PLN` (count-up); `{portfolio_status.event_badge}`.
* **Karta feedbacku (po odpowiedzi):** dymek z `{understanding_feedback}` + pigułka `+{xp_gained} XP`. **Kolor:** zielony gdy `answer_quality == "optimal"`, **ciepły bursztynowy** gdy `"partial"` lub `"invalid"` (nigdy zawstydzający). Gdy `allow_retry == true` (`"invalid"`): komunikat z `0 XP`, krok **nie** przechodzi dalej, a pole tekstowe i karty pozostają aktywne do poprawy.
* **Karta Cory:** awatar **`Cora • Your daily AI Coach`** + `{luna_message}` (2–3 zdania). Kropki *„Cora is analyzing your answer..."* tylko dla wolnego tekstu; **klik karty odpowiada natychmiast** (bez LLM). Pod polem tekstowym przycisk **`Explain simpler`** oraz **AI Disclaimer**: *„AI Coach Cora can make mistakes…”*.
* **Interakcja:**
  * 3 karty `quick_replies` (kolejność tasuje backend). Klik wysyła `user_message = text` i `quick_reply_id = id` (+ opcjonalny `day`).
  * Pole tekstowe + przycisk `Send` (bez `quick_reply_id`).
* **Dopamina:** `trigger_confetti: true` (tylko przy `optimal`) -> `confetti(...)`; maskotka Cora przechodzi w stan `happy` (lub `encourage` przy `partial`/`invalid`).
* **Zakończenie dnia:** `mission_completed === true` -> przycisk `.btn-3d` przechodzący na Ekran 4 (podsumowanie dnia + mini-challenge dnia).

### Drawer „Ask Cora / Explain with real-life example” (zawsze dostępny przez maskotkę lub przycisk przy lekcji)
* Pole wpisania pytania/pojęcia, czego użytkownik nie rozumie (lub szybkie chipy tematów z aktualnego dnia).
* Wywołuje `POST /api/coach/explain` i pokazuje: (1) proste wyjaśnienie + **życiową analogię / przykład**, (2) **interaktywne mini-zadanie (3 opcje)** z natychmiastowym feedbackiem. Widoczny **AI Disclaimer**.

### Widok Checkpoint #1 (po Dniu 4 — `screen_checkpoint`)
* Quiz wiedzy (4–5 pytań ABCD z Dni 1–4) z paskiem postępu -> `POST /api/checkpoint/submit` -> karta wyniku (`score_pct`, wyjaśnienia odpowiedzi, `+100 XP`, konfetti, odznaka *Foundation Ready* przy >= 75%).

### Ekran 4: `screen_checklist` (Ukończenie dnia, Mini-Wyzwanie, Ranking, After Day 14 i Commerzbank)
Układ 2-kolumnowy od `md`, 1 kolumna na mobile.
1. **Baner (`.level-pop`, pełna szerokość):**
   * Pokazuje ukończenie bieżącego dnia (`DAY {day} OF 14 COMPLETED`), status awansu (`leveled_up`), pasek **`Readiness: {confidence_start}% -> {confidence_score}%`** z API oraz samoocenę „Before: X/5 -> After: Y/5”.
   * Przyciski nawigacji wielodniowej: **`Continue to Day {day + 1} ->`** (dla Dni 1–3, wywołuje `POST /api/day/start`) lub **`Start Checkpoint #1 Quiz ->`** (po Dniu 4).
2. **Lewa kolumna — Realne działanie dziś:**
   * **Karta 1: Codzienne Mini-Wyzwanie (`real_world_challenge`)** dla bieżącego dnia (`POST /api/challenge/accept` z `day`, `+50 XP`, konfetti, aktualizacja rankingu).
   * **Karta 2: Checklista (`final_checklist`, 4 pozycje)** z animacją *bounce* i pełnym konfetti + `.glow-pulse` przy 4/4.
3. **Prawa kolumna — Bank i społeczność:**
   * **Karta 3: Przykładowy plan w Commerzbanku (`bank_draft`)** (w dzisiejszych PLN, z `{assumptions_text}` i `{costs_note}`) + przycisk do `modal_bank_order`.
   * **Karta 4: Ranking (`leaderboard`)** + `⚔️ Challenge a friend`.
4. **Sekcja „After Day 14 — Continuous Learning” (`post_14_paths`):**
   * Wyraźny blok podsumowujący wizję produktu po 14-dniowym sprincie: 3–4 kafelki dalszych tematów (*Portfolio & Rebalancing*, *Tax-Advantaged Accounts (IKE/IKZE)*, *Bonds & Diversification*, *Monthly AI Check-ins with Cora*).
5. **Stopka (compliance + AI disclaimer):** pełna nota MiFID II + informacja, że AI Coach Cora może popełniać błędy.

### Modal końcowy: `modal_bank_order` (Zero-Friction Handoff, DEMO)
* Imituje ekran aplikacji Commerzbanku z dwoma opcjami:
  * **Opcja A — Krok na dziś (polecana):** mikro-przelew z wyzwania (`{amount_pln} zł` na `{target_account}`).
  * **Opcja B — Przykładowy plan na Dzień 14:** `{monthly_amount} zł / mies.`, `{horizon_years} lat`, `{instrument_category}`.
* Plakietka: *„W wersji produkcyjnej: test odpowiedniości, weryfikacja tożsamości (KYC), informacja o kosztach i ryzyku."*
* Przycisk **`Symuluj wykonanie kroku w banku (Demo)`** -> ekran sukcesu *„Brawo! Krok Dnia 1 zaliczony — Twoja seria trwa, widzimy się jutro na Dniu 2!"* + przycisk **`Przetestuj inne pokolenie (Demo)`**.

---

## 8. Słownik sformułowań (obowiązkowy — compliance i uczciwość)

| Zamiast | Używaj |
| :--- | :--- |
| „bezpieczna kwota (docelowa/startowa)" | „przykładowa kwota docelowa" / „rozsądny początek" |
| „Twój szkic inwestycji" | „przykładowy plan" |
| „ETF drastycznie obniża ryzyko straty" | „szerokie fundusze historycznie wahały się mniej niż pojedyncze spółki; ryzyko straty nadal istnieje" |
| „tylko X% okresów kończyło się stratą" / „99% bez straty" | „w ilustracyjnych oknach historycznych X% kończyło się dodatnim wynikiem realnym" (max 97%) |
| „Gotowość inwestycyjna: 100%" | „Gotowość: {start}% -> {score}%" (pełna dopiero Dzień 14) |
| „Zaoszczędzono 3,5 h" | „Pominęliśmy {n} tematów" |
| „gwarantowany zysk", nazwy tickerów | „dane historyczne", „szerokie fundusze ETF" |
| „Jestem za stary…" jako opcja odpowiedzi | „Wiek nie wyklucza — dopasowuję horyzont i proporcje" |
| porównanie ETF nominalnie z gotówką realnie | obie wielkości w dzisiejszych złotych (nominał tylko jako dopisek) |

---

## 9. Wersja dwujęzyczna (EN domyślna + przełącznik PL)

* **Przełącznik w nagłówku:** przyciski **`EN | PL`** obok Reset/Profile i Demo Mode (min. `44 px`, `aria-pressed`), **domyślnie `"en"`**. Wybór jest zapisywany w `localStorage` pod kluczem `fq_lang` i aktualizuje atrybut `<html lang="en|pl">` oraz `<title>` / meta opis.
* **Implementacja bez build-toola i bez zewnętrznych bibliotek i18n:** lekki słownik `I18N = { en: {...}, pl: {...} }` w `static/app.js` oraz atrybuty `data-i18n` / `data-i18n-aria` w `static/index.html` (zero nowych zależności w `static/vendor/`).
* **Zachowanie przy zmianie języka w trakcie pracy aplikacji:**
  * **Ekran 1:** natychmiast tłumaczy statyczne UI i ponownie pobiera `GET /api/demo-personas?lang={lang}`.
  * **Ekran 2:** tłumaczy statyczne UI (oś wykresu `Year 0` / `Rok 0`, etykiety, fazy czasowe, przyciski, stopka) oraz ponawia `POST /api/onboarding/analyze` z aktualnym profilem i nowym `lang`, aby odświeżyć filtr Speakly, mapę, mikro-lekcje, opis planu i turę startową.
  * **Ekrany 3–4, Checkpoint #1, Ask Cora i Modal:** tłumaczy statyczne UI oraz przekazuje nowy `lang` w kolejnym żądaniu API; kliknięcie pigułki Demo Mode uruchamia świeżą sesję w aktualnym języku.
* **Waluta i jednostki bez FX:** wszystkie kwoty pozostają w **PLN** (bez przeliczania kursów) — w wersji EN zapis `PLN`, w wersji PL zapis `zł`. Wykres w EN używa podpisu osi `Year 0` i etykiety `today's PLN`.
* **Angielski słownik compliance (§8 dla `lang="en"`):**
  * Zamiast *„safe amount”* używać wyłącznie *„illustrative target amount”* / *„sensible starting point”*.
  * Używać *„sample plan”*, *„broad global ETF”*, *„historical data”* (zero obietnic zysku, zero tickerów — dotyczy także mini-challenges Dni 2–4).
  * Zamiast *„99% without loss”* używać *„in illustrative historical windows, X% ended with a positive real return”* (limit wyświetlania `min(97, wartość)`).
  * Gotowość: *„Readiness: {start}% -> {score}%”* (*„full readiness comes on Day 14”*).
* **AI Disclaimer (EN / PL):**
  * EN: *„AI Coach Cora can make mistakes. Always verify key details — educational simulation only, not financial advice.”*
  * PL: *„AI Coach Cora może popełniać błędy. Symulacja wyłącznie edukacyjna — to nie jest porada inwestycyjna.”*
* **Angielska stopka compliance (MiFID II) pod wykresem Ekranu 2 i na Ekranie 4:**
  * *„Finance Quest is strictly an educational and simulation tool. Calculations are based on simplified assumptions and historical data, exclude capital gains tax, brokerage fees, and currency risk, do not guarantee future returns, and do not constitute investment advice or a recommendation under MiFID II. Investing involves the risk of losing part or all of your capital.”*
