/* ==========================================================================
   Finance Quest — static/app.js
   Vanilla JS, no build tool. Local globals from /static/vendor/: Chart, confetti.
   API contract: docs/02_TECH_API_AND_MATH.md §4–§5 (field names are binding).

   Sections
    1. Config & constants          9. Router
    2. i18n (EN default + PL)      10. Screen 1 — life stage & profile form
    3. Icons, Atlas guide, seal    11. Screen 2 — Quest Hub
    4. Sound (Web Audio, 0 assets) 12. Screen 3 — mission engine
    5. Utilities                   13. Screen 4 — mission complete
    6. API + silent session        14. Checkpoint #1
       recovery                    15. Ask Atlas (explain + drill)
    7. State                       16. Modals, toasts, confetti
    8. HUD                         17. Events & init
   ========================================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // 1. Config & constants
  // ------------------------------------------------------------------------
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
  const API_TIMEOUT_MS = 8000;
  const ANALYZE_MIN_ANIMATION_MS = 700;
  const MICRO_LESSON_BONUS_CAP = 45;   // docs/01 §2: max +45 XP from 3 micro lessons
  const PRACTICE_XP = 15;              // frontend-only practice beats (slider, myth, spot)
  const FREE_CASH_CAP = 10000;
  const WIN_RATE_DISPLAY_CAP = 97;     // docs/02 §3B: never above 97%
  const MISSION_MESSAGE_MAX = 600;
  const TOTAL_DAYS = 14;
  const PLAYABLE_DAYS = 4;
  const LS_LANG = 'fq_lang';
  const LS_SOUND = 'fq_sound';         // '1' = the user switched sound on (default: muted)
  const LS_INTRO_SEEN = 'fq_intro_seen';
  const LS_USER_NAME = 'fq_user_name';

  const SCREENS = Object.freeze({
    BANK_ENTRY: 'screen_bank_entry',
    ONBOARDING: 'screen_onboarding',
    HUB: 'screen_filter_and_timemachine',
    MISSION: 'screen_mission_live',
    DONE: 'screen_checklist',
    CHECKPOINT: 'screen_checkpoint',
  });

  // Quiet Mastery palette (mirrors the :root tokens in styles.css).
  const C = Object.freeze({
    ink: '#082933', ink3: '#5B6E75', paper: '#F7F6F2', paper2: '#EFEDE6', rule: '#D8D4C8',
    yellow: '#FFCC00', green: '#12B76A', amber: '#C08A1E', coral: '#C9473F', sky: '#2F6F86',
  });
  const CALM_AGE = 45;   // "Innovations for all generations": larger text & calm UI from 45

  // Life stages ("Innovations for all generations"). Three map 1:1 to the backend
  // demo personas (docs/03 §6.0); "peak" is a frontend profile sent to the same API.
  const STAGES = [
    { id: 'first', personaId: 'young_20', icon: 'banknote',
      profile: { age: 22, net_income: 4500, free_cash: 1000, has_emergency_fund: false, main_concern: 'freeze_money', self_confidence_start: 2 } },
    { id: 'home', personaId: 'mid_38', icon: 'house',
      profile: { age: 38, net_income: 11000, free_cash: 2500, has_emergency_fund: true, main_concern: 'no_time', self_confidence_start: 2 } },
    { id: 'peak', personaId: null, icon: 'peak',
      profile: { age: 47, net_income: 14000, free_cash: 3500, has_emergency_fund: true, main_concern: 'lose_money', self_confidence_start: 3 } },
    { id: 'pre', personaId: 'senior_56', icon: 'sunset',
      profile: { age: 56, net_income: 9500, free_cash: 3000, has_emergency_fund: true, main_concern: 'too_late', self_confidence_start: 2 } },
  ];
  // "Try another generation": 22 -> 56 (Golden Path), 56 -> 38, 38 -> 47, 47 -> 22.
  const NEXT_STAGE = Object.freeze({ first: 'pre', pre: 'home', home: 'peak', peak: 'first' });
  const DAY_ICONS = Object.freeze({ 1: 'sprout', 2: 'search', 3: 'repeat', 4: 'target' });

  // Five competence stages (Quiet Mastery progress system): practice XP, or Checkpoint #1 for stage 5.
  const PLANT_STAGES = Object.freeze([
    { stage: 1, fromXp: 0, nextXp: 60, titleKey: 'garden.stage1', quoteKey: 'garden.quote1' },
    { stage: 2, fromXp: 60, nextXp: 100, titleKey: 'garden.stage2', quoteKey: 'garden.quote2' },
    { stage: 3, fromXp: 100, nextXp: 250, titleKey: 'garden.stage3', quoteKey: 'garden.quote3' },
    { stage: 4, fromXp: 250, nextXp: 400, titleKey: 'garden.stage4', quoteKey: 'garden.quote4' },
    { stage: 5, fromXp: 400, nextXp: null, titleKey: 'garden.stage5', quoteKey: 'garden.quote5' },
  ]);

  function plantState(xp, cpPassed) {
    const value = clamp(Math.max(0, Number(xp) || 0), 0, 100000);
    let stage = PLANT_STAGES[0];
    if (cpPassed || value >= 400) stage = PLANT_STAGES[4];
    else if (value >= 250) stage = PLANT_STAGES[3];
    else if (value >= 100) stage = PLANT_STAGES[2];
    else if (value >= 60) stage = PLANT_STAGES[1];

    const next = stage.stage < 5 ? PLANT_STAGES[stage.stage] : null;
    const nextXp = stage.nextXp;
    const toNext = nextXp == null ? 0 : Math.max(0, nextXp - value);
    const pct = nextXp == null ? 100 : clamp(((value - stage.fromXp) / (nextXp - stage.fromXp)) * 100, 0, 100);
    return {
      stage: stage.stage,
      title: t(stage.titleKey),
      nextTitle: next ? t(next.titleKey) : null,
      nextXp,
      toNext,
      pct,
      quote: t(stage.quoteKey),
    };
  }

  // Five capital pillars, Private Banking style: pillars up to the current stage are filled in
  // petrol, the current one carries a canary cap, a thin emerald trend line links their tops and
  // stage 5 ends in a canary target mark. Precise 1px/1.75px lines, no cartoon outlines.
  function plantSVG(stage, extraClass) {
    const s = clamp(Number(stage) || 1, 1, 5);
    const xs = [10, 36, 62, 88, 114];
    const hs = [18, 30, 42, 54, 66];
    const base = 92;
    const w = 16;
    const tops = [];
    const bars = xs.map((x, i) => {
      const n = i + 1;
      const y = base - hs[i];
      if (n <= s) tops.push([x + w / 2, y - 7]);
      if (n > s) {
        return '<rect class="pl-bar" x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (w - 1) + '" height="' + (hs[i] - 1) + '" rx="2" fill="' + C.paper + '" stroke="' + C.rule + '" stroke-width="1" stroke-dasharray="3 2"/>';
      }
      const cap = n === s ? '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="4" rx="1.5" fill="' + C.yellow + '"/>' : '';
      return '<g class="pl-bar pl-bar--on" style="--i:' + i + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hs[i] + '" rx="2" fill="' + C.ink + '"/>' + cap + '</g>';
    }).join('');
    const pts = tops.map((p) => p[0] + ',' + p[1]).join(' ');
    const trend = tops.length > 1
      ? '<polyline class="pl-trend" points="' + pts + '" pathLength="1" fill="none" stroke="' + C.green + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
      : '';
    const dots = tops.map((p, i) => (s === 5 && i === 4)
      ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5.5" fill="' + C.yellow + '" stroke="' + C.ink + '" stroke-width="1.5"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="' + C.ink + '"/>'
      : '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.4" fill="#FFFFFF" stroke="' + C.green + '" stroke-width="1.5"/>').join('');
    return '<div class="plant plant--stage-' + s + (extraClass ? ' ' + extraClass : '') + '">' +
      '<svg viewBox="0 0 140 100" role="img" aria-label="' + escapeHtml(t('garden.svgLabel', { stage: s })) + '">' +
      '<path d="M4 92.5h132" stroke="' + C.rule + '" stroke-width="1"/>' + bars + trend + dots + '</svg></div>';
  }

  // ------------------------------------------------------------------------
  // 2. i18n — EN is the default, PL fully supported (docs/01 §9). Amounts stay in PLN.
  // ------------------------------------------------------------------------
  const I18N = {
    en: {
      'meta.title': 'Finance Quest by Commerzbank',
      'meta.description': 'Finance Quest by Commerzbank: build investing confidence in a 14-day sprint, five minutes a day.',
      'a11y.skip': 'Skip to content',
      'brand.sub': 'by Commerzbank, 14-Day Confidence Sprint',
      'common.close': 'Close',
      'entry.demo': 'DEMO · Commerzbank simulation',
      'entry.account': 'Everyday account',
      'entry.available': 'Available balance · sample data',
      'entry.transaction1': 'Salary · sample',
      'entry.transaction2': 'Rent · sample',
      'entry.transactions': 'Recent sample transactions',
      'entry.cta': 'Build your investment plan & start investing in 14 days',
      'entry.note': 'Nothing is executed. This is a guided learning simulation.',
      'entry.whyTitle': 'A calmer way to start',
      'entry.whyText': 'Atlas, your Commerzbank financial guide, turns a big money decision into one clear step at a time.',
      'intro.next': 'Next', 'intro.skip': 'Skip',
      'intro.1.title': 'Inflation is quiet, but real.', 'intro.1.copy': 'A 0% account keeps the number the same while prices keep moving. Financial knowledge helps you protect what your money can buy.',
      'intro.2.title': 'No big sums. No jargon.', 'intro.2.copy': 'Five minutes and one small habit are enough to start. Atlas keeps the language plain and the steps practical.',
      'intro.3.title': 'More calm. More control.', 'intro.3.copy': 'Know what to do when a laptop breaks or markets dip. Confidence grows when the next step is clear.',
      'name.badge': 'Your personal plan', 'name.title': 'How would you like us to address you?', 'name.copy': 'Atlas will prepare your plan.', 'name.label': 'First name', 'name.placeholder': 'For example, Alex', 'name.note': 'Used only to personalise your plan and summaries.', 'name.skip': 'Skip for now', 'name.continue': 'Continue',

      'hud.home': 'Finance Quest home',
      'hud.day': 'Day',
      'hud.dayTitle': 'Day of your 14-day sprint',
      'hud.streakTitle': 'Practice days',
      'hud.practiceLabel': 'Practice days:',
      'hud.xpTitle': 'Practice points (XP)',
      'hud.stageTitle': 'Competence stage',
      'hud.stageShort': 'Stage {n}/5',
      'hud.stageLong': 'Stage {n}: {title}',
      'hud.readiness': 'Readiness',
      'hud.readinessCalm': 'Readiness & Capital Protection',
      'hud.sound': 'Sound effects',
      'hud.calm': 'Larger text / Calm UI',
      'hud.calmOn': 'Larger text and calm layout are on.',
      'hud.calmOff': 'Standard text size is back.',
      'hud.language': 'Language',
      'hud.reset': 'Reset / Profile',
      'hud.judges': 'For judges',
      'hud.menu': 'More options',
      'hud.soundOn': 'Sound is on',
      'hud.soundOff': 'Sound is off',

      'onb.title': 'Build investing confidence in 14 days.',
      'onb.lead': "Five minutes a day. Pick where you are in life and Atlas leaves out every bit of theory you don't need yet.",
      'onb.bubble': "I'm Atlas, your Commerzbank financial guide. Choose the life stage that fits you best.",
      'onb.bubbleName': 'Welcome, {name}. Choose the life stage that fits you best and I will prepare your plan.',
      'onb.stagesTitle': 'Where are you in life?',
      'onb.stagesHint': 'One tap builds your plan.',
      'onb.tailorToggle': 'Not quite you? Answer 6 quick questions instead',
      'onb.building': 'Cutting the theory you don\'t need…',

      'stage.first.name': 'First paycheck', 'stage.first.meta': 'Gen Z, 22', 'stage.first.desc': 'Starting from zero, cushion still growing',
      'stage.home.name': 'Building a home', 'stage.home.meta': 'Millennial, 38', 'stage.home.desc': 'Family budget, little time for markets',
      'stage.peak.name': 'Peak career', 'stage.peak.meta': 'Gen X, 47', 'stage.peak.desc': 'Good income, afraid of losing it',
      'stage.pre.name': 'Pre-retirement', 'stage.pre.meta': '55+, 56', 'stage.pre.desc': "Protecting what you've built",
      'stage.go': 'Start here',
      'stage.custom': 'Your own profile',

      'form.age': 'Your age',
      'form.net': 'Net monthly income',
      'form.netHint': 'What lands in your account each month.',
      'form.free': 'Free cash each month',
      'form.freeHint': 'Up to {max}. Never more than your income.',
      'form.fund': 'Emergency cushion (3+ months of costs)',
      'form.fundYes': 'I have one',
      'form.fundNo': 'Still building it',
      'form.concern': 'What worries you most?',
      'form.confidence': 'How confident do you feel about investing your first money?',
      'form.scaleLow': '1, not at all',
      'form.scaleHigh': '5, very confident',
      'form.cta': 'Build my 14-day plan',
      'form.ctaBusy': 'Building your plan…',
      'err.age': 'Age must be between 18 and 70.',
      'err.net': 'Net income: 2,500 to 25,000 PLN.',
      'err.free': 'Free cash: 200 to 10,000 PLN and not more than your income.',
      'err.fund': 'Tell us whether you have a cushion.',
      'err.concern': 'Pick what worries you most.',
      'err.conf': 'Pick a number from 1 to 5.',
      'err.fixForm': 'Check the highlighted questions.',
      'group.20+': 'Young Start (20+)',
      'group.30-50': 'Career & Family (30–50)',
      'group.50+': 'Capital Protection (50+)',
      'concern.freeze_money': 'Freezing my money',
      'concern.no_time': 'No time to watch markets',
      'concern.lose_money': 'Losing my money',
      'concern.too_late': "It's probably too late for me",

      'hub.srTitle': 'Your 14-day plan',
      'hub.horizon': '{n}-year horizon',
      'hub.worry': 'Worry: {x}',
      'hub.phase': 'Phase {n}',
      'hub.phase1.range': 'Days 1–4', 'hub.phase1.title': 'Foundations & first step',
      'hub.phase2.range': 'Days 5–9', 'hub.phase2.title': 'Risk, safety & emotions',
      'hub.phase3.range': 'Days 10–14', 'hub.phase3.title': 'Your real plan',
      'hub.perDay': '~5 min a day',
      'hub.day': 'Day {n}',
      'hub.day2Title': 'Brokerage account & fees',
      'hub.day3Title': 'Automate it: standing order',
      'hub.checkpoint': 'Checkpoint #1',
      'hub.checkpointSub': 'A quick knowledge check',
      'hub.checkpoint2': 'ends with Checkpoint #2',
      'hub.finale': 'ends with the sprint finale',
      'hub.start': 'Today',
      'hub.resume': 'In progress',
      'hub.startMission': 'Start Day {n} simulation · ~5 min',
      'hub.resumeMission': 'Continue Day {n} simulation',
      'hub.nextDay': 'Start Day {n}',
      'hub.openCheckpoint': 'Start Checkpoint #1',
      'hub.reviewDay': 'See Day {n} results',
      'hub.locked': 'Unlocks after Day {n}',
      'hub.lockedCp': 'Unlocks after Day 4',
      'hub.tomorrow': 'Day {n} opens tomorrow. Come back to keep your practice going.',
      'hub.after14.title': 'After Day 14: keep learning',
      'hub.after14.sub': 'The sprint gets you started. Short monthly sessions keep you going.',
      'hub.done': 'Done',
      'hub.steps': "Today's briefing",
      'hub.step1': 'Your plan',
      'hub.step2': 'What-if simulator',
      'hub.step3': 'Day {n} lessons',
      'hub.next': 'Next',
      'hub.back': 'Back',
      'hub.soon': 'Available in the full 14-day sprint. Complete Days 1–4 and Checkpoint #1 first.',
      'hub.pebble': 'Day {n}, part of the full 14-day sprint',
      'hub.checkpoint2Short': 'Checkpoint #2',
      'hub.finaleShort': 'Sprint finale',

      'garden.title': 'Competence stage',
      'garden.stageLabel': 'Stage {stage} of 5',
      'garden.stage1': 'Foundations',
      'garden.stage2': 'Liquidity Control',
      'garden.stage3': 'Market Calm',
      'garden.stage4': 'Strategy Builder',
      'garden.stage5': 'Action Ready',
      'garden.toNext': '{xp} XP of practice to the next stage: {title}',
      'garden.complete': 'All five stages reached. Keep your monthly check-ins.',
      'garden.progress': 'Stage progress',
      'garden.grew': 'New stage: {from} → {to}',
      'garden.current': 'Current stage',
      'garden.quote1': 'You know your starting point: income, free cash and a cushion.',
      'garden.quote2': 'The cushion comes first, so a surprise bill never forces a sale.',
      'garden.quote3': 'A -20% dip is a fluctuation, not a loss, unless you sell.',
      'garden.quote4': 'You plan with an amount, a horizon and costs — not with guesses.',
      'garden.quote5': 'Foundations confirmed. You are ready for a first, small step.',
      'garden.svgLabel': 'Capital pillars chart, stage {stage} of 5',

      'plan.title': 'Your sample split',
      'plan.label': 'Illustrative target amount per month',
      'plan.cushion': 'Safety cushion',
      'plan.etf': 'Broad ETF practice',
      'plan.mo': '/mo',
      'plan.shares': 'about {a}% cushion, {b}% ETF practice',
      'plan.range': 'Sample range in a broad ETF',
      'plan.sim': 'The time machine uses {amount}/mo.',
      'plan.etfLater': 'ETF later. The time machine shows {amount}/mo as an example.',

      'skip.badge': "Skipped {n} topics you don't need at the start",
      'skip.kept': 'Your 3 priorities today',
      'skip.removed': 'You can ignore these for now',

      'lessons.title': '20-second lessons',
      'lessons.titleDay': 'Day {n} lessons',
      'lessons.sub': 'Pass each mini-check to unlock the challenge, up to +{n} XP',
      'lessons.progress': '{a} of {b} lessons passed',
      'lessons.check': 'Quick check',
      'lessons.right': 'Correct, lesson passed',
      'lessons.wrong': 'Not quite. Have another look at the key point.',
      'lessons.askGuide': 'Ask Atlas to explain',
      'hub.gateLessons': 'Pass the lesson checks ({a}/{b}) and the Atlas check-in first',
      'hub.gateCheckin': 'Atlas check-in first',
      'checkin.title': 'Atlas check-in',
      'checkin.q': 'Is this section clear, or would you like me to explain anything else before the challenge?',
      'checkin.yes': 'Yes, explain something first',
      'checkin.start': 'Everything is clear: start Day {n} challenge',
      'checkin.done': 'Check-in done. Day {n} challenge unlocked.',
      'lessons.got': 'Got it (+{n} XP)',
      'lessons.done': 'Done, +{n} XP',
      'lessons.explain': 'Explain simpler',
      'lessons.sec': '{n} sec',

      'tm.title': 'Time machine: cash vs a broad ETF',
      'tm.sub': "All values in today's money, so both lines compare fairly.",
      'tm.slider': 'Years invested',
      'tm.monthly': 'Example: {amount}/mo',
      'tm.kpiCash': 'Contributions in a 0% account (real)',
      'tm.kpiEtf': 'Broad ETF (real, assumptions below)',
      'tm.kpiWin': 'Illustrative historical windows',
      'tm.paid': 'Paid in: {amount}',
      'tm.nominal': 'Nominal: about {amount}',
      'tm.winText': 'ended with a positive real return (illustrative data, capped at 97%)',
      'tm.legendEtf': 'Broad ETF (real)',
      'tm.legendCash': '0% account (real)',
      'tm.legendStress': '-20% dip in year 3 (educational)',
      'tm.chartAria': "Chart of contributions in a 0% account versus a broad ETF in today's money, with an educational -20% dip in year 3",
      'tm.history': 'Historical simulation. Results vary and future returns are not guaranteed.',
      'tm.yAxis': "today's PLN",
      'tm.year': 'Year {n}',
      'tm.whatIf': 'What if I invest a different amount?',
      'tm.amountPill': '{amount}/mo',
      'tm.reset': 'Reset to my plan',
      'tm.planNote': 'Your sample plan: {plan}/mo. Drag to try another amount.',
      'tm.whatIfNote': 'What-if: {amount}/mo instead of your sample {plan}/mo. Same assumptions as below.',

      'cow.title': 'Cost of Waiting (Inflation Erosion)',
      'cow.lead': 'Over {years} at {amount}/mo — your generation\'s horizon — in today\'s money:',
      'cow.paid': 'You pay in',
      'cow.cash': 'Kept in a 0% account',
      'cow.cashLoss': '{amount} of purchasing power lost',
      'cow.etf': 'Broad ETF (illustrative)',
      'cow.etfGain': '{amount} more than cash',
      'cow.note': 'Same assumptions as the chart: 5.7% a year after costs, 3.5% inflation. Illustrative, not a forecast or a guarantee.',

      'compliance.mifid': 'Finance Quest is strictly an educational and simulation tool. Calculations are based on simplified assumptions and historical data, exclude capital gains tax, brokerage fees, and currency risk, do not guarantee future returns, and do not constitute investment advice or a recommendation under MiFID II. Investing involves the risk of losing part or all of your capital.',
      'ai.disclaimer': 'Atlas is an AI guide and can make mistakes. Always verify key details. Educational simulation only, not financial advice.',

      'mission.srTitle': 'Decision simulation',
      'mission.close': 'Close simulation',
      'mission.progress': 'Simulation progress',
      'mission.explain': 'Explain simpler',
      'mission.check': 'Check my answer',
      'mission.checking': 'Checking your answer…',
      'mission.continue': 'Continue',
      'mission.tryAgain': 'Try again',
      'mission.finish': 'See my results',
      'mission.dayChip': 'Day {d} of 14',
      'mission.stepChip': 'Step {s} of {t}',
      'mission.portfolio': 'Simulated portfolio {amount}',
      'mission.coraWho': 'Atlas, your Commerzbank financial guide',
      'mission.ownLabel': 'Or answer in your own words',
      'mission.ownPlaceholder': "Tell Atlas what you'd do and why…",
      'mission.ownHint': 'Enter to check, Shift+Enter for a new line',
      'mission.thinking': 'Atlas is reading your answer',
      'mission.right': 'Correct.|That is the sound approach.|Exactly right.',
      'mission.partial': "Reasonable, but there's a catch",
      'mission.invalid': 'Please give it one more go',
      'mission.fallback': 'Thanks, let\'s look at the numbers',
      'mission.yourAnswer': 'Your answer: "{a}"',
      'mission.readinessPill': 'Readiness +{n}',
      'mission.stagePill': 'New stage: {title}',
      'mission.zeroXp': '0 XP',
      'mission.pickOrType': 'Pick a card or type a few words first.',
      'mission.practice': 'Practice',

      'alloc.q': 'How would you split your free cash?',
      'alloc.msgNoCushion': "You have {free} free each month and no cushion yet. Slide to choose how much goes to a broad-ETF practice plan. The rest builds your cushion.",
      'alloc.msgCushion': 'Your cushion is already in place. Slide to choose how much of your {free} free each month goes to a broad ETF. The rest stays in easy-to-reach savings.',
      'alloc.slider': 'Monthly amount for a broad ETF',
      'alloc.pill': '{amount} to ETF',
      'alloc.safe': 'Safety cushion',
      'alloc.safeAlt': 'Easy-to-reach savings',
      'alloc.grow': 'Growth potential',
      'alloc.swing': 'Short-term swings',
      'alloc.note': 'In {years} the ETF part could be about {amount} in today\'s money (illustrative).',
      'alloc.okNoCushion': "Cushion first. With most of it in the cushion, one broken laptop won't force you to sell during a dip.",
      'alloc.tooMuchNoCushion': 'Bold, but without a cushion one surprise bill could force you to sell at a bad moment. Keep most of it in the cushion for now.',
      'alloc.okCushion': 'Balanced. Part works long-term in a broad ETF, part stays easy to reach.',
      'alloc.tooLowCushion': 'Your cushion is covered, so keeping it all in cash lets inflation (3.5% a year in our assumptions) nibble at it. Try a bigger share.',
      'alloc.tooHighCushion': "That's most of your free cash. Keeping some in easy-to-reach savings makes dips easier to sit through. Try a little less.",
      'alloc.okTitle': 'A sound split',
      'alloc.tryTitle': 'Almost — adjust the slider',

      'myth.tag': 'Myth or reality?',
      'myth.intro': 'Plenty of beginners believe this one. Myth or reality? Tap your answer.',
      'myth.myth': 'Myth',
      'myth.reality': 'Reality',
      'myth.rightTitle': "Correct — it's a {v}",
      'myth.wrongTitle': "Not quite — it's a {v}",
      'myth.vMyth': 'myth',
      'myth.vReality': 'reality',
      'myth.freeze_money.s': 'Money in a broad ETF is locked away for years.',
      'myth.freeze_money.e': 'You can sell on any trading day, and the payout usually lands within a few business days. Your cushion just means you rarely need to.',
      'myth.no_time.s': 'To invest well, you have to watch the market every day.',
      'myth.no_time.e': 'A standing order into a broad ETF runs in the background. Checking daily usually adds stress, not results.',
      'myth.lose_money.s': 'Even a broad ETF can drop in value for a while.',
      'myth.lose_money.e': "True. It can fall, sometimes sharply. Spreading money across hundreds of companies softens the hit from any one of them, but market risk stays. That's why the cushion sits separately.",
      'myth.too_late.s': 'After 50, investing no longer makes sense.',
      'myth.too_late.e': 'A 5–10 year horizon is still time for money to work. What matters is matching the horizon and the mix, with your cushion kept separate.',

      'spot.q': 'These two funds look almost the same. Tap the line that quietly costs you every single year.',
      'spot.fundA': 'Broad Global Fund A',
      'spot.fundB': 'Broad Global Fund B',
      'spot.companies': 'Companies inside',
      'spot.region': 'Region',
      'spot.regionVal': 'Global',
      'spot.ter': 'Annual fee (TER)',
      'spot.div': 'Dividends',
      'spot.divVal': 'Reinvested',
      'spot.rightTitle': "That's the one",
      'spot.right': 'The TER is taken every year, so a lower fee leaves more of the growth with you. Compare it before you buy.',
      'spot.wrongTitle': 'Good eye — look once more',
      'spot.wrong': 'That line barely changes your result. The annual fee (TER) is charged every year, so it is the one to compare.',

      'done.srTitle': 'Day complete',
      'done.title': 'Day {d} complete',
      'done.earned': 'practice points today',
      'done.levelUp': 'Milestone reached: {title}',
      'done.toNext': '{n} XP to the next milestone',
      'done.readiness': 'Readiness',
      'done.readinessNote': 'Full readiness comes on Day 14.',
      'done.selfQ': 'How confident do you feel now?',
      'done.selfBefore': 'Before {n}/5. Tap how you feel now.',
      'done.selfCompare': 'Before {a}/5, now {b}/5',
      'done.next': 'Continue to Day {n}',
      'done.checkpoint': 'Start Checkpoint #1',
      'done.toMap': 'Back to my plan',
      'done.streak': 'Practice day recorded. See you tomorrow.',
      'done.badgeLabel': 'Milestone',
      'done.tabs': 'Day summary',
      'done.tabToday': "Today's step",
      'done.tabMore': 'Checklist, rank & After Day 14',

      'first.title': 'Take your first real step',
      'first.sub': "Small, safe and today. That's how confidence turns into action.",
      'first.challenge': "Today's real-world challenge",
      'first.accept': "I'll do it (+{n} XP)",
      'first.accepted': 'Challenge accepted',
      'first.checklist': 'Your starter checklist',
      'first.allDone': 'All set. You can now preview the first step in the bank.',
      'first.toBank': 'Open my sample plan at Commerzbank',

      'bankcard.title': 'Sample plan at Commerzbank',
      'bankcard.demo': 'Demo',
      'bankcard.today': 'Today',
      'bankcard.day14': 'Day 14 target plan',
      'bankcard.micro': 'Micro step: {amount} to {account}',
      'bankcard.cushion': 'Cushion: {amount}/mo to a savings account',
      'bankcard.etfLater': 'ETF later, example {amount}/mo',
      'bankcard.monthly': '{amount}/mo for {years}',
      'bankcard.parallel': 'Alongside: cushion {amount}/mo to a savings account',
      'bankcard.estimate': "Educational estimate in today's money over {years}",
      'bankcard.estimateLater': "Example for later: educational estimate in today's money over {years}",
      'bankcard.etfReal': 'Broad ETF (real)',
      'bankcard.cashReal': '0% account (real)',
      'bankcard.nominal': 'ETF nominal: about {amount}',

      'board.title': 'Friends leaderboard',
      'board.demo': 'Sample friends (demo)',
      'board.levelUp': 'Milestone',
      'board.gap': '{n} XP behind first place. Tomorrow can close the gap.',
      'board.lead': "You're leading. Keep your practice going tomorrow.",
      'board.challenge': 'Challenge a friend',
      'board.copied': 'Invite copied. Send it to a friend!',
      'board.copyFail': "Couldn't copy. Here's the invite: {text}",
      'board.invite': "I'm on Day {d} of the 14-day Finance Quest sprint with {xp} XP. Can you catch me?",

      'bank.title': 'Your sample plan at Commerzbank',
      'bank.preview': 'Preview of the banking app. Nothing is executed in the demo.',
      'bank.choose': 'Choose a step',
      'bank.optA': "Option A: today's step",
      'bank.recommended': 'Recommended',
      'bank.transfer': 'Transfer {amount} to {account}',
      'bank.optB': 'Option B: sample plan for Day 14',
      'bank.optBSavings': 'Cushion: {amount}/mo to a savings account. ETF later (example {etf}/mo).',
      'bank.kyc': 'In production: suitability test, identity check (KYC), cost and risk information.',
      'bank.noTransfer': 'Educational simulation — no money will be transferred.',
      'bank.simulate': 'Simulate this step (demo, no transfer)',
      'bank.success': 'Your Day {d} step is recorded. See you tomorrow.',
      'bank.successNote': 'Simulated: {what}. Nothing was executed in the demo.',
      'bank.nextGen': 'Try another generation (demo)',
      'bank.whatA': 'transfer of {amount} to {account}',
      'bank.whatB': 'sample plan of {amount}/mo',

      'cp.srTitle': 'Checkpoint #1',
      'cp.title': 'Checkpoint #1',
      'cp.sub': 'Four quick questions on Days 1–4. Score 75% to earn the Foundation Ready badge.',
      'cp.q': 'Question {i} of {n}',
      'cp.next': 'Next question',
      'cp.submit': 'Check my answers',
      'cp.score': '{n}% correct',
      'cp.retry': 'Try the quiz again',
      'cp.back': 'Back to my plan',
      'cp.unavailable': "Checkpoint #1 isn't available on this server yet.",
      'cp.correct': 'Correct',
      'cp.incorrect': 'Not quite',

      'cora.ask': 'Ask Atlas',
      'cora.title': 'Ask Atlas',
      'cora.sub': 'Plain words, a real-life example and a 10-second check.',
      'cora.label': 'What feels unclear?',
      'cora.placeholder': 'For example: why does cash lose value?',
      'cora.send': 'Explain',
      'cora.topics': 'Quick topics',
      'cora.simple': 'In plain words',
      'cora.example': 'Real-life example',
      'cora.drill': 'Quick check',
      'cora.right': 'Correct!',
      'cora.wrong': 'Not quite.',
      'cora.offline': 'Offline explanation',
      'cora.thinking': 'Atlas is preparing an answer',
      'cora.again': 'Ask something else',
      'cora.topic.inflation': 'Inflation',
      'cora.topic.etf': "What's an ETF?",
      'cora.topic.cushion': 'Emergency cushion',
      'cora.topic.dip': 'A -20% dip',
      'cora.topic.diversification': 'Diversification',
      'cora.topic.fees': 'Fees (TER)',

      'judges.title': 'How Finance Quest works',
      'judges.sub': 'Commerzbank challenge: from financial knowledge to a first real step.',
      'judges.jumpDay4': 'Jump to Day 4',
      'judges.openCp': 'Open Checkpoint #1',
      'judges.noMultiDay': "This server doesn't have Days 2–4 yet.",
      'judges.demoHint': 'Sample life stages and presenter shortcuts live in Demo, top right.',
      'demo.toggle': 'Demo',
      'demo.title': 'Demo mode',
      'demo.stages': 'Sample life stage',
      'demo.shortcuts': 'Presenter shortcuts',
      'demo.needProfile': 'Pick a life stage first.',

      'toast.network': "Can't reach the server. Start the backend: uvicorn backend.main:app --port 8000",
      'toast.timeout': 'The server took too long. Try again.',
      'toast.server': 'Server error ({n}). Try again.',
      'toast.generic': 'Something went wrong. Try again.',
      'toast.answerLength': 'Answers can be 1 to 600 characters.',
      'toast.sessionLost': "Couldn't restore your session. Pick a life stage again.",
      'toast.lessonDone': '+{n} XP for a lesson',

      // Tap-to-define glossary (one plain sentence each)
      'define.see': 'See real-life example (Ask Atlas)',
      'define.etf.t': 'ETF (exchange-traded fund)',
      'define.etf.d': 'A fund you buy on the stock exchange like a single share, but it holds many companies at once, so one purchase spreads your money widely.',
      'define.ter.t': 'TER (total expense ratio)',
      'define.ter.d': "A fund's yearly fee, taken as a small percentage of your money; the lower it is, the more of the growth stays with you.",
      'define.inflation.t': 'Real inflation',
      'define.inflation.d': 'Prices rising over time, so money that earns 0% buys a little less every year.',
      'define.cushion.t': 'Emergency fund',
      'define.cushion.d': 'Money for surprises, usually 3–6 months of costs, kept easy to reach and separate from investments.',
      'define.diversification.t': 'Diversification',
      'define.diversification.d': 'Spreading money across many companies, sectors and countries, so one stumble matters less; risk shrinks but does not vanish.',
      'define.mifid.t': 'MiFID II',
      'define.mifid.d': 'EU rules that protect investors: a bank must check that a product suits you and explain its costs and risks.',
      'define.mifid.q': 'What is MiFID II?',

      // Panic vs Discipline (consequences of the -20% decision)
      'pvd.title': 'Panic vs Discipline',
      'pvd.lead': 'The same plan of {amount}/mo, two reactions to the -20% dip in year 3, compared over {years}:',
      'pvd.panic': 'Panic: sell in the dip',
      'pvd.panicSell': 'Sold in year 3 for',
      'pvd.panicLocked': 'The -20% is locked in',
      'pvd.panicRest': 'Next payments go to a 0% account',
      'pvd.discipline': 'Discipline: keep the plan',
      'pvd.disciplineHold': 'Paper value in the dip',
      'pvd.disciplineNote': 'Not sold, so not lost',
      'pvd.disciplineRest': 'Payments continue as planned',
      'pvd.total': "After {years}, in today's money",
      'pvd.gap': 'Discipline: about {amount} more in today\'s money',
      'pvd.note': 'Illustrative: same assumptions as the time machine (5.7% a year after costs, 3.5% inflation, today\'s PLN). The dip is an educational scenario; history does not guarantee the future.',

      'level.1': 'Observer',
      'level.2': 'Confident Start',
      'level.3': 'Steady Builder',
      'unit.currency': 'PLN',
      'unit.thousand': 'k',
      'unit.year1': 'year',
      'unit.year2': 'years',
      'unit.yearN': 'years',
    },

    pl: {
      'meta.title': 'Finance Quest od Commerzbanku',
      'meta.description': 'Finance Quest od Commerzbanku: pewność inwestycyjna w 14-dniowym sprincie, po 5 minut dziennie.',
      'a11y.skip': 'Przejdź do treści',
      'brand.sub': 'od Commerzbanku, 14-dniowy Sprint Pewności',
      'common.close': 'Zamknij',
      'entry.demo': 'DEMO · symulacja Commerzbanku',
      'entry.account': 'Konto codzienne',
      'entry.available': 'Dostępne saldo · dane przykładowe',
      'entry.transaction1': 'Wynagrodzenie · przykład',
      'entry.transaction2': 'Czynsz · przykład',
      'entry.transactions': 'Ostatnie przykładowe transakcje',
      'entry.cta': 'Stwórz swój plan inwestycyjny i zacznij inwestować w 14 dni',
      'entry.note': 'Nic nie zostanie wykonane. To prowadzona symulacja edukacyjna.',
      'entry.whyTitle': 'Spokojniejszy start',
      'entry.whyText': 'Atlas, przewodnik finansowy Commerzbanku, zamienia dużą decyzję finansową w jeden jasny krok naraz.',
      'intro.next': 'Dalej', 'intro.skip': 'Pomiń',
      'intro.1.title': 'Inflacja działa po cichu, ale naprawdę.', 'intro.1.copy': 'Konto 0% trzyma tę samą liczbę, gdy ceny idą w górę. Wiedza finansowa pomaga chronić to, co możesz kupić za swoje pieniądze.',
      'intro.2.title': 'Bez wielkich kwot i żargonu.', 'intro.2.copy': 'Wystarczy 5 minut i jeden prosty nawyk. Atlas mówi prostym językiem i prowadzi przez praktyczne kroki.',
      'intro.3.title': 'Więcej spokoju. Więcej kontroli.', 'intro.3.copy': 'Wiesz, co zrobić przy awarii albo spadkach na rynku. Pewność rośnie, gdy kolejny krok jest jasny.',
      'name.badge': 'Twój plan osobisty', 'name.title': 'Jak mamy się do Ciebie zwracać?', 'name.copy': 'Atlas przygotuje Twój plan.', 'name.label': 'Imię', 'name.placeholder': 'Na przykład Ania', 'name.note': 'Służy wyłącznie do personalizacji planu i podsumowań.', 'name.skip': 'Pomiń na razie', 'name.continue': 'Dalej',

      'hud.home': 'Finance Quest, strona główna',
      'hud.day': 'Dzień',
      'hud.dayTitle': 'Dzień Twojego 14-dniowego sprintu',
      'hud.streakTitle': 'Dni praktyki',
      'hud.practiceLabel': 'Dni praktyki:',
      'hud.xpTitle': 'Punkty praktyki (XP)',
      'hud.stageTitle': 'Etap kompetencji',
      'hud.stageShort': 'Etap {n}/5',
      'hud.stageLong': 'Etap {n}: {title}',
      'hud.readiness': 'Gotowość',
      'hud.readinessCalm': 'Gotowość i ochrona kapitału',
      'hud.sound': 'Efekty dźwiękowe',
      'hud.calm': 'Większa czcionka / Calm UI',
      'hud.calmOn': 'Większa czcionka i spokojny układ są włączone.',
      'hud.calmOff': 'Przywrócono standardową wielkość tekstu.',
      'hud.language': 'Język',
      'hud.reset': 'Reset / Profil',
      'hud.judges': 'Dla jury',
      'hud.menu': 'Więcej opcji',
      'hud.soundOn': 'Dźwięk włączony',
      'hud.soundOff': 'Dźwięk wyłączony',

      'onb.title': 'Zbuduj pewność inwestycyjną w 14 dni.',
      'onb.lead': 'Po 5 minut dziennie. Wybierz etap życia, a Atlas pominie całą teorię, której jeszcze nie potrzebujesz.',
      'onb.bubble': 'Nazywam się Atlas, jestem przewodnikiem finansowym Commerzbanku. Wybierz etap życia, który najlepiej do Ciebie pasuje.',
      'onb.bubbleName': 'Witamy, {name}. Wybierz etap życia, który najlepiej do Ciebie pasuje, a przygotuję Twój plan.',
      'onb.stagesTitle': 'Na jakim etapie życia jesteś?',
      'onb.stagesHint': 'Jedno kliknięcie układa Twój plan.',
      'onb.tailorToggle': 'To nie do końca Ty? Odpowiedz na 6 szybkich pytań',
      'onb.building': 'Wycinam zbędną teorię…',

      'stage.first.name': 'Pierwsza wypłata', 'stage.first.meta': 'Pokolenie Z, 22 l.', 'stage.first.desc': 'Start od zera, poduszka dopiero rośnie',
      'stage.home.name': 'Własny dom', 'stage.home.meta': 'Pokolenie Y, 38 l.', 'stage.home.desc': 'Budżet rodzinny, mało czasu na giełdę',
      'stage.peak.name': 'Szczyt kariery', 'stage.peak.meta': 'Pokolenie X, 47 l.', 'stage.peak.desc': 'Dobre zarobki i strach przed stratą',
      'stage.pre.name': 'Przed emeryturą', 'stage.pre.meta': '55+, 56 l.', 'stage.pre.desc': 'Chronisz to, co udało się zbudować',
      'stage.go': 'Zaczynam',
      'stage.custom': 'Twój profil',

      'form.age': 'Twój wiek',
      'form.net': 'Zarobki netto miesięcznie',
      'form.netHint': 'Tyle, ile co miesiąc wpływa na konto.',
      'form.free': 'Wolne środki miesięcznie',
      'form.freeHint': 'Maks. {max}, nigdy więcej niż zarobki.',
      'form.fund': 'Poduszka finansowa (min. 3 mies. wydatków)',
      'form.fundYes': 'Mam ją',
      'form.fundNo': 'Dopiero ją buduję',
      'form.concern': 'Czego najbardziej się obawiasz?',
      'form.confidence': 'Jak pewnie czujesz się na myśl o zainwestowaniu pierwszych pieniędzy?',
      'form.scaleLow': '1, wcale',
      'form.scaleHigh': '5, bardzo pewnie',
      'form.cta': 'Ułóż mój 14-dniowy plan',
      'form.ctaBusy': 'Układam Twój plan…',
      'err.age': 'Wiek musi mieścić się w przedziale 18–70 lat.',
      'err.net': 'Zarobki netto: od 2 500 do 25 000 zł.',
      'err.free': 'Wolne środki: od 200 do 10 000 zł i nie więcej niż zarobki netto.',
      'err.fund': 'Zaznacz, czy masz już poduszkę.',
      'err.concern': 'Wybierz, czego najbardziej się obawiasz.',
      'err.conf': 'Wybierz ocenę od 1 do 5.',
      'err.fixForm': 'Popraw zaznaczone pytania.',
      'group.20+': 'Młody Start (20+)',
      'group.30-50': 'Kariera i Rodzina (30–50)',
      'group.50+': 'Ochrona Kapitału (50+)',
      'concern.freeze_money': 'Boję się, że zamrożę pieniądze',
      'concern.no_time': 'Nie mam czasu na giełdę',
      'concern.lose_money': 'Boję się, że stracę pieniądze',
      'concern.too_late': 'Chyba za późno na start',

      'hub.srTitle': 'Twój 14-dniowy plan',
      'hub.horizon': 'Horyzont: {n}',
      'hub.worry': 'Obawa: {x}',
      'hub.phase': 'Faza {n}',
      'hub.phase1.range': 'Dni 1–4', 'hub.phase1.title': 'Fundamenty i pierwszy krok',
      'hub.phase2.range': 'Dni 5–9', 'hub.phase2.title': 'Ryzyko, bezpieczeństwo i emocje',
      'hub.phase3.range': 'Dni 10–14', 'hub.phase3.title': 'Twój prawdziwy plan',
      'hub.perDay': '~5 min dziennie',
      'hub.day': 'Dzień {n}',
      'hub.day2Title': 'Konto maklerskie i opłaty',
      'hub.day3Title': 'Automat: zlecenie stałe',
      'hub.checkpoint': 'Checkpoint #1',
      'hub.checkpointSub': 'Szybki test wiedzy',
      'hub.checkpoint2': 'kończy się Checkpointem #2',
      'hub.finale': 'kończy się finałem sprintu',
      'hub.start': 'Dziś',
      'hub.resume': 'W toku',
      'hub.startMission': 'Zacznij symulację Dnia {n} · ~5 min',
      'hub.resumeMission': 'Kontynuuj symulację Dnia {n}',
      'hub.nextDay': 'Zacznij Dzień {n}',
      'hub.openCheckpoint': 'Zacznij Checkpoint #1',
      'hub.reviewDay': 'Wyniki Dnia {n}',
      'hub.locked': 'Odblokujesz po Dniu {n}',
      'hub.lockedCp': 'Odblokujesz po Dniu 4',
      'hub.tomorrow': 'Dzień {n} otworzy się jutro. Wróć, żeby kontynuować praktykę.',
      'hub.after14.title': 'Po Dniu 14: ucz się dalej',
      'hub.after14.sub': 'Sprint daje start. Krótkie comiesięczne sesje utrzymują nawyk.',
      'hub.done': 'Zaliczone',
      'hub.steps': 'Dzisiejszy plan',
      'hub.step1': 'Twój plan',
      'hub.step2': 'Symulator: co jeśli?',
      'hub.step3': 'Lekcje Dnia {n}',
      'hub.next': 'Dalej',
      'hub.back': 'Wstecz',
      'hub.soon': 'Dostępne w pełnym 14-dniowym sprincie. Najpierw ukończ Dni 1–4 i Checkpoint #1.',
      'hub.pebble': 'Dzień {n}, część pełnego 14-dniowego sprintu',
      'hub.checkpoint2Short': 'Checkpoint #2',
      'hub.finaleShort': 'Finał sprintu',

      'garden.title': 'Etap kompetencji',
      'garden.stageLabel': 'Etap {stage} z 5',
      'garden.stage1': 'Fundamenty planu',
      'garden.stage2': 'Kontrola płynności',
      'garden.stage3': 'Spokój na spadkach',
      'garden.stage4': 'Architekt planu',
      'garden.stage5': 'Gotowość do startu',
      'garden.toNext': '{xp} XP praktyki do kolejnego etapu: {title}',
      'garden.complete': 'Wszystkie pięć etapów osiągnięte. Utrzymuj comiesięczne check-iny.',
      'garden.progress': 'Postęp etapów',
      'garden.grew': 'Nowy etap: {from} → {to}',
      'garden.current': 'Obecny etap',
      'garden.quote1': 'Znasz punkt wyjścia: dochód, wolne środki i poduszkę.',
      'garden.quote2': 'Poduszka jest pierwsza, więc nagły rachunek nie zmusza do sprzedaży.',
      'garden.quote3': 'Spadek -20% to wahanie, nie strata — dopóki nie sprzedasz.',
      'garden.quote4': 'Planujesz kwotą, horyzontem i kosztami — a nie zgadywaniem.',
      'garden.quote5': 'Fundamenty potwierdzone. Możesz zrobić pierwszy, mały krok.',
      'garden.svgLabel': 'Wykres filarów kapitału, etap {stage} z 5',

      'plan.title': 'Twój przykładowy podział',
      'plan.label': 'Przykładowa kwota docelowa miesięcznie',
      'plan.cushion': 'Poduszka',
      'plan.etf': 'Trening w szeroki ETF',
      'plan.mo': '/mies.',
      'plan.shares': 'ok. {a}% na poduszkę, {b}% na trening w ETF',
      'plan.range': 'Przykładowy zakres w szerokim ETF',
      'plan.sim': 'Wehikuł czasu liczy dla {amount}/mies.',
      'plan.etfLater': 'ETF później. Wehikuł czasu pokazuje przykład {amount}/mies.',

      'skip.badge': 'Pominęliśmy {n} tematów, których nie potrzebujesz na start',
      'skip.kept': 'Twoje 3 priorytety na dziś',
      'skip.removed': 'Na razie możesz to pominąć',

      'lessons.title': 'Lekcje na 20 sekund',
      'lessons.titleDay': 'Lekcje Dnia {n}',
      'lessons.sub': 'Zalicz każdy mini-check, by odblokować wyzwanie, do +{n} XP',
      'lessons.progress': 'Zaliczone lekcje: {a} z {b}',
      'lessons.check': 'Szybki sprawdzian',
      'lessons.right': 'Dobrze, lekcja zaliczona',
      'lessons.wrong': 'Jeszcze nie to. Spójrz jeszcze raz na najważniejszą myśl.',
      'lessons.askGuide': 'Poproś Atlasa o wyjaśnienie',
      'hub.gateLessons': 'Najpierw zalicz mini-checki lekcji ({a}/{b}) i check-in z Atlasem',
      'hub.gateCheckin': 'Najpierw check-in z Atlasem',
      'checkin.title': 'Check-in z Atlasem',
      'checkin.q': 'Czy ten dział jest zrozumiały, czy mam coś jeszcze wyjaśnić przed zadaniem?',
      'checkin.yes': 'Tak, wytłumacz coś jeszcze',
      'checkin.start': 'Wszystko jasne: zacznij wyzwanie Dnia {n}',
      'checkin.done': 'Check-in zaliczony. Wyzwanie Dnia {n} odblokowane.',
      'lessons.got': 'Rozumiem (+{n} XP)',
      'lessons.done': 'Zaliczone, +{n} XP',
      'lessons.explain': 'Wyjaśnij prościej',
      'lessons.sec': '{n} sek.',

      'tm.title': 'Wehikuł czasu: gotówka vs szeroki ETF',
      'tm.sub': 'Wszystko w dzisiejszych złotych, więc obie linie porównujemy uczciwie.',
      'tm.slider': 'Lata inwestowania',
      'tm.monthly': 'Przykład: {amount}/mies.',
      'tm.kpiCash': 'Wpłaty na koncie 0% (realnie)',
      'tm.kpiEtf': 'Szeroki ETF (realnie, założenia niżej)',
      'tm.kpiWin': 'Ilustracyjne okna historyczne',
      'tm.paid': 'Wpłacono łącznie: {amount}',
      'tm.nominal': 'Nominalnie: ok. {amount}',
      'tm.winText': 'kończyło się dodatnim wynikiem realnym (dane ilustracyjne, maks. 97%)',
      'tm.legendEtf': 'Szeroki ETF (realnie)',
      'tm.legendCash': 'Konto 0% (realnie)',
      'tm.legendStress': 'Wahanie -20% w roku 3 (edukacyjnie)',
      'tm.chartAria': 'Wykres: wpłaty na koncie 0% i w szerokim ETF w dzisiejszych złotych, ze scenariuszem wahania -20% w roku 3',
      'tm.history': 'Symulacja historyczna; wyniki są zmienne i nie gwarantują przyszłych zysków.',
      'tm.yAxis': 'zł (dzisiejsze)',
      'tm.year': 'Rok {n}',
      'tm.whatIf': 'Co jeśli wpłacę inną kwotę?',
      'tm.amountPill': '{amount}/mies.',
      'tm.reset': 'Wróć do mojego planu',
      'tm.planNote': 'Twój przykładowy plan: {plan}/mies. Przesuń, by sprawdzić inną kwotę.',
      'tm.whatIfNote': 'Co jeśli: {amount}/mies. zamiast przykładowych {plan}/mies. Te same założenia co niżej.',

      'cow.title': 'Koszt czekania (erozja inflacyjna)',
      'cow.lead': 'Przez {years} przy {amount}/mies. — horyzont Twojego pokolenia — w dzisiejszych złotych:',
      'cow.paid': 'Wpłacasz łącznie',
      'cow.cash': 'Trzymane na koncie 0%',
      'cow.cashLoss': 'Utrata siły nabywczej: {amount}',
      'cow.etf': 'Szeroki ETF (ilustracyjnie)',
      'cow.etfGain': 'O {amount} więcej niż gotówka',
      'cow.note': 'Te same założenia co na wykresie: 5,7% rocznie po kosztach, inflacja 3,5%. Ilustracja, a nie prognoza ani gwarancja.',

      'compliance.mifid': 'Aplikacja Finance Quest ma charakter wyłącznie edukacyjny i symulacyjny. Wyliczenia opierają się na uproszczonych założeniach i danych historycznych, nie uwzględniają podatku od zysków, opłat ani ryzyka walutowego, nie gwarantują przyszłych wyników i nie stanowią doradztwa inwestycyjnego ani rekomendacji w rozumieniu dyrektywy MiFID II. Inwestowanie wiąże się z ryzykiem utraty części lub całości kapitału.',
      'ai.disclaimer': 'Atlas to przewodnik AI i może popełniać błędy. Symulacja wyłącznie edukacyjna — to nie jest porada inwestycyjna.',

      'mission.srTitle': 'Symulacja decyzji',
      'mission.close': 'Zamknij symulację',
      'mission.progress': 'Postęp symulacji',
      'mission.explain': 'Wyjaśnij prościej',
      'mission.check': 'Sprawdź moją odpowiedź',
      'mission.checking': 'Sprawdzam odpowiedź…',
      'mission.continue': 'Dalej',
      'mission.tryAgain': 'Spróbuj jeszcze raz',
      'mission.finish': 'Zobacz wyniki',
      'mission.dayChip': 'Dzień {d} z 14',
      'mission.stepChip': 'Krok {s} z {t}',
      'mission.portfolio': 'Portfel w symulacji: {amount}',
      'mission.coraWho': 'Atlas, przewodnik finansowy Commerzbanku',
      'mission.ownLabel': 'Albo odpowiedz własnymi słowami',
      'mission.ownPlaceholder': 'Napisz Atlasowi, co robisz i dlaczego…',
      'mission.ownHint': 'Enter sprawdza, Shift+Enter to nowa linia',
      'mission.thinking': 'Atlas czyta Twoją odpowiedź',
      'mission.right': 'Dobrze.|To rozsądne podejście.|Dokładnie tak.',
      'mission.partial': 'Rozsądnie, ale jest haczyk',
      'mission.invalid': 'Spróbuj, proszę, jeszcze raz',
      'mission.fallback': 'Dzięki, spójrzmy na liczby',
      'mission.yourAnswer': 'Twoja odpowiedź: „{a}”',
      'mission.readinessPill': 'Gotowość +{n}',
      'mission.stagePill': 'Nowy etap: {title}',
      'mission.zeroXp': '0 XP',
      'mission.pickOrType': 'Wybierz kartę albo napisz kilka słów.',
      'mission.practice': 'Ćwiczenie',

      'alloc.q': 'Jak podzielisz wolne środki?',
      'alloc.msgNoCushion': 'Masz {free} wolnych środków miesięcznie i jeszcze bez poduszki. Przesuń suwak i wybierz, ile idzie na trening w szeroki ETF. Reszta buduje poduszkę.',
      'alloc.msgCushion': 'Poduszkę już masz. Przesuń suwak i wybierz, ile z {free} wolnych środków miesięcznie idzie do szerokiego ETF. Reszta zostaje w łatwo dostępnych oszczędnościach.',
      'alloc.slider': 'Miesięczna kwota na szeroki ETF',
      'alloc.pill': '{amount} na ETF',
      'alloc.safe': 'Poduszka',
      'alloc.safeAlt': 'Dostępne oszczędności',
      'alloc.grow': 'Potencjał wzrostu',
      'alloc.swing': 'Krótkie wahania',
      'alloc.note': 'Po {years} część w ETF mogłaby być warta ok. {amount} w dzisiejszych złotych (ilustracyjnie).',
      'alloc.okNoCushion': 'Najpierw poduszka. Gdy większość trafia do niej, zepsuty laptop nie zmusi Cię do sprzedaży w czasie spadku.',
      'alloc.tooMuchNoCushion': 'Odważnie, ale bez poduszki jeden nagły rachunek może zmusić Cię do sprzedaży w złym momencie. Na razie większość daj do poduszki.',
      'alloc.okCushion': 'Wyważone. Część pracuje długo w szerokim ETF, część zostaje pod ręką.',
      'alloc.tooLowCushion': 'Poduszkę masz, więc trzymanie wszystkiego w gotówce oddaje pole inflacji (3,5% rocznie w naszych założeniach). Spróbuj większej części.',
      'alloc.tooHighCushion': 'To większość wolnych środków. Gdy część zostaje pod ręką, łatwiej przetrwać spadki. Spróbuj trochę mniej.',
      'alloc.okTitle': 'Rozsądny podział',
      'alloc.tryTitle': 'Prawie — popraw suwak',

      'myth.tag': 'Mit czy fakt?',
      'myth.intro': 'Wielu początkujących w to wierzy. Mit czy fakt? Kliknij odpowiedź.',
      'myth.myth': 'Mit',
      'myth.reality': 'Fakt',
      'myth.rightTitle': 'Dobrze — to {v}',
      'myth.wrongTitle': 'Nie do końca — to {v}',
      'myth.vMyth': 'mit',
      'myth.vReality': 'fakt',
      'myth.freeze_money.s': 'Pieniądze w szerokim ETF są zamrożone na lata.',
      'myth.freeze_money.e': 'Jednostki sprzedasz w każdy dzień sesji, a wypłata trafia zwykle w kilka dni roboczych. Poduszka sprawia tylko, że rzadko musisz to robić.',
      'myth.no_time.s': 'Żeby dobrze inwestować, trzeba codziennie patrzeć na giełdę.',
      'myth.no_time.e': 'Zlecenie stałe na szeroki ETF działa w tle. Codzienne zaglądanie zwykle dokłada stresu, a nie wyników.',
      'myth.lose_money.s': 'Nawet szeroki ETF może przez jakiś czas tracić na wartości.',
      'myth.lose_money.e': 'Prawda. Może spadać, czasem mocno. Rozłożenie pieniędzy na setki firm łagodzi wpadkę jednej z nich, ale ryzyko rynku zostaje. Dlatego poduszka leży osobno.',
      'myth.too_late.s': 'Po pięćdziesiątce inwestowanie nie ma już sensu.',
      'myth.too_late.e': 'Horyzont 5–10 lat to nadal czas, żeby pieniądze pracowały. Liczy się dopasowanie horyzontu i proporcji oraz osobna poduszka.',

      'spot.q': 'Te dwa fundusze wyglądają prawie tak samo. Kliknij wiersz, który po cichu kosztuje Cię co roku.',
      'spot.fundA': 'Szeroki Fundusz Globalny A',
      'spot.fundB': 'Szeroki Fundusz Globalny B',
      'spot.companies': 'Liczba spółek',
      'spot.region': 'Region',
      'spot.regionVal': 'Cały świat',
      'spot.ter': 'Roczna opłata (TER)',
      'spot.div': 'Dywidendy',
      'spot.divVal': 'Reinwestowane',
      'spot.rightTitle': 'To ten',
      'spot.right': 'TER pobierany jest co roku, więc niższa opłata zostawia Ci więcej wzrostu. Porównuj go przed zakupem.',
      'spot.wrongTitle': 'Dobre oko — spójrz jeszcze raz',
      'spot.wrong': 'Ten wiersz prawie nie zmienia wyniku. Roczna opłata (TER) pobierana jest co roku, więc to ją warto porównać.',

      'done.srTitle': 'Dzień ukończony',
      'done.title': 'Dzień {d} zaliczony',
      'done.earned': 'punktów praktyki dziś',
      'done.levelUp': 'Osiągnięty kamień milowy: {title}',
      'done.toNext': 'Do kolejnego kamienia milowego: {n} XP',
      'done.readiness': 'Gotowość',
      'done.readinessNote': 'Pełną gotowość da dopiero Dzień 14.',
      'done.selfQ': 'Jak pewnie czujesz się teraz?',
      'done.selfBefore': 'Przed: {n}/5. Zaznacz, jak jest teraz.',
      'done.selfCompare': 'Przed: {a}/5, teraz: {b}/5',
      'done.next': 'Przejdź do Dnia {n}',
      'done.checkpoint': 'Zacznij Checkpoint #1',
      'done.toMap': 'Wróć do planu',
      'done.streak': 'Dzień praktyki zapisany. Do jutra.',
      'done.badgeLabel': 'Kamień milowy',
      'done.tabs': 'Podsumowanie dnia',
      'done.tabToday': 'Dzisiejszy krok',
      'done.tabMore': 'Checklista, ranking i Po Dniu 14',

      'first.title': 'Zrób pierwszy prawdziwy krok',
      'first.sub': 'Mały, bezpieczny i dziś. Tak pewność zamienia się w działanie.',
      'first.challenge': 'Dzisiejsze realne wyzwanie',
      'first.accept': 'Podejmuję wyzwanie (+{n} XP)',
      'first.accepted': 'Wyzwanie przyjęte',
      'first.checklist': 'Twoja checklista na start',
      'first.allDone': 'Komplet. Możesz teraz podejrzeć pierwszy krok w banku.',
      'first.toBank': 'Otwórz przykładowy plan w Commerzbanku',

      'bankcard.title': 'Przykładowy plan w Commerzbanku',
      'bankcard.demo': 'Demo',
      'bankcard.today': 'Dziś',
      'bankcard.day14': 'Dzień 14: plan docelowy',
      'bankcard.micro': 'Mikro-ruch: {amount} na {account}',
      'bankcard.cushion': 'Poduszka: {amount}/mies. na konto oszczędnościowe',
      'bankcard.etfLater': 'ETF później, przykład {amount}/mies.',
      'bankcard.monthly': '{amount}/mies. przez {years}',
      'bankcard.parallel': 'Równolegle: poduszka {amount}/mies. na konto oszczędnościowe',
      'bankcard.estimate': 'Szacunek edukacyjny w dzisiejszych złotych, horyzont {years}',
      'bankcard.estimateLater': 'Przykład na później: szacunek edukacyjny w dzisiejszych złotych, horyzont {years}',
      'bankcard.etfReal': 'Szeroki ETF (realnie)',
      'bankcard.cashReal': 'Konto 0% (realnie)',
      'bankcard.nominal': 'ETF nominalnie: ok. {amount}',

      'board.title': 'Ranking znajomych',
      'board.demo': 'Przykładowi znajomi (demo)',
      'board.levelUp': 'Kamień milowy',
      'board.gap': 'Do 1. miejsca brakuje Ci {n} XP. Jutro możesz to nadrobić.',
      'board.lead': 'Prowadzisz w rankingu. Kontynuuj praktykę jutro.',
      'board.challenge': 'Wyzwij znajomego',
      'board.copied': 'Zaproszenie skopiowane. Wyślij je znajomemu!',
      'board.copyFail': 'Nie udało się skopiować. Treść zaproszenia: {text}',
      'board.invite': 'Jestem na Dniu {d} z 14 w Finance Quest i mam {xp} XP. Dogonisz mnie?',

      'bank.title': 'Przykładowy plan w Commerzbanku',
      'bank.preview': 'Podgląd aplikacji bankowej. W wersji demo nic nie zostanie wykonane.',
      'bank.choose': 'Wybierz krok',
      'bank.optA': 'Opcja A: krok na dziś',
      'bank.recommended': 'Polecana',
      'bank.transfer': 'Przelew {amount} na {account}',
      'bank.optB': 'Opcja B: przykładowy plan na Dzień 14',
      'bank.optBSavings': 'Poduszka: {amount}/mies. na konto oszczędnościowe. ETF później (przykład {etf}/mies.).',
      'bank.kyc': 'W wersji produkcyjnej: test odpowiedniości, weryfikacja tożsamości (KYC), informacja o kosztach i ryzyku.',
      'bank.noTransfer': 'Symulacja edukacyjna — nic nie zostanie przelane.',
      'bank.simulate': 'Symuluj ten krok (demo, bez przelewu)',
      'bank.success': 'Krok Dnia {d} zapisany. Do zobaczenia jutro.',
      'bank.successNote': 'Symulacja: {what}. W wersji demo nic nie zostało wykonane.',
      'bank.nextGen': 'Przetestuj inne pokolenie (demo)',
      'bank.whatA': 'przelew {amount} na {account}',
      'bank.whatB': 'przykładowy plan {amount}/mies.',

      'cp.srTitle': 'Checkpoint #1',
      'cp.title': 'Checkpoint #1',
      'cp.sub': 'Cztery szybkie pytania z Dni 1–4. Zdobądź 75%, a odblokujesz odznakę Fundamenty Opanowane.',
      'cp.q': 'Pytanie {i} z {n}',
      'cp.next': 'Następne pytanie',
      'cp.submit': 'Sprawdź odpowiedzi',
      'cp.score': '{n}% poprawnych',
      'cp.retry': 'Spróbuj quizu jeszcze raz',
      'cp.back': 'Wróć do planu',
      'cp.unavailable': 'Checkpoint #1 nie jest jeszcze dostępny na tym serwerze.',
      'cp.correct': 'Dobrze',
      'cp.incorrect': 'Nie do końca',

      'cora.ask': 'Zapytaj Atlasa',
      'cora.title': 'Zapytaj Atlasa',
      'cora.sub': 'Prosto, na przykładzie z życia i z 10-sekundowym sprawdzianem.',
      'cora.label': 'Co jest niejasne?',
      'cora.placeholder': 'Na przykład: dlaczego gotówka traci wartość?',
      'cora.send': 'Wyjaśnij',
      'cora.topics': 'Szybkie tematy',
      'cora.simple': 'Najprościej',
      'cora.example': 'Przykład z życia',
      'cora.drill': 'Szybki sprawdzian',
      'cora.right': 'Dobrze!',
      'cora.wrong': 'Nie do końca.',
      'cora.offline': 'Wyjaśnienie offline',
      'cora.thinking': 'Atlas przygotowuje odpowiedź',
      'cora.again': 'Zapytaj o coś innego',
      'cora.topic.inflation': 'Inflacja',
      'cora.topic.etf': 'Co to ETF?',
      'cora.topic.cushion': 'Poduszka finansowa',
      'cora.topic.dip': 'Spadek -20%',
      'cora.topic.diversification': 'Dywersyfikacja',
      'cora.topic.fees': 'Opłaty (TER)',

      'judges.title': 'Jak działa Finance Quest',
      'judges.sub': 'Wyzwanie Commerzbanku: od wiedzy finansowej do pierwszego realnego kroku.',
      'judges.jumpDay4': 'Skocz do Dnia 4',
      'judges.openCp': 'Otwórz Checkpoint #1',
      'judges.noMultiDay': 'Ten serwer nie ma jeszcze Dni 2–4.',
      'judges.demoHint': 'Przykładowe etapy życia i skróty dla prowadzącego są w zakładce Demo, w prawym górnym rogu.',
      'demo.toggle': 'Demo',
      'demo.title': 'Tryb demo',
      'demo.stages': 'Przykładowy etap życia',
      'demo.shortcuts': 'Skróty dla prowadzącego',
      'demo.needProfile': 'Najpierw wybierz etap życia.',

      'toast.network': 'Brak połączenia z serwerem. Uruchom backend: uvicorn backend.main:app --port 8000',
      'toast.timeout': 'Serwer nie odpowiedział na czas. Spróbuj ponownie.',
      'toast.server': 'Błąd serwera ({n}). Spróbuj ponownie.',
      'toast.generic': 'Coś poszło nie tak. Spróbuj ponownie.',
      'toast.answerLength': 'Odpowiedź może mieć od 1 do 600 znaków.',
      'toast.sessionLost': 'Nie udało się odtworzyć sesji. Wybierz etap życia jeszcze raz.',
      'toast.lessonDone': '+{n} XP za lekcję',

      // Słowniczek „Dotknij, by zdefiniować” (jedno proste zdanie)
      'define.see': 'Zobacz przykład z życia (Zapytaj Atlasa)',
      'define.etf.t': 'ETF (fundusz notowany na giełdzie)',
      'define.etf.d': 'Fundusz kupowany na giełdzie jak jedna akcja, który ma w sobie wiele firm naraz, więc jeden zakup szeroko rozkłada pieniądze.',
      'define.ter.t': 'TER (łączny wskaźnik kosztów)',
      'define.ter.d': 'Roczna opłata funduszu liczona jako mały procent Twoich pieniędzy; im niższa, tym więcej wzrostu zostaje u Ciebie.',
      'define.inflation.t': 'Inflacja realna',
      'define.inflation.d': 'Wzrost cen w czasie, przez który pieniądze na 0% co roku kupują trochę mniej.',
      'define.cushion.t': 'Poduszka finansowa',
      'define.cushion.d': 'Pieniądze na niespodzianki, zwykle 3–6 miesięcy wydatków, trzymane pod ręką i osobno od inwestycji.',
      'define.diversification.t': 'Dywersyfikacja',
      'define.diversification.d': 'Rozłożenie pieniędzy na wiele firm, branż i krajów, żeby wpadka jednej mniej bolała; ryzyko maleje, ale nie znika.',
      'define.mifid.t': 'MiFID II',
      'define.mifid.d': 'Unijne przepisy chroniące inwestorów: bank musi sprawdzić, czy produkt do Ciebie pasuje, i wyjaśnić jego koszty oraz ryzyko.',
      'define.mifid.q': 'Czym jest MiFID II?',

      // Panika vs Dyscyplina (konsekwencje decyzji przy spadku -20%)
      'pvd.title': 'Panika vs Dyscyplina',
      'pvd.lead': 'Ten sam plan {amount}/mies., dwie reakcje na spadek -20% w roku 3, w horyzoncie {years}:',
      'pvd.panic': 'Panika: sprzedaż w dołku',
      'pvd.panicSell': 'Sprzedane w roku 3 za',
      'pvd.panicLocked': 'Spadek -20% staje się stratą',
      'pvd.panicRest': 'Kolejne wpłaty trafiają na konto 0%',
      'pvd.discipline': 'Dyscyplina: trzymam plan',
      'pvd.disciplineHold': 'Wartość na papierze w dołku',
      'pvd.disciplineNote': 'Bez sprzedaży nie ma straty',
      'pvd.disciplineRest': 'Wpłaty idą dalej zgodnie z planem',
      'pvd.total': 'Po {years}, w dzisiejszych złotych',
      'pvd.gap': 'Dyscyplina: ok. {amount} więcej w dzisiejszych złotych',
      'pvd.note': 'Ilustracja przy tych samych założeniach co Wehikuł czasu (5,7% rocznie po kosztach, inflacja 3,5%, dzisiejsze złote). Spadek to scenariusz edukacyjny; historia nie gwarantuje przyszłości.',

      'level.1': 'Obserwator',
      'level.2': 'Świadomy Start',
      'level.3': 'Konsekwentny Start',
      'unit.currency': 'zł',
      'unit.thousand': 'tys.',
      'unit.year1': 'rok',
      'unit.year2': 'lata',
      'unit.yearN': 'lat',
    },
  };

  // Structured copy (lists) for the For Judges modal and the "After Day 14" fallback.
  const I18N_BLOCKS = {
    en: {
      judges: [
        { icon: 'users', tone: 'yellow', title: 'Target learner',
          text: 'Self-directed beginners of every age who keep savings in cash because investing feels risky, complex or "not for me yet". Four life stages adapt the horizon, tone and scenarios.' },
        { icon: 'target', tone: 'sky', title: 'Learning objective',
          text: 'After Day 1 the learner can explain why cash loses real value, why a cushion comes before investing, why a broad ETF spreads risk, and why a -20% dip is not a loss unless you sell.' },
        { icon: 'check', tone: 'green', title: 'How it proves understanding',
          list: ['Every free-text answer is graded optimal, partial or invalid. Gibberish earns 0 XP and the step repeats.',
            'Mixed formats: scenario decisions, a cash-split slider, myth vs reality, spotting the fee that matters.',
            '"Explain simpler" and tap-to-define terms give a real-life analogy plus a 3-option check.',
            'The -20% step shows Panic vs Discipline in PLN from the learner\'s own plan.',
            'Readiness, five competence stages and a before/after confidence score make progress visible.'] },
        { icon: 'repeat', tone: 'paper', title: 'How it keeps people coming back',
          list: ['Five competence stages, practice days and a friends leaderboard — measured, not noisy.', 'A real-world micro challenge every day, starting at 5 PLN.',
            'Atlas answers every choice with a calm, specific explanation. Sound is off by default.', '~5 minutes a day for 14 days, then monthly check-ins.'] },
        { icon: 'peak', tone: 'paper', title: 'Innovations for all generations',
          text: 'Gen Z starts with a 200 PLN/mo practice plan and a 15-year horizon. From age 45 the app switches to larger text and a calm layout, shows the cost of waiting in PLN and, for 55+, uses a 7-year horizon and the "is it too late?" scenario. Anyone can toggle "Larger text / Calm UI".' },
        { icon: 'shield', tone: 'paper', title: 'Honest by design',
          text: 'No promised returns and no tickers. Every number shows its assumptions (5.7% after costs, 3.5% inflation, today\'s PLN). Atlas is labelled as an AI guide that can make mistakes.' },
        { icon: 'landmark', tone: 'yellow', title: 'Value for Commerzbank', wide: true,
          text: 'Day 1 ends with a first deposit, Day 2 opens a brokerage or demo account, Day 3 sets up a standing order. That means deposits, assets under management and retention through a channel outside apps cannot reach.' },
        { icon: 'play', tone: 'sky', title: 'Try it in 60 seconds', wide: true,
          text: 'Tap "First paycheck", pass the three lesson checks and start the Day 1 simulation. Type "asdf" in step 1 and watch Atlas reject it with 0 XP. Switch EN | PL in the header at any time.' },
      ],
      after14: [
        { id: 'rebalancing', icon: 'scale', title: 'Portfolio & rebalancing', description: 'Once a quarter, check your proportions and calmly return to your plan.', cadence: 'Quarterly, ~10 min' },
        { id: 'tax_accounts', icon: 'shield', title: 'Tax-advantaged accounts (IKE / IKZE)', description: 'Learn the rules and check whether they fit you. Educational only.', cadence: 'Yearly, ~15 min' },
        { id: 'bonds', icon: 'coins', title: 'Bonds & diversification', description: 'How bonds can steady part of a portfolio.', cadence: 'Yearly, ~10 min' },
        { id: 'checkins', icon: 'chat', title: 'Monthly AI check-ins with Atlas', description: 'A short talk about progress, emotions and your plan.', cadence: 'Monthly, ~5 min' },
      ],
    },
    pl: {
      judges: [
        { icon: 'users', tone: 'yellow', title: 'Odbiorca',
          text: 'Początkujący, samodzielni inwestorzy w każdym wieku, którzy trzymają oszczędności w gotówce, bo inwestowanie wydaje się ryzykowne, skomplikowane albo „jeszcze nie dla mnie”. Cztery etapy życia dopasowują horyzont, ton i scenariusze.' },
        { icon: 'target', tone: 'sky', title: 'Cel nauki',
          text: 'Po Dniu 1 użytkownik potrafi wyjaśnić, dlaczego gotówka traci realną wartość, dlaczego poduszka jest przed inwestowaniem, dlaczego szeroki ETF rozkłada ryzyko i dlaczego spadek -20% nie jest stratą, dopóki nie sprzedajesz.' },
        { icon: 'check', tone: 'green', title: 'Jak sprawdzamy zrozumienie',
          list: ['Każda własna odpowiedź dostaje ocenę: optymalna, częściowa albo nieważna. Bełkot daje 0 XP i krok się powtarza.',
            'Różne formaty: decyzje w scenariuszach, suwak podziału gotówki, mit czy fakt, wskazanie opłaty, która ma znaczenie.',
            '„Wyjaśnij prościej” i klikalne definicje pojęć dają analogię z życia i 3-opcyjny sprawdzian.',
            'Krok ze spadkiem -20% pokazuje Panikę vs Dyscyplinę w złotych, na liczbach z planu użytkownika.',
            'Gotowość, pięć etapów kompetencji i samoocena pewności przed/po pokazują postęp.'] },
        { icon: 'repeat', tone: 'paper', title: 'Co sprawia, że się wraca',
          list: ['Pięć etapów kompetencji, dni praktyki i ranking znajomych — mierzalnie, bez hałasu.', 'Codzienne realne mikro-wyzwanie, od 5 zł.',
            'Atlas odpowiada na każdy wybór spokojnym, konkretnym wyjaśnieniem. Dźwięk jest domyślnie wyłączony.', '~5 minut dziennie przez 14 dni, potem comiesięczne check-iny.'] },
        { icon: 'peak', tone: 'paper', title: 'Innowacje dla wszystkich pokoleń',
          text: 'Pokolenie Z zaczyna od treningu 200 zł/mies. i horyzontu 15 lat. Od 45. roku życia aplikacja przełącza się na większą czcionkę i spokojny układ, pokazuje koszt czekania w złotych, a dla 55+ używa horyzontu 7 lat i scenariusza „czy to nie za późno?”. Każdy może włączyć „Większa czcionka / Calm UI”.' },
        { icon: 'shield', tone: 'paper', title: 'Uczciwie od podstaw',
          text: 'Zero obietnic zysku i zero tickerów. Każda liczba pokazuje założenia (5,7% po kosztach, inflacja 3,5%, dzisiejsze złote). Atlas jest oznaczony jako przewodnik AI, który może się mylić.' },
        { icon: 'landmark', tone: 'yellow', title: 'Wartość dla Commerzbanku', wide: true,
          text: 'Dzień 1 kończy się pierwszą wpłatą, Dzień 2 otwiera konto maklerskie lub demo, Dzień 3 ustawia zlecenie stałe. To depozyty, aktywa w zarządzaniu i retencja w kanale niedostępnym dla zewnętrznych aplikacji.' },
        { icon: 'play', tone: 'sky', title: 'Sprawdź w 60 sekund', wide: true,
          text: 'Kliknij „Pierwsza wypłata”, zalicz trzy mini-checki lekcji i zacznij symulację Dnia 1. W kroku 1 wpisz „asdf” i zobacz, jak Atlas odrzuca to za 0 XP. W nagłówku w każdej chwili przełączysz EN | PL.' },
      ],
      after14: [
        { id: 'rebalancing', icon: 'scale', title: 'Portfel i rebalansowanie', description: 'Raz na kwartał sprawdzasz proporcje i spokojnie wracasz do planu.', cadence: 'Co kwartał, ~10 min' },
        { id: 'tax_accounts', icon: 'shield', title: 'Konta z ulgą podatkową (IKE / IKZE)', description: 'Poznaj zasady i sprawdź, czy pasują do Ciebie. Wyłącznie edukacyjnie.', cadence: 'Raz w roku, ~15 min' },
        { id: 'bonds', icon: 'coins', title: 'Obligacje i dywersyfikacja', description: 'Jak obligacje mogą stabilizować część portfela.', cadence: 'Raz w roku, ~10 min' },
        { id: 'checkins', icon: 'chat', title: 'Comiesięczne check-iny z Atlasem', description: 'Krótka rozmowa o postępach, emocjach i planie.', cadence: 'Co miesiąc, ~5 min' },
      ],
    },
  };

  // Offline bank for "Ask Atlas" — used only when /api/coach/explain is unreachable
  // (route not deployed yet, no network). The backend has its own, richer fallback bank.
  const EXPLAIN_LOCAL = {
    en: {
      inflation: { s: "Inflation means prices rise over time, so the same money buys a bit less each year. Cash in a 0% account doesn't keep up.",
        e: 'A shopping basket costs 200 PLN today. With 3.5% inflation it costs about 207 PLN a year later, while your 200 PLN in a 0% account is still just 200 PLN.',
        q: 'What happens to 1,000 PLN left for a year in a 0% account if inflation is 3.5%?',
        o: ['It buys less than before', 'It buys exactly the same', 'It grows by 3.5%'], c: 0,
        f: 'Right: the number stays the same, but it buys less. That is a real loss of purchasing power.' },
      etf: { s: 'An ETF is a basket of many companies you buy in one go, like a ready-made fruit basket instead of picking single fruits.',
        e: 'Instead of betting on one café, you own a tiny slice of hundreds of businesses worldwide. If one café closes, the basket barely notices.',
        q: "What's the main advantage of a broad ETF over one company's shares?",
        o: ['It can never lose value', 'Risk is spread across many companies', 'It always beats a bank account'], c: 1,
        f: 'Exactly. Spreading money softens the hit from any one company, but the whole market can still fall.' },
      cushion: { s: 'An emergency cushion is money set aside for surprises, usually 3–6 months of costs, kept somewhere easy to reach.',
        e: 'Your washing machine breaks. With a cushion you pay from savings, and your long-term investments stay untouched.',
        q: 'Your laptop breaks next week. Where should the money come from first?',
        o: ['The emergency cushion', 'Selling ETF units in a hurry', 'A high-interest loan'], c: 0,
        f: 'Yes. The cushion is there so long-term money never has to be sold at a bad moment.' },
      dip: { s: 'A -20% dip means the portfolio is worth less on paper for a while. It only becomes a real loss if you sell.',
        e: "Your flat's market price drops for a year, but you keep living in it. You haven't lost anything unless you sell at the low price.",
        q: 'Your ETF shows -20% on paper and your horizon is 15 years. What usually protects you best?',
        o: ['Selling everything today', 'Checking prices every hour', 'Sticking to the plan'], c: 2,
        f: "Right. Selling turns a paper drop into a real loss. History doesn't guarantee the future, but panic rarely helps." },
      diversification: { s: "Diversification means not putting all your eggs in one basket: your money is spread across many companies, sectors and countries.",
        e: 'If you only grow strawberries, one storm ruins the harvest. Grow ten crops and one bad season hurts much less.',
        q: 'Which choice is the most diversified?',
        o: ['Shares of one popular company', 'A broad global ETF with hundreds of companies', 'Two shares from the same sector'], c: 1,
        f: 'Exactly. More companies, sectors and regions means one stumble matters less. Risk shrinks, but it does not vanish.' },
      fees: { s: "TER is a fund's yearly fee, taken as a small percentage of your money every year. Lower fees leave more of the growth with you.",
        e: 'Two gyms offer the same equipment, one for 50 PLN and one for 150 PLN a month. Over the years the cheaper one leaves far more in your pocket.',
        q: 'Two similar broad ETFs differ only in TER: 0.1% vs 0.9%. Which detail matters?',
        o: ['The lower yearly fee', 'The longer fund name', "Nothing, fees don't add up"], c: 0,
        f: 'Yes. The fee is charged every year, so small differences add up over a long horizon.' },
      general: { s: 'The core idea of the first days: cushion first, then small, regular amounts in a broad, low-cost fund, kept for the long term.',
        e: 'Think of learning to swim: first the shallow end (the cushion), then short lengths (small amounts), and only later the deep end.',
        q: 'What usually comes first for a beginner?',
        o: ['Picking a hot stock', 'Investing all savings at once', 'Building an emergency cushion'], c: 2,
        f: 'Right. With a cushion in place you never have to sell investments for everyday surprises.' },
      mifid: { s: 'MiFID II is a set of EU rules that protect people who invest. Before you buy, a bank has to check that a product suits you and show its costs and risks.',
        e: 'Like a pharmacist who asks what else you take before selling a medicine: the question is there to protect you, not to slow you down.',
        q: 'Why does a bank ask about your experience and goals before you invest?',
        o: ['To check that the product suits you', 'To guarantee you a profit', 'To pick a popular stock for you'], c: 0,
        f: 'Right. The suitability check protects you; it never guarantees a return.' },
    },
    pl: {
      inflation: { s: 'Inflacja to wzrost cen w czasie, więc te same pieniądze co roku kupują trochę mniej. Gotówka na koncie 0% za tym nie nadąża.',
        e: 'Koszyk zakupów kosztuje dziś 200 zł. Przy inflacji 3,5% za rok kosztuje ok. 207 zł, a Twoje 200 zł na koncie 0% to wciąż tylko 200 zł.',
        q: 'Co dzieje się z 1 000 zł na koncie 0% przez rok, gdy inflacja wynosi 3,5%?',
        o: ['Kupuje mniej niż wcześniej', 'Kupuje dokładnie tyle samo', 'Rośnie o 3,5%'], c: 0,
        f: 'Tak: kwota jest ta sama, ale kupuje mniej. To realna strata siły nabywczej.' },
      etf: { s: 'ETF to koszyk wielu firm kupowany za jednym razem, jak gotowy kosz owoców zamiast wybierania pojedynczych sztuk.',
        e: 'Zamiast stawiać na jedną kawiarnię, masz maleńki kawałek setek firm na świecie. Gdy jedna kawiarnia się zamyka, koszyk ledwo to czuje.',
        q: 'Jaka jest główna zaleta szerokiego ETF w porównaniu z akcjami jednej firmy?',
        o: ['Nigdy nie traci na wartości', 'Ryzyko rozkłada się na wiele firm', 'Zawsze wygrywa z kontem w banku'], c: 1,
        f: 'Dokładnie. Rozłożenie pieniędzy łagodzi wpadkę jednej firmy, ale cały rynek nadal może spaść.' },
      cushion: { s: 'Poduszka finansowa to pieniądze odłożone na niespodzianki, zwykle 3–6 miesięcy wydatków, trzymane pod ręką.',
        e: 'Psuje się pralka. Z poduszką płacisz z oszczędności, a długoterminowe inwestycje zostają nietknięte.',
        q: 'W przyszłym tygodniu psuje się laptop. Skąd w pierwszej kolejności wziąć pieniądze?',
        o: ['Z poduszki finansowej', 'Ze sprzedaży ETF w pośpiechu', 'Z drogiej pożyczki'], c: 0,
        f: 'Tak. Poduszka jest po to, żeby długoterminowych pieniędzy nie trzeba było sprzedawać w złym momencie.' },
      dip: { s: 'Spadek -20% oznacza, że portfel jest przez jakiś czas wart mniej na papierze. Realną stratą staje się dopiero po sprzedaży.',
        e: 'Cena rynkowa Twojego mieszkania spada na rok, ale dalej w nim mieszkasz. Nic nie tracisz, dopóki nie sprzedasz po niskiej cenie.',
        q: 'Twój ETF pokazuje -20% na papierze, a horyzont to 15 lat. Co zwykle chroni najlepiej?',
        o: ['Sprzedaż wszystkiego dziś', 'Sprawdzanie cen co godzinę', 'Trzymanie się planu'], c: 2,
        f: 'Tak. Sprzedaż zamienia spadek na papierze w realną stratę. Historia nie gwarantuje przyszłości, ale panika rzadko pomaga.' },
      diversification: { s: 'Dywersyfikacja to niewkładanie wszystkich jajek do jednego koszyka: pieniądze rozkładasz na wiele firm, branż i krajów.',
        e: 'Gdy uprawiasz tylko truskawki, jedna burza niszczy zbiory. Przy dziesięciu uprawach jeden zły sezon boli dużo mniej.',
        q: 'Który wybór jest najbardziej zdywersyfikowany?',
        o: ['Akcje jednej popularnej firmy', 'Szeroki globalny ETF z setkami spółek', 'Dwie spółki z tej samej branży'], c: 1,
        f: 'Dokładnie. Więcej firm, branż i regionów to mniejsze znaczenie jednej wpadki. Ryzyko maleje, ale nie znika.' },
      fees: { s: 'TER to roczna opłata funduszu, pobierana co roku jako mały procent Twoich pieniędzy. Niższa opłata zostawia Ci więcej wzrostu.',
        e: 'Dwie siłownie mają ten sam sprzęt, jedna za 50 zł, druga za 150 zł miesięcznie. Po latach tańsza zostawia w kieszeni dużo więcej.',
        q: 'Dwa podobne szerokie ETF-y różnią się tylko TER: 0,1% i 0,9%. Który szczegół ma znaczenie?',
        o: ['Niższa roczna opłata', 'Dłuższa nazwa funduszu', 'Żaden, opłaty się nie sumują'], c: 0,
        f: 'Tak. Opłata pobierana jest co roku, więc małe różnice sumują się w długim horyzoncie.' },
      general: { s: 'Sedno pierwszych dni: najpierw poduszka, potem małe, regularne kwoty w szerokim, tanim funduszu, trzymane długo.',
        e: 'Jak nauka pływania: najpierw płytki basen (poduszka), potem krótkie długości (małe kwoty), a dopiero później głęboka woda.',
        q: 'Od czego zwykle zaczyna początkujący?',
        o: ['Od gorącej spółki', 'Od zainwestowania wszystkich oszczędności naraz', 'Od zbudowania poduszki finansowej'], c: 2,
        f: 'Tak. Z poduszką nigdy nie musisz sprzedawać inwestycji z powodu codziennych niespodzianek.' },
      mifid: { s: 'MiFID II to unijne przepisy, które chronią osoby inwestujące. Zanim coś kupisz, bank musi sprawdzić, czy produkt do Ciebie pasuje, i pokazać koszty oraz ryzyko.',
        e: 'Jak farmaceuta, który pyta, jakie leki już bierzesz, zanim sprzeda nowy: pytanie ma Cię chronić, a nie spowalniać.',
        q: 'Dlaczego bank pyta o doświadczenie i cele, zanim zainwestujesz?',
        o: ['Żeby sprawdzić, czy produkt do Ciebie pasuje', 'Żeby zagwarantować Ci zysk', 'Żeby wybrać dla Ciebie popularną spółkę'], c: 0,
        f: 'Tak. Badanie odpowiedniości Cię chroni, ale nigdy nie gwarantuje zysku.' },
    },
  };
  const EXPLAIN_TOPICS = ['inflation', 'etf', 'cushion', 'dip', 'diversification', 'fees'];
  const EXPLAIN_PATTERNS = [
    ['cushion', /cushion|emergency|buffer|poduszk|awari|nagł/i],
    ['fees', /\bter\b|fee|cost|opłat|koszt|prowizj/i],
    ['dip', /dip|drop|crash|-\s?20|volatil|spad|wahan|panik/i],
    ['diversification', /divers|dywersyf|one compan|jedn(ej|a) (firm|spół)|koszyk/i],
    ['inflation', /inflat|inflac|cash|gotówk|purchasing|siła nabywcz/i],
    ['etf', /etf|fund|fundusz|index|indeks/i],
    ['mifid', /mifid/i],
  ];
  const LOCAL_ONLY_TOPICS = ['mifid'];   // the backend fallback bank has no entry for these

  const state0 = { lang: 'en' };
  function t(key, vars) {
    const lang = state0.lang;
    let s = (I18N[lang] && I18N[lang][key]) != null ? I18N[lang][key] : I18N.en[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    return s;
  }
  function tPick(key, seed) {
    const parts = t(key).split('|');
    return parts[Math.abs(seed || 0) % parts.length];
  }
  function blocks() { return I18N_BLOCKS[state0.lang] || I18N_BLOCKS.en; }

  // ------------------------------------------------------------------------
  // 3. Icons (monochrome line icons, 1.75px, currentColor), Atlas the guide, milestone seal
  // ------------------------------------------------------------------------
  function st(w) { return 'stroke="currentColor" stroke-width="' + (w || 1.75) + '" stroke-linecap="round" stroke-linejoin="round"'; }
  const S = st();
  const CAL = '<rect x="3.75" y="5" width="16.5" height="15.25" rx="2.5" ' + S + '/><path d="M3.75 9.5h16.5M8 3v4M16 3v4" ' + S + '/>';
  const SPEAKER = '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" ' + S + '/>';
  const ICON_PATHS = {
    brand: '<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M12 4.75l2.35 7.25h-4.7z" fill="currentColor"/><path d="M12 19.25l2.35-7.25h-4.7z" ' + st(1.4) + '/>',
    calendar: CAL,
    'calendar-check': CAL + '<path d="M9 14.75l2 2 4-4" ' + S + '/>',
    soundOn: SPEAKER + '<path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" ' + S + '/>',
    soundOff: SPEAKER + '<path d="M16 9.75l4.5 4.5M20.5 9.75l-4.5 4.5" ' + S + '/>',
    reset: '<path d="M5 12.5A7 7 0 1 0 7.6 6.8" ' + S + '/><path d="M8.2 3.4 7.6 6.9 4.1 7.3" ' + S + '/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.25" ' + S + '/><rect x="8.5" y="2.75" width="7" height="3.5" rx="1.1" ' + S + '/><path d="M8.75 12l2 2 4.5-4.5M8.75 17.25h6.5" ' + S + '/>',
    menu: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" ' + S + '/>',
    'arrow-right': '<path d="M4.5 12h15M13.5 6.5l5.5 5.5-5.5 5.5" ' + S + '/>',
    'chevron-down': '<path d="M6 9.5l6 6 6-6" ' + S + '/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" ' + st(2.1) + '/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.25" ' + S + '/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ' + S + '/>',
    trophy: '<circle cx="12" cy="9.25" r="5.75" ' + S + '/><path d="M9 14.25 7.5 21l4.5-2.5 4.5 2.5-1.5-6.75" ' + S + '/><path d="M9.6 9.3l1.6 1.6 3.2-3.2" ' + S + '/>',
    shield: '<path d="M12 3.25 5 6v5.25c0 4.4 3 7.9 7 9.25 4-1.35 7-4.85 7-9.25V6z" ' + S + '/><path d="M9 12l2.1 2.1L15.2 10" ' + S + '/>',
    piggy: '<path d="M5 12.5c0-3.5 3.2-5.75 7-5.75 1.3 0 2.5.25 3.6.75l2.4-1.2-.35 2.75A5.4 5.4 0 0 1 19 11.25h1.5v3.25H19a6.2 6.2 0 0 1-2.25 2.5v2.75H14v-1.5h-3.5v1.5H7.75V17.5A5.6 5.6 0 0 1 5 12.5z" ' + S + '/><circle cx="15.75" cy="11" r=".9" fill="currentColor"/>',
    sprout: '<path d="M12 21v-8" ' + S + '/><path d="M12 13c0-3.9-2.9-6.4-7.25-6.4 0 4.1 2.9 6.4 7.25 6.4zM12 11c0-3.5 2.5-5.8 6.6-5.8 0 3.8-2.5 5.8-6.6 5.8z" ' + S + '/>',
    building: '<rect x="5" y="3.5" width="14" height="17.5" rx="1.75" ' + S + '/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 21v-3h3v3" ' + S + '/>',
    wallet: '<rect x="3.5" y="6" width="17" height="13.5" rx="2.5" ' + S + '/><path d="M15.5 11h5v4.5h-5a2.25 2.25 0 0 1 0-4.5zM6 6l9-2.5.9 2.5" ' + S + '/>',
    coins: '<ellipse cx="12" cy="7" rx="7" ry="3" ' + S + '/><path d="M5 7v5c0 1.66 3.13 3 7 3s7-1.34 7-3V7M5 12v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" ' + S + '/>',
    snowflake: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" ' + S + '/>',
    clock: '<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M12 7.5V12l3 2" ' + S + '/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 4.5 4 5.5 4 9s-4 4.5-4 9M16 3c0 4.5-4 5.5-4 9s4 4.5 4 9" ' + S + '/>',
    'trend-down': '<path d="M3.5 7l6 6 3.5-3.5 7.5 7.5M14.5 17h6v-6" ' + S + '/>',
    'trend-up': '<path d="M3.5 17l6-6 3.5 3.5 7.5-7.5M14.5 7h6v6" ' + S + '/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" ' + S + '/><circle cx="12" cy="12" r="2.75" ' + S + '/>',
    repeat: '<path d="M17 3.5 20 6.5l-3 3M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20M7 20.5 4 17.5l3-3M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4" ' + S + '/>',
    pause: '<path d="M9 5.5v13M15 5.5v13" ' + st(2.2) + '/>',
    help: '<circle cx="12" cy="12" r="8.75" ' + S + '/><path d="M9.75 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-.95.8-.95 1.4v.3" ' + S + '/><circle cx="12" cy="16.4" r=".95" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="8.75" ' + S + '/><path d="M12 11v5.5" ' + S + '/><circle cx="12" cy="7.9" r="1" fill="currentColor"/>',
    landmark: '<path d="M3.5 9.5 12 4l8.5 5.5z" ' + S + '/><path d="M5.75 10.5v7M10 10.5v7M14 10.5v7M18.25 10.5v7M3.5 20.5h17" ' + S + '/>',
    users: '<circle cx="9" cy="8.5" r="3.25" ' + S + '/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" ' + S + '/><circle cx="17" cy="9.5" r="2.5" ' + S + '/><path d="M16.5 14.3c2.6.3 4.5 2.5 4.5 5.2" ' + S + '/>',
    target: '<circle cx="12" cy="12" r="8.5" ' + S + '/><circle cx="12" cy="12" r="4.75" ' + S + '/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    bulb: '<path d="M8.75 15.5c-1.6-1.15-2.75-3-2.75-5.2a6 6 0 0 1 12 0c0 2.2-1.15 4.05-2.75 5.2v2h-6.5z" ' + S + '/><path d="M9.75 20.75h4.5" ' + S + '/>',
    chart: '<path d="M4 4v16h16" ' + S + '/><path d="M7.5 15l3.5-4 3 2.5 5-6" ' + S + '/>',
    search: '<circle cx="10.5" cy="10.5" r="6.25" ' + S + '/><path d="M15.25 15.25l5 5" ' + S + '/>',
    banknote: '<rect x="2.75" y="6" width="18.5" height="12" rx="2" ' + S + '/><circle cx="12" cy="12" r="2.6" ' + S + '/><path d="M6 9.5v5M18 9.5v5" ' + S + '/>',
    house: '<path d="M5.5 10v10h13V10M3.5 11.5 12 4l8.5 7.5M10 20v-5.5h4V20" ' + S + '/>',
    peak: '<path d="M2.75 20 9 9l3.5 5.5 2.5-3.5 6.25 9z" ' + S + '/><path d="M9 9V4l3.75 1.5L9 7" ' + S + '/>',
    sunset: '<path d="M6 16a6 6 0 0 1 12 0M3 16h18M7 20h10M12 4.5v2.5M5.3 8.3l1.6 1.6M18.7 8.3l-1.6 1.6" ' + S + '/>',
    user: '<circle cx="12" cy="8" r="3.75" ' + S + '/><path d="M4.75 20.25c0-3.9 3.25-6.75 7.25-6.75s7.25 2.85 7.25 6.75" ' + S + '/>',
    scale: '<path d="M12 4v16M7 20h10M5 7h14" ' + S + '/><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" ' + S + '/>',
    chat: '<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 4v-4H7a3 3 0 0 1-3-3z" ' + S + '/><path d="M8.5 9.5h7M8.5 12.5h4" ' + S + '/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" ' + S + '/>',
    send: '<path d="M3.5 11.5 20.5 4l-6.5 16.5-3-6.5zM11 14l9.5-10" ' + S + '/>',
    flag: '<path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6" ' + S + '/>',
    pillars: '<path d="M4 20.25h16" ' + S + '/><path d="M6.5 20v-4.5M10 20v-7.5M13.5 20V9.5M17.5 20V5.5" ' + st(2.2) + '/>',
    'text-size': '<path d="M3.5 18.5 8 6.5l4.5 12M5.1 14.5h5.8M14 18.5l3-8 3 8M15 16h4" ' + S + '/>',
    filter: '<path d="M4 5.5h16l-6.25 7.25v5.5l-3.5 1.75v-7.25z" ' + S + '/>',
  };
  function icon(name, cls) {
    const inner = ICON_PATHS[name] || ICON_PATHS.bulb;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconDone === el.dataset.icon) return;
      el.innerHTML = icon(el.dataset.icon, el.dataset.iconClass);
      el.dataset.iconDone = el.dataset.icon;
      el.style.display = 'inline-flex';
    });
  }

  // --- Atlas: Commerzbank financial guide — a precise compass (viewBox 64×64) ---
  // Petrol case, white dial, 1.75px ticks, canary north needle. At rest nothing moves; the
  // needle turns only on purpose (moods in styles.css §8: thinking / celebrating / coaching).
  function coraSVG() {
    const major = [0, 90, 180, 270].map((a) => '<path d="M32 9.5v3.5" transform="rotate(' + a + ' 32 32)"/>').join('');
    const minor = [45, 135, 225, 315].map((a) => '<path d="M32 10v2" transform="rotate(' + a + ' 32 32)"/>').join('');
    return (
      '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
        '<circle cx="32" cy="32" r="29.5" fill="' + C.ink + '"/>' +
        '<circle cx="32" cy="32" r="25.5" fill="#FFFFFF"/>' +
        '<circle class="c-ring" cx="32" cy="32" r="17.5" fill="none" stroke="' + C.rule + '" stroke-width="1"/>' +
        '<g stroke="' + C.ink + '" stroke-width="1.75" stroke-linecap="round">' + major + '</g>' +
        '<g stroke="' + C.ink + '" stroke-width="1.25" stroke-linecap="round" opacity=".45">' + minor + '</g>' +
        '<g class="c-needle">' +
          '<path d="M32 13.5 35.75 32h-7.5z" fill="' + C.yellow + '" stroke="' + C.ink + '" stroke-width="1.75" stroke-linejoin="round"/>' +
          '<path d="M32 50.5 35.75 32h-7.5z" fill="' + C.ink + '" stroke="' + C.ink + '" stroke-width="1.75" stroke-linejoin="round"/>' +
        '</g>' +
        '<circle cx="32" cy="32" r="2.6" fill="#FFFFFF" stroke="' + C.ink + '" stroke-width="1.75"/>' +
      '</svg>'
    );
  }
  function coraHTML(mood, cls) {
    return '<div class="cora' + (cls ? ' ' + cls : '') + '" data-mood="' + (mood || 'idle') + '">' + coraSVG() + '</div>';
  }
  function setMood(el, mood) {
    if (el) el.dataset.mood = mood;
  }
  function hydrateCora(root) {
    (root || document).querySelectorAll('[data-cora]').forEach((el) => {
      if (!el.querySelector('svg')) el.innerHTML = coraSVG();
      if (!el.dataset.mood) el.dataset.mood = el.dataset.cora || 'idle';
    });
    (root || document).querySelectorAll('[data-cora-face]').forEach((el) => {
      if (!el.querySelector('svg')) el.innerHTML = coraSVG();
    });
  }

  // Milestone seal (Checkpoint #1, milestones): thin rings and a check, tinted by level.
  function badgeSVG(level) {
    const fills = { 1: C.paper2, 2: C.yellow, 3: C.green };
    const fill = fills[level] || C.yellow;
    return (
      '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
        '<circle cx="60" cy="60" r="54" fill="#FFFFFF" stroke="' + C.ink + '" stroke-width="1.75"/>' +
        '<circle cx="60" cy="60" r="46" fill="none" stroke="' + C.rule + '" stroke-width="1" stroke-dasharray="2 3"/>' +
        '<circle cx="60" cy="60" r="34" fill="' + fill + '"/>' +
        '<path d="M45 61l10 10 21-22" fill="none" stroke="' + C.ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  // Backend copy (luna_message, feedback, explanations, After Day 14) may still name the
  // former coach. The UI maps every form to Atlas so one guide speaks throughout.
  const COACH_NAME_RULES = [
    [/(?<!\p{L})(?:Kita|Cora)(?!\p{L})/gu, 'Atlas'],
    [/(?<!\p{L})(?:Kity|Kitę|Cory|Corę)(?!\p{L})/gu, 'Atlasa'],
    [/(?<!\p{L})(?:Kitą|Corą)(?!\p{L})/gu, 'Atlasem'],
    [/(?<!\p{L})(?:Kicie|Corze)(?!\p{L})/gu, 'Atlasowi'],
    [/(?<!\p{L})(?:Kito|Coro)(?!\p{L})/gu, 'Atlasie'],
  ];
  function normalizeCoachText(str) {
    if (typeof str !== 'string' || !/Kit|Kici|Cor/.test(str)) return str;
    return COACH_NAME_RULES.reduce((s, rule) => s.replace(rule[0], rule[1]), str);
  }
  function normalizeCoachDeep(value) {
    if (typeof value === 'string') return normalizeCoachText(value);
    if (Array.isArray(value)) return value.map(normalizeCoachDeep);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((k) => { out[k] = normalizeCoachDeep(value[k]); });
      return out;
    }
    return value;
  }

  // ------------------------------------------------------------------------
  // 4. Sound — zero-asset Web Audio utility; fails silently when blocked.
  // ------------------------------------------------------------------------
  // Quiet Mastery: muted by default — the user can switch it on with the HUD sound button.
  const Sound = (function () {
    let ctx = null;
    let muted = true;
    try { muted = window.localStorage.getItem(LS_SOUND) !== '1'; } catch (e) { muted = true; }
    function audio() {
      if (muted) return null;
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      } catch (e) {
        return null;
      }
    }
    function tone(freq, at, dur, type, gain) {
      const c = audio();
      if (!c) return;
      try {
        const t0 = c.currentTime + (at || 0);
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain || 0.1, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      } catch (e) { /* silent */ }
    }
    return {
      isMuted: () => muted,
      setMuted(value) {
        muted = !!value;
        try { window.localStorage.setItem(LS_SOUND, muted ? '0' : '1'); } catch (e) { /* ignore */ }
      },
      click() { tone(620, 0, 0.045, 'triangle', 0.05); tone(180, 0, 0.03, 'sine', 0.04); },
      correct() { tone(784, 0, 0.14, 'sine', 0.11); tone(1175, 0.11, 0.26, 'sine', 0.1); },
      retry() { tone(392, 0, 0.16, 'sine', 0.07); tone(330, 0.13, 0.24, 'sine', 0.06); },
      fanfare() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.22, 'triangle', 0.09));
        tone(784, 0.46, 0.5, 'sine', 0.06); tone(1047, 0.46, 0.6, 'sine', 0.07);
      },
      pop() { tone(880, 0, 0.08, 'sine', 0.07); tone(1320, 0.05, 0.12, 'sine', 0.05); },
    };
  })();

  // ------------------------------------------------------------------------
  // 5. Utilities
  // ------------------------------------------------------------------------
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const NBSP = ' ';
  // EN: "33,844" · PL: "33 844" (hard space). Amounts are always PLN — no FX conversion.
  function formatNumber(value) {
    const n = Math.round(Number(value) || 0);
    const sep = state0.lang === 'pl' ? NBSP : ',';
    const sign = n < 0 ? '-' : '';
    return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }
  function money(value) {
    return formatNumber(value) + NBSP + t('unit.currency');
  }
  function pluralPL(n, one, few, many) {
    const abs = Math.abs(n);
    if (abs === 1) return one;
    const d = abs % 10;
    const dd = abs % 100;
    return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
  }
  function years(n) {
    const word = state0.lang === 'pl'
      ? pluralPL(n, t('unit.year1'), t('unit.year2'), t('unit.yearN'))
      : (n === 1 ? t('unit.year1') : t('unit.yearN'));
    return n + NBSP + word;
  }
  function replayClass(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function setNumber(el, value, format) {
    if (!el) return;
    if (el._fqRaf) { cancelAnimationFrame(el._fqRaf); el._fqRaf = null; }
    clearTimeout(el._fqTimer);
    el.textContent = (format || formatNumber)(value);
  }
  function animateNumber(el, from, to, opts) {
    if (!el) return;
    const o = opts || {};
    const duration = o.duration || 650;
    const format = o.format || formatNumber;
    if (prefersReducedMotion() || from === to || document.hidden) { setNumber(el, to, format); return; }
    if (el._fqRaf) cancelAnimationFrame(el._fqRaf);
    clearTimeout(el._fqTimer);
    const start = performance.now();
    const step = (now) => {
      const p = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(from + (to - from) * eased);
      if (p < 1) el._fqRaf = requestAnimationFrame(step);
      else setNumber(el, to, format);
    };
    el._fqRaf = requestAnimationFrame(step);
    el._fqTimer = setTimeout(() => setNumber(el, to, format), duration + 250);
  }
  function setRangeFill(input, pill, label) {
    if (!input) return;
    const min = Number(input.min);
    const max = Number(input.max);
    const pct = max > min ? clamp(((Number(input.value) - min) / (max - min)) * 100, 0, 100) : 0;
    input.style.setProperty('--fill', pct + '%');
    if (pill) {
      if (label != null) pill.textContent = label;
      // Keep the pill inside its slider (two sliders sit side by side); the arrow still points
      // at the thumb. Hidden panels have no width yet, so they fall back to the % position.
      const track = pill.parentElement ? pill.parentElement.clientWidth : 0;
      const pw = pill.offsetWidth;
      if (track > 0 && pw > 0) {
        const thumb = (pct / 100) * (track - 32) + 16;
        const left = clamp(thumb, pw / 2, Math.max(pw / 2, track - pw / 2));
        pill.style.setProperty('--pos', left.toFixed(1) + 'px');
        pill.style.setProperty('--arrow', clamp(thumb - left, -pw / 2 + 10, pw / 2 - 10).toFixed(1) + 'px');
      } else {
        pill.style.setProperty('--pos', 'calc(' + pct + '% + ' + ((0.5 - pct / 100) * 32).toFixed(1) + 'px)');
        pill.style.setProperty('--arrow', '0px');
      }
    }
  }
  function storageGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storageSet(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ } }

  // Tap-to-define: wrap the first mention of each key term in a plain-text string with a
  // button that opens a one-sentence definition. Returns escaped HTML.
  const TERM_KEYS = ['etf', 'ter', 'inflation', 'cushion', 'diversification', 'mifid'];
  const TERM_PATTERNS = {
    en: {
      etf: /(?<!\p{L})ETFs?(?!\p{L})/u,
      ter: /(?<!\p{L})TER(?!\p{L})/u,
      inflation: /(?<!\p{L})(?:real )?inflation(?!\p{L})/iu,
      cushion: /(?<!\p{L})(?:emergency (?:cushion|fund)|safety cushion|cushion)(?!\p{L})/iu,
      diversification: /(?<!\p{L})diversif\p{L}*/iu,
      mifid: /MiFID(?: II)?/u,
    },
    pl: {
      etf: /(?<!\p{L})ETF(?!\p{L})/u,
      ter: /(?<!\p{L})TER(?!\p{L})/u,
      inflation: /(?<!\p{L})inflac\p{L}*(?: realn\p{L}*)?/iu,
      cushion: /(?<!\p{L})poduszk\p{L}*(?: finansow\p{L}*)?/iu,
      diversification: /(?<!\p{L})dywersyfik\p{L}*/iu,
      mifid: /MiFID(?: II)?/u,
    },
  };
  // Topics of the "Ask Atlas" fallback bank that match each term.
  const TERM_TOPIC = { etf: 'etf', ter: 'fees', inflation: 'inflation', cushion: 'cushion', diversification: 'diversification', mifid: 'mifid' };
  function defineTerms(text) {
    const src = String(text == null ? '' : text);
    const patterns = TERM_PATTERNS[state0.lang] || TERM_PATTERNS.en;
    const hits = [];
    TERM_KEYS.forEach((key) => {
      const m = patterns[key].exec(src);
      if (m) hits.push({ key, start: m.index, end: m.index + m[0].length });
    });
    hits.sort((a, b) => a.start - b.start);
    let out = '';
    let pos = 0;
    hits.forEach((h) => {
      if (h.start < pos) return;   // overlapping match: keep the earlier one
      out += escapeHtml(src.slice(pos, h.start)) +
        '<button type="button" class="term" data-action="define" data-term="' + h.key + '" aria-haspopup="dialog" aria-expanded="false">' +
        escapeHtml(src.slice(h.start, h.end)) + '</button>';
      pos = h.end;
    });
    return out + escapeHtml(src.slice(pos));
  }

  // ------------------------------------------------------------------------
  // 6. API + silent session recovery (docs/02 §5)
  // ------------------------------------------------------------------------
  class ApiError extends Error {
    constructor(status, data, kind) {
      super(kind === 'timeout' ? 'timeout' : kind === 'network' ? 'network' : 'HTTP ' + status);
      this.name = 'ApiError';
      this.status = status;
      this.kind = kind || 'http';
      this.data = data;
    }
  }
  async function apiRequest(path, options) {
    const o = options || {};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), o.timeoutMs || API_TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, {
        method: o.method || 'GET',
        headers: o.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data, 'http');
      return normalizeCoachDeep(data);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, null, err && err.name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  }
  const api = {
    personas: (lang) => apiRequest('/api/demo-personas?lang=' + encodeURIComponent(lang)),
    analyze: (profile) => apiRequest('/api/onboarding/analyze', { method: 'POST', body: profile }),
    turn: (body) => apiRequest('/api/mission/turn', { method: 'POST', body }),
    challenge: (body) => apiRequest('/api/challenge/accept', { method: 'POST', body }),
    dayStart: (body) => apiRequest('/api/day/start', { method: 'POST', body }),
    checkpoint: (body) => apiRequest('/api/checkpoint/submit', { method: 'POST', body }),
    explain: (body) => apiRequest('/api/coach/explain', { method: 'POST', body, timeoutMs: 9000 }),
  };
  // FastAPI answers an unknown route with 404 {"detail": "Not Found"}; an unknown session
  // has a different detail. Routes from Issue #27 may not be deployed yet.
  function isRouteMissing(err) {
    return err instanceof ApiError && (err.status === 405 || (err.status === 404 && err.data && err.data.detail === 'Not Found'));
  }
  function isSessionMissing(err) {
    return err instanceof ApiError && err.status === 404 && !isRouteMissing(err);
  }
  function describeApiError(err) {
    if (!(err instanceof ApiError)) return t('toast.generic');
    if (err.kind === 'network') return t('toast.network');
    if (err.kind === 'timeout') return t('toast.timeout');
    if (err.status === 422) return t('err.fixForm');
    return t('toast.server', { n: err.status });
  }

  // ------------------------------------------------------------------------
  // 7. State
  // ------------------------------------------------------------------------
  const DEFAULT_G = Object.freeze({ level: 1, level_title: 'Observer', xp: 20, next_level_xp: 100, xp_gained: 0, leveled_up: false, streak_days: 1 });
  const LEVEL_FLOOR = Object.freeze({ 1: 0, 2: 100, 3: 250 });

  const state = Object.assign(state0, {
    screen: SCREENS.BANK_ENTRY,
    userName: storageGet(LS_USER_NAME) || '',
    introIndex: 0,
    busy: false,
    personas: [],
    stageId: null,           // 'first' | 'home' | 'peak' | 'pre' | null (custom form)
    lastProfile: null,       // last OnboardingRequest (silent re-analyze after 404)
    session: null,           // OnboardingResponse
    turn: null,              // latest MissionTurnResponse of the current day
    day: 1,
    completedDays: new Set(),
    completedChallenges: new Set(),
    checkpointPassed: false,
    lessonsXp: 0,            // local XP from micro lessons (monotonic XP rule)
    practiceXp: 0,           // local XP from practice beats
    completedLessons: new Set(),
    lessonChecks: {},        // lessonId -> { wrong: [option indices] } (mini-check attempts)
    checkinDays: new Set(),  // days whose Atlas check-in was confirmed
    gateBypass: new Set(),   // days opened through the Demo shortcuts (no gating)
    dayLessons: [],
    log: [],                 // server actions to replay after a lost session
    restoring: null,
    token: 0,                // bumps on every fresh analyze; stale responses are ignored
    tm: { year: null, point: null },
    rendered: { xp: null, level: null, ready: null },
    mission: null,
    summary: null,
    cp: null,
    cora: { busy: false, result: null, picked: null, question: '' },
    hubTab: 1,               // Quest Hub briefing step: 1 plan · 2 what-if simulator · 3 lessons
    tmAmount: null,          // what-if monthly amount; null = the sample plan amount
    plantStageAtStart: 1,
    calm: false,             // "Larger text / Calm UI" (body.is-senior-friendly)
    calmManual: false,       // true once the user toggled it; a new profile re-applies the age rule
    celebratedDays: new Set(), // confetti fires once per completed day
  });

  const els = {};
  let tmChart = null;

  function g() { return (state.turn && state.turn.gamification) || DEFAULT_G; }
  function bonusXp() { return state.lessonsXp + state.practiceXp; }
  function displayedXp() { return g().xp + bonusXp(); }

  function restoreSession() {
    if (!state.lastProfile) return Promise.reject(new ApiError(404, null, 'http'));
    if (!state.restoring) {
      const profile = Object.assign({}, state.lastProfile, { lang: state.lang });
      const log = state.log.slice();
      const token = state.token;
      state.restoring = (async () => {
        const data = await api.analyze(profile);
        const sid = data.session_id;
        for (const entry of log) {
          const body = Object.assign({ session_id: sid }, entry.body);
          if (entry.kind === 'turn') await api.turn(body);
          else if (entry.kind === 'day') await api.dayStart(body);
          else if (entry.kind === 'challenge') await api.challenge(body);
          else if (entry.kind === 'checkpoint') await api.checkpoint(body);
        }
        if (token === state.token && state.session) state.session.session_id = sid;
        return sid;
      })().finally(() => { state.restoring = null; });
    }
    return state.restoring;
  }
  async function withSessionRecovery(request) {
    if (!state.session) throw new ApiError(404, null, 'http');
    try {
      return await request(state.session.session_id);
    } catch (err) {
      if (!isSessionMissing(err) || !state.lastProfile) throw err;
      console.info('[Finance Quest] Session missing on the server (404), restoring it silently.');
      const sid = await restoreSession();
      return request(sid);
    }
  }

  // ------------------------------------------------------------------------
  // 8. HUD
  // ------------------------------------------------------------------------
  function readyWidgets() { return [els.hudReady, els.hudReadyMobile].filter(Boolean); }

  // Readiness and the competence stage lead; XP and practice days stay deliberately quiet.
  function renderHud(opts) {
    const animate = !opts || opts.animate !== false;
    const gs = g();
    const xp = displayedXp();
    const prev = state.rendered;
    const hasSession = !!state.session;
    document.body.classList.toggle('has-session', hasSession);
    if (els.hudStats) els.hudStats.hidden = !hasSession;
    els.hudDayNum.textContent = String(state.day);
    els.hudDayTotal.textContent = String(TOTAL_DAYS);
    els.hudStreak.textContent = String(gs.streak_days || 1);
    const ps = plantState(xp, state.checkpointPassed);
    els.hudLevel.innerHTML =
      '<span class="stat__short">' + escapeHtml(t('hud.stageShort', { n: ps.stage })) + '</span>' +
      '<span class="stat__long">' + escapeHtml(t('hud.stageLong', { n: ps.stage, title: ps.title })) + '</span>';
    if (animate && prev.stage != null && ps.stage > prev.stage && els.hudStage) replayClass(els.hudStage, 'flash');
    if (animate && prev.xp != null && xp > prev.xp) animateNumber(els.hudXp, prev.xp, xp);
    else setNumber(els.hudXp, xp);

    const show = !!state.turn && state.screen !== SCREENS.ONBOARDING;
    const ready = show ? clamp(Number(state.turn.confidence_score) || 0, 0, 100) : 0;
    if (els.hudReadyRow) els.hudReadyRow.hidden = !show;
    readyWidgets().forEach((w) => {
      w.hidden = !show;
      const label = w.querySelector('[data-ready-label]');
      if (label) label.textContent = t(state.calm ? 'hud.readinessCalm' : 'hud.readiness');
      const val = w.querySelector('[data-ready-val]');
      const fill = w.querySelector('.meter__fill');
      const bar = w.querySelector('.meter');
      if (val) {
        if (animate && prev.ready != null && ready > prev.ready) animateNumber(val, prev.ready, ready, { format: (v) => Math.round(v) + '%' });
        else setNumber(val, ready, (v) => Math.round(v) + '%');
      }
      if (fill) fill.style.width = ready + '%';
      if (bar) bar.setAttribute('aria-valuenow', String(ready));
    });
    if (els.mXp) setNumber(els.mXp, xp);
    state.rendered = { xp, stage: ps.stage, ready: show ? ready : prev.ready };
  }
  function resetHudBaseline() { state.rendered = { xp: null, stage: null, ready: null }; }

  // "Innovations for all generations": larger text, bigger targets and a calm layout without
  // small practice counters. On automatically from age 45; anyone can switch it.
  function applyCalm(on) {
    state.calm = !!on;
    document.body.classList.toggle('is-senior-friendly', state.calm);
    document.documentElement.classList.toggle('is-senior-friendly', state.calm);
    document.querySelectorAll('[data-action="toggle-calm"]').forEach((b) => b.setAttribute('aria-pressed', String(state.calm)));
    renderHud({ animate: false });
    if (state.session && state.screen === SCREENS.HUB) {
      renderGardenCard();
      syncAmountControls();
      updateTimeMachine(state.tm.year || state.session.default_horizon_years, { animate: false });
      if (tmChart) tmChart.resize();
    }
  }
  function calmForAge(age) {
    if (state.calmManual) return;
    applyCalm(Number(age) >= CALM_AGE);
  }
  function toggleCalm() {
    state.calmManual = true;
    applyCalm(!state.calm);
    toast(t(state.calm ? 'hud.calmOn' : 'hud.calmOff'), 'info', 2400);
  }

  function xpFloat(amount, anchor, tone) {
    if (!amount || state.calm) return;
    const el = document.createElement('div');
    el.className = 'xp-float' + (tone === 'green' ? ' xp-float--green' : '');
    el.textContent = '+' + amount + ' XP';
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const x = r && r.width ? r.left + r.width / 2 : window.innerWidth / 2;
    const y = r && r.height ? Math.max(70, r.top - 6) : window.innerHeight * 0.4;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function renderSoundButton() {
    const muted = Sound.isMuted();
    els.hudSound.innerHTML = icon(muted ? 'soundOff' : 'soundOn');
    els.hudSound.setAttribute('aria-pressed', String(!muted));
    els.hudSound.title = muted ? t('hud.soundOff') : t('hud.soundOn');
  }

  // ------------------------------------------------------------------------
  // 9. Router
  // ------------------------------------------------------------------------
  function showScreen(id, opts) {
    const target = document.getElementById(id);
    if (!target) return;
    state.screen = id;
    els.screens.forEach((el) => {
      const active = el.id === id;
      el.hidden = !active;
      if (active) replayClass(el, 'screen-enter');
    });
    document.body.dataset.screen = id;
    closeMenu();
    if (!opts || opts.scroll !== false) window.scrollTo(0, 0);
    const title = target.querySelector('[data-screen-title]');
    if (title) title.focus({ preventScroll: true });
    renderHud({ animate: false });
  }

  const INTRO_SLIDES = [1, 2, 3];
  const INTRO_ICONS = { 1: 'chart', 2: 'clock', 3: 'shield' };
  function renderIntro() {
    const i = state.introIndex;
    const step = document.getElementById('intro-step');
    const title = document.getElementById('intro-title');
    const copy = document.getElementById('intro-copy');
    const progress = document.getElementById('intro-progress');
    const next = document.getElementById('intro-next');
    const ico = document.getElementById('intro-icon');
    if (!step || !title || !copy || !progress || !next) return;
    if (ico) ico.innerHTML = icon(INTRO_ICONS[i] || 'chart');
    step.textContent = i + '/3';
    title.textContent = t('intro.' + i + '.title');
    copy.textContent = t('intro.' + i + '.copy');
    progress.style.width = (i / INTRO_SLIDES.length) * 100 + '%';
    next.querySelector('[data-i18n]').textContent = i === 3 ? t('name.continue') : t('intro.next');
    next.querySelector('[data-icon]')?.replaceWith(document.createRange().createContextualFragment(icon(i === 3 ? 'check' : 'arrow-right')));
  }
  function openNameModal() {
    closeModal('modal_intro');
    const input = document.getElementById('user-name');
    if (input) input.value = state.userName || '';
    openModal('modal_name');
    hydrateIcons(document.getElementById('modal_name'));
    setTimeout(() => { if (input) input.focus(); }, 60);
  }
  function beginJourney() {
    if (storageGet(LS_INTRO_SEEN) === '1') openNameModal();
    else { state.introIndex = 1; renderIntro(); openModal('modal_intro'); }
  }
  function finishName(value) {
    state.userName = String(value || '').trim().slice(0, 40);
    storageSet(LS_USER_NAME, state.userName);
    storageSet(LS_INTRO_SEEN, '1');
    closeModal('modal_name');
    showScreen(SCREENS.ONBOARDING);
    renderGuideWelcome();
  }
  function renderGuideWelcome() {
    const bubble = document.getElementById('onb-bubble');
    if (bubble) bubble.textContent = state.userName ? t('onb.bubbleName', { name: state.userName }) : t('onb.bubble');
  }
  function skipIntro() { storageSet(LS_INTRO_SEEN, '1'); openNameModal(); }
  function nextIntro() {
    if (state.introIndex >= 3) { skipIntro(); return; }
    state.introIndex += 1;
    renderIntro();
  }
  function closeEntryFlow() { finishName(state.userName); }

  // ------------------------------------------------------------------------
  // 10. Screen 1 — life stage cards & 6-question profile
  // ------------------------------------------------------------------------
  function stageById(id) { return STAGES.find((s) => s.id === id) || null; }
  function stageProfile(stage) {
    const persona = stage.personaId ? state.personas.find((p) => p.id === stage.personaId) : null;
    const src = persona || stage.profile;
    return {
      age: src.age, net_income: src.net_income, free_cash: src.free_cash,
      has_emergency_fund: src.has_emergency_fund, main_concern: src.main_concern,
      self_confidence_start: src.self_confidence_start,
    };
  }

  function renderStageCards() {
    els.stageGrid.innerHTML = STAGES.map((s) =>
      '<button type="button" class="stage-card" data-stage="' + s.id + '" aria-pressed="' + (state.stageId === s.id) + '">' +
        '<span class="stage-card__icon">' + icon(s.icon, 'ic--lg') + '</span>' +
        '<span><span class="stage-card__title">' + escapeHtml(t('stage.' + s.id + '.name')) + '</span>' +
        '<span class="stage-card__meta" style="display:block;margin-top:3px">' + escapeHtml(t('stage.' + s.id + '.meta')) + '</span></span>' +
        '<span class="small" style="color:var(--ink-2)">' + escapeHtml(t('stage.' + s.id + '.desc')) + '</span>' +
        '<span class="stage-card__go">' + escapeHtml(t('stage.go')) + icon('arrow-right', 'ic--sm') + '</span>' +
      '</button>'
    ).join('');
  }

  // Demo ▾ — sample life stages + presenter shortcuts, kept off the product screens (Issue #44).
  // Same content in the desktop popover and inside the mobile ⋯ menu.
  function demoGroupHTML() {
    const has = !!state.session;
    const stages = STAGES.map((s) =>
      '<button type="button" class="stage-pill" data-stage="' + s.id + '" aria-pressed="' + (state.stageId === s.id) + '">' +
        '<span class="stage-pill__dot">' + icon(s.icon) + '</span>' +
        '<span class="stage-pill__text"><span class="stage-pill__name">' + escapeHtml(t('stage.' + s.id + '.name')) + '</span>' +
        '<span class="stage-pill__meta">' + escapeHtml(t('stage.' + s.id + '.meta')) + '</span></span>' +
      '</button>'
    ).join('');
    return (
      '<p class="demo-title">' + escapeHtml(t('demo.stages')) + '</p>' +
      '<div class="demo-stages">' + stages + '</div>' +
      '<p class="demo-title">' + escapeHtml(t('demo.shortcuts')) + '</p>' +
      '<div class="demo-shortcuts">' +
        '<button type="button" class="tool-btn" data-action="demo-day4"' + (has ? '' : ' disabled') + '>' + icon('target', 'ic--sm') + escapeHtml(t('judges.jumpDay4')) + '</button>' +
        '<button type="button" class="tool-btn" data-action="demo-cp"' + (has ? '' : ' disabled') + '>' + icon('trophy', 'ic--sm') + escapeHtml(t('judges.openCp')) + '</button>' +
      '</div>' +
      (has ? '' : '<p class="tiny muted">' + escapeHtml(t('demo.needProfile')) + '</p>')
    );
  }
  function renderDemoMenus() {
    if (els.demoPop) els.demoPop.innerHTML = '<p class="demo-head">' + escapeHtml(t('demo.title')) + '</p>' + demoGroupHTML();
    if (els.demoMobile) els.demoMobile.innerHTML = demoGroupHTML();
  }
  function toggleDemo(force) {
    const open = force != null ? force : els.demoPop.hidden;
    if (open) { closeMenu(); renderDemoMenus(); }
    els.demoPop.hidden = !open;
    document.querySelectorAll('[data-action="toggle-demo"]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  }
  function closeDemo() { if (els.demoPop && !els.demoPop.hidden) toggleDemo(false); }

  function setStageBusy(stageId, busy) {
    document.querySelectorAll('[data-stage]').forEach((btn) => {
      btn.disabled = busy;
      btn.classList.toggle('is-loading', busy && btn.dataset.stage === stageId);
    });
  }

  function ageGroupOf(age) { return age < 30 ? '20+' : age <= 50 ? '30-50' : '50+'; }

  function syncFreeCashMax() {
    const max = Math.min(FREE_CASH_CAP, Number(els.fNet.value));
    els.fFree.max = String(max);
    if (Number(els.fFree.value) > max) els.fFree.value = String(max);
  }
  function syncFormOutputs() {
    syncFreeCashMax();
    const age = Number(els.fAge.value);
    els.fAgeOut.textContent = state.lang === 'pl' ? age + NBSP + 'l.' : String(age);
    els.fAgeGroup.textContent = t('group.' + ageGroupOf(age));
    els.fNetOut.textContent = money(els.fNet.value);
    els.fFreeOut.textContent = money(els.fFree.value);
    els.fFreeHint.textContent = t('form.freeHint', { max: money(els.fFree.max) });
    [els.fAge, els.fNet, els.fFree].forEach((input) => setRangeFill(input));
  }
  function setRadio(name, value) {
    els.form.querySelectorAll('input[name="' + name + '"]').forEach((input) => { input.checked = input.value === value; });
  }
  function fillForm(p) {
    els.fAge.value = String(p.age);
    els.fNet.value = String(p.net_income);
    syncFreeCashMax();
    els.fFree.value = String(p.free_cash);
    setRadio('has_emergency_fund', String(p.has_emergency_fund));
    setRadio('main_concern', p.main_concern);
    setRadio('self_confidence_start', String(p.self_confidence_start));
    clearFieldErrors();
    syncFormOutputs();
  }
  const FIELD_ERR = { age: 'err.age', net_income: 'err.net', free_cash: 'err.free', has_emergency_fund: 'err.fund', main_concern: 'err.concern', self_confidence_start: 'err.conf' };
  const FORM_FIELDS = Object.keys(FIELD_ERR);
  function clearFieldErrors(name) {
    (name ? [name] : FORM_FIELDS).forEach((f) => {
      const box = els.form.querySelector('[data-field="' + f + '"]');
      const msg = els.form.querySelector('[data-error-for="' + f + '"]');
      if (box) box.removeAttribute('data-invalid');
      if (msg) { msg.hidden = true; msg.textContent = ''; }
    });
  }
  function showFieldErrors(errors) {
    clearFieldErrors();
    let first = null;
    FORM_FIELDS.forEach((f) => {
      if (!errors[f]) return;
      const box = els.form.querySelector('[data-field="' + f + '"]');
      const msg = els.form.querySelector('[data-error-for="' + f + '"]');
      if (box) box.setAttribute('data-invalid', '');
      if (msg) { msg.textContent = t(errors[f]); msg.hidden = false; }
      if (!first && box) first = box;
    });
    if (first) {
      openTailor(true);
      first.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      const input = first.querySelector('input');
      if (input) input.focus({ preventScroll: true });
    }
  }
  function readForm() {
    const fd = new FormData(els.form);
    const fund = fd.get('has_emergency_fund');
    const concern = fd.get('main_concern');
    const conf = fd.get('self_confidence_start');
    const p = {
      age: Number(fd.get('age')), net_income: Number(fd.get('net_income')), free_cash: Number(fd.get('free_cash')),
      has_emergency_fund: fund === 'true', main_concern: concern, self_confidence_start: Number(conf),
    };
    const errors = {};
    if (!(p.age >= 18 && p.age <= 70)) errors.age = FIELD_ERR.age;
    if (!(p.net_income >= 2500 && p.net_income <= 25000)) errors.net_income = FIELD_ERR.net_income;
    if (!(p.free_cash >= 200 && p.free_cash <= FREE_CASH_CAP && p.free_cash <= p.net_income)) errors.free_cash = FIELD_ERR.free_cash;
    if (fund == null) errors.has_emergency_fund = FIELD_ERR.has_emergency_fund;
    if (!concern || !I18N.en['concern.' + concern]) errors.main_concern = FIELD_ERR.main_concern;
    if (!(p.self_confidence_start >= 1 && p.self_confidence_start <= 5)) errors.self_confidence_start = FIELD_ERR.self_confidence_start;
    if (Object.keys(errors).length) { showFieldErrors(errors); return null; }
    clearFieldErrors();
    return p;
  }
  // FastAPI 422: {"detail": [{"loc": ["body", "free_cash"], ...}]}; the model validator has loc ["body"].
  function mapValidationErrors(data) {
    const errors = {};
    const detail = data && Array.isArray(data.detail) ? data.detail : [];
    detail.forEach((item) => {
      const loc = Array.isArray(item.loc) ? item.loc : [];
      let f = loc.length > 1 ? String(loc[loc.length - 1]) : null;
      if (!f || !FIELD_ERR[f]) f = /free_cash|net_income/.test(String(item.msg || '')) ? 'free_cash' : null;
      if (f && !errors[f]) errors[f] = FIELD_ERR[f];
    });
    return errors;
  }
  function openTailor(open) {
    const body = els.tailorBody;
    const toggle = document.querySelector('[data-action="toggle-tailor"]');
    const next = open == null ? body.hidden : open;
    body.hidden = !next;
    if (toggle) toggle.setAttribute('aria-expanded', String(next));
  }
  function setFormBusy(busy) {
    const cta = els.ctaOnboarding;
    cta.disabled = busy;
    cta.classList.toggle('is-busy', busy);
    cta.querySelector('.spinner').hidden = !busy;
    const idle = cta.querySelector('[data-idle-icon]');
    if (idle) idle.hidden = busy;
    cta.querySelector('[data-label]').textContent = busy ? t('form.ctaBusy') : t('form.cta');
  }

  async function loadPersonas() {
    try {
      const data = await api.personas(state.lang);
      if (Array.isArray(data)) state.personas = data;
    } catch (err) {
      console.info('[Finance Quest] /api/demo-personas unavailable (' + err.message + '), using built-in profiles.');
    }
  }

  // ------------------------------------------------------------------------
  // Analyze (fresh session) — shared by life stages, the form and language switch
  // ------------------------------------------------------------------------
  function freshMissionState() {
    return {
      token: state.token, beats: [], index: 0, phase: 'answer', selected: null, ownText: '',
      pending: null, retry: false, quality: null, lastAnswer: '', started: false,
      xpAtStart: g().xp, practiceAtStart: state.practiceXp, practiceDone: new Set(),
      plantStageAtStart: plantState(displayedXp(), state.checkpointPassed).stage,
      alloc: null, mythPick: null, spotPick: null, renderedValue: 0,
    };
  }
  function freshSummary() {
    return { challengeBusy: false, accepted: false, reward: 0, leaderboard: null, checked: new Set(), celebrated: false, selfAfter: null, bankOption: 'a', bankDone: false, leveledViaChallenge: false, doneTab: 'today' };
  }

  async function analyzeProfile(profile, opts) {
    const o = opts || {};
    if (state.busy) return null;
    state.busy = true;
    state.lastProfile = profile;
    if (o.stageId !== undefined) setStageBusy(o.stageId, true);
    if (o.fromForm) setFormBusy(true);
    try {
      const body = Object.assign({}, profile, { lang: state.lang });
      const results = await Promise.all([api.analyze(body), wait(o.quick ? 0 : ANALYZE_MIN_ANIMATION_MS)]);
      applyOnboarding(results[0]);
      if (o.stay !== true || state.screen === SCREENS.ONBOARDING) {
        renderHub();
        showScreen(SCREENS.HUB);
      } else {
        renderHub();
        if (state.screen === SCREENS.HUB) renderHud({ animate: false });
      }
      updateTimeMachine(state.session.default_horizon_years, { animate: false });
      return results[0];
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const fe = mapValidationErrors(err.data);
        if (Object.keys(fe).length) {
          if (state.screen !== SCREENS.ONBOARDING) showScreen(SCREENS.ONBOARDING);
          showFieldErrors(fe);
          toast(t('err.fixForm'), 'warn');
          return null;
        }
      }
      toast(describeApiError(err), 'warn');
      return null;
    } finally {
      state.busy = false;
      setStageBusy(null, false);
      if (o.fromForm) setFormBusy(false);
    }
  }

  function applyOnboarding(data) {
    state.token += 1;
    state.session = data;
    state.turn = data.initial_mission_turn;
    state.day = data.current_day || 1;
    state.completedDays = new Set();
    state.completedChallenges = new Set();
    state.checkpointPassed = false;
    state.lessonsXp = 0;
    state.practiceXp = 0;
    state.completedLessons = new Set();
    state.lessonChecks = {};
    state.checkinDays = new Set();
    state.gateBypass = new Set();
    state.dayLessons = data.micro_lessons || [];
    state.log = [];
    state.tm = { year: null, point: null };
    state.tmAmount = null;
    state.hubTab = 1;
    state.mission = freshMissionState();
    state.plantStageAtStart = state.mission.plantStageAtStart;
    state.summary = freshSummary();
    state.cp = null;
    state.celebratedDays = new Set();
    closeModal();
    closeCora();
    closeTermPop();
    resetHudBaseline();
  }

  function selectStage(stageId) {
    const stage = stageById(stageId);
    if (!stage || state.busy) return;
    closeDemo();
    closeMenu();
    state.stageId = stageId;
    const profile = stageProfile(stage);
    fillForm(profile);
    renderStageCards();
    state.calmManual = false;   // a new profile re-applies the 45+ rule
    calmForAge(profile.age);
    analyzeProfile(profile, { stageId });
  }
  function submitForm() {
    if (state.busy) return;
    const profile = readForm();
    if (!profile) { toast(t('err.fixForm'), 'warn'); return; }
    state.stageId = null;
    renderStageCards();
    state.calmManual = false;
    calmForAge(profile.age);
    analyzeProfile(profile, { fromForm: true });
  }
  function onFormInput(event) {
    syncFormOutputs();
    const box = event.target.closest('[data-field]');
    if (box) clearFieldErrors(box.dataset.field);
  }

  function resetToProfile() {
    state.token += 1;
    state.session = null;
    state.turn = null;
    state.stageId = null;
    state.day = 1;
    state.lessonsXp = 0;
    state.practiceXp = 0;
    state.log = [];
    state.mission = null;
    state.plantStageAtStart = 1;
    state.summary = null;
    state.cp = null;
    state.userName = '';
    state.introIndex = 0;
    state.celebratedDays = new Set();
    try { window.localStorage.removeItem(LS_INTRO_SEEN); window.localStorage.removeItem(LS_USER_NAME); } catch (e) { /* ignore */ }
    closeModal();
    closeCora();
    closeDrawer();
    closeDemo();
    closeTermPop();
    state.calmManual = false;
    applyCalm(false);
    renderGuideWelcome();
    resetHudBaseline();
    renderStageCards();
    renderDemoMenus();
    showScreen(SCREENS.BANK_ENTRY);
  }

  // ------------------------------------------------------------------------
  // 11. Screen 2 — Quest Hub
  // ------------------------------------------------------------------------
  function dayDone(d) { return state.completedDays.has(d); }
  function maxDone() { let m = 0; state.completedDays.forEach((d) => { if (d > m) m = d; }); return m; }

  function nodeState(d) {
    if (dayDone(d)) return 'done';
    if (d === state.day) return 'active';
    if (dayDone(state.day) && d === maxDone() + 1) return 'next';
    return 'locked';
  }
  function checkpointState() {
    if (state.checkpointPassed) return 'done';
    return dayDone(4) ? 'active' : 'locked';
  }

  // Issue #45: a day's mission opens only after its lesson mini-checks and the Atlas check-in.
  function lessonProgress() {
    const ls = state.dayLessons || [];
    return { done: ls.filter((l) => state.completedLessons.has(l.id)).length, total: ls.length };
  }
  function dayReady() {
    if (state.gateBypass.has(state.day)) return true;
    const p = lessonProgress();
    return p.done >= p.total && state.checkinDays.has(state.day);
  }
  function gateLabel() {
    const p = lessonProgress();
    return p.done < p.total ? t('hub.gateLessons', { a: p.done, b: p.total }) : t('hub.gateCheckin');
  }
  function hubPrimary() {
    if (!dayDone(state.day)) {
      const resuming = state.mission && state.mission.started;
      if (!resuming && !dayReady()) return { label: gateLabel(), action: 'goto-lessons', locked: true };
      return { label: t(resuming ? 'hub.resumeMission' : 'hub.startMission', { n: state.day }), action: 'open-mission' };
    }
    if (state.day < PLAYABLE_DAYS) return { label: t('hub.nextDay', { n: state.day + 1 }), action: 'start-day', day: state.day + 1 };
    if (!state.checkpointPassed) return { label: t('hub.openCheckpoint'), action: 'open-checkpoint' };
    return { label: t('hub.reviewDay', { n: state.day }), action: 'open-done' };
  }
  function primaryButton(cls) {
    const p = hubPrimary();
    return '<button type="button" class="btn btn--primary btn--lg js-primary ' + (cls || '') + '" data-action="' + p.action + '"' +
      (p.day ? ' data-day="' + p.day + '"' : '') + (p.locked ? ' aria-disabled="true"' : '') + '>' +
      escapeHtml(p.label) + icon(p.locked ? 'lock' : 'arrow-right') + '</button>';
  }
  function refreshPrimary() {
    document.querySelectorAll('.js-primary').forEach((b) => {
      const extra = b.classList.contains('btn--block') ? 'btn--block' : '';
      b.outerHTML = primaryButton(extra);
    });
  }
  function gateBlocked(btn) {
    if (btn) replayClass(btn, 'attn');
    toast(gateLabel(), 'info', 3400, { guide: true });
    if (state.screen === SCREENS.HUB) showHubTab(3, { scroll: true });
  }

  function renderHub() {
    if (!state.session) return;
    renderDemoMenus();
    renderPathColumn();
    renderPlanCard();
    renderGardenCard();
    renderSkippedCard();
    renderLessonsCard();
    setupTimeMachine();
    renderHubSteps();
    els.hubMobileCta.innerHTML = '<div class="wrap" style="padding:0">' + primaryButton('btn--block') + '</div>';
  }

  // Today's briefing as three calm steps: plan -> what-if simulator -> lessons (Issue #44).
  const HUB_STEPS = 3;
  function hubStepLabel(n) {
    return n === 1 ? t('hub.step1') : n === 2 ? t('hub.step2') : t('hub.step3', { n: state.day });
  }
  function renderHubSteps() {
    const cur = clamp(state.hubTab || 1, 1, HUB_STEPS);
    els.hubSteps.innerHTML = [1, 2, 3].map((n) =>
      '<button type="button" class="step-tab" role="tab" id="hub-tab-' + n + '" aria-controls="hub-panel-' + n + '" aria-selected="' + (n === cur) + '"' +
        (n === cur ? '' : ' tabindex="-1"') + ' data-action="hub-tab" data-tab="' + n + '">' +
        '<span class="step-tab__n">' + n + '</span><span class="step-tab__label">' + escapeHtml(hubStepLabel(n)) + '</span></button>'
    ).join('');
    for (let n = 1; n <= HUB_STEPS; n++) {
      const panel = document.getElementById('hub-panel-' + n);
      if (panel) panel.hidden = n !== cur;
      const nav = document.querySelector('[data-step-nav="' + n + '"]');
      if (!nav) continue;
      const back = n > 1
        ? '<button type="button" class="btn btn--ghost" data-action="hub-tab" data-tab="' + (n - 1) + '" data-scroll="1">' + icon('arrow-right', 'ic--flip') + escapeHtml(t('hub.back')) + '</button>'
        : '<span></span>';
      const next = n < HUB_STEPS
        ? '<button type="button" class="btn btn--primary" data-action="hub-tab" data-tab="' + (n + 1) + '" data-scroll="1">' +
            escapeHtml(t('hub.next') + ': ' + hubStepLabel(n + 1)) + icon('arrow-right') + '</button>'
        : primaryButton('');
      nav.innerHTML = back + next;
    }
  }
  function showHubTab(n, opts) {
    const o = opts || {};
    state.hubTab = clamp(Number(n) || 1, 1, HUB_STEPS);
    renderHubSteps();
    if (state.hubTab === 2) {
      // The chart and slider pills live in a panel that was hidden: re-measure once visible.
      syncAmountControls();
      updateTimeMachine(state.tm.year || state.session.default_horizon_years, { animate: false });
      if (tmChart) tmChart.resize();
    }
    if (o.scroll) {
      const top = els.hubSteps.getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    if (o.focus) {
      const tab = document.getElementById('hub-tab-' + state.hubTab);
      if (tab) tab.focus({ preventScroll: true });
    }
  }

  function milestoneFor(day) {
    return (state.session.roadmap_milestones || []).find((m) => m.day === day) || null;
  }
  function dayTitle(d) {
    const m = milestoneFor(d);
    if (m && m.title) return m.title;
    if (d === 2) return t('hub.day2Title');
    if (d === 3) return t('hub.day3Title');
    return '';
  }

  // Phase 1 as a calm vertical timeline (Days 1–4 + Checkpoint #1). Each row is one button
  // with the node's state: done · active (today) · next · locked.
  function renderPathColumn() {
    const s = state.session;
    const nodes = [1, 2, 3, 4].map((d) => ({ key: String(d), day: d, st: nodeState(d) }));
    nodes.push({ key: 'cp', day: null, st: checkpointState() });
    const resuming = state.mission && state.mission.started;
    const rows = nodes.map((n) => {
      const isCp = n.key === 'cp';
      const ico = n.st === 'done' ? 'check' : n.st === 'locked' ? 'lock' : isCp ? 'trophy' : DAY_ICONS[n.day];
      const dayLabel = isCp ? t('hub.checkpoint') : t('hub.day', { n: n.day });
      const sub = isCp ? t('hub.checkpointSub') : dayTitle(n.day);
      const lockedHint = n.st === 'locked' ? (isCp ? t('hub.lockedCp') : t('hub.locked', { n: n.day - 1 })) : '';
      const aria = dayLabel + (sub ? ': ' + sub : '') + (n.st === 'done' ? ', ' + t('hub.done') : lockedHint ? ', ' + lockedHint : '');
      const live = n.st === 'active' || n.st === 'next';
      const tag = live
        ? '<span class="tl__tag">' + escapeHtml(resuming && n.st === 'active' && !isCp ? t('hub.resume') : t('hub.start')) + '</span>'
        : n.st === 'done' ? '<span class="tl__tag">' + icon('check', 'ic--sm') + escapeHtml(t('hub.done')) + '</span>' : '';
      return (
        '<li class="tl tl--' + n.st + (isCp ? ' tl--cp' : '') + '">' +
          '<button type="button" class="tl__btn" data-action="node" data-node="' + n.key + '" aria-label="' + escapeHtml(aria) + '"' +
            (n.st === 'locked' ? ' aria-disabled="true"' : '') + '>' +
            '<span class="tl__marker">' + icon(ico) + '</span>' +
            '<span class="tl__body"><span class="tl__day">' + escapeHtml(dayLabel) + '</span>' +
              (sub ? '<span class="tl__title">' + escapeHtml(sub) + '</span>' : '') +
              (lockedHint ? '<span class="tl__hint">' + escapeHtml(lockedHint) + '</span>' : '') + '</span>' +
            tag +
          '</button>' +
        '</li>'
      );
    }).join('');

    // Phases 2–3: day markers. Tapping one explains, with Atlas, that it belongs to the full
    // sprint — no call to a mission backend that does not exist yet.
    const m9 = milestoneFor(9);
    const m14 = milestoneFor(14);
    const phaseCard = (num, from, to, range, title, milestone, endIcon, endLabel) => {
      let pebbles = '';
      for (let d = from; d <= to; d++) {
        pebbles += '<button type="button" class="pebble" data-action="soon-day" data-day="' + d + '" aria-label="' + escapeHtml(t('hub.pebble', { n: d })) + '">' +
          '<span class="pebble__n">' + d + '</span></button>';
      }
      pebbles += '<button type="button" class="pebble pebble--goal" data-action="soon-day" data-day="' + to + '" aria-label="' + escapeHtml(endLabel) + '" title="' + escapeHtml(endLabel) + '">' + icon(endIcon) + '</button>';
      return (
        '<div class="phase-card phase-card--' + num + '">' +
          '<div class="phase-card__head"><span class="phase__num">' + num + '</span>' +
            '<div><p class="phase__meta">' + escapeHtml(t('hub.phase', { n: num }) + ', ' + t(range) + ', ' + t('hub.perDay')) + '</p>' +
            '<p class="phase__title">' + escapeHtml(t(title)) + '</p>' +
            (milestone ? '<p class="small" style="color:var(--ink-2);margin-top:2px">' + escapeHtml(milestone.title) + '</p>' : '') + '</div></div>' +
          '<div class="pebbles">' + pebbles + '</div>' +
        '</div>'
      );
    };

    const after = after14Paths().map((p) =>
      '<div class="after14__tile">' + icon(p.icon || 'chat') + '<h4 style="margin-top:8px">' + escapeHtml(p.title) + '</h4><p>' + escapeHtml(p.cadence || '') + '</p></div>'
    ).join('');

    els.hubPathCol.innerHTML =
      '<div class="card">' +
        '<div class="learner">' +
          '<span class="chip chip--ink">' + icon('user', 'ic--sm') + escapeHtml(s.persona_label) + '</span>' +
          '<span class="chip">' + icon('hourglass', 'ic--sm') + escapeHtml(t('hub.horizon', { n: state.lang === 'pl' ? years(s.default_horizon_years) : s.default_horizon_years })) + '</span>' +
          '<span class="chip chip--soft">' + escapeHtml(t('hub.worry', { x: t('concern.' + s.main_concern) })) + '</span>' +
        '</div>' +
        '<div class="phase" style="margin-top:16px">' +
          '<span class="phase__num">1</span>' +
          '<div><p class="phase__meta">' + escapeHtml(t('hub.phase', { n: 1 }) + ', ' + t('hub.phase1.range') + ', ' + t('hub.perDay')) + '</p>' +
          '<p class="phase__title">' + escapeHtml(t('hub.phase1.title')) + '</p></div>' +
        '</div>' +
        '<ol class="timeline" data-group="' + escapeHtml(s.age_group) + '">' + rows + '</ol>' +
        '<div class="hub-cta-desktop" style="margin-top:12px">' + primaryButton('btn--block') + '</div>' +
      '</div>';
    els.hubMoreCol.innerHTML =
      phaseCard(2, 5, 9, 'hub.phase2.range', 'hub.phase2.title', m9, 'trophy', t('hub.checkpoint2Short')) +
      phaseCard(3, 10, 14, 'hub.phase3.range', 'hub.phase3.title', m14, 'flag', t('hub.finaleShort')) +
      '<div class="card after14 after14--spotlight">' +
        '<div class="card__head"><h3 class="card__title">' + escapeHtml(t('hub.after14.title')) + '</h3>' + icon('sunset', 'ic--lg') + '</div>' +
        '<p class="small" style="color:var(--ink-2);margin-top:4px">' + escapeHtml(t('hub.after14.sub')) + '</p>' +
        '<div class="after14__grid">' + after + '</div></div>';
  }

  function onSoonDay(btn) {
    replayClass(btn, 'flash');
    Sound.pop();
    toast(t('hub.soon'), 'info', 3800, { guide: true });
  }

  function after14Paths() {
    const server = (state.turn && state.turn.post_14_paths) || (state.session && state.session.post_14_paths) || [];
    const local = blocks().after14;
    if (Array.isArray(server) && server.length) {
      return server.map((p, i) => Object.assign({ icon: (local.find((l) => l.id === p.id) || local[i % local.length] || {}).icon }, p));
    }
    return local;
  }

  function renderPlanCard() {
    const a = state.session.safe_investment || {};
    const cushion = Number(a.emergency_savings_monthly) || 0;
    const etf = Number(a.training_etf_monthly) || 0;
    let body;
    if (a.plan_type === 'split') {
      const total = Math.max(1, cushion + etf);
      const pc = Math.round((cushion / total) * 100);
      body =
        '<div class="split">' +
          '<div class="split__box split__box--cushion"><p class="split__label">' + icon('shield', 'ic--sm') + escapeHtml(t('plan.cushion')) + '</p>' +
            '<p class="split__value"><span data-count="' + cushion + '">0</span> <small>' + escapeHtml(t('unit.currency')) + escapeHtml(t('plan.mo')) + '</small></p></div>' +
          '<div class="split__box split__box--etf"><p class="split__label">' + icon('sprout', 'ic--sm') + escapeHtml(t('plan.etf')) + '</p>' +
            '<p class="split__value"><span data-count="' + etf + '">0</span> <small>' + escapeHtml(t('unit.currency')) + escapeHtml(t('plan.mo')) + '</small></p></div>' +
        '</div>' +
        '<div class="split__bar" aria-hidden="true"><span style="width:' + pc + '%"></span><span></span></div>' +
        '<p class="tiny muted" style="margin-top:6px">' + escapeHtml(t('plan.shares', { a: pc, b: 100 - pc })) + '</p>';
    } else if (a.plan_type === 'invest') {
      body =
        '<div class="split" style="grid-template-columns:1fr">' +
          '<div class="split__box split__box--etf"><p class="split__label">' + icon('sprout', 'ic--sm') + escapeHtml(t('plan.range')) + '</p>' +
            '<p class="split__value"><span data-count="' + a.min_monthly + '">0</span>–<span data-count="' + a.max_monthly + '">0</span> <small>' + escapeHtml(t('unit.currency')) + escapeHtml(t('plan.mo')) + '</small></p></div>' +
        '</div>' +
        '<p class="small" style="margin-top:8px;color:var(--ink-2)">' + escapeHtml(t('plan.sim', { amount: money(a.recommended_monthly) })) + '</p>';
    } else {
      body =
        '<div class="split" style="grid-template-columns:1fr">' +
          '<div class="split__box split__box--cushion"><p class="split__label">' + icon('shield', 'ic--sm') + escapeHtml(t('plan.cushion')) + '</p>' +
            '<p class="split__value"><span data-count="' + cushion + '">0</span> <small>' + escapeHtml(t('unit.currency')) + escapeHtml(t('plan.mo')) + '</small></p></div>' +
        '</div>' +
        '<p class="chip chip--soft" style="margin-top:10px">' + icon('clock', 'ic--sm') + escapeHtml(t('plan.etfLater', { amount: money(a.recommended_monthly) })) + '</p>';
    }
    els.cardPlan.innerHTML =
      '<h3 class="card__title">' + escapeHtml(t('plan.title')) + '</h3>' +
      '<p class="tiny muted" style="margin-top:2px">' + escapeHtml(t('plan.label')) + '</p>' + body +
      '<p class="small" style="margin-top:14px;color:var(--ink-2)">' + defineTerms(a.reasoning || '') + '</p>';
    els.cardPlan.querySelectorAll('[data-count]').forEach((el) => animateNumber(el, 0, Number(el.dataset.count), { duration: 900 }));
  }

  // Competence stage card: five capital pillars, the stage name and what it means. In calm
  // mode the XP bar gives way to "Readiness & Capital Protection".
  function renderGardenCard(opts) {
    if (!els.cardGarden) return;
    if (!state.session) { els.cardGarden.hidden = true; return; }
    els.cardGarden.hidden = false;
    const xp = displayedXp();
    const cur = plantState(xp, state.checkpointPassed);
    const dots = [1, 2, 3, 4, 5].map((n) =>
      '<span class="garden__dot' + (n < cur.stage ? ' is-past' : n === cur.stage ? ' is-current' : '') + '" aria-hidden="true"></span>'
    ).join('');
    const incentive = cur.stage === 5
      ? t('garden.complete')
      : t('garden.toNext', { xp: cur.toNext, title: cur.nextTitle });
    const extra = opts && opts.grow ? ' plant--grow' : '';
    const ready = state.turn ? clamp(Number(state.turn.confidence_score) || 0, 0, 100) : 0;
    const progress = state.calm
      ? '<div class="garden__ready"><span class="ready__label"><span>' + escapeHtml(t('hud.readinessCalm')) + '</span> <b>' + ready + '%</b></span>' +
          '<div class="meter" style="margin-top:6px" aria-hidden="true"><div class="meter__fill" style="width:' + ready + '%"></div></div></div>'
      : '<div class="garden__bar" aria-hidden="true"><span style="width:' + cur.pct + '%"></span></div>' +
        '<p class="garden__incentive">' + escapeHtml(incentive) + '</p>';
    els.cardGarden.innerHTML =
      '<div class="card__head"><h3 class="card__title">' + escapeHtml(t('garden.title')) + '</h3>' +
        '<span class="chip chip--soft num">' + escapeHtml(t('garden.stageLabel', { stage: cur.stage })) + '</span></div>' +
      '<div class="garden__row">' +
        plantSVG(cur.stage, extra) +
        '<div class="garden__copy">' +
          '<p class="garden__stage">' + escapeHtml(cur.title) + '</p>' +
          '<div class="garden__dots" role="img" aria-label="' + escapeHtml(t('garden.progress') + ': ' + t('garden.stageLabel', { stage: cur.stage })) + '">' + dots + '</div>' +
          progress +
          '<p class="garden__desc">' + escapeHtml(cur.quote) + '</p>' +
        '</div>' +
      '</div>';
  }

  function renderSkippedCard() {
    const f = state.session.speakly_filter || { kept_topics: [], removed_topics: [] };
    const n = (f.removed_topics || []).length;
    els.cardSkipped.innerHTML =
      '<span class="skip-badge">' + icon('filter', 'ic--sm') + escapeHtml(t('skip.badge', { n })) + '</span>' +
      '<div class="topics">' +
        '<div><h4>' + escapeHtml(t('skip.kept')) + '</h4><ul class="kept">' +
          (f.kept_topics || []).map((k) => '<li>' + icon('check', 'ic--sm') + '<span>' + escapeHtml(k) + '</span></li>').join('') + '</ul></div>' +
        '<div><h4 class="muted">' + escapeHtml(t('skip.removed')) + '</h4><ul class="removed">' +
          (f.removed_topics || []).map((r, i) => '<li><span class="topic-strike" style="--i:' + i + '">' + escapeHtml(r) + '</span></li>').join('') + '</ul></div>' +
      '</div>';
  }

  function renderLessonsCard() {
    const lessons = state.dayLessons || [];
    const max = Math.min(MICRO_LESSON_BONUS_CAP, lessons.reduce((sum, l) => sum + (l.xp_reward || 0), 0));
    const title = state.day === 1 ? t('lessons.title') : t('lessons.titleDay', { n: state.day });
    const p = lessonProgress();
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 100;
    els.cardLessons.innerHTML =
      '<div class="card__head"><h3 class="card__title">' + escapeHtml(title) + '</h3><span class="tiny muted">' + escapeHtml(t('lessons.sub', { n: max })) + '</span></div>' +
      '<div class="lessons-progress"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.done + '"><div class="progress__fill" style="width:' + pct + '%"></div></div>' +
        '<span class="tiny strong">' + escapeHtml(t('lessons.progress', { a: p.done, b: p.total })) + '</span></div>' +
      '<div class="lessons">' + lessons.map(lessonHTML).join('') + '</div>' + checkinHTML();
    hydrateCora(els.cardLessons);
  }
  function hasCheck(l) {
    return !!(l && l.check_question && Array.isArray(l.check_options) && l.check_options.length > 1 && l.correct_option_index != null);
  }
  function lessonCheckHTML(l, done) {
    const wrong = (state.lessonChecks[l.id] && state.lessonChecks[l.id].wrong) || [];
    const letters = ['A', 'B', 'C', 'D'];
    const opts = l.check_options.map((txt, i) => {
      const right = done && i === l.correct_option_index;
      const bad = wrong.indexOf(i) >= 0;
      return '<button type="button" class="lcheck__opt' + (right ? ' is-right' : '') + (bad ? ' is-wrong' : '') + '" data-action="lesson-pick" data-lesson-id="' + escapeHtml(l.id) + '" data-i="' + i + '"' +
        (done || bad ? ' disabled' : '') + '><span class="lcheck__key">' + letters[i] + '</span><span>' + escapeHtml(txt) + '</span></button>';
    }).join('');
    const note = done
      ? '<p class="lcheck__note lcheck__note--ok" role="status">' + icon('check', 'ic--sm') + '<span>' + escapeHtml(t('lessons.right')) + (l.check_explanation ? ': ' + escapeHtml(l.check_explanation) : '') + '</span></p>'
      : wrong.length
        ? '<div class="lcheck__note lcheck__note--bad" role="status"><p>' + icon('bulb', 'ic--sm') + '<span>' + escapeHtml(t('lessons.wrong')) + (l.check_explanation ? ' ' + escapeHtml(l.check_explanation) : '') + '</span></p>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-action="open-cora" data-topic="' + escapeHtml(l.title) + '">' + icon('help', 'ic--sm') + escapeHtml(t('lessons.askGuide')) + '</button></div>'
        : '';
    return '<div class="lcheck"><p class="lcheck__q"><span class="chip chip--soft">' + escapeHtml(t('lessons.check')) + '</span> ' + escapeHtml(l.check_question) + '</p>' +
      '<div class="lcheck__opts">' + opts + '</div>' + note + '</div>';
  }
  function lessonHTML(l) {
    const done = state.completedLessons.has(l.id);
    const checked = hasCheck(l);
    return (
      '<article class="lesson' + (done ? ' lesson--done' : '') + '" data-lesson="' + escapeHtml(l.id) + '">' +
        '<div class="lesson__head"><h4 class="lesson__title">' + escapeHtml(l.title) + '</h4><span class="lesson__time">' + escapeHtml(t('lessons.sec', { n: l.duration_sec || 20 })) + '</span></div>' +
        '<p class="lesson__body">' + defineTerms(l.summary) + '</p>' +
        '<p class="lesson__key">' + icon('bulb', 'ic--sm') + '<span>' + defineTerms(l.key_takeaway) + '</span></p>' +
        (checked ? lessonCheckHTML(l, done) : '') +
        '<div class="lesson__actions">' +
          (done
            ? '<span class="lesson__done">' + icon('check', 'ic--sm') + escapeHtml(t('lessons.done', { n: l.xp_reward })) + '</span>'
            : checked ? '' : '<button type="button" class="btn btn--green btn--sm" data-action="lesson" data-lesson-id="' + escapeHtml(l.id) + '">' + escapeHtml(t('lessons.got', { n: l.xp_reward })) + '</button>') +
          (checked && !done ? '' : '<button type="button" class="btn btn--ghost btn--sm" data-action="open-cora" data-topic="' + escapeHtml(l.title) + '">' + icon('help', 'ic--sm') + escapeHtml(t('lessons.explain')) + '</button>') +
        '</div>' +
      '</article>'
    );
  }
  // End-of-block check-in with Atlas (Issue #45): shown once every lesson of the day is passed.
  function checkinHTML() {
    const p = lessonProgress();
    if (p.done < p.total || !p.total) return '';
    if (state.checkinDays.has(state.day) || state.gateBypass.has(state.day)) {
      return '<p class="checkin-done chip chip--green">' + icon('check', 'ic--sm') + escapeHtml(t('checkin.done', { n: state.day })) + '</p>';
    }
    return (
      '<div class="checkin" id="guide-checkin">' +
        '<div class="cora checkin__guide" data-cora="confident" aria-hidden="true"></div>' +
        '<div class="checkin__body"><p class="checkin__title">' + escapeHtml(t('checkin.title')) + '</p>' +
          '<div class="bubble"><p>' + escapeHtml(t('checkin.q')) + '</p></div>' +
          '<div class="checkin__actions">' +
            '<button type="button" class="btn btn--ghost" data-action="checkin-explain">' + icon('help', 'ic--sm') + escapeHtml(t('checkin.yes')) + '</button>' +
            '<button type="button" class="btn btn--primary" data-action="checkin-start">' + escapeHtml(t('checkin.start', { n: state.day })) + icon('arrow-right') + '</button>' +
          '</div></div>' +
      '</div>'
    );
  }
  function completeLesson(id) {
    if (state.completedLessons.has(id)) return;
    const l = (state.dayLessons || []).find((x) => x.id === id);
    if (!l) return;
    const stageBefore = plantState(displayedXp(), state.checkpointPassed).stage;
    state.completedLessons.add(id);
    const before = state.lessonsXp;
    state.lessonsXp = clamp(state.lessonsXp + (Number(l.xp_reward) || 0), 0, MICRO_LESSON_BONUS_CAP * PLAYABLE_DAYS);
    const gained = state.lessonsXp - before;
    renderLessonsCard();
    refreshPrimary();
    const card = els.cardLessons.querySelector('[data-lesson="' + CSS.escape(id) + '"]');
    xpFloat(gained, card || els.hudXpPill);
    renderHud();
    const stageAfter = plantState(displayedXp(), state.checkpointPassed).stage;
    renderGardenCard({ grow: stageAfter > stageBefore });
  }
  function pickLessonOption(id, i) {
    if (state.completedLessons.has(id)) return;
    const l = (state.dayLessons || []).find((x) => x.id === id);
    if (!l || !hasCheck(l)) return;
    if (i === Number(l.correct_option_index)) {
      Sound.correct();
      completeLesson(id);
      return;
    }
    const rec = state.lessonChecks[id] || (state.lessonChecks[id] = { wrong: [] });
    if (rec.wrong.indexOf(i) < 0) rec.wrong.push(i);
    Sound.retry();
    renderLessonsCard();
    const card = els.cardLessons.querySelector('[data-lesson="' + CSS.escape(id) + '"]');
    if (card) replayClass(card.querySelector('.lcheck'), 'attn');
  }
  function checkinExplain() {
    openCora({ question: dayTitle(state.day) || t('hub.phase1.title') });
  }
  function checkinStart() {
    const p = lessonProgress();
    if (p.done < p.total) { gateBlocked(null); return; }
    state.checkinDays.add(state.day);
    Sound.pop();
    renderLessonsCard();
    refreshPrimary();
    openMission();
  }
  function gotoLessons(btn) {
    if (btn) replayClass(btn, 'attn');
    showHubTab(3, { scroll: true });
    if (els.cardLessons) replayClass(els.cardLessons, 'flash');
  }

  // Time machine: slider 1–20 years + what-if monthly amount, 3 KPIs in today's money,
  // chart with a "Year 0" point.
  const TM_AMOUNT_MIN = 50;
  const TM_AMOUNT_STEP = 50;
  const TM_AMOUNT_MAX = 5000;
  function planAmount() { return Number(state.session.safe_investment.recommended_monthly) || 100; }
  function currentAmount() { return state.tmAmount == null ? planAmount() : state.tmAmount; }

  // Python's round() (half to even), so totals match backend/finance_math.py to the złoty.
  function pyRound(x) {
    const f = Math.floor(x);
    if (Math.abs(x - f - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
    return Math.round(x);
  }
  // Mirror of finance_math.generate_projection_series(monthly_amount). Rates come from the
  // server's `assumptions` and the stress multipliers from the server's own series, so the
  // client never drifts from the backend constants.
  function projectionFor(amount) {
    const s = state.session;
    const base = s.projection_series || [];
    if (amount === planAmount()) return base;
    const a = s.assumptions || {};
    const rEtf = (Number(a.etf_net_nominal_pct) || 5.7) / 100;
    const rInf = (Number(a.inflation_pct) || 3.5) / 100;
    const i = rEtf / 12;
    return base.map((bp) => {
      const year = bp.year;
      const n = 12 * year;
      const paid = amount * n;
      const nominal = amount * ((Math.pow(1 + i, n) - 1) / i);
      const deflator = Math.pow(1 + rInf, year);
      const etfReal = nominal / deflator;
      const cashReal = paid / deflator;
      const stress = bp.etf_real_value > 0 ? Math.round((bp.etf_stress_real_value / bp.etf_real_value) * 100) / 100 : 1;
      const er = pyRound(etfReal);
      const cr = pyRound(cashReal);
      return {
        year, total_paid: paid, etf_nominal_value: pyRound(nominal), etf_real_value: er,
        etf_stress_real_value: pyRound(etfReal * stress), cash_real_value: cr,
        real_gain_vs_cash: er - cr, historical_win_rate: bp.historical_win_rate,
      };
    });
  }

  function setupTimeMachine() {
    const s = state.session;
    const plan = planAmount();
    const max = Math.max(TM_AMOUNT_MAX, Math.ceil(plan / TM_AMOUNT_STEP) * TM_AMOUNT_STEP);
    els.tmAmount.min = String(TM_AMOUNT_MIN);
    els.tmAmount.max = String(max);
    els.tmAmount.step = String(TM_AMOUNT_STEP);
    els.tmAmountMin.textContent = money(TM_AMOUNT_MIN);
    els.tmAmountMax.textContent = money(max);
    els.tmAssumptions.textContent = s.assumptions ? s.assumptions.text : '';
    els.tmMin.textContent = years(1);
    els.tmMax.textContent = years(20);
    syncAmountControls();
  }
  function syncAmountControls() {
    const plan = planAmount();
    const amount = currentAmount();
    els.tmAmount.value = String(amount);
    setRangeFill(els.tmAmount, els.tmAmountPill, t('tm.amountPill', { amount: money(amount) }));
    els.tmMonthly.textContent = t('tm.monthly', { amount: money(amount) });
    const whatIf = amount !== plan;
    els.tmReset.hidden = !whatIf;
    els.tmAmountNote.textContent = whatIf
      ? t('tm.whatIfNote', { amount: money(amount), plan: money(plan) })
      : t('tm.planNote', { plan: money(plan) });
  }
  function setWhatIfAmount(value) {
    if (!state.session) return;
    const max = Number(els.tmAmount.max) || TM_AMOUNT_MAX;
    const v = clamp(Math.round((Number(value) || TM_AMOUNT_MIN) / TM_AMOUNT_STEP) * TM_AMOUNT_STEP, TM_AMOUNT_MIN, max);
    // Snap back to the exact plan amount (it may not sit on the 50 PLN grid, e.g. savings_first 100).
    state.tmAmount = Math.abs(v - planAmount()) < TM_AMOUNT_STEP / 2 ? null : v;
    syncAmountControls();
    updateTimeMachine(state.tm.year || state.session.default_horizon_years);
  }
  function updateTimeMachine(year, opts) {
    if (!state.session) return;
    const series = projectionFor(currentAmount());
    if (!series.length) return;
    const y = clamp(Math.round(Number(year) || 1), 1, series.length);
    const p = series[y - 1];
    const prev = state.tm.point;
    const animate = !opts || opts.animate !== false;
    els.tmYears.value = String(y);
    setRangeFill(els.tmYears, els.tmPill, years(y));
    const kpi = (el, key) => {
      if (animate && prev) animateNumber(el, prev[key], p[key], { duration: 420, format: money });
      else setNumber(el, p[key], money);
    };
    kpi(els.kpiCash, 'cash_real_value');
    kpi(els.kpiEtf, 'etf_real_value');
    els.kpiPaid.textContent = t('tm.paid', { amount: money(p.total_paid) });
    els.kpiEtfNominal.textContent = t('tm.nominal', { amount: money(p.etf_nominal_value) });
    const win = Math.min(WIN_RATE_DISPLAY_CAP, p.historical_win_rate);
    els.kpiWin.textContent = win + '%';
    els.kpiWinText.textContent = t('tm.winText');
    state.tm = { year: y, point: p };
    renderChart(series, y);
    renderCostOfWaiting(series);
  }
  // Cost of Waiting (calm 45+ mode): purchasing power lost on 0% vs a broad ETF, in PLN, over
  // this generation's own horizon (e.g. 56y: 7 years). Same series as the chart.
  function renderCostOfWaiting(series) {
    if (!els.tmCow || !state.session) return;
    const h = clamp(Number(state.session.default_horizon_years) || 10, 1, series.length);
    const p = series[h - 1];
    if (!p) { els.tmCow.innerHTML = ''; return; }
    const lost = Math.max(0, p.total_paid - p.cash_real_value);
    const gain = p.etf_real_value - p.cash_real_value;
    els.tmCow.innerHTML =
      '<p class="cow__title">' + icon('hourglass', 'ic--sm') + escapeHtml(t('cow.title')) + '</p>' +
      '<p class="cow__lead">' + escapeHtml(t('cow.lead', { years: years(h), amount: money(currentAmount()) })) + '</p>' +
      '<div class="cow__grid">' +
        '<div class="cow__cell cow__cell--paid"><p class="cow__label">' + escapeHtml(t('cow.paid')) + '</p><p class="cow__value">' + escapeHtml(money(p.total_paid)) + '</p></div>' +
        '<div class="cow__cell"><p class="cow__label">' + escapeHtml(t('cow.cash')) + '</p><p class="cow__value">' + escapeHtml(money(p.cash_real_value)) + '</p>' +
          '<p class="cow__delta cow__delta--loss">' + escapeHtml(t('cow.cashLoss', { amount: '−' + money(lost) })) + '</p></div>' +
        '<div class="cow__cell"><p class="cow__label">' + escapeHtml(t('cow.etf')) + '</p><p class="cow__value">' + escapeHtml(money(p.etf_real_value)) + '</p>' +
          '<p class="cow__delta cow__delta--gain">' + escapeHtml(t('cow.etfGain', { amount: money(gain) })) + '</p></div>' +
      '</div>' +
      '<p class="cow__note">' + escapeHtml(t('cow.note')) + '</p>';
  }
  function chartData(series, year) {
    const pts = series.slice(0, year);
    return {
      labels: [t('tm.year', { n: 0 })].concat(pts.map((p) => t('tm.year', { n: p.year }))),
      etf: [0].concat(pts.map((p) => p.etf_real_value)),
      cash: [0].concat(pts.map((p) => p.cash_real_value)),
      stress: [0].concat(pts.map((p) => p.etf_stress_real_value)),
    };
  }
  function compactMoney(v) {
    if (Math.abs(v) >= 1000) {
      return (v / 1000).toLocaleString(state.lang === 'pl' ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 }) + (state.lang === 'pl' ? NBSP : '') + t('unit.thousand');
    }
    return formatNumber(v);
  }
  function renderChart(series, year) {
    if (!window.Chart || !els.tmChart) return;
    const d = chartData(series, year);
    if (tmChart) {
      tmChart.data.labels = d.labels;
      tmChart.data.datasets[0].data = d.etf;
      tmChart.data.datasets[1].data = d.cash;
      tmChart.data.datasets[2].data = d.stress;
      tmChart.data.datasets[0].label = t('tm.legendEtf');
      tmChart.data.datasets[1].label = t('tm.legendCash');
      tmChart.data.datasets[2].label = t('tm.legendStress');
      tmChart.options.scales.y.title.text = t('tm.yAxis');
      tmChart.update();
      return;
    }
    const fill = (ctx) => {
      const area = ctx.chart.chartArea;
      if (!area) return 'rgba(18,183,106,0.10)';
      const grad = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      grad.addColorStop(0, 'rgba(18,183,106,0.16)');
      grad.addColorStop(1, 'rgba(18,183,106,0.01)');
      return grad;
    };
    const hover = (color) => ({ pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#FFFFFF', pointHoverBorderColor: color, pointHoverBorderWidth: 2 });
    tmChart = new window.Chart(els.tmChart, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          Object.assign({ label: t('tm.legendEtf'), data: d.etf, borderColor: C.green, backgroundColor: fill, fill: 'origin', borderWidth: 2.5, tension: 0.3, order: 2 }, hover(C.green)),
          Object.assign({ label: t('tm.legendCash'), data: d.cash, borderColor: C.coral, borderDash: [7, 5], borderWidth: 2, fill: false, tension: 0.3, order: 1 }, hover(C.coral)),
          Object.assign({ label: t('tm.legendStress'), data: d.stress, borderColor: C.amber, borderDash: [2, 4], borderWidth: 2, fill: false, tension: 0.3, order: 0 }, hover(C.amber)),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8, titleFont: { weight: '700' }, bodyFont: { weight: '500' }, callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + money(ctx.parsed.y) } },
        },
        scales: {
          x: { grid: { display: false }, border: { color: C.rule, width: 1 }, ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: 'rgba(8,41,51,0.06)' }, border: { display: false },
            title: { display: true, text: t('tm.yAxis'), font: { size: 11, weight: '600' } },
            ticks: { callback: (v) => compactMoney(v), maxTicksLimit: 6 } },
        },
      },
    });
  }

  // ------------------------------------------------------------------------
  // 12. Screen 3 — mission engine
  // Server steps (docs/03 §2) are interleaved with frontend practice beats:
  //   Day 1: decision -> cash-split slider -> concern scenario -> myth vs reality -> -20% dip check
  //   Day 2: step 1 -> spot the fee -> step 2 · Days 3–4: server steps only.
  // Practice beats never touch the server state, so the Golden Path numbers stay exact.
  // ------------------------------------------------------------------------
  function buildBeats(day, total) {
    const steps = Array.from({ length: total }, (_, i) => ({ kind: 'server', step: i + 1 }));
    if (day === 1 && total === 3) return [steps[0], { kind: 'alloc' }, steps[1], { kind: 'myth' }, steps[2]];
    if (day === 2 && total === 2) return [steps[0], { kind: 'spot' }, steps[1]];
    return steps;
  }
  function currentBeat() {
    const m = state.mission;
    return m && m.beats[m.index];
  }

  const REPLY_ICON_RULES = [
    ['snowflake', /nothing|locked|frozen|nic nie|zablokow|zamroż/i],
    ['trend-down', /\bsell|sprzeda/i],
    ['pause', /\bstop|wait|wstrzym|czekam|postpone|odkład/i],
    ['shield', /buffer|cushion|poduszk/i],
    ['repeat', /keep the plan|keep contributing|standing|automat|background|trzymam plan|dalej wpłacam|stał|w tle/i],
    ['eye', /daily|every day|codzien|notowa/i],
    ['building', /one .*compan|single|jednej|pojedyncz|spółk/i],
    ['wallet', /account|cash|konto|gotówk/i],
    ['sprout', /etf|fund|fundusz/i],
    ['hourglass', /age|horizon|wiek|horyzont/i],
    ['coins', /half|połow|fee|opłat|ter\b/i],
  ];
  function replyIcon(text, i) {
    const rule = REPLY_ICON_RULES.find((r) => r[1].test(text || ''));
    return rule ? rule[0] : ['bulb', 'target', 'chart'][i % 3];
  }

  function openMission() {
    if (!state.session || !state.turn) return;
    if (dayDone(state.day)) { openDone(); return; }
    const m = state.mission;
    if (!m.beats.length) m.beats = buildBeats(state.day, state.turn.total_steps || 3);
    m.started = true;
    showScreen(SCREENS.MISSION);
    renderBeat();
  }

  function closeMission() {
    const m = state.mission;
    if (m && m.phase === 'feedback' && !m.retry && !(state.turn && state.turn.mission_completed)) {
      m.index = Math.min(m.index + 1, m.beats.length - 1);
      m.phase = 'answer';
    }
    closeDrawer();
    if (state.turn && state.turn.mission_completed && dayDone(state.day)) { openDone(); return; }
    renderHub();
    showScreen(SCREENS.HUB);
    updateTimeMachine(state.tm.year || state.session.default_horizon_years, { animate: false });
  }

  function renderMissionBar() {
    const m = state.mission;
    const total = m.beats.length || 1;
    const advanced = m.phase === 'feedback' && !m.retry ? 1 : 0;
    const pct = clamp(((m.index + advanced) / total) * 100, 0, 100);
    els.mProgressFill.style.width = pct + '%';
    els.mProgress.setAttribute('aria-valuenow', String(Math.round(pct)));
    els.mTicks.innerHTML = '<span></span>'.repeat(total);
    setNumber(els.mXp, displayedXp());
    const beat = currentBeat();
    // Chips describe the step on screen, not the next step already returned by the server.
    const tt = m.viewTurn || state.turn || {};
    const ps = tt.portfolio_status || {};
    const chips = ['<span class="chip chip--ink">' + icon('calendar', 'ic--sm') + escapeHtml(t('mission.dayChip', { d: state.day })) + '</span>',
      '<span class="chip">' + escapeHtml(t('mission.stepChip', { s: Math.min(m.index + 1, total), t: total })) + '</span>'];
    if (beat && beat.kind === 'server') {
      if (ps.event_badge) chips.push('<span class="chip chip--yellow">' + icon('flag', 'ic--sm') + escapeHtml(ps.event_badge) + '</span>');
      if (Number(ps.simulated_value) > 0) chips.push('<span class="chip chip--green">' + icon('chart', 'ic--sm') + '<span id="m-value">' + escapeHtml(t('mission.portfolio', { amount: money(ps.simulated_value) })) + '</span></span>');
    } else {
      chips.push('<span class="chip chip--sky">' + icon('bulb', 'ic--sm') + escapeHtml(t('mission.practice')) + '</span>');
    }
    els.mMeta.innerHTML = chips.join('');
  }

  function sceneHTML(message, opts) {
    const o = opts || {};
    return (
      '<div class="scene">' + coraHTML(o.mood || 'idle') +
        '<div class="bubble">' +
          '<p class="scene__who">' + escapeHtml(t('mission.coraWho')) + '</p>' +
          (o.question ? '<p class="scene__q" style="margin-top:0">' + escapeHtml(o.question) + '</p>' : '') +
          '<p class="scene__msg"' + (o.question ? ' style="margin-top:8px;font-size:1rem;font-weight:600;color:var(--ink-2)"' : '') + ' id="m-msg">' + escapeHtml(message) + '</p>' +
          '<p class="small strong" id="m-thinking" style="margin-top:8px" hidden>' + escapeHtml(t('mission.thinking')) + '<span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span></p>' +
        '</div>' +
      '</div>'
    );
  }
  function sceneCora() { return els.mStage.querySelector('.scene .cora'); }

  function renderBeat() {
    const m = state.mission;
    const beat = currentBeat();
    if (!beat) return;
    m.phase = 'answer';
    m.selected = null;
    m.ownText = '';
    m.retry = false;
    m.practiceRetry = false;
    m.viewTurn = state.turn;
    closeDrawer();
    if (beat.kind === 'server') renderServerBeat();
    else if (beat.kind === 'alloc') renderAllocBeat();
    else if (beat.kind === 'myth') renderMythBeat();
    else if (beat.kind === 'spot') renderSpotBeat();
    renderMissionBar();
    updateCheck();
    replayClass(els.mStage, 'screen-enter');
  }

  function renderServerBeat() {
    const tt = state.turn;
    const replies = tt.quick_replies || [];
    const answers = replies.map((r, i) =>
      '<button type="button" class="answer" data-action="pick" data-id="' + escapeHtml(r.id) + '" aria-pressed="false">' +
        '<span class="answer__icon">' + icon(replyIcon(r.text, i)) + '</span>' +
        '<span>' + escapeHtml(r.text) + '</span>' +
        '<span class="answer__key" aria-hidden="true">' + 'ABCD'.charAt(i) + '</span>' +
      '</button>'
    ).join('');
    els.mStage.innerHTML =
      sceneHTML(tt.luna_message || '') +
      '<div class="answers" role="group">' + answers + '</div>' +
      '<div class="own" id="m-own">' +
        '<label class="own__label" for="m-input">' + escapeHtml(t('mission.ownLabel')) + '</label>' +
        '<textarea class="textarea" id="m-input" rows="2" maxlength="' + MISSION_MESSAGE_MAX + '" placeholder="' + escapeHtml(t('mission.ownPlaceholder')) + '"></textarea>' +
        '<div class="own__meta"><span>' + escapeHtml(t('mission.ownHint')) + '</span><span class="num"><span id="m-count">0</span>/' + MISSION_MESSAGE_MAX + '</span></div>' +
      '</div>';
    state.mission.renderedValue = Number((tt.portfolio_status || {}).simulated_value) || 0;
  }

  function pickAnswer(id, btn) {
    const m = state.mission;
    if (m.phase !== 'answer') return;
    m.selected = id;
    els.mStage.querySelectorAll('.answer[data-action="pick"]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const input = document.getElementById('m-input');
    if (input && input.value) { input.value = ''; m.ownText = ''; syncOwn(); }
    updateCheck();
  }
  function syncOwn() {
    const input = document.getElementById('m-input');
    const own = document.getElementById('m-own');
    const count = document.getElementById('m-count');
    if (!input) return;
    state.mission.ownText = input.value;
    if (count) count.textContent = String(input.value.length);
    const active = input.value.trim().length > 0;
    if (own) own.classList.toggle('is-active', active);
    if (active && state.mission.selected) {
      state.mission.selected = null;
      els.mStage.querySelectorAll('.answer[data-action="pick"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    }
    updateCheck();
  }

  function updateCheck() {
    const m = state.mission;
    const beat = currentBeat();
    if (!m || !beat) return;
    let ready = false;
    if (beat.kind === 'server') ready = !!m.selected || m.ownText.trim().length > 0;
    else if (beat.kind === 'alloc') ready = true;
    else if (beat.kind === 'spot') ready = !!m.spotPick;
    els.mCheck.hidden = beat.kind === 'myth';
    els.mCheck.disabled = !(m.phase === 'answer' && ready);
  }
  function setCheckBusy(busy) {
    els.mCheck.classList.toggle('is-busy', busy);
    els.mCheck.querySelector('.spinner').hidden = !busy;
    els.mCheck.querySelector('[data-label]').textContent = busy ? t('mission.checking') : t('mission.check');
    if (busy) els.mCheck.disabled = true;
  }

  function check() {
    const beat = currentBeat();
    if (!beat || state.mission.phase !== 'answer') return;
    if (beat.kind === 'server') checkServer();
    else if (beat.kind === 'alloc') checkAlloc();
    else if (beat.kind === 'spot') checkSpot();
  }

  function qualityOf(res, prevStep) {
    if (res.answer_quality) return res.answer_quality;
    if (res.allow_retry === true) return 'invalid';
    const gained = (res.gamification && res.gamification.xp_gained) || 0;
    if (!res.mission_completed && res.step_number === prevStep && res.is_optimal_choice === false && gained === 0) return 'invalid';
    return res.is_optimal_choice ? 'optimal' : 'partial';
  }
  const FALLBACK_RE = /couldn't evaluate|could not evaluate|nie udało się jej teraz ocenić/i;

  async function checkServer() {
    const m = state.mission;
    const tt = state.turn;
    if (!tt || tt.mission_completed) return;
    let payload;
    if (m.selected) {
      const r = (tt.quick_replies || []).find((x) => x.id === m.selected);
      if (!r) return;
      payload = { user_message: r.text, quick_reply_id: r.id };
    } else {
      const text = m.ownText.trim().slice(0, MISSION_MESSAGE_MAX);
      if (!text) { toast(t('mission.pickOrType'), 'warn'); return; }
      payload = { user_message: text };
    }
    payload.lang = state.lang;
    payload.day = state.day;
    const freeText = !payload.quick_reply_id;
    const token = state.token;
    const prevStep = tt.step_number;
    const stageBefore = plantState(displayedXp(), state.checkpointPassed).stage;
    m.phase = 'busy';
    setCheckBusy(true);
    setAnswersDisabled(true);
    if (freeText) {
      setMood(sceneCora(), 'thinking');
      const th = document.getElementById('m-thinking');
      if (th) th.hidden = false;
    }
    try {
      const res = await withSessionRecovery((sid) => api.turn(Object.assign({ session_id: sid }, payload)));
      if (token !== state.token) return;
      state.log.push({ kind: 'turn', body: payload });
      const quality = qualityOf(res, prevStep);
      m.retry = quality === 'invalid';
      m.quality = quality;
      m.lastAnswer = freeText ? payload.user_message : '';
      m.phase = 'feedback';
      state.turn = res;
      if (res.mission_completed) markDayComplete();
      renderHud();
      const th = document.getElementById('m-thinking');
      if (th) th.hidden = true;

      const picked = m.selected ? els.mStage.querySelector('.answer[data-id="' + CSS.escape(m.selected) + '"]') : null;
      const win = quality === 'optimal';
      if (picked) picked.classList.add(win ? 'is-right' : 'is-wrong');
      else if (!win) replayClass(document.getElementById('m-own'), 'attn');
      setMood(sceneCora(), win ? 'celebrating' : 'coaching');

      const gs = res.gamification || DEFAULT_G;
      const stageNow = plantState(displayedXp(), state.checkpointPassed);
      const pills = [];
      pills.push('<span class="pill-xp">' + (gs.xp_gained ? '+' + gs.xp_gained + ' XP' : escapeHtml(t('mission.zeroXp'))) + '</span>');
      if ((res.confidence_delta || 0) > 0) pills.push('<span class="chip chip--green">' + escapeHtml(t('mission.readinessPill', { n: res.confidence_delta })) + '</span>');
      if (stageNow.stage > stageBefore) pills.push('<span class="chip chip--yellow">' + icon('pillars', 'ic--sm') + escapeHtml(t('mission.stagePill', { title: stageNow.title })) + '</span>');
      if (quality !== 'invalid' && isDipStep(prevStep)) showPanicVsDiscipline();
      let title;
      if (win) title = tPick('mission.right', prevStep + state.day);
      else if (quality === 'invalid') title = t('mission.invalid');
      else if (freeText && FALLBACK_RE.test(res.understanding_feedback || '')) title = t('mission.fallback');
      else title = t('mission.partial');
      openDrawer({
        tone: win ? 'win' : 'coach',
        title,
        text: res.understanding_feedback || '',
        answer: m.lastAnswer,
        pills: pills.join(''),
        cta: m.retry ? t('mission.tryAgain') : res.mission_completed ? t('mission.finish') : t('mission.continue'),
      });
      // Quiet Mastery: no confetti on single steps — only once at the end of the day.
      if (win) { Sound.correct(); xpFloat(gs.xp_gained, els.mXpPill, 'green'); }
      else { Sound.retry(); if (gs.xp_gained) xpFloat(gs.xp_gained, els.mXpPill); }
      renderMissionBar();
    } catch (err) {
      if (token !== state.token) return;
      m.phase = 'answer';
      setMood(sceneCora(), 'idle');
      const th = document.getElementById('m-thinking');
      if (th) th.hidden = true;
      setAnswersDisabled(false);
      toast(err instanceof ApiError && err.status === 422 ? t('toast.answerLength') : isSessionMissing(err) ? t('toast.sessionLost') : describeApiError(err), 'warn');
    } finally {
      setCheckBusy(false);
      updateCheck();
    }
  }
  // Day 1, step 3 is the shared -20% dip test (docs/03 §7C).
  function isDipStep(step) {
    const beat = currentBeat();
    return state.day === 1 && beat && beat.kind === 'server' && Number(step) === 3;
  }
  // Panic vs Discipline: what the -20% decision means in PLN for this learner's own plan, from
  // the server projection (same assumptions as the time machine). Panic = sell in year 3 at
  // the dip and park all later payments in a 0% account; Discipline = keep the plan.
  function panicVsDiscipline() {
    const s = state.session;
    const series = (s && s.projection_series) || [];
    if (series.length < 3) return null;
    const amount = planAmount();
    const h = clamp(Number(s.default_horizon_years) || 10, 4, series.length);
    const y3 = series[2];
    const end = series[h - 1];
    const rInf = ((s.assumptions && Number(s.assumptions.inflation_pct)) || 3.5) / 100;
    const dipValue = pyRound(y3.etf_nominal_value * 0.8);
    const lockedLoss = y3.etf_nominal_value - dipValue;
    const later = amount * 12 * (h - 3);
    const panicReal = pyRound((dipValue + later) / Math.pow(1 + rInf, h));
    const disciplineReal = end.etf_real_value;
    return { amount, h, dipValue, lockedLoss, later, panicReal, disciplineReal, gap: disciplineReal - panicReal };
  }
  function showPanicVsDiscipline() {
    const d = panicVsDiscipline();
    if (!d || document.getElementById('m-pvd')) return;
    const row = (label, value, cls) => '<p class="pvd__row' + (cls ? ' ' + cls : '') + '"><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(value) + '</b></p>';
    const html =
      '<section class="pvd" id="m-pvd" aria-labelledby="m-pvd-title">' +
        '<h3 class="pvd__title" id="m-pvd-title">' + escapeHtml(t('pvd.title')) + '</h3>' +
        '<p class="pvd__lead">' + escapeHtml(t('pvd.lead', { amount: money(d.amount), years: years(d.h) })) + '</p>' +
        '<div class="pvd__cols">' +
          '<div class="pvd__col pvd__col--panic"><p class="pvd__head">' + icon('trend-down', 'ic--sm') + escapeHtml(t('pvd.panic')) + '</p><div class="pvd__rows">' +
            row(t('pvd.panicSell'), money(d.dipValue)) +
            row(t('pvd.panicLocked'), '−' + money(d.lockedLoss)) +
            row(t('pvd.panicRest'), '+' + money(d.later)) +
            row(t('pvd.total', { years: years(d.h) }), money(d.panicReal), 'pvd__row--total') + '</div></div>' +
          '<div class="pvd__col pvd__col--discipline"><p class="pvd__head">' + icon('trend-up', 'ic--sm') + escapeHtml(t('pvd.discipline')) + '</p><div class="pvd__rows">' +
            row(t('pvd.disciplineHold'), money(d.dipValue)) +
            row(t('pvd.disciplineNote'), money(0)) +
            row(t('pvd.disciplineRest'), '+' + money(d.later)) +
            row(t('pvd.total', { years: years(d.h) }), money(d.disciplineReal), 'pvd__row--total') + '</div></div>' +
        '</div>' +
        (d.gap > 0 ? '<p class="pvd__gap">' + escapeHtml(t('pvd.gap', { amount: money(d.gap) })) + '</p>' : '') +
        '<p class="pvd__note">' + escapeHtml(t('pvd.note')) + '</p>' +
      '</section>';
    const anchor = els.mStage.querySelector('.answers');
    if (anchor) anchor.insertAdjacentHTML('afterend', html);
    else els.mStage.insertAdjacentHTML('beforeend', html);
    const card = document.getElementById('m-pvd');
    if (card) setTimeout(() => card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }), 320);
  }

  function setAnswersDisabled(disabled) {
    els.mStage.querySelectorAll('.answer, .myth__btns .btn, .fund__row').forEach((b) => { b.disabled = disabled; });
    const input = document.getElementById('m-input');
    if (input) input.disabled = disabled;
    const range = document.getElementById('m-alloc');
    if (range) range.disabled = disabled;
  }

  function openDrawer(o) {
    const d = els.mDrawer;
    d.dataset.tone = o.tone;
    setMood(els.mDrawerCora, o.tone === 'win' ? 'celebrating' : 'coaching');
    els.mDrawerTitle.textContent = o.title;
    els.mDrawerText.textContent = o.text || '';
    els.mDrawerAnswer.hidden = !o.answer;
    els.mDrawerAnswer.textContent = o.answer ? t('mission.yourAnswer', { a: o.answer.length > 140 ? o.answer.slice(0, 139) + '…' : o.answer }) : '';
    els.mDrawerPills.innerHTML = o.pills || '';
    els.mContinue.className = 'btn drawer__cta ' + (o.tone === 'win' ? 'btn--green' : 'btn--ink');
    els.mContinue.querySelector('[data-label]').textContent = o.cta || t('mission.continue');
    d.setAttribute('aria-hidden', 'false');
    els.mCheckbar.hidden = true;
    requestAnimationFrame(() => {
      d.classList.add('is-open');
      setTimeout(() => els.mContinue.focus({ preventScroll: true }), 260);
    });
  }
  function closeDrawer() {
    if (!els.mDrawer) return;
    els.mDrawer.classList.remove('is-open');
    els.mDrawer.setAttribute('aria-hidden', 'true');
    if (els.mCheckbar) els.mCheckbar.hidden = false;
  }

  function continueMission() {
    const m = state.mission;
    if (!m || m.phase !== 'feedback') return;
    const beat = currentBeat();
    if (m.retry) { renderBeat(); return; }
    if (m.practiceRetry) {
      m.phase = 'answer';
      m.practiceRetry = false;
      closeDrawer();
      setAnswersDisabled(false);
      setMood(sceneCora(), 'idle');
      updateCheck();
      renderMissionBar();
      return;
    }
    if (beat.kind === 'server' && state.turn.mission_completed) { finishMission(); return; }
    m.index += 1;
    if (m.index >= m.beats.length) { finishMission(); return; }
    renderBeat();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function awardPractice(kind, anchor) {
    const m = state.mission;
    if (m.practiceDone.has(kind)) return 0;
    m.practiceDone.add(kind);
    state.practiceXp += PRACTICE_XP;
    renderHud();
    xpFloat(PRACTICE_XP, anchor || els.mXpPill, 'green');
    return PRACTICE_XP;
  }
  function practiceFeedback(ok, kind, title, text, retryOnWrong) {
    const m = state.mission;
    m.phase = 'feedback';
    m.practiceRetry = !ok && !!retryOnWrong;
    const gained = ok ? awardPractice(kind) : 0;
    setMood(sceneCora(), ok ? 'celebrating' : 'coaching');
    openDrawer({
      tone: ok ? 'win' : 'coach', title, text,
      pills: '<span class="pill-xp">' + (gained ? '+' + gained + ' XP' : escapeHtml(t('mission.zeroXp'))) + '</span>',
      cta: m.practiceRetry ? t('mission.tryAgain') : t('mission.continue'),
    });
    if (ok) Sound.correct(); else Sound.retry();
    renderMissionBar();
  }

  // --- practice: cash split slider ---
  function allocContext() {
    const p = state.lastProfile || {};
    const a = state.session.safe_investment || {};
    const free = Number(p.free_cash) || (Number(a.emergency_savings_monthly) + Number(a.training_etf_monthly)) || 1000;
    const hasCushion = p.has_emergency_fund === true || a.plan_type === 'invest';
    const step = free >= 1000 ? 50 : 10;
    return { free, hasCushion, step, a };
  }
  function renderAllocBeat() {
    const m = state.mission;
    const c = allocContext();
    if (m.alloc == null) {
      const start = c.hasCushion ? c.free * 0.1 : c.free * 0.6;
      m.alloc = clamp(Math.round(start / c.step) * c.step, 0, c.free);
    }
    const msg = t(c.hasCushion ? 'alloc.msgCushion' : 'alloc.msgNoCushion', { free: money(c.free) });
    els.mStage.innerHTML =
      sceneHTML(msg, { question: t('alloc.q') }) +
      '<div class="card alloc">' +
        '<div class="range-wrap">' +
          '<span class="range-pill" id="m-alloc-pill"></span>' +
          '<label for="m-alloc" class="sr-only">' + escapeHtml(t('alloc.slider')) + '</label>' +
          '<input id="m-alloc" type="range" class="range" min="0" max="' + c.free + '" step="' + c.step + '" value="' + m.alloc + '">' +
          '<div class="scale-legend" aria-hidden="true"><span>' + money(0) + '</span><span>' + money(c.free) + '</span></div>' +
        '</div>' +
        '<div class="alloc__bars">' +
          allocRow('safe', c.hasCushion ? t('alloc.safeAlt') : t('alloc.safe')) +
          allocRow('grow', t('alloc.grow')) +
          allocRow('swing', t('alloc.swing')) +
        '</div>' +
        '<p class="alloc__note" id="m-alloc-note"></p>' +
      '</div>';
    updateAlloc();
  }
  function allocRow(key, label) {
    return '<div class="alloc__row"><span>' + escapeHtml(label) + '</span><span class="alloc__track"><span class="t-' + key + '" id="m-bar-' + key + '"></span></span><span class="alloc__val" id="m-val-' + key + '"></span></div>';
  }
  function updateAlloc() {
    const input = document.getElementById('m-alloc');
    if (!input) return;
    const c = allocContext();
    const etf = clamp(Number(input.value) || 0, 0, c.free);
    state.mission.alloc = etf;
    const share = c.free > 0 ? etf / c.free : 0;
    const safe = c.free - etf;
    setRangeFill(input, document.getElementById('m-alloc-pill'), t('alloc.pill', { amount: money(etf) }));
    const set = (key, pct, label) => {
      const bar = document.getElementById('m-bar-' + key);
      const val = document.getElementById('m-val-' + key);
      if (bar) bar.style.width = clamp(pct, 0, 100) + '%';
      if (bar) bar.style.borderRightColor = pct <= 0 ? 'transparent' : '';
      if (val) val.textContent = label;
    };
    set('safe', (1 - share) * 100, money(safe));
    set('grow', share * 100, Math.round(share * 100) + '%');
    set('swing', share * 100, Math.round(share * 100) + '%');
    const series = state.session.projection_series || [];
    const h = clamp(state.session.default_horizon_years || 10, 1, series.length || 1);
    const base = Number(c.a.recommended_monthly) || 0;
    const point = series[h - 1];
    // The annuity formula is linear in the monthly amount, so we scale the server projection.
    const value = point && base > 0 ? Math.round((point.etf_real_value * etf) / base) : 0;
    const note = document.getElementById('m-alloc-note');
    if (note) note.innerHTML = escapeHtml(t('alloc.note', { years: years(h), amount: '\u0000' })).replace('\u0000', '<b>' + escapeHtml(money(value)) + '</b>');
  }
  function checkAlloc() {
    const c = allocContext();
    const etf = state.mission.alloc || 0;
    let ok;
    let text;
    if (!c.hasCushion) {
      ok = etf <= c.free * 0.3 + 0.001;
      text = ok ? t('alloc.okNoCushion') : t('alloc.tooMuchNoCushion');
    } else {
      const lo = Number(c.a.min_monthly) || c.free * 0.3;
      const hi = Number(c.a.max_monthly) || c.free * 0.7;
      ok = etf >= lo && etf <= hi;
      text = ok ? t('alloc.okCushion') : etf < lo ? t('alloc.tooLowCushion') : t('alloc.tooHighCushion');
    }
    setAnswersDisabled(true);
    if (!ok) replayClass(els.mStage.querySelector('.alloc'), 'attn');
    practiceFeedback(ok, 'alloc', ok ? t('alloc.okTitle') : t('alloc.tryTitle'), text, true);
  }

  // --- practice: myth vs reality (rapid tap) ---
  function mythTopic() {
    const concern = (state.session && state.session.main_concern) || 'freeze_money';
    return { concern, answer: concern === 'lose_money' ? 'reality' : 'myth' };
  }
  function renderMythBeat() {
    const mt = mythTopic();
    els.mStage.innerHTML =
      sceneHTML(t('myth.intro')) +
      '<div class="myth" id="m-myth">' +
        '<span class="myth__tag">' + escapeHtml(t('myth.tag')) + '</span>' +
        '<p class="myth__quote">“' + escapeHtml(t('myth.' + mt.concern + '.s')) + '”</p>' +
        '<div class="myth__btns">' +
          '<button type="button" class="btn btn--ghost" data-action="myth" data-v="myth">' + icon('x') + escapeHtml(t('myth.myth')) + '</button>' +
          '<button type="button" class="btn btn--ghost" data-action="myth" data-v="reality">' + icon('check') + escapeHtml(t('myth.reality')) + '</button>' +
        '</div>' +
      '</div>';
  }
  function pickMyth(v, btn) {
    const m = state.mission;
    if (m.phase !== 'answer') return;
    const mt = mythTopic();
    const ok = v === mt.answer;
    const verdict = t(mt.answer === 'myth' ? 'myth.vMyth' : 'myth.vReality');
    setAnswersDisabled(true);
    btn.classList.remove('btn--ghost');
    btn.classList.add(ok ? 'btn--green' : 'btn--ink', 'is-picked');
    const card = document.getElementById('m-myth');
    if (!ok) replayClass(card, 'attn');
    practiceFeedback(ok, 'myth', t(ok ? 'myth.rightTitle' : 'myth.wrongTitle', { v: verdict }), t('myth.' + mt.concern + '.e'), false);
  }

  // --- practice: spot the detail (fund fees) ---
  function renderSpotBeat() {
    const pct = (v) => (state.lang === 'pl' ? v.replace('.', ',') : v) + '%';
    const rows = (side, companies, ter) =>
      '<button type="button" class="fund__row" data-action="spot" data-row="companies-' + side + '"><span>' + escapeHtml(t('spot.companies')) + '</span><b>' + formatNumber(companies) + '</b></button>' +
      '<button type="button" class="fund__row" data-action="spot" data-row="region-' + side + '"><span>' + escapeHtml(t('spot.region')) + '</span><b>' + escapeHtml(t('spot.regionVal')) + '</b></button>' +
      '<button type="button" class="fund__row" data-action="spot" data-row="ter-' + side + '"><span>' + escapeHtml(t('spot.ter')) + '</span><b>' + pct(ter) + '</b></button>' +
      '<button type="button" class="fund__row" data-action="spot" data-row="div-' + side + '"><span>' + escapeHtml(t('spot.div')) + '</span><b>' + escapeHtml(t('spot.divVal')) + '</b></button>';
    els.mStage.innerHTML =
      sceneHTML(t('spot.q'), { mood: 'idle' }) +
      '<div class="spot">' +
        '<div class="fund"><p class="fund__name">' + escapeHtml(t('spot.fundA')) + '</p>' + rows('a', 1500, '0.10') + '</div>' +
        '<div class="fund"><p class="fund__name">' + escapeHtml(t('spot.fundB')) + '</p>' + rows('b', 1450, '0.90') + '</div>' +
      '</div>';
    state.mission.spotPick = null;
  }
  function pickSpot(row, btn) {
    const m = state.mission;
    if (m.phase !== 'answer') return;
    m.spotPick = row;
    els.mStage.querySelectorAll('.fund__row').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    updateCheck();
  }
  function checkSpot() {
    const m = state.mission;
    const ok = /^ter-/.test(m.spotPick || '');
    const btn = els.mStage.querySelector('.fund__row[data-row="' + CSS.escape(m.spotPick || '') + '"]');
    if (btn) btn.classList.add(ok ? 'is-right' : 'is-wrong');
    if (!ok) {
      els.mStage.querySelectorAll('.fund__row[data-row^="ter-"]').forEach((b) => b.classList.add('is-right'));
      replayClass(els.mStage.querySelector('.spot'), 'attn');
    }
    setAnswersDisabled(true);
    practiceFeedback(ok, 'spot', t(ok ? 'spot.rightTitle' : 'spot.wrongTitle'), t(ok ? 'spot.right' : 'spot.wrong'), false);
  }

  function explainTopicForBeat() {
    const beat = currentBeat();
    const concern = (state.session && state.session.main_concern) || 'freeze_money';
    const byConcern = { freeze_money: 'cushion', no_time: 'etf', lose_money: 'diversification', too_late: 'inflation' };
    if (!beat) return 'general';
    if (beat.kind === 'alloc') return 'cushion';
    if (beat.kind === 'myth') return byConcern[concern];
    if (beat.kind === 'spot') return 'fees';
    if (state.day === 1) return beat.step === 1 ? 'diversification' : beat.step === 2 ? byConcern[concern] : 'dip';
    if (state.day === 2) return 'fees';
    if (state.day === 4) return 'etf';
    return 'general';
  }

  function markDayComplete() {
    state.completedDays.add(state.day);
    const server = state.turn && state.turn.completed_days;
    if (Array.isArray(server)) server.forEach((d) => { if (d >= 1 && d <= PLAYABLE_DAYS) state.completedDays.add(d); });
  }

  function finishMission() {
    closeDrawer();
    markDayComplete();
    state.summary = state.summary || freshSummary();
    renderDone({ animate: true });
    showScreen(SCREENS.DONE);
    Sound.fanfare();
    // Confetti exactly once per completed day (the only other moment: passing Checkpoint #1).
    if (!state.celebratedDays.has(state.day)) { state.celebratedDays.add(state.day); fireConfetti(); }
  }
  function openDone() {
    if (!state.turn || !state.turn.mission_completed) { renderHub(); showScreen(SCREENS.HUB); return; }
    renderDone({ animate: false });
    showScreen(SCREENS.DONE);
  }

  async function startDay(n, opts) {
    const o = opts || {};
    if (!state.session || state.busy) return false;
    state.busy = true;
    const token = state.token;
    try {
      const res = await withSessionRecovery((sid) => api.dayStart({ session_id: sid, day: n, lang: state.lang }));
      if (token !== state.token) return false;
      state.log.push({ kind: 'day', body: { day: n, lang: state.lang } });
      state.day = res.day || n;
      if (o.demo) state.gateBypass.add(state.day);
      state.turn = res.initial_mission_turn;
      state.dayLessons = res.micro_lessons || [];
      state.hubTab = 3;   // a new day opens on its own lessons
      state.mission = freshMissionState();
      state.summary = freshSummary();
      // Jumping ahead in Demo Mode: the skipped days count as done on the map.
      for (let d = 1; d < state.day; d++) state.completedDays.add(d);
      closeModal();
      renderHub();
      showScreen(SCREENS.HUB);
      updateTimeMachine(state.tm.year || state.session.default_horizon_years, { animate: false });
      Sound.pop();
      return true;
    } catch (err) {
      if (isRouteMissing(err)) toast(o.demo ? t('judges.noMultiDay') : t('hub.tomorrow', { n }), 'info', 4200);
      else toast(describeApiError(err), 'warn');
      return false;
    } finally {
      state.busy = false;
    }
  }

  function onNode(key, btn) {
    if (key === 'cp') {
      const st = checkpointState();
      if (st === 'locked') { replayClass(btn, 'attn'); toast(t('hub.lockedCp'), 'info', 2600); return; }
      openCheckpoint();
      return;
    }
    const d = Number(key);
    const st = nodeState(d);
    if (st === 'locked') { replayClass(btn, 'attn'); toast(t('hub.locked', { n: d - 1 }), 'info', 2600); return; }
    if (st === 'active') {
      if (!(state.mission && state.mission.started) && !dayDone(d) && !dayReady()) { gateBlocked(btn); return; }
      openMission();
      return;
    }
    if (st === 'next') { startDay(d); return; }
    if (st === 'done' && d === state.day) openDone();
  }

  // ------------------------------------------------------------------------
  // 13. Screen 4 — mission complete & real-world action bridge
  // ------------------------------------------------------------------------
  // Milestone titles mirror backend get_level_state() (docs/03 §2 pkt 4); copy lives in I18N.
  function levelFor(xp) {
    if (xp >= LEVEL_FLOOR[3]) return { level: 3, level_title: t('level.3'), next_level_xp: 500 };
    if (xp >= LEVEL_FLOOR[2]) return { level: 2, level_title: t('level.2'), next_level_xp: 250 };
    return { level: 1, level_title: t('level.1'), next_level_xp: 100 };
  }

  function renderDone(opts) {
    const tt = state.turn;
    if (!tt || !tt.mission_completed) return;
    const animate = !!(opts && opts.animate);
    const s = state.summary || (state.summary = freshSummary());
    const gs = tt.gamification || DEFAULT_G;
    const m = state.mission || freshMissionState();
    const earned = Math.max(0, gs.xp - m.xpAtStart - s.reward) + Math.max(0, state.practiceXp - m.practiceAtStart);
    const leveled = gs.leveled_up || s.leveledViaChallenge;
    const start = clamp(Number(tt.confidence_start) || 0, 0, 100);
    const score = clamp(Number(tt.confidence_score) || 0, start, 100);
    const nextFloor = gs.level >= 3 ? null : LEVEL_FLOOR[gs.level + 1];
    const before = state.lastProfile ? state.lastProfile.self_confidence_start : null;
    const startPlantXp = state.mission
      ? state.mission.xpAtStart + state.mission.practiceAtStart
      : (state.plantStageAtStart ? 0 : displayedXp());
    const startPlant = plantState(startPlantXp, false);
    const startStage = state.mission && state.mission.plantStageAtStart
      ? state.mission.plantStageAtStart
      : state.plantStageAtStart || startPlant.stage;
    const curPlant = plantState(displayedXp(), state.checkpointPassed);
    const grew = curPlant.stage > startStage;
    const growthText = grew
      ? t('garden.grew', { from: plantState(PLANT_STAGES[startStage - 1].fromXp, false).title, to: curPlant.title })
      : curPlant.stage === 5
        ? t('garden.complete')
        : t('garden.toNext', { xp: curPlant.toNext, title: curPlant.nextTitle });

    let nextCta;
    if (state.day < PLAYABLE_DAYS) nextCta = '<button type="button" class="btn btn--primary btn--lg" data-action="start-day" data-day="' + (state.day + 1) + '">' + escapeHtml(t('done.next', { n: state.day + 1 })) + icon('arrow-right') + '</button>';
    else if (!state.checkpointPassed) nextCta = '<button type="button" class="btn btn--primary btn--lg" data-action="open-checkpoint">' + icon('trophy') + escapeHtml(t('done.checkpoint')) + '</button>';
    else nextCta = '';

    const selfTiles = [1, 2, 3, 4, 5].map((n) =>
      '<label class="tile-wrap"><input type="radio" name="self_after" value="' + n + '" class="sr-only"' + (s.selfAfter === n ? ' checked' : '') + '><span class="tile tile--center">' + n + '</span></label>'
    ).join('');

    const milestone = leveled
      ? '<div class="badge-art' + (animate ? ' badge-pop' : '') + '" style="width:56px;margin-top:14px" title="' + escapeHtml(t('done.badgeLabel') + ': ' + gs.level_title) + '">' + badgeSVG(gs.level) + '</div>' +
        '<span class="levelup">' + icon('pillars', 'ic--sm') + escapeHtml(t('done.levelUp', { title: gs.level_title })) + '</span>'
      : nextFloor != null && displayedXp() < nextFloor
        ? '<span class="levelup levelup--quiet xp-detail">' + escapeHtml(t('done.toNext', { n: nextFloor - displayedXp() })) + '</span>'
        : '';
    const hero =
      '<div class="card card--raised win">' +
        coraHTML('celebrating') +
        '<h1 class="h1 win__title">' + escapeHtml(t('done.title', { d: state.day })) + '</h1>' +
        '<div class="garden garden--done">' +
          plantSVG(curPlant.stage, grew ? 'plant--grow' : '') +
          '<div><p class="garden__label">' + escapeHtml(grew ? growthText : t('garden.current')) + '</p>' +
          '<p class="garden__stage">' + escapeHtml(curPlant.title) + '</p>' +
          '<p class="garden__desc">' + escapeHtml(grew ? curPlant.quote : (state.calm ? curPlant.quote : growthText)) + '</p></div>' +
        '</div>' +
        '<div class="win__xp xp-detail">' + icon('chart', 'ic--sm') + '<span><span data-earned="' + earned + '">+' + (animate ? 0 : earned) + '</span> XP</span> <span>' + escapeHtml(t('done.earned')) + '</span></div>' +
        '<div>' + milestone + '</div>' +
        '<div class="win__row">' +
          '<div><p class="win__label">' + escapeHtml(t(state.calm ? 'hud.readinessCalm' : 'done.readiness')) + '</p>' +
            '<p class="win__big">' + start + '% <span aria-hidden="true">→</span><span class="sr-only">,</span> <span data-ready-target="' + score + '">' + (animate ? start : score) + '</span>%</p>' +
            '<div class="meter meter--lg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + score + '" aria-label="' + escapeHtml(t('done.readiness')) + '" style="margin-top:8px">' +
              '<div class="meter__fill" data-ready-fill="' + score + '" style="width:' + (animate ? start : score) + '%"></div></div>' +
            '<p class="tiny muted" style="margin-top:6px">' + escapeHtml(t('done.readinessNote')) + '</p></div>' +
          '<fieldset><legend class="win__label">' + escapeHtml(t('done.selfQ')) + '</legend>' +
            '<div class="selfscale">' + selfTiles + '</div>' +
            '<p class="small strong" id="self-compare" style="margin-top:8px" aria-live="polite">' + escapeHtml(selfCompare(before, s.selfAfter)) + '</p></fieldset>' +
        '</div>' +
        '<div class="win__actions">' + nextCta +
          '<button type="button" class="btn btn--ghost btn--lg" data-action="go-home">' + icon('arrow-right', 'ic--flip') + escapeHtml(t('done.toMap')) + '</button></div>' +
        '<p class="small done-streak">' + icon('calendar-check', 'ic--sm') + '<span>' + escapeHtml(t('done.streak')) + '</span></p>' +
      '</div>';

    // Below the result: two calm tabs instead of a wall of cards (Issue #44).
    const tab = s.doneTab === 'more' ? 'more' : 'today';
    const tabBtn = (id, label, n) =>
      '<button type="button" class="step-tab" role="tab" id="done-tab-' + id + '" aria-controls="done-panel-' + id + '" aria-selected="' + (tab === id) + '"' +
        (tab === id ? '' : ' tabindex="-1"') + ' data-action="done-tab" data-tab="' + id + '">' +
        '<span class="step-tab__n">' + n + '</span><span class="step-tab__label">' + escapeHtml(label) + '</span></button>';
    els.doneRoot.innerHTML =
      hero +
      '<div class="steps steps--done" role="tablist" aria-label="' + escapeHtml(t('done.tabs')) + '">' +
        tabBtn('today', t('done.tabToday'), 1) + tabBtn('more', t('done.tabMore'), 2) + '</div>' +
      '<div class="done-panel done-panel--today" id="done-panel-today" role="tabpanel" aria-labelledby="done-tab-today"' + (tab === 'today' ? '' : ' hidden') + '>' +
        '<div class="complete-grid"><div id="done-first"></div><div class="card" id="done-bank"></div></div>' +
      '</div>' +
      '<div class="done-panel" id="done-panel-more" role="tabpanel" aria-labelledby="done-tab-more"' + (tab === 'more' ? '' : ' hidden') + '>' +
        '<div class="complete-grid"><div class="card" id="done-check"></div><div class="card" id="done-board"></div></div>' +
        '<div class="card after14 after14--wide" style="margin-top:22px"><h3 class="card__title">' + escapeHtml(t('hub.after14.title')) + '</h3>' +
          '<p class="small" style="color:var(--ink-2);margin-top:4px">' + escapeHtml(t('hub.after14.sub')) + '</p>' +
          '<div class="after14__grid">' + after14Paths().map((p) =>
            '<div class="after14__tile">' + icon(p.icon || 'chat') + '<h4 style="margin-top:8px">' + escapeHtml(p.title) + '</h4><p>' + escapeHtml(p.description || '') + '</p>' +
            '<p class="strong" style="color:var(--ink-2)">' + escapeHtml(p.cadence || '') + '</p></div>').join('') + '</div></div>' +
      '</div>' +
      '<div class="compliance"><p>' + escapeHtml(t('compliance.mifid')) + '</p><p>' + escapeHtml(t('ai.disclaimer')) + '</p></div>';

    renderFirstStep();
    renderChecklist();
    renderBankCard();
    renderBoard();

    if (animate) {
      animateNumber(els.doneRoot.querySelector('[data-earned]'), 0, earned, { duration: 1100, format: (v) => '+' + formatNumber(v) });
      const fill = els.doneRoot.querySelector('[data-ready-fill]');
      const val = els.doneRoot.querySelector('[data-ready-target]');
      // A short timeout (not rAF) so the start width paints first and the end state
      // is always reached, even when the tab is throttled.
      setTimeout(() => {
        if (fill) fill.style.width = score + '%';
        animateNumber(val, start, score, { duration: 1100, format: (v) => String(Math.round(v)) });
      }, 80);
    }
  }
  function selfCompare(before, after) {
    if (after == null) return before != null ? t('done.selfBefore', { n: before }) : '';
    return t('done.selfCompare', { a: before != null ? before : '?', b: after });
  }

  function checklistState() {
    const items = (state.turn && state.turn.final_checklist) || [];
    const done = items.filter((i) => state.summary.checked.has(i.id)).length;
    return { items, done, all: items.length > 0 && done === items.length };
  }
  function bankButton(all, extraStyle) {
    if (!state.turn.bank_draft) return '';
    return '<button type="button" class="btn btn--ink btn--block' + (all ? ' glow-pulse' : '') + '" data-action="open-bank" style="' + (extraStyle || 'margin-top:18px') + '">' +
      icon('landmark') + escapeHtml(t('first.toBank')) + '</button>';
  }
  function showDoneTab(id) {
    state.summary.doneTab = id === 'more' ? 'more' : 'today';
    ['today', 'more'].forEach((k) => {
      const panel = document.getElementById('done-panel-' + k);
      const tab = document.getElementById('done-tab-' + k);
      const on = k === state.summary.doneTab;
      if (panel) panel.hidden = !on;
      if (tab) { tab.setAttribute('aria-selected', String(on)); if (on) tab.removeAttribute('tabindex'); else tab.setAttribute('tabindex', '-1'); }
    });
  }

  function renderFirstStep() {
    const tt = state.turn;
    const c = tt.real_world_challenge;
    const s = state.summary;
    const all = checklistState().all;
    const challenge = c
      ? '<div class="challenge">' +
          '<span class="chip chip--tangerine">' + icon('target', 'ic--sm') + escapeHtml(t('first.challenge')) + '</span>' +
          '<h3 class="h3" style="margin-top:10px">' + escapeHtml(c.title) + '</h3>' +
          '<p class="small" style="margin-top:6px;color:var(--ink-2)">' + escapeHtml(c.description) + '</p>' +
          (c.amount_pln > 0 ? '<p class="challenge__amount"><b>' + escapeHtml(money(c.amount_pln)) + '</b>' + icon('arrow-right', 'ic--sm') + escapeHtml(c.target_account) + '</p>'
            : '<p class="challenge__amount">' + icon('landmark', 'ic--sm') + escapeHtml(c.target_account) + '</p>') +
          '<div style="margin-top:14px">' + (s.accepted
            ? '<span class="chip chip--green" role="status" style="min-height:44px;padding:0 16px">' + icon('check', 'ic--sm') + escapeHtml(t('first.accepted')) + (s.reward ? ' +' + s.reward + ' XP' : '') + '</span>'
            : '<button type="button" class="btn btn--primary" data-action="accept-challenge"' + (s.challengeBusy ? ' disabled' : '') + '>' +
                (s.challengeBusy ? '<span class="spinner"></span>' : icon('check')) + escapeHtml(t('first.accept', { n: c.reward_xp })) + '</button>') + '</div>' +
        '</div>'
      : '';
    document.getElementById('done-first').innerHTML =
      '<div class="card firststep">' +
        '<h2 class="h2">' + escapeHtml(t('first.title')) + '</h2>' +
        '<p class="small" style="margin-top:6px;color:var(--ink-2);max-width:46ch">' + escapeHtml(t('first.sub')) + '</p>' +
        challenge + bankButton(all) +
      '</div>';
  }

  function renderChecklist() {
    const box = document.getElementById('done-check');
    const { items, done, all } = checklistState();
    if (!items.length) { box.hidden = true; return; }
    box.hidden = false;
    const s = state.summary;
    const checks = items.map((i) =>
      '<button type="button" class="check" role="checkbox" aria-checked="' + s.checked.has(i.id) + '" data-action="toggle-check" data-id="' + escapeHtml(i.id) + '">' +
        '<span class="check__box">' + icon('check') + '</span>' +
        '<span><span class="check__text">' + escapeHtml(i.text) + '</span><span class="check__detail">' + escapeHtml(i.detail) + '</span></span>' +
      '</button>'
    ).join('');
    box.innerHTML =
      '<div class="card__head"><h3 class="card__title">' + escapeHtml(t('first.checklist')) + '</h3>' +
        '<span class="strong num"><span data-check-count>' + done + '</span>/' + items.length + '</span></div>' +
      '<div class="meter" style="margin-top:8px" aria-hidden="true"><div class="meter__fill" data-check-bar style="width:' + (done / items.length) * 100 + '%"></div></div>' +
      '<div class="checks">' + checks + '</div>' +
      '<div data-check-done' + (all ? '' : ' hidden') + '><p class="small strong" style="margin-top:12px;color:var(--green-text)">' + escapeHtml(t('first.allDone')) + '</p>' +
        bankButton(true, 'margin-top:10px') + '</div>';
  }

  async function acceptChallenge() {
    const s = state.summary;
    const tt = state.turn;
    if (!tt || !tt.real_world_challenge || s.accepted || s.challengeBusy) return;
    const token = state.token;
    s.challengeBusy = true;
    renderFirstStep();
    try {
      const body = { day: state.day, lang: state.lang };
      const res = await withSessionRecovery((sid) => api.challenge(Object.assign({ session_id: sid }, body)));
      if (token !== state.token) return;
      state.log.push({ kind: 'challenge', body });
      state.completedChallenges.add(state.day);
      const before = tt.gamification || DEFAULT_G;
      const plantBefore = plantState(displayedXp(), state.checkpointPassed).stage;
      const lvl = levelFor(res.xp);
      const crossed = lvl.level > before.level;
      state.turn = Object.assign({}, tt, { gamification: Object.assign({}, before, lvl, { xp: res.xp, xp_gained: res.reward_xp }) });
      s.challengeBusy = false;
      s.accepted = true;
      s.reward = res.reward_xp;
      s.leaderboard = Array.isArray(res.leaderboard) ? res.leaderboard : s.leaderboard;
      if (crossed) s.leveledViaChallenge = true;
      renderHud();
      const curPlant = plantState(displayedXp(), state.checkpointPassed);
      const plantGrew = curPlant.stage > plantBefore;
      renderGardenCard({ grow: plantGrew });
      if (crossed || plantGrew) renderDone({ animate: false });
      else { renderFirstStep(); renderBoard(true); }
      const anchor = document.querySelector('#done-first .chip--green') || els.hudXpPill;
      xpFloat(res.reward_xp, anchor, 'green');
      Sound.correct();
    } catch (err) {
      if (token !== state.token) return;
      s.challengeBusy = false;
      renderFirstStep();
      toast(isSessionMissing(err) ? t('toast.sessionLost') : describeApiError(err), 'warn');
    }
  }

  function toggleCheck(id, btn) {
    const tt = state.turn;
    const items = (tt && tt.final_checklist) || [];
    if (!items.some((i) => i.id === id)) return;
    const s = state.summary;
    if (s.checked.has(id)) s.checked.delete(id); else s.checked.add(id);
    btn.setAttribute('aria-checked', String(s.checked.has(id)));
    const root = document.getElementById('done-check');
    const done = items.filter((i) => s.checked.has(i.id)).length;
    const all = done === items.length;
    root.querySelector('[data-check-count]').textContent = String(done);
    root.querySelector('[data-check-bar]').style.width = (done / items.length) * 100 + '%';
    root.querySelector('[data-check-done]').hidden = !all;
    const bank = document.querySelector('#done-first [data-action="open-bank"]');
    if (bank) bank.classList.toggle('glow-pulse', all);
    if (s.checked.has(id)) Sound.pop();
    if (all && !s.celebrated) { s.celebrated = true; Sound.fanfare(); }
  }

  function renderBankCard() {
    const tt = state.turn;
    const d = tt.bank_draft;
    const box = document.getElementById('done-bank');
    if (!d) { box.hidden = true; return; }
    box.hidden = false;
    const c = tt.real_world_challenge;
    const a = state.session.safe_investment || {};
    const savingsFirst = a.plan_type === 'savings_first';
    const cushion = Number(a.emergency_savings_monthly) || 0;
    const step = (n, label, html) =>
      '<li class="plan-step"><span class="plan-step__n">' + n + '</span><div><p class="plan-step__label">' + escapeHtml(label) + '</p>' + html + '</div></li>';
    const today = c ? '<p class="strong">' + escapeHtml(c.amount_pln > 0 ? t('bankcard.micro', { amount: money(c.amount_pln), account: c.target_account }) : c.target_account) + '</p>' : '';
    const target = savingsFirst
      ? '<p class="strong">' + escapeHtml(t('bankcard.cushion', { amount: money(cushion) })) + '</p><p class="small muted">' + escapeHtml(t('bankcard.etfLater', { amount: money(d.monthly_amount) })) + '</p>'
      : '<p class="strong">' + escapeHtml(t('bankcard.monthly', { amount: money(d.monthly_amount), years: years(d.horizon_years) })) + '</p>' +
        '<p class="small muted">' + escapeHtml(d.instrument_category) + '</p>' +
        (cushion > 0 ? '<p class="small muted">' + escapeHtml(t('bankcard.parallel', { amount: money(cushion) })) + '</p>' : '');
    box.innerHTML =
      '<div class="card__head"><h3 class="card__title">' + escapeHtml(t('bankcard.title')) + '</h3><span class="chip chip--ink">' + escapeHtml(t('bankcard.demo')) + '</span></div>' +
      '<ol class="plan-steps">' + step(1, t('bankcard.today'), today) + step(2, t('bankcard.day14'), target) + '</ol>' +
      '<div class="plan-num"><p class="tiny muted" style="grid-column:1/-1">' + escapeHtml(t(savingsFirst ? 'bankcard.estimateLater' : 'bankcard.estimate', { years: years(d.horizon_years) })) + '</p>' +
        '<div><span class="tiny strong" style="color:var(--green-text)">' + escapeHtml(t('bankcard.etfReal')) + '</span><b>' + escapeHtml(money(d.projected_etf_real_value)) + '</b></div>' +
        '<div><span class="tiny strong" style="color:var(--coral-text)">' + escapeHtml(t('bankcard.cashReal')) + '</span><b>' + escapeHtml(money(d.projected_cash_real_value)) + '</b></div>' +
        '<p class="tiny muted" style="grid-column:1/-1">' + escapeHtml(t('bankcard.nominal', { amount: money(d.projected_etf_nominal_value) })) + '</p></div>' +
      '<p class="tiny muted" style="margin-top:10px">' + escapeHtml(d.assumptions_text) + ' ' + escapeHtml(d.costs_note) + '</p>';
  }

  function renderBoard(highlight) {
    const tt = state.turn;
    // The HUD shows server XP + local lesson/practice XP, so "You" uses the same number
    // and the board is re-ranked locally (one consistent XP everywhere on screen).
    const bonus = bonusXp();
    const rows = (state.summary.leaderboard || tt.leaderboard || [])
      .map((r) => (r.is_current_user ? Object.assign({}, r, { xp: r.xp + bonus }) : r))
      .sort((a, b) => b.xp - a.xp)
      .map((r, i) => Object.assign({}, r, { rank: i + 1 }));
    const box = document.getElementById('done-board');
    if (!rows.length) { box.hidden = true; return; }
    box.hidden = false;
    const leveled = (tt.gamification && tt.gamification.leveled_up) || state.summary.leveledViaChallenge;
    const me = rows.find((r) => r.is_current_user);
    const leader = rows[0];
    const list = rows.map((r) => {
      const isMe = r.is_current_user === true;
      const name = isMe ? (state.userName || String(r.name).replace(/\s*\((Level Up!|Awans!)\)\s*$/, '')) : r.name;
      return '<li class="' + (isMe ? 'is-me' : '') + '"' + (isMe ? ' data-me' : '') + '>' +
        '<span class="board__rank">' + escapeHtml(r.rank) + '</span>' +
        '<span><span class="board__name">' + escapeHtml(name) + (isMe && leveled ? ' <span class="chip chip--green" style="min-height:24px;padding:0 8px;font-size:.7rem">' + escapeHtml(t('board.levelUp')) + '</span>' : '') + '</span>' +
          '<span class="board__lvl">' + escapeHtml(r.level_title) + '</span></span>' +
        '<span class="board__streak" title="' + escapeHtml(t('hud.streakTitle')) + '">' + icon('calendar-check', 'ic--sm') + escapeHtml(r.streak_days) + '</span>' +
        '<span class="board__xp">' + escapeHtml(formatNumber(r.xp)) + ' XP</span></li>';
    }).join('');
    const hint = me && leader && !leader.is_current_user ? t('board.gap', { n: formatNumber(leader.xp - me.xp) }) : me ? t('board.lead') : '';
    box.innerHTML =
      '<div class="card__head"><h3 class="card__title">' + escapeHtml(t('board.title')) + '</h3><span class="tiny muted">' + escapeHtml(t('board.demo')) + '</span></div>' +
      '<ol class="board">' + list + '</ol>' +
      (hint ? '<p class="small strong" style="margin-top:12px;color:var(--ink-2)" aria-live="polite">' + escapeHtml(hint) + '</p>' : '') +
      '<button type="button" class="btn btn--ghost btn--sm" data-action="challenge-friend" style="margin-top:12px">' + icon('users', 'ic--sm') + escapeHtml(t('board.challenge')) + '</button>';
    if (highlight) { const row = box.querySelector('[data-me]'); if (row) replayClass(row, 'flash'); }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall back */ }
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
    } catch (e) { return false; }
  }
  async function challengeFriend() {
    const text = t('board.invite', { d: state.day, xp: displayedXp() });
    const ok = await copyText(text);
    toast(ok ? t('board.copied') : t('board.copyFail', { text }), ok ? 'ok' : 'warn', ok ? 3000 : 6000);
  }

  // Bank modal — zero-friction handoff (DEMO)
  function renderBankModal() {
    const tt = state.turn;
    if (!tt) return;
    const s = state.summary;
    const c = tt.real_world_challenge;
    const d = tt.bank_draft;
    const a = state.session.safe_investment || {};
    const box = els.bankContent;
    if (s.bankDone) {
      const what = s.bankOption === 'b'
        ? t('bank.whatB', { amount: money(a.plan_type === 'savings_first' ? a.emergency_savings_monthly : d ? d.monthly_amount : 0) })
        : c ? t('bank.whatA', { amount: money(c.amount_pln), account: c.target_account }) : '';
      box.innerHTML =
        '<div style="text-align:center" role="status">' + coraHTML('celebrating') +
          '<p class="h3" style="margin-top:12px">' + escapeHtml(t('bank.success', { d: state.day })) + '</p>' +
          '<p class="small muted" style="margin-top:8px">' + escapeHtml(t('bank.successNote', { what })) + '</p>' +
          '<button type="button" class="btn btn--primary btn--block" data-action="next-gen" style="margin-top:20px">' + icon('users') + escapeHtml(t('bank.nextGen')) + '</button>' +
          '<button type="button" class="btn btn--ghost btn--block" data-action="close-modal" style="margin-top:10px">' + escapeHtml(t('common.close')) + '</button>' +
        '</div>';
      const cora = box.querySelector('.cora');
      if (cora) { cora.style.setProperty('--cora-size', '56px'); cora.style.margin = '0 auto'; }
      return;
    }
    const optB = a.plan_type === 'savings_first'
      ? escapeHtml(t('bank.optBSavings', { amount: money(a.emergency_savings_monthly || 0), etf: money(d ? d.monthly_amount : 0) }))
      : escapeHtml(t('bankcard.monthly', { amount: money(d ? d.monthly_amount : 0), years: years(d ? d.horizon_years : 0) })) + '<br><span class="tiny muted">' + escapeHtml(d ? d.instrument_category : '') + '</span>';
    const option = (value, title, badge, body) =>
      '<label class="option"><input type="radio" name="bank_option" value="' + value + '" class="sr-only"' + (s.bankOption === value ? ' checked' : '') + '>' +
        '<span class="tile"><span class="radio-dot" aria-hidden="true"></span><span><span class="strong">' + escapeHtml(title) + '</span> ' + badge +
        '<span class="small" style="display:block;margin-top:4px;font-weight:600;color:var(--ink-2)">' + body + '</span></span></span></label>';
    box.innerHTML =
      '<div class="bank-head"><span><span class="bank-head__mark">' + icon('landmark', 'ic--sm') + '</span>Commerzbank</span><span class="chip chip--yellow" style="min-height:26px">DEMO</span></div>' +
      '<p class="trust-note" style="margin-top:12px">' + icon('shield', 'ic--sm') + '<span>' + escapeHtml(t('bank.noTransfer')) + ' <span class="muted" style="font-weight:500">' + escapeHtml(t('bank.preview')) + '</span></span></p>' +
      '<fieldset style="margin-top:14px"><legend class="small strong">' + escapeHtml(t('bank.choose')) + '</legend><div class="tiles" style="margin-top:8px">' +
        option('a', t('bank.optA'), '<span class="chip chip--green" style="min-height:24px;padding:0 8px;font-size:.7rem">' + escapeHtml(t('bank.recommended')) + '</span>',
          c ? escapeHtml(c.amount_pln > 0 ? t('bank.transfer', { amount: money(c.amount_pln), account: c.target_account }) : c.title) : '') +
        option('b', t('bank.optB'), '', optB) +
      '</div></fieldset>' +
      '<p class="kyc">' + icon('shield', 'ic--sm') + '<span>' + escapeHtml(t('bank.kyc')) + '</span></p>' +
      '<button type="button" class="btn btn--primary btn--block btn--lg" data-action="simulate-bank" style="margin-top:18px">' + escapeHtml(t('bank.simulate')) + '</button>' +
      '<p class="tiny muted" style="margin-top:8px;text-align:center">' + escapeHtml(t('bank.noTransfer')) + '</p>';
  }
  function openBank() {
    if (!state.turn || !state.turn.mission_completed) return;
    state.summary.bankDone = false;
    renderBankModal();
    openModal('modal_bank_order');
  }
  function simulateBank() {
    state.summary.bankDone = true;
    renderBankModal();
    Sound.pop();
    const next = els.bankContent.querySelector('[data-action="next-gen"]');
    if (next) next.focus();
  }
  function nextGeneration() {
    closeModal();
    const next = NEXT_STAGE[state.stageId] || 'pre';
    selectStage(next);
  }

  // ------------------------------------------------------------------------
  // 14. Checkpoint #1 (after Day 4)
  // ------------------------------------------------------------------------
  function checkpointQuestions() {
    return (state.session && state.session.checkpoint_questions) || [];
  }
  function openCheckpoint() {
    const qs = checkpointQuestions();
    if (!qs.length) { toast(t('cp.unavailable'), 'info', 3600); return; }
    state.cp = { i: 0, answers: {}, result: null, busy: false };
    renderCheckpoint();
    showScreen(SCREENS.CHECKPOINT);
  }
  function renderCheckpoint() {
    const cp = state.cp;
    const qs = checkpointQuestions();
    if (!cp || !qs.length) return;
    const total = qs.length;
    const top =
      '<div class="mbar"><div class="wrap wrap--narrow"><div class="mbar__row">' +
        '<button type="button" class="icon-btn" data-action="go-home" aria-label="' + escapeHtml(t('common.close')) + '">' + icon('x') + '</button>' +
        '<div class="progress" aria-hidden="true"><div class="progress__fill" style="width:' + ((cp.result ? total : cp.i) / total) * 100 + '%"></div></div>' +
        '<span class="mbar__xp">' + icon('trophy') + escapeHtml(t('hub.checkpoint')) + '</span>' +
      '</div></div></div>';
    if (cp.result) {
      const r = cp.result;
      const checkpointPlant = r.passed ? plantState(displayedXp(), true) : plantState(displayedXp(), state.checkpointPassed);
      const items = (r.results || []).map((x, i) => {
        const q = qs.find((qq) => qq.id === x.id) || qs[i] || { question: '' };
        return '<li class="quiz-item ' + (x.correct ? 'is-right' : 'is-wrong') + '">' + icon(x.correct ? 'check' : 'x') +
          '<div><p class="strong">' + escapeHtml(q.question) + '</p><p class="small" style="margin-top:4px;color:var(--ink-2)">' +
          escapeHtml((x.correct ? t('cp.correct') : t('cp.incorrect')) + '. ' + x.explanation) + '</p></div></li>';
      }).join('');
      els.cpRoot.innerHTML = top +
        '<div class="wrap wrap--narrow"><div class="card card--raised quiz-result" style="margin-top:12px">' +
          coraHTML(r.passed ? 'celebrating' : 'coaching') +
          '<p class="quiz-score" style="margin-top:8px">' + escapeHtml(r.score_pct) + '%</p>' +
          '<p class="h2" style="margin-top:6px">' + escapeHtml(r.badge_title) + '</p>' +
          (r.passed ? '<div class="badge-art badge-pop" style="margin-top:14px;width:64px">' + badgeSVG(levelFor(r.xp).level) + '</div>' : '') +
          (r.passed ? '<div class="garden garden--checkpoint">' + plantSVG(checkpointPlant.stage, 'plant--grow') + '<div><p class="garden__label">' + escapeHtml(t('garden.stageLabel', { stage: checkpointPlant.stage })) + '</p><p class="garden__stage">' + escapeHtml(checkpointPlant.title) + '</p><p class="garden__desc">' + escapeHtml(checkpointPlant.quote) + '</p></div></div>' : '') +
          (r.reward_xp ? '<p style="margin-top:10px"><span class="pill-xp">+' + escapeHtml(r.reward_xp) + ' XP</span></p>' : '') +
          '<ul class="quiz-list">' + items + '</ul>' +
          '<div class="win__actions">' +
            (!r.passed ? '<button type="button" class="btn btn--primary" data-action="open-checkpoint">' + escapeHtml(t('cp.retry')) + '</button>' : '') +
            '<button type="button" class="btn btn--ghost" data-action="go-home">' + escapeHtml(t('cp.back')) + '</button>' +
          '</div></div></div>';
      return;
    }
    const q = qs[cp.i];
    const picked = cp.answers[q.id];
    const last = cp.i === total - 1;
    els.cpRoot.innerHTML = top +
      '<div class="wrap wrap--narrow">' +
        '<div class="scene">' + coraHTML('idle') + '<div class="bubble"><p class="scene__who">' + escapeHtml(t('cp.q', { i: cp.i + 1, n: total })) + '</p>' +
          '<p class="scene__q" style="margin-top:0">' + escapeHtml(q.question) + '</p>' +
          (cp.i === 0 ? '<p class="small" style="margin-top:8px;color:var(--ink-2)">' + escapeHtml(t('cp.sub')) + '</p>' : '') + '</div></div>' +
        '<div class="answers">' + (q.options || []).map((o, i) =>
          '<button type="button" class="answer" data-action="cp-pick" data-id="' + escapeHtml(o.id) + '" aria-pressed="' + (picked === o.id) + '" style="grid-template-columns:auto 1fr">' +
            '<span class="answer__icon">' + 'ABCD'.charAt(i) + '</span><span>' + escapeHtml(o.text) + '</span></button>').join('') + '</div>' +
        '<div style="margin-top:22px;display:flex;justify-content:flex-end">' +
          '<button type="button" class="btn btn--primary btn--lg" data-action="' + (last ? 'cp-submit' : 'cp-next') + '"' + (picked ? '' : ' disabled') + '>' +
            (cp.busy ? '<span class="spinner"></span>' : '') + escapeHtml(last ? t('cp.submit') : t('cp.next')) + '</button></div>' +
      '</div>';
  }
  function cpPick(id) {
    const cp = state.cp;
    const q = checkpointQuestions()[cp.i];
    if (!q || cp.busy) return;
    cp.answers[q.id] = id;
    renderCheckpoint();
  }
  async function cpSubmit() {
    const cp = state.cp;
    if (!cp || cp.busy) return;
    cp.busy = true;
    renderCheckpoint();
    const token = state.token;
    try {
      const body = { answers: Object.assign({}, cp.answers), lang: state.lang };
      const res = await withSessionRecovery((sid) => api.checkpoint(Object.assign({ session_id: sid }, body)));
      if (token !== state.token) return;
      state.log.push({ kind: 'checkpoint', body });
      cp.result = res;
      if (res.passed) state.checkpointPassed = true;
      if (res.passed) renderGardenCard({ grow: true });
      const before = g();
      if (state.turn && typeof res.xp === 'number') {
        state.turn = Object.assign({}, state.turn, { gamification: Object.assign({}, before, levelFor(res.xp), { xp: res.xp, xp_gained: res.reward_xp || 0, leveled_up: !!res.leveled_up }) });
      }
      if (Array.isArray(res.leaderboard) && state.summary) state.summary.leaderboard = res.leaderboard;
      renderHud();
      if (res.passed) { Sound.fanfare(); fireConfetti(); } else Sound.retry();
    } catch (err) {
      if (token !== state.token) return;
      toast(isRouteMissing(err) ? t('cp.unavailable') : describeApiError(err), 'warn');
    } finally {
      cp.busy = false;
      renderCheckpoint();
    }
  }

  // ------------------------------------------------------------------------
  // 15. Ask Atlas — explain simpler with a real-life example + mini drill
  // ------------------------------------------------------------------------
  function localExplain(question, topicKey) {
    let key = topicKey && EXPLAIN_LOCAL.en[topicKey] ? topicKey : null;
    if (!key) {
      const hit = EXPLAIN_PATTERNS.find((p) => p[1].test(question || ''));
      key = hit ? hit[0] : 'general';
    }
    const d = (EXPLAIN_LOCAL[state.lang] || EXPLAIN_LOCAL.en)[key];
    return { simple_explanation: d.s, real_life_example: d.e, drill_question: d.q, drill_options: d.o.slice(), correct_option_index: d.c, drill_feedback: d.f, is_fallback: true };
  }
  function validExplain(r) {
    return r && typeof r.simple_explanation === 'string' && Array.isArray(r.drill_options) && r.drill_options.length === 3 &&
      Number.isInteger(r.correct_option_index) && r.correct_option_index >= 0 && r.correct_option_index <= 2;
  }
  let coraReturnFocus = null;
  function openCora(opts) {
    const o = opts || {};
    coraReturnFocus = document.activeElement;
    els.coraSheet.hidden = false;
    document.body.classList.add('no-scroll');
    state.cora.result = null;
    state.cora.picked = null;
    renderCoraBody();
    if (o.topic || o.question) askCora(o.question || o.label || o.topic, o.topic);
    else setTimeout(() => { const i = document.getElementById('cora-input'); if (i) i.focus(); }, 60);
  }
  function closeCora() {
    if (!els.coraSheet || els.coraSheet.hidden) return;
    els.coraSheet.hidden = true;
    document.body.classList.remove('no-scroll');
    if (coraReturnFocus && typeof coraReturnFocus.focus === 'function') coraReturnFocus.focus();
    coraReturnFocus = null;
  }
  function renderCoraBody() {
    const c = state.cora;
    setMood(els.coraSheetCora, c.busy ? 'thinking' : c.result && c.picked != null ? (c.picked === c.result.correct_option_index ? 'celebrating' : 'coaching') : 'idle');
    const chips = '<div><p class="small strong" style="margin-bottom:8px">' + escapeHtml(t('cora.topics')) + '</p><div class="topic-chips">' +
      EXPLAIN_TOPICS.map((k) => '<button type="button" data-action="cora-topic" data-topic="' + k + '">' + escapeHtml(t('cora.topic.' + k)) + '</button>').join('') + '</div></div>';
    const form =
      '<form id="cora-form"><label for="cora-input" class="small strong" style="display:block;margin-bottom:8px">' + escapeHtml(t('cora.label')) + '</label>' +
        '<div class="ask-row"><textarea id="cora-input" class="textarea" rows="2" maxlength="400" placeholder="' + escapeHtml(t('cora.placeholder')) + '">' + escapeHtml(c.question || '') + '</textarea>' +
        '<button type="submit" class="btn btn--primary" ' + (c.busy ? 'disabled' : '') + '>' + (c.busy ? '<span class="spinner"></span>' : icon('send')) + '<span class="sr-only">' + escapeHtml(t('cora.send')) + '</span></button></div></form>';
    if (c.busy) {
      els.coraBody.innerHTML = form + '<p class="strong" role="status">' + escapeHtml(t('cora.thinking')) + '<span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span></p>';
      return;
    }
    if (!c.result) { els.coraBody.innerHTML = form + chips; return; }
    const r = c.result;
    const answered = c.picked != null;
    const opts = r.drill_options.map((o, i) => {
      let cls = '';
      if (answered && i === r.correct_option_index) cls = ' is-right';
      else if (answered && i === c.picked) cls = ' is-wrong';
      return '<button type="button" class="answer' + cls + '" data-action="cora-drill" data-i="' + i + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="answer__key" aria-hidden="true">' + 'ABC'.charAt(i) + '</span><span>' + escapeHtml(o) + '</span></button>';
    }).join('');
    els.coraBody.innerHTML =
      (r.is_fallback ? '<span class="chip chip--soft" style="justify-self:start">' + icon('info', 'ic--sm') + escapeHtml(t('cora.offline')) + '</span>' : '') +
      '<div class="explain-block"><h4>' + icon('chat', 'ic--sm') + escapeHtml(t('cora.simple')) + '</h4><p>' + escapeHtml(r.simple_explanation) + '</p></div>' +
      '<div class="explain-block explain-block--example"><h4>' + icon('bulb', 'ic--sm') + escapeHtml(t('cora.example')) + '</h4><p>' + escapeHtml(r.real_life_example) + '</p></div>' +
      '<div class="drill"><h4 class="strong" style="display:flex;gap:8px;align-items:center">' + icon('target', 'ic--sm') + escapeHtml(t('cora.drill')) + '</h4>' +
        '<p style="margin-top:6px;font-weight:700">' + escapeHtml(r.drill_question) + '</p><div class="answers">' + opts + '</div>' +
        (answered ? '<p class="drill__fb ' + (c.picked === r.correct_option_index ? 'drill__fb--ok' : 'drill__fb--no') + '" role="status">' +
          escapeHtml((c.picked === r.correct_option_index ? t('cora.right') : t('cora.wrong')) + ' ' + r.drill_feedback) + '</p>' : '') + '</div>' +
      '<button type="button" class="btn btn--ghost" data-action="cora-reset">' + icon('help', 'ic--sm') + escapeHtml(t('cora.again')) + '</button>';
  }
  async function askCora(question, topicKey) {
    const q = String(question || '').trim().slice(0, 400);
    if (!q || state.cora.busy) return;
    state.cora.busy = true;
    state.cora.question = q;
    state.cora.result = null;
    state.cora.picked = null;
    renderCoraBody();
    let result = null;
    try {
      if (state.session) {
        const res = await withSessionRecovery((sid) => api.explain({ session_id: sid, question: q, topic_hint: topicKey || null, lang: state.lang, user_name: state.userName || null }));
        // The backend's offline bank has no entry for some glossary terms (MiFID II): its generic
        // fallback would miss the point, so the local, on-topic explanation wins there.
        const genericFallback = res && res.is_fallback && LOCAL_ONLY_TOPICS.indexOf(topicKey) >= 0;
        if (validExplain(res) && !genericFallback) result = res;
      }
    } catch (err) {
      if (!isRouteMissing(err)) console.info('[Finance Quest] /api/coach/explain failed (' + err.message + '), using the offline explanation.');
    }
    state.cora.busy = false;
    state.cora.result = result || localExplain(q, topicKey);
    renderCoraBody();
  }
  function pickDrill(i) {
    const c = state.cora;
    if (!c.result || c.picked != null) return;
    c.picked = i;
    if (i === c.result.correct_option_index) Sound.correct(); else Sound.retry();
    renderCoraBody();
  }

  // Tap-to-define popover: one plain sentence + a shortcut into Ask Atlas on the same term.
  let termReturnFocus = null;
  function openTermPop(key, anchor) {
    const pop = els.termPop;
    if (!pop || TERM_KEYS.indexOf(key) < 0) return;
    if (!pop.hidden && pop.dataset.term === key) { closeTermPop(); return; }
    closeTermPop();
    termReturnFocus = anchor;
    pop.dataset.term = key;
    pop.innerHTML =
      '<p class="term-pop__title" id="term-pop-title">' + escapeHtml(t('define.' + key + '.t')) + '</p>' +
      '<p class="term-pop__text">' + escapeHtml(t('define.' + key + '.d')) + '</p>' +
      '<div class="term-pop__actions">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="term-ask" data-term="' + key + '">' + icon('help', 'ic--sm') + escapeHtml(t('define.see')) + '</button>' +
        '<button type="button" class="icon-btn" data-action="term-close" aria-label="' + escapeHtml(t('common.close')) + '">' + icon('x') + '</button>' +
      '</div>';
    pop.hidden = false;
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    const r = anchor ? anchor.getBoundingClientRect() : { left: 12, bottom: 80, top: 60, width: 0 };
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = clamp(r.left + r.width / 2 - w / 2, 12, window.innerWidth - w - 12);
    const below = r.bottom + 8;
    const top = below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 8) : below;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    const first = pop.querySelector('[data-action="term-ask"]');
    if (first) first.focus({ preventScroll: true });
  }
  function closeTermPop(restoreFocus) {
    const pop = els.termPop;
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    pop.dataset.term = '';
    document.querySelectorAll('.term[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (restoreFocus && termReturnFocus && document.contains(termReturnFocus)) termReturnFocus.focus({ preventScroll: true });
    termReturnFocus = null;
  }
  function askAboutTerm(key) {
    closeTermPop();
    const topic = TERM_TOPIC[key] || null;
    openCora({ topic, question: key === 'mifid' ? t('define.mifid.q') : t('define.' + key + '.t') });
  }

  // ------------------------------------------------------------------------
  // 16. Modals, menu, toasts, confetti
  // ------------------------------------------------------------------------
  let modalReturnFocus = null;
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modalReturnFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    const btn = modal.querySelector('.modal__head [data-action="close-modal"], [data-action="close-intro"], [data-action="close-name"], input, [data-action]');
    if (btn) btn.focus();
  }
  function closeModal(id) {
    const list = id ? [document.getElementById(id)] : Array.from(document.querySelectorAll('.modal:not([hidden])'));
    let closed = false;
    list.forEach((m) => { if (m && !m.hidden) { m.hidden = true; closed = true; } });
    if (!closed) return;
    if (els.coraSheet.hidden) document.body.classList.remove('no-scroll');
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function' && document.contains(modalReturnFocus)) modalReturnFocus.focus();
    modalReturnFocus = null;
  }
  function renderJudges() {
    const sections = blocks().judges.map((s) =>
      '<section class="judge judge--' + s.tone + (s.wide ? ' judge--wide' : '') + '"><h3>' + icon(s.icon, 'ic--sm') + escapeHtml(s.title) + '</h3>' +
        (s.list ? '<ul>' + s.list.map((li) => '<li>' + escapeHtml(li) + '</li>').join('') + '</ul>' : '<p>' + escapeHtml(s.text) + '</p>') + '</section>'
    ).join('');
    els.judgesContent.innerHTML =
      '<div class="judges">' + sections + '</div>' +
      '<p class="disclaimer" style="margin-top:16px">' + icon('menu') + '<span>' + escapeHtml(t('judges.demoHint')) + '</span></p>' +
      '<p class="disclaimer" style="margin-top:8px">' + icon('info') + '<span>' + escapeHtml(t('ai.disclaimer')) + '</span></p>';
  }
  function toggleMenu(force) {
    const open = force != null ? force : els.hudMenu.hidden;
    els.hudMenu.hidden = !open;
    document.querySelectorAll('[data-action="toggle-menu"]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  }
  function closeMenu() { if (els.hudMenu && !els.hudMenu.hidden) toggleMenu(false); }

  function toast(message, tone, ms, opts) {
    const el = document.createElement('div');
    const guide = !!(opts && opts.guide);
    el.className = 'toast' + (tone === 'warn' ? ' toast--warn' : tone === 'ok' ? ' toast--ok' : '') + (guide ? ' toast--guide' : '');
    el.setAttribute('role', tone === 'warn' ? 'alert' : 'status');
    if (guide) {
      el.innerHTML = '<span class="toast__guide" aria-hidden="true">' + coraSVG() + '</span><span>' + escapeHtml(message) + '</span>';
    } else {
      el.textContent = message;
    }
    els.toastRoot.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 600);
    }, ms || 3400);
  }
  // One restrained burst in the brand palette: end of a completed day, or passing Checkpoint #1.
  function fireConfetti() {
    if (typeof window.confetti !== 'function') return;
    const colors = [C.yellow, C.green, C.ink, C.rule];
    window.confetti({ particleCount: 80, spread: 70, startVelocity: 32, gravity: 1.1, ticks: 160, scalar: 0.85, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
  }

  // ------------------------------------------------------------------------
  // 17. Language, events & init
  // ------------------------------------------------------------------------
  function applyStaticI18n() {
    document.documentElement.lang = state.lang;
    document.title = t('meta.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    document.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
    document.querySelectorAll('[data-i18n-content]').forEach((el) => el.setAttribute('content', t(el.dataset.i18nContent)));
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)));
    // Static copy with tap-to-define terms (e.g. MiFID II in the compliance note).
    document.querySelectorAll('[data-i18n-define]').forEach((el) => { el.innerHTML = defineTerms(t(el.dataset.i18nDefine)); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
  }

  async function setLang(lang) {
    if (lang !== 'en' && lang !== 'pl') return;
    if (lang === state.lang) { closeMenu(); return; }
    state.lang = lang;
    storageSet(LS_LANG, lang);
    closeTermPop();
    applyStaticI18n();
    renderGuideWelcome();
    renderSoundButton();
    renderStageCards();
    syncFormOutputs();
    renderHud({ animate: false });
    renderDemoMenus();
    if (!els.modalJudges.hidden) renderJudges();
    loadPersonas();
    // Nothing answered yet -> refresh server content in the new language (docs/01 §9).
    if (state.session && state.log.length === 0 && state.lastProfile && (state.screen === SCREENS.HUB)) {
      const keep = { lessonsXp: state.lessonsXp, completedLessons: new Set(state.completedLessons), checks: state.lessonChecks, checkin: new Set(state.checkinDays), bypass: new Set(state.gateBypass), year: state.tm.year };
      const data = await analyzeProfile(state.lastProfile, { stay: true, quick: true, stageId: state.stageId });
      if (data) {
        state.lessonsXp = keep.lessonsXp;
        state.completedLessons = keep.completedLessons;
        state.lessonChecks = keep.checks;
        state.checkinDays = keep.checkin;
        state.gateBypass = keep.bypass;
        renderLessonsCard();
        renderHud({ animate: false });
        if (keep.year) updateTimeMachine(keep.year, { animate: false });
      }
      return;
    }
    if (state.session) {
      if (state.screen === SCREENS.HUB) { renderHub(); renderGardenCard(); updateTimeMachine(state.tm.year || state.session.default_horizon_years, { animate: false }); }
      if (state.screen === SCREENS.MISSION && state.mission && state.mission.phase === 'answer') renderBeat();
      else if (state.screen === SCREENS.MISSION) renderMissionBar();
      if (state.screen === SCREENS.DONE) renderDone({ animate: false });
      if (state.screen === SCREENS.CHECKPOINT) renderCheckpoint();
    }
    if (!els.coraSheet.hidden) renderCoraBody();
  }

  function goHome() {
    if (!state.session) { showScreen(SCREENS.BANK_ENTRY); return; }
    closeDrawer();
    renderHub();
    showScreen(SCREENS.HUB);
    updateTimeMachine(state.tm.year || state.session.default_horizon_years, { animate: false });
  }

  function bindEvents() {
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.btn, .answer, .tl__btn, .stage-card, .stage-pill, .tile-wrap, .icon-btn, .tool-btn, .check, .fund__row, .seg button, .topic-chips button, .cora-dock, .pebble, .step-tab')) Sound.click();
    });

    document.addEventListener('click', (e) => {
      if (els.hudMenu && !els.hudMenu.hidden && !e.target.closest('#hud-menu, [data-action="toggle-menu"]')) toggleMenu(false);
      if (els.demoPop && !els.demoPop.hidden && !e.target.closest('#demo-pop, [data-action="toggle-demo"]')) toggleDemo(false);
      if (els.termPop && !els.termPop.hidden && !e.target.closest('#term-pop, [data-action="define"]')) closeTermPop();
      const el = e.target.closest('[data-action], [data-stage], [data-lang]');
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' && el.dataset.action !== 'node') return;
      if (el.dataset.lang) { setLang(el.dataset.lang); closeMenu(); return; }
      if (el.dataset.stage) { selectStage(el.dataset.stage); return; }
      const a = el.dataset.action;
      switch (a) {
        case 'start-entry': beginJourney(); break;
        case 'next-intro': nextIntro(); break;
        case 'skip-intro': skipIntro(); break;
        case 'close-intro': skipIntro(); break;
        case 'skip-name': finishName(''); break;
        case 'close-name': closeEntryFlow(); break;
        case 'go-home': goHome(); break;
        case 'reset': resetToProfile(); break;
        case 'toggle-sound': Sound.setMuted(!Sound.isMuted()); renderSoundButton(); if (!Sound.isMuted()) Sound.pop(); break;
        case 'toggle-calm': closeMenu(); toggleCalm(); break;
        case 'define': e.preventDefault(); openTermPop(el.dataset.term, el); break;
        case 'term-ask': askAboutTerm(el.dataset.term); break;
        case 'term-close': closeTermPop(true); break;
        case 'toggle-menu': closeDemo(); renderDemoMenus(); toggleMenu(); break;
        case 'toggle-demo': toggleDemo(); break;
        case 'open-judges': closeMenu(); closeDemo(); renderJudges(); openModal('modal_judges'); break;
        case 'hub-tab': showHubTab(el.dataset.tab, { scroll: el.dataset.scroll === '1', focus: el.classList.contains('step-tab') }); break;
        case 'done-tab': showDoneTab(el.dataset.tab); break;
        case 'soon-day': onSoonDay(el); break;
        case 'tm-reset': state.tmAmount = null; syncAmountControls(); updateTimeMachine(state.tm.year || state.session.default_horizon_years); break;
        case 'close-modal': closeModal(el.closest('.modal') ? el.closest('.modal').id : null); break;
        case 'toggle-tailor': openTailor(); break;
        case 'node': onNode(el.dataset.node, el); break;
        case 'open-mission': openMission(); break;
        case 'start-day': startDay(Number(el.dataset.day)); break;
        case 'open-checkpoint': openCheckpoint(); break;
        case 'open-done': openDone(); break;
        case 'lesson': completeLesson(el.dataset.lessonId, el); break;
        case 'lesson-pick': pickLessonOption(el.dataset.lessonId, Number(el.dataset.i)); break;
        case 'checkin-explain': checkinExplain(); break;
        case 'checkin-start': checkinStart(); break;
        case 'goto-lessons': gotoLessons(el); break;
        case 'close-mission': closeMission(); break;
        case 'pick': pickAnswer(el.dataset.id, el); break;
        case 'check': check(); break;
        case 'continue': continueMission(); break;
        case 'myth': pickMyth(el.dataset.v, el); break;
        case 'spot': pickSpot(el.dataset.row, el); break;
        case 'accept-challenge': acceptChallenge(); break;
        case 'toggle-check': toggleCheck(el.dataset.id, el); break;
        case 'challenge-friend': challengeFriend(); break;
        case 'open-bank': openBank(); break;
        case 'simulate-bank': simulateBank(); break;
        case 'next-gen': nextGeneration(); break;
        case 'cp-pick': cpPick(el.dataset.id); break;
        case 'cp-next': if (state.cp) { state.cp.i += 1; renderCheckpoint(); window.scrollTo(0, 0); } break;
        case 'cp-submit': cpSubmit(); break;
        case 'open-cora': {
          if (el.dataset.topic) openCora({ question: el.dataset.topic });
          else if (state.screen === SCREENS.MISSION) {
            const k = explainTopicForBeat();
            openCora({ topic: k, question: EXPLAIN_TOPICS.indexOf(k) >= 0 ? t('cora.topic.' + k) : t('hub.phase1.title') });
          }
          else openCora();
          break;
        }
        case 'close-cora': closeCora(); break;
        case 'cora-topic': askCora(t('cora.topic.' + el.dataset.topic), el.dataset.topic); break;
        case 'cora-drill': pickDrill(Number(el.dataset.i)); break;
        case 'cora-reset': state.cora.result = null; state.cora.picked = null; state.cora.question = ''; renderCoraBody(); break;
        case 'demo-day4': closeModal(); closeDemo(); closeMenu(); startDay(4, { demo: true }); break;
        case 'demo-cp': closeModal(); closeDemo(); closeMenu(); openCheckpoint(); break;
        default: break;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.termPop && !els.termPop.hidden) closeTermPop(true);
        else if (!els.coraSheet.hidden) closeCora();
        else if (document.querySelector('.modal:not([hidden])')) closeModal();
        else { closeMenu(); closeDemo(); }
      }
      // Arrow keys move between the step tabs (WAI-ARIA tabs pattern).
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target && e.target.classList && e.target.classList.contains('step-tab')) {
        const tabs = Array.from(e.target.parentElement.querySelectorAll('.step-tab'));
        const next = tabs[(tabs.indexOf(e.target) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        if (next) { e.preventDefault(); next.click(); next.focus(); }
      }
      if (e.target && e.target.id === 'm-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!els.mCheck.disabled) check();
      }
      if (e.target && e.target.id === 'cora-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        askCora(e.target.value);
      }
    });

    document.addEventListener('input', (e) => {
      const id = e.target && e.target.id;
      if (id === 'm-input') syncOwn();
      else if (id === 'm-alloc') updateAlloc();
      else if (id === 'tm-years') updateTimeMachine(e.target.value);
      else if (id === 'tm-amount') setWhatIfAmount(e.target.value);
    });
    // The popover is anchored to its term: close it when the page moves under it.
    window.addEventListener('scroll', () => closeTermPop(), { passive: true });
    window.addEventListener('resize', () => closeTermPop());
    document.addEventListener('change', (e) => {
      const input = e.target;
      // Releasing the age slider at 45+ switches on the calm layout (unless chosen by hand).
      if (input && input.id === 'f-age') { calmForAge(input.value); return; }
      if (!input || input.type !== 'radio') return;
      if (input.name === 'self_after') {
        state.summary.selfAfter = Number(input.value);
        const out = document.getElementById('self-compare');
        if (out) out.textContent = selfCompare(state.lastProfile ? state.lastProfile.self_confidence_start : null, state.summary.selfAfter);
      } else if (input.name === 'bank_option') {
        state.summary.bankOption = input.value === 'b' ? 'b' : 'a';
      }
    });
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'name-form') {
        e.preventDefault();
        const input = document.getElementById('user-name');
        finishName(input ? input.value : '');
        return;
      }
      if (e.target.id === 'cora-form') {
        e.preventDefault();
        const input = document.getElementById('cora-input');
        askCora(input ? input.value : '');
      }
    });
    els.form.addEventListener('input', onFormInput);
    els.form.addEventListener('submit', (e) => { e.preventDefault(); submitForm(); });
  }

  function cacheElements() {
    const $ = (id) => document.getElementById(id);
    els.screens = Array.from(document.querySelectorAll('main .screen'));
    els.hudDayNum = $('hud-day-num');
    els.hudDayTotal = $('hud-day-total');
    els.hudStreak = $('hud-streak');
    els.hudXp = $('hud-xp');
    els.hudXpPill = $('hud-xp-pill');
    els.hudLevel = $('hud-level');
    els.hudReady = $('hud-ready');
    els.hudReadyRow = $('hud-ready-row');
    els.hudStats = $('hud-stats');
    els.hudStage = $('hud-stage');
    els.tmCow = $('tm-cow');
    els.termPop = $('term-pop');
    els.hudSound = $('hud-sound');
    els.hudMenu = $('hud-menu');
    els.stageGrid = $('stage-grid');
    els.tailorBody = $('tailor-body');
    els.form = $('onboarding-form');
    els.fAge = $('f-age');
    els.fAgeOut = $('f-age-out');
    els.fAgeGroup = $('f-age-group');
    els.fNet = $('f-net');
    els.fNetOut = $('f-net-out');
    els.fFree = $('f-free');
    els.fFreeOut = $('f-free-out');
    els.fFreeHint = $('f-free-hint');
    els.ctaOnboarding = $('cta-onboarding');
    els.demoPop = $('demo-pop');
    els.demoMobile = $('demo-menu-mobile');
    els.hubPathCol = $('hub-path-col');
    els.hubMoreCol = $('hub-more-col');
    els.hubSteps = $('hub-steps');
    els.tmAmount = $('tm-amount');
    els.tmAmountPill = $('tm-amount-pill');
    els.tmAmountMin = $('tm-amount-min');
    els.tmAmountMax = $('tm-amount-max');
    els.tmAmountNote = $('tm-amount-note');
    els.tmReset = $('tm-reset');
    els.cardPlan = $('card-plan');
    els.cardGarden = $('card-garden');
    els.cardSkipped = $('card-skipped');
    els.cardLessons = $('card-lessons');
    els.hubMobileCta = $('hub-mobile-cta');
    els.tmMonthly = $('tm-monthly');
    els.tmYears = $('tm-years');
    els.tmPill = $('tm-pill');
    els.tmMin = $('tm-min');
    els.tmMax = $('tm-max');
    els.kpiCash = $('kpi-cash');
    els.kpiPaid = $('kpi-paid');
    els.kpiEtf = $('kpi-etf');
    els.kpiEtfNominal = $('kpi-etf-nominal');
    els.kpiWin = $('kpi-win');
    els.kpiWinText = $('kpi-win-text');
    els.tmChart = $('tm-chart');
    els.tmAssumptions = $('tm-assumptions');
    els.mProgress = $('m-progress');
    els.mProgressFill = $('m-progress-fill');
    els.mTicks = $('m-ticks');
    els.mXp = $('m-xp');
    els.mXpPill = $('m-xp-pill');
    els.mMeta = $('m-meta');
    els.mStage = $('m-stage');
    els.mCheckbar = $('m-checkbar');
    els.mCheck = $('m-check');
    els.mDrawer = $('m-drawer');
    els.mDrawerCora = $('m-drawer-cora');
    els.mDrawerTitle = $('m-drawer-title');
    els.mDrawerAnswer = $('m-drawer-answer');
    els.mDrawerText = $('m-drawer-text');
    els.mDrawerPills = $('m-drawer-pills');
    els.mContinue = $('m-continue');
    els.doneRoot = $('done-root');
    els.cpRoot = $('cp-root');
    els.coraSheet = $('cora-sheet');
    els.coraSheetCora = $('cora-sheet-cora');
    els.coraBody = $('cora-body');
    els.bankContent = $('bank-content');
    els.modalJudges = $('modal_judges');
    els.judgesContent = $('judges-content');
    els.toastRoot = $('toast-root');
  }

  function setupMobileReadiness() {
    const val = document.getElementById('hud-ready-val');
    if (val) val.setAttribute('data-ready-val', '');
    if (!els.hudReady || !els.hudReadyRow) return;
    const clone = els.hudReady.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    els.hudReadyRow.appendChild(clone);
    els.hudReadyMobile = clone;
  }

  function configureChart() {
    if (!window.Chart) return;
    window.Chart.defaults.font.family = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.font.weight = '500';
    window.Chart.defaults.color = C.ink3;
  }

  function init() {
    cacheElements();
    const saved = storageGet(LS_LANG);
    state.lang = saved === 'pl' || saved === 'en' ? saved : 'en';
    setupMobileReadiness();
    hydrateIcons();
    hydrateCora();
    applyStaticI18n();
    renderGuideWelcome();
    renderSoundButton();
    configureChart();
    bindEvents();
    renderStageCards();
    renderDemoMenus();
    syncFormOutputs();
    renderHud({ animate: false });
    loadPersonas();
    const missing = ['Chart', 'confetti'].filter((n) => !window[n]);
    if (missing.length) console.warn('[Finance Quest] Missing local libraries in /static/vendor/: ' + missing.join(', '));
  }

  // Debug handle for the console (no globals beyond this).
  window.FQ = { state, api, t, showScreen, selectStage, startDay, openCheckpoint, openCora, Sound };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
