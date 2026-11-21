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
   - Issue #9: Ekran 3 (symulacja wyborów z Corą: karty quick_replies, własna
     odpowiedź, feedback, konfetti) i ciche odtworzenie sesji po 404.
   - Issue #10: Ekran 4 (baner awansu, Gotowość, samoocena „po", wyzwanie,
     checklista, przykładowy plan, ranking, stopka MiFID II) i modal bankowy.
   - Issue #31: domyślny EN + przełącznik EN | PL (pełny słownik I18N),
     Reset / Profile, imię Cora i AI Disclaimer.
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

  // Domyślny język aplikacji to EN (docs/01 §9); PL tylko po jawnym wyborze.
  const LANG_STORAGE_KEY = 'fq_lang';
  const SUPPORTED_LANGS = Object.freeze(['en', 'pl']);

  const SCREENS = Object.freeze({
    ONBOARDING: 'screen_onboarding',
    FILTER: 'screen_filter_and_timemachine',
    MISSION: 'screen_mission_live',
    CHECKPOINT: 'screen_checkpoint',
    CHECKLIST: 'screen_checklist',
  });

  // Dni 1–4 to jedyne grywalne dni sprintu (docs/01 §2); 14 dni to sprint startowy.
  const PLAYABLE_DAYS = 4;
  const SPRINT_DAYS = 14;

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
  function defaultGamification() {
    return {
      level: 1,
      level_title: t('levelObserver'),
      xp: 20,
      next_level_xp: 100,
      xp_gained: 0,
      leveled_up: false,
      streak_days: 1,
    };
  }

  // Dolny próg XP danego poziomu (docs/02 §3G: poziom 2 od 100 XP, poziom 3 od 250 XP).
  const LEVEL_FLOOR_XP = Object.freeze({ 1: 0, 2: 100, 3: 250 });

  // ------------------------------------------------------------------------
  // Słownik EN | PL (docs/01 §9). Klucze z atrybutów data-i18n* w index.html
  // oraz teksty budowane w JS. Kwoty zawsze w PLN (bez przeliczania kursów).
  // ------------------------------------------------------------------------
  const I18N = {
    en: {
      pageTitle: 'Finance Quest — by Commerzbank',
      metaDescription:
        'Finance Quest by Commerzbank — build investing confidence in 14 days, 5 minutes a day.',
      skipToContent: 'Skip to content',
      headerSubtitle: 'by Commerzbank • 14-Day Confidence Sprint',
      langGroupAria: 'Language',
      resetBtn: 'Reset / Profile',
      resetBtnTitle: 'Return to profile selection',
      logoResetAria: 'Finance Quest — return to profile selection',
      demoModeAria: 'Demo Mode — sample profiles',
      hdrDayWord: 'Day',
      hdrDayOf: 'of',
      hdrLvlWord: 'Lvl',
      hdrReadinessLabel: 'Readiness',
      hdrReadinessAria: 'Readiness',
      onbTitle: 'Build investing confidence in 14 days. 5 minutes a day.',
      onbSubtitle: '6 quick questions cut out the noise Speakly-style and build your plan.',
      onbQuickStartPre: 'Quick start: pick a profile in',
      onbQuickStartPost: 'at the top.',
      qAge: 'Age',
      qNetIncome: 'Net income',
      qNetIncomeHint: 'monthly, take-home',
      qFreeCash: 'Monthly free cash',
      qFreeCashMaxPrefix: 'max.',
      qFreeCashMaxSuffix: 'no more than net income',
      qBuffer: 'Emergency buffer (min. 3 months of expenses)',
      qBufferYes: 'Yes, I have a buffer',
      qBufferNo: 'Still building it',
      qConcern: 'What is your biggest concern?',
      concernFreeze: "I'm afraid I'll freeze my money",
      concernNoTime: "I don't have time for the market",
      concernLose: "I'm afraid I'll lose money",
      concernTooLate: "Maybe it's too late to start",
      qConfidence: 'How confident do you feel about investing your first money?',
      qConfMin: '1 — not at all',
      qConfMax: '5 — very confident',
      ctaOnboarding: 'Build my 14-day Speakly plan',
      ctaBusy: 'Filtering out the noise...',
      screenFilterTitle: 'Your Day 1 plan: 14-day map, Speakly filter and Time Machine',
      tmTitle: 'Time Machine: cash vs broad ETF',
      tmSubtitlePrefix: "in today's PLN • example:",
      tmSliderLabel: 'Rewind time',
      tmMinYear: '1 year',
      tmMaxYear: '20 years',
      kpiCashLabel: "Contributions in 0% account (real, today's PLN)",
      kpiPaidPrefix: 'paid in total',
      kpiEtfLabel: 'Broad ETF (real, assumptions below)',
      kpiNominalPrefix: 'nominal approx.',
      kpiWinTitle: 'Historical windows (illustrative)',
      kpiWinPrefix: 'In illustrative historical windows',
      kpiWinSuffix: 'ended with a positive real return',
      kpiWinNote: 'illustrative educational data',
      legendEtf: 'Broad ETF (real)',
      legendCash: 'Contributions in 0% account (real)',
      legendStress: '-20% dip scenario in year 3 (educational)',
      tmSimNote: 'Historical simulation; results vary and do not guarantee future profits.',
      tmChartAria:
        "Chart: value of 0% account contributions and broad ETF in today's PLN, with a -20% dip scenario in year 3",
      currencyUnit: 'PLN',
      ctaStartMission: 'Start Day 1 Simulation with AI Coach',
      screenMissionTitle: 'Day 1 of 14 — decision simulation with Cora',
      screenMissionTitleDynamic: 'Day {day} of 14 — decision simulation with Cora',
      screenChecklistTitleDynamic: 'Day {day} of 14 summary',
      msDayWord: 'Day',
      msSimLabel: 'Decision Simulation',
      msStepWord: 'Step',
      msPortfolioLabel: 'Simulated portfolio (nominal)',
      coachRole: 'Your daily AI Coach',
      coachAnalyzing: 'Cora is analyzing your answer...',
      msPromptHeading: 'What do you do?',
      msPromptHint: 'Pick a card or answer in your own words',
      msInputLabel: 'Your own answer for AI Coach',
      msInputPlaceholder: 'Or tell AI Coach Cora in your own words what you do and why...',
      msSend: 'Send',
      msSending: 'Sending...',
      msEnterHint: 'Enter — send, Shift+Enter — new line',
      aiDisclaimer:
        'AI Coach Cora can make mistakes. Educational simulation only — not financial advice (MiFID II).',
      ctaFinishDay: 'Finish Day 1 and get summary',
      screenChecklistTitle: 'Day 1 of 14 summary',
      modalBankTitle: 'Sample plan at Commerzbank',
      closeModalAria: 'Close',
      complianceText:
        'Finance Quest is an educational and simulation-only app. Calculations use simplified assumptions and ' +
        'historical data; they ignore capital-gains tax, fees and currency risk, do not guarantee future ' +
        'results and are not investment advice or a recommendation within the meaning of MiFID II. Investing ' +
        'involves the risk of losing part or all of your capital.',
      levelObserver: 'Observer',
      levelConfident: 'Confident Start',
      levelSteady: 'Steady Builder',
      ageGroupYoung: 'Young Start (20+)',
      ageGroupMid: 'Career & Family (30–50)',
      ageGroupSenior: 'Capital Protection (50+)',
      fieldAge: 'Age must be between 18 and 70.',
      fieldNetIncome: 'Net income: from 2,500 to 25,000 PLN.',
      fieldFreeCash: 'Free cash: from 200 to 10,000 PLN and no more than net income.',
      fieldEmergencyFund: 'Tell us whether you already have a buffer.',
      fieldMainConcern: 'Pick what you are most concerned about.',
      fieldSelfConfidence: 'Pick a score from 1 to 5.',
      errorGeneric: 'Something went wrong. Please try again.',
      errorNetwork: 'No connection to the server. Start the backend: uvicorn backend.main:app --port 8000',
      errorTimeout: 'The server did not answer in time. Please try again.',
      error422: 'Check your survey answers — some values are out of range.',
      error404: 'The requested resource was not found on the server (404).',
      errorServer: 'Server error ({status}). Please try again.',
      toastFixFields: 'Fix the highlighted survey fields.',
      toastFillFields: 'Complete the highlighted survey questions.',
      toastPersonasFailed:
        'Could not load the demo profiles. Start the backend: uvicorn backend.main:app --port 8000',
      planIntroHorizon: 'Horizon:',
      planIntroConcern: 'Concern:',
      lessonDone: 'Done • +{xp} XP',
      lessonUnderstood: 'Got it! (+{xp} XP)',
      lessonSeconds: '{seconds} sec.',
      speaklyTitle: 'Speakly filter and Day 1 micro-lessons',
      speaklySkipped: '⚡ We skipped {n} topics you do not need to start',
      lessonsTitle: 'Day 1 micro-lessons',
      lessonsOptional: 'optional • max. +{xp} XP',
      prioritiesTitle: 'Your 3 priorities for today',
      skippedTitle: 'You do not need this at the start',
      splitLabel: 'Sample target amount (monthly)',
      splitCushion: 'Buffer',
      splitEtf: 'Training in a broad ETF',
      splitShare: 'about {cushion}% to the buffer • about {etf}% to training in a broad ETF',
      splitSim: 'In the simulation below:',
      splitSimEtf: 'in a broad ETF.',
      splitPerMonth: '/mo.',
      splitLater: 'ETF later — example below at {amount} PLN/mo.',
      splitTitle: 'Sample split of your free cash',
      chartYearZero: 'Year 0',
      chartYear: 'Year {year}',
      chartEtf: 'Broad ETF (real)',
      chartCash: 'Contributions in 0% account (real)',
      chartStress: '-20% dip in year 3 (educational)',
      chartAxis: "PLN (in today's PLN)",
      feedbackGood: 'Good decision',
      feedbackTip: 'Tip from Cora',
      feedbackAnswer: 'Your answer: “{answer}”',
      feedbackReadiness: 'Readiness +{delta} pts',
      feedbackLevel: '🏆 Level up: Level {level} {title}',
      toastWriteMore: 'Write a few words or pick one of the cards.',
      errorMessageLength: 'The answer must be between 1 and {max} characters.',
      errorRestoreSession: 'Could not restore the session. Go back to the survey and try again.',
      levelBannerLeveled: '🏆 DAY {day} OF {total} COMPLETE! LEVEL UP: {title}',
      levelBannerDone: 'DAY {day} OF {total} COMPLETE',
      streakNextDay: '🔥 Streak started! See you tomorrow for Day {day}.',
      streakCheckpoint: '🔥 Day 4 done — take Checkpoint #1 to lock in the foundations.',
      streakContinuous: '🔥 Foundations locked in — continuous learning starts right after the sprint.',
      pillLevel: 'Level {level}',
      pillMicroXp: '+{xp} XP from micro-lessons',
      pillStreak: '🔥 Streak: {days} {dayWord}',
      missingXp: 'You need <span class="tabular-nums">{xp} XP</span> to reach Level 2 — come back tomorrow!',
      readiness: 'Readiness',
      readinessTo: 'to',
      readinessNote: 'Full readiness comes only on Day 14.',
      selfQuestion: 'How confident do you feel now? (1–5)',
      selfBeforeHint: 'Before: {before}/5 — mark how it feels now.',
      selfMarkNow: 'Mark how it feels now.',
      selfBefore: 'Before: {before}/5',
      selfAfter: 'After: {after}/5',
      challengeAccepted: '✅ Challenge accepted!',
      challengeAccept: 'I accept the challenge (+{xp} XP)',
      challengeBadge: 'Real micro-challenge • Zero fear',
      checklistTitleDynamic: 'Day {day} checklist',
      checklistDone: '🎉 Complete! Now take the first step at the bank.',
      bankMicroMove: 'Micro-move:',
      bankOn: 'to',
      bankBuffer: 'Buffer:',
      bankSavingsAccount: 'to a savings account',
      bankEtfLater: 'ETF later — example {amount}/mo.',
      bankHorizon: 'horizon',
      bankParallelBuffer: 'In parallel, buffer:',
      bankTitle: 'Sample plan at Commerzbank',
      bankToday: 'Today',
      bankTarget: 'Day 14 — target plan',
      bankLaterPrefix: 'Example for later — ',
      bankEstimate: 'educational estimate in today’s PLN •',
      bankEtfReal: 'Broad ETF (real)',
      bankCashReal: 'Contributions in 0% account (real)',
      bankNominal: 'nominal ETF: approx.',
      bankCtaDynamic: 'Take the Day {day} step or preview the sample plan at Commerzbank',
      leaderboardTitle: 'Friends leaderboard',
      leaderboardDemo: 'Sample friends (demo)',
      leaderboardStreakTitle: 'Day streak',
      leaderboardLeveled: '⬆️ Level Up!',
      leaderboardMissing:
        'You need <span class="tabular-nums">{xp} XP</span> to reach 1st place — keep the streak tomorrow!',
      leaderboardLeading: 'You lead the leaderboard — keep the streak tomorrow!',
      leaderboardChallenge: '⚔️ Challenge a friend',
      friendText:
        'I challenge you in Finance Quest! I finished Day 1 of 14 and have {xp} XP. Will you join and try to catch me? 🔥',
      friendCopied: '⚔️ Invitation copied to the clipboard — send it to a friend!',
      friendCopyFailed: 'Could not copy. Invitation text: {text}',
      modalBankPreview: 'Preview of the bank app screen — in demo mode nothing will be executed.',
      modalChooseStep: 'Choose a step',
      modalOptionA: 'Option A — Step for today',
      modalRecommended: 'Recommended',
      modalOptionB: 'Option B — Sample plan for Day 14',
      modalBuffer: 'Buffer:',
      modalSavings: 'to a savings account; ETF later (example {amount}/mo.)',
      modalKyc:
        'In the production version: suitability test, identity verification (KYC), information about costs and risk.',
      modalSimulate: 'Simulate executing the step at the bank (Demo)',
      modalDone: 'Well done! Day 1 step complete — your streak continues, see you tomorrow for Day 2!',
      modalDoneNote: 'Simulation: {summary} • In demo mode nothing was executed.',
      modalNextGeneration: 'Try another generation (Demo)',
      modalClose: 'Close',
      modalTodayStep: 'Step for today',
      modalTargetPlan: 'Sample plan for Day 14:',
      modalTransfer: 'Transfer {amount} to {account}',

      // --- Issue #32: phased timeline, Days 1–4, Checkpoint #1, After Day 14 ---
      demoShortcutTitle: 'Demo shortcut — jump straight to Day 4 or Checkpoint #1',
      demoJumpDay4: 'Jump to Day 4',
      demoCheckpoint: 'Checkpoint #1',
      roadmapTitlePhases: '14-Day Confidence Sprint — 3 phases',
      roadmapSprintNote:
        '14 days is the starter sprint that builds confidence for your first deposits (~5 min/day). After Day 14 continuous learning begins — not a finish line.',
      roadmapPhase1: 'Phase 1: Days 1–4 · Foundations & First Step',
      roadmapPhase2: 'Phase 2: Days 5–9 · Risk, Safety & Emotions',
      roadmapPhase3: 'Phase 3: Days 10–14 · Your Real Plan',
      roadmapCheckpoint1: 'Checkpoint #1',
      roadmapCheckpoint2: 'Checkpoint #2',
      roadmapSprintFinale: 'Sprint finale',
      roadmapAvailableNow: 'Available now',
      roadmapCompletedDays: '{done} of 4 days completed',
      roadmapDayAria: 'Go to Day {day}',
      roadmapLockedDayAria: 'Day {day} is locked',
      roadmapDayLabel: 'Day {day}',
      roadmapPhaseLocked: 'Locked',
      roadmapAfter14Title: 'After Day 14 — Continuous Learning',
      roadmapAfter14Note:
        'The sprint ends on Day 14, but the learning continues: rebalancing, IKE/IKZE, bonds and monthly AI check-ins with Cora.',
      nextStepTitle: 'Your next step',
      nextStepDayDone: 'Day {day} completed',
      nextStepContinue: 'Continue to Day {day}',
      nextStepContinueHint: 'Day {day} takes ~5 min: new micro-lessons and 2 decisions with Cora.',
      nextStepCheckpoint: 'Take Checkpoint #1 Quiz',
      nextStepCheckpointReview: 'Review Checkpoint #1',
      nextStepCheckpointHint:
        'A 4-question knowledge check from Days 1–4. Pass at 75% to earn +100 XP and the Foundation Ready badge.',
      nextStepProgress: 'Days completed: {done} of 4',
      nextStepReviewMap: 'Review the 14-day map',
      screenCheckpointTitle: 'Checkpoint #1 — knowledge check',
      cpIntroTitle: 'Checkpoint #1 — knowledge check',
      cpIntroBody:
        'Four quick questions from Days 1–4: inflation, buffer, costs and volatility. It takes about 2 minutes.',
      cpThreshold: 'Pass threshold: 75% • reward: +100 XP',
      cpProgress: 'Answered {answered} of {total}',
      cpQuestion: 'Question {n}',
      cpSubmit: 'Submit answers',
      cpSubmitting: 'Checking...',
      cpIncomplete: 'Answer every question before submitting.',
      cpEmpty: 'Checkpoint questions are not available yet. Complete Day 4 first.',
      cpErrorMessage: 'Could not submit the checkpoint. Please try again.',
      cpCorrectCount: '{correct} of {total} correct',
      cpPassed: 'Checkpoint #1 passed!',
      cpFailed: 'Not passed yet — review the explanations and try again.',
      cpBadgeEarned: 'Badge earned: {badge}',
      cpReward: 'Bonus: +{xp} XP',
      cpResultsTitle: 'Answer explanations',
      cpCorrectAnswer: 'Correct answer: {answer}',
      cpCorrect: 'Correct',
      cpIncorrect: 'Not this time',
      cpRetry: 'Try again',
      cpBackToSummary: 'Back to the day summary',
      feedbackRetryTitle: "Let's try again",
      feedbackZeroXp: '0 XP',
      ctaFinishDayDynamic: 'Finish Day {day} and get summary',
      ctaStartMissionDynamic: 'Start Day {day} simulation with AI Coach',
      dayStartedToast: 'Day {day} unlocked — ~5 min, let’s go!',
      errorDayStart: 'Could not load that day. Please try again.',
    },
    pl: {
      pageTitle: 'Finance Quest — Commerzbank',
      metaDescription:
        'Finance Quest od Commerzbank — zbuduj pewność inwestowania w 14 dni, 5 minut dziennie.',
      skipToContent: 'Przejdź do treści',
      headerSubtitle: 'Commerzbank • 14-dniowy Sprint Pewności',
      langGroupAria: 'Język',
      resetBtn: 'Reset / Profil',
      resetBtnTitle: 'Powrót do wyboru profilu',
      logoResetAria: 'Finance Quest — powrót do wyboru profilu',
      demoModeAria: 'Demo Mode — przykładowe profile',
      hdrDayWord: 'Dzień',
      hdrDayOf: 'z',
      hdrLvlWord: 'Poz.',
      hdrReadinessLabel: 'Gotowość',
      hdrReadinessAria: 'Gotowość',
      onbTitle: 'Zbuduj pewność inwestowania w 14 dni. 5 minut dziennie.',
      onbSubtitle: '6 szybkich pytań odcina zbędny szum w stylu Speakly i buduje Twój plan.',
      onbQuickStartPre: 'Szybki start: wybierz profil w',
      onbQuickStartPost: 'na górze.',
      qAge: 'Wiek',
      qNetIncome: 'Zarobki netto',
      qNetIncomeHint: 'miesięcznie, na rękę',
      qFreeCash: 'Wolne środki miesięcznie',
      qFreeCashMaxPrefix: 'maks.',
      qFreeCashMaxSuffix: 'nie więcej niż zarobki netto',
      qBuffer: 'Poduszka finansowa (min. 3 miesiące wydatków)',
      qBufferYes: 'Tak, mam poduszkę',
      qBufferNo: 'Dopiero ją buduję',
      qConcern: 'Czego najbardziej się obawiasz?',
      concernFreeze: 'Boję się, że zamrożę pieniądze',
      concernNoTime: 'Nie mam czasu na giełdę',
      concernLose: 'Boję się, że stracę pieniądze',
      concernTooLate: 'Chyba za późno na start',
      qConfidence: 'Jak pewnie czujesz się z inwestowaniem pierwszych pieniędzy?',
      qConfMin: '1 — wcale',
      qConfMax: '5 — bardzo pewnie',
      ctaOnboarding: 'Zbuduj mój 14-dniowy plan Speakly',
      ctaBusy: 'Filtruję zbędną teorię...',
      screenFilterTitle: 'Twój plan na Dzień 1: mapa 14 dni, filtr Speakly i Wehikuł Czasu',
      tmTitle: 'Wehikuł Czasu: gotówka vs szeroki ETF',
      tmSubtitlePrefix: 'w dzisiejszych złotych • przykład:',
      tmSliderLabel: 'Przewiń czas',
      tmMinYear: '1 rok',
      tmMaxYear: '20 lat',
      kpiCashLabel: 'Wpłaty na koncie 0% (realnie, dzisiejsze złote)',
      kpiPaidPrefix: 'wpłacono łącznie',
      kpiEtfLabel: 'Szeroki ETF (realnie, założenia poniżej)',
      kpiNominalPrefix: 'nominalnie ok.',
      kpiWinTitle: 'Okresy historyczne (ilustracyjnie)',
      kpiWinPrefix: 'W ilustracyjnych okresach historycznych',
      kpiWinSuffix: 'zakończyło się dodatnim wynikiem realnym',
      kpiWinNote: 'dane ilustracyjne, edukacyjne',
      legendEtf: 'Szeroki ETF (realnie)',
      legendCash: 'Wpłaty na koncie 0% (realnie)',
      legendStress: 'Scenariusz wahania -20% w roku 3 (edukacyjny)',
      tmSimNote: 'Symulacja historyczna; wyniki się różnią i nie gwarantują przyszłych zysków.',
      tmChartAria:
        'Wykres: wartość wpłat na koncie 0% i szerokiego ETF w dzisiejszych złotych, ze scenariuszem -20% w roku 3',
      currencyUnit: 'zł',
      ctaStartMission: 'Rozpocznij symulację Dnia 1 z AI Coachem',
      screenMissionTitle: 'Dzień 1 z 14 — symulacja decyzji z Corą',
      screenMissionTitleDynamic: 'Dzień {day} z 14 — symulacja decyzji z Corą',
      screenChecklistTitleDynamic: 'Podsumowanie Dnia {day} z 14',
      msDayWord: 'Dzień',
      msSimLabel: 'Symulacja wyborów',
      msStepWord: 'Krok',
      msPortfolioLabel: 'Portfel symulowany (nominalnie)',
      coachRole: 'Twój codzienny AI Coach',
      coachAnalyzing: 'Cora analizuje Twoją odpowiedź...',
      msPromptHeading: 'Co robisz?',
      msPromptHint: 'Wybierz kartę albo odpowiedz własnymi słowami',
      msInputLabel: 'Twoja własna odpowiedź dla AI Coacha',
      msInputPlaceholder: 'Albo powiedz AI Coachowi Corze własnymi słowami, co robisz i dlaczego...',
      msSend: 'Wyślij',
      msSending: 'Wysyłam...',
      msEnterHint: 'Enter — wyślij, Shift+Enter — nowa linia',
      aiDisclaimer:
        'AI Coach Cora może popełniać błędy. Wyłącznie symulacja edukacyjna — to nie porada inwestycyjna (MiFID II).',
      ctaFinishDay: 'Zakończ Dzień 1 i zobacz podsumowanie',
      screenChecklistTitle: 'Podsumowanie Dnia 1 z 14',
      modalBankTitle: 'Przykładowy plan w Commerzbanku',
      closeModalAria: 'Zamknij',
      complianceText:
        'Aplikacja Finance Quest ma charakter wyłącznie edukacyjny i symulacyjny. Wyliczenia opierają się na ' +
        'uproszczonych założeniach i danych historycznych, nie uwzględniają podatku od zysków, opłat ani ryzyka ' +
        'walutowego, nie gwarantują przyszłych wyników i nie stanowią doradztwa inwestycyjnego ani rekomendacji ' +
        'w rozumieniu dyrektywy MiFID II. Inwestowanie wiąże się z ryzykiem utraty części lub całości kapitału.',
      levelObserver: 'Obserwator',
      levelConfident: 'Świadomy Start',
      levelSteady: 'Konsekwentny Start',
      ageGroupYoung: 'Młody Start (20+)',
      ageGroupMid: 'Kariera i Rodzina (30–50)',
      ageGroupSenior: 'Ochrona Kapitału (50+)',
      fieldAge: 'Wiek musi mieścić się w przedziale 18–70 lat.',
      fieldNetIncome: 'Zarobki netto: od 2 500 do 25 000 zł.',
      fieldFreeCash: 'Wolne środki: od 200 do 10 000 zł i nie więcej niż zarobki netto.',
      fieldEmergencyFund: 'Zaznacz, czy masz już poduszkę.',
      fieldMainConcern: 'Wybierz, czego najbardziej się obawiasz.',
      fieldSelfConfidence: 'Wybierz ocenę od 1 do 5.',
      errorGeneric: 'Coś poszło nie tak. Spróbuj ponownie.',
      errorNetwork: 'Brak połączenia z serwerem. Uruchom backend: uvicorn backend.main:app --port 8000',
      errorTimeout: 'Serwer nie odpowiedział na czas. Spróbuj ponownie.',
      error422: 'Sprawdź odpowiedzi w ankiecie — część wartości jest poza zakresem.',
      error404: 'Nie znaleziono zasobu na serwerze (404).',
      errorServer: 'Błąd serwera ({status}). Spróbuj ponownie.',
      toastFixFields: 'Popraw zaznaczone pola ankiety.',
      toastFillFields: 'Uzupełnij zaznaczone pytania ankiety.',
      toastPersonasFailed:
        'Nie udało się pobrać profili demo. Uruchom backend: uvicorn backend.main:app --port 8000',
      planIntroHorizon: 'Horyzont:',
      planIntroConcern: 'Obawa:',
      lessonDone: 'Zaliczone • +{xp} XP',
      lessonUnderstood: 'Rozumiem! (+{xp} XP)',
      lessonSeconds: '{seconds} sek.',
      speaklyTitle: 'Filtr Speakly i mikro-lekcje Dnia 1',
      speaklySkipped: '⚡ Pominęliśmy {n} {word}, których nie potrzebujesz na start',
      lessonsTitle: 'Mikro-lekcje Dnia 1',
      lessonsOptional: 'opcjonalnie • maks. +{xp} XP',
      prioritiesTitle: 'Twoje 3 priorytety na dziś',
      skippedTitle: 'Nie musisz tego robić na starcie',
      splitLabel: 'Przykładowa kwota docelowa (miesięcznie)',
      splitCushion: 'Poduszka',
      splitEtf: 'Trening w szeroki ETF',
      splitShare: 'ok. {cushion}% na poduszkę • ok. {etf}% na trening w szeroki ETF',
      splitSim: 'W symulacji poniżej:',
      splitSimEtf: 'w szerokim ETF.',
      splitPerMonth: '/mies.',
      splitLater: 'ETF później — poniżej przykład na {amount} zł/mies.',
      splitTitle: 'Przykładowy podział wolnych środków',
      chartYearZero: 'Rok 0',
      chartYear: 'Rok {year}',
      chartEtf: 'Szeroki ETF (realnie)',
      chartCash: 'Wpłaty na koncie 0% (realnie)',
      chartStress: 'Scenariusz wahania -20% w roku 3 (edukacyjny)',
      chartAxis: 'zł (w dzisiejszych złotych)',
      feedbackGood: 'Trafna decyzja',
      feedbackTip: 'Wskazówka od Cory',
      feedbackAnswer: 'Twoja odpowiedź: „{answer}”',
      feedbackReadiness: 'Gotowość +{delta} pkt',
      feedbackLevel: '🏆 Awans: Poziom {level} {title}',
      toastWriteMore: 'Napisz kilka słów albo wybierz jedną z kart.',
      errorMessageLength: 'Odpowiedź musi mieć od 1 do {max} znaków.',
      errorRestoreSession: 'Nie udało się odtworzyć sesji. Wróć do ankiety i spróbuj ponownie.',
      levelBannerLeveled: '🏆 DZIEŃ {day} Z {total} UKOŃCZONY! AWANS: {title}',
      levelBannerDone: 'DZIEŃ {day} Z {total} UKOŃCZONY',
      streakNextDay: '🔥 Seria rozpoczęta! Wróć jutro po Dzień {day}.',
      streakCheckpoint: '🔥 Dzień 4 gotowy — rozwiąż Checkpoint #1, żeby domknąć fundamenty.',
      streakContinuous: '🔥 Fundamenty domknięte — ciągła nauka zaczyna się zaraz po sprincie.',
      pillLevel: 'Poziom {level}',
      pillMicroXp: '+{xp} XP z mikro-lekcji',
      pillStreak: '🔥 Seria: {days} {dayWord}',
      missingXp: 'Do Poziomu 2 brakuje <span class="tabular-nums">{xp} XP</span> — wróć jutro i nadrób!',
      readiness: 'Gotowość',
      readinessTo: 'do',
      readinessNote: 'Pełną gotowość da dopiero Dzień 14.',
      selfQuestion: 'Jak pewnie czujesz się teraz? (1–5)',
      selfBeforeHint: 'Przed: {before}/5 — zaznacz, jak jest teraz.',
      selfMarkNow: 'Zaznacz, jak jest teraz.',
      selfBefore: 'Przed: {before}/5',
      selfAfter: 'Po: {after}/5',
      challengeAccepted: '✅ Wyzwanie przyjęte!',
      challengeAccept: 'Podejmuję wyzwanie (+{xp} XP)',
      challengeBadge: 'Realne mikro-wyzwanie • Zero strachu',
      checklistTitleDynamic: 'Checklista Dnia {day}',
      checklistDone: '🎉 Komplet! Teraz zrób pierwszy krok w banku.',
      bankMicroMove: 'Mikro-ruch:',
      bankOn: 'na',
      bankBuffer: 'Poduszka:',
      bankSavingsAccount: 'na konto oszczędnościowe',
      bankEtfLater: 'ETF na później — przykład {amount}/mies.',
      bankHorizon: 'horyzont',
      bankParallelBuffer: 'Równolegle poduszka:',
      bankTitle: 'Przykładowy plan w Commerzbanku',
      bankToday: 'Dziś',
      bankTarget: 'Dzień 14 — plan docelowy',
      bankLaterPrefix: 'Przykład na później — ',
      bankEstimate: 'szacunek edukacyjny w dzisiejszych złotych •',
      bankEtfReal: 'Szeroki ETF (realnie)',
      bankCashReal: 'Wpłaty na koncie 0% (realnie)',
      bankNominal: 'nominalnie ETF: ok.',
      bankCtaDynamic: 'Wykonaj krok Dnia {day} lub zobacz przykładowy plan w Commerzbanku',
      leaderboardTitle: 'Ranking znajomych',
      leaderboardDemo: 'Przykładowi znajomi (demo)',
      leaderboardStreakTitle: 'Seria dni',
      leaderboardLeveled: '⬆️ Awans!',
      leaderboardMissing:
        'Do 1. miejsca brakuje Ci <span class="tabular-nums">{xp} XP</span> — utrzymaj serię jutro!',
      leaderboardLeading: 'Prowadzisz w rankingu — utrzymaj serię jutro!',
      leaderboardChallenge: '⚔️ Wyzwij znajomego',
      friendText:
        'Rzucam Ci wyzwanie w Finance Quest! Mam za sobą Dzień 1 z 14 planu i {xp} XP. Dołączysz i spróbujesz mnie dogonić? 🔥',
      friendCopied: '⚔️ Zaproszenie skopiowane do schowka — wyślij je znajomemu!',
      friendCopyFailed: 'Nie udało się skopiować. Treść zaproszenia: {text}',
      modalBankPreview: 'Podgląd ekranu aplikacji bankowej — w wersji demo nic nie zostanie wykonane.',
      modalChooseStep: 'Wybierz krok',
      modalOptionA: 'Opcja A — Krok na dziś',
      modalRecommended: 'Polecana',
      modalOptionB: 'Opcja B — Przykładowy plan na Dzień 14',
      modalBuffer: 'Poduszka:',
      modalSavings: 'na konto oszczędnościowe; ETF później (przykład {amount}/mies.)',
      modalKyc:
        'W wersji produkcyjnej: test odpowiedniości, weryfikacja tożsamości (KYC), informacja o kosztach i ryzyku.',
      modalSimulate: 'Symuluj wykonanie kroku w banku (Demo)',
      modalDone: 'Brawo! Krok Dnia 1 zaliczony — Twoja seria trwa, widzimy się jutro na Dniu 2!',
      modalDoneNote: 'Symulacja: {summary} • W wersji demo nic nie zostało wykonane.',
      modalNextGeneration: 'Przetestuj inne pokolenie (Demo)',
      modalClose: 'Zamknij',
      modalTodayStep: 'Krok na dziś',
      modalTargetPlan: 'Przykładowy plan na Dzień 14:',
      modalTransfer: 'Przelew {amount} na {account}',

      // --- Issue #32: fazy, Dni 1–4, Checkpoint #1, After Day 14 ---
      demoShortcutTitle: 'Skrót demo — przejdź prosto do Dnia 4 lub Checkpointu #1',
      demoJumpDay4: 'Skok do Dnia 4',
      demoCheckpoint: 'Checkpoint #1',
      roadmapTitlePhases: '14-dniowy Sprint Pewności — 3 fazy',
      roadmapSprintNote:
        '14 dni to sprint startowy budujący pewność do pierwszych wpłat (~5 min/dzień). Po Dniu 14 zaczyna się ciągła nauka — to nie meta.',
      roadmapPhase1: 'Faza 1: Dni 1–4 · Fundamenty i pierwszy krok',
      roadmapPhase2: 'Faza 2: Dni 5–9 · Ryzyko, bezpieczeństwo i emocje',
      roadmapPhase3: 'Faza 3: Dni 10–14 · Twój prawdziwy plan',
      roadmapCheckpoint1: 'Checkpoint #1',
      roadmapCheckpoint2: 'Checkpoint #2',
      roadmapSprintFinale: 'Finał sprintu',
      roadmapAvailableNow: 'Dostępne teraz',
      roadmapCompletedDays: '{done} z 4 dni ukończonych',
      roadmapDayAria: 'Przejdź do Dnia {day}',
      roadmapLockedDayAria: 'Dzień {day} jest zablokowany',
      roadmapDayLabel: 'Dzień {day}',
      roadmapPhaseLocked: 'Zablokowane',
      roadmapAfter14Title: 'After Day 14 — Continuous Learning',
      roadmapAfter14Note:
        'Sprint kończy się w Dniu 14, ale nauka trwa dalej: rebalansowanie, IKE/IKZE, obligacje i miesięczne check-iny z Corą.',
      nextStepTitle: 'Twój następny krok',
      nextStepDayDone: 'Dzień {day} ukończony',
      nextStepContinue: 'Przejdź do Dnia {day}',
      nextStepContinueHint: 'Dzień {day} zajmuje ~5 min: nowe mikro-lekcje i 2 decyzje z Corą.',
      nextStepCheckpoint: 'Rozwiąż quiz Checkpoint #1',
      nextStepCheckpointReview: 'Zobacz wynik Checkpointu #1',
      nextStepCheckpointHint:
        'Test wiedzy z 4 pytań z Dni 1–4. Próg 75%, +100 XP i odznaka Foundation Ready.',
      nextStepProgress: 'Ukończone dni: {done} z 4',
      nextStepReviewMap: 'Zobacz mapę 14 dni',
      screenCheckpointTitle: 'Checkpoint #1 — test wiedzy',
      cpIntroTitle: 'Checkpoint #1 — test wiedzy',
      cpIntroBody:
        'Cztery szybkie pytania z Dni 1–4: inflacja, poduszka, koszty i wahania. Zajmie około 2 minut.',
      cpThreshold: 'Próg zaliczenia: 75% • nagroda: +100 XP',
      cpProgress: 'Odpowiedziano {answered} z {total}',
      cpQuestion: 'Pytanie {n}',
      cpSubmit: 'Wyślij odpowiedzi',
      cpSubmitting: 'Sprawdzam...',
      cpIncomplete: 'Odpowiedz na wszystkie pytania przed wysłaniem.',
      cpEmpty: 'Pytania Checkpointu nie są jeszcze dostępne. Najpierw ukończ Dzień 4.',
      cpErrorMessage: 'Nie udało się wysłać Checkpointu. Spróbuj ponownie.',
      cpCorrectCount: '{correct} z {total} poprawnych',
      cpPassed: 'Checkpoint #1 zaliczony!',
      cpFailed: 'Jeszcze niezaliczony — przejrzyj wyjaśnienia i spróbuj ponownie.',
      cpBadgeEarned: 'Odznaka: {badge}',
      cpReward: 'Bonus: +{xp} XP',
      cpResultsTitle: 'Wyjaśnienia odpowiedzi',
      cpCorrectAnswer: 'Poprawna odpowiedź: {answer}',
      cpCorrect: 'Poprawnie',
      cpIncorrect: 'Tym razem nie',
      cpRetry: 'Spróbuj ponownie',
      cpBackToSummary: 'Wróć do podsumowania dnia',
      feedbackRetryTitle: 'Spróbujmy jeszcze raz',
      feedbackZeroXp: '0 XP',
      ctaFinishDayDynamic: 'Zakończ Dzień {day} i zobacz podsumowanie',
      ctaStartMissionDynamic: 'Rozpocznij symulację Dnia {day} z AI Coachem',
      dayStartedToast: 'Dzień {day} odblokowany — ~5 min, zaczynamy!',
      errorDayStart: 'Nie udało się wczytać tego dnia. Spróbuj ponownie.',
    },
  };

  function normalizeLang(lang) {
    return String(lang || '').toLowerCase() === 'pl' ? 'pl' : 'en';
  }

  function readStoredLang() {
    try {
      return normalizeLang(window.localStorage.getItem(LANG_STORAGE_KEY));
    } catch (err) {
      return 'en';
    }
  }

  // Tłumaczenie klucza z podstawianiem {placeholderów}; brak klucza -> EN -> klucz.
  function t(key, params) {
    const dict = I18N[state.lang] || I18N.en;
    let value = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : I18N.en[key];
    if (typeof value !== 'string') return key;
    if (params) {
      value = value.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
      );
    }
    return value;
  }

  function concernLabels() {
    return {
      freeze_money: t('concernFreeze'),
      no_time: t('concernNoTime'),
      lose_money: t('concernLose'),
      too_late: t('concernTooLate'),
    };
  }

  function fieldMessages() {
    return {
      age: t('fieldAge'),
      net_income: t('fieldNetIncome'),
      free_cash: t('fieldFreeCash'),
      has_emergency_fund: t('fieldEmergencyFund'),
      main_concern: t('fieldMainConcern'),
      self_confidence_start: t('fieldSelfConfidence'),
    };
  }

  const FORM_FIELDS = Object.freeze([
    'age',
    'net_income',
    'free_cash',
    'has_emergency_fund',
    'main_concern',
    'self_confidence_start',
  ]);

  // ------------------------------------------------------------------------
  // 2. Stan aplikacji
  // ------------------------------------------------------------------------

  const state = {
    lang: readStoredLang(),   // 'en' (domyślnie) | 'pl' — patrz I18N
    currentScreen: SCREENS.ONBOARDING,
    busy: false,
    dayBusy: false,          // trwa POST /api/day/start (blokada podwójnego kliku)
    personas: [],            // list[DemoPersona] z GET /api/demo-personas
    activePersonaId: null,
    lastProfile: null,       // ostatni OnboardingRequest (do cichego ponowienia analyze po 404)
    session: null,           // OnboardingResponse
    turn: null,              // ostatni MissionTurnResponse (initial_mission_turn lub tura)
    microLessonBonusXp: 0,   // lokalny bonus z mikro-lekcji (reguła monotonicznego XP)
    completedLessons: new Set(),
    completedDays: new Set(), // ukończone dni sprintu 1–4 (z turn.completed_days)
    challenges: { acceptedDays: new Set(), rewards: {} }, // mini-wyzwania per dzień (1–4)
    checkpoint: { answers: {}, busy: false, result: null, passed: false },
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
    els.cardNextStep = byId('card-next-step');
    els.cardChallenge = byId('card-challenge');
    els.cardChecklist = byId('card-checklist');
    els.cardBank = byId('card-bank');
    els.cardLeaderboard = byId('card-leaderboard');
    els.cardAfter14 = byId('card-after14');
    els.complianceFooter = byId('compliance-footer');
    els.bankOrderContent = byId('bank-order-content');

    // Checkpoint #1
    els.cpHead = byId('checkpoint-head');
    els.cpForm = byId('checkpoint-form');
    els.cpQuestions = byId('checkpoint-questions');
    els.cpSubmit = byId('checkpoint-submit');
    els.cpResult = byId('checkpoint-result');
    els.cpAfter14 = byId('checkpoint-after14');
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

  // „33,844" (EN) / „33 844" (PL) — separator tysięcy zawsze, także dla 4 cyfr („1,214").
  function formatNumber(value) {
    const n = Math.round(Number(value) || 0);
    const sign = n < 0 ? '-' : '';
    const separator = state.lang === 'en' ? ',' : NBSP;
    return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  }

  function formatPLN(value) {
    return state.lang === 'en'
      ? formatNumber(value) + NBSP + 'PLN'
      : formatNumber(value) + NBSP + 'zł';
  }

  // Polska odmiana: 1 rok / 2–4 lata / 5+ lat (z wyjątkiem 12–14); EN: year/years.
  function pluralPL(n, one, few, many) {
    const abs = Math.abs(n);
    if (abs === 1) return one;
    const lastDigit = abs % 10;
    const lastTwo = abs % 100;
    return lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
  }

  function yearsLabel(n) {
    if (state.lang === 'en') return n + NBSP + (Math.abs(n) === 1 ? 'year' : 'years');
    return n + NBSP + pluralPL(n, 'rok', 'lata', 'lat');
  }

  function pluralDays(n) {
    if (state.lang === 'en') return Math.abs(n) === 1 ? 'day' : 'days';
    return n === 1 ? 'dzień' : 'dni';
  }

  // Odmiana rzeczownika „temat" dla badge’a Speakly (PL) / EN: topic(s).
  function pluralTopics(n) {
    return state.lang === 'en' ? (n === 1 ? 'topic' : 'topics') : pluralPL(n, 'temat', 'tematy', 'tematów');
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
  // 3b. Dni sprintu 1–4 (docs/01 §1–§2)
  // ------------------------------------------------------------------------

  // Bieżący dzień: tura misji > sesja (OnboardingResponse.current_day) > 1.
  function currentDay() {
    const fromTurn = state.turn && Number(state.turn.day);
    if (fromTurn >= 1 && fromTurn <= PLAYABLE_DAYS) return fromTurn;
    const fromSession = state.session && Number(state.session.current_day);
    if (fromSession >= 1 && fromSession <= PLAYABLE_DAYS) return fromSession;
    return 1;
  }

  function totalDays() {
    return (state.session && Number(state.session.total_program_days)) || SPRINT_DAYS;
  }

  // Ukończone dni: lokalny zbiór + turn.completed_days (źródło prawdy z backendu).
  function completedDaySet() {
    const days = new Set(state.completedDays);
    ((state.turn && state.turn.completed_days) || []).forEach((day) => {
      const n = Number(day);
      if (n >= 1 && n <= PLAYABLE_DAYS) days.add(n);
    });
    return days;
  }

  function isDayUnlocked(day) {
    const n = Number(day);
    if (!(n >= 1 && n <= PLAYABLE_DAYS)) return false;
    if (n === 1) return true;
    const done = completedDaySet();
    return done.has(n) || done.has(n - 1) || n <= currentDay();
  }

  // Nagłówek pokazuje Dzień z sesji — po /api/day/start i po turze synchronizujemy oba źródła.
  function syncSessionDay(day) {
    const n = Number(day);
    if (!(n >= 1 && n <= PLAYABLE_DAYS)) return;
    if (state.session) state.session.current_day = n;
    if (state.turn) state.turn = Object.assign({}, state.turn, { day: n });
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
    getDemoPersonas: () => apiRequest('/api/demo-personas?lang=' + encodeURIComponent(state.lang)),
    analyze: (profile) =>
      apiRequest('/api/onboarding/analyze', {
        method: 'POST',
        body: Object.assign({}, profile, { lang: state.lang }),
      }),
    // Wywołuj przez withSessionRecovery — przy 404 sesja jest po cichu odtwarzana (docs/02 §5).
    missionTurn: (payload) =>
      apiRequest('/api/mission/turn', {
        method: 'POST',
        body: Object.assign({ day: currentDay() }, payload, { lang: state.lang }),
      }),
    dayStart: (sessionId, day) =>
      apiRequest('/api/day/start', {
        method: 'POST',
        body: { session_id: sessionId, day, lang: state.lang },
      }),
    acceptChallenge: (sessionId, day) =>
      apiRequest('/api/challenge/accept', {
        method: 'POST',
        body: { session_id: sessionId, day: day || currentDay(), lang: state.lang },
      }),
    checkpointSubmit: (sessionId, answers) =>
      apiRequest('/api/checkpoint/submit', {
        method: 'POST',
        body: { session_id: sessionId, answers: answers || {}, lang: state.lang },
      }),
  };

  function describeApiError(err) {
    if (!(err instanceof ApiError)) return t('errorGeneric');
    if (err.kind === 'network') return t('errorNetwork');
    if (err.kind === 'timeout') return t('errorTimeout');
    if (err.status === 422) return t('error422');
    if (err.status === 404) return t('error404');
    return t('errorServer', { status: err.status });
  }

  // FastAPI 422: {"detail": [{"loc": ["body", "free_cash"], "msg": "..."}]}.
  // Walidator modelu (free_cash > net_income) ma loc ["body"] — rozpoznajemy po treści.
  function mapValidationErrors(data) {
    const errors = {};
    const messages = fieldMessages();
    const detail = data && Array.isArray(data.detail) ? data.detail : [];
    detail.forEach((item) => {
      const loc = Array.isArray(item.loc) ? item.loc : [];
      let field = loc.length > 1 ? String(loc[loc.length - 1]) : null;
      if (!field || !messages[field]) {
        field = /free_cash|net_income/.test(String(item.msg || '')) ? 'free_cash' : null;
      }
      if (field && !errors[field]) errors[field] = messages[field];
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
      const day = currentDay();
      const log = state.mission.log.slice();
      const token = state.mission.token;
      state.mission.restoring = (async () => {
        const data = await api.analyze(profile);
        if (day > 1) {
          await api.dayStart(data.session_id, day);
          data.current_day = day;
        }
        for (const entry of log) {
          await api.missionTurn(Object.assign({ session_id: data.session_id, day }, entry));
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

  // Tytuł poziomu zawsze w języku UI (backendowy tytuł bywa w języku startowym sesji).
  function levelTitleFor(level, fallback) {
    const n = Number(level) || 1;
    if (n >= 3) return t('levelSteady');
    if (n === 2) return t('levelConfident');
    if (n === 1) return t('levelObserver');
    return fallback || '';
  }

  function currentGamification() {
    return (state.turn && state.turn.gamification) || defaultGamification();
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

    // Poziom: ⭐ Poz. 1: Observer (XP) -> 🏆 Poz. 2+: Confident Start / Steady Builder
    els.levelIcon.textContent = g.level >= 2 ? '🏆' : '⭐';
    els.levelNum.textContent = g.level;
    els.levelTitle.textContent = levelTitleFor(g.level, g.level_title);
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
  // 5b. Język EN | PL (docs/01 §9)
  // ------------------------------------------------------------------------

  // Aktualizuje statyczne teksty z index.html (atrybuty data-i18n*) i metadane strony.
  function applyStaticTranslations() {
    state.lang = normalizeLang(state.lang);
    document.documentElement.lang = state.lang;
    document.title = t('pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('metaDescription'));

    const setText = (selector, attribute) => {
      Array.from(document.querySelectorAll(selector)).forEach((el) => {
        const key = el.getAttribute(attribute);
        if (!key) return;
        el.textContent = t(key);
        if (el.hasAttribute('data-label')) el.dataset.idleText = el.textContent;
      });
    };
    setText('[data-i18n]', 'data-i18n');

    Array.from(document.querySelectorAll('[data-i18n-placeholder]')).forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    Array.from(document.querySelectorAll('[data-i18n-aria]')).forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    Array.from(document.querySelectorAll('[data-i18n-title]')).forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });

    Array.from(document.querySelectorAll('[data-action="set-lang"]')).forEach((btn) => {
      btn.setAttribute('aria-pressed', String(normalizeLang(btn.dataset.lang) === state.lang));
    });
  }

  function persistLang(lang) {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (err) {
      // Tryb prywatny bez localStorage — język działa do końca sesji.
    }
  }

  // Pełne przełączenie języka w locie: statyczne teksty, formularz, nagłówek i bieżący ekran.
  async function setLanguage(nextLang) {
    const lang = normalizeLang(nextLang);
    if (lang === state.lang) {
      applyStaticTranslations();
      return;
    }
    state.lang = lang;
    persistLang(lang);
    applyStaticTranslations();
    syncFormOutputs();
    renderPersonaPills();
    renderHeader({ animate: false });

    if (state.currentScreen === SCREENS.FILTER && state.lastProfile) {
      await analyzeProfile(state.lastProfile);
    } else if (state.currentScreen === SCREENS.MISSION && state.turn) {
      renderMission({ animate: false });
    } else if (state.currentScreen === SCREENS.CHECKPOINT) {
      renderCheckpoint();
    } else if (state.currentScreen === SCREENS.CHECKLIST && state.turn) {
      renderSummary({ animate: false });
    }
    const modal = document.getElementById('modal_bank_order');
    if (modal && !modal.hidden) renderBankModal();
    if (timeMachineChart && state.timeMachine.year != null) {
      const series = (state.session && state.session.projection_series) || [];
      renderTimeMachineChart(series, state.timeMachine.year);
    }
    refreshIcons();
    loadPersonas();
  }

  // ↺ Reset / Profile — powrót do ankiety i wyboru profilu (bez przeładowania strony).
  function resetDemo() {
    const modal = document.getElementById('modal_bank_order');
    if (modal && !modal.hidden) closeModal('modal_bank_order');

    state.mission.token += 1;
    state.session = null;
    state.turn = null;
    state.activePersonaId = null;
    state.lastProfile = null;
    state.microLessonBonusXp = 0;
    state.completedLessons = new Set();
    state.completedDays = new Set();
    state.challenges = { acceptedDays: new Set(), rewards: {} };
    state.checkpoint = { answers: {}, busy: false, result: null, passed: false };
    state.timeMachine = { year: null, point: null };
    resetHeaderBaseline();
    resetMission();
    clearSummary();
    setBusy(false);

    // Domyślne wartości ankiety (docs/01 §7 Ekran 1): 35 lat, 6 000 zł netto, 1 000 zł wolnych.
    if (els.fAge) els.fAge.value = '35';
    if (els.fNet) els.fNet.value = '6000';
    if (els.fFree) els.fFree.value = '1000';
    if (els.form) {
      els.form.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.checked = false;
      });
    }
    clearFieldErrors();
    syncFormOutputs();
    renderPersonaPills();
    renderHeader({ animate: false });
    if (els.cpHead) els.cpHead.innerHTML = '';
    if (els.cpQuestions) els.cpQuestions.innerHTML = '';
    if (els.cpResult) {
      els.cpResult.hidden = true;
      els.cpResult.innerHTML = '';
    }
    if (els.cpAfter14) els.cpAfter14.innerHTML = '';
    showScreen(SCREENS.ONBOARDING);
  }

  // ------------------------------------------------------------------------
  // 6. Router ekranów
  // ------------------------------------------------------------------------

  function showScreen(id) {
    if (id === SCREENS.CHECKLIST && !summaryTurn()) {
      id = state.session ? SCREENS.FILTER : SCREENS.ONBOARDING;
    }
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
    if (id === SCREENS.FILTER && state.session) {
      // Powrót na mapę: odśwież fazy, ukończone dni i lekcje bieżącego dnia (bez resetu suwaka).
      renderRoadmap(state.session.roadmap_milestones, state.session.current_day, state.session.total_program_days);
      renderSpeakly(state.session.speakly_filter, state.session.micro_lessons);
      syncFilterCta();
      refreshIcons();
    }
    if (id === SCREENS.CHECKPOINT) renderCheckpoint();
    if (id === SCREENS.CHECKLIST) renderSummary({ animate: true });
  }

  // ------------------------------------------------------------------------
  // 7. Ekran 1 — ankieta (docs/01 §7 Ekran 1)
  // ------------------------------------------------------------------------

  function ageGroupLabel(age) {
    if (age < 30) return t('ageGroupYoung');
    if (age <= 50) return t('ageGroupMid');
    return t('ageGroupSenior');
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
    const messages = fieldMessages();
    const concerns = concernLabels();
    if (!(profile.age >= 18 && profile.age <= 70)) errors.age = messages.age;
    if (!(profile.net_income >= 2500 && profile.net_income <= 25000)) errors.net_income = messages.net_income;
    if (!(profile.free_cash >= 200 && profile.free_cash <= FREE_CASH_CAP && profile.free_cash <= profile.net_income)) {
      errors.free_cash = messages.free_cash;
    }
    if (fund == null) errors.has_emergency_fund = messages.has_emergency_fund;
    if (!concern || !concerns[concern]) errors.main_concern = messages.main_concern;
    if (!(profile.self_confidence_start >= 1 && profile.self_confidence_start <= 5)) {
      errors.self_confidence_start = messages.self_confidence_start;
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
      label.textContent = isBusy ? t('ctaBusy') : label.dataset.idleText;
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
    state.completedDays = new Set();
    state.challenges = { acceptedDays: new Set(), rewards: {} };
    state.checkpoint = { answers: {}, busy: false, result: null, passed: false };
    state.timeMachine = { year: null, point: null };
    resetHeaderBaseline();
    resetMission();
    renderMission({ animate: false });
  }

  // Wynik tury misji — nagłówek animuje wzrost XP i Gotowości, Ekran 3 pokazuje kolejny krok.
  function applyMissionTurn(turn) {
    state.turn = turn;
    if (turn && turn.day) syncSessionDay(turn.day);
    if (turn && turn.mission_completed) {
      (turn.completed_days || []).forEach((day) => {
        const n = Number(day);
        if (n >= 1 && n <= PLAYABLE_DAYS) state.completedDays.add(n);
      });
      if (turn.day) state.completedDays.add(Number(turn.day));
    }
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
          showToast(t('toastFixFields'), 'warn');
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
    // Pigułki są pod nakładką modala, ale osiągalne klawiaturą — modal zamykamy od razu.
    const modal = document.getElementById('modal_bank_order');
    if (modal && !modal.hidden) closeModal('modal_bank_order');
    let persona = findPersona(personaId);
    if (!persona) {
      await loadPersonas();
      persona = findPersona(personaId);
    }
    if (!persona) {
      showToast(t('toastPersonasFailed'), 'warn');
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
      showToast(t('toastFillFields'), 'warn');
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
    syncFilterCta();
    refreshIcons();
  }

  // CTA Ekranu 2 pokazuje bieżący dzień sprintu (Dni 1–4).
  function syncFilterCta() {
    const btn = document.querySelector('[data-goto="screen_mission_live"]');
    if (!btn) return;
    const label = btn.querySelector('[data-label]');
    if (label) label.textContent = t('ctaStartMissionDynamic', { day: currentDay() });
    btn.disabled = !state.session;
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
    const concerns = concernLabels();
    els.planIntro.innerHTML = [
      chip('user', data.persona_label, 'dark'),
      chip('calendar-clock', t('planIntroHorizon') + ' ' + yearsLabel(data.default_horizon_years)),
      chip(
        'heart-handshake',
        t('planIntroConcern') + ' ' + (concerns[data.main_concern] || data.main_concern)
      ),
    ].join('');
  }

  // Grupowanie kamieni milowych w 3 fazy (m.phase z backendu; fallback po numerze dnia).
  function phaseGroups(milestones) {
    const list = milestones || [];
    const groups = [];
    list.forEach((m) => {
      const key = m.phase || '';
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, items: [] };
        groups.push(group);
      }
      group.items.push(m);
    });
    if (groups.length === 1 && groups[0].items.length > 1) {
      const split = [
        { key: 'fallback-1', items: groups[0].items.filter((m) => Number(m.day) <= 4) },
        { key: 'fallback-2', items: groups[0].items.filter((m) => Number(m.day) > 4 && Number(m.day) <= 9) },
        { key: 'fallback-3', items: groups[0].items.filter((m) => Number(m.day) > 9) },
      ].filter((g) => g.items.length > 0);
      if (split.length > 1) return split;
    }
    return groups;
  }

  const PHASE_FALLBACK_KEYS = Object.freeze(['roadmapPhase1', 'roadmapPhase2', 'roadmapPhase3']);

  function phaseLabel(group, index) {
    if (group.key) return group.key;
    return t(PHASE_FALLBACK_KEYS[Math.min(index, PHASE_FALLBACK_KEYS.length - 1)]);
  }

  function checkpointBadgeHtml(index) {
    if (index === 0) {
      const passed = completedDaySet().has(4) || !!state.checkpoint.passed;
      return '<span class="fq-phase-badge" data-badge-state="' + (passed ? 'passed' : 'available') + '">' +
        escapeHtml(t('roadmapCheckpoint1')) + '</span>';
    }
    if (index === 1) {
      return '<span class="fq-phase-badge" data-badge-state="locked">' + escapeHtml(t('roadmapCheckpoint2')) + '</span>';
    }
    return '<span class="fq-phase-badge" data-badge-state="locked">' + escapeHtml(t('roadmapSprintFinale')) + '</span>';
  }

  function dayChipHtml(day) {
    const n = Number(day);
    const done = completedDaySet();
    const playable = n >= 1 && n <= PLAYABLE_DAYS;
    const unlocked = playable && isDayUnlocked(n);
    const isCurrent = playable && n === currentDay();
    const stateAttr = done.has(n) ? 'done' : isCurrent ? 'current' : unlocked ? 'available' : 'locked';
    const label = t('roadmapDayLabel', { day: n });
    const desc = unlocked ? t('roadmapDayAria', { day: n }) : t('roadmapLockedDayAria', { day: n });
    const mark = done.has(n) ? '<span aria-hidden="true">✓</span>' : '';
    if (!unlocked) {
      return '<span class="fq-day-chip" data-state="locked" aria-label="' + escapeHtml(desc) + '" aria-disabled="true">' +
        label + '</span>';
    }
    return '<button type="button" class="fq-day-chip" data-state="' + stateAttr + '" data-action="start-day" data-day="' + n + '" ' +
      'aria-label="' + escapeHtml(desc) + '">' + mark + label + '</button>';
  }

  // Karta A — 14-Day Confidence Sprint w 3 fazach (docs/01 §2 pkt 2, §7 Ekran 2).
  function renderRoadmap(milestones, currentDayValue, totalDaysValue) {
    const total = totalDaysValue || SPRINT_DAYS;
    const today = currentDayValue || currentDay();
    const done = completedDaySet();
    const milestoneDays = new Set((milestones || []).map((m) => Number(m.day)));
    const groups = phaseGroups(milestones);

    const track = Array.from({ length: total }, (_, i) => {
      const day = i + 1;
      const cls = done.has(day) ? 'done' : day === today ? 'active' : milestoneDays.has(day) ? 'checkpoint' : '';
      return '<span data-state="' + cls + '"></span>';
    }).join('');

    const phases = groups.map((group, index) => {
      const active = index === 0;
      const items = group.items.map((m) =>
        '<li class="flex items-start gap-2 text-sm">' +
          '<span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-extrabold text-brand-dark ring-1 ring-slate-200" aria-hidden="true">' + escapeHtml(m.day) + '</span>' +
          '<span class="min-w-0"><span class="block font-extrabold leading-snug">' + escapeHtml(m.title) + '</span>' +
          '<span class="mt-0.5 block text-xs leading-snug text-slate-500">' + escapeHtml(m.focus) + '</span></span>' +
        '</li>'
      ).join('');
      const hint = (group.items[0] && group.items[0].duration_hint) || '~5 min/day';
      // Phase 1 pokazuje wszystkie grywalne dni 1–4 (także te bez kamienia milowego).
      const chipDays = index === 0
        ? Array.from({ length: PLAYABLE_DAYS }, (_, i) => i + 1)
        : group.items.map((m) => Number(m.day));
      const chips = chipDays.map((day) => dayChipHtml(day)).join('');
      return (
        '<section class="fq-phase" data-phase-state="' + (active ? 'active' : 'locked') + '">' +
          '<div class="fq-phase-head">' +
            '<span class="fq-phase-title">' + escapeHtml(phaseLabel(group, index)) + '</span>' +
            '<span class="fq-phase-hint">' + escapeHtml(hint) + '</span>' +
            checkpointBadgeHtml(index) +
          '</div>' +
          '<p class="mt-1 text-[11px] font-bold uppercase tracking-wider ' + (active ? 'text-brand-yellow-dark' : 'text-slate-400') + '">' +
            escapeHtml(active ? t('roadmapAvailableNow') : t('roadmapPhaseLocked')) + '</p>' +
          '<div class="mt-3 flex flex-wrap gap-2">' + chips + '</div>' +
          '<ul class="mt-3 space-y-2">' + items + '</ul>' +
        '</section>'
      );
    }).join('');

    els.cardRoadmap.innerHTML =
      '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
        '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('roadmapTitlePhases')) + '</h3>' +
        '<span class="text-xs font-bold text-slate-500">' + escapeHtml(t('roadmapCompletedDays', { done: done.size })) + '</span>' +
      '</div>' +
      '<div class="mt-3 fq-day-track" aria-hidden="true">' + track + '</div>' +
      '<p class="mt-2 text-xs leading-relaxed text-slate-500">' + escapeHtml(t('roadmapSprintNote')) + '</p>' +
      '<div class="mt-4 space-y-3">' + phases + '</div>' +
      after14Html(state.session && state.session.post_14_paths, { compact: true });
  }

  // Krótki podgląd After Day 14 (pod mapą oraz jako sekcja na Ekranie 4 / po Checkpoincie).
  function after14Html(paths, options) {
    const list = paths || [];
    if (!list.length) return '';
    const compact = !!(options && options.compact);
    const cards = list.map((path) =>
      '<li class="fq-after14-card">' +
        '<div class="flex flex-wrap items-center gap-2">' +
          '<span class="fq-after14-badge">' + escapeHtml(path.badge || '') + '</span>' +
          '<span class="text-xs font-bold text-slate-500">' + escapeHtml(path.cadence || '') + '</span>' +
        '</div>' +
        '<p class="mt-1.5 font-extrabold leading-snug">' + escapeHtml(path.title) + '</p>' +
        '<p class="mt-1 text-sm leading-snug text-slate-600">' + escapeHtml(path.description) + '</p>' +
      '</li>'
    ).join('');
    return (
      '<section class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" data-after14>' +
        '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
          '<h4 class="font-extrabold tracking-tight">' + escapeHtml(t('roadmapAfter14Title')) + '</h4>' +
          (compact ? '<span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">' + escapeHtml(t('roadmapSprintFinale')) + '</span>' : '') +
        '</div>' +
        '<p class="mt-1 text-xs leading-relaxed text-slate-600">' + escapeHtml(t('roadmapAfter14Note')) + '</p>' +
        '<ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">' + cards + '</ul>' +
      '</section>'
    );
  }

  // Wstawia podgląd After Day 14 do kontenera (Ekran 4 / wynik Checkpointu).
  function renderAfter14(target, paths) {
    if (!target) return;
    const list = paths || (state.session && state.session.post_14_paths) || [];
    target.innerHTML = after14Html(list);
  }

  function renderLessonCard(lesson, done) {
    const action = done
      ? '<p class="mt-3 inline-flex min-h-tap items-center gap-2 text-sm font-extrabold text-emerald-700">' +
          '<i data-lucide="circle-check" class="h-5 w-5" aria-hidden="true"></i>' + escapeHtml(t('lessonDone', { xp: lesson.xp_reward })) + '</p>'
      : '<button type="button" data-action="complete-lesson" data-lesson-id="' + escapeHtml(lesson.id) + '" ' +
          'class="mt-3 inline-flex min-h-tap items-center gap-2 rounded-xl border-2 border-brand-dark/10 bg-white px-4 text-sm font-extrabold transition hover:border-brand-yellow hover:bg-brand-yellow/10">' +
          escapeHtml(t('lessonUnderstood', { xp: lesson.xp_reward })) + '</button>';
    return (
      '<article data-lesson-card="' + escapeHtml(lesson.id) + '" tabindex="-1" class="rounded-2xl border p-4 transition ' +
        (done ? 'border-etf-green/50 bg-etf-green/5' : 'border-slate-200 bg-white') + '">' +
        '<div class="flex items-start justify-between gap-3">' +
          '<h5 class="font-extrabold leading-snug">' + escapeHtml(lesson.title) + '</h5>' +
          '<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">' +
            '<i data-lucide="timer" class="h-3 w-3" aria-hidden="true"></i>' + escapeHtml(t('lessonSeconds', { seconds: lesson.duration_sec })) + '</span>' +
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

    const skipped =
      state.lang === 'en'
        ? t('speaklySkipped', { n })
        : t('speaklySkipped', { n, word: pluralTopics(n) });

    els.cardSpeakly.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
        '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('speaklyTitle')) + '</h3>' +
        '<span class="inline-flex items-center gap-1.5 rounded-full bg-etf-green/10 px-3 py-1.5 text-xs font-extrabold text-emerald-700 sm:text-sm">' +
          escapeHtml(skipped) + '</span>' +
      '</div>' +
      '<div class="mt-5 grid grid-cols-1 gap-6 md:grid-cols-5">' +
        '<div class="md:col-span-3">' +
          '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
            '<h4 class="font-extrabold">' + escapeHtml(t('lessonsTitle')) + '</h4>' +
            '<span class="text-xs text-slate-500">' + escapeHtml(t('lessonsOptional', { xp: maxBonus })) + '</span>' +
          '</div>' +
          '<div class="mt-3 space-y-3">' + lessonCards + '</div>' +
        '</div>' +
        '<div class="md:col-span-2">' +
          '<h4 class="font-extrabold">' + escapeHtml(t('prioritiesTitle')) + '</h4>' +
          '<ul class="mt-3 space-y-2">' + keptList + '</ul>' +
          '<h4 class="mt-6 font-extrabold text-slate-500">' + escapeHtml(t('skippedTitle')) + '</h4>' +
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
    const perMonth = NBSP + t('splitPerMonth');
    const amount = (value, extraClass) =>
      '<span class="tabular-nums ' + (extraClass || '') + '" data-count="' + Number(value || 0) + '">0</span>';
    const label =
      '<p class="text-xs font-bold uppercase tracking-wider text-slate-500">' +
      escapeHtml(t('splitLabel')) + '</p>';
    let body = '';

    if (a.plan_type === 'split') {
      const total = Math.max(1, (a.emergency_savings_monthly || 0) + (a.training_etf_monthly || 0));
      const cushionPct = Math.round(((a.emergency_savings_monthly || 0) / total) * 100);
      body =
        label +
        '<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">' +
          '<div class="rounded-2xl bg-brand-dark p-4 text-white">' +
            '<p class="flex items-center gap-1.5 text-xs font-bold text-white/70"><i data-lucide="shield" class="h-4 w-4" aria-hidden="true"></i>' + escapeHtml(t('splitCushion')) + '</p>' +
            '<p class="mt-1 text-2xl font-extrabold sm:text-3xl">' + amount(a.emergency_savings_monthly) + perMonth + '</p>' +
          '</div>' +
          '<div class="rounded-2xl border border-etf-green/30 bg-etf-green/10 p-4">' +
            '<p class="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><i data-lucide="sprout" class="h-4 w-4" aria-hidden="true"></i>' + escapeHtml(t('splitEtf')) + '</p>' +
            '<p class="mt-1 text-2xl font-extrabold sm:text-3xl">' + amount(a.training_etf_monthly) + perMonth + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden="true">' +
          '<div class="bg-brand-dark" style="width: ' + cushionPct + '%"></div>' +
          '<div class="bg-etf-green" style="width: ' + (100 - cushionPct) + '%"></div>' +
        '</div>' +
        '<p class="mt-1.5 text-xs font-semibold text-slate-500">' +
          escapeHtml(t('splitShare', { cushion: cushionPct, etf: 100 - cushionPct })) + '</p>';
    } else if (a.plan_type === 'invest') {
      body =
        label +
        '<p class="mt-2 text-3xl font-extrabold sm:text-4xl">' + amount(a.min_monthly) + ' – ' + amount(a.max_monthly) + perMonth + '</p>' +
        '<p class="mt-1 text-sm text-slate-600">' + escapeHtml(t('splitSim')) + ' <strong class="tabular-nums text-brand-dark">' +
          formatPLN(a.recommended_monthly) + escapeHtml(t('splitPerMonth')) + '</strong> ' + escapeHtml(t('splitSimEtf')) + '</p>';
    } else {
      // savings_first — najpierw poduszka; ETF tylko jako przykład (illustrative_only).
      body =
        label +
        '<div class="mt-3 rounded-2xl bg-brand-dark p-4 text-white">' +
          '<p class="flex items-center gap-1.5 text-xs font-bold text-white/70"><i data-lucide="shield" class="h-4 w-4" aria-hidden="true"></i>' + escapeHtml(t('splitCushion')) + '</p>' +
          '<p class="mt-1 text-2xl font-extrabold sm:text-3xl">' + amount(a.emergency_savings_monthly) + perMonth + '</p>' +
        '</div>' +
        '<span class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">' +
          '<i data-lucide="clock" class="h-3.5 w-3.5" aria-hidden="true"></i>' +
          escapeHtml(t('splitLater', { amount: formatNumber(a.recommended_monthly) })) + '</span>';
    }

    els.cardSplit.innerHTML =
      '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('splitTitle')) + '</h3>' +
      '<div class="mt-4">' + body + '</div>' +
      '<p class="mt-4 text-sm leading-relaxed text-slate-600">' + escapeHtml(a.reasoning) + '</p>';
  }

  // Karta D — Wehikuł Czasu: suwak 1–20 lat, 3 KPI w dzisiejszych zł, wykres z punktem Rok 0.
  function setupTimeMachine(data) {
    els.tmYears.value = String(data.default_horizon_years);
    els.tmMonthly.textContent = formatPLN(data.safe_investment.recommended_monthly) + t('splitPerMonth');
    els.tmAssumptions.textContent = data.assumptions ? data.assumptions.text : '';
    els.tmCompliance.textContent = t('complianceText');
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
      labels: [t('chartYearZero')].concat(points.map((p) => t('chartYear', { year: p.year }))),
      etf: [0].concat(points.map((p) => p.etf_real_value)),
      cash: [0].concat(points.map((p) => p.cash_real_value)),
      stress: [0].concat(points.map((p) => p.etf_stress_real_value)),
    };
  }

  function compactPLN(value) {
    if (Math.abs(value) >= 1000) {
      const scaled = value / 1000;
      if (state.lang === 'en') {
        return scaled.toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k';
      }
      return scaled.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + NBSP + 'tys.';
    }
    return formatNumber(value);
  }

  function renderTimeMachineChart(series, year) {
    if (!window.Chart || !els.tmChart) return;
    const d = timeMachineChartData(series, year);

    if (timeMachineChart) {
      timeMachineChart.data.labels = d.labels;
      timeMachineChart.data.datasets[0].label = t('chartEtf');
      timeMachineChart.data.datasets[0].data = d.etf;
      timeMachineChart.data.datasets[1].label = t('chartCash');
      timeMachineChart.data.datasets[1].data = d.cash;
      timeMachineChart.data.datasets[2].label = t('chartStress');
      timeMachineChart.data.datasets[2].data = d.stress;
      if (timeMachineChart.options.scales && timeMachineChart.options.scales.y) {
        timeMachineChart.options.scales.y.title.text = t('chartAxis');
      }
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
            label: t('chartEtf'),
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
            label: t('chartCash'),
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
            label: t('chartStress'),
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
            title: { display: true, text: t('chartAxis'), font: { size: 11, weight: '600' } },
            ticks: { callback: (value) => compactPLN(value) },
          },
        },
      },
    });
  }

  // ------------------------------------------------------------------------
  // 10. Ekran 3 — symulacja wyborów z Corą (docs/01 §7 Ekran 3, docs/02 §4)
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
    clearSummary();
  }

  // Nowa sesja: zamknięty modal i pusty Ekran 4 (bez resztek poprzedniej persony w DOM).
  function clearSummary() {
    const modal = document.getElementById('modal_bank_order');
    if (modal && !modal.hidden) closeModal('modal_bank_order');
    [els.cardLevelup, els.cardNextStep, els.cardChallenge, els.cardChecklist, els.cardBank,
      els.cardLeaderboard, els.cardAfter14, els.complianceFooter, els.bankOrderContent]
      .forEach((el) => { if (el) el.innerHTML = ''; });
  }

  function renderMission(options) {
    const turn = state.turn;
    if (!turn || !els.msLunaMessage) return;
    const animate = !options || options.animate !== false;
    const s = state.session;
    const completed = turn.mission_completed === true;
    const total = turn.total_steps || 3;
    const step = clamp(turn.step_number || 1, 1, total);

    // Mini-panel: Dzień X z 14 • Symulacja wyborów • Krok N z 3
    els.msDay.textContent = s ? s.current_day : 1;
    const screenTitle = document.getElementById('screen_mission_title');
    if (screenTitle) screenTitle.textContent = t('screenMissionTitleDynamic', { day: s ? s.current_day || 1 : 1 });
    els.msTotalDays.textContent = s ? s.total_program_days : 14;
    els.msStep.textContent = step;
    els.msTotalSteps.textContent = total;
    Array.from(els.msSteps.children).forEach((bar, i) => {
      const n = i + 1;
      bar.hidden = n > total;
      bar.dataset.state = completed || n < step ? 'done' : n === step ? 'current' : 'todo';
    });
    const portfolio = turn.portfolio_status || { simulated_value: 0, event_badge: '' };
    els.msBadgeText.textContent = portfolio.event_badge || '';
    const value = Number(portfolio.simulated_value) || 0;
    if (animate && value !== state.mission.renderedValue) {
      animateNumber(els.msValue, state.mission.renderedValue, value, { duration: 900 });
    } else {
      setNumber(els.msValue, value);
    }
    state.mission.renderedValue = value;

    renderMissionFeedback(turn, animate);
    els.msLunaMessage.textContent = turn.luna_message || '';
    if (animate) replayClass(els.msLuna, 'screen-enter');

    // Po ostatnim kroku dnia znikają karty i pole tekstowe, pojawia się CTA na Ekran 4.
    renderQuickReplies(completed ? [] : turn.quick_replies || []);
    els.msInteraction.hidden = completed;
    els.ctaFinishDay.hidden = !completed;
    const ctaLabel = els.ctaFinishDay.querySelector('[data-label]');
    if (ctaLabel) ctaLabel.textContent = t('ctaFinishDayDynamic', { day: s ? s.current_day || 1 : 1 });
    refreshIcons();
  }

  function shortAnswer(text) {
    const value = String(text || '');
    return value.length > ANSWER_PREVIEW_MAX ? value.slice(0, ANSWER_PREVIEW_MAX - 1).trimEnd() + '…' : value;
  }

  // Karta feedbacku: zielona (optimal), ciepły bursztyn (partial), czerwień + 0 XP (allow_retry).
  function renderMissionFeedback(turn, animate) {
    const retry = turn.allow_retry === true || turn.answer_quality === 'invalid';
    const visible = (turn.is_optimal_choice != null || retry) && !!turn.understanding_feedback;
    els.msFeedback.hidden = !visible;
    if (!visible) return;
    const good = turn.is_optimal_choice === true;
    const g = turn.gamification || defaultGamification();
    els.msFeedback.dataset.tone = retry ? 'retry' : good ? 'good' : 'warm';
    els.msFeedbackTitle.textContent = retry
      ? t('feedbackRetryTitle')
      : good ? t('feedbackGood') : t('feedbackTip');
    const answer = state.mission.lastAnswer;
    els.msFeedbackAnswer.hidden = !answer;
    els.msFeedbackAnswer.textContent = answer
      ? t('feedbackAnswer', { answer: shortAnswer(answer) })
      : '';
    els.msFeedbackText.textContent = turn.understanding_feedback;
    els.msFeedbackXp.textContent = retry
      ? t('feedbackZeroXp')
      : '+' + (g.xp_gained || 0) + NBSP + 'XP';
    const delta = Number(turn.confidence_delta) || 0;
    els.msFeedbackReadiness.hidden = delta <= 0;
    els.msFeedbackReadiness.textContent = t('feedbackReadiness', { delta });
    els.msFeedbackLevel.hidden = !g.leveled_up;
    els.msFeedbackLevel.textContent = t('feedbackLevel', { level: g.level, title: levelTitleFor(g.level, g.level_title) });
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

  // Blokada kontrolek na czas żądania (zero dubli). Kropki „Cora analizuje…" tylko dla wolnego tekstu.
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
    if (label) label.textContent = thinking ? t('msSending') : t('msSend');
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
    if (err instanceof ApiError && err.status === 422) return t('errorMessageLength', { max: MISSION_MESSAGE_MAX });
    if (isSessionMissing(err)) return t('errorRestoreSession');
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
      // Rygorystyczna ocena: invalid/allow_retry nie przechodzi dalej, 0 XP i brak konfetti.
      const retry = turn.allow_retry === true || turn.answer_quality === 'invalid';
      m.lastAnswer = text;
      if (!retry) {
        m.log.push(payload);
        els.msInput.value = '';
        syncMissionCounter();
      }
      setMissionBusy(false);
      applyMissionTurn(turn);
      if (!retry && turn.trigger_confetti === true) fireConfetti('micro');
      if (retry) {
        // Pole tekstowe i karty zostają aktywne — użytkownik poprawia odpowiedź.
        revealElement(els.msFeedback);
        if (!quickReplyId) els.msInput.focus();
      } else {
        revealMissionResult();
      }
      if (!retry && turn.mission_completed) els.ctaFinishDay.focus({ preventScroll: true });
      return !retry;
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
      showToast(t('toastWriteMore'), 'info', 2400);
      return;
    }
    sendMissionAnswer({ text });
  }

  // ------------------------------------------------------------------------
  // 10b. Dni 1–4 (POST /api/day/start), skrót Demo Mode i Checkpoint #1
  // ------------------------------------------------------------------------

  // Skok do wybranego dnia: ładuje mikro-lekcje dnia + Krok 1, zachowuje XP i Gotowość.
  async function startDay(day) {
    const target = Number(day);
    if (!(target >= 1 && target <= PLAYABLE_DAYS)) return false;
    if (!state.session || state.mission.busy || state.dayBusy) return false;
    state.dayBusy = true;
    const token = state.mission.token;
    try {
      const data = await withSessionRecovery((sessionId) => api.dayStart(sessionId, target));
      if (token !== state.mission.token) return false;
      state.session.current_day = data.day;
      if (Array.isArray(data.micro_lessons) && data.micro_lessons.length) {
        state.session.micro_lessons = data.micro_lessons;
      }
      state.turn = data.initial_mission_turn;
      state.summary = freshSummary();
      state.checkpoint = { answers: {}, busy: false, result: null, passed: state.checkpoint.passed };
      state.mission.log = [];
      state.mission.lastAnswer = null;
      state.mission.renderedValue = 0;
      if (els.msInput) els.msInput.value = '';
      syncMissionCounter();
      clearSummary();
      resetHeaderBaseline();
      renderHeader({ animate: false });
      renderMission({ animate: true });
      showScreen(SCREENS.MISSION);
      showToast(t('dayStartedToast', { day: data.day }), 'info', 2000);
      return true;
    } catch (err) {
      showToast(t('errorDayStart'), 'warn');
      return false;
    } finally {
      state.dayBusy = false;
    }
  }

  // Demo Mode: jeśli nie ma sesji, najpierw analiza domyślnej persony `young_20`.
  const DEFAULT_DEMO_PROFILE = Object.freeze({
    age: 22,
    net_income: 4500,
    free_cash: 1000,
    has_emergency_fund: false,
    main_concern: 'freeze_money',
    self_confidence_start: 2,
  });

  async function ensureDemoSession() {
    if (state.session) return true;
    if (state.busy) return false;
    let persona = findPersona('young_20');
    if (!persona) {
      await loadPersonas();
      persona = findPersona('young_20');
    }
    const profile = persona ? profileFromPersona(persona) : Object.assign({}, DEFAULT_DEMO_PROFILE);
    if (persona) {
      state.activePersonaId = persona.id;
      renderPersonaPills();
      fillOnboardingForm(profile);
    }
    const data = await analyzeProfile(profile);
    return !!data;
  }

  async function demoJumpToDay(day) {
    if (!(await ensureDemoSession())) return;
    await startDay(Number(day) || PLAYABLE_DAYS);
  }

  async function demoOpenCheckpoint() {
    if (!(await ensureDemoSession())) return;
    showScreen(SCREENS.CHECKPOINT);
  }

  // Aktualizacja XP/poziomu po odpowiedzi serwera (wyzwanie, Checkpoint #1).
  function applyServerXp(xp, leveledUp) {
    const prev = currentGamification();
    const total = Number(xp);
    const next = Object.assign({}, prev, levelForXp(Number.isFinite(total) ? total : prev.xp), {
      xp: Number.isFinite(total) ? total : prev.xp,
      leveled_up: !!leveledUp,
    });
    if (state.turn) state.turn = Object.assign({}, state.turn, { gamification: next });
    renderHeader();
  }

  function checkpointQuestions() {
    return (state.session && state.session.checkpoint_questions) || [];
  }

  function checkpointAnsweredCount() {
    const answers = state.checkpoint.answers || {};
    return checkpointQuestions().filter((q) => !!answers[q.id]).length;
  }

  function cpQuestionIndex(question) {
    const id = question.id;
    return checkpointQuestions().findIndex((q) => q.id === id);
  }

  function cpOptionText(questionId, optionId) {
    const question = checkpointQuestions().find((q) => q.id === questionId);
    const option = question && (question.options || []).find((o) => o.id === optionId);
    return option ? option.text : optionId;
  }

  function renderCheckpointHead(total) {
    const answered = checkpointAnsweredCount();
    const pct = total ? Math.round((answered / total) * 100) : 0;
    const passed = !!state.checkpoint.passed;
    els.cpHead.innerHTML =
      '<div class="rounded-3xl bg-brand-dark p-5 text-white shadow-xl shadow-slate-200/60 sm:p-6">' +
        '<div class="flex flex-wrap items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
            '<h3 class="text-xl font-extrabold leading-tight tracking-tight text-brand-yellow sm:text-2xl">' +
              escapeHtml(t('cpIntroTitle')) + '</h3>' +
            '<p class="mt-1 text-sm leading-relaxed text-white/80">' + escapeHtml(t('cpIntroBody')) + '</p>' +
            '<p class="mt-2 text-xs font-bold text-white/60">' + escapeHtml(t('cpThreshold')) + '</p>' +
          '</div>' +
          (passed
            ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-etf-green px-3 py-1 text-xs font-extrabold text-white">' +
                '<i data-lucide="check" class="h-3.5 w-3.5" aria-hidden="true"></i>' + escapeHtml(t('roadmapCheckpoint1')) + '</span>'
            : '<span class="fq-phase-badge" data-badge-state="available">' + escapeHtml(t('roadmapCheckpoint1')) + '</span>') +
        '</div>' +
        '<div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-white/70">' +
          '<span>' + escapeHtml(t('cpProgress', { answered, total })) + '</span>' +
          '<span class="tabular-nums">' + pct + '%</span>' +
        '</div>' +
        '<div class="mt-2 fq-cp-progress" role="progressbar" aria-label="' + escapeHtml(t('cpProgress', { answered, total })) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
          '<span style="width: ' + pct + '%"></span>' +
        '</div>' +
      '</div>';
  }

  function renderCheckpointQuestion(question, index) {
    const chosen = state.checkpoint.answers[question.id];
    const options = (question.options || []).map((option, i) =>
      '<label class="fq-cp-option' + (chosen === option.id ? ' is-selected' : '') + '">' +
        '<input type="radio" name="cp_' + escapeHtml(question.id) + '" value="' + escapeHtml(option.id) + '" class="sr-only"' +
          (chosen === option.id ? ' checked' : '') + '>' +
        '<span class="fq-cp-key" aria-hidden="true">' + (REPLY_KEYS[i] || i + 1) + '</span>' +
        '<span class="min-w-0">' + escapeHtml(option.text) + '</span>' +
      '</label>'
    ).join('');
    return (
      '<fieldset class="fq-cp-question" data-question-id="' + escapeHtml(question.id) + '">' +
        '<legend class="flex flex-wrap items-center gap-2">' +
          '<span class="rounded-full bg-brand-dark/5 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">' +
            escapeHtml(t('cpQuestion', { n: index + 1 })) + '</span>' +
          '<span class="text-base font-extrabold leading-snug">' + escapeHtml(question.question) + '</span>' +
        '</legend>' +
        '<div class="mt-3 grid gap-2">' + options + '</div>' +
      '</fieldset>'
    );
  }

  function renderCheckpoint() {
    if (!els.cpQuestions || !els.cpHead) return;
    const questions = checkpointQuestions();
    const result = state.checkpoint.result;
    els.cpResult.hidden = true;
    els.cpResult.innerHTML = '';
    els.cpAfter14.innerHTML = '';

    if (!questions.length) {
      els.cpHead.innerHTML =
        '<div class="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600">' +
          escapeHtml(t('cpEmpty')) + '</div>';
      els.cpQuestions.innerHTML = '';
      els.cpSubmit.disabled = true;
      refreshIcons();
      return;
    }

    renderCheckpointHead(questions.length);
    els.cpQuestions.innerHTML = questions.map(renderCheckpointQuestion).join('');
    els.cpSubmit.disabled = false;
    renderAfter14(els.cpAfter14, state.session.post_14_paths);
    if (result) renderCheckpointResult(result);
    refreshIcons();
  }

  function setCheckpointBusy(isBusy) {
    if (!els.cpSubmit) return;
    els.cpSubmit.disabled = isBusy;
    els.cpQuestions.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.disabled = isBusy;
    });
    const label = els.cpSubmit.querySelector('[data-label]');
    if (label) label.textContent = isBusy ? t('cpSubmitting') : t('cpSubmit');
    const spinner = els.cpSubmit.querySelector('.fq-spinner');
    const idleIcon = els.cpSubmit.querySelector('[data-idle-icon]');
    if (spinner) spinner.hidden = !isBusy;
    if (idleIcon) idleIcon.toggleAttribute('hidden', isBusy);
  }

  async function submitCheckpoint(event) {
    if (event) event.preventDefault();
    const questions = checkpointQuestions();
    if (!questions.length || state.checkpoint.busy) return;
    const missing = questions.some((q) => !state.checkpoint.answers[q.id]);
    if (missing) {
      showToast(t('cpIncomplete'), 'warn');
      return;
    }
    state.checkpoint.busy = true;
    setCheckpointBusy(true);
    try {
      const res = await withSessionRecovery((sessionId) =>
        api.checkpointSubmit(sessionId, state.checkpoint.answers)
      );
      state.checkpoint.result = res;
      state.checkpoint.passed = !!res.passed;
      state.summary.leaderboard = Array.isArray(res.leaderboard) ? res.leaderboard : state.summary.leaderboard;
      applyServerXp(res.xp, res.leveled_up);
      if (res.passed) state.completedDays.add(PLAYABLE_DAYS);
      renderCheckpointResult(res);
      if (res.passed) fireConfetti('full');
    } catch (err) {
      showToast(t('cpErrorMessage'), 'warn');
    } finally {
      state.checkpoint.busy = false;
      setCheckpointBusy(false);
    }
  }

  function renderCheckpointResult(res) {
    if (!els.cpResult) return;
    const passed = !!res.passed;
    const results = res.results || [];
    const rows = results.map((item, i) => {
      const question = checkpointQuestions().find((q) => q.id === item.id);
      const correctText = cpOptionText(item.id, item.correct_option_id);
      return (
        '<li class="rounded-2xl border p-3 ' + (item.correct ? 'border-etf-green/50 bg-etf-green/5' : 'border-inflation-red/40 bg-rose-50') + '">' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<span class="rounded-full px-2 py-0.5 text-[11px] font-extrabold ' +
              (item.correct ? 'bg-etf-green text-white' : 'bg-inflation-red text-white') + '">' +
              escapeHtml(item.correct ? t('cpCorrect') : t('cpIncorrect')) + '</span>' +
            '<span class="text-xs font-bold text-slate-500">' + escapeHtml(t('cpQuestion', { n: i + 1 })) + '</span>' +
          '</div>' +
          (question ? '<p class="mt-1.5 font-extrabold leading-snug">' + escapeHtml(question.question) + '</p>' : '') +
          '<p class="mt-1 text-sm leading-snug text-slate-600">' + escapeHtml(item.explanation) + '</p>' +
          '<p class="mt-1 text-xs font-bold text-slate-500">' +
            escapeHtml(t('cpCorrectAnswer', { answer: correctText })) + '</p>' +
        '</li>'
      );
    }).join('');

    els.cpResult.hidden = false;
    els.cpResult.innerHTML =
      '<div class="rounded-3xl border-2 p-5 shadow-xl shadow-slate-200/60 sm:p-6 ' +
        (passed ? 'border-etf-green/60 bg-white' : 'border-stress-amber/60 bg-white') + '">' +
        '<div class="flex flex-wrap items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
            '<h3 class="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl ' +
              (passed ? 'text-emerald-700' : 'text-amber-700') + '">' +
              (passed ? '🎉 ' : '') + escapeHtml(passed ? t('cpPassed') : t('cpFailed')) + '</h3>' +
            '<p class="mt-1 text-3xl font-extrabold tabular-nums text-brand-dark">' + escapeHtml(String(res.score_pct)) + '%</p>' +
            '<p class="mt-0.5 text-sm font-bold text-slate-600">' +
              escapeHtml(t('cpCorrectCount', { correct: res.correct_count, total: res.total_questions })) + '</p>' +
          '</div>' +
          (passed
            ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1.5 text-xs font-extrabold text-brand-yellow">' +
                '<i data-lucide="award" class="h-4 w-4" aria-hidden="true"></i>' +
                escapeHtml(t('cpBadgeEarned', { badge: res.badge_title })) + '</span>'
            : '<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">' +
                escapeHtml(t('cpThreshold')) + '</span>') +
        '</div>' +
        '<div class="mt-3 flex flex-wrap items-center gap-2">' +
          (res.reward_xp > 0
            ? '<span class="fq-pill fq-pill--xp tabular-nums">' + escapeHtml(t('cpReward', { xp: res.reward_xp })) + '</span>'
            : '') +
          '<span class="fq-pill tabular-nums">' + formatNumber(res.xp) + NBSP + 'XP</span>' +
        '</div>' +
        '<h4 class="mt-5 font-extrabold">' + escapeHtml(t('cpResultsTitle')) + '</h4>' +
        '<ol class="mt-3 space-y-2">' + rows + '</ol>' +
        '<div class="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">' +
          (passed ? '' :
            '<button type="button" data-action="retry-checkpoint" class="btn-3d w-full sm:w-auto">' +
              '<i data-lucide="rotate-ccw" class="h-5 w-5" aria-hidden="true"></i>' +
              '<span>' + escapeHtml(t('cpRetry')) + '</span></button>') +
          '<button type="button" data-goto="screen_checklist" class="inline-flex min-h-tap w-full items-center justify-center rounded-2xl border-2 border-brand-dark/10 bg-white px-4 font-extrabold transition hover:border-brand-yellow hover:bg-brand-yellow/10 sm:w-auto">' +
            escapeHtml(t('cpBackToSummary')) + '</button>' +
        '</div>' +
      '</div>';
    refreshIcons();
  }

  function retryCheckpoint() {
    state.checkpoint = { answers: {}, busy: false, result: null, passed: state.checkpoint.passed };
    renderCheckpoint();
  }


  // ------------------------------------------------------------------------
  // 11. Ekran 4 — ukończenie dnia, wyzwanie, checklista, plan, ranking (docs/01 §7 Ekran 4)
  // ------------------------------------------------------------------------

  const CARD_CLASS = 'rounded-3xl border border-slate-100 bg-card-bg p-5 shadow-xl shadow-slate-200/60 sm:p-6';
  // „Przetestuj inne pokolenie (Demo)": 22 l. -> 56 l. (Golden Path), 56 l. -> 38 l., 38 l. -> 22 l.
  const NEXT_GENERATION = Object.freeze({ '20+': 'senior_56', '50+': 'mid_38', '30-50': 'young_20' });

  function freshSummary() {
    return {
      challengeBusy: false,
      challengeAccepted: false,
      challengeReward: 0,
      leveledViaChallenge: false, // próg 100/250 XP przekroczony dopiero dzięki wyzwaniu (+50 XP)
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
    if (xp >= LEVEL_FLOOR_XP[3]) return { level: 3, level_title: t('levelSteady'), next_level_xp: 500 };
    if (xp >= LEVEL_FLOOR_XP[2]) return { level: 2, level_title: t('levelConfident'), next_level_xp: 250 };
    return { level: 1, level_title: t('levelObserver'), next_level_xp: 100 };
  }

  function summaryTurn() {
    const turn = state.turn;
    return turn && turn.mission_completed ? turn : null;
  }

  // Awans: z tury finałowej (gamification.leveled_up) albo dzięki +50 XP z wyzwania.
  function userLeveledUp(turn) {
    return !!(turn && turn.gamification && turn.gamification.leveled_up) || state.summary.leveledViaChallenge;
  }

  function renderSummary(options) {
    const turn = summaryTurn();
    if (!turn || !els.cardLevelup) return;
    const animate = !!(options && options.animate);
    const dayForTitle = Number(turn.day) || currentDay();
    const checklistTitle = document.getElementById('screen_checklist_title');
    if (checklistTitle) checklistTitle.textContent = t('screenChecklistTitleDynamic', { day: dayForTitle });
    renderLevelBanner(turn, { pop: animate });
    renderNextStepCard(turn);
    renderChallengeCard(turn);
    renderChecklistCard(turn);
    renderBankCard(turn);
    renderLeaderboardCard(turn);
    renderAfter14(els.cardAfter14, (state.session && state.session.post_14_paths) || turn.post_14_paths);
    els.complianceFooter.innerHTML =
      '<div class="space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs leading-relaxed text-slate-500">' +
        '<p><i data-lucide="scale" class="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true"></i>' +
          escapeHtml(t('complianceText')) + '</p>' +
        '<p class="fq-ai-disclaimer font-bold"><i data-lucide="sparkles" class="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true"></i>' +
          escapeHtml(t('aiDisclaimer')) + '</p>' +
      '</div>';
    refreshIcons();
  }

  // CTA wielodniowe: Continue to Day X (Dni 1–3) albo Checkpoint #1 (po Dniu 4).
  function renderNextStepCard(turn) {
    if (!els.cardNextStep) return;
    const day = Number(turn.day) || currentDay();
    if (!turn.mission_completed) {
      els.cardNextStep.innerHTML = '';
      return;
    }
    const done = completedDaySet();
    const progress = t('nextStepProgress', { done: done.size });
    const progressBar =
      '<div class="mt-3 fq-cp-progress" aria-hidden="true"><span style="width: ' +
        Math.round((Math.min(done.size, PLAYABLE_DAYS) / PLAYABLE_DAYS) * 100) + '%"></span></div>';

    let action = '';
    if (day >= PLAYABLE_DAYS) {
      const passed = !!state.checkpoint.passed;
      action =
        '<button type="button" data-action="open-checkpoint" class="btn-3d mt-4 w-full text-base sm:w-auto">' +
          '<i data-lucide="clipboard-check" class="h-5 w-5" aria-hidden="true"></i>' +
          '<span>' + escapeHtml(t(passed ? 'nextStepCheckpointReview' : 'nextStepCheckpoint')) + '</span>' +
          '<i data-lucide="arrow-right" class="h-5 w-5" aria-hidden="true"></i></button>' +
        '<p class="mt-2 text-sm leading-relaxed text-slate-600">' + escapeHtml(t('nextStepCheckpointHint')) + '</p>';
    } else {
      const next = day + 1;
      const unlocked = isDayUnlocked(next);
      action =
        '<button type="button" data-action="start-day" data-day="' + next + '" class="btn-3d mt-4 w-full text-base sm:w-auto"' +
          (unlocked ? '' : ' disabled') + '>' +
          '<i data-lucide="arrow-right" class="h-5 w-5" aria-hidden="true"></i>' +
          '<span>' + escapeHtml(t('nextStepContinue', { day: next })) + '</span></button>' +
        '<p class="mt-2 text-sm leading-relaxed text-slate-600">' + escapeHtml(t('nextStepContinueHint', { day: next })) + '</p>';
    }

    els.cardNextStep.innerHTML =
      '<div class="rounded-3xl border-2 border-brand-yellow/70 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">' +
        '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('nextStepTitle')) + '</h3>' +
          '<span class="inline-flex items-center gap-1.5 rounded-full bg-etf-green/10 px-3 py-1 text-xs font-extrabold text-emerald-700">' +
            '<i data-lucide="check" class="h-3.5 w-3.5" aria-hidden="true"></i>' +
            escapeHtml(t('nextStepDayDone', { day })) + '</span>' +
        '</div>' +
        '<p class="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">' + escapeHtml(progress) + '</p>' +
        progressBar +
        '<div class="mt-4 flex flex-wrap gap-2">' + Array.from({ length: PLAYABLE_DAYS }, (_, i) => dayChipHtml(i + 1)).join('') + '</div>' +
        action +
        '<button type="button" data-goto="screen_filter_and_timemachine" class="mt-3 inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-brand-dark">' +
          escapeHtml(t('nextStepReviewMap')) + '</button>' +
      '</div>';
    refreshIcons();
  }

  // Baner (pełna szerokość): awans albo „brakuje X XP", Gotowość start -> wynik, samoocena „po".
  function renderLevelBanner(turn, options) {
    const pop = !!(options && options.pop);
    const g = turn.gamification;
    const s = state.session;
    const leveled = userLeveledUp(turn);
    const dayNum = s ? s.current_day : 1;
    const totalDays = s ? s.total_program_days : 14;
    const title = leveled
      ? t('levelBannerLeveled', { day: dayNum, total: totalDays, title: levelTitleFor(g.level, g.level_title) })
      : t('levelBannerDone', { day: dayNum, total: totalDays });
    const start = clamp(Number(turn.confidence_start) || 0, 0, 100);
    const score = clamp(Number(turn.confidence_score) || 0, start, 100);
    const missing = Math.max(0, LEVEL_FLOOR_XP[2] - g.xp);
    const bonus = state.microLessonBonusXp;
    const streakMessage = dayNum >= PLAYABLE_DAYS
      ? t(state.checkpoint.passed ? 'streakContinuous' : 'streakCheckpoint')
      : t('streakNextDay', { day: dayNum + 1 });
    const missingLine = g.level < 2 && !leveled
      ? '<p class="mt-3 font-semibold text-white/85">' + t('missingXp', { xp: missing }) + '</p>'
      : '';
    const pill = (text, extra) =>
      '<span class="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold sm:text-sm ' +
        (extra || 'bg-white/10 text-white') + '">' + text + '</span>';

    els.cardLevelup.innerHTML =
      '<div data-summary-banner class="' + (pop ? 'level-pop ' : '') + 'rounded-3xl bg-brand-dark p-5 text-white shadow-xl shadow-slate-200/60 sm:p-7">' +
        '<h3 class="text-xl font-extrabold leading-tight tracking-tight text-brand-yellow sm:text-2xl">' + escapeHtml(title) + '</h3>' +
        '<div class="mt-3 flex flex-wrap items-center gap-2">' +
          pill(escapeHtml(t('pillLevel', { level: g.level })), 'bg-brand-yellow text-brand-dark') +
          pill('<span class="tabular-nums">' + formatNumber(g.xp) + NBSP + 'XP</span>') +
          (bonus > 0 ? pill(escapeHtml(t('pillMicroXp', { xp: bonus })), 'bg-white/5 text-white/70') : '') +
          pill(escapeHtml(t('pillStreak', { days: g.streak_days, dayWord: pluralDays(g.streak_days) })), 'bg-streak-orange/20 text-orange-200') +
        '</div>' +
        (leveled ? '' : missingLine) +
        '<p class="mt-2 text-sm font-bold text-orange-200">' + escapeHtml(streakMessage) + '</p>' +
        '<div class="mt-5 grid grid-cols-1 gap-5 border-t border-white/10 pt-5 md:grid-cols-2 md:gap-8">' +
          '<div>' +
            '<p class="text-sm font-bold text-white/70">' + escapeHtml(t('readiness')) + '</p>' +
            '<p class="mt-0.5 text-2xl font-extrabold tabular-nums">' + start + '% <span class="text-brand-yellow" aria-hidden="true">→</span>' +
              '<span class="sr-only">' + escapeHtml(t('readinessTo')) + '</span> ' + score + '%</p>' +
            '<div class="relative mt-2 h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="' + escapeHtml(t('readiness')) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + score + '">' +
              '<div data-readiness-fill data-target="' + score + '" class="fq-progress-fill absolute inset-y-0 left-0 rounded-full bg-etf-green" style="width: ' + (pop ? start : score) + '%"></div>' +
              '<div class="absolute inset-y-0 left-0 rounded-full bg-white/60" style="width: ' + start + '%"></div>' +
            '</div>' +
            '<p class="mt-2 text-xs text-white/60">' + escapeHtml(t('readinessNote')) + '</p>' +
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
        '<legend class="text-sm font-bold text-white/70">' + escapeHtml(t('selfQuestion')) + '</legend>' +
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
        ? '<span class="text-white/60">' + escapeHtml(t('selfBeforeHint', { before })) + '</span>'
        : '<span class="text-white/60">' + escapeHtml(t('selfMarkNow')) + '</span>';
    }
    const delta = before != null ? after - before : 0;
    const deltaPill = before != null && delta > 0
      ? ' <span class="ml-1 rounded-full bg-etf-green px-2 py-0.5 text-xs text-white">+' + delta + '</span>'
      : '';
    return (before != null ? escapeHtml(t('selfBefore', { before })) +
      ' <span class="text-brand-yellow" aria-hidden="true">→</span><span class="sr-only">,</span> ' : '') +
      escapeHtml(t('selfAfter', { after })) + deltaPill;
  }

  function setSelfAfter(value) {
    const n = clamp(Math.round(Number(value) || 0), 1, 5);
    state.summary.selfAfter = n;
    const out = els.cardLevelup.querySelector('[data-self-compare]');
    if (out) out.innerHTML = selfCompareHtml();
  }

  // Karta 1 — codzienne mini-wyzwanie bieżącego dnia (złota ramka, +50 XP per dzień).
  function renderChallengeCard(turn) {
    const c = turn.real_world_challenge;
    if (!c) {
      els.cardChallenge.innerHTML = '';
      return;
    }
    const day = Number(turn.day) || currentDay();
    const accepted = state.challenges.acceptedDays.has(day);
    const reward = Number(state.challenges.rewards[day]) || 0;
    const action = accepted
      ? '<p class="mt-4 inline-flex min-h-tap items-center gap-2 rounded-2xl bg-etf-green px-4 py-2 font-extrabold text-white" role="status">' +
          escapeHtml(t('challengeAccepted')) + (reward > 0 ? ' +' + reward + NBSP + 'XP' : '') + '</p>'
      : '<button type="button" data-action="accept-challenge" data-day="' + day + '" class="btn-3d mt-4 w-full sm:w-auto"' +
          (state.summary.challengeBusy ? ' disabled' : '') + '>' +
          (state.summary.challengeBusy ? '<span class="fq-spinner"></span>' : '<i data-lucide="flame" class="h-5 w-5" aria-hidden="true"></i>') +
          '<span>' + escapeHtml(t('challengeAccept', { xp: c.reward_xp })) + '</span></button>';
    els.cardChallenge.innerHTML =
      '<div class="rounded-3xl border-2 border-brand-yellow bg-gradient-to-br from-brand-yellow/20 via-white to-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">' +
        '<p class="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-yellow-dark">' +
          '<i data-lucide="target" class="h-4 w-4" aria-hidden="true"></i>' + escapeHtml(t('challengeBadge')) + '</p>' +
        '<h3 class="mt-2 text-lg font-extrabold leading-snug tracking-tight sm:text-xl">' + escapeHtml(c.title) + '</h3>' +
        '<p class="mt-2 text-sm leading-relaxed text-slate-600">' + escapeHtml(c.description) + '</p>' +
        '<p class="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold shadow-sm">' +
          '<span class="tabular-nums">' + formatPLN(c.amount_pln) + '</span>' +
          '<i data-lucide="arrow-right" class="h-4 w-4 text-slate-400" aria-hidden="true"></i> ' + escapeHtml(c.target_account) + '</p>' +
        '<div>' + action + '</div>' +
      '</div>';
  }

  async function acceptChallenge(day) {
    const s = state.summary;
    const turn = summaryTurn();
    const targetDay = Number(day) || (turn && Number(turn.day)) || currentDay();
    if (!turn || !turn.real_world_challenge || s.challengeBusy || state.challenges.acceptedDays.has(targetDay)) return;
    const token = state.mission.token;
    s.challengeBusy = true;
    renderChallengeCard(turn);
    refreshIcons();
    try {
      const res = await withSessionRecovery((sessionId) => api.acceptChallenge(sessionId, targetDay));
      if (token !== state.mission.token) return;
      const g = turn.gamification;
      // Awans dzięki wyzwaniu: próg 100 XP (Poziom 2) albo 250 XP (Poziom 3).
      const crossed = levelForXp(res.xp).level > levelForXp(g.xp).level;
      state.turn = Object.assign({}, turn, {
        gamification: Object.assign({}, g, levelForXp(res.xp), { xp: res.xp, xp_gained: res.reward_xp }),
      });
      s.challengeBusy = false;
      s.challengeReward = res.reward_xp;
      state.challenges.acceptedDays.add(targetDay);
      state.challenges.rewards[targetDay] = res.reward_xp;
      s.leaderboard = Array.isArray(res.leaderboard) ? res.leaderboard : s.leaderboard;
      if (crossed) s.leveledViaChallenge = true;

      const currentTurn = state.turn;
      renderHeader();
      renderLevelBanner(currentTurn, { pop: crossed });
      renderChallengeCard(currentTurn);
      renderLeaderboardCard(currentTurn, { highlight: true });
      refreshIcons();
      fireConfetti('micro');
    } catch (err) {
      if (token !== state.mission.token) return;
      s.challengeBusy = false;
      renderChallengeCard(summaryTurn() || turn);
      refreshIcons();
      showToast(describeMissionError(err), 'warn');
    }
  }

  // Karta 2 — checklista Dnia 1 (4 pozycje); komplet -> pełne konfetti i .glow-pulse na przycisku bankowym.
  function renderChecklistCard(turn) {
    const items = turn.final_checklist || [];
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
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('checklistTitleDynamic', { day: Number(turn.day) || 1 })) + '</h3>' +
          '<span class="text-sm font-extrabold tabular-nums text-slate-500"><span data-check-count>' + done + '</span>/' + items.length + '</span>' +
        '</div>' +
        '<div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">' +
          '<div data-check-bar class="fq-progress-fill h-full rounded-full bg-etf-green" style="width: ' + (items.length ? (done / items.length) * 100 : 0) + '%"></div>' +
        '</div>' +
        '<ul class="mt-4 space-y-3">' + list + '</ul>' +
        '<p data-check-done class="mt-4 text-sm font-extrabold text-emerald-700" role="status"' + (items.length && done === items.length ? '' : ' hidden') + '>' +
          escapeHtml(t('checklistDone')) + '</p>' +
      '</div>';
  }

  function toggleChecklistItem(id, button) {
    const turn = summaryTurn();
    if (!turn) return;
    const items = turn.final_checklist || [];
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
    const turn = summaryTurn();
    const items = (turn && turn.final_checklist) || [];
    return items.length > 0 && items.every((item) => state.summary.checked.has(item.id));
  }

  function syncBankGlow() {
    const btn = els.cardBank && els.cardBank.querySelector('[data-action="open-bank-modal"]');
    if (btn) btn.classList.toggle('glow-pulse', checklistComplete());
  }

  // Karta 3 — przykładowy plan w Commerzbanku (bank_draft); savings_first: plan poduszki, ETF „na później".
  function renderBankCard(turn) {
    const d = turn.bank_draft;
    if (!d) {
      els.cardBank.innerHTML = '';
      return;
    }
    const c = turn.real_world_challenge;
    const advice = (state.session && state.session.safe_investment) || {};
    const savingsFirst = advice.plan_type === 'savings_first';
    const cushion = Number(advice.emergency_savings_monthly) || 0;
    const step = (num, label, body) =>
      '<li class="flex gap-3">' +
        '<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-dark text-sm font-extrabold text-brand-yellow">' + num + '</span>' +
        '<div class="min-w-0"><p class="text-xs font-extrabold uppercase tracking-wider text-slate-500">' + label + '</p>' + body + '</div>' +
      '</li>';

    const today = c
      ? '<p class="mt-0.5 font-extrabold">' + escapeHtml(t('bankMicroMove')) + ' <span class="tabular-nums">' + formatPLN(c.amount_pln) + '</span> ' + escapeHtml(t('bankOn')) + ' ' + escapeHtml(c.target_account) + '</p>'
      : '';
    const target = savingsFirst
      ? '<p class="mt-0.5 font-extrabold">' + escapeHtml(t('bankBuffer')) + ' <span class="tabular-nums">' + formatPLN(cushion) + escapeHtml(t('splitPerMonth')) + '</span> ' + escapeHtml(t('bankSavingsAccount')) + '</p>' +
        '<span class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">' +
          '<i data-lucide="clock" class="h-3.5 w-3.5" aria-hidden="true"></i>' + escapeHtml(t('bankEtfLater', { amount: formatPLN(d.monthly_amount) })) + '</span>'
      : '<p class="mt-0.5 font-extrabold"><span class="tabular-nums">' + formatPLN(d.monthly_amount) + escapeHtml(t('splitPerMonth')) + '</span> • ' + escapeHtml(t('bankHorizon')) + ' ' + yearsLabel(d.horizon_years) + '</p>' +
        '<p class="mt-0.5 text-sm text-slate-600">' + escapeHtml(d.instrument_category) + '</p>' +
        (cushion > 0 ? '<p class="mt-1 text-sm text-slate-600">' + escapeHtml(t('bankParallelBuffer')) + ' <span class="font-bold tabular-nums">' + formatPLN(cushion) + escapeHtml(t('splitPerMonth')) + '</span> ' + escapeHtml(t('bankSavingsAccount')) + '.</p>' : '');

    els.cardBank.innerHTML =
      '<div class="' + CARD_CLASS + '">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('bankTitle')) + '</h3>' +
          '<span class="rounded-full bg-brand-dark px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand-yellow">Demo</span>' +
        '</div>' +
        '<ol class="mt-4 space-y-4">' +
          step(1, escapeHtml(t('bankToday')), today) +
          step(2, escapeHtml(t('bankTarget')), target) +
        '</ol>' +
        '<div class="mt-5 rounded-2xl bg-slate-50 p-4">' +
          '<p class="text-xs font-bold text-slate-500">' + (savingsFirst ? escapeHtml(t('bankLaterPrefix')) : '') +
            escapeHtml(t('bankEstimate')) + ' ' + yearsLabel(d.horizon_years) + '</p>' +
          '<div class="mt-2 grid grid-cols-2 gap-3">' +
            '<div><p class="text-xs font-bold text-emerald-700">' + escapeHtml(t('bankEtfReal')) + '</p>' +
              '<p class="text-xl font-extrabold tabular-nums sm:text-2xl">' + formatPLN(d.projected_etf_real_value) + '</p></div>' +
            '<div><p class="text-xs font-bold text-rose-600">' + escapeHtml(t('bankCashReal')) + '</p>' +
              '<p class="text-xl font-extrabold tabular-nums sm:text-2xl">' + formatPLN(d.projected_cash_real_value) + '</p></div>' +
          '</div>' +
          '<p class="mt-1.5 text-xs text-slate-500">' + escapeHtml(t('bankNominal')) + ' <span class="tabular-nums">' + formatPLN(d.projected_etf_nominal_value) + '</span></p>' +
        '</div>' +
        '<p class="mt-3 text-[11px] leading-relaxed text-slate-500">' + escapeHtml(d.assumptions_text) + ' ' + escapeHtml(d.costs_note) + '</p>' +
        '<button type="button" data-action="open-bank-modal" class="btn-3d mt-5 w-full text-base">' +
          '<span>' + escapeHtml(t('bankCtaDynamic', { day: Number(turn.day) || 1 })) + '</span>' +
          '<i data-lucide="arrow-right" class="h-5 w-5 shrink-0" aria-hidden="true"></i></button>' +
      '</div>';
    syncBankGlow();
  }

  // Karta 4 — ranking (przykładowi znajomi, demo); „⬆️ Awans!" tylko przy awansie.
  function renderLeaderboardCard(turn, options) {
    const rows = state.summary.leaderboard || turn.leaderboard || [];
    const leveled = userLeveledUp(turn);
    const me = rows.find((r) => r.is_current_user) || null;
    const leader = rows[0] || null;
    const list = rows.map((r) => {
      const isMe = r.is_current_user === true;
      // Backend dopisuje „(Awans!)" / „(Level Up!)" do nazwy — w UI pokazujemy osobny badge.
      const name = isMe ? String(r.name).replace(/\s*\((?:Awans!|Level Up!)\)\s*$/, '') : r.name;
      return (
        '<li' + (isMe ? ' data-me' : '') + ' class="flex items-center gap-3 rounded-2xl px-3 py-2.5 ' +
          (isMe ? 'bg-brand-yellow/15 ring-2 ring-brand-yellow' : 'odd:bg-slate-50') + '">' +
          '<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums ' +
            (r.rank === 1 ? 'bg-brand-yellow text-brand-dark' : 'bg-white text-slate-600 ring-1 ring-slate-200') + '">' + escapeHtml(r.rank) + '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="flex flex-wrap items-center gap-1.5 font-extrabold leading-tight">' + escapeHtml(name) +
              (isMe && leveled ? '<span class="rounded-full bg-etf-green px-2 py-0.5 text-[11px] font-extrabold text-white">' + escapeHtml(t('leaderboardLeveled')) + '</span>' : '') + '</p>' +
            '<p class="text-xs text-slate-500">' + escapeHtml(r.level_title) + '</p>' +
          '</div>' +
          '<span class="shrink-0 text-xs font-bold text-streak-orange" title="' + escapeHtml(t('leaderboardStreakTitle')) + '">🔥' + NBSP + escapeHtml(r.streak_days) + '</span>' +
          '<span class="w-20 shrink-0 text-right font-extrabold tabular-nums">' + formatNumber(r.xp) + NBSP + 'XP</span>' +
        '</li>'
      );
    }).join('');

    let hint = '';
    if (me && leader && !leader.is_current_user) {
      hint = t('leaderboardMissing', { xp: formatNumber(leader.xp - me.xp) });
    } else if (me) {
      hint = escapeHtml(t('leaderboardLeading'));
    }

    els.cardLeaderboard.innerHTML =
      '<div class="' + CARD_CLASS + '">' +
        '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
          '<h3 class="text-lg font-extrabold tracking-tight sm:text-xl">' + escapeHtml(t('leaderboardTitle')) + '</h3>' +
          '<span class="text-xs font-semibold text-slate-500">' + escapeHtml(t('leaderboardDemo')) + '</span>' +
        '</div>' +
        '<ol class="mt-4 space-y-1.5">' + list + '</ol>' +
        (hint ? '<p class="mt-3 text-sm font-semibold text-slate-600" aria-live="polite">' + hint + '</p>' : '') +
        '<button type="button" data-action="challenge-friend" class="mt-4 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-dark/10 bg-white px-4 font-extrabold transition hover:border-brand-yellow hover:bg-brand-yellow/10 sm:w-auto">' +
          escapeHtml(t('leaderboardChallenge')) + '</button>' +
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
    const text = t('friendText', { xp: displayedXp() });
    const ok = await copyToClipboard(text);
    if (ok) showToast(t('friendCopied'), 'success');
    else showToast(t('friendCopyFailed', { text }), 'warn', 6000);
  }

  // ------------------------------------------------------------------------
  // 12. Modal bankowy — Zero-Friction Handoff (DEMO, docs/01 §7)
  // ------------------------------------------------------------------------

  function bankOptionSummary(turn, option) {
    const c = turn.real_world_challenge;
    const d = turn.bank_draft;
    const advice = (state.session && state.session.safe_investment) || {};
    if (option === 'b') {
      return advice.plan_type === 'savings_first'
        ? t('modalTargetPlan') + ' ' + escapeHtml(t('modalBuffer')) + ' ' + formatPLN(advice.emergency_savings_monthly || 0) + escapeHtml(t('splitPerMonth'))
        : t('modalTargetPlan') + ' ' + formatPLN(d ? d.monthly_amount : 0) + escapeHtml(t('splitPerMonth'));
    }
    return c
      ? t('modalTransfer', { amount: formatPLN(c.amount_pln), account: c.target_account })
      : t('modalTodayStep');
  }

  function renderBankModal() {
    const turn = summaryTurn();
    if (!turn || !els.bankOrderContent) return;
    const s = state.summary;
    const c = turn.real_world_challenge;
    const d = turn.bank_draft;
    const advice = (state.session && state.session.safe_investment) || {};

    if (s.bankDone) {
      els.bankOrderContent.innerHTML =
        '<div class="text-center" role="status">' +
          '<div class="level-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-etf-green text-white">' +
            '<i data-lucide="check" class="h-8 w-8" aria-hidden="true"></i></div>' +
          '<p class="mt-4 text-lg font-extrabold leading-snug">' + escapeHtml(t('modalDone')) + '</p>' +
          '<p class="mt-2 text-sm text-slate-600">' + escapeHtml(t('modalDoneNote', { summary: bankOptionSummary(turn, s.bankOption) })) + '</p>' +
          '<button type="button" data-action="next-generation" class="btn-3d mt-6 w-full">' +
            '<i data-lucide="users" class="h-5 w-5" aria-hidden="true"></i><span>' + escapeHtml(t('modalNextGeneration')) + '</span></button>' +
          '<button type="button" data-action="close-modal" class="mt-2 inline-flex min-h-tap w-full items-center justify-center rounded-2xl font-bold text-slate-600 transition hover:bg-slate-100">' + escapeHtml(t('modalClose')) + '</button>' +
        '</div>';
      refreshIcons();
      return;
    }

    const optionB = advice.plan_type === 'savings_first'
      ? '<span class="mt-1 block text-sm font-semibold text-slate-600">' + escapeHtml(t('modalBuffer')) +
        ' <span class="tabular-nums">' + formatPLN(advice.emergency_savings_monthly || 0) + escapeHtml(t('splitPerMonth')) + '</span> ' +
        escapeHtml(t('modalSavings', { amount: formatPLN(d ? d.monthly_amount : 0) })) + '</span>'
      : '<span class="mt-1 block text-sm font-semibold text-slate-600"><span class="tabular-nums">' + formatPLN(d ? d.monthly_amount : 0) + escapeHtml(t('splitPerMonth')) + '</span> • ' +
          (d ? yearsLabel(d.horizon_years) : '') + '</span>' +
        '<span class="mt-0.5 block text-xs font-medium text-slate-500">' + escapeHtml(d ? d.instrument_category : '') + '</span>';
    const option = (value, title, badge, body) =>
      '<label class="block cursor-pointer"><input type="radio" name="bank_option" value="' + value + '" class="sr-only"' + (s.bankOption === value ? ' checked' : '') + '>' +
        '<span class="fq-tile fq-tile--top"><span class="fq-radio-dot" aria-hidden="true"></span><span class="min-w-0">' +
          '<span class="flex flex-wrap items-center gap-2">' + escapeHtml(title) + badge + '</span>' + body +
        '</span></span></label>';

    els.bankOrderContent.innerHTML =
      '<div class="rounded-2xl bg-brand-dark p-4 text-white">' +
        '<div class="flex items-center justify-between gap-3">' +
          '<span class="inline-flex items-center gap-2 font-extrabold"><span class="grid h-7 w-7 place-items-center rounded-lg bg-brand-yellow text-brand-dark">' +
            '<i data-lucide="landmark" class="h-4 w-4" aria-hidden="true"></i></span>Commerzbank</span>' +
          '<span class="rounded-full bg-brand-yellow px-2 py-0.5 text-[11px] font-extrabold text-brand-dark">DEMO</span>' +
        '</div>' +
        '<p class="mt-2 text-xs text-white/70">' + escapeHtml(t('modalBankPreview')) + '</p>' +
      '</div>' +
      '<fieldset class="fq-field mt-4"><legend class="text-sm font-bold text-slate-600">' + escapeHtml(t('modalChooseStep')) + '</legend>' +
        '<div class="mt-2 grid gap-3">' +
          option('a', t('modalOptionA'),
            '<span class="rounded-full bg-etf-green px-2 py-0.5 text-[11px] font-extrabold text-white">' + escapeHtml(t('modalRecommended')) + '</span>',
            '<span class="mt-1 block text-sm font-semibold text-slate-600">' +
              (c ? escapeHtml(t('modalTransfer', { amount: formatPLN(c.amount_pln), account: c.target_account })) : '') + '</span>') +
          option('b', t('modalOptionB'), '', optionB) +
        '</div>' +
      '</fieldset>' +
      '<p class="mt-4 flex items-start gap-2 rounded-2xl border border-stress-amber/50 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-slate-700">' +
        '<i data-lucide="shield-alert" class="mt-0.5 h-4 w-4 shrink-0 text-stress-amber" aria-hidden="true"></i>' +
        escapeHtml(t('modalKyc')) + '</p>' +
      '<button type="button" data-action="simulate-bank" class="btn-3d mt-5 w-full">' +
        '<span>' + escapeHtml(t('modalSimulate')) + '</span></button>';
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
      } else if (target.dataset.action === 'set-lang') {
        setLanguage(target.dataset.lang);
      } else if (target.dataset.action === 'reset-demo') {
        resetDemo();
      } else if (target.dataset.action === 'submit-onboarding') {
        submitOnboarding();
      } else if (target.dataset.action === 'complete-lesson') {
        completeLesson(target.dataset.lessonId);
      } else if (target.dataset.action === 'quick-reply') {
        answerWithQuickReply(target.dataset.replyId);
      } else if (target.dataset.action === 'start-day') {
        startDay(target.dataset.day);
      } else if (target.dataset.action === 'accept-challenge') {
        acceptChallenge(target.dataset.day);
      } else if (target.dataset.action === 'open-checkpoint') {
        showScreen(SCREENS.CHECKPOINT);
      } else if (target.dataset.action === 'retry-checkpoint') {
        retryCheckpoint();
      } else if (target.dataset.action === 'demo-jump') {
        demoJumpToDay(target.dataset.day);
      } else if (target.dataset.action === 'demo-checkpoint') {
        demoOpenCheckpoint();
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
    // Radia poza ankietą: samoocena „po", opcja w modalu bankowym i odpowiedzi Checkpointu.
    document.addEventListener('change', (event) => {
      const input = event.target;
      if (!input || input.type !== 'radio') return;
      if (input.name === 'self_confidence_after') setSelfAfter(input.value);
      else if (input.name === 'bank_option') state.summary.bankOption = input.value === 'b' ? 'b' : 'a';
      else if (input.name.indexOf('cp_') === 0) {
        const question = input.name.slice(3);
        state.checkpoint.answers[question] = input.value;
        if (state.checkpoint.result) {
          // Zmiana odpowiedzi po wyniku = nowa próba (wynik przestaje być aktualny).
          state.checkpoint.result = null;
          els.cpResult.hidden = true;
          els.cpResult.innerHTML = '';
        }
        const questions = checkpointQuestions();
        renderCheckpointHead(questions.length);
      }
    });
    if (els.cpForm) {
      els.cpForm.addEventListener('submit', submitCheckpoint);
    }
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
    applyStaticTranslations();
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
    LANG_STORAGE_KEY,
    I18N,
    get COMPLIANCE_TEXT() {
      return t('complianceText');
    },
    t,
    setLanguage,
    resetDemo,
    applyStaticTranslations,
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
    renderRoadmap,
    renderNextStepCard,
    acceptChallenge,
    startDay,
    demoJumpToDay,
    demoOpenCheckpoint,
    renderCheckpoint,
    submitCheckpoint,
    retryCheckpoint,
    currentDay,
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
