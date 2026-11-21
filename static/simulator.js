/* ==========================================================================
   Investly — static/simulator.js  (Issue #61: rich "What-If" simulator)
   A self-contained module for #card-timemachine, loaded before app.js.
   app.js only calls window.InvestlySim.mount(...) and .refresh(...).

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
  // shock: value multipliers in years 3–6 when the crisis switch is on.
  // Equities use the backend's own STRESS_MULTIPLIER; bonds dip 5%; gold and cash are not shocked.
  const EQUITY_SHOCK = { 3: 0.80, 4: 0.85, 5: 0.90, 6: 0.95 };
  const BOND_SHOCK = { 3: 0.95, 4: 0.9625, 5: 0.975, 6: 0.9875 };
  const ASSETS = [
    { id: 'etf', rate: null, color: '#10B981', dash: [], shock: EQUITY_SHOCK },
    { id: 'sp500', rate: 0.065, color: '#0369A1', dash: [], shock: EQUITY_SHOCK },
    { id: 'bonds', rate: 0.040, color: '#49606C', dash: [10, 4], shock: BOND_SHOCK },
    { id: 'gold', rate: 0.045, color: '#B98C24', dash: [], shock: null },
    { id: 'cash', rate: 0, color: '#EF4444', dash: [7, 5], shock: null },
  ];
  const FOCUS_ORDER = ['etf', 'sp500', 'bonds', 'gold'];
  const ETF_DEFAULT_RATE = 0.057;     // docs/02 §3A fallback when the server sends no assumptions
  const INFLATION_DEFAULT = 3.5;
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
      sub: 'See where the same contributions could go. Change any number and the chart follows.',
      headChip: '{amount}/mo for {years}',
      compare: 'Compare',
      compareHint: 'Tick to draw a line. Tap a name to show it in the results.',
      showAsset: 'Show {asset} on the chart',
      focusAsset: 'Show {asset} in the results',
      inResults: 'in results',
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
      kpiPaidSub: 'On a 0% account that is worth {cash} in today’s money.',
      kpiFocus: '{asset} in {years}',
      kpiFocusNominal: 'Nominal: about {amount}',
      kpiFocusReal: 'In today’s money: about {amount}',
      kpiWin: 'In illustrative historical windows, {p}% ended with a positive real return (max 97%).',
      kpiGain: 'Real gain vs cash 0%',
      kpiGainSub: 'Both amounts in today’s money.',
      kpiGainEmpty: 'Turn on an asset other than cash to compare.',
      kpiNone: 'No asset selected',
      yReal: 'today’s PLN',
      yNominal: 'PLN, nominal',
      year: 'Year {n}',
      paidTip: 'Paid in: {amount}',
      crisisMark: 'Crisis',
      chartAria: 'Line chart of the selected assets over {years}, {mode}.',
      empty: 'Tick at least one asset to draw the chart.',
      noteAssume: 'Assumptions: global ETF {etf} a year after costs (before 19% tax), inflation {inf} a year. S&P 500 {sp}, bonds {bonds} and gold {gold} are illustrative long-term averages, not year-by-year history. Taxes, broker fees and currency moves are left out.',
      noteCrisis: 'Crisis scenario (educational): in year 3 stocks fall 20% and bonds 5%, then recover over years 4–6. Gold and cash are not shocked here. This is an illustration, not a forecast.',
      noteHistory: 'Historical data do not guarantee future results. Every asset here can also lose value.',
    },
    pl: {
      sub: 'Zobacz, dokąd mogą trafić te same wpłaty. Zmień dowolną liczbę, a wykres pójdzie za nią.',
      headChip: '{amount}/mies. przez {years}',
      compare: 'Porównaj',
      compareHint: 'Zaznacz, by narysować linię. Kliknij nazwę, by pokazać ją w wynikach.',
      showAsset: 'Pokaż {asset} na wykresie',
      focusAsset: 'Pokaż {asset} w wynikach',
      inResults: 'w wynikach',
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
      kpiPaidSub: 'Na koncie 0% to {cash} w dzisiejszych złotych.',
      kpiFocus: '{asset}: wynik za {years}',
      kpiFocusNominal: 'Nominalnie ok. {amount}',
      kpiFocusReal: 'W dzisiejszych zł ok. {amount}',
      kpiWin: 'W ilustracyjnych oknach historycznych {p}% kończyło się dodatnim wynikiem realnym (maks. 97%).',
      kpiGain: 'Zysk realny vs gotówka 0%',
      kpiGainSub: 'Obie kwoty w dzisiejszych złotych.',
      kpiGainEmpty: 'Włącz aktywo inne niż gotówka, aby porównać.',
      kpiNone: 'Nie wybrano aktywa',
      yReal: 'dzisiejsze zł',
      yNominal: 'zł nominalnie',
      year: 'Rok {n}',
      paidTip: 'Wpłacono: {amount}',
      crisisMark: 'Kryzys',
      chartAria: 'Wykres liniowy wybranych aktywów w horyzoncie {years}, {mode}.',
      empty: 'Zaznacz co najmniej jedno aktywo, aby narysować wykres.',
      noteAssume: 'Założenia: globalny ETF {etf} rocznie po kosztach (przed podatkiem 19%), inflacja {inf} rocznie. S&P 500 {sp}, obligacje {bonds} i złoto {gold} to ilustracyjne długoterminowe średnie, a nie historia rok po roku. Pomijamy podatki, opłaty brokera i wahania kursów walut.',
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

  // One asset, years 1..Y. Each point: paid (nominal), nominal value, real value.
  function series(asset, p) {
    const r = asset.id === 'etf' ? p.etfRate : asset.rate;
    const i = r / 12;
    const out = [];
    for (let year = 1; year <= p.years; year++) {
      const n = 12 * year;
      const paid = p.initial + p.monthly * n;
      let nominal = r === 0 ? p.monthly * n : p.monthly * ((Math.pow(1 + i, n) - 1) / i);
      if (p.initial > 0) nominal += r === 0 ? p.initial : p.initial * Math.pow(1 + i, n);
      const real = nominal / Math.pow(1 + p.inflation / 100, year);
      const m = p.crisis && asset.shock ? (asset.shock[year] || 1) : 1;
      out.push({ year, paid, nominal: pyRound(nominal * m), real: pyRound(real * m) });
    }
    return out;
  }
  function computeAll(p) {
    const res = {};
    ASSETS.forEach((a) => { res[a.id] = series(a, p); });
    return res;
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
    const s = (Number.isInteger(d) ? d.toFixed(1) : String(d));
    return (lang() === 'pl' ? s.replace('.', ',') : s) + '%';
  }
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

  function build() {
    builtLang = lang();
    const assetChips = ASSETS.map((a) => {
      const name = assetName(a.id);
      return (
        '<li class="sim-asset" data-asset="' + a.id + '" style="--asset:' + a.color + '">' +
          '<button type="button" class="sim-asset__tick" data-sim-toggle="' + a.id + '" aria-pressed="false" aria-label="' + esc(tr('showAsset', { asset: name })) + '">' +
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</button>' +
          (a.id === 'cash'
            ? '<span class="sim-asset__name"><i class="sim-swatch sim-swatch--' + a.id + '"></i>' + esc(name) + '</span>'
            : '<button type="button" class="sim-asset__name" data-sim-focus="' + a.id + '" aria-pressed="false" aria-label="' + esc(tr('focusAsset', { asset: name })) + '"><i class="sim-swatch sim-swatch--' + a.id + '"></i>' + esc(name) + '<span class="sim-asset__mark">' + esc(tr('inResults')) + '</span></button>') +
        '</li>'
      );
    }).join('');

    const yearsLabel = tr('years');
    root.innerHTML =
      // The tool panel above already says "What-if simulator", so the card opens on what it does.
      '<div class="sim-head">' +
        '<p class="sim-sub">' + esc(tr('sub')) + '</p>' +
        '<span class="chip chip--soft" id="sim-head-chip"></span>' +
      '</div>' +

      '<fieldset class="sim-assets">' +
        '<legend class="sim-assets__label">' + esc(tr('compare')) + '</legend>' +
        '<p class="sim-hint">' + esc(tr('compareHint')) + '</p>' +
        '<ul class="sim-assets__list">' + assetChips + '</ul>' +
        '<p class="sim-about" id="sim-about" aria-live="polite"></p>' +
      '</fieldset>' +

      '<div class="sim-controls">' +
        amountField('sim-monthly', 'monthly', el.monthlyGrid, st.monthly) +
        '<div class="sim-field">' +
          '<div class="sim-field__top">' +
            '<label class="sim-field__label" for="sim-years">' + esc(yearsLabel) + '</label>' +
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

      '<div class="sim-kpis" aria-live="polite">' +
        '<div class="sim-kpi sim-kpi--paid"><p class="sim-kpi__label">' + esc(tr('kpiPaid')) + '</p><p class="sim-kpi__value" id="sim-kpi-paid">0</p><p class="sim-kpi__sub" id="sim-kpi-paid-sub"></p></div>' +
        '<div class="sim-kpi sim-kpi--focus" id="sim-kpi-focus-box"><p class="sim-kpi__label" id="sim-kpi-focus-label"></p><p class="sim-kpi__value" id="sim-kpi-focus">0</p><p class="sim-kpi__sub" id="sim-kpi-focus-sub"></p><p class="sim-kpi__sub" id="sim-kpi-win"></p></div>' +
        '<div class="sim-kpi sim-kpi--gain"><p class="sim-kpi__label">' + esc(tr('kpiGain')) + '</p><p class="sim-kpi__value" id="sim-kpi-gain">0</p><p class="sim-kpi__sub" id="sim-kpi-gain-sub"></p></div>' +
      '</div>' +

      '<div class="sim-chart">' +
        '<canvas id="sim-chart" role="img"></canvas>' +
        '<p class="sim-chart__empty" id="sim-chart-empty" hidden>' + esc(tr('empty')) + '</p>' +
      '</div>';

    if (notesEl) notesEl.innerHTML = '<p id="sim-note-assume"></p><p id="sim-note-crisis" hidden></p><p>' + esc(tr('noteHistory')) + '</p>';

    ['head-chip', 'about', 'monthly-num', 'monthly-range', 'years', 'years-out', 'more', 'more-count', 'initial-num', 'initial-range',
      'inflation', 'inflation-out', 'crisis', 'plan-note', 'reset', 'kpi-paid', 'kpi-paid-sub', 'kpi-focus-box', 'kpi-focus-label',
      'kpi-focus', 'kpi-focus-sub', 'kpi-win', 'kpi-gain', 'kpi-gain-sub', 'chart', 'chart-empty', 'note-assume', 'note-crisis']
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
  function syncControls(skip) {
    const f = focusId();
    root.querySelectorAll('.sim-asset').forEach((li) => {
      const id = li.dataset.asset;
      const on = st.enabled.has(id);
      li.classList.toggle('is-on', on);
      li.classList.toggle('is-focus', id === f);
      li.querySelector('[data-sim-toggle]').setAttribute('aria-pressed', String(on));
      const fb = li.querySelector('[data-sim-focus]');
      if (fb) fb.setAttribute('aria-pressed', String(id === f));
    });
    const aboutId = f || (st.enabled.has('cash') ? 'cash' : 'etf');
    el.about.textContent = tr('about.' + aboutId, { rate: pct(rateOf(aboutId) * 100) });

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

  function renderKpis(all, animate) {
    const y = st.years;
    const cash = all.cash[y - 1];
    const f = focusId();
    const fp = f ? all[f][y - 1] : null;
    const k = {
      paid: cash.paid,
      focus: fp ? (st.real ? fp.real : fp.nominal) : cash[st.real ? 'real' : 'nominal'],
      gain: fp ? fp.real - cash.real : 0,
    };
    const put = (node, key, fmt) => {
      if (animate && lastKpi && H.animateNumber) H.animateNumber(node, lastKpi[key], k[key], { duration: 420, format: fmt });
      else node.textContent = fmt(k[key]);
    };
    const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + H.money(Math.abs(v));
    put(el['kpi-paid'], 'paid', H.money);
    el['kpi-paid-sub'].textContent = tr('kpiPaidSub', { cash: H.money(cash.real) });

    const shownId = f || 'cash';
    const hasFocus = !!f || st.enabled.has('cash');
    el['kpi-focus-box'].style.setProperty('--asset', hasFocus ? assetById(shownId).color : 'var(--rule)');
    el['kpi-focus-label'].textContent = hasFocus ? tr('kpiFocus', { asset: assetName(shownId), years: H.years(y) }) : tr('kpiNone');
    const other = fp || cash;
    if (hasFocus) {
      put(el['kpi-focus'], 'focus', H.money);
      el['kpi-focus-sub'].textContent = st.real ? tr('kpiFocusNominal', { amount: H.money(other.nominal) }) : tr('kpiFocusReal', { amount: H.money(other.real) });
    } else {
      setText(el['kpi-focus'], '—');
      el['kpi-focus-sub'].textContent = tr('empty');
    }
    el['kpi-win'].hidden = f !== 'etf';
    el['kpi-win'].textContent = f === 'etf' ? tr('kpiWin', { p: winRate(y) }) : '';

    if (fp) {
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

  // Plain text that also stops a count-up still running on the node (app.js animateNumber).
  function setText(node, text) {
    if (node._fqRaf) { cancelAnimationFrame(node._fqRaf); node._fqRaf = null; }
    clearTimeout(node._fqTimer);
    node.textContent = text;
  }

  // Shaded band on "Year 3" while the crisis switch is on.
  const crisisBand = {
    id: 'simCrisisBand',
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
  };

  function renderChart(all) {
    const empty = st.enabled.size === 0;
    el['chart-empty'].hidden = !empty;
    el.chart.setAttribute('aria-label', tr('chartAria', { years: H.years(st.years), mode: st.real ? tr('real') : tr('nominal') }));
    if (!window.Chart) return;
    const f = focusId();
    const key = st.real ? 'real' : 'nominal';
    const labels = [tr('year', { n: 0 })];
    for (let y = 1; y <= st.years; y++) labels.push(tr('year', { n: y }));
    const paid = [st.initial].concat(all.cash.map((p) => p.paid));
    const datasets = ASSETS.filter((a) => st.enabled.has(a.id)).map((a) => {
      const isFocus = a.id === f;
      return {
        simId: a.id,
        label: assetName(a.id),
        data: [st.initial].concat(all[a.id].map((p) => p[key])),
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
      plugins: [crisisBand],
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
            ticks: { callback: (v) => H.compactMoney(v), maxTicksLimit: 6 },
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
    const all = computeAll(st);
    renderKpis(all, o.animate !== false);
    renderChart(all);
    if (H.onChange) H.onChange({ monthly: st.monthly, years: st.years, isPlanMonthly: st.monthly === plan.monthly });
  }

  // ------------------------------------------------------------------------
  // 7. Events (delegated on #sim-root, so rebuilding the DOM never leaks listeners)
  // ------------------------------------------------------------------------
  function onInput(e) {
    const id = e.target && e.target.id;
    if (!id || id.indexOf('sim-') !== 0) return;
    const v = Number(e.target.value);
    if (id === 'sim-monthly-range') { st.monthly = el.monthlyGrid[clamp(Math.round(v), 0, el.monthlyGrid.length - 1)]; render({ skip: id }); }
    else if (id === 'sim-initial-range') { st.initial = INITIAL_GRID[clamp(Math.round(v), 0, INITIAL_GRID.length - 1)]; render({ skip: id }); }
    else if (id === 'sim-years') { st.years = clamp(Math.round(v), LIMITS.years[0], LIMITS.years[1]); render(); }
    else if (id === 'sim-inflation') { st.inflation = clamp(Math.round(v * 10) / 10, LIMITS.inflation[0], LIMITS.inflation[1]); render(); }
    else if (id === 'sim-monthly-num' || id === 'sim-initial-num') {
      // Typing: apply only values already inside the range; the field is clamped on commit.
      const lim = id === 'sim-monthly-num' ? LIMITS.monthly : LIMITS.initial;
      if (e.target.value === '' || !Number.isFinite(v) || v < lim[0] || v > lim[1]) return;
      if (id === 'sim-monthly-num') st.monthly = Math.round(v); else st.initial = Math.round(v);
      render({ skip: id });
    }
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
    const t = e.target.closest ? e.target.closest('[data-sim-toggle],[data-sim-focus],[data-sim-mode],[data-sim-reset],#sim-crisis') : null;
    if (!t || !root.contains(t)) return;
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
  //            animateNumber(el, from, to, opts), onChange(state) }
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
