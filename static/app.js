/* ==========================================================================
   Finance Quest — static/app.js
   Szkielet SPA (Issue #4): konfiguracja API, stan, router ekranów, stały nagłówek
   (dzień, poziom/XP, streak, Gotowość), Demo Mode, toasty, modal, konfetti.
   Czysty JS bez build-toola. Biblioteki globalne z /static/vendor/:
   tailwind, Chart, confetti, lucide (zero CDN w runtime).
   Kontrakt API: docs/02_TECH_API_AND_MATH.md §4–§5.
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
    rendered: { xp: null, level: null, readiness: null }, // ostatnio narysowane wartości nagłówka
  };

  const els = {};

  function cacheElements() {
    const byId = (id) => document.getElementById(id);
    els.screens = Array.from(document.querySelectorAll('main .screen'));
    els.personaPills = Array.from(document.querySelectorAll('[data-persona-id]'));
    els.ctaOnboarding = byId('cta-onboarding');
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
    els.toastRoot = byId('toast-root');
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

  // Płynne liczenie w górę/dół (kwoty, XP, procenty).
  function animateNumber(el, from, to, options) {
    if (!el) return;
    const opts = options || {};
    const duration = opts.duration || 650;
    const format = opts.format || formatNumber;
    if (el._fqAnimFrame) cancelAnimationFrame(el._fqAnimFrame);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Karta w tle: requestAnimationFrame jest wstrzymany — od razu wartość końcowa.
    if (reduced || from === to || document.hidden) {
      el.textContent = format(to);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) {
        el._fqAnimFrame = requestAnimationFrame(step);
      } else {
        el._fqAnimFrame = null;
        el.textContent = format(to);
      }
    };
    el._fqAnimFrame = requestAnimationFrame(step);
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
    // Issue #9: przy 404 frontend po cichu ponawia analyze z state.lastProfile (docs/02 §5).
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
      els.xp.textContent = formatNumber(xp);
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
        els.readinessValue.textContent = readiness + '%';
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
  }

  // ------------------------------------------------------------------------
  // 7. Demo Mode i analiza profilu
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
    els.personaPills.forEach((btn) => { btn.disabled = isBusy; });
    if (els.ctaOnboarding) {
      els.ctaOnboarding.disabled = isBusy;
      const label = els.ctaOnboarding.querySelector('[data-label]');
      if (label) {
        if (!label.dataset.idleText) label.dataset.idleText = label.textContent;
        label.textContent = isBusy ? 'Filtruję zbędną teorię...' : label.dataset.idleText;
      }
    }
  }

  // Issue #8: ustawia 6 pól ankiety wartościami persony (suwaki, kafelki, samoocena).
  function fillOnboardingForm(/* profile */) {}

  // Issue #8: odczytuje 6 pól ankiety (z clampem free_cash <= net_income). Do tego czasu: ostatni profil.
  function readOnboardingForm() {
    return state.lastProfile;
  }

  function applyOnboardingResponse(data) {
    state.session = data;
    state.turn = data.initial_mission_turn;
    state.microLessonBonusXp = 0;
    resetHeaderBaseline();
  }

  // Wyniki tury misji (Issue #9) — nagłówek animuje wzrost XP i Gotowości.
  function applyMissionTurn(turn) {
    state.turn = turn;
    renderHeader();
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
      applyOnboardingResponse(results[0]);
      showScreen(SCREENS.FILTER);
      return results[0];
    } catch (err) {
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
    const profile = readOnboardingForm();
    if (!profile) {
      showToast('Wybierz profil w Demo Mode, aby ułożyć przykładowy plan.', 'info');
      return;
    }
    await analyzeProfile(profile);
  }

  // ------------------------------------------------------------------------
  // 8. Toasty, modal, konfetti
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
  // 9. Zdarzenia i start
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
      } else if (target.dataset.action === 'open-modal') {
        openModal(target.dataset.target);
      } else if (target.dataset.action === 'close-modal') {
        closeModal(target.closest('[role="dialog"]') && target.closest('[role="dialog"]').id);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  }

  function configureChartDefaults() {
    if (!window.Chart) return;
    window.Chart.defaults.font.family = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
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
    renderPersonaPills();
    renderHeader({ animate: false });
    loadPersonas();
  }

  // Publiczne API modułu (dla kolejnych Issues #8–#12 i debugowania w konsoli).
  window.FQ = {
    API_BASE,
    SCREENS,
    COLORS,
    state,
    api,
    ApiError,
    describeApiError,
    showScreen,
    renderHeader,
    resetHeaderBaseline,
    applyOnboardingResponse,
    applyMissionTurn,
    addMicroLessonBonusXp,
    analyzeProfile,
    selectPersona,
    loadPersonas,
    showToast,
    openModal,
    closeModal,
    fireConfetti,
    refreshIcons,
    replayClass,
    animateNumber,
    formatNumber,
    formatPLN,
    escapeHtml,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
