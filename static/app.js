/* ==========================================================================
   Finance Quest — static/app.js
   Czysty JS bez build-toola. Biblioteki globalne z /static/vendor/:
   tailwind, Chart, confetti, lucide (zero CDN w runtime).
   Kontrakt API: docs/02_TECH_API_AND_MATH.md §4–§5.

   Zawartość:
   - Issue #4: konfiguracja API, stan, router ekranów, stały nagłówek
     (dzień, poziom/XP, streak, Gotowość), Demo Mode, toasty, modal, konfetti.
   - Issue #8: Ekran 1 (ankieta 6 pytań) i Ekran 2 (mapa 14 dni, filtr Speakly,
     mikro-lekcje, przykładowy podział środków, Wehikuł Czasu z Chart.js).
   - Issue #9: Ekran 3 (symulacja wyborów z Luną: karty quick_replies, własna
     odpowiedź, feedback, konfetti) i ciche odtworzenie sesji po 404.
   - Issue #10: Ekran 4 (baner awansu, Gotowość, samoocena „po", wyzwanie,
     checklista, przykładowy plan, ranking, stopka MiFID II) i modal bankowy.
   ========================================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // 1. Konfiguracja
  // ------------------------------------------------------------------------

  // Ścieżki względne /api/... ; przy otwarciu z file:// fallback na lokalny backend.
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
  const API_TIMEOUT_MS = 8000;
  const ANALYZE_MIN_ANIMATION_MS = 800; // docs/01 §7 Ekran 1: 0,8 s „Filtruję zbędną teorię..."
  const MICRO_LESSON_BONUS_CAP = 45;    // docs/01 §2: maks. +45 XP z 3 mikro-lekcji
  const FREE_CASH_CAP = 10000;          // docs/01 §7 Ekran 1: maks. wolnych środków = min(10 000, net_income)
  const WIN_RATE_DISPLAY_CAP = 97;      // docs/02 §3B: nigdy > 97%
  const MISSION_MESSAGE_MAX = 600;      // docs/02 §4 MissionTurnRequest.user_message: 1–600 znaków
  const ANSWER_PREVIEW_MAX = 140;       // skrót własnej odpowiedzi w karcie feedbacku
  const REPLY_KEYS = ['A', 'B', 'C', 'D'];

  // docs/02 §3B: Osoba 2 uzupełni źródło/okres/walutę (np. '; źródło: …'). Pusty = brak dopisku.
  const WIN_RATE_SOURCE_NOTE = '';

  // docs/01 §7 Ekran 4 — stopka compliance (MiFID II), pokazywana też pod wykresem Ekranu 2.
  const COMPLIANCE_TEXT =
    'Aplikacja Finance Quest ma charakter wyłącznie edukacyjny i symulacyjny. Wyliczenia opierają się na ' +
    'uproszczonych założeniach i danych historycznych, nie uwzględniają podatku od zysków, opłat ani ryzyka ' +
    'walutowego, nie gwarantują przyszłych wyników i nie stanowią doradztwa inwestycyjnego ani rekomendacji ' +
    'w rozumieniu dyrektywy MiFID II. Inwestowanie wiąże się z ryzykiem utraty części lub całości kapitału.';

  const SCREENS = Object.freeze({
    ONBOARDING: 'screen_onboarding',
    FILTER: 'screen_filter_and_timemachine',
    MISSION: 'screen_mission_live',
    CHECKLIST: 'screen_checklist',
  });

  // Te same wartości co tailwind.config w index.html i :root w styles.css (np. dla Chart.js).
  const COLORS = Object.freeze({
    brandDark: '#002E3C',
    brandYellow: '#FFCC00',
    brandYellowDark: '#D9A900',
    etfGreen: '#10B981',
    inflationRed: '#F43F5E',
    streakOrange: '#F97316',
    stressAmber: '#F59E0B',
    surfaceBg: '#F8FAFC',
    cardBg: '#FFFFFF',
  });

  // Domyślny GamificationState (docs/02 §4) — pokazywany przed pierwszą analizą.
  const DEFAULT_GAMIFICATION = Object.freeze({
    level: 1,
    level_title: 'Obserwator',
    xp: 20,
    next_level_xp: 100,
    xp_gained: 0,
    leveled_up: false,
    streak_days: 1,
  });

  // Dolny próg XP danego poziomu (docs/02 §3G: poziom 2 od 100 XP).
  const LEVEL_FLOOR_XP = Object.freeze({ 1: 0, 2: 100 });

  // Kafelki obawy (docs/01 §3B).
  const CONCERN_LABELS = Object.freeze({
    freeze_money: 'Boję się, że zamrożę pieniądze',
    no_time: 'Nie mam czasu na giełdę',
    lose_money: 'Boję się, że stracę pieniądze',
    too_late: 'Chyba za późno na start',
  });

  // Komunikaty przy polach ankiety (walidacja lokalna i błędy 422 z API).
  const FIELD_MESSAGES = Object.freeze({
    age: 'Wiek musi mieścić się w przedziale 18–70 lat.',
    net_income: 'Zarobki netto: od 2 500 do 25 000 zł.',
    free_cash: 'Wolne środki: od 200 do 10 000 zł i nie więcej niż zarobki netto.',
    has_emergency_fund: 'Zaznacz, czy masz już poduszkę.',
    main_concern: 'Wybierz, czego najbardziej się obawiasz.',
    self_confidence_start: 'Wybierz ocenę od 1 do 5.',
  });
  const FORM_FIELDS = Object.keys(FIELD_MESSAGES);

  // ------------------------------------------------------------------------
  // 2. Stan aplikacji
  // ------------------------------------------------------------------------

  const state = {
    currentScreen: SCREENS.ONBOARDING,
    busy: false,
    personas: [],            // list[DemoPersona] z GET /api/demo-personas
    activePersonaId: null,
    lastProfile: null,       // ostatni OnboardingRequest (do cichego ponowienia analyze po 404)
    session: null,           // OnboardingResponse
    turn: null,              // ostatni MissionTurnResponse (initial_mission_turn lub tura)
    microLessonBonusXp: 0,   // lokalny bonus z mikro-lekcji (reguła monotonicznego XP)
    completedLessons: new Set(),
    timeMachine: { year: null, point: null },
    rendered: { xp: null, level: null, readiness: null }, // ostatnio narysowane wartości nagłówka
    mission: {
      busy: false,           // trwa POST /api/mission/turn (blokada podwójnego kliku)
      token: 0,              // rośnie przy nowej analizie — odpowiedzi starej sesji są ignorowane
      log: [],               // wysłane odpowiedzi {user_message, quick_reply_id?} (odtworzenie po 404)
      lastAnswer: null,      // tekst ostatniej odpowiedzi (w karcie feedbacku)
      renderedValue: 0,      // ostatnio narysowane portfolio_status.simulated_value
      restoring: null,       // Promise trwającego odtwarzania sesji
    },
    summary: freshSummary(), // Ekran 4 i modal bankowy (stan lokalny, zerowany przy nowej analizie)
  };

  const els = {};
  let timeMachineChart = null;

  function cacheElements() {
    const byId = (id) => document.getElementById(id);
    els.screens = Array.from(document.querySelectorAll('main .screen'));
    els.personaPills = Array.from(document.querySelectorAll('[data-persona-id]'));
    els.toastRoot = byId('toast-root');

    // Nagłówek
    els.day = byId('hdr-day');
    els.totalDays = byId('hdr-total-days');
    els.level = byId('hdr-level');
    els.levelIcon = byId('hdr-level-icon');
    els.levelNum = byId('hdr-level-num');
    els.levelTitle = byId('hdr-level-title');
    els.xp = byId('hdr-xp');
    els.xpFill = byId('hdr-xp-fill');
    els.xpDelta = byId('hdr-xp-delta');
    els.streakText = byId('hdr-streak-text');
    els.readiness = byId('hdr-readiness');
    els.readinessValue = byId('hdr-readiness-value');
    els.readinessDelta = byId('hdr-readiness-delta');
    els.readinessBar = byId('hdr-readiness-bar');
    els.readinessFill = byId('hdr-readiness-fill');

    // Ekran 1
    els.form = byId('onboarding-form');
    els.fAge = byId('f-age');
    els.fAgeOut = byId('f-age-out');
    els.fAgeGroup = byId('f-age-group');
    els.fNet = byId('f-net');
    els.fNetOut = byId('f-net-out');
    els.fFree = byId('f-free');
    els.fFreeOut = byId('f-free-out');
    els.fFreeMax = byId('f-free-max');
    els.ctaOnboarding = byId('cta-onboarding');

    // Ekran 2
    els.planIntro = byId('plan-intro');
    els.cardRoadmap = byId('card-roadmap');
    els.cardSpeakly = byId('card-speakly');
    els.cardSplit = byId('card-split');
    els.tmMonthly = byId('tm-monthly');
    els.tmYears = byId('tm-years');
    els.tmYearsOut = byId('tm-years-out');
    els.kpiCash = byId('kpi-cash');
    els.kpiPaid = byId('kpi-paid');
    els.kpiEtf = byId('kpi-etf');
    els.kpiEtfNominal = byId('kpi-etf-nominal');
    els.kpiWin = byId('kpi-win');
    els.kpiWinBar = byId('kpi-win-bar');
    els.kpiWinSource = byId('kpi-win-source');
    els.tmChart = byId('tm-chart');
    els.tmAssumptions = byId('tm-assumptions');
    els.tmCompliance = byId('tm-compliance');

    // Ekran 3
    els.msPanel = byId('ms-panel');
    els.msDay = byId('ms-day');
    els.msTotalDays = byId('ms-total-days');
    els.msStep = byId('ms-step');
    els.msTotalSteps = byId('ms-total-steps');
    els.msSteps = byId('ms-steps');
    els.msBadgeText = byId('ms-badge-text');
    els.msValue = byId('ms-value');
    els.msFeedback = byId('ms-feedback');
    els.msFeedbackTitle = byId('ms-feedback-title');
    els.msFeedbackAnswer = byId('ms-feedback-answer');
    els.msFeedbackText = byId('ms-feedback-text');
    els.msFeedbackXp = byId('ms-feedback-xp');
    els.msFeedbackReadiness = byId('ms-feedback-readiness');
    els.msFeedbackLevel = byId('ms-feedback-level');
    els.msLuna = byId('ms-luna');
    els.msLunaMessage = byId('ms-luna-message');
    els.msThinking = byId('ms-thinking');
    els.msInteraction = byId('ms-interaction');
    els.msReplies = byId('ms-replies');
    els.msForm = byId('ms-form');
    els.msInput = byId('ms-input');
    els.msSend = byId('ms-send');
    els.msCount = byId('ms-count');
    els.ctaFinishDay = byId('cta-finish-day');

    // Ekran 4 i modal bankowy
    els.cardLevelup = byId('card-levelup');
    els.cardChallenge = byId('card-challenge');
    els.cardChecklist = byId('card-checklist');
    els.cardBank = byId('card-bank');
    els.cardLeaderboard = byId('card-leaderboard');
    els.complianceFooter = byId('compliance-footer');
    els.bankOrderContent = byId('bank-order-content');
  }

  // ------------------------------------------------------------------------
  // 3. Narzędzia
  // ------------------------------------------------------------------------

  const NBSP = ' ';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // „33 844" — separator tysięcy zawsze (także dla 4 cyfr: „1 214"), twarda spacja.
  function formatNumber(value) {
    const n = Math.round(Number(value) || 0);
    const sign = n < 0 ? '-' : '';
    return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }

  function formatPLN(value) {
    return formatNumber(value) + NBSP + 'zł';
  }

  // Polska odmiana: 1 rok / 2–4 lata / 5+ lat (z wyjątkiem 12–14).
  function pluralPL(n, one, few, many) {
    const abs = Math.abs(n);
    if (abs === 1) return one;
    const lastDigit = abs % 10;
    const lastTwo = abs % 100;
    return lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
  }

  function yearsLabel(n) {
    return n + NBSP + pluralPL(n, 'rok', 'lata', 'lat');
  }

  function pluralDays(n) {
    return n === 1 ? 'dzień' : 'dni';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Ponowne odtworzenie animacji CSS (np. .shimmer-bar, .level-pop, .screen-enter).
  function replayClass(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth; // wymuszenie reflow
    el.classList.add(className);
  }

  // Ustawienie wartości bez animacji — anuluje trwające liczenie, żeby nie nadpisało wyniku.
  function setNumber(el, value, format) {
    if (!el) return;
    if (el._fqAnimFrame) {
      cancelAnimationFrame(el._fqAnimFrame);
      el._fqAnimFrame = null;
    }
    clearTimeout(el._fqAnimTimer);
    el.textContent = (format || formatNumber)(value);
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Płynne liczenie w górę/dół (kwoty, XP, procenty).
  function animateNumber(el, from, to, options) {
    if (!el) return;
    const opts = options || {};
    const duration = opts.duration || 650;
    const format = opts.format || formatNumber;
    // Karta w tle: requestAnimationFrame jest wstrzymany — od razu wartość końcowa.
    if (prefersReducedMotion() || from === to || document.hidden) {
      setNumber(el, to, format);
      return;
    }
    if (el._fqAnimFrame) cancelAnimationFrame(el._fqAnimFrame);
    clearTimeout(el._fqAnimTimer);
    const start = performance.now();
    const step = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) {
        el._fqAnimFrame = requestAnimationFrame(step);
      } else {
        setNumber(el, to, format);
      }
    };
    el._fqAnimFrame = requestAnimationFrame(step);
    // Bezpiecznik: przy dławionym requestAnimationFrame (karta w tle) wartość końcowa i tak się pojawi.
    el._fqAnimTimer = setTimeout(() => setNumber(el, to, format), duration + 250);
  }

  // Liczniki [data-count] w danym kontenerze: od 0 do wartości docelowej.
  function animateCounters(root) {
    if (!root) return;
    root.querySelectorAll('[data-count]').forEach((el) => {
      animateNumber(el, 0, Number(el.dataset.count), { duration: 900 });
    });
  }

  // Unoszący się licznik „+10" / „+40 XP".
  function flashDelta(el, text) {
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    replayClass(el, 'delta-float');
    clearTimeout(el._fqHideTimer);
    el._fqHideTimer = setTimeout(() => { el.hidden = true; }, 1700);
  }

  function setRangeFill(input) {
    if (!input) return;
    const min = Number(input.min);
    const max = Number(input.max);
    const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fill', clamp(pct, 0, 100) + '%');
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // ------------------------------------------------------------------------
  // 4. API
  // ------------------------------------------------------------------------

  class ApiError extends Error {
    constructor(status, data, kind) {
      super(kind === 'timeout' ? 'timeout' : kind === 'network' ? 'network' : 'HTTP ' + status);
      this.name = 'ApiError';
      this.status = status; // 0 = brak odpowiedzi (sieć / timeout)
      this.kind = kind || 'http';
      this.data = data;
    }
  }

  async function apiRequest(path, options) {
    const opts = options || {};
    const method = opts.method || 'GET';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || API_TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, {
        method,
        headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data, 'http');
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, null, err && err.name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  }

  const api = {
    getDemoPersonas: () => apiRequest('/api/demo-personas'),
    analyze: (profile) => apiRequest('/api/onboarding/analyze', { method: 'POST', body: profile }),
    // Wywołuj przez withSessionRecovery — przy 404 sesja jest po cichu odtwarzana (docs/02 §5).
    missionTurn: (payload) => apiRequest('/api/mission/turn', { method: 'POST', body: payload }),
    acceptChallenge: (sessionId) => apiRequest('/api/challenge/accept', { method: 'POST', body: { session_id: sessionId } }),
  };

  function describeApiError(err) {
    if (!(err instanceof ApiError)) return 'Coś poszło nie tak. Spróbuj ponownie.';
    if (err.kind === 'network') return 'Brak połączenia z serwerem. Uruchom backend: uvicorn backend.main:app --port 8000';
    if (err.kind === 'timeout') return 'Serwer nie odpowiedział na czas. Spróbuj ponownie.';
    if (err.status === 422) return 'Sprawdź odpowiedzi w ankiecie — część wartości jest poza zakresem.';
    if (err.status === 404) return 'Nie znaleziono zasobu na serwerze (404).';
    return 'Błąd serwera (' + err.status + '). Spróbuj ponownie.';
  }

  // FastAPI 422: {"detail": [{"loc": ["body", "free_cash"], "msg": "..."}]}.
  // Walidator modelu (free_cash > net_income) ma loc ["body"] — rozpoznajemy po treści.
  function mapValidationErrors(data) {
    const errors = {};
    const detail = data && Array.isArray(data.detail) ? data.detail : [];
    detail.forEach((item) => {
      const loc = Array.isArray(item.loc) ? item.loc : [];
      let field = loc.length > 1 ? String(loc[loc.length - 1]) : null;
      if (!field || !FIELD_MESSAGES[field]) {
        field = /free_cash|net_income/.test(String(item.msg || '')) ? 'free_cash' : null;
      }
      if (field && !errors[field]) errors[field] = FIELD_MESSAGES[field];
    });
    return errors;
  }

  // --- Ciche odtworzenie sesji po 404 (docs/02 §5) ---------------------------
  // Np. restart serwera w trybie SQLite-w-pamięci kasuje sesje. Frontend tworzy nową sesję
  // z ostatnim profilem (analyze) i odtwarza wysłane już odpowiedzi, więc serwer wraca do
  // bieżącego kroku. Treść Ekranu 2 jest identyczna (ten sam profil), bonus z mikro-lekcji zostaje.

  function isSessionMissing(err) {
    return err instanceof ApiError && err.status === 404;
  }

  function restoreSession() {
    if (!state.lastProfile) return Promise.reject(new ApiError(404, null, 'http'));
    if (!state.mission.restoring) {
      const profile = state.lastProfile;
      const log = state.mission.log.slice();
      const token = state.mission.token;
      state.mission.restoring = (async () => {
        const data = await api.analyze(profile);
        for (const entry of log) {
          await api.missionTurn(Object.assign({ session_id: data.session_id }, entry));
        }
        // W międzyczasie nowa analiza (np. Demo Mode)? Wtedy nie nadpisujemy jej sesji.
        if (token === state.mission.token) state.session = data;
        return data;
      })().finally(() => {
        state.mission.restoring = null;
      });
    }
    return state.mission.restoring;
  }

  // request(sessionId) -> Promise. Jedno ciche ponowienie po 404; kolejny błąd idzie dalej.
  async function withSessionRecovery(request) {
    if (!state.session) throw new ApiError(404, null, 'http');
    try {
      return await request(state.session.session_id);
    } catch (err) {
      if (!isSessionMissing(err) || !state.lastProfile) throw err;
      console.info('[Finance Quest] Sesja nie istnieje na serwerze (404) — odtwarzam ją po cichu.');
      const data = await restoreSession();
      return request(data.session_id);
    }
  }

  // ------------------------------------------------------------------------
  // 5. Stały nagłówek (docs/01 §6)
  // ------------------------------------------------------------------------

  function currentGamification() {
    return (state.turn && state.turn.gamification) || DEFAULT_GAMIFICATION;
  }

  // Reguła monotonicznego XP: gamification.xp + microLessonBonusXp (docs/01 §7 Ekran 2).
  function displayedXp() {
    return currentGamification().xp + state.microLessonBonusXp;
  }

  function readinessVisible() {
    return state.currentScreen !== SCREENS.ONBOARDING && state.turn != null;
  }

  function renderHeader(options) {
    const animate = !options || options.animate !== false;
    const g = currentGamification();
    const xp = displayedXp();
    const prev = state.rendered;

    // Dzień programu
    els.day.textContent = state.session ? state.session.current_day : 1;
    els.totalDays.textContent = state.session ? state.session.total_program_days : 14;

    // Poziom: ⭐ Poz. 1: Obserwator (XP) -> 🏆 Poz. 2: Świadomy Start
    els.levelIcon.textContent = g.level >= 2 ? '🏆' : '⭐';
    els.levelNum.textContent = g.level;
    els.levelTitle.textContent = g.level_title;
    if (animate && prev.level != null && g.level > prev.level) {
      replayClass(els.level, 'level-pop');
    }

    // XP + mini pasek postępu do następnego poziomu
    if (animate && prev.xp != null && xp > prev.xp) {
      animateNumber(els.xp, prev.xp, xp);
      flashDelta(els.xpDelta, '+' + (xp - prev.xp) + NBSP + 'XP');
      replayClass(els.xpFill, 'shimmer-bar');
    } else {
      setNumber(els.xp, xp);
    }
    const floor = LEVEL_FLOOR_XP[g.level] || 0;
    const span = Math.max(1, g.next_level_xp - floor);
    els.xpFill.style.width = clamp(((xp - floor) / span) * 100, 0, 100) + '%';

    // Streak
    els.streakText.textContent = g.streak_days + NBSP + pluralDays(g.streak_days);

    // Gotowość (od Ekranu 2; wartość z API — confidence_score, start = samoocena)
    const showReadiness = readinessVisible();
    els.readiness.hidden = !showReadiness;
    let readiness = prev.readiness;
    if (showReadiness) {
      readiness = clamp(state.turn.confidence_score, 0, 100);
      if (animate && prev.readiness != null && readiness > prev.readiness) {
        animateNumber(els.readinessValue, prev.readiness, readiness, { format: (v) => Math.round(v) + '%' });
        flashDelta(els.readinessDelta, '+' + (readiness - prev.readiness));
        replayClass(els.readinessFill, 'shimmer-bar');
      } else {
        setNumber(els.readinessValue, readiness, (v) => Math.round(v) + '%');
      }
      els.readinessFill.style.width = readiness + '%';
      els.readinessBar.setAttribute('aria-valuenow', String(readiness));
    }

    state.rendered = { xp, level: g.level, readiness };
  }

  // Zerowanie bazy animacji (nowa persona/sesja — bez „+X" i bez cofania licznika na oczach).
  function resetHeaderBaseline() {
    state.rendered = { xp: null, level: null, readiness: null };
  }

  // ------------------------------------------------------------------------
  // 6. Router ekranów
  // ------------------------------------------------------------------------

  function showScreen(id) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains('screen')) return;
    state.currentScreen = id;
    els.screens.forEach((el) => {
      const active = el.id === id;
      el.hidden = !active;
      if (active) replayClass(el, 'screen-enter');
    });
    document.body.dataset.screen = id;
    window.scrollTo(0, 0);
    const title = target.querySelector('[data-screen-title]');
    if (title) title.focus({ preventScroll: true });
    renderHeader();
    if (id === SCREENS.CHECKLIST) renderSummary({ animate: true });
  }

  // ------------------------------------------------------------------------
  // 7. Ekran 1 — ankieta (docs/01 §7 Ekran 1)
  // ------------------------------------------------------------------------

  function ageGroupLabel(age) {
    if (age < 30) return 'Młody Start (20+)';
    if (age <= 50) return 'Kariera i Rodzina (30–50)';
    return 'Ochrona Kapitału (50+)';
  }

  // Maksimum wolnych środków = min(10 000, net_income); obniżenie zarobków obniża suwak.
  function syncFreeCashMax() {
    const max = Math.min(FREE_CASH_CAP, Number(els.fNet.value));
    els.fFree.max = String(max);
    if (Number(els.fFree.value) > max) els.fFree.value = String(max);
  }

  function syncFormOutputs() {
    syncFreeCashMax();
    const age = Number(els.fAge.value);
    els.fAgeOut.textContent = yearsLabel(age);
    els.fAgeGroup.textContent = ageGroupLabel(age);
    els.fNetOut.textContent = formatPLN(els.fNet.value);
    els.fFreeOut.textContent = formatPLN(els.fFree.value);
    els.fFreeMax.textContent = formatPLN(els.fFree.max);
    [els.fAge, els.fNet, els.fFree].forEach(setRangeFill);
  }

  function setRadio(name, value) {
    els.form.querySelectorAll('input[name="' + name + '"]').forEach((input) => {
      input.checked = input.value === value;
    });
  }

  // Wypełnia 6 pól wartościami persony (Demo Mode).
  function fillOnboardingForm(profile) {
    els.fAge.value = String(profile.age);
    els.fNet.value = String(profile.net_income);
    syncFreeCashMax();
    els.fFree.value = String(profile.free_cash);
    setRadio('has_emergency_fund', String(profile.has_emergency_fund));
    setRadio('main_concern', profile.main_concern);
    setRadio('self_confidence_start', String(profile.self_confidence_start));
    clearFieldErrors();
    syncFormOutputs();
  }

  function fieldContainer(name) {
    return els.form.querySelector('[data-field="' + name + '"]');
  }

  function clearFieldErrors(name) {
    (name ? [name] : FORM_FIELDS).forEach((field) => {
      const box = fieldContainer(field);
      const msg = els.form.querySelector('[data-error-for="' + field + '"]');
      if (box) box.removeAttribute('data-invalid');
      if (msg) {
        msg.hidden = true;
        msg.textContent = '';
      }
    });
  }

  function showFieldErrors(errors) {
    clearFieldErrors();
    let first = null;
    FORM_FIELDS.forEach((field) => {
      if (!errors[field]) return;
      const box = fieldContainer(field);
      const msg = els.form.querySelector('[data-error-for="' + field + '"]');
      if (box) box.setAttribute('data-invalid', '');
      if (msg) {
        msg.textContent = errors[field];
        msg.hidden = false;
      }
      if (!first && box) first = box;
    });
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = first.querySelector('input');
      if (input) input.focus({ preventScroll: true });
    }
  }

  // Odczyt 6 pól OnboardingRequest (docs/02 §4) z walidacją lokalną. null = błędy przy polach.
  function readOnboardingForm() {
    const fd = new FormData(els.form);
    const fund = fd.get('has_emergency_fund');
    const concern = fd.get('main_concern');
    const confidence = fd.get('self_confidence_start');
    const profile = {
      age: Number(fd.get('age')),
      net_income: Number(fd.get('net_income')),
      free_cash: Number(fd.get('free_cash')),
      has_emergency_fund: fund === 'true',
      main_concern: concern,
      self_confidence_start: Number(confidence),
    };

    const errors = {};
    if (!(profile.age >= 18 && profile.age <= 70)) errors.age = FIELD_MESSAGES.age;
    if (!(profile.net_income >= 2500 && profile.net_income <= 25000)) errors.net_income = FIELD_MESSAGES.net_income;
    if (!(profile.free_cash >= 200 && profile.free_cash <= FREE_CASH_CAP && profile.free_cash <= profile.net_income)) {
      errors.free_cash = FIELD_MESSAGES.free_cash;
    }
    if (fund == null) errors.has_emergency_fund = FIELD_MESSAGES.has_emergency_fund;
    if (!concern || !CONCERN_LABELS[concern]) errors.main_concern = FIELD_MESSAGES.main_concern;
    if (!(profile.self_confidence_start >= 1 && profile.self_confidence_start <= 5)) {
      errors.self_confidence_start = FIELD_MESSAGES.self_confidence_start;
    }

    if (Object.keys(errors).length) {
      showFieldErrors(errors);
      return null;
    }
    clearFieldErrors();
    return profile;
  }

  function onFormInput(event) {
    syncFormOutputs();
    const box = event.target.closest('[data-field]');
    if (box) clearFieldErrors(box.dataset.field);
    // Ręczna zmiana ankiety = już nie dokładnie persona demo.
    if (state.activePersonaId) {
      state.activePersonaId = null;
      renderPersonaPills();
    }
  }

  // ------------------------------------------------------------------------
  // 8. Demo Mode i analiza profilu
  // ------------------------------------------------------------------------

  function findPersona(id) {
    return state.personas.find((p) => p.id === id) || null;
  }

  function profileFromPersona(p) {
    return {
      age: p.age,
      net_income: p.net_income,
      free_cash: p.free_cash,
      has_emergency_fund: p.has_emergency_fund,
      main_concern: p.main_concern,
      self_confidence_start: p.self_confidence_start,
    };
  }

  function renderPersonaPills() {
    els.personaPills.forEach((btn) => {
      const persona = findPersona(btn.dataset.personaId);
      if (persona) {
        btn.textContent = persona.short_label;
        btn.title = persona.full_label;
      }
      btn.setAttribute('aria-pressed', String(btn.dataset.personaId === state.activePersonaId));
    });
  }

  async function loadPersonas() {
    try {
      const data = await api.getDemoPersonas();
      if (Array.isArray(data)) {
        state.personas = data;
        renderPersonaPills();
      }
    } catch (err) {
      console.info('[Finance Quest] GET /api/demo-personas niedostępne (' + err.message + ').');
    }
    return state.personas;
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    document.body.setAttribute('aria-busy', String(isBusy));
    els.personaPills.forEach((btn) => {
      btn.disabled = isBusy;
      btn.classList.toggle('animate-pulse', isBusy && btn.getAttribute('aria-pressed') === 'true');
    });
    const cta = els.ctaOnboarding;
    if (!cta) return;
    cta.disabled = isBusy;
    const label = cta.querySelector('[data-label]');
    if (label) {
      if (!label.dataset.idleText) label.dataset.idleText = label.textContent;
      label.textContent = isBusy ? 'Filtruję zbędną teorię...' : label.dataset.idleText;
    }
    const spinner = cta.querySelector('.fq-spinner');
    const idleIcon = cta.querySelector('[data-idle-icon]');
    if (spinner) spinner.hidden = !isBusy;
    // Ikona Lucide jest <svg> — SVGElement nie ma właściwości .hidden, więc atrybut.
    if (idleIcon) idleIcon.toggleAttribute('hidden', isBusy);
  }

  function applyOnboardingResponse(data) {
    state.session = data;
    state.turn = data.initial_mission_turn;
    state.microLessonBonusXp = 0;
    state.completedLessons = new Set();
    state.timeMachine = { year: null, point: null };
    resetHeaderBaseline();
    resetMission();
    renderMission({ animate: false });
  }

  // Wynik tury misji — nagłówek animuje wzrost XP i Gotowości, Ekran 3 pokazuje kolejny krok.
  function applyMissionTurn(turn) {
    state.turn = turn;
    renderHeader();
    renderMission();
    if (turn.mission_completed) renderSummary({ animate: false });
  }

  function addMicroLessonBonusXp(xp) {
    const next = clamp(state.microLessonBonusXp + (Number(xp) || 0), 0, MICRO_LESSON_BONUS_CAP);
    if (next === state.microLessonBonusXp) return;
    state.microLessonBonusXp = next;
    renderHeader();
  }

  async function analyzeProfile(profile) {
    if (state.busy) return null;
    state.lastProfile = profile;
    setBusy(true);
    try {
      const results = await Promise.all([api.analyze(profile), wait(ANALYZE_MIN_ANIMATION_MS)]);
      const data = results[0];
      applyOnboardingResponse(data);
      renderFilterScreen(data);
      showScreen(SCREENS.FILTER);
      updateTimeMachine(data.default_horizon_years, { animate: false });
      animateCounters(els.cardSplit);
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const fieldErrors = mapValidationErrors(err.data);
        if (Object.keys(fieldErrors).length) {
          if (state.currentScreen !== SCREENS.ONBOARDING) showScreen(SCREENS.ONBOARDING);
          showFieldErrors(fieldErrors);
          showToast('Popraw zaznaczone pola ankiety.', 'warn');
          return null;
        }
      }
      showToast(describeApiError(err), 'warn');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function selectPersona(personaId) {
    if (state.busy) return;
    let persona = findPersona(personaId);
    if (!persona) {
      await loadPersonas();
      persona = findPersona(personaId);
    }
    if (!persona) {
      showToast('Nie udało się pobrać profili demo. Uruchom backend: uvicorn backend.main:app --port 8000', 'warn');
      return;
    }
    state.activePersonaId = personaId;
    renderPersonaPills();
    const profile = profileFromPersona(persona);
    fillOnboardingForm(profile);
    await analyzeProfile(profile);
  }

  async function submitOnboarding() {
    if (state.busy) return;
    const profile = readOnboardingForm();
    if (!profile) {
      showToast('Uzupełnij zaznaczone pytania ankiety.', 'warn');
      return;
    }
    await analyzeProfile(profile);
  }

  // ------------------------------------------------------------------------
  // 9. Ekran 2 — mapa 14 dni, filtr Speakly, mikro-lekcje, podział, Wehikuł Czasu
  // ------------------------------------------------------------------------

  function renderFilterScreen(data) {
    renderPlanIntro(data);
    renderRoadmap(data.roadmap_milestones, data.current_day, data.total_program_days);
    renderSpeakly(data.speakly_filter, data.micro_lessons);
    renderSplit(data.safe_investment);
    setupTimeMachine(data);
    refreshIcons();
  }

  function chip(icon, text, tone) {
    const tones = {
      dark: 'bg-brand-dark text-white',
      light: 'bg-white text-brand-dark border border-slate-200',
    };
    return '<span class="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold sm:text-sm ' +
      (tones[tone] || tones.light) + '"><i data-lucide="' + icon + '" class="h-4 w-4" aria-hidden="true"></i>' +
      escapeHtml(text) + '</span>';
  }

  function renderPlanIntro(data) {
    els.planIntro.innerHTML = [
      chip('user', data.persona_label, 'dark'),
      chip('calendar-clock', 'Horyzont: ' + yearsLabel(data.default_horizon_years)),
      chip('heart-handshake', 'Obawa: ' + (CONCERN_LABELS[data.main_concern] || data.main_concern)),
    ].join('');
  }

  // Karta A — oś 4 kamieni milowych (Dzień 1 aktywny, 4/9/14 zablokowane).
  function renderRoadmap(milestones, currentDay, totalDays) {
    const total = totalDays || 14;
    const today = currentDay || 1;
    const milestoneDays = new Set((milestones || []).map((m) => m.day));

    const track = Array.from({ length: total }, (_, i) => {
      const day = i + 1;
      const cls = day <= today ? 'bg-brand-yellow' : milestoneDays.has(day) ? 'bg-slate-400' : 'bg-slate-200';
      return '<span class="h-2 flex-1 rounded-full ' + cls + '"></span>';
    }).join('');

    const cards = (milestones || []).map((m) => {
      const active = m.status === 'active';
      const badge = active
        ? '<span class="whitespace-nowrap rounded-full bg-brand-yellow px-2 py-0.5 text-[11px] font-extrabold text-brand-dark">Aktywny — Dziś</span>'
        : '<span class="inline-flex items-center gap-1 text-xs font-bold text-slate-400"><span aria-hidden="true">🔒</span><span class="sr-only">Zablokowany</span></span>';
      return (
        '<li class="rounded-2xl p-4 ' + (active ? 'border-2 border-brand-yellow bg-brand-yellow/10' : 'border border-slate-200 bg-slate-50') + '">' +
          '<div class="flex flex-wrap items-center justify-between gap-1.5">' +
            '<span class="whitespace-nowrap text-xs font-extrabold uppercase tracking-wider ' + (active ? 'text-brand-dark' : 'text-slate-500') + '">Dzień ' + escapeHtml(m.day) + '</span>' +
            badge +
          '</div>' +
          '<p class="mt-2 font-extrabold leading-snug ' + (active ? 'text-brand-dark' : 'text-slate-600') + '">' + escapeHtml(m.title) + '</p>' +
          '<p class="mt-1 text-xs leading-snug ' + (active ? 'text-slate-700' : 'text-slate-500') + '">' + escapeHtml(m.focus) + '</p>' +
        '</li>'
      );
    }).join('');

    els.cardRoadmap.innerHTML =
      '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
        '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">Mapa 14 dni</h3>' +
        '<span class="text-xs font-bold text-slate-500">Dzień ' + today + ' z ' + total + ' • 5–10 min dziennie</span>' +
      '</div>' +
      '<div class="mt-3 flex items-center gap-1" aria-hidden="true">' + track + '</div>' +
      '<ol class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">' + cards + '</ol>';
  }

  function renderLessonCard(lesson, done) {
    const action = done
      ? '<p class="mt-3 inline-flex min-h-tap items-center gap-2 text-sm font-extrabold text-emerald-700">' +
          '<i data-lucide="circle-check" class="h-5 w-5" aria-hidden="true"></i>Zaliczone • +' + escapeHtml(lesson.xp_reward) + ' XP</p>'
      : '<button type="button" data-action="complete-lesson" data-lesson-id="' + escapeHtml(lesson.id) + '" ' +
          'class="mt-3 inline-flex min-h-tap items-center gap-2 rounded-xl border-2 border-brand-dark/10 bg-white px-4 text-sm font-extrabold transition hover:border-brand-yellow hover:bg-brand-yellow/10">' +
          'Rozumiem! (+' + escapeHtml(lesson.xp_reward) + ' XP)</button>';
    return (
      '<article data-lesson-card="' + escapeHtml(lesson.id) + '" tabindex="-1" class="rounded-2xl border p-4 transition ' +
        (done ? 'border-etf-green/50 bg-etf-green/5' : 'border-slate-200 bg-white') + '">' +
        '<div class="flex items-start justify-between gap-3">' +
          '<h5 class="font-extrabold leading-snug">' + escapeHtml(lesson.title) + '</h5>' +
          '<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">' +
            '<i data-lucide="timer" class="h-3 w-3" aria-hidden="true"></i>' + escapeHtml(lesson.duration_sec) + ' sek.</span>' +
        '</div>' +
        '<p class="mt-1.5 text-sm leading-relaxed text-slate-600">' + escapeHtml(lesson.summary) + '</p>' +
        '<p class="mt-2 flex items-start gap-1.5 text-sm font-bold">' +
          '<i data-lucide="lightbulb" class="mt-0.5 h-4 w-4 shrink-0 text-brand-yellow-dark" aria-hidden="true"></i>' +
          escapeHtml(lesson.key_takeaway) + '</p>' +
        action +
      '</article>'
    );
  }

  // Karta B — badge „Pominęliśmy {n} tematów", 3 mikro-lekcje, priorytety i .topic-strike.
  function renderSpeakly(filter, lessons) {
    const removed = (filter && filter.removed_topics) || [];
    const kept = (filter && filter.kept_topics) || [];
    const n = removed.length;
    const maxBonus = Math.min(MICRO_LESSON_BONUS_CAP, (lessons || []).reduce((sum, l) => sum + (l.xp_reward || 0), 0));

    const lessonCards = (lessons || [])
      .map((lesson) => renderLessonCard(lesson, state.completedLessons.has(lesson.id)))
      .join('');

    const keptList = kept.map((topic) =>
      '<li class="flex items-start gap-2 text-sm font-semibold">' +
        '<span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-etf-green text-[11px] font-extrabold text-white" aria-hidden="true">✓</span>' +
        escapeHtml(topic) + '</li>'
    ).join('');

    const removedList = removed.map((topic, i) =>
      '<li class="text-sm text-slate-600"><span class="topic-strike" style="--i: ' + i + '">' + escapeHtml(topic) + '</span></li>'
    ).join('');

    els.cardSpeakly.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
        '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">Filtr Speakly i mikro-lekcje Dnia 1</h3>' +
        '<span class="inline-flex items-center gap-1.5 rounded-full bg-etf-green/10 px-3 py-1.5 text-xs font-extrabold text-emerald-700 sm:text-sm">' +
          '⚡ Pominęliśmy ' + n + ' ' + pluralPL(n, 'temat', 'tematy', 'tematów') + ', których nie potrzebujesz na start</span>' +
      '</div>' +
      '<div class="mt-5 grid grid-cols-1 gap-6 md:grid-cols-5">' +
        '<div class="md:col-span-3">' +
          '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
            '<h4 class="font-extrabold">Mikro-lekcje Dnia 1</h4>' +
            '<span class="text-xs text-slate-500">opcjonalnie • maks. +' + maxBonus + ' XP</span>' +
          '</div>' +
          '<div class="mt-3 space-y-3">' + lessonCards + '</div>' +
        '</div>' +
        '<div class="md:col-span-2">' +
          '<h4 class="font-extrabold">Twoje 3 priorytety na dziś</h4>' +
          '<ul class="mt-3 space-y-2">' + keptList + '</ul>' +
          '<h4 class="mt-6 font-extrabold text-slate-500">Nie musisz tego robić na starcie</h4>' +
          '<ul class="mt-3 space-y-2">' + removedList + '</ul>' +
        '</div>' +
      '</div>';
  }

  function completeLesson(lessonId) {
    if (!state.session || state.completedLessons.has(lessonId)) return;
    const lesson = (state.session.micro_lessons || []).find((l) => l.id === lessonId);
    if (!lesson) return;
    state.completedLessons.add(lessonId);
    const card = Array.from(els.cardSpeakly.querySelectorAll('[data-lesson-card]')).find((el) => el.dataset.lessonCard === lessonId);
    if (card) {
      card.outerHTML = renderLessonCard(lesson, true);
      refreshIcons();
      const fresh = Array.from(els.cardSpeakly.querySelectorAll('[data-lesson-card]')).find((el) => el.dataset.lessonCard === lessonId);
      if (fresh) fresh.focus({ preventScroll: true });
    }
    addMicroLessonBonusXp(lesson.xp_reward);
  }

  // Karta C — przykładowy podział wolnych środków wg plan_type (split / invest / savings_first).
  function renderSplit(advice) {
    const a = advice || {};
    const amount = (value, extraClass) =>
      '<span class="tabular-nums ' + (extraClass || '') + '" data-count="' + Number(value || 0) + '">0</span>';
    const label = '<p class="text-xs font-bold uppercase tracking-wider text-slate-500">Przykładowa kwota docelowa (miesięcznie)</p>';
    let body = '';

    if (a.plan_type === 'split') {
      const total = Math.max(1, (a.emergency_savings_monthly || 0) + (a.training_etf_monthly || 0));
      const cushionPct = Math.round(((a.emergency_savings_monthly || 0) / total) * 100);
      body =
        label +
        '<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">' +
          '<div class="rounded-2xl bg-brand-dark p-4 text-white">' +
            '<p class="flex items-center gap-1.5 text-xs font-bold text-white/70"><i data-lucide="shield" class="h-4 w-4" aria-hidden="true"></i>Poduszka</p>' +
            '<p class="mt-1 text-2xl font-extrabold sm:text-3xl">' + amount(a.emergency_savings_monthly) + NBSP + 'zł/mies.</p>' +
          '</div>' +
          '<div class="rounded-2xl border border-etf-green/30 bg-etf-green/10 p-4">' +
            '<p class="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><i data-lucide="sprout" class="h-4 w-4" aria-hidden="true"></i>Trening w szeroki ETF</p>' +
            '<p class="mt-1 text-2xl font-extrabold sm:text-3xl">' + amount(a.training_etf_monthly) + NBSP + 'zł/mies.</p>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden="true">' +
          '<div class="bg-brand-dark" style="width: ' + cushionPct + '%"></div>' +
          '<div class="bg-etf-green" style="width: ' + (100 - cushionPct) + '%"></div>' +
        '</div>' +
        '<p class="mt-1.5 text-xs font-semibold text-slate-500">ok. ' + cushionPct + '% na poduszkę • ok. ' + (100 - cushionPct) + '% na trening w szeroki ETF</p>';
    } else if (a.plan_type === 'invest') {
      body =
        label +
        '<p class="mt-2 text-3xl font-extrabold sm:text-4xl">' + amount(a.min_monthly) + ' – ' + amount(a.max_monthly) + NBSP + 'zł / mies.</p>' +
        '<p class="mt-1 text-sm text-slate-600">W symulacji poniżej: <strong class="tabular-nums text-brand-dark">' +
          formatPLN(a.recommended_monthly) + '/mies.</strong> w szerokim ETF.</p>';
    } else {
      // savings_first — najpierw poduszka; ETF tylko jako przykład (illustrative_only).
      body =
        label +
        '<div class="mt-3 rounded-2xl bg-brand-dark p-4 text-white">' +
          '<p class="flex items-center gap-1.5 text-xs font-bold text-white/70"><i data-lucide="shield" class="h-4 w-4" aria-hidden="true"></i>Poduszka</p>' +
          '<p class="mt-1 text-2xl font-extrabold sm:text-3xl">' + amount(a.emergency_savings_monthly) + NBSP + 'zł/mies.</p>' +
        '</div>' +
        '<span class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">' +
          '<i data-lucide="clock" class="h-3.5 w-3.5" aria-hidden="true"></i>ETF później — poniżej przykład na ' +
          escapeHtml(formatNumber(a.recommended_monthly)) + NBSP + 'zł/mies.</span>';
    }

    els.cardSplit.innerHTML =
      '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">Przykładowy podział wolnych środków</h3>' +
      '<div class="mt-4">' + body + '</div>' +
      '<p class="mt-4 text-sm leading-relaxed text-slate-600">' + escapeHtml(a.reasoning) + '</p>';
  }

  // Karta D — Wehikuł Czasu: suwak 1–20 lat, 3 KPI w dzisiejszych zł, wykres z punktem Rok 0.
  function setupTimeMachine(data) {
    els.tmYears.value = String(data.default_horizon_years);
    els.tmMonthly.textContent = formatPLN(data.safe_investment.recommended_monthly) + '/mies.';
    els.tmAssumptions.textContent = data.assumptions ? data.assumptions.text : '';
    els.tmCompliance.textContent = COMPLIANCE_TEXT;
    els.kpiWinSource.textContent = WIN_RATE_SOURCE_NOTE;
  }

  function updateTimeMachine(year, options) {
    if (!state.session) return;
    const series = state.session.projection_series || [];
    if (!series.length) return;
    const y = clamp(Math.round(Number(year) || 1), 1, series.length);
    const point = series[y - 1];
    const prev = state.timeMachine.point;
    const animate = !options || options.animate !== false;

    els.tmYears.value = String(y);
    els.tmYearsOut.textContent = yearsLabel(y);
    setRangeFill(els.tmYears);

    const setKpi = (el, key) => {
      if (animate && prev) animateNumber(el, prev[key], point[key], { duration: 450 });
      else setNumber(el, point[key]);
    };
    setKpi(els.kpiCash, 'cash_real_value');
    setKpi(els.kpiEtf, 'etf_real_value');
    els.kpiPaid.textContent = formatNumber(point.total_paid);
    els.kpiEtfNominal.textContent = formatNumber(point.etf_nominal_value);

    const win = Math.min(WIN_RATE_DISPLAY_CAP, point.historical_win_rate);
    els.kpiWin.textContent = win + '%';
    els.kpiWinBar.style.width = win + '%';

    state.timeMachine = { year: y, point };
    renderTimeMachineChart(series, y);
  }

  // Przed projection_series.slice(0, year) zawsze punkt „Rok 0" (0, 0, 0) — docs/01 §7 Ekran 2.
  function timeMachineChartData(series, year) {
    const points = series.slice(0, year);
    return {
      labels: ['Rok 0'].concat(points.map((p) => 'Rok ' + p.year)),
      etf: [0].concat(points.map((p) => p.etf_real_value)),
      cash: [0].concat(points.map((p) => p.cash_real_value)),
      stress: [0].concat(points.map((p) => p.etf_stress_real_value)),
    };
  }

  function compactPLN(value) {
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + NBSP + 'tys.';
    }
    return formatNumber(value);
  }

  function renderTimeMachineChart(series, year) {
    if (!window.Chart || !els.tmChart) return;
    const d = timeMachineChartData(series, year);

    if (timeMachineChart) {
      timeMachineChart.data.labels = d.labels;
      timeMachineChart.data.datasets[0].data = d.etf;
      timeMachineChart.data.datasets[1].data = d.cash;
      timeMachineChart.data.datasets[2].data = d.stress;
      timeMachineChart.update();
      return;
    }

    const etfFill = (context) => {
      const chart = context.chart;
      const area = chart.chartArea;
      if (!area) return 'rgba(16, 185, 129, 0.15)';
      const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.30)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
      return gradient;
    };

    timeMachineChart = new window.Chart(els.tmChart, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          {
            label: 'Szeroki ETF (realnie)',
            data: d.etf,
            borderColor: COLORS.etfGreen,
            backgroundColor: etfFill,
            fill: 'origin',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            order: 2,
          },
          {
            label: 'Wpłaty na koncie 0% (realnie)',
            data: d.cash,
            borderColor: COLORS.inflationRed,
            borderDash: [7, 5],
            borderWidth: 2.5,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            order: 1,
          },
          {
            label: 'Scenariusz wahania -20% w roku 3 (edukacyjny)',
            data: d.stress,
            borderColor: COLORS.stressAmber,
            borderDash: [2, 4],
            borderWidth: 2.5,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: COLORS.brandDark,
            padding: 10,
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPLN(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { autoSkip: true, maxTicksLimit: 11, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            border: { display: false },
            title: { display: true, text: 'zł (w dzisiejszych złotych)', font: { size: 11, weight: '600' } },
            ticks: { callback: (value) => compactPLN(value) },
          },
        },
      },
    });
  }

  // ------------------------------------------------------------------------
  // 10. Ekran 3 — symulacja wyborów z Luną (docs/01 §7 Ekran 3, docs/02 §4)
  // ------------------------------------------------------------------------

  function resetMission() {
    const m = state.mission;
    m.token += 1;
    m.log = [];
    m.lastAnswer = null;
    m.renderedValue = 0;
    if (els.msInput) els.msInput.value = '';
    syncMissionCounter();
    setMissionBusy(false);
    state.summary = freshSummary();
  }

  function renderMission(options) {
    const t = state.turn;
    if (!t || !els.msLunaMessage) return;
    const animate = !options || options.animate !== false;
    const s = state.session;
    const completed = t.mission_completed === true;
    const total = t.total_steps || 3;
    const step = clamp(t.step_number || 1, 1, total);

    // Mini-panel: Dzień X z 14 • Symulacja wyborów • Krok N z 3
    els.msDay.textContent = s ? s.current_day : 1;
    els.msTotalDays.textContent = s ? s.total_program_days : 14;
    els.msStep.textContent = step;
    els.msTotalSteps.textContent = total;
    Array.from(els.msSteps.children).forEach((bar, i) => {
      const n = i + 1;
      bar.dataset.state = completed || n < step ? 'done' : n === step ? 'current' : 'todo';
    });
    const portfolio = t.portfolio_status || { simulated_value: 0, event_badge: '' };
    els.msBadgeText.textContent = portfolio.event_badge || '';
    const value = Number(portfolio.simulated_value) || 0;
    if (animate && value !== state.mission.renderedValue) {
      animateNumber(els.msValue, state.mission.renderedValue, value, { duration: 900 });
    } else {
      setNumber(els.msValue, value);
    }
    state.mission.renderedValue = value;

    renderMissionFeedback(t, animate);
    els.msLunaMessage.textContent = t.luna_message || '';
    if (animate) replayClass(els.msLuna, 'screen-enter');

    // Po Kroku 3 znikają karty i pole tekstowe, pojawia się CTA na Ekran 4.
    renderQuickReplies(completed ? [] : t.quick_replies || []);
    els.msInteraction.hidden = completed;
    els.ctaFinishDay.hidden = !completed;
    refreshIcons();
  }

  function shortAnswer(text) {
    const value = String(text || '');
    return value.length > ANSWER_PREVIEW_MAX ? value.slice(0, ANSWER_PREVIEW_MAX - 1).trimEnd() + '…' : value;
  }

  // Karta feedbacku: zielona przy is_optimal_choice === true, ciepły bursztyn przy false.
  function renderMissionFeedback(t, animate) {
    const visible = t.is_optimal_choice != null && !!t.understanding_feedback;
    els.msFeedback.hidden = !visible;
    if (!visible) return;
    const good = t.is_optimal_choice === true;
    const g = t.gamification || DEFAULT_GAMIFICATION;
    els.msFeedback.dataset.tone = good ? 'good' : 'warm';
    els.msFeedbackTitle.textContent = good ? 'Trafna decyzja' : 'Wskazówka od Luny';
    const answer = state.mission.lastAnswer;
    els.msFeedbackAnswer.hidden = !answer;
    els.msFeedbackAnswer.textContent = answer ? 'Twoja odpowiedź: „' + shortAnswer(answer) + '”' : '';
    els.msFeedbackText.textContent = t.understanding_feedback;
    els.msFeedbackXp.textContent = '+' + (g.xp_gained || 0) + NBSP + 'XP';
    const delta = Number(t.confidence_delta) || 0;
    els.msFeedbackReadiness.hidden = delta <= 0;
    els.msFeedbackReadiness.textContent = 'Gotowość +' + delta + NBSP + 'pkt';
    els.msFeedbackLevel.hidden = !g.leveled_up;
    els.msFeedbackLevel.textContent = '🏆 Awans: Poziom ' + g.level + ' ' + g.level_title;
    if (animate) replayClass(els.msFeedback, 'screen-enter');
  }

  function renderQuickReplies(replies) {
    els.msReplies.innerHTML = replies.map((reply, i) =>
      '<button type="button" class="fq-reply" data-action="quick-reply" data-reply-id="' + escapeHtml(reply.id) + '">' +
        '<span class="fq-reply-key" aria-hidden="true">' + (REPLY_KEYS[i] || i + 1) + '</span>' +
        '<span class="min-w-0">' + escapeHtml(reply.text) + '</span>' +
        '<i data-lucide="chevron-right" class="h-5 w-5" aria-hidden="true"></i>' +
      '</button>'
    ).join('');
  }

  function syncMissionCounter() {
    if (els.msCount && els.msInput) els.msCount.textContent = String(els.msInput.value.length);
  }

  // Blokada kontrolek na czas żądania (zero dubli). Kropki „Luna analizuje…" tylko dla wolnego tekstu.
  function setMissionBusy(isBusy, options) {
    const opts = options || {};
    state.mission.busy = isBusy;
    if (!els.msInteraction) return;
    els.msInteraction.setAttribute('aria-busy', String(isBusy));
    els.msReplies.querySelectorAll('[data-action="quick-reply"]').forEach((btn) => {
      btn.disabled = isBusy;
      if (isBusy && btn.dataset.replyId === opts.selectedId) btn.setAttribute('data-selected', '');
      else btn.removeAttribute('data-selected');
    });
    els.msInput.disabled = isBusy;
    els.msSend.disabled = isBusy;

    const thinking = isBusy && opts.freeText === true;
    els.msThinking.hidden = !thinking;
    els.msLunaMessage.classList.toggle('fq-dim', thinking);
    const label = els.msSend.querySelector('[data-label]');
    if (label) label.textContent = thinking ? 'Wysyłam...' : 'Wyślij';
    const spinner = els.msSend.querySelector('.fq-spinner');
    const idleIcon = els.msSend.querySelector('[data-idle-icon]');
    if (spinner) spinner.hidden = !thinking;
    if (idleIcon) idleIcon.toggleAttribute('hidden', thinking);
    if (thinking) revealElement(els.msThinking, 'nearest');
  }

  // Przewija do elementu tylko wtedy, gdy nie widać jego początku.
  function revealElement(el, block) {
    if (!el || el.hidden) return;
    const rect = el.getBoundingClientRect();
    const visible = rect.top >= 80 && rect.top <= window.innerHeight * 0.6;
    if (visible) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: block || 'start' });
  }

  // Po odpowiedzi: mini-panel (rosnąca kwota) razem z feedbackiem, jeśli oba mieszczą się na ekranie;
  // inaczej sam feedback (na telefonie / małym rzutniku).
  function revealMissionResult() {
    const target = els.msFeedback.hidden ? els.msLuna : els.msFeedback;
    const panelTop = els.msPanel.getBoundingClientRect().top;
    const targetBottom = target.getBoundingClientRect().bottom;
    const fitsWithPanel = targetBottom - panelTop + 96 <= window.innerHeight;
    revealElement(fitsWithPanel ? els.msPanel : target);
  }

  function describeMissionError(err) {
    if (err instanceof ApiError && err.status === 422) return 'Odpowiedź musi mieć od 1 do ' + MISSION_MESSAGE_MAX + ' znaków.';
    if (isSessionMissing(err)) return 'Nie udało się odtworzyć sesji. Wróć do ankiety i spróbuj ponownie.';
    return describeApiError(err);
  }

  // Klik karty: {session_id, user_message: text, quick_reply_id: id} — ocena po stronie serwera bez LLM.
  // Wolny tekst: {session_id, user_message} — BEZ pola quick_reply_id (ocenia LLM lub fallback).
  async function sendMissionAnswer(answer) {
    const m = state.mission;
    const current = state.turn;
    if (m.busy || !state.session || !current || current.mission_completed) return false;
    const text = String((answer && answer.text) || '').trim().slice(0, MISSION_MESSAGE_MAX);
    if (!text) return false;
    const quickReplyId = (answer && answer.quickReplyId) || null;
    const payload = { user_message: text };
    if (quickReplyId) payload.quick_reply_id = quickReplyId;

    const token = m.token;
    setMissionBusy(true, { freeText: !quickReplyId, selectedId: quickReplyId });
    try {
      const turn = await withSessionRecovery((sessionId) =>
        api.missionTurn(Object.assign({ session_id: sessionId }, payload))
      );
      if (token !== m.token) return false; // w międzyczasie nowa analiza — odpowiedź starej sesji
      m.log.push(payload);
      m.lastAnswer = text;
      if (!quickReplyId) {
        els.msInput.value = '';
        syncMissionCounter();
      }
      setMissionBusy(false);
      applyMissionTurn(turn);
      if (turn.trigger_confetti === true) fireConfetti('micro');
      revealMissionResult();
      if (turn.mission_completed) els.ctaFinishDay.focus({ preventScroll: true });
      return true;
    } catch (err) {
      if (token === m.token) {
        setMissionBusy(false);
        showToast(describeMissionError(err), 'warn');
      }
      return false;
    }
  }

  function answerWithQuickReply(replyId) {
    const replies = (state.turn && state.turn.quick_replies) || [];
    const reply = replies.find((r) => r.id === replyId);
    if (!reply) return;
    sendMissionAnswer({ text: reply.text, quickReplyId: reply.id });
  }

  function submitFreeText() {
    if (state.mission.busy) return;
    const text = els.msInput.value.trim();
    if (!text) {
      els.msInput.focus();
      showToast('Napisz kilka słów albo wybierz jedną z kart.', 'info', 2400);
      return;
    }
    sendMissionAnswer({ text });
  }

  // ------------------------------------------------------------------------
  // 11. Ekran 4 — ukończenie Dnia 1, wyzwanie, checklista, plan, ranking (docs/01 §7 Ekran 4)
  // ------------------------------------------------------------------------

  const CARD_CLASS = 'rounded-3xl border border-slate-100 bg-card-bg p-5 shadow-xl shadow-slate-200/60 sm:p-6';
  // „Przetestuj inne pokolenie (Demo)": 22 l. -> 56 l. (Golden Path), 56 l. -> 38 l., 38 l. -> 22 l.
  const NEXT_GENERATION = Object.freeze({ '20+': 'senior_56', '50+': 'mid_38', '30-50': 'young_20' });

  function freshSummary() {
    return {
      challengeBusy: false,
      challengeAccepted: false,
      challengeReward: 0,
      leveledViaChallenge: false, // próg 100 XP przekroczony dopiero dzięki wyzwaniu (+50 XP)
      leaderboard: null,          // ranking z POST /api/challenge/accept (nadpisuje ten z tury)
      checked: new Set(),
      celebrated: false,
      selfAfter: null,
      bankOption: 'a',
      bankDone: false,
    };
  }

  // Poziomy wg docs/02 §3G (używane po wyzwaniu, które zwraca samo xp).
  function levelForXp(xp) {
    return xp >= LEVEL_FLOOR_XP[2]
      ? { level: 2, level_title: 'Świadomy Start', next_level_xp: 250 }
      : { level: 1, level_title: 'Obserwator', next_level_xp: 100 };
  }

  function summaryTurn() {
    const t = state.turn;
    return t && t.mission_completed ? t : null;
  }

  // Awans: z tury finałowej (gamification.leveled_up) albo dzięki +50 XP z wyzwania.
  function userLeveledUp(t) {
    return !!(t && t.gamification && t.gamification.leveled_up) || state.summary.leveledViaChallenge;
  }

  function renderSummary(options) {
    const t = summaryTurn();
    if (!t || !els.cardLevelup) return;
    const animate = !!(options && options.animate);
    renderLevelBanner(t, { pop: animate });
    renderChallengeCard(t);
    renderChecklistCard(t);
    renderBankCard(t);
    renderLeaderboardCard(t);
    els.complianceFooter.innerHTML =
      '<p class="rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs leading-relaxed text-slate-500">' +
        '<i data-lucide="scale" class="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true"></i>' +
        escapeHtml(COMPLIANCE_TEXT) + '</p>';
    refreshIcons();
  }

  // Baner (pełna szerokość): awans albo „brakuje X XP", Gotowość start -> wynik, samoocena „po".
  function renderLevelBanner(t, options) {
    const pop = !!(options && options.pop);
    const g = t.gamification;
    const s = state.session;
    const leveled = userLeveledUp(t);
    const dayLabel = 'DZIEŃ ' + (s ? s.current_day : 1) + ' Z ' + (s ? s.total_program_days : 14);
    const title = leveled
      ? '🏆 ' + dayLabel + ' UKOŃCZONY! AWANS: ' + g.level_title
      : dayLabel + ' UKOŃCZONY';
    const start = clamp(Number(t.confidence_start) || 0, 0, 100);
    const score = clamp(Number(t.confidence_score) || 0, start, 100);
    const missing = Math.max(0, LEVEL_FLOOR_XP[2] - g.xp);
    const bonus = state.microLessonBonusXp;
    const pill = (text, extra) =>
      '<span class="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold sm:text-sm ' +
        (extra || 'bg-white/10 text-white') + '">' + text + '</span>';

    els.cardLevelup.innerHTML =
      '<div data-summary-banner class="' + (pop ? 'level-pop ' : '') + 'rounded-3xl bg-brand-dark p-5 text-white shadow-xl shadow-slate-200/60 sm:p-7">' +
        '<h3 class="text-xl font-extrabold leading-tight tracking-tight text-brand-yellow sm:text-2xl">' + escapeHtml(title) + '</h3>' +
        '<div class="mt-3 flex flex-wrap items-center gap-2">' +
          pill('Poziom ' + escapeHtml(g.level), 'bg-brand-yellow text-brand-dark') +
          pill('<span class="tabular-nums">' + formatNumber(g.xp) + NBSP + 'XP</span>') +
          (bonus > 0 ? pill('<span class="tabular-nums">+' + bonus + NBSP + 'XP z mikro-lekcji</span>', 'bg-white/5 text-white/70') : '') +
          pill('🔥 Seria: ' + escapeHtml(g.streak_days) + NBSP + pluralDays(g.streak_days), 'bg-streak-orange/20 text-orange-200') +
        '</div>' +
        (leveled
          ? ''
          : '<p class="mt-3 font-semibold text-white/85">Do Poziomu 2 brakuje <span class="tabular-nums">' + missing + NBSP + 'XP</span> — wróć jutro i nadrób!</p>') +
        '<p class="mt-2 text-sm font-bold text-orange-200">🔥 Seria rozpoczęta! Wróć jutro po Dzień 2.</p>' +
        '<div class="mt-5 grid grid-cols-1 gap-5 border-t border-white/10 pt-5 md:grid-cols-2 md:gap-8">' +
          '<div>' +
            '<p class="text-sm font-bold text-white/70">Gotowość</p>' +
            '<p class="mt-0.5 text-2xl font-extrabold tabular-nums">' + start + '% <span class="text-brand-yellow" aria-hidden="true">→</span>' +
              '<span class="sr-only">do</span> ' + score + '%</p>' +
            '<div class="relative mt-2 h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Gotowość" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + score + '">' +
              '<div data-readiness-fill data-target="' + score + '" class="fq-progress-fill absolute inset-y-0 left-0 rounded-full bg-etf-green" style="width: ' + (pop ? start : score) + '%"></div>' +
              '<div class="absolute inset-y-0 left-0 rounded-full bg-white/60" style="width: ' + start + '%"></div>' +
            '</div>' +
            '<p class="mt-2 text-xs text-white/60">Pełną gotowość da dopiero Dzień 14.</p>' +
          '</div>' +
          renderSelfAssessment() +
        '</div>' +
      '</div>';

    if (pop) {
      const fill = els.cardLevelup.querySelector('[data-readiness-fill]');
      // Dwie klatki: przeglądarka najpierw rysuje szerokość startową, potem animuje do wyniku.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (fill) fill.style.width = fill.dataset.target + '%';
      }));
    }
  }

  // Samoocena „po" (1–5) — tylko frontend; w produkcie metryka dla banku (docs/01 §4).
  function renderSelfAssessment() {
    const after = state.summary.selfAfter;
    const tiles = [1, 2, 3, 4, 5].map((n) =>
      '<label class="block cursor-pointer"><input type="radio" name="self_confidence_after" value="' + n + '" class="sr-only"' +
        (after === n ? ' checked' : '') + '><span class="fq-tile fq-tile--center min-h-[48px] text-lg tabular-nums">' + n + '</span></label>'
    ).join('');
    return (
      '<fieldset class="fq-field">' +
        '<legend class="text-sm font-bold text-white/70">Jak pewnie czujesz się teraz? (1–5)</legend>' +
        '<div class="mt-2 grid grid-cols-5 gap-2">' + tiles + '</div>' +
        '<p data-self-compare class="mt-2 text-sm font-bold" aria-live="polite">' + selfCompareHtml() + '</p>' +
      '</fieldset>'
    );
  }

  function selfCompareHtml() {
    const before = state.lastProfile ? state.lastProfile.self_confidence_start : null;
    const after = state.summary.selfAfter;
    if (after == null) {
      return before != null
        ? '<span class="text-white/60">Przed: ' + before + '/5 — zaznacz, jak jest teraz.</span>'
        : '<span class="text-white/60">Zaznacz, jak jest teraz.</span>';
    }
    const delta = before != null ? after - before : 0;
    const deltaPill = before != null && delta > 0
      ? ' <span class="ml-1 rounded-full bg-etf-green px-2 py-0.5 text-xs text-white">+' + delta + '</span>'
      : '';
    return (before != null ? 'Przed: ' + before + '/5 <span class="text-brand-yellow" aria-hidden="true">→</span><span class="sr-only">,</span> ' : '') +
      'Po: ' + after + '/5' + deltaPill;
  }

  function setSelfAfter(value) {
    const n = clamp(Math.round(Number(value) || 0), 1, 5);
    state.summary.selfAfter = n;
    const out = els.cardLevelup.querySelector('[data-self-compare]');
    if (out) out.innerHTML = selfCompareHtml();
  }

  // Karta 1 — realne mikro-wyzwanie (złota ramka).
  function renderChallengeCard(t) {
    const c = t.real_world_challenge;
    if (!c) {
      els.cardChallenge.innerHTML = '';
      return;
    }
    const s = state.summary;
    const action = s.challengeAccepted
      ? '<p class="mt-4 inline-flex min-h-tap items-center gap-2 rounded-2xl bg-etf-green px-4 py-2 font-extrabold text-white" role="status">' +
          '✅ Wyzwanie przyjęte!' + (s.challengeReward > 0 ? ' +' + s.challengeReward + NBSP + 'XP' : '') + '</p>'
      : '<button type="button" data-action="accept-challenge" class="btn-3d mt-4 w-full sm:w-auto"' + (s.challengeBusy ? ' disabled' : '') + '>' +
          (s.challengeBusy ? '<span class="fq-spinner"></span>' : '<i data-lucide="flame" class="h-5 w-5" aria-hidden="true"></i>') +
          '<span>Podejmuję wyzwanie (+' + escapeHtml(c.reward_xp) + NBSP + 'XP)</span></button>';
    els.cardChallenge.innerHTML =
      '<div class="rounded-3xl border-2 border-brand-yellow bg-gradient-to-br from-brand-yellow/20 via-white to-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">' +
        '<p class="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-yellow-dark">' +
          '<i data-lucide="target" class="h-4 w-4" aria-hidden="true"></i>Realne mikro-wyzwanie • Zero strachu</p>' +
        '<h3 class="mt-2 text-lg font-extrabold leading-snug tracking-tight sm:text-xl">' + escapeHtml(c.title) + '</h3>' +
        '<p class="mt-2 text-sm leading-relaxed text-slate-600">' + escapeHtml(c.description) + '</p>' +
        '<p class="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold shadow-sm">' +
          '<span class="tabular-nums">' + formatPLN(c.amount_pln) + '</span>' +
          '<i data-lucide="arrow-right" class="h-4 w-4 text-slate-400" aria-hidden="true"></i>' + escapeHtml(c.target_account) + '</p>' +
        '<div>' + action + '</div>' +
      '</div>';
  }

  async function acceptChallenge() {
    const s = state.summary;
    const t = summaryTurn();
    if (!t || !t.real_world_challenge || s.challengeAccepted || s.challengeBusy) return;
    const token = state.mission.token;
    s.challengeBusy = true;
    renderChallengeCard(t);
    refreshIcons();
    try {
      const res = await withSessionRecovery((sessionId) => api.acceptChallenge(sessionId));
      if (token !== state.mission.token) return;
      const g = t.gamification;
      const crossed = g.xp < LEVEL_FLOOR_XP[2] && res.xp >= LEVEL_FLOOR_XP[2];
      state.turn = Object.assign({}, t, {
        gamification: Object.assign({}, g, levelForXp(res.xp), { xp: res.xp, xp_gained: res.reward_xp }),
      });
      s.challengeBusy = false;
      s.challengeAccepted = true;
      s.challengeReward = res.reward_xp;
      s.leaderboard = Array.isArray(res.leaderboard) ? res.leaderboard : s.leaderboard;
      if (crossed) s.leveledViaChallenge = true;

      const turn = state.turn;
      renderHeader();
      renderLevelBanner(turn, { pop: crossed });
      renderChallengeCard(turn);
      renderLeaderboardCard(turn, { highlight: true });
      refreshIcons();
      fireConfetti('micro');
    } catch (err) {
      if (token !== state.mission.token) return;
      s.challengeBusy = false;
      renderChallengeCard(summaryTurn() || t);
      refreshIcons();
      showToast(describeMissionError(err), 'warn');
    }
  }

  // Karta 2 — checklista Dnia 1 (4 pozycje); komplet -> pełne konfetti i .glow-pulse na przycisku bankowym.
  function renderChecklistCard(t) {
    const items = t.final_checklist || [];
    const s = state.summary;
    const done = items.filter((item) => s.checked.has(item.id)).length;
    const list = items.map((item) => {
      const checked = s.checked.has(item.id);
      return (
        '<li><button type="button" role="checkbox" aria-checked="' + checked + '" data-action="toggle-check" data-check-id="' + escapeHtml(item.id) + '" class="fq-check">' +
          '<span class="fq-check-box" aria-hidden="true"><i data-lucide="check" class="h-4 w-4"></i></span>' +
          '<span class="min-w-0"><span class="block font-bold leading-snug">' + escapeHtml(item.text) + '</span>' +
          '<span class="mt-1 block text-sm leading-snug text-slate-600">' + escapeHtml(item.detail) + '</span></span>' +
        '</button></li>'
      );
    }).join('');
    els.cardChecklist.innerHTML =
      '<div class="' + CARD_CLASS + '">' +
        '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">Checklista Dnia 1</h3>' +
          '<span class="text-sm font-extrabold tabular-nums text-slate-500"><span data-check-count>' + done + '</span>/' + items.length + '</span>' +
        '</div>' +
        '<div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">' +
          '<div data-check-bar class="fq-progress-fill h-full rounded-full bg-etf-green" style="width: ' + (items.length ? (done / items.length) * 100 : 0) + '%"></div>' +
        '</div>' +
        '<ul class="mt-4 space-y-3">' + list + '</ul>' +
        '<p data-check-done class="mt-4 text-sm font-extrabold text-emerald-700" role="status"' + (items.length && done === items.length ? '' : ' hidden') + '>' +
          '🎉 Komplet! Teraz zrób pierwszy krok w banku.</p>' +
      '</div>';
  }

  function toggleChecklistItem(id, button) {
    const t = summaryTurn();
    if (!t) return;
    const items = t.final_checklist || [];
    if (!items.some((item) => item.id === id)) return;
    const s = state.summary;
    if (s.checked.has(id)) s.checked.delete(id);
    else s.checked.add(id);
    const checked = s.checked.has(id);
    if (button) {
      button.setAttribute('aria-checked', String(checked));
      replayClass(button, 'fq-bounce');
    }
    const done = items.filter((item) => s.checked.has(item.id)).length;
    const all = done === items.length && items.length > 0;
    const count = els.cardChecklist.querySelector('[data-check-count]');
    const bar = els.cardChecklist.querySelector('[data-check-bar]');
    const doneMsg = els.cardChecklist.querySelector('[data-check-done]');
    if (count) count.textContent = String(done);
    if (bar) bar.style.width = (done / items.length) * 100 + '%';
    if (doneMsg) doneMsg.hidden = !all;
    syncBankGlow();
    if (all && !s.celebrated) {
      s.celebrated = true;
      fireConfetti('full');
    }
  }

  function checklistComplete() {
    const t = summaryTurn();
    const items = (t && t.final_checklist) || [];
    return items.length > 0 && items.every((item) => state.summary.checked.has(item.id));
  }

  function syncBankGlow() {
    const btn = els.cardBank && els.cardBank.querySelector('[data-action="open-bank-modal"]');
    if (btn) btn.classList.toggle('glow-pulse', checklistComplete());
  }

  // Karta 3 — przykładowy plan w Commerzbanku (bank_draft); savings_first: plan poduszki, ETF „na później".
  function renderBankCard(t) {
    const d = t.bank_draft;
    if (!d) {
      els.cardBank.innerHTML = '';
      return;
    }
    const c = t.real_world_challenge;
    const advice = (state.session && state.session.safe_investment) || {};
    const savingsFirst = advice.plan_type === 'savings_first';
    const cushion = Number(advice.emergency_savings_monthly) || 0;
    const step = (num, label, body) =>
      '<li class="flex gap-3">' +
        '<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-dark text-sm font-extrabold text-brand-yellow">' + num + '</span>' +
        '<div class="min-w-0"><p class="text-xs font-extrabold uppercase tracking-wider text-slate-500">' + label + '</p>' + body + '</div>' +
      '</li>';

    const today = c
      ? '<p class="mt-0.5 font-extrabold">Mikro-ruch: <span class="tabular-nums">' + formatPLN(c.amount_pln) + '</span> na ' + escapeHtml(c.target_account) + '</p>'
      : '';
    const target = savingsFirst
      ? '<p class="mt-0.5 font-extrabold">Poduszka: <span class="tabular-nums">' + formatPLN(cushion) + '/mies.</span> na konto oszczędnościowe</p>' +
        '<span class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">' +
          '<i data-lucide="clock" class="h-3.5 w-3.5" aria-hidden="true"></i>ETF na później — przykład ' + formatPLN(d.monthly_amount) + '/mies.</span>'
      : '<p class="mt-0.5 font-extrabold"><span class="tabular-nums">' + formatPLN(d.monthly_amount) + '/mies.</span> • horyzont ' + yearsLabel(d.horizon_years) + '</p>' +
        '<p class="mt-0.5 text-sm text-slate-600">' + escapeHtml(d.instrument_category) + '</p>' +
        (cushion > 0 ? '<p class="mt-1 text-sm text-slate-600">Równolegle poduszka: <span class="font-bold tabular-nums">' + formatPLN(cushion) + '/mies.</span> na konto oszczędnościowe.</p>' : '');

    els.cardBank.innerHTML =
      '<div class="' + CARD_CLASS + '">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">Przykładowy plan w Commerzbanku</h3>' +
          '<span class="rounded-full bg-brand-dark px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand-yellow">Demo</span>' +
        '</div>' +
        '<ol class="mt-4 space-y-4">' +
          step(1, 'Dziś', today) +
          step(2, 'Dzień 14 — plan docelowy', target) +
        '</ol>' +
        '<div class="mt-5 rounded-2xl bg-slate-50 p-4">' +
          '<p class="text-xs font-bold text-slate-500">' + (savingsFirst ? 'Przykład na później — ' : '') +
            'szacunek edukacyjny w dzisiejszych złotych • ' + yearsLabel(d.horizon_years) + '</p>' +
          '<div class="mt-2 grid grid-cols-2 gap-3">' +
            '<div><p class="text-xs font-bold text-emerald-700">Szeroki ETF (realnie)</p>' +
              '<p class="text-xl font-extrabold tabular-nums sm:text-2xl">' + formatPLN(d.projected_etf_real_value) + '</p></div>' +
            '<div><p class="text-xs font-bold text-rose-600">Wpłaty na koncie 0% (realnie)</p>' +
              '<p class="text-xl font-extrabold tabular-nums sm:text-2xl">' + formatPLN(d.projected_cash_real_value) + '</p></div>' +
          '</div>' +
          '<p class="mt-1.5 text-xs text-slate-500">nominalnie ETF: ok. <span class="tabular-nums">' + formatPLN(d.projected_etf_nominal_value) + '</span></p>' +
        '</div>' +
        '<p class="mt-3 text-[11px] leading-relaxed text-slate-500">' + escapeHtml(d.assumptions_text) + ' ' + escapeHtml(d.costs_note) + '</p>' +
        '<button type="button" data-action="open-bank-modal" class="btn-3d mt-5 w-full text-base">' +
          '<span>Wykonaj krok Dnia 1 lub zobacz przykładowy plan w Commerzbanku</span>' +
          '<i data-lucide="arrow-right" class="h-5 w-5 shrink-0" aria-hidden="true"></i></button>' +
      '</div>';
    syncBankGlow();
  }

  // Karta 4 — ranking (przykładowi znajomi, demo); „⬆️ Awans!" tylko przy awansie.
  function renderLeaderboardCard(t, options) {
    const rows = state.summary.leaderboard || t.leaderboard || [];
    const leveled = userLeveledUp(t);
    const me = rows.find((r) => r.is_current_user) || null;
    const leader = rows[0] || null;
    const list = rows.map((r) => {
      const isMe = r.is_current_user === true;
      // Backend dopisuje „(Awans!)" do nazwy — w UI pokazujemy osobny badge.
      const name = isMe ? String(r.name).replace(/\s*\(Awans!\)\s*$/, '') : r.name;
      return (
        '<li' + (isMe ? ' data-me' : '') + ' class="flex items-center gap-3 rounded-2xl px-3 py-2.5 ' +
          (isMe ? 'bg-brand-yellow/15 ring-2 ring-brand-yellow' : 'odd:bg-slate-50') + '">' +
          '<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums ' +
            (r.rank === 1 ? 'bg-brand-yellow text-brand-dark' : 'bg-white text-slate-600 ring-1 ring-slate-200') + '">' + escapeHtml(r.rank) + '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="flex flex-wrap items-center gap-1.5 font-extrabold leading-tight">' + escapeHtml(name) +
              (isMe && leveled ? '<span class="rounded-full bg-etf-green px-2 py-0.5 text-[11px] font-extrabold text-white">⬆️ Awans!</span>' : '') + '</p>' +
            '<p class="text-xs text-slate-500">' + escapeHtml(r.level_title) + '</p>' +
          '</div>' +
          '<span class="shrink-0 text-xs font-bold text-streak-orange" title="Seria dni">🔥' + NBSP + escapeHtml(r.streak_days) + '</span>' +
          '<span class="w-20 shrink-0 text-right font-extrabold tabular-nums">' + formatNumber(r.xp) + NBSP + 'XP</span>' +
        '</li>'
      );
    }).join('');

    let hint = '';
    if (me && leader && !leader.is_current_user) {
      hint = 'Do 1. miejsca brakuje Ci <span class="tabular-nums">' + formatNumber(leader.xp - me.xp) + NBSP + 'XP</span> — wróć jutro po Dzień 2!';
    } else if (me) {
      hint = 'Prowadzisz w rankingu — utrzymaj serię jutro!';
    }

    els.cardLeaderboard.innerHTML =
      '<div class="' + CARD_CLASS + '">' +
        '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">Ranking znajomych</h3>' +
          '<span class="text-xs font-semibold text-slate-500">Przykładowi znajomi (demo)</span>' +
        '</div>' +
        '<ol class="mt-4 space-y-1.5">' + list + '</ol>' +
        (hint ? '<p class="mt-3 text-sm font-semibold text-slate-600" aria-live="polite">' + hint + '</p>' : '') +
        '<button type="button" data-action="challenge-friend" class="mt-4 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-dark/10 bg-white px-4 font-extrabold transition hover:border-brand-yellow hover:bg-brand-yellow/10 sm:w-auto">' +
          '⚔️ Wyzwij znajomego</button>' +
      '</div>';

    if (options && options.highlight) {
      const row = els.cardLeaderboard.querySelector('[data-me]');
      if (row) replayClass(row, 'fq-bounce');
    }
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      // przejście do metody zapasowej poniżej
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  async function challengeFriend() {
    const text = 'Rzucam Ci wyzwanie w Finance Quest! Mam za sobą Dzień 1 z 14 planu i ' + displayedXp() +
      ' XP. Dołączysz i spróbujesz mnie dogonić? 🔥';
    const ok = await copyToClipboard(text);
    if (ok) showToast('⚔️ Zaproszenie skopiowane do schowka — wyślij je znajomemu!', 'success');
    else showToast('Nie udało się skopiować. Treść zaproszenia: ' + text, 'warn', 6000);
  }

  // ------------------------------------------------------------------------
  // 12. Modal bankowy — Zero-Friction Handoff (DEMO, docs/01 §7)
  // ------------------------------------------------------------------------

  function bankOptionSummary(t, option) {
    const c = t.real_world_challenge;
    const d = t.bank_draft;
    const advice = (state.session && state.session.safe_investment) || {};
    if (option === 'b') {
      return advice.plan_type === 'savings_first'
        ? 'Przykładowy plan na Dzień 14: poduszka ' + formatPLN(advice.emergency_savings_monthly || 0) + '/mies.'
        : 'Przykładowy plan na Dzień 14: ' + formatPLN(d ? d.monthly_amount : 0) + ' / mies.';
    }
    return c ? 'Przelew ' + formatPLN(c.amount_pln) + ' na ' + c.target_account : 'Krok na dziś';
  }

  function renderBankModal() {
    const t = summaryTurn();
    if (!t || !els.bankOrderContent) return;
    const s = state.summary;
    const c = t.real_world_challenge;
    const d = t.bank_draft;
    const advice = (state.session && state.session.safe_investment) || {};

    if (s.bankDone) {
      els.bankOrderContent.innerHTML =
        '<div class="text-center" role="status">' +
          '<div class="level-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-etf-green text-white">' +
            '<i data-lucide="check" class="h-8 w-8" aria-hidden="true"></i></div>' +
          '<p class="mt-4 text-lg font-extrabold leading-snug">Brawo! Krok Dnia 1 zaliczony — Twoja seria trwa, widzimy się jutro na Dniu 2!</p>' +
          '<p class="mt-2 text-sm text-slate-600">Symulacja: ' + escapeHtml(bankOptionSummary(t, s.bankOption)) + ' • W wersji demo nic nie zostało wykonane.</p>' +
          '<button type="button" data-action="next-generation" class="btn-3d mt-6 w-full">' +
            '<i data-lucide="users" class="h-5 w-5" aria-hidden="true"></i><span>Przetestuj inne pokolenie (Demo)</span></button>' +
          '<button type="button" data-action="close-modal" class="mt-2 inline-flex min-h-tap w-full items-center justify-center rounded-2xl font-bold text-slate-600 transition hover:bg-slate-100">Zamknij</button>' +
        '</div>';
      refreshIcons();
      return;
    }

    const optionB = advice.plan_type === 'savings_first'
      ? '<span class="mt-1 block text-sm font-semibold text-slate-600">Poduszka: <span class="tabular-nums">' + formatPLN(advice.emergency_savings_monthly || 0) + '/mies.</span> na konto oszczędnościowe; ETF później (przykład ' + formatPLN(d ? d.monthly_amount : 0) + '/mies.)</span>'
      : '<span class="mt-1 block text-sm font-semibold text-slate-600"><span class="tabular-nums">' + formatPLN(d ? d.monthly_amount : 0) + ' / mies.</span> • ' +
          (d ? yearsLabel(d.horizon_years) : '') + '</span>' +
        '<span class="mt-0.5 block text-xs font-medium text-slate-500">' + escapeHtml(d ? d.instrument_category : '') + '</span>';
    const option = (value, title, badge, body) =>
      '<label class="block cursor-pointer"><input type="radio" name="bank_option" value="' + value + '" class="sr-only"' + (s.bankOption === value ? ' checked' : '') + '>' +
        '<span class="fq-tile fq-tile--top"><span class="fq-radio-dot" aria-hidden="true"></span><span class="min-w-0">' +
          '<span class="flex flex-wrap items-center gap-2">' + title + badge + '</span>' + body +
        '</span></span></label>';

    els.bankOrderContent.innerHTML =
      '<div class="rounded-2xl bg-brand-dark p-4 text-white">' +
        '<div class="flex items-center justify-between gap-3">' +
          '<span class="inline-flex items-center gap-2 font-extrabold"><span class="grid h-7 w-7 place-items-center rounded-lg bg-brand-yellow text-brand-dark">' +
            '<i data-lucide="landmark" class="h-4 w-4" aria-hidden="true"></i></span>Commerzbank</span>' +
          '<span class="rounded-full bg-brand-yellow px-2 py-0.5 text-[11px] font-extrabold text-brand-dark">DEMO</span>' +
        '</div>' +
        '<p class="mt-2 text-xs text-white/70">Podgląd ekranu aplikacji bankowej — w wersji demo nic nie zostanie wykonane.</p>' +
      '</div>' +
      '<fieldset class="fq-field mt-4"><legend class="text-sm font-bold text-slate-600">Wybierz krok</legend>' +
        '<div class="mt-2 grid gap-3">' +
          option('a', 'Opcja A — Krok na dziś',
            '<span class="rounded-full bg-etf-green px-2 py-0.5 text-[11px] font-extrabold text-white">Polecana</span>',
            '<span class="mt-1 block text-sm font-semibold text-slate-600">' +
              (c ? 'Przelew <span class="tabular-nums">' + formatPLN(c.amount_pln) + '</span> na ' + escapeHtml(c.target_account) : '') + '</span>') +
          option('b', 'Opcja B — Przykładowy plan na Dzień 14', '', optionB) +
        '</div>' +
      '</fieldset>' +
      '<p class="mt-4 flex items-start gap-2 rounded-2xl border border-stress-amber/50 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-slate-700">' +
        '<i data-lucide="shield-alert" class="mt-0.5 h-4 w-4 shrink-0 text-stress-amber" aria-hidden="true"></i>' +
        'W wersji produkcyjnej: test odpowiedniości, weryfikacja tożsamości (KYC), informacja o kosztach i ryzyku.</p>' +
      '<button type="button" data-action="simulate-bank" class="btn-3d mt-5 w-full">' +
        '<span>Symuluj wykonanie kroku w banku (Demo)</span></button>';
    refreshIcons();
  }

  function openBankModal() {
    if (!summaryTurn()) return;
    state.summary.bankDone = false;
    renderBankModal();
    openModal('modal_bank_order');
  }

  function simulateBankStep() {
    state.summary.bankDone = true;
    renderBankModal();
    fireConfetti('full');
    const next = els.bankOrderContent.querySelector('[data-action="next-generation"]');
    if (next) next.focus();
  }

  function testNextGeneration() {
    const group = state.session && state.session.age_group;
    const personaId = NEXT_GENERATION[group] || 'young_20';
    closeModal('modal_bank_order');
    selectPersona(personaId);
  }

  // ------------------------------------------------------------------------
  // 13. Toasty, modal, konfetti
  // ------------------------------------------------------------------------

  const TOAST_TONES = {
    info: 'bg-brand-dark text-white',
    success: 'bg-etf-green text-white',
    warn: 'bg-amber-50 text-brand-dark border border-stress-amber/60',
  };

  function showToast(message, tone, durationMs) {
    if (!els.toastRoot) return;
    const toast = document.createElement('div');
    toast.className = 'toast-in pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ' + (TOAST_TONES[tone] || TOAST_TONES.info);
    toast.setAttribute('role', tone === 'warn' ? 'alert' : 'status');
    toast.textContent = message;
    els.toastRoot.appendChild(toast);
    setTimeout(() => {
      toast.classList.replace('toast-in', 'toast-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, durationMs || 3600);
  }

  let modalReturnFocus = null;

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modalReturnFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const closeBtn = modal.querySelector('button[data-action="close-modal"]');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(id) {
    const modal = id ? document.getElementById(id) : document.querySelector('[role="dialog"]:not([hidden])');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  // 'micro' — dobra odpowiedź (docs/01 §7 Ekran 3); 'full' — komplet checklisty (Ekran 4).
  function fireConfetti(kind) {
    if (typeof window.confetti !== 'function') return;
    if (kind === 'full') {
      window.confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.6 },
        colors: [COLORS.brandYellow, COLORS.brandDark, COLORS.etfGreen],
        disableForReducedMotion: true,
      });
      return;
    }
    window.confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 }, disableForReducedMotion: true });
  }

  // ------------------------------------------------------------------------
  // 14. Zdarzenia i start
  // ------------------------------------------------------------------------

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-persona-id], [data-action], [data-goto]');
      if (!target || target.disabled) return;
      if (target.dataset.personaId) {
        selectPersona(target.dataset.personaId);
      } else if (target.dataset.goto) {
        showScreen(target.dataset.goto);
      } else if (target.dataset.action === 'submit-onboarding') {
        submitOnboarding();
      } else if (target.dataset.action === 'complete-lesson') {
        completeLesson(target.dataset.lessonId);
      } else if (target.dataset.action === 'quick-reply') {
        answerWithQuickReply(target.dataset.replyId);
      } else if (target.dataset.action === 'accept-challenge') {
        acceptChallenge();
      } else if (target.dataset.action === 'toggle-check') {
        toggleChecklistItem(target.dataset.checkId, target);
      } else if (target.dataset.action === 'challenge-friend') {
        challengeFriend();
      } else if (target.dataset.action === 'open-bank-modal') {
        openBankModal();
      } else if (target.dataset.action === 'simulate-bank') {
        simulateBankStep();
      } else if (target.dataset.action === 'next-generation') {
        testNextGeneration();
      } else if (target.dataset.action === 'open-modal') {
        openModal(target.dataset.target);
      } else if (target.dataset.action === 'close-modal') {
        closeModal(target.closest('[role="dialog"]') && target.closest('[role="dialog"]').id);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
    // Radia poza ankietą: samoocena „po" (Ekran 4) i wybór opcji w modalu bankowym.
    document.addEventListener('change', (event) => {
      const input = event.target;
      if (!input || input.type !== 'radio') return;
      if (input.name === 'self_confidence_after') setSelfAfter(input.value);
      else if (input.name === 'bank_option') state.summary.bankOption = input.value === 'b' ? 'b' : 'a';
    });
    if (els.form) {
      els.form.addEventListener('input', onFormInput);
      els.form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitOnboarding();
      });
    }
    if (els.tmYears) {
      els.tmYears.addEventListener('input', () => updateTimeMachine(els.tmYears.value));
    }
    if (els.msForm) {
      els.msForm.addEventListener('submit', (event) => {
        event.preventDefault();
        submitFreeText();
      });
      els.msInput.addEventListener('input', syncMissionCounter);
      // Enter = wyślij, Shift+Enter = nowa linia (bez przerywania kompozycji IME).
      els.msInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          submitFreeText();
        }
      });
    }
  }

  function configureChartDefaults() {
    if (!window.Chart) return;
    window.Chart.defaults.font.family = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.color = '#475569';
  }

  function reportMissingVendors() {
    const vendors = { tailwind: window.tailwind, Chart: window.Chart, confetti: window.confetti, lucide: window.lucide };
    const missing = Object.keys(vendors).filter((name) => !vendors[name]);
    if (missing.length) {
      console.warn('[Finance Quest] Brak lokalnych bibliotek w /static/vendor/: ' + missing.join(', '));
    }
  }

  function init() {
    cacheElements();
    refreshIcons();
    configureChartDefaults();
    reportMissingVendors();
    bindEvents();
    syncFormOutputs();
    renderPersonaPills();
    renderHeader({ animate: false });
    loadPersonas();
  }

  // Publiczne API modułu (dla kolejnych Issues #9–#12 i debugowania w konsoli).
  window.FQ = {
    API_BASE,
    SCREENS,
    COLORS,
    COMPLIANCE_TEXT,
    state,
    api,
    ApiError,
    describeApiError,
    showScreen,
    renderHeader,
    resetHeaderBaseline,
    applyOnboardingResponse,
    applyMissionTurn,
    renderMission,
    sendMissionAnswer,
    withSessionRecovery,
    renderSummary,
    acceptChallenge,
    openBankModal,
    addMicroLessonBonusXp,
    analyzeProfile,
    selectPersona,
    loadPersonas,
    fillOnboardingForm,
    readOnboardingForm,
    updateTimeMachine,
    showToast,
    openModal,
    closeModal,
    fireConfetti,
    refreshIcons,
    replayClass,
    animateNumber,
    formatNumber,
    formatPLN,
    yearsLabel,
    escapeHtml,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
