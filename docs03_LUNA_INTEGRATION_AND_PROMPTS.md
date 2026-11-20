# 03. SSOT Integracji Modułu Luny, Maszyny Stanów i Fallbacków

## 1. Plan szybkiej przeróbki istniejącego modułu Luny (15–20 minut)
Z istniejącego projektu wirtualnego asystenta (Allegro) przenosimy wyłącznie warstwę połączenia z LLM do pliku `backend/luna_service.py`:

* **ZACHOWUJEMY:**
  * Inicjalizację klienta (`OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=8.0)`).
  * Wywołanie chat completions z wymuszonym JSON: `response_format={"type": "json_object"}`.
  * Przekazywanie listy `messages` (`system` + krótka historia tury użytkownika).
* **USUWAMY:**
  * Całą logikę Allegro, pobieranie aukcji/zamówień, bazy danych, RAG, wyszukiwanie produktów.
* **DODAJEMY (OBOWIĄZKOWY BEZPIECZNIK NA DEMO):**
  * Całe wywołanie LLM musi być owinięte w `try ... except Exception:`.
  * Jeśli API przekroczy `8 sekund`, zwróci błąd sieci, zły JSON albo zabraknie klucza w `.env` -> `luna_service.py` natychmiast zwraca gotowy, dopracowany obiekt `MissionTurnResponse` z `demo_data.py` dla danej pary `(age_group, target_step)` uzupełniony o realne liczby użytkownika!
  * **Efekt:** Nawet gdyby na sali padło Wi-Fi w trakcie 5-minutowego pitchu, prezentacja zadziała w 100% płynnie i jury nie zauważy żadnego problemu.

---

## 2. Maszyna Stanów Misji (Zawsze dokładnie 3 kroki)

Stan sesji przechowywany w `SESSIONS[session_id]` zawiera:
```python
{
    "session_id": str,
    "age": int,
    "age_group": "20+" | "30-50" | "50+",
    "recommended_monthly": int,
    "horizon_years": int,
    "etf_future_value": int,
    "cash_real_value": int,
    "win_rate": int,
    "current_step": 1,           # Startuje na 1 po onboardingu
    "confidence_score": 25,
    "history": []                # Lista ostatnich wiadomości role/content
}
```

### Logika przejść w `POST /api/mission/turn`:
1. **Gdy `session["current_step"] == 1`** (użytkownik właśnie odpowiedział na Krok 1 — *Dlaczego szeroki ETF?*):
   * Cel: Ocena zrozumienia Kroku 1 + uruchomienie **Kroku 2 (Życiowy test lęku pokolenia)**.
   * Aktualizujemy: `session["current_step"] = 2`, `confidence_score` rośnie z `25` do ok. `60` (`confidence_delta = +35`), `mission_completed = False`.
2. **Gdy `session["current_step"] == 2`** (użytkownik odpowiedział na życiowy test — *płynność / spadek rynku / inflacja*):
   * Cel: Ocena zrozumienia Kroku 2 + uruchomienie **Kroku 3 (Przewinięcie w czasie na liczbach użytkownika i pytanie o gotowość)**.
   * Aktualizujemy: `session["current_step"] = 3`, `confidence_score` rośnie z `60` do ok. `85` (`confidence_delta = +25`), `mission_completed = False`.
3. **Gdy `session["current_step"] == 3`** (użytkownik odpowiedział na Krok 3):
   * Cel: Krótkie gratulacje od Luny + **ZAKOŃCZENIE MISJI**.
   * Backend **deterministycznie** (zawsze, niezależnie od LLM!) dokleja:
     * `step_number = 3`
     * `confidence_score = 100`
     * `confidence_delta = 100 - prev_confidence`
     * `mission_completed = True`
     * `trigger_confetti = True`
     * `quick_replies = []`
     * `final_checklist` (z `demo_data.py` wypełnione konkretnymi liczbami użytkownika)
     * `bank_draft` (wyliczone z `session`)

---

## 3. Gotowy System Prompt dla Luny (`LUNA_SYSTEM_PROMPT`)

Użyj tego dokładnego szablonu z metodą `.format(...)` w `backend/luna_service.py`:

```text
Jesteś Luna — nowoczesny, ciepły i ultrakonkretny trener finansowy w aplikacji Finance Quest (wzorowanej na metodologii Speakly).
Twoim celem jest maksymalny stosunek zdobytej wiedzy do poświęconego czasu i zbudowanie pewności siebie użytkownika, by odważył się rozpocząć inwestowanie.

DANE UŻYTKOWNIKA (LICZBY OBLICZONE PRZEZ SYSTEM — UŻYWAJ DOKŁADNIE TYCH WARTOŚCI, NIE LICZ SAMODZIELNIE):
- Grupa wiekowa: {age_group} (wiek: {age} lat)
- Bezpieczna kwota miesięczna: {recommended_monthly} zł
- Domyślny horyzont: {horizon_years} lat
- Symulowana wartość szerokiego ETF po {horizon_years} latach: {etf_future_value} zł
- Realna siła nabywcza tej samej gotówki na koncie po inflacji: {cash_real_value} zł
- Historyczny odsetek okresów z zyskiem po {horizon_years} latach: {win_rate}%

ZADANIE NA TĘ TURĘ:
- Użytkownik właśnie odpowiedział na Krok {answered_step} z 3.
- Teraz generujesz odpowiedź prowadzącą do Kroku {next_step} z 3 (lub zakończenia misji, jeśli answered_step == 3).

KONKRETNY SCENARIUSZ DLA GRUPY "{age_group}":
- Dla "20+":
  * Krok 2 (życiowy test): Przewijamy o 6 miesięcy (masz ok. {half_year_value} zł w ETF). Nagle psuje się laptop i potrzebujesz części pieniędzy. Sprawdź, czy użytkownik wie, że pieniądze w ETF NIE są zamrożone na stałe i można je wypłacić w kilka dni.
  * Krok 3 (efekt skali): Przewiń o {horizon_years} lat do przodu. Pokaż potęgę startu w młodym wieku: {etf_future_value} zł w ETF vs tylko {cash_real_value} zł realnej wartości na zwykłym koncie zjedzonym przez inflację (historyczna szansa na zysk: {win_rate}%). Zapytaj, co teraz najbardziej dodaje mu odwagi do startu.
- Dla "30-50":
  * Krok 2 (życiowy test): Przewijamy o 6 miesięcy (masz ok. {half_year_value} zł w ETF). W pracy gorący okres, zero czasu na śledzenie giełdy, a rynek przejściowo spadł o 10%. Sprawdź, czy użytkownik panikuje, czy stawia na spokój i automatyczne działanie ETF w tle (bo ma oddzielną poduszkę finansową).
  * Krok 3 (efekt czasu i spokoju): Przewiń o {horizon_years} lat do przodu. Pokaż wynik: {etf_future_value} zł w ETF vs {cash_real_value} zł realnie na koncie po inflacji (szansa na zysk: {win_rate}%). Zapytaj o gotowość do ustawienia automatycznego startu.
- Dla "50+":
  * Krok 2 (życiowy test): Przewijamy o 6 miesięcy (masz ok. {half_year_value} zł w ETF). Inflacja nadal zjada gotówkę na koncie, a ETF chwilowo waha się o -6%. Sprawdź, czy użytkownik pamięta, że inwestować można w każdym wieku i przy horyzoncie {horizon_years} lat ważniejsza jest ochrona przed inflacją niż chwilowe wahania.
  * Krok 3 (ochrona kapitału): Przewiń o {horizon_years} lat do przodu. Pokaż wynik: {etf_future_value} zł vs {cash_real_value} zł po inflacji (historycznie {win_rate}% okresów na plusie). Zapytaj, jak teraz ocenia rozpoczęcie inwestowania w swoim wieku.

TWARDE REGUŁY STYLU (SPEAKLY):
1. ZWIĘZŁOŚĆ: Pole "understanding_feedback" ma mieć MAX 1–2 krótkie zdania. Pole "luna_message" ma mieć MAX 2–3 krótkie zdania. ZERO ścian tekstu!
2. REALNA OCENA ZROZUMIENIA: W "understanding_feedback" odnieś się bezpośrednio do tego, co napisał użytkownik. Jeśli się pomylił — ciepło i konkretnie wyjaśnij w 1 zdaniu, dlaczego inne podejście go chroni.
3. JĘZYK: Naturalny polski, zero korporacyjnego i angielskiego żargonu. Dla grupy "50+" mów spokojnie, z szacunkiem i wyjątkowo klarownie.
4. COMPLIANCE BANKOWE: Nigdy nie obiecuj gwarantowanego zysku i nie podawaj nazw konkretnych tickerów giełdowych. Zawsze mów o "szerokich funduszach ETF" i "danych historycznych".

WYMAGANY FORMAT WYJŚCIOWY (WYŁĄCZNIE CZYSTY JSON):
{{
  "understanding_feedback": "Krótka, spersonalizowana ocena odpowiedzi użytkownika (1-2 zdania).",
  "luna_message": "Krótka sytuacja życiowa kolejnego kroku i pytanie (2-3 zdania). Jeśli answered_step == 3, krótkie gratulacje i zachęta do odhaczenia checklisty.",
  "quick_replies": ["Krótka opcja 1", "Krótka opcja 2", "Krótka opcja 3"],
  "event_badge": "Krótki tag zdarzenia (max 4 słowa)",
  "trigger_confetti": true
}}
```
*(Uwaga dla backendu: jeśli `answered_step == 3`, backend nadpisuje `quick_replies = []`, `mission_completed = True`, `confidence_score = 100` i dokleja `final_checklist` oraz `bank_draft` — dzięki temu LLM nie może zepsuć zakończenia misji!)*

---

## 4. Kompletna tabela Fallbacków i Kroków Startowych (`backend/demo_data.py`)

Poniższe teksty służą jako:
1. **Krok 1 (startowy)** zwracany natychmiast w `POST /api/onboarding/analyze` (0 ms czekania na LLM podczas ładowania Ekranu 2!).
2. **Niezawodny Fallback** dla Kroków 2 i 3, gdyby API Luny miało timeout na prezentacji.

### Grupa `20+` (`young_20`: 22 l., 4500 zł netto, 1000 zł wolne, brak poduszki)
* **Krok 1 (Start):**
  * `luna_message`: *"Świetny start! Zaczynając z kwotą {recommended_monthly} zł miesięcznie nie musisz zgadywać pojedynczych firm — szeroki ETF rozkłada Twoje pieniądze na setki spółek naraz. Co na start daje Ci większy spokój?"*
  * `quick_replies`: `["Szeroki ETF na cały rynek (dywersyfikacja)", "Kupno akcji jednej znanej firmy", "Zostawienie całej kwoty na zwykłym koncie"]`
  * `event_badge`: `"Start misji • {recommended_monthly} zł/mies."`
* **Fallback Krok 2 (Test płynności — Laptop):**
  * `understanding_feedback`: *"Świetny tok myślenia! Rozłożenie kapitału na setki firm w szerokim ETF chroni Cię przed wpadką pojedynczej spółki."*
  * `luna_message`: *"Przewijamy o 6 miesięcy — masz już ok. {half_year_value} zł w ETF! Nagle psuje się Twój laptop i potrzebujesz części pieniędzy. Wiele młodych osób boi się, że środki są zamrożone na lata. Co robisz?"*
  * `quick_replies`: `["Sprzedaję część ETF — pieniądze wypłacam w 2 dni robocze", "Nic nie zrobię, kasa jest zablokowana na 15 lat", "Biorę drogą pożyczkę, bo ETF nie da się ruszyć"]`
  * `event_badge`: `"Nagły wydatek • Test płynności"`
* **Fallback Krok 3 (Efekt skali w młodym wieku):**
  * `understanding_feedback`: *"Dokładnie tak! Pieniądze w ETF nie są tam permanentnie — w każdej chwili możesz je sprzedać i wypłacić na konto."*
  * `luna_message`: *"Przewijamy o {horizon_years} lat! Dzięki startowi w młodym wieku Twoje {recommended_monthly} zł/mies. urosło historycznie do ok. {etf_future_value} zł, podczas gdy gotówka na koncie po inflacji byłaby warta realnie tylko {cash_real_value} zł (historycznie {win_rate}% okresów na plusie). Gotowy na podsumowanie?"*
  * `quick_replies`: `["Tak, efekt czasu robi ogromne wrażenie!", "Chcę zobaczyć moją checklistę pierwszego kroku"]`
  * `event_badge`: `"Wehikuł czasu • +{horizon_years} lat"`

### Grupa `30-50` (`mid_38`: 38 l., 11000 zł netto, 2500 zł wolne, ma poduszkę)
* **Krok 1 (Start):**
  * `luna_message`: *"Masz już poduszkę finansową, więc Twoje {recommended_monthly} zł miesięcznie może pracować w szerokim ETF zupełnie w tle — bez codziennego śledzenia giełdy. Co jest największą zaletą takiego podejścia przy braku czasu?"*
  * `quick_replies`: `["Automatyzacja i dywersyfikacja bez patrzenia w wykresy", "Codzienne wyszukiwanie okazji na giełdzie", "Trzymanie wszystkich nadwyżek na koncie 0%"]`
  * `event_badge`: `"Start misji • {recommended_monthly} zł/mies."`
* **Fallback Krok 2 (Test spokoju i automatyzacji):**
  * `understanding_feedback`: *"W punkt! Pasywny ETF oszczędza Twój czas i nie wymaga bycia ekspertem od giełdy."*
  * `luna_message`: *"Mija 6 miesięcy, masz ok. {half_year_value} zł w ETF. W pracy masz urwanie głowy, a media krzyczą o spadku rynku o 10%. Twoja poduszka rodzinna jest nienaruszona. Co robisz?"*
  * `quick_replies`: `["Nic nie zmieniam — mam poduszkę i trzymam plan w tle", "Sprzedaję wszystko w panice ze stratą", "Zaczynam codziennie sprawdzać notowania w pracy"]`
  * `event_badge`: `"Spadek rynku -10% • Test spokoju"`
* **Fallback Krok 3 (Ochrona czasu i pokonanie inflacji):**
  * `understanding_feedback`: *"Brawo! Oddzielenie poduszki od inwestycji pozwala zachować spokój i nie podejmować emocjonalnych decyzji."*
  * `luna_message`: *"Przewijamy o {horizon_years} lat! Bez śledzenia wykresów Twoje {recommended_monthly} zł/mies. dało historycznie ok. {etf_future_value} zł — zamiast {cash_real_value} zł realnej wartości na zwykłym koncie zjedzonym przez inflację (historyczna szansa na zysk: {win_rate}%). Przechodzimy do planu działania?"*
  * `quick_replies`: `["Tak, pokaż moją checklistę pierwszego kroku", "Wchodzę w to — chcę zobaczyć gotowy szkic"]`
  * `event_badge`: `"Wehikuł czasu • +{horizon_years} lat"`

### Grupa `50+` (`senior_56`: 56 l., 9500 zł netto, 3000 zł wolne, ma poduszkę)
* **Krok 1 (Start):**
  * `luna_message`: *"Inwestować można z powodzeniem w każdym wieku — wystarczy dopasować horyzont i nie ryzykować poduszki. Z kwotą {recommended_monthly} zł miesięcznie szeroki ETF pomaga chronić kapitał przed inflacją. Dlaczego lepiej nie trzymać wszystkiego na zwykłym koncie?"*
  * `quick_replies`: `["Bo inflacja co roku realnie zmniejsza wartość gotówki", "Bo na koncie pieniądze są bezpieczne i nigdy nie tracą", "Lepiej wrzucić całość oszczędności w jedną ryzykowną firmę"]`
  * `event_badge`: `"Start misji • {recommended_monthly} zł/mies."`
* **Fallback Krok 2 (Test ochrony kapitału i horyzontu):**
  * `understanding_feedback`: *"Dokładnie tak! Brak decyzji i trzymanie całej gotówki na koncie to pewna utrata siły nabywczej przez inflację."*
  * `luna_message`: *"Po 6 miesiącach masz ok. {half_year_value} zł w szerokim ETF. Inflacja wciąż jest wysoka, a rynek przejściowo drgnął o -6%. Twój horyzont to {horizon_years} lat, a poduszkę masz bezpiecznie na boku. Jak reagujesz?"*
  * `quick_replies`: `["Zachowuję spokój — małe wahania w horyzoncie {horizon_years} lat są naturalne", "Wycofuję wszystko na zwykłe konto, bo boję się wahań", "Jestem za stary na inwestowanie, rezygnuję"]`
  * `event_badge`: `"Wahanie -6% • Ochrona kapitału"`
* **Fallback Krok 3 (Każdy wiek jest dobry):**
  * `understanding_feedback`: *"Świetna, dojrzała decyzja! Spokojny horyzont i brak paniki to najlepsza tarcza ochronna dla kapitału."*
  * `luna_message`: *"Po {horizon_years} latach Twoje {recommended_monthly} zł/mies. urosło historycznie do ok. {etf_future_value} zł, podczas gdy gotówka na koncie po inflacji byłaby realnie warta {cash_real_value} zł (historycznie {win_rate}% okresów na plusie). Wiek nie jest żadną przeszkodą — gotowy na checklistę?"*
  * `quick_replies`: `["Tak, pokaż moją bezpieczną checklistę startu", "Zaczynamy — pokaż podsumowanie pierwszego kroku"]`
  * `event_badge`: `"Wehikuł czasu • +{horizon_years} lat"`

---

## 5. Szablon 4 punktów Checklisty (`final_checklist`) generowany w Pythonie
W kroku 3 backend zawsze buduje tablicę 4 punktów spersonalizowaną pod `age_group` i wyliczone kwoty:
1. **`chk_1`:** `Mam wyznaczoną bezpieczną kwotę startową: {recommended_monthly} zł / mies.` *(detail: „Kwota dopasowana do Twoich wolnych środków bez naruszania codziennego bezpieczeństwa.”)*
2. **`chk_2`:** `Rozumiem, że gotówka na zwykłym koncie traci realną wartość przez inflację.` *(detail: „W horyzoncie {horizon_years} lat różnica względem szerokiego ETF to historycznie ok. {diff_value} zł.”)*
3. **`chk_3`:** `Wiem, dlaczego szeroki ETF na {horizon_years} lat drastycznie obniża ryzyko straty.` *(detail: „Historycznie aż {win_rate}% takich okresów kończyło się na plusie.”)*
4. **`chk_4` (zależny od pokolenia):**
   * Dla `20+`: `Wiem, że moje środki są płynne — mogę je wypłacić w kilka dni, a czas pracuje na skalę zysku.`
   * Dla `30-50`: `Wiem, że pasywny ETF działa automatycznie w tle — bez codziennego śledzenia giełdy.`
   * Dla `50+`: `Wiem, że inwestować można w każdym wieku, chroniąc zgromadzony kapitał przed inflacją.`