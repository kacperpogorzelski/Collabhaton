# 01. SSOT Produktu, Grywalizacji i Dopaminowego GUI — Finance Quest

> **Wersja v3 (scalona).** Zachowuje koncepcję zespołu (14-dniowa ścieżka, grywalizacja, Dzień 1 jako demo) i wprowadza poprawki jakościowe z `oprawki_claude.txt` (uczciwe liczby, obawa użytkownika, compliance, offline). Kontrakt pól i matematyka: `02_TECH_API_AND_MATH.md`.

## 1. Filozofia Produktu (Realistyczny Model Speakly dla Początkujących Inwestorów)
* **Odbiorca:** początkujący, samodzielni inwestorzy indywidualni, wszystkie grupy wiekowe, którzy boją się zacząć.
* **Realistyczny rytm nauki (produkt docelowy):** nie budujemy jednorazowego „zostań inwestorem w 5 minut". Wzorem **Speakly/Duolingo** klient wraca **5–10 minut dziennie przez 14 dni** (*„Od zera do pierwszej świadomej inwestycji w 14 dni"*).
* **North Star:** maksymalny stosunek **praktycznej wiedzy i realnej gotowości** do **poświęconego czasu**.
* **Zakres prototypu:** w 100% interaktywny **Dzień 1 z 14** (3–4 minuty) + widoczna **14-dniowa mapa** dalszych etapów (Dni 2–14 tylko jako zablokowane kamienie milowe).
* **Cel biznesowy:** doprowadzić klienta do pierwszego świadomego kroku w banku (konto oszczędnościowe, potem plan inwestycyjny). Patrz §4.
* **Zasada uczciwości (twarda):** budujemy pewność opartą na **rozumieniu**, nie na obietnicach. Nigdy: gwarantowany zysk, „100% pewności", liczby bez jawnych założeń, porównania w różnych jednostkach (patrz §8 i docs/02 §3).

### Uniwersalne 4 filary wiedzy (minimum dla każdej grupy, od Dnia 1)
1. **Inflacja = realna strata wartości gotówki** na koncie 0%.
2. **Poduszka najpierw:** poduszka służy na awarie; inwestowanie to osobne pieniądze na długi horyzont.
3. **Prosty start:** szeroki, tani, zdywersyfikowany ETF zamiast zgadywania pojedynczych spółek.
4. **Wahania są normalne:** dane historyczne pokazują wahania oraz to, że dłuższy horyzont historycznie ograniczał ryzyko straty — **bez gwarancji**.

---

## 2. Mechaniki Grywalizacji i Budowania Nawyku
1. **Ankieta (Ekran 1):** 6 szybkich pytań (wiek, zarobki, wolne środki, poduszka, główna obawa, samoocena pewności 1–5).
2. **Mapa 14-Dniowej Ścieżki (Ekran 2):** oś 4 kamieni milowych (`Dzień 1` aktywny + `Dzień 4`, `Dzień 9`, `Dzień 14` zablokowane kłódką).
3. **Mikro-lekcje Dnia 1 (Ekran 2):** 3 karty „1 fakt + 1 konkret" (20 s), odhaczane za `+15 XP` (opcjonalne, maks. `+45 XP`).
4. **Codzienny AI Coach (Luna) + Symulacja Wyborów (Ekran 3):** 3 kroki życiowych decyzji dopasowane do wieku, obawy i kwot użytkownika.
5. **Wskaźnik Gotowości (`confidence_score`):** startuje od **samooceny użytkownika** (1–5 -> 5–25%; persony demo: 10%), a po Dniu 1 rośnie o maks. **+30 pkt** (demo: **10% -> 40%**). Komunikat: pełną gotowość da dopiero Dzień 14. Błędna lub nieoceniona odpowiedź daje tylko `+2`.
6. **Poziomy i XP:** start `Poziom 1: Obserwator` (20 XP); po ukończeniu Dnia 1 z samymi dobrymi odpowiedziami `155 XP` i **`🏆 AWANS! Poziom 2: Świadomy Start`** (próg awansu 100 XP — przy słabszych odpowiedziach awans nie następuje i UI mówi, ile XP brakuje).
7. **Streak:** pigułka `🔥 Dzień 1`; po ukończeniu animacja *„Seria rozpoczęta! Wróć jutro po Dzień 2"*.
8. **Realne Mikro-Wyzwanie „Zero Strachu" (Ekran 4):** dla braku poduszki lub grupy `20+`: *„Wpłać 5 zł na konto oszczędnościowe"*; dla `30-50`/`50+` z poduszką: *„Przelej próbne 50 zł na subkonto startowe"*. Przycisk `Podejmuję wyzwanie (+50 XP)` -> konfetti, XP `155 -> 205` (5 XP za liderem `Kasia K. — 210 XP`, motywacja do powrotu na Dzień 2).
9. **Ranking Znajomych (Ekran 4, widget demo):** tabela 4 pozycji (3 **przykładowych** znajomych + Ty), podpisana *„Przykładowi znajomi (demo)"*. Przycisk `⚔️ Wyzwij znajomego` kopiuje zaproszenie do schowka (toast).

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

### Układ responsywny (mobile-first, rzutnik OK)
Kontener `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8`; układy `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`; nagłówek i Demo Mode pionowo na małym ekranie; elementy dotykowe min. **44 px**. Brak osobnej aplikacji natywnej.

### Obowiązkowe mikro-animacje CSS (`static/styles.css`)
1. **`.btn-3d`:** tło `#FFCC00`, tekst `#002E3C` (`font-extrabold`), `border-bottom: 4px solid #D9A900`, `border-radius: 1rem`; `:active` `translateY(3px); border-bottom-width: 1px`.
2. **`.screen-enter`:** `@keyframes fadeSlideUp` (`0.35s cubic-bezier(0.16, 1, 0.3, 1)`).
3. **`.shimmer-bar`:** biały refleks na paskach Gotowości i XP przy każdym wzroście.
4. **`.topic-strike`:** `removed_topics` pojawiają się po `400ms`, potem co `120ms` `line-through`, czerwony akcent, `opacity: 0.45`; obok zielony badge **`⚡ Pominęliśmy {n} tematów, których nie potrzebujesz na start`** (`n = removed_topics.length`).
5. **`.level-pop`:** bounce + złota poświata karty awansu (Ekran 4).
6. **`.glow-pulse`:** pulsujący złoty cień przycisku bankowego po odhaczeniu checklisty.
7. **`.tabular-nums`:** `font-variant-numeric: tabular-nums` dla kwot, XP i procentów.

---

## 6. Stały Nagłówek Aplikacji (każdy ekran)
* **Lewa:** `Finance Quest` + podtytuł `by Commerzbank • Plan 14 Dni`.
* **Środek:**
  * Badge `📅 Dzień 1 z 14`.
  * Badge poziomu: `⭐ Poz. 1: Obserwator ({xp} XP)` -> `🏆 Poz. 2: Świadomy Start` po awansie.
  * Badge streaka `🔥 1 dzień` (`#F97316`).
  * **Gotowość (od Ekranu 2):** pasek `Gotowość: XX%` z animowanym `+10` (wartość z `confidence_score`, startuje od samooceny).
* **Prawa (DEMO MODE + Język):**
  * Przełącznik języka **`PL | EN`** (przyciski min. `44 px` wysokości, `aria-pressed`, zapis wyboru w `localStorage`), domyślnie `PL`.
  * 3 pigułki `[22 l. Student]`, `[38 l. Rodzina]`, `[56 l. 50+]` (w EN: `[22y Student]`, `[38y Family]`, `[56y 50+]`) — wypełniają profil z `GET /api/demo-personas?lang={lang}` i uruchamiają analizę w aktualnym języku.

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
1. **Karta A — Mapa 14 dni (`roadmap_milestones`):** pozioma oś 4 kroków (Dzień 1 `[Aktywny — Dziś]`, Dni 4/9/14 `[🔒]`).
2. **Karta B — Filtr Speakly + 3 mikro-lekcje Dnia 1:**
   * Badge `⚡ Pominęliśmy {removed_topics.length} tematów, których nie potrzebujesz na start`.
   * **Lewa:** 3 klikalne mikro-lekcje (`micro_lessons`, tytuł, `20 sek.`, konkret, `Rozumiem! (+15 XP)`) — kliknięcie odhacza kartę na zielono i podbija lokalny `microLessonBonusXp` (maks. `+45`, opcjonalne). **Reguła monotonicznego XP:** nagłówek zawsze wyświetla `gamification.xp + microLessonBonusXp`, żeby licznik nigdy nie cofnął się po wejściu na Ekran 3 (backend zwraca bazowe `xp = 60 / 95 / 155`).
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

### Ekran 3: `screen_mission_live` (Symulacja Wyborów z Luną — 3 kroki)
* **Górny mini-panel:** `Dzień 1 z 14 • Symulacja wyborów • Krok {step_number} z 3`; `{portfolio_status.simulated_value} zł` (count-up, wartość nominalna); `{portfolio_status.event_badge}`.
* **Karta feedbacku (po kroku 1, 2 i 3):** dymek z ikoną tarczy/mózgu z `{understanding_feedback}` + pigułka `+{xp_gained} XP`. **Kolor:** zielony gdy `is_optimal_choice == true`, **ciepły bursztynowy** gdy `false` (nigdy czerwony, nigdy zawstydzający).
* **Karta Luny:** awatar **`Luna • Twój codzienny AI Coach`** + `{luna_message}` (2–3 zdania). Kropki *„Luna analizuje Twoją odpowiedź..."* tylko dla wolnego tekstu; **klik karty odpowiada natychmiast** (bez LLM).
* **Interakcja:**
  * 3 karty `quick_replies` (kolejność tasuje backend). Klik wysyła `user_message = text` i `quick_reply_id = id`.
  * Pole tekstowe (`placeholder="Lub napisz AI Coachowi własnymi słowami, co robisz i dlaczego..."`) + `Wyślij` (bez `quick_reply_id`).
* **Dopamina:** `trigger_confetti: true` (tylko przy odpowiedzi optymalnej) -> `confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } })`; pasek Gotowości i XP rosną z animacją.
* **Zakończenie:** `mission_completed === true` -> przycisk `.btn-3d` **`Zakończ Dzień 1 i odbierz podsumowanie ->`** -> Ekran 4.

### Ekran 4: `screen_checklist` (Ukończenie Dnia 1, Wyzwanie, Ranking i Commerzbank)
Układ 2-kolumnowy od `md`, 1 kolumna na mobile.
1. **Baner (`.level-pop`, pełna szerokość):**
   * Gdy `gamification.leveled_up`: **`🏆 DZIEŃ 1 Z 14 UKOŃCZONY! AWANS: {level_title}`** (`Poziom {level}` • `{xp} XP` • `🔥 Seria: 1 dzień`).
   * Gdy `false`: **`DZIEŃ 1 Z 14 UKOŃCZONY`** + *„Do Poziomu 2 brakuje {100 - xp} XP — wróć jutro i nadrób!"*.
   * Pasek **`Gotowość: {confidence_start}% -> {confidence_score}%`** (wartości z API; **nie wpisywać na sztywno**). Podpis: *„Pełną gotowość da dopiero Dzień 14."*
   * **Samoocena „po":** *„Jak pewnie czujesz się teraz? (1–5)"* -> wyświetlenie **„Przed: X/5 -> Po: Y/5"** (tylko frontend; w produkcie metryka dla banku).
2. **Lewa kolumna — Realne działanie dziś:**
   * **Karta 1: Realne Mikro-Wyzwanie (`real_world_challenge`)** w złotej ramce: tytuł, opis, przycisk **`Podejmuję wyzwanie (+{reward_xp} XP)`** -> `POST /api/challenge/accept` -> zielony badge `✅ Wyzwanie przyjęte! +50 XP`, konfetti, aktualizacja XP i rankingu.
   * **Karta 2: Checklista Dnia 1 (`final_checklist`, 4 pozycje):** klikalne karty z checkboxem i animacją *bounce*; zaznaczenie wszystkich 4 -> **pełne konfetti** `['#FFCC00', '#002E3C', '#10B981']` i `.glow-pulse` na przycisku bankowym.
3. **Prawa kolumna — Bank i społeczność:**
   * **Karta 3: Przykładowy plan w Commerzbanku (`bank_draft`):** dwa kroki: mikro-ruch dziś (`{real_world_challenge.amount_pln} zł`) oraz plan docelowy na Dzień 14 (`{monthly_amount} zł/mies.`, horyzont `{horizon_years} lat`). Szacunek edukacyjny w dzisiejszych zł: **ETF `{projected_etf_real_value}` zł vs wpłaty na koncie 0% `{projected_cash_real_value}` zł** (nominalnie ETF: `{projected_etf_nominal_value}` zł). Pod spodem drobnym drukiem `{assumptions_text}` i `{costs_note}`. W trybie `savings_first` karta pokazuje plan poduszki (`{emergency_savings_monthly} zł/mies.`), a ETF jako „na później". Przycisk `.btn-3d` **`Wykonaj krok Dnia 1 lub zobacz przykładowy plan w Commerzbanku ->`** -> `modal_bank_order`.
   * **Karta 4: Ranking (`leaderboard`)** „Przykładowi znajomi (demo)": 4 osoby z XP i serią `🔥`; wiersz użytkownika podświetlony, z `⬆️ Awans!` tylko gdy `leveled_up`; przycisk `⚔️ Wyzwij znajomego` (schowek + toast).
4. **Stopka (compliance):** *„Aplikacja Finance Quest ma charakter wyłącznie edukacyjny i symulacyjny. Wyliczenia opierają się na uproszczonych założeniach i danych historycznych, nie uwzględniają podatku od zysków, opłat ani ryzyka walutowego, nie gwarantują przyszłych wyników i nie stanowią doradztwa inwestycyjnego ani rekomendacji w rozumieniu dyrektywy MiFID II. Inwestowanie wiąże się z ryzykiem utraty części lub całości kapitału."*

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

## 9. Wersja dwujęzyczna (PL / EN)

* **Przełącznik w nagłówku:** przyciski `PL | EN` obok Demo Mode (min. `44 px`, `aria-pressed`), domyślnie `"pl"`. Wybór jest zapisywany w `localStorage` pod kluczem `fq_lang` i aktualizuje atrybut `<html lang="pl|en">` oraz `<title>` / meta opis.
* **Implementacja bez build-toola i bez zewnętrznych bibliotek i18n:** lekki słownik `I18N = { pl: {...}, en: {...} }` w `static/app.js` oraz atrybuty `data-i18n` / `data-i18n-aria` w `static/index.html` (zero nowych zależności w `static/vendor/`).
* **Zachowanie przy zmianie języka w trakcie pracy aplikacji:**
  * **Ekran 1:** natychmiast tłumaczy statyczne UI i ponownie pobiera `GET /api/demo-personas?lang={lang}`.
  * **Ekran 2:** tłumaczy statyczne UI (oś wykresu `Rok 0` / `Year 0`, etykiety, przyciski, stopka) oraz ponawia `POST /api/onboarding/analyze` z aktualnym profilem i nowym `lang`, aby odświeżyć filtr Speakly, mapę 14 dni, mikro-lekcje, opis planu i turę startową.
  * **Ekrany 3–4 i Modal:** tłumaczy statyczne UI oraz przekazuje nowy `lang` w kolejnym żądaniu `POST /api/mission/turn` / `POST /api/challenge/accept`; kliknięcie pigułki Demo Mode uruchamia świeżą sesję w aktualnym języku.
* **Waluta i jednostki bez FX:** wszystkie kwoty pozostają w **PLN** (bez przeliczania kursów) — w wersji PL zapis `zł`, w wersji EN zapis `PLN`. Wykres w EN używa podpisu osi `Year 0` i etykiety `today's PLN`.
* **Angielski słownik compliance (§8 dla `lang="en"`):**
  * Zamiast *„safe amount”* używać wyłącznie *„illustrative target amount”* / *„sensible starting point”*.
  * Używać *„sample plan”*, *„broad global ETF”*, *„historical data”* (zero obietnic zysku, zero tickerów).
  * Zamiast *„99% without loss”* używać *„in illustrative historical windows, X% ended with a positive real return”* (limit wyświetlania `min(97, wartość)`).
  * Gotowość: *„Readiness: {start}% -> {score}%”* (*„full readiness comes on Day 14”*).
* **Angielska stopka compliance (MiFID II) pod wykresem Ekranu 2 i na Ekranie 4:**
  * *„Finance Quest is strictly an educational and simulation tool. Calculations are based on simplified assumptions and historical data, exclude capital gains tax, brokerage fees, and currency risk, do not guarantee future returns, and do not constitute investment advice or a recommendation under MiFID II. Investing involves the risk of losing part or all of your capital.”*
