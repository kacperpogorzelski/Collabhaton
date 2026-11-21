/* ==========================================================================
   Investly — static/simulator.js  (Issue #61: educational "What-If" simulator)
   A self-contained module for #card-timemachine, loaded before app.js.
   app.js only calls window.InvestlySim.mount(...) and .refresh(...).

   The card is built to teach, not just to plot:
     1. A quiet "Ask Atlas" link for anything unclear (opens the app's Atlas drawer).
     2. Controls — monthly amount and horizon up front; the rest under "More settings".
     3. Results — three KPIs, then one bar that shows how the end value is built
        (what you paid in, what growth added, what inflation takes away).
     4. "What this shows" — live sentences: inflation on cash, when growth overtakes
        your own payments, what starting 5 years later costs, how a crash recovers.
     5. Chart + a comparison table that is also the legend and the asset picker.

   Maths: monthly compounding, same formula as backend/finance_math.py
   (generate_projection_series). With the default settings (global ETF at the
   server's 5.7% net, 3.5% inflation, no starting amount, the plan's monthly
   amount) the ETF and cash lines match the server's projection_series to the
   złoty, including the -20% year-3 stress overlay. Other asset classes use
   fixed, illustrative long-term averages — not year-by-year history.
   ========================================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // 1. Assets and constants
  // ------------------------------------------------------------------------
  // rate: nominal yearly return after costs, before tax (ETF comes from the server).
  // shock: value multipliers in years 3–6 when the crisis switch is on. Equities use the
  // backend's own STRESS_MULTIPLIER; bonds dip 5%; gold and cash are not shocked.
  // swing: 0–4, how hard a bad year can hit (educational scale, not a measured volatility).
  const EQUITY_SHOCK = { 3: 0.80, 4: 0.85, 5: 0.90, 6: 0.95 };
  const BOND_SHOCK = { 3: 0.95, 4: 0.9625, 5: 0.975, 6: 0.9875 };
  const ASSETS = [
    { id: 'etf', rate: null, color: '#10B981', dash: [], shock: EQUITY_SHOCK, swing: 3 },
    { id: 'sp500', rate: 0.065, color: '#0369A1', dash: [], shock: EQUITY_SHOCK, swing: 4 },
    { id: 'bonds', rate: 0.040, color: '#49606C', dash: [10, 4], shock: BOND_SHOCK, swing: 1 },
    { id: 'gold', rate: 0.045, color: '#B98C24', dash: [], shock: null, swing: 3 },
    { id: 'cash', rate: 0, color: '#EF4444', dash: [7, 5], shock: null, swing: 0 },
  ];
  const FOCUS_ORDER = ['etf', 'sp500', 'bonds', 'gold'];
  const ETF_DEFAULT_RATE = 0.057;     // docs/02 §3A fallback when the server sends no assumptions
  const INFLATION_DEFAULT = 3.5;
  const DELAY_YEARS = 5;
  const WIN_RATE_CAP = 97;            // docs/02 §3B: never above 97%
  const WIN_RATE_KEYS = { 1: 73, 3: 84, 5: 90, 7: 93, 10: 96, 15: 99, 20: 100 };
  const LIMITS = { monthly: [50, 10000], initial: [0, 50000], years: [1, 30], inflation: [2, 8] };

  // Non-linear slider grids: fine steps where most people are, coarse steps at the top.
  function grid(parts) {
    const out = [];
    parts.forEach(([from, to, step]) => { for (let v = from; v <= to; v += step) if (out[out.length - 1] !== v) out.push(v); });
    return out;
  }
  const MONTHLY_GRID = grid([[50, 1000, 50], [1000, 3000, 100], [3000, 10000, 250]]);
  const INITIAL_GRID = grid([[0, 5000, 250], [5000, 20000, 1000], [20000, 50000, 2500]]);

  // ------------------------------------------------------------------------
  // 2. Copy (EN + PL). Amounts stay in PLN; app.js formats them.
  // ------------------------------------------------------------------------
  const COPY = {
    en: {
      sub: 'Same money, different choices. Move a slider and every number below explains itself.',
      headChip: '{amount}/mo for {years}',
      askPrompt: 'Not sure what a number means?',
      askAtlas: 'Ask Atlas',
      monthly: 'Monthly contribution',
      years: 'Horizon',
      more: 'More settings',
      changed: '{n} changed',
      initial: 'Starting amount',
      inflation: 'Inflation per year',
      valuesIn: 'Show values',
      real: 'In today’s money',
      nominal: 'Nominal',
      crisis: 'Simulate a crisis (-20% in year 3)',
      crisisHint: 'Stocks fall 20% in year 3 and recover over years 4–6.',
      reset: 'Reset to my plan',
      planNote: 'Your sample plan: {plan}/mo for {years}.',
      whatIfNote: 'What-if view. Your sample plan is {plan}/mo for {years}.',
      amountAria: '{label} in PLN',
      kpiPaid: 'You pay in',
      kpiPaidSub: 'Your own money, before any growth.',
      kpiFocus: '{asset} in {years}',
      kpiFocusNominal: 'Nominal: about {amount}',
      kpiFocusReal: 'In today’s money: about {amount}',
      kpiWin: 'In illustrative historical windows, {p}% ended with a positive real return (max 97%).',
      kpiGain: 'Real gain vs cash 0%',
      kpiGainSub: 'Both amounts in today’s money.',
      kpiGainEmpty: 'Turn on an asset other than cash to compare.',
      kpiNone: 'No asset selected',
      buildTitle: 'How {asset} gets to {amount}',
      buildPaid: 'You pay in',
      buildGrowth: 'Growth adds',
      buildDrop: 'Market drop',
      buildNominal: 'Nominal value',
      buildReal: 'In today’s money',
      buildInflation: 'Inflation takes',
      insightsTitle: 'What this shows',
      'insight.cash': 'On a 0% account, inflation turns {paid} into {cash} of today’s buying power.',
      'insight.cross': 'From year {y}, {asset} growth adds more each year than you pay in yourself. That is compounding at work.',
      'insight.noCross': 'Within {years}, growth stays smaller than your own yearly payments. Compounding needs time to take over.',
      'insight.delay': 'Starting {d} years later and stopping on the same date would leave about {gap} less in today’s money.',
      'insight.crash': 'The year-3 crash is back on its path by year 7, because the contributions never stopped.',
      tableTitle: 'Compare and choose what to draw',
      tableHint: 'Tick to draw a line. Tap a name to explain it above.',
      colAsset: 'Asset',
      colValue: 'In {years}',
      colVsCash: 'vs cash 0%',
      colSwing: 'Swings',
      showAsset: 'Show {asset} on the chart',
      focusAsset: 'Explain {asset} in the results',
      'swing.0': 'none in PLN',
      'swing.1': 'low',
      'swing.2': 'medium',
      'swing.3': 'medium-high',
      'swing.4': 'high',
      swingAria: 'Swings: {level}',
      'asset.etf': 'Global broad ETF',
      'asset.sp500': 'S&P 500',
      'asset.bonds': 'Treasury bonds',
      'asset.gold': 'Gold',
      'asset.cash': 'Cash 0%',
      'about.etf': 'Thousands of companies from developed markets (MSCI World type) in one fund. Educational base rate of {rate} a year after costs, the same assumption as the rest of the app.',
      'about.sp500': '500 large US companies. Illustrative long-term average of {rate} a year after costs. It swings more than a global ETF and, as a USD asset, adds currency risk for a PLN investor.',
      'about.bonds': 'Lending money to the state: smaller swings and lower growth potential. Illustrative long-term average of {rate} a year.',
      'about.gold': 'Has kept purchasing power over long periods, but pays no interest and can stall for years. Illustrative long-term average of {rate} a year.',
      'about.cash': 'Money on a 0% account. In today’s money it shrinks every year by inflation. This is your baseline.',
      yReal: 'today’s PLN',
      yNominal: 'PLN, nominal',
      year: 'Year {n}',
      paidTip: 'Paid in: {amount}',
      crisisMark: 'Crisis',
      crossMark: 'Growth > payments',
      chartAria: 'Line chart of the selected assets over {years}, {mode}.',
      empty: 'Tick at least one asset in the table to draw the chart.',
      noteAssume: 'Assumptions: global ETF {etf} a year after costs (before 19% tax), inflation {inf} a year. S&P 500 {sp}, bonds {bonds} and gold {gold} are illustrative long-term averages, not year-by-year history. Swings are an educational scale. Taxes, broker fees and currency moves are left out.',
      noteCrisis: 'Crisis scenario (educational): in year 3 stocks fall 20% and bonds 5%, then recover over years 4–6. Gold and cash are not shocked here. This is an illustration, not a forecast.',
      noteHistory: 'Historical data do not guarantee future results. Every asset here can also lose value.',
    },
    pl: {
      sub: 'Te same pieniądze, różne wybory. Przesuń suwak, a każda liczba poniżej sama się wytłumaczy.',
      headChip: '{amount}/mies. przez {years}',
      askPrompt: 'Nie wiesz, co oznacza któraś liczba?',
      askAtlas: 'Zapytaj Atlasa',
      monthly: 'Miesięczna wpłata',
      years: 'Horyzont',
      more: 'Więcej ustawień',
      changed: 'zmienione: {n}',
      initial: 'Wpłata początkowa',
      inflation: 'Inflacja rocznie',
      valuesIn: 'Pokaż wartości',
      real: 'W dzisiejszych zł',
      nominal: 'Nominalnie',
      crisis: 'Symuluj kryzys (-20% w 3. roku)',
      crisisHint: 'Akcje spadają o 20% w 3. roku i odrabiają straty w latach 4–6.',
      reset: 'Wróć do mojego planu',
      planNote: 'Twój przykładowy plan: {plan}/mies. przez {years}.',
      whatIfNote: 'Widok „co jeśli”. Twój przykładowy plan to {plan}/mies. przez {years}.',
      amountAria: '{label} w złotych',
      kpiPaid: 'Wpłacasz łącznie',
      kpiPaidSub: 'Twoje własne pieniądze, bez żadnego wzrostu.',
      kpiFocus: '{asset}: wynik za {years}',
      kpiFocusNominal: 'Nominalnie ok. {amount}',
      kpiFocusReal: 'W dzisiejszych zł ok. {amount}',
      kpiWin: 'W ilustracyjnych oknach historycznych {p}% kończyło się dodatnim wynikiem realnym (maks. 97%).',
      kpiGain: 'Zysk realny vs gotówka 0%',
      kpiGainSub: 'Obie kwoty w dzisiejszych złotych.',
      kpiGainEmpty: 'Włącz aktywo inne niż gotówka, aby porównać.',
      kpiNone: 'Nie wybrano aktywa',
      buildTitle: 'Skąd się bierze {amount}: {asset}',
      buildPaid: 'Wpłacasz',
      buildGrowth: 'Wzrost dokłada',
      buildDrop: 'Spadek rynku',
      buildNominal: 'Wartość nominalna',
      buildReal: 'W dzisiejszych zł',
      buildInflation: 'Inflacja zabiera',
      insightsTitle: 'Co to pokazuje',
      'insight.cash': 'Na koncie 0% inflacja zamienia {paid} w {cash} dzisiejszej siły nabywczej.',
      'insight.cross': 'Od {y}. roku wzrost ({asset}) dokłada co roku więcej, niż sam wpłacasz. Tak działa procent składany.',
      'insight.noCross': 'W horyzoncie {years} wzrost jest mniejszy niż Twoje roczne wpłaty. Procent składany potrzebuje czasu.',
      'insight.delay': 'Start {d} lat później i koniec w tym samym dniu dałby ok. {gap} mniej w dzisiejszych złotych.',
      'insight.crash': 'Po kryzysie w 3. roku linia wraca na swój tor do 7. roku, bo wpłaty ani na chwilę się nie zatrzymały.',
      tableTitle: 'Porównaj i wybierz, co narysować',
      tableHint: 'Zaznacz, by narysować linię. Kliknij nazwę, by wyjaśnić ją wyżej.',
      colAsset: 'Aktywo',
      colValue: 'Za {years}',
      colVsCash: 'vs gotówka 0%',
      colSwing: 'Wahania',
      showAsset: 'Pokaż {asset} na wykresie',
      focusAsset: 'Wyjaśnij {asset} w wynikach',
      'swing.0': 'brak w złotych',
      'swing.1': 'niskie',
      'swing.2': 'średnie',
      'swing.3': 'średnio-wysokie',
      'swing.4': 'wysokie',
      swingAria: 'Wahania: {level}',
      'asset.etf': 'Globalny szeroki ETF',
      'asset.sp500': 'S&P 500',
      'asset.bonds': 'Obligacje skarbowe',
      'asset.gold': 'Złoto',
      'asset.cash': 'Gotówka 0%',
      'about.etf': 'Tysiące spółek z rynków rozwiniętych (typu MSCI World) w jednym funduszu. Edukacyjna stopa bazowa {rate} rocznie po kosztach, to samo założenie co w całej aplikacji.',
      'about.sp500': '500 dużych spółek z USA. Ilustracyjna długoterminowa średnia {rate} rocznie po kosztach. Waha się mocniej niż globalny ETF, a jako aktywo w USD dokłada ryzyko walutowe dla inwestora w złotych.',
      'about.bonds': 'Pożyczasz pieniądze państwu: mniejsze wahania i niższy potencjał wzrostu. Ilustracyjna długoterminowa średnia {rate} rocznie.',
      'about.gold': 'W długich okresach chroniło siłę nabywczą, ale nie wypłaca odsetek i potrafi stać w miejscu latami. Ilustracyjna długoterminowa średnia {rate} rocznie.',
      'about.cash': 'Pieniądze na koncie 0%. W dzisiejszych złotych co roku kurczą się o inflację. To Twój punkt odniesienia.',
      yReal: 'dzisiejsze zł',
      yNominal: 'zł nominalnie',
      year: 'Rok {n}',
      paidTip: 'Wpłacono: {amount}',
      crisisMark: 'Kryzys',
      crossMark: 'Wzrost > wpłaty',
      chartAria: 'Wykres liniowy wybranych aktywów w horyzoncie {years}, {mode}.',
      empty: 'Zaznacz w tabeli co najmniej jedno aktywo, aby narysować wykres.',
      noteAssume: 'Założenia: globalny ETF {etf} rocznie po kosztach (przed podatkiem 19%), inflacja {inf} rocznie. S&P 500 {sp}, obligacje {bonds} i złoto {gold} to ilustracyjne długoterminowe średnie, a nie historia rok po roku. Skala wahań jest edukacyjna. Pomijamy podatki, opłaty brokera i wahania kursów walut.',
      noteCrisis: 'Scenariusz kryzysu (edukacyjny): w 3. roku akcje spadają o 20%, a obligacje o 5%, po czym odrabiają straty w latach 4–6. Złota i gotówki tu nie obciążamy. To ilustracja, nie prognoza.',
      noteHistory: 'Dane historyczne nie gwarantują przyszłych wyników. Każde z tych aktywów może też tracić na wartości.',
    },
  };

  // ------------------------------------------------------------------------
  // 3. Pure maths (no DOM)
  // ------------------------------------------------------------------------
  // Python's round() (half to even) so totals match backend/finance_math.py.
  function pyRound(x) {
    const f = Math.floor(x);
    if (Math.abs(x - f - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
    return Math.round(x);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Mirror of finance_math.historical_win_rate (linear interpolation, capped at 97%).
  function winRate(year) {
    const keys = Object.keys(WIN_RATE_KEYS).map(Number).sort((a, b) => a - b);
    let v = WIN_RATE_KEYS[keys[keys.length - 1]];
    if (year <= keys[0]) v = WIN_RATE_KEYS[keys[0]];
    else {
      for (let k = 0; k < keys.length - 1; k++) {
        const a = keys[k];
        const b = keys[k + 1];
        if (a <= year && year <= b) { v = WIN_RATE_KEYS[a] + (WIN_RATE_KEYS[b] - WIN_RATE_KEYS[a]) * (year - a) / (b - a); break; }
      }
    }
    return Math.min(WIN_RATE_CAP, pyRound(v));
  }

  // One point: money invested for `investedYears`, read in calendar year `year`
  // (inflation and the crisis follow the calendar, so a late start is compared fairly).
  function point(asset, p, investedYears, year, crisis) {
    const r = asset.id === 'etf' ? p.etfRate : asset.rate;
    const i = r / 12;
    const n = 12 * investedYears;
    if (n <= 0) return { year, paid: 0, nominal: 0, real: 0 };
    const paid = p.initial + p.monthly * n;
    let nominal = r === 0 ? p.monthly * n : p.monthly * ((Math.pow(1 + i, n) - 1) / i);
    if (p.initial > 0) nominal += r === 0 ? p.initial : p.initial * Math.pow(1 + i, n);
    const real = nominal / Math.pow(1 + p.inflation / 100, year);
    const m = crisis && asset.shock ? (asset.shock[year] || 1) : 1;
    return { year, paid, nominal: pyRound(nominal * m), real: pyRound(real * m) };
  }
  function series(asset, p, delay) {
    const d = delay || 0;
    const out = [];
    for (let year = 1; year <= p.years; year++) out.push(point(asset, p, year - d, year, p.crisis));
    return out;
  }
  function computeAll(p) {
    const res = {};
    ASSETS.forEach((a) => { res[a.id] = series(a, p); });
    return res;
  }
  // First year in which growth adds more than the year's own contributions (no crisis overlay).
  function crossoverYear(asset, p) {
    let prev = 0;
    for (let year = 1; year <= p.years; year++) {
      const nom = point(asset, p, year, year, false).nominal;
      const added = 12 * p.monthly + (year === 1 ? p.initial : 0);
      if (nom - prev - added > 12 * p.monthly) return year;
      prev = nom;
    }
    return null;
  }

  // ------------------------------------------------------------------------
  // 4. Module state
  // ------------------------------------------------------------------------
  let H = null;        // helpers from app.js (money, years, lang, ...)
  let root = null;     // #sim-root
  let notesEl = null;  // #sim-notes
  let sessionId = null;
  let builtLang = null;
  let plan = null;     // { monthly, years, inflation, etfRate }
  let st = null;       // current settings
  let chart = null;
  let lastKpi = null;
  let view = null;     // derived numbers of the last render (for the chart plugin)
  const el = {};

  function lang() { return H && H.lang() === 'pl' ? 'pl' : 'en'; }
  function tr(key, vars) {
    let s = (COPY[lang()] && COPY[lang()][key]) || COPY.en[key] || key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function esc(v) { return H.escapeHtml(v); }
  function pct(v) {
    const d = Math.round(v * 10) / 10;
    const s = Number.isInteger(d) ? d.toFixed(1) : String(d);
    return (lang() === 'pl' ? s.replace('.', ',') : s) + '%';
  }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + H.money(Math.abs(v)); }
  function assetName(id) { return tr('asset.' + id); }
  function assetById(id) { return ASSETS.find((a) => a.id === id); }
  function rateOf(id) { return id === 'etf' ? st.etfRate : assetById(id).rate; }

  function defaults() {
    return {
      monthly: plan.monthly, initial: 0, years: plan.years, inflation: plan.inflation,
      etfRate: plan.etfRate, real: true, crisis: false,
      enabled: new Set(['etf', 'cash']), focus: 'etf',
    };
  }
  function focusId() {
    if (st.enabled.has(st.focus) && st.focus !== 'cash') return st.focus;
    return FOCUS_ORDER.find((id) => st.enabled.has(id)) || null;
  }
  function advancedChanged() {
    let n = 0;
    if (st.initial !== 0) n++;
    if (Math.abs(st.inflation - plan.inflation) > 1e-9) n++;
    if (!st.real) n++;
    if (st.crisis) n++;
    return n;
  }
  function isPlan() {
    return st.monthly === plan.monthly && st.years === plan.years && advancedChanged() === 0 &&
      st.enabled.size === 2 && st.enabled.has('etf') && st.enabled.has('cash') && focusId() === 'etf';
  }

  // ------------------------------------------------------------------------
  // 5. DOM (built once per language; later updates change values in place
  //    so sliders keep focus while dragging)
  // ------------------------------------------------------------------------
  function nearestIndex(gridArr, v) {
    let best = 0;
    for (let k = 1; k < gridArr.length; k++) if (Math.abs(gridArr[k] - v) < Math.abs(gridArr[best] - v)) best = k;
    return best;
  }
  function withPlan(gridArr, v) {
    if (gridArr.indexOf(v) >= 0) return gridArr;
    return gridArr.concat([v]).sort((a, b) => a - b);
  }

  function amountField(id, labelKey, gridArr, value) {
    const label = tr(labelKey);
    return (
      '<div class="sim-field">' +
        '<div class="sim-field__top">' +
          '<label class="sim-field__label" for="' + id + '-range">' + esc(label) + '</label>' +
          '<span class="sim-amount">' +
            '<input class="sim-amount__input" id="' + id + '-num" type="number" inputmode="numeric" min="' + gridArr[0] + '" max="' + gridArr[gridArr.length - 1] + '" step="1" value="' + value + '" aria-label="' + esc(tr('amountAria', { label })) + '">' +
            '<span class="sim-amount__unit" aria-hidden="true">' + esc(H.currency()) + '</span>' +
          '</span>' +
        '</div>' +
        '<input class="range" id="' + id + '-range" type="range" min="0" max="' + (gridArr.length - 1) + '" step="1" value="' + nearestIndex(gridArr, value) + '">' +
        '<div class="sim-scale" aria-hidden="true"><span>' + esc(H.money(gridArr[0])) + '</span><span>' + esc(H.money(gridArr[gridArr.length - 1])) + '</span></div>' +
      '</div>'
    );
  }

  function assetRow(a) {
    const name = assetName(a.id);
    const focusable = a.id !== 'cash';
    const meter = [1, 2, 3, 4].map((k) => '<i' + (k <= a.swing ? ' class="on"' : '') + '></i>').join('');
    return (
      '<li class="sim-row" data-asset="' + a.id + '" style="--asset:' + a.color + '">' +
        '<button type="button" class="sim-row__tick" data-sim-toggle="' + a.id + '" aria-pressed="false" aria-label="' + esc(tr('showAsset', { asset: name })) + '">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        (focusable
          ? '<button type="button" class="sim-row__name" data-sim-focus="' + a.id + '" aria-pressed="false" aria-label="' + esc(tr('focusAsset', { asset: name })) + '">'
          : '<span class="sim-row__name">') +
          '<i class="sim-swatch sim-swatch--' + a.id + '"></i><span>' + esc(name) + '</span>' +
        (focusable ? '</button>' : '</span>') +
        '<span class="sim-row__value" data-col="value"></span>' +
        '<span class="sim-row__vs" data-col="vs"></span>' +
        '<span class="sim-row__swing" role="img" aria-label="' + esc(tr('swingAria', { level: tr('swing.' + a.swing) })) + '">' +
          '<span class="sim-meter" aria-hidden="true">' + meter + '</span>' +
          '<span class="sim-row__swingtext">' + esc(tr('swing.' + a.swing)) + '</span>' +
        '</span>' +
      '</li>'
    );
  }

  function build() {
    builtLang = lang();

    root.innerHTML =
      // The tool panel above already says "What-if simulator", so the card opens on what it does.
      '<div class="sim-head">' +
        '<p class="sim-sub">' + esc(tr('sub')) + '</p>' +
        '<span class="chip chip--soft" id="sim-head-chip"></span>' +
      '</div>' +
      (H.askAtlas
        ? '<p class="sim-ask">' + esc(tr('askPrompt')) + ' <button type="button" class="sim-ask__link" data-sim-ask>' + esc(tr('askAtlas')) + '</button></p>'
        : '') +

      '<div class="sim-controls">' +
        amountField('sim-monthly', 'monthly', el.monthlyGrid, st.monthly) +
        '<div class="sim-field">' +
          '<div class="sim-field__top">' +
            '<label class="sim-field__label" for="sim-years">' + esc(tr('years')) + '</label>' +
            '<output class="sim-field__value" id="sim-years-out" for="sim-years"></output>' +
          '</div>' +
          '<input class="range" id="sim-years" type="range" min="' + LIMITS.years[0] + '" max="' + LIMITS.years[1] + '" step="1" value="' + st.years + '">' +
          '<div class="sim-scale" aria-hidden="true"><span>' + esc(H.years(LIMITS.years[0])) + '</span><span>' + esc(H.years(LIMITS.years[1])) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<details class="sim-more" id="sim-more"' + (el.moreOpen ? ' open' : '') + '>' +
        '<summary class="sim-more__summary"><span>' + esc(tr('more')) + '</span><span class="sim-more__count" id="sim-more-count"></span></summary>' +
        '<div class="sim-more__body">' +
          amountField('sim-initial', 'initial', INITIAL_GRID, st.initial) +
          '<div class="sim-field">' +
            '<div class="sim-field__top">' +
              '<label class="sim-field__label" for="sim-inflation">' + esc(tr('inflation')) + '</label>' +
              '<output class="sim-field__value" id="sim-inflation-out" for="sim-inflation"></output>' +
            '</div>' +
            '<input class="range" id="sim-inflation" type="range" min="' + LIMITS.inflation[0] + '" max="' + LIMITS.inflation[1] + '" step="0.1" value="' + st.inflation + '">' +
            '<div class="sim-scale" aria-hidden="true"><span>' + esc(pct(LIMITS.inflation[0])) + '</span><span>' + esc(pct(LIMITS.inflation[1])) + '</span></div>' +
          '</div>' +
          '<div class="sim-field sim-field--row">' +
            '<span class="sim-field__label" id="sim-mode-label">' + esc(tr('valuesIn')) + '</span>' +
            '<div class="seg" role="group" aria-labelledby="sim-mode-label">' +
              '<button type="button" data-sim-mode="real" aria-pressed="true">' + esc(tr('real')) + '</button>' +
              '<button type="button" data-sim-mode="nominal" aria-pressed="false">' + esc(tr('nominal')) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="sim-field sim-field--row">' +
            '<span class="sim-switch__text"><span class="sim-field__label" id="sim-crisis-label">' + esc(tr('crisis')) + '</span><span class="sim-hint">' + esc(tr('crisisHint')) + '</span></span>' +
            '<button type="button" class="sim-switch" id="sim-crisis" role="switch" aria-checked="false" aria-labelledby="sim-crisis-label"><span class="sim-switch__knob"></span></button>' +
          '</div>' +
        '</div>' +
      '</details>' +

      '<div class="sim-planbar">' +
        '<p class="sim-planbar__note" id="sim-plan-note" aria-live="polite"></p>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-sim-reset id="sim-reset">' + esc(tr('reset')) + '</button>' +
      '</div>' +

      '<div class="sim-results">' +
        '<div class="sim-kpis">' +
          '<div class="sim-kpi sim-kpi--paid"><p class="sim-kpi__label">' + esc(tr('kpiPaid')) + '</p><p class="sim-kpi__value" id="sim-kpi-paid">0</p><p class="sim-kpi__sub">' + esc(tr('kpiPaidSub')) + '</p></div>' +
          '<div class="sim-kpi sim-kpi--focus" id="sim-kpi-focus-box"><p class="sim-kpi__label" id="sim-kpi-focus-label"></p><p class="sim-kpi__value" id="sim-kpi-focus">0</p><p class="sim-kpi__sub" id="sim-kpi-focus-sub"></p><p class="sim-kpi__sub" id="sim-kpi-win"></p></div>' +
          '<div class="sim-kpi sim-kpi--gain"><p class="sim-kpi__label">' + esc(tr('kpiGain')) + '</p><p class="sim-kpi__value" id="sim-kpi-gain">0</p><p class="sim-kpi__sub" id="sim-kpi-gain-sub"></p></div>' +
        '</div>' +

        // The one memorable element: how the end value is built.
        '<figure class="sim-build" id="sim-build">' +
          '<figcaption class="sim-h" id="sim-build-title"></figcaption>' +
          '<div class="sim-build__row">' +
            '<span class="sim-build__label">' + esc(tr('buildNominal')) + '</span>' +
            '<div class="sim-build__bar" id="sim-build-top"><span class="seg-paid"></span><span class="seg-growth"></span></div>' +
          '</div>' +
          '<div class="sim-build__row">' +
            '<span class="sim-build__label">' + esc(tr('buildReal')) + '</span>' +
            '<div class="sim-build__bar" id="sim-build-bottom"><span class="seg-real"></span><span class="seg-infl"></span></div>' +
          '</div>' +
          '<ul class="sim-build__legend" id="sim-build-legend"></ul>' +
        '</figure>' +

        '<section class="sim-insights" aria-labelledby="sim-insights-title">' +
          '<h4 class="sim-h" id="sim-insights-title">' + esc(tr('insightsTitle')) + '</h4>' +
          '<ul class="sim-insights__list" id="sim-insights" aria-live="polite"></ul>' +
        '</section>' +
      '</div>' +

      '<div class="sim-chart">' +
        '<canvas id="sim-chart" role="img"></canvas>' +
        '<p class="sim-chart__empty" id="sim-chart-empty" hidden>' + esc(tr('empty')) + '</p>' +
      '</div>' +

      '<section class="sim-table" aria-labelledby="sim-table-title">' +
        '<h4 class="sim-h" id="sim-table-title">' + esc(tr('tableTitle')) + '</h4>' +
        '<p class="sim-hint">' + esc(tr('tableHint')) + '</p>' +
        '<div class="sim-table__head" aria-hidden="true"><span></span><span>' + esc(tr('colAsset')) + '</span><span id="sim-col-value"></span><span>' + esc(tr('colVsCash')) + '</span><span>' + esc(tr('colSwing')) + '</span></div>' +
        '<ul class="sim-table__rows">' + ASSETS.map(assetRow).join('') + '</ul>' +
        '<p class="sim-about" id="sim-about" aria-live="polite"></p>' +
      '</section>';

    if (notesEl) notesEl.innerHTML = '<p id="sim-note-assume"></p><p id="sim-note-crisis" hidden></p><p>' + esc(tr('noteHistory')) + '</p>';

    ['head-chip', 'monthly-num', 'monthly-range', 'years', 'years-out', 'more', 'more-count', 'initial-num', 'initial-range',
      'inflation', 'inflation-out', 'crisis', 'plan-note', 'reset', 'kpi-paid', 'kpi-focus-box', 'kpi-focus-label',
      'kpi-focus', 'kpi-focus-sub', 'kpi-win', 'kpi-gain', 'kpi-gain-sub', 'build', 'build-title', 'build-top', 'build-bottom', 'build-legend',
      'insights', 'chart', 'chart-empty', 'col-value', 'about', 'note-assume', 'note-crisis']
      .forEach((k) => { el[k] = document.getElementById('sim-' + k); });

    if (chart) { chart.destroy(); chart = null; }
    lastKpi = null;
  }

  // ------------------------------------------------------------------------
  // 6. Render (values only)
  // ------------------------------------------------------------------------
  function fill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const p = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fill', clamp(p, 0, 100) + '%');
  }
  // Plain text that also stops a count-up still running on the node (app.js animateNumber).
  function setText(node, text) {
    if (node._fqRaf) { cancelAnimationFrame(node._fqRaf); node._fqRaf = null; }
    clearTimeout(node._fqTimer);
    node.textContent = text;
  }

  function syncControls(skip) {
    if (skip !== 'monthly-num') el['monthly-num'].value = String(st.monthly);
    if (skip !== 'monthly-range') el['monthly-range'].value = String(nearestIndex(el.monthlyGrid, st.monthly));
    if (skip !== 'initial-num') el['initial-num'].value = String(st.initial);
    if (skip !== 'initial-range') el['initial-range'].value = String(nearestIndex(INITIAL_GRID, st.initial));
    el.years.value = String(st.years);
    el.inflation.value = String(st.inflation);
    [el['monthly-range'], el['initial-range'], el.years, el.inflation].forEach(fill);
    el['years-out'].textContent = H.years(st.years);
    el['inflation-out'].textContent = pct(st.inflation);
    root.querySelectorAll('[data-sim-mode]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.simMode === 'real') === st.real)));
    el.crisis.setAttribute('aria-checked', String(st.crisis));
    const n = advancedChanged();
    el['more-count'].textContent = n ? tr('changed', { n }) : '';
    const planned = isPlan();
    el.reset.disabled = planned;
    el['plan-note'].textContent = tr(planned ? 'planNote' : 'whatIfNote', { plan: H.money(plan.monthly), years: H.years(plan.years) });
    el['head-chip'].textContent = tr('headChip', { amount: H.money(st.monthly), years: H.years(st.years) });
    el['note-assume'].textContent = tr('noteAssume', {
      etf: pct(st.etfRate * 100), inf: pct(st.inflation), sp: pct(assetById('sp500').rate * 100),
      bonds: pct(assetById('bonds').rate * 100), gold: pct(assetById('gold').rate * 100),
    });
    el['note-crisis'].hidden = !st.crisis;
    el['note-crisis'].textContent = tr('noteCrisis');
  }

  // Everything derived from the current settings, computed once per render.
  function derive() {
    const all = computeAll(st);
    const y = st.years;
    const f = focusId();
    const fa = f ? assetById(f) : null;
    const cash = all.cash[y - 1];
    const fp = f ? all[f][y - 1] : null;
    const cross = fa ? crossoverYear(fa, st) : null;
    const canDelay = !!fa && y > DELAY_YEARS + 2;
    const delayed = canDelay ? series(fa, st, DELAY_YEARS) : null;
    const gap = canDelay ? fp.real - delayed[y - 1].real : 0;
    return { all, y, f, fa, cash, fp, cross, canDelay, delayed, gap };
  }

  function renderKpis(v, animate) {
    const k = {
      paid: v.cash.paid,
      focus: v.fp ? (st.real ? v.fp.real : v.fp.nominal) : v.cash[st.real ? 'real' : 'nominal'],
      gain: v.fp ? v.fp.real - v.cash.real : 0,
    };
    const put = (node, key, fmt) => {
      if (animate && lastKpi && H.animateNumber) H.animateNumber(node, lastKpi[key], k[key], { duration: 420, format: fmt });
      else setText(node, fmt(k[key]));
    };
    put(el['kpi-paid'], 'paid', H.money);

    const shownId = v.f || 'cash';
    const hasFocus = !!v.f || st.enabled.has('cash');
    el['kpi-focus-box'].style.setProperty('--asset', hasFocus ? assetById(shownId).color : 'var(--rule)');
    el['kpi-focus-label'].textContent = hasFocus ? tr('kpiFocus', { asset: assetName(shownId), years: H.years(v.y) }) : tr('kpiNone');
    const other = v.fp || v.cash;
    if (hasFocus) {
      put(el['kpi-focus'], 'focus', H.money);
      el['kpi-focus-sub'].textContent = st.real ? tr('kpiFocusNominal', { amount: H.money(other.nominal) }) : tr('kpiFocusReal', { amount: H.money(other.real) });
    } else {
      setText(el['kpi-focus'], '—');
      el['kpi-focus-sub'].textContent = tr('empty');
    }
    el['kpi-win'].hidden = v.f !== 'etf';
    el['kpi-win'].textContent = v.f === 'etf' ? tr('kpiWin', { p: winRate(v.y) }) : '';

    if (v.fp) {
      put(el['kpi-gain'], 'gain', signed);
      el['kpi-gain'].dataset.sign = k.gain >= 0 ? 'up' : 'down';
      el['kpi-gain-sub'].textContent = tr('kpiGainSub');
    } else {
      setText(el['kpi-gain'], '—');
      el['kpi-gain'].dataset.sign = '';
      el['kpi-gain-sub'].textContent = tr('kpiGainEmpty');
    }
    lastKpi = k;
  }

  // Two bars on one scale: nominal = paid + growth; today's money = nominal − inflation.
  function renderBuild(v) {
    const id = v.f || (st.enabled.has('cash') ? 'cash' : null);
    el.build.hidden = !id;
    if (!id) return;
    const p = id === 'cash' ? v.cash : v.fp;
    const growth = p.nominal - p.paid;
    const infl = p.nominal - p.real;
    const scale = Math.max(p.paid, p.nominal, 1);
    const w = (x) => clamp((x / scale) * 100, 0, 100).toFixed(2) + '%';
    el.build.style.setProperty('--asset', assetById(id).color);
    el['build-title'].textContent = tr('buildTitle', { asset: assetName(id), amount: H.money(st.real ? p.real : p.nominal) });
    const top = el['build-top'].children;
    top[0].style.width = w(Math.min(p.paid, p.nominal));
    top[1].style.width = w(Math.abs(growth));
    top[1].classList.toggle('is-drop', growth < 0);
    const bottom = el['build-bottom'].children;
    bottom[0].style.width = w(p.real);
    bottom[1].style.width = w(infl);
    const item = (cls, label, amount) => '<li><i class="' + cls + '"></i><span>' + esc(label) + '</span><strong>' + esc(amount) + '</strong></li>';
    el['build-legend'].innerHTML =
      item('seg-paid', tr('buildPaid'), H.money(p.paid)) +
      (growth < 0 ? item('seg-growth is-drop', tr('buildDrop'), signed(growth)) : item('seg-growth', tr('buildGrowth'), signed(growth))) +
      item('seg-infl', tr('buildInflation'), '−' + H.money(infl)) +
      item('seg-real', tr('buildReal'), H.money(p.real));
  }

  function renderInsights(v) {
    const items = [tr('insight.cash', { paid: H.money(v.cash.paid), cash: H.money(v.cash.real) })];
    if (v.fa) {
      items.push(v.cross ? tr('insight.cross', { y: v.cross, asset: assetName(v.f) }) : tr('insight.noCross', { years: H.years(v.y) }));
      if (v.canDelay) items.push(tr('insight.delay', { d: DELAY_YEARS, gap: H.money(v.gap) }));
      if (st.crisis && v.fa.shock && v.y >= 7) items.push(tr('insight.crash'));
    }
    el.insights.innerHTML = items.map((s) => '<li>' + esc(s) + '</li>').join('');
  }

  function renderTable(v) {
    const key = st.real ? 'real' : 'nominal';
    el['col-value'].textContent = tr('colValue', { years: H.years(v.y) });
    root.querySelectorAll('.sim-row').forEach((li) => {
      const id = li.dataset.asset;
      const on = st.enabled.has(id);
      const p = v.all[id][v.y - 1];
      li.classList.toggle('is-on', on);
      li.classList.toggle('is-focus', id === v.f);
      li.querySelector('[data-sim-toggle]').setAttribute('aria-pressed', String(on));
      const fb = li.querySelector('[data-sim-focus]');
      if (fb) fb.setAttribute('aria-pressed', String(id === v.f));
      li.querySelector('[data-col="value"]').textContent = H.money(p[key]);
      const vs = li.querySelector('[data-col="vs"]');
      const d = p.real - v.cash.real;
      vs.textContent = id === 'cash' ? '—' : signed(d);
      vs.dataset.sign = id === 'cash' ? '' : (d >= 0 ? 'up' : 'down');
    });
    const aboutId = v.f || (st.enabled.has('cash') ? 'cash' : 'etf');
    el.about.textContent = tr('about.' + aboutId, { rate: pct(rateOf(aboutId) * 100) });
  }

  // Chart overlays: a shaded crisis year and a dot where growth overtakes payments.
  const overlays = {
    id: 'simOverlays',
    beforeDatasetsDraw(c) {
      if (!st || !st.crisis || st.years < 3) return;
      const x = c.scales.x;
      const area = c.chartArea;
      if (!x || !area) return;
      const x3 = x.getPixelForValue(3);
      const half = Math.max(8, (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2);
      const ctx = c.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(249, 115, 22, 0.10)';
      ctx.fillRect(x3 - half, area.top, half * 2, area.bottom - area.top);
      ctx.fillStyle = '#9A3412';
      ctx.font = '700 11px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.fillText(tr('crisisMark'), x3, area.top + 12);
      ctx.restore();
    },
    afterDatasetsDraw(c) {
      if (!view || !view.cross || !view.f) return;
      const idx = c.data.datasets.findIndex((d) => d.simId === view.f);
      if (idx < 0 || !c.isDatasetVisible(idx)) return;
      const pt = c.getDatasetMeta(idx).data[view.cross];
      if (!pt) return;
      const ctx = c.ctx;
      const color = assetById(view.f).color;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.font = '700 11px ' + getComputedStyle(document.body).fontFamily;
      const label = tr('crossMark');
      const tw = ctx.measureText(label).width;
      const right = pt.x + 10 + tw < c.chartArea.right;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillStyle = '#1C3745';
      ctx.fillText(label, right ? pt.x + 9 : pt.x - 9, pt.y - 8);
      ctx.restore();
    },
  };

  function renderChart(v) {
    const empty = st.enabled.size === 0;
    el['chart-empty'].hidden = !empty;
    el.chart.setAttribute('aria-label', tr('chartAria', { years: H.years(st.years), mode: st.real ? tr('real') : tr('nominal') }));
    if (!window.Chart) return;
    const key = st.real ? 'real' : 'nominal';
    const labels = [tr('year', { n: 0 })];
    for (let y = 1; y <= st.years; y++) labels.push(tr('year', { n: y }));
    const paid = [st.initial].concat(v.all.cash.map((p) => p.paid));
    const datasets = ASSETS.filter((a) => st.enabled.has(a.id)).map((a) => {
      const isFocus = a.id === v.f;
      return {
        simId: a.id,
        label: assetName(a.id),
        data: [st.initial].concat(v.all[a.id].map((p) => p[key])),
        borderColor: a.color,
        borderDash: a.dash,
        borderWidth: isFocus ? 3 : 1.75,
        backgroundColor: isFocus ? areaFill(a.color) : 'transparent',
        fill: isFocus ? 'origin' : false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#FFFFFF',
        pointHoverBorderColor: a.color,
        pointHoverBorderWidth: 2,
        order: isFocus ? 0 : 1,
      };
    });
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = datasets;
      chart.$simPaid = paid;
      chart.options.scales.y.title.text = st.real ? tr('yReal') : tr('yNominal');
      chart.options.animation = { duration: reduced ? 0 : 300 };
      chart.update();
      return;
    }
    chart = new window.Chart(el.chart, {
      type: 'line',
      data: { labels, datasets },
      plugins: [overlays],
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: reduced ? 0 : 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1C3745', padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
            titleFont: { weight: '700' }, bodyFont: { weight: '500' }, footerFont: { weight: '600' },
            itemSort: (a, b) => b.parsed.y - a.parsed.y,
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + H.money(ctx.parsed.y),
              labelColor: (ctx) => ({ borderColor: ctx.dataset.borderColor, backgroundColor: ctx.dataset.borderColor }),
              footer: (items) => {
                const i = items.length ? items[0].dataIndex : 0;
                const p = (chart && chart.$simPaid) || [];
                return p[i] != null ? tr('paidTip', { amount: H.money(p[i]) }) : '';
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#D4DDE0', width: 1 }, ticks: { autoSkip: true, maxTicksLimit: 7, maxRotation: 0 } },
          y: {
            beginAtZero: true, grid: { color: 'rgba(28,55,69,0.06)' }, border: { display: false },
            title: { display: true, text: st.real ? tr('yReal') : tr('yNominal'), font: { size: 11, weight: '600' } },
            ticks: { callback: (val) => H.compactMoney(val), maxTicksLimit: 6 },
          },
        },
      },
    });
    chart.$simPaid = paid;
  }
  function areaFill(color) {
    return (ctx) => {
      const area = ctx.chart.chartArea;
      const rgb = hexRgb(color);
      if (!area) return 'rgba(' + rgb + ',0.10)';
      const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, 'rgba(' + rgb + ',0.16)');
      g.addColorStop(1, 'rgba(' + rgb + ',0.01)');
      return g;
    };
  }
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }

  function render(opts) {
    const o = opts || {};
    if (!root || !st) return;
    if (lang() !== builtLang) build();
    syncControls(o.skip);
    view = derive();
    renderKpis(view, o.animate !== false);
    renderBuild(view);
    renderInsights(view);
    renderChart(view);
    renderTable(view);
    if (H.onChange) H.onChange({ monthly: st.monthly, years: st.years, isPlanMonthly: st.monthly === plan.monthly });
  }

  // ------------------------------------------------------------------------
  // 7. Events (delegated on #sim-root, so rebuilding the DOM never leaks listeners).
  // ------------------------------------------------------------------------
  function onInput(e) {
    const id = e.target && e.target.id;
    if (!id || id.indexOf('sim-') !== 0) return;
    const v = Number(e.target.value);
    if (id === 'sim-monthly-range') { st.monthly = el.monthlyGrid[clamp(Math.round(v), 0, el.monthlyGrid.length - 1)]; }
    else if (id === 'sim-initial-range') { st.initial = INITIAL_GRID[clamp(Math.round(v), 0, INITIAL_GRID.length - 1)]; }
    else if (id === 'sim-years') { st.years = clamp(Math.round(v), LIMITS.years[0], LIMITS.years[1]); }
    else if (id === 'sim-inflation') { st.inflation = clamp(Math.round(v * 10) / 10, LIMITS.inflation[0], LIMITS.inflation[1]); }
    else if (id === 'sim-monthly-num' || id === 'sim-initial-num') {
      // Typing: apply only values already inside the range; the field is clamped on commit.
      const lim = id === 'sim-monthly-num' ? LIMITS.monthly : LIMITS.initial;
      if (e.target.value === '' || !Number.isFinite(v) || v < lim[0] || v > lim[1]) return;
      if (id === 'sim-monthly-num') st.monthly = Math.round(v); else st.initial = Math.round(v);
    } else return;
    render({ skip: id });
  }
  function onChange(e) {
    const id = e.target && e.target.id;
    if (id !== 'sim-monthly-num' && id !== 'sim-initial-num') return;
    const lim = id === 'sim-monthly-num' ? LIMITS.monthly : LIMITS.initial;
    const raw = Number(e.target.value);
    const v = Number.isFinite(raw) && e.target.value !== '' ? clamp(Math.round(raw), lim[0], lim[1]) : (id === 'sim-monthly-num' ? plan.monthly : 0);
    if (id === 'sim-monthly-num') st.monthly = v; else st.initial = v;
    render();
  }
  function onClick(e) {
    const t = e.target.closest ? e.target.closest('[data-sim-ask],[data-sim-toggle],[data-sim-focus],[data-sim-mode],[data-sim-reset],#sim-crisis') : null;
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-sim-ask')) { if (H.askAtlas) H.askAtlas(); return; }
    if (t.dataset.simToggle) {
      const id = t.dataset.simToggle;
      if (st.enabled.has(id)) st.enabled.delete(id); else st.enabled.add(id);
    } else if (t.dataset.simFocus) {
      st.enabled.add(t.dataset.simFocus);
      st.focus = t.dataset.simFocus;
    } else if (t.dataset.simMode) {
      st.real = t.dataset.simMode === 'real';
    } else if (t.id === 'sim-crisis') {
      st.crisis = !st.crisis;
    } else if (t.hasAttribute('data-sim-reset')) {
      st = defaults();
      el.moreOpen = false;
      if (el.more) el.more.open = false;
    }
    render();
  }
  function onToggle(e) { if (e.target === el.more) el.moreOpen = el.more.open; }

  // ------------------------------------------------------------------------
  // 8. Public API
  // ------------------------------------------------------------------------
  // helpers: { lang(), money(n), years(n), compactMoney(n), currency(), escapeHtml(s),
  //            animateNumber(el, from, to, opts), askAtlas(), onChange(state) }
  function mount(opts) {
    const o = opts || {};
    const session = o.session;
    if (!o.root || !session) return false;
    H = o.helpers;
    const a = session.assumptions || {};
    const nextPlan = {
      monthly: clamp(Number(session.safe_investment && session.safe_investment.recommended_monthly) || 100, LIMITS.monthly[0], LIMITS.monthly[1]),
      years: clamp(Number(session.default_horizon_years) || 10, LIMITS.years[0], LIMITS.years[1]),
      inflation: clamp(Number(a.inflation_pct) || INFLATION_DEFAULT, LIMITS.inflation[0], LIMITS.inflation[1]),
      etfRate: (Number(a.etf_net_nominal_pct) || ETF_DEFAULT_RATE * 100) / 100,
    };
    // A language switch re-fetches the session with the same plan: keep the what-if settings then.
    const samePlan = plan && plan.monthly === nextPlan.monthly && plan.years === nextPlan.years;
    const newSession = !st || (session.session_id !== sessionId && !samePlan);
    sessionId = session.session_id;
    const rootChanged = o.root !== root;
    if (rootChanged) {
      if (root) { root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); root.removeEventListener('click', onClick); root.removeEventListener('toggle', onToggle, true); }
      root = o.root;
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);
      root.addEventListener('click', onClick);
      root.addEventListener('toggle', onToggle, true);
    }
    notesEl = o.notes || null;
    plan = nextPlan;
    el.monthlyGrid = withPlan(MONTHLY_GRID, plan.monthly);
    if (newSession) {
      st = defaults();
      el.moreOpen = false;
    } else {
      st.etfRate = plan.etfRate;   // new language = same session, same numbers
    }
    if (newSession || rootChanged || lang() !== builtLang) build();
    render({ animate: false });
    return true;
  }
  // app.js calls this whenever the panel is shown again; the canvas may have been hidden.
  function refresh(opts) {
    if (!root || !st) return;
    render({ animate: !opts || opts.animate !== false });
    if (chart) chart.resize();
  }
  function isMounted() { return !!(root && st); }
  function resize() { if (chart) chart.resize(); }

  window.InvestlySim = Object.freeze({
    mount, refresh, isMounted, resize,
    // Exposed for checks in the console (e.g. against session.projection_series).
    compute: (p) => computeAll(Object.assign({ monthly: 100, initial: 0, years: 20, inflation: INFLATION_DEFAULT, etfRate: ETF_DEFAULT_RATE, crisis: false }, p || {})),
    winRate,
  });
})();
