# Investly

> Collabothon 2026 · Challenge: **Finance Quest** (Commerzbank) · Theme: **Innovations for all generations**

A gamified 14-day learning sprint where beginner investors practise real money decisions with an AI coach and take their first small step, adapted to their age, horizon and biggest fear.

---

## Project Card (Collabothon 2026 submission)

| Field | Value |
| :--- | :--- |
| **Project Name** | Investly |
| **One-Line Summary** (≤ 200 chars) | A gamified 14-day learning sprint where beginner investors practise real money decisions with an AI coach and take their first small step, adapted to age, horizon and fear. |
| **Technology Stack** | Python 3, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2, PostgreSQL 16 (Docker) with in-memory SQLite fallback, OpenAI-compatible LLM API (OpenAI / DeepSeek) with offline fallback, vanilla JavaScript (no build step), Chart.js, canvas-confetti, Web Audio API, inline SVG, local fonts (Plus Jakarta Sans, Bricolage Grotesque). Zero CDN at runtime. |
| **Source Code Repository** | https://github.com/kacperpogorzelski/Collabhaton |

### Project Overview

#### THE PROBLEM
Many people who want to invest are not blocked by missing information. They are blocked by fear: of freezing their money, of losing it, of having no time, of being "too late". Even after learning the basics they hesitate to act, and traditional courses are long and disconnected from real decisions. Banks lose these customers before the first deposit, the first test order or the first recurring plan.

#### YOUR SOLUTION
A short daily mission instead of a course: a **14-Day Confidence Sprint (~5 minutes a day)**. Each day the learner reads one or two micro-lessons, plays a short decision simulation with an AI coach (Atlas) and finishes with a small real-world challenge (for example, a 5 PLN transfer to a savings account). The goal is not "knowing more" but **doing the first step with confidence**.

What makes it different:
- **Fear-driven, not stereotype-driven.** The user picks the main concern (freezing money, no time, losing money, too late). That concern, the age group, the starting self-confidence and the plan type select the scenario and the questions.
- **Innovations for all generations.** Age sets the horizon and tone: 20+ (15 years, energetic), 30–50 (10 years, time-saving), 50+ (7 years, calm and clear). Calm mode for seniors.
- **Honest numbers.** ETF and cash are always compared in today's money (a shared inflation deflator), with explicit assumptions, a stress scenario and a MiFID II note. No profit guarantees, no tickers.
- **Strict understanding check.** Free-text answers are graded in 3 tiers (`optimal` / `partial` / `invalid`). Gibberish earns 0 XP and a retry, so progress reflects real understanding.
- **Reliable on stage.** Card clicks are graded deterministically with no LLM. The LLM is used only for free text and "Explain simpler", and both have offline fallbacks.

#### THE WORKING PROTOTYPE
Playable end to end today:
- **Onboarding** (6 questions) and demo personas (22y Student, 38y Family, 56y 50+).
- **"Skipped N topics" filter** that removes theory a beginner does not need at the start.
- **Stages hub**: Stage 1–4 and Checkpoint #1 are directly accessible, with tabs Plan / Simulator / Lessons / Challenge. Stages 5–14 and "After Day 14" are a preview only.
- **Time machine**: cash vs. broad ETF chart (real values, stress scenario, 1–20 years) and a what-if amount slider.
- **Micro-lessons** with mini-checks and an AI check-in.
- **Decision simulation with the AI coach**: Stage 1 has 3 steps, Stages 2–4 have 2 steps each, with the 3-tier grading, retry on invalid answers, confetti and XP.
- **Ask Atlas / "Explain with a real-life example"**: analogy plus a 3-option mini-drill.
- **Gamification**: XP, levels, readiness, streak, leaderboard, a growing plant as a level reward.
- **Daily real-world challenge**, **Checkpoint #1** quiz (pass mark 75%, badge, bonus XP) and a **demo bank hand-off** (KYC note).
- **EN / PL** UI (EN default), amounts in PLN, mobile layout from 390 px.

Not implemented (by design for the prototype): Stages 5–14 gameplay, authentication, real bank integration. Bank screens are a demo, not a product promise.

#### BEHIND THE BUILD
- **Backend:** FastAPI with synchronous endpoints, Pydantic v2 models as the API contract, SQLAlchemy with exactly 2 tables (`sessions`, `leaderboard_entries`). If PostgreSQL is unreachable, the app falls back to in-memory SQLite so the demo does not die.
- **Deterministic core:** `backend/finance_math.py` computes all money values (5.7% net ETF assumption, 3.5% inflation, shared deflator). `backend/demo_data.py` holds all lesson, step and option content in EN and PL. **The LLM never calculates money.**
- **AI coach:** `backend/luna_service.py` (technical name kept for stability; the coach is shown as Atlas) runs strict-JSON assessment of free text, a local gibberish pre-validator, and a timeout with a neutral fallback. OpenAI and DeepSeek are both supported; `DEMO_OFFLINE=1` disables the LLM entirely.
- **Frontend:** a single vanilla JS app (`static/app.js`) with an i18n dictionary, a state object and delegated events; Chart.js and canvas-confetti vendored locally in `static/vendor/`. No npm, no framework, no build step.
- **Built on:** FastAPI, SQLAlchemy, Pydantic, OpenAI SDK, Chart.js, canvas-confetti. A previously written LLM-connection pattern (strict JSON validation, timeouts) was reused for the AI coach. All product content, the simulation logic, the grading, the math, the UI and the design system were created during the hackathon.
- **Process:** one shared spec (`AGENTS.md`, `docs/01–03`) as single source of truth, frozen API contract, strict file ownership per team member, one issue per branch.

#### CHALLENGES AND DISCOVERIES
- **Comparing ETF with cash fairly.** Our first numbers mixed nominal ETF with cash. We moved to real values with a common deflator, a stress overlay and a display cap on the "historical win rate".
- **Free text is risky on stage.** LLM latency and nonsense input can break a live demo, so we added a 0 ms local pre-validator, a 3.5 s timeout and deterministic grading for card clicks.
- **Fear differs from age.** Assuming that older users fear "being too late" is a stereotype, so the user chooses the concern and age only sets horizon and tone.
- **Navigation vs. discipline.** We first locked stages sequentially, then found that users should be free to jump between stages, so stages are now open and progress is only saved as a mark.
- **Offline reliability.** Everything runs without CDN or Wi-Fi: local vendor libraries, local fonts, SQLite fallback, offline explanation bank.

#### RESULTS AND NEXT STEPS
**Achieved:** a complete, playable learning mission (Stages 1–4 + Checkpoint #1) with a defined learner profile and learning objective, evidence of understanding (3-tier grading, checkpoint quiz, before/after self-confidence) and engagement (XP, levels, streak, leaderboard, confetti, mascot).

**Validated:**
- `scripts/check_math.py`: formulas vs. reference values (142/142 matches at last full run, see `WORKLOG.md`).
- `scripts/smoke_test.py`: Golden Path for 3 personas (EN and PL), invalid-answer handling, Days 1–4, challenges, checkpoint and explain, run with `DEMO_OFFLINE=1`.
- Manual end-to-end runs in headless Chrome at 1280 px and 390 px, with PostgreSQL and SQLite fallback.

**Limitations:** the historical win-rate table is illustrative and has no source yet; Stages 5–14 are a preview; a stage switch resets that stage's mission state; no real bank integration or identity checks.

**Next steps:** compute the win rate from public data with a cited source; build Phases 2–3 (risk, emotions, real plan); an "After Day 14" path (rebalancing, IKE/IKZE, bonds, monthly AI check-ins); a parameter sandbox for the chart; real KYC and a bank hand-off; KPI tracking (completion, confidence uplift, challenge acceptance, conversion).

---

## Challenge fit

| Challenge Card requirement | Where in the product |
| :--- | :--- |
| Demonstrable prototype with a complete learning "mission" | Stage 1 (3-step simulation) plus daily challenge; Stages 2–4 and Checkpoint #1 |
| Target learner and learning objective | Self-directed beginner investors in 3 age groups. Objective: understand inflation, the emergency fund, broad diversification and volatility, and take a first small step |
| Support for understanding and engagement | 3-tier grading, mini-checks, "Explain simpler", checkpoint quiz, XP/levels/streak/leaderboard |
| Innovations for all generations | Age-based horizon and tone, concern-based scenario, calm mode for seniors, EN/PL |

## Run locally

```bash
docker compose up -d                                  # PostgreSQL 16 (optional, SQLite fallback otherwise)
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # DEMO_OFFLINE=1 works without any API key
uvicorn backend.main:app --host 0.0.0.0 --port 8000   # do NOT use --reload during a presentation
```

Open http://localhost:8000.

Checks:

```bash
python scripts/check_math.py
DEMO_OFFLINE=1 python scripts/smoke_test.py
```

## Repository layout

```text
backend/    FastAPI app, models, schemas, finance math, demo content, AI coach service
static/     index.html, app.js, styles.css, vendor/ (local libraries and fonts)
scripts/    check_math.py, smoke_test.py
docs/       product, tech/API/math and AI-coach specifications (single source of truth)
AGENTS.md   rules and team workflow
WORKLOG.md  status log and contract lock
```

## Team

Three developers (backend, AI, frontend): `[Name Surname 1]`, `[Name Surname 2]`, `[Name Surname 3]`.

## Disclaimer

Finance Quest is an educational simulation, not investment advice or a recommendation under MiFID II. Calculations use simplified assumptions and historical data, exclude tax, brokerage fees and currency risk, and do not guarantee future returns. Investing involves the risk of losing part or all of your capital. The AI coach can make mistakes.
