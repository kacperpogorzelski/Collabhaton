"""Smoke test Golden Path (docs/02 §8, Issue #11).

    python scripts/smoke_test.py

Działa hermetycznie: ``DEMO_OFFLINE=1`` (LLM wyłączony) i SQLite w pamięci
(``DATABASE_URL=sqlite://``), na ``TestClient`` — bez serwera i bez Dockera.
Kod wyjścia ``0`` = wszystko OK, ``1`` = co najmniej jedna rozbieżność.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ["DEMO_OFFLINE"] = "1"
os.environ["DATABASE_URL"] = "sqlite://"

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend import database  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models import MissionSession  # noqa: E402

FAILS: list[str] = []
NEUTRAL_FALLBACK = "Thanks for your answer!"
NEUTRAL_FALLBACK_PL = "Dziękuję za odpowiedź! Nie udało się jej teraz ocenić"


def check(cond: bool, msg: str) -> None:
    if not cond:
        FAILS.append(msg)
        print(f"  FAIL: {msg}")


def options_of(session_id: str) -> list[dict]:
    with database.SessionLocal() as db:
        return list(db.get(MissionSession, session_id).current_options)


def pick(session_id: str, optimal: bool) -> str:
    for o in options_of(session_id):
        if bool(o["is_optimal"]) == optimal:
            return o["id"]
    raise RuntimeError("brak opcji o żądanej poprawności")


def analyze(client: TestClient, persona: dict, **extra) -> dict:
    body = {k: persona[k] for k in (
        "age", "net_income", "free_cash", "has_emergency_fund",
        "main_concern", "self_confidence_start")}
    body.update(extra)
    r = client.post("/api/onboarding/analyze", json=body)
    check(r.status_code == 200, f"analyze {r.status_code}")
    return r.json()


def turn(client: TestClient, sid: str, text: str, qr: str | None = None) -> dict:
    r = client.post("/api/mission/turn", json={
        "session_id": sid, "user_message": text, "quick_reply_id": qr})
    check(r.status_code == 200, f"turn {r.status_code}: {r.text[:120]}")
    return r.json()


def run_persona(client: TestClient, persona: dict) -> None:
    pid = persona["id"]
    print(f"[{pid}] ścieżka optymalna")
    a = analyze(client, persona)
    sid = a["session_id"]
    start = a["initial_mission_turn"]["confidence_score"]
    check(start == 10, f"{pid}: gotowość startowa {start} != 10")
    check(a["initial_mission_turn"]["gamification"]["xp"] == 20, f"{pid}: XP startowe != 20")
    check(len(a["projection_series"]) == 20, f"{pid}: projekcja != 20 punktów")
    for ml in a["micro_lessons"]:
        check(bool(ml.get("check_question")) and len(ml.get("check_options") or []) == 3
              and ml.get("correct_option_index") in (0, 1, 2) and bool(ml.get("check_explanation")),
              f"{pid}: lekcja {ml['id']} bez mini-checka")
    if a["safe_investment"]["plan_type"] == "savings_first":
        check(a["safe_investment"]["training_etf_monthly"] == 0, f"{pid}: savings_first z ETF")

    conf, xp = [start], [20]
    last = None
    for step in (1, 2, 3):
        sel = pick(sid, True)
        text = next(o["text"] for o in options_of(sid) if o["id"] == sel)
        last = turn(client, sid, text, sel)
        conf.append(last["confidence_score"])
        xp.append(last["gamification"]["xp"])
        check(last["is_optimal_choice"] is True, f"{pid}: krok {step} nie optymalny")
        check(last["trigger_confetti"] is True, f"{pid}: krok {step} bez konfetti")
    check(conf == [10, 20, 30, 40], f"{pid}: gotowość {conf}")
    check(xp == [20, 60, 95, 155], f"{pid}: XP {xp}")
    check(last["mission_completed"] is True, f"{pid}: misja niezakończona")
    check(last["quick_replies"] == [], f"{pid}: quick_replies po kroku 3 niepuste")
    check(len(last["final_checklist"] or []) == 4, f"{pid}: checklista != 4")
    check(last["bank_draft"] is not None, f"{pid}: brak bank_draft")
    check(bool(last["leaderboard"]), f"{pid}: brak leaderboard")
    check(last["real_world_challenge"] is not None, f"{pid}: brak wyzwania")
    check(last["gamification"]["leveled_up"] is True, f"{pid}: brak awansu")

    again = turn(client, sid, "cokolwiek")
    # Powtórka nie zmienia stanu (XP, gotowość, krok, treść finału); delty i konfetti są zerowane.
    for key in ("confidence_score", "step_number", "mission_completed", "luna_message",
                "quick_replies", "final_checklist", "bank_draft", "real_world_challenge"):
        check(again[key] == last[key], f"{pid}: powtórny turn zmienił {key}")
    check(again["gamification"]["xp"] == last["gamification"]["xp"], f"{pid}: powtórny turn zmienił XP")
    check(again["gamification"]["xp_gained"] == 0 and again["confidence_delta"] == 0
          and not again["trigger_confetti"], f"{pid}: powtórny turn znów nagradza")

    r1 = client.post("/api/challenge/accept", json={"session_id": sid}).json()
    r2 = client.post("/api/challenge/accept", json={"session_id": sid}).json()
    check((r1["reward_xp"], r1["xp"]) == (50, 205), f"{pid}: accept #1 {r1['reward_xp']}/{r1['xp']}")
    check((r2["reward_xp"], r2["xp"]) == (0, 205), f"{pid}: accept #2 {r2['reward_xp']}/{r2['xp']}")

    check(client.post("/api/mission/turn", json={
        "session_id": "nie-istnieje", "user_message": "x"}).status_code == 404,
        f"{pid}: nieznana sesja != 404")
    run_days_2_to_4(client, pid, sid, 205)
    run_checkpoint(client, pid, sid)
    run_explain(client, pid, sid)


def run_days_2_to_4(client: TestClient, pid: str, sid: str, xp: int) -> None:
    print(f"[{pid}] Dni 2-4 + mini-challenges")
    for day in (2, 3, 4):
        r = client.post("/api/day/start", json={"session_id": sid, "day": day})
        check(r.status_code == 200, f"{pid}: day/start {day} -> {r.status_code}")
        d = r.json()
        check(d["day"] == day and len(d["micro_lessons"]) > 0, f"{pid}: day/start {day} treść")
        check(all(ml.get("check_question") and ml.get("correct_option_index") in (0, 1, 2)
                  for ml in d["micro_lessons"]), f"{pid}: day/start {day} lekcje bez mini-checka")
        t0 = d["initial_mission_turn"]
        check(t0["day"] == day and t0["step_number"] == 1 and t0["total_steps"] == 2,
              f"{pid}: dzień {day} tura startowa")
        check(t0["gamification"]["xp"] == xp, f"{pid}: dzień {day} start XP {t0['gamification']['xp']} != {xp}")
        # invalid: 0 XP, 0 gotowości, zostaje na kroku, allow_retry
        bad = turn(client, sid, "asdf")
        check(bad["answer_quality"] == "invalid" and bad["allow_retry"] is True, f"{pid}: d{day} invalid")
        check(bad["gamification"]["xp_gained"] == 0 and bad["confidence_delta"] == 0
              and bad["step_number"] == 1 and not bad["trigger_confetti"], f"{pid}: d{day} invalid nagradza")
        last = None
        for _ in range(2):
            sel = pick(sid, True)
            last = turn(client, sid, "ok", sel)
            check(last["day"] == day and last["answer_quality"] == "optimal", f"{pid}: d{day} optimal")
        check(last["mission_completed"] is True and last["quick_replies"] == [], f"{pid}: d{day} niezakończony")
        check(day in last["completed_days"], f"{pid}: d{day} brak w completed_days")
        check(last["real_world_challenge"] is not None, f"{pid}: d{day} brak wyzwania")
        xp = last["gamification"]["xp"]
        a1 = client.post("/api/challenge/accept", json={"session_id": sid, "day": day}).json()
        a2 = client.post("/api/challenge/accept", json={"session_id": sid, "day": day}).json()
        check((a1["reward_xp"], a2["reward_xp"]) == (50, 0), f"{pid}: d{day} accept {a1['reward_xp']}/{a2['reward_xp']}")
        check(a2["xp"] == xp + 50, f"{pid}: d{day} XP po wyzwaniu")
        xp = a2["xp"]


def run_checkpoint(client: TestClient, pid: str, sid: str) -> None:
    print(f"[{pid}] Checkpoint #1")
    from backend import demo_data
    qs = demo_data.get_checkpoint_questions("en")
    key = {q["id"]: q["correct_option_id"] for q in demo_data._CHECKPOINT_1_QUESTIONS_BY_LANG["en"]}
    wrong = {q["id"]: next(o["id"] for o in q["options"] if o["id"] != key[q["id"]]) for q in qs}
    r = client.post("/api/checkpoint/submit", json={"session_id": sid, "answers": wrong}).json()
    check(r["passed"] is False and r["reward_xp"] == 0, f"{pid}: checkpoint wrong")
    xp0 = r["xp"]
    r1 = client.post("/api/checkpoint/submit", json={"session_id": sid, "answers": key}).json()
    r2 = client.post("/api/checkpoint/submit", json={"session_id": sid, "answers": key}).json()
    check(r1["passed"] and r1["score_pct"] == 100 and r1["reward_xp"] == 100, f"{pid}: checkpoint pass")
    check(r1["xp"] == xp0 + 100 and r2["reward_xp"] == 0 and r2["xp"] == r1["xp"], f"{pid}: checkpoint idempotencja")
    check(len(r1["results"]) == r1["total_questions"] and bool(r1["leaderboard"]), f"{pid}: checkpoint wyniki")


def run_explain(client: TestClient, pid: str, sid: str) -> None:
    r = client.post("/api/coach/explain", json={"session_id": sid, "question": "What is inflation?"})
    if r.status_code == 501:
        print(f"  SKIP: /api/coach/explain niedostępne (brak luna_service.explain_with_drill, Issue #30)")
        return
    check(r.status_code == 200, f"{pid}: explain {r.status_code}")
    d = r.json()
    check(len(d.get("drill_options", [])) == 3 and 0 <= d.get("correct_option_index", -1) <= 2,
          f"{pid}: explain drill")
    check(d.get("is_fallback") is True, f"{pid}: explain offline bez is_fallback")
    check(client.post("/api/coach/explain", json={"session_id": "x", "question": "q"}).status_code == 404,
          f"{pid}: explain nieznana sesja != 404")


def run_edge_cases(client: TestClient, persona: dict) -> None:
    print("[edge] nieoptymalna karta i wolny tekst offline")
    sid = analyze(client, persona)["session_id"]
    bad = pick(sid, False)
    t = turn(client, sid, "zła", bad)
    check(t["confidence_delta"] == 2, f"nieoptymalna: delta {t['confidence_delta']} != 2")
    check(t["is_optimal_choice"] is False, "nieoptymalna: is_optimal_choice != False")
    check(t["trigger_confetti"] is False, "nieoptymalna: konfetti")
    check(t["gamification"]["xp"] == 40, f"nieoptymalna: XP {t['gamification']['xp']} != 40")

    sid = analyze(client, persona)["session_id"]
    t = turn(client, sid, "moja własna odpowiedź")
    check(t["is_optimal_choice"] is False, "wolny tekst offline: is_optimal_choice != False")
    check(t["trigger_confetti"] is False, "wolny tekst offline: konfetti")
    check(t["confidence_delta"] == 2, "wolny tekst offline: delta != 2")
    check(NEUTRAL_FALLBACK in (t["understanding_feedback"] or ""), "wolny tekst offline: zły fallback")

    print("[lang] domyślnie EN, jawnie PL")
    en = analyze(client, persona)
    check(en["lang"] == "en", "analyze bez lang != en")
    pl = analyze(client, persona, lang="pl")
    check(pl["lang"] == "pl", "analyze lang=pl != pl")
    check(en["persona_label"] != pl["persona_label"], "persona_label taki sam w EN i PL")
    check(en["safe_investment"]["reasoning"] != pl["safe_investment"]["reasoning"], "reasoning taki sam")
    en_labels = [p["short_label"] for p in client.get("/api/demo-personas").json()]
    pl_labels = [p["short_label"] for p in client.get("/api/demo-personas?lang=pl").json()]
    check(en_labels != pl_labels, "demo-personas: EN == PL")
    t = turn(client, pl["session_id"], "moja własna odpowiedź")
    check(NEUTRAL_FALLBACK_PL in (t["understanding_feedback"] or ""), "PL: zły fallback")
    r = client.post("/api/mission/turn", json={"session_id": pl["session_id"],
                    "user_message": "my own answer", "lang": "en"}).json()
    check(NEUTRAL_FALLBACK in (r["understanding_feedback"] or ""), "przełączenie lang na en nie działa")

    print("[edge] invalid (Dzień 1)")
    sid = analyze(client, persona)["session_id"]
    bad = turn(client, sid, "asdf")
    check(bad["answer_quality"] == "invalid" and bad["allow_retry"] is True, "invalid: quality/retry")
    check(bad["gamification"]["xp"] == 20 and bad["confidence_score"] == 10 and bad["step_number"] == 1,
          "invalid: zmienił XP/gotowość/krok")
    good = turn(client, sid, "x", pick(sid, True))
    check(good["answer_quality"] == "optimal" and good["allow_retry"] is False, "optimal po invalid")

    print("[edge] savings_first (free_cash=250, bez poduszki)")
    a = analyze(client, {**persona, "free_cash": 250, "has_emergency_fund": False})
    si = a["safe_investment"]
    check(si["plan_type"] == "savings_first", f"plan_type {si['plan_type']}")
    check(si["training_etf_monthly"] == 0, "savings_first: training_etf_monthly != 0")


def main() -> int:
    with TestClient(app) as client:
        personas = client.get("/api/demo-personas").json()
        check(len(personas) == 3, "persony != 3")
        for p in personas:
            run_persona(client, p)
        run_edge_cases(client, next(p for p in personas if p["id"] == "young_20"))
    if FAILS:
        print(f"\nSMOKE TEST: {len(FAILS)} błędów")
        return 1
    print("\nSMOKE TEST: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
