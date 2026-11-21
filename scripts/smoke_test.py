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
NEUTRAL_FALLBACK = "Dziękuję za odpowiedź! Nie udało się jej teraz ocenić"


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


def analyze(client: TestClient, persona: dict) -> dict:
    body = {k: persona[k] for k in (
        "age", "net_income", "free_cash", "has_emergency_fund",
        "main_concern", "self_confidence_start")}
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
