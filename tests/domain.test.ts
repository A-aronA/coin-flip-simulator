import { describe, it, expect } from "vitest";
import {
  activeAttempt,
  beginReward,
  bonusFor,
  checked,
  decline,
  formatMoney,
  fresh,
  grant,
  HISTORY_LIMIT,
  parseCents,
  recover,
  restore,
  reveal,
  rewardPhase,
  settle,
  transfer,
  validateWager,
} from "../src/domain";
import type { Side, Snapshot } from "../src/domain";
const round = (
  s: Snapshot,
  side: Side = "heads",
  outcome: Side = "heads",
  wager = "10",
) => settle(s, side, wager, outcome, `${s.generation}:${s.stats.rounds + 1}`);
const done = (s: Snapshot) => reveal(s, s.last!.id);
describe("exact whole-cent money", () => {
  it.each([
    ["1", 100],
    ["1.2", 120],
    ["1.20", 120],
    ["0.01", 1],
    [".50", 50],
    [" 1.20 ", 120],
    ["0001.05", 105],
  ])("parses %s exactly", (s, n) => expect(parseCents(s)).toBe(n));
  it.each([
    "",
    " ",
    "0",
    "0.00",
    "-1",
    "+1",
    "1.001",
    "1e2",
    "Infinity",
    "NaN",
    "1 2",
    "$1",
    "1,000",
    "1..2",
    "1.",
    ".",
    "0x10",
    "1\n2",
    "9".repeat(30),
    "90071992547409.92",
  ])("rejects %j", (s) => expect(() => parseCents(s)).toThrow());
  it("formats exact cents including safe boundaries", () => {
    expect(parseCents("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe("$90,071,992,547,409.91");
    expect(formatMoney(-1)).toBe("-$0.01");
    expect(() => checked(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
});
describe("round transitions", () => {
  it("starts fresh and validates limits without changing state", () => {
    const s = fresh("a");
    expect([s.available, s.bank, s.stats.rounds]).toEqual([10000, 0, 0]);
    expect(validateWager(s, ".01")).toBe(1);
    expect(validateWager(s, "100")).toBe(10000);
    for (const w of ["0", "100.01", "-1"])
      expect(() => round(s, "heads", "heads", w)).toThrow();
    expect(s).toEqual(fresh("a"));
    expect(() => validateWager({ ...s, available: 50 }, "1")).toThrow();
    expect(() => validateWager({ ...s, available: 20000 }, "100.01")).toThrow();
  });
  it.each([
    ["heads", "heads", 11000, 2000, 1000],
    ["heads", "tails", 9000, 0, -1000],
    ["tails", "heads", 9000, 0, -1000],
    ["tails", "tails", 11000, 2000, 1000],
  ] as const)("settles %s vs %s", (side, outcome, available, gross, net) => {
    const s = round(fresh("a"), side, outcome);
    expect([s.available, s.bank, s.last!.gross, s.last!.net]).toEqual([
      available,
      0,
      gross,
      net,
    ]);
    expect(s.stats.rounds).toBe(s.stats.wins + s.stats.losses);
    expect(s.stats.profit).toBe(s.stats.payouts - s.stats.wagered);
    expect(() => settle(s, side, "10", outcome, s.last!.id)).toThrow();
    const revealed = done(s);
    expect(reveal(revealed, s.last!.id)).toBe(revealed);
    expect(() => settle(revealed, side, "10", outcome, s.last!.id)).toThrow();
    expect(revealed.available).toBe(available);
  });
  it("rejects overflow before spending", () => {
    const s = { ...fresh("a"), available: Number.MAX_SAFE_INTEGER };
    expect(() => round(s)).toThrow();
    expect(s.available).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("bounds history while rejecting ancient round commands", () => {
    let s = fresh("a");
    for (let i = 0; i < 45; i++) s = done(round(s, "heads", "heads", "1"));
    expect(s.history).toHaveLength(HISTORY_LIMIT);
    expect(() => settle(s, "heads", "1", "heads", "a:1")).toThrow();
    expect(restore(JSON.stringify(s)).snapshot).toEqual(s);
  });
  it("consumes the previous bonus on a new round", () => {
    let s = done(round(fresh("a")));
    s = round(s);
    expect(s.history[0].bonusStatus).toBe("declined");
  });
});
describe("Safe Bank", () => {
  it("implements exact examples and full source transfers", () => {
    let s = transfer(fresh("a"), "deposit", "35.75");
    expect([s.available, s.bank]).toEqual([6425, 3575]);
    s = transfer(s, "withdraw", "10.25");
    expect([s.available, s.bank]).toEqual([7450, 2550]);
    s = transfer(s, "deposit", "74.50");
    expect([s.available, s.bank]).toEqual([0, 10000]);
    s = transfer(s, "withdraw", "100");
    expect([s.available, s.bank]).toEqual([10000, 0]);
    expect(s.stats).toEqual(fresh("a").stats);
  });
  it.each(["0", "-1", "100.01", "1.001", "Infinity", "1e2"])(
    "rejects transfer %s",
    (input) => {
      const s = fresh("a");
      expect(() => transfer(s, "deposit", input)).toThrow();
      expect(s).toEqual(fresh("a"));
    },
  );
  it("does not cap transfers at $100 and conserves total", () => {
    const s = { ...fresh("a"), available: 25000 };
    const n = transfer(s, "deposit", "200");
    expect(n.available + n.bank).toBe(25000);
    expect(() =>
      transfer({ ...s, bank: Number.MAX_SAFE_INTEGER }, "deposit", "1"),
    ).toThrow();
    expect(() => transfer(fresh("a"), "withdraw", ".01")).toThrow();
  });
});
describe("bound reward intents", () => {
  it.each([
    [2, 0],
    [50, 1],
    [2000, 20],
    [20000, 200],
  ])("rounds 1%% of %i gross to %i cents", (gross, expected) =>
    expect(bonusFor(gross)).toBe(expected),
  );
  it("credits only the matching current intent exactly once and preserves base payout", () => {
    const base = done(round(fresh("a")));
    const s = beginReward(base, "bonus", "ad1", 100, 0, 20),
      intent = s.attempt!;
    expect(s.available).toBe(11000);
    for (const field of [
      { id: "bad" },
      { generation: "bad" },
      { amount: 200 },
      { roundId: "bad" },
      { placement: "refill" as const },
    ])
      expect(grant(s, { ...intent, ...field }, 101)).toBe(s);
    const credited = grant(s, intent, 101);
    expect(credited.available).toBe(11020);
    expect(credited.stats.profit).toBe(1000);
    expect(credited.stats.adCredits).toBe(20);
    expect(grant(credited, intent, 102)).toBe(credited);
    expect(rewardPhase(credited, intent.id, "failed").available).toBe(11020);
    expect(
      restore(JSON.stringify(rewardPhase(credited, intent.id, "closed")))
        .snapshot.available,
    ).toBe(11020);
  });
  it("non-grant states, abandonment, and recovery never invent a grant", () => {
    let s = beginReward(fresh("a"), "refill", "ad", 100, 0, 20);
    for (const phase of ["ready", "showing", "closed"] as const)
      s = rewardPhase(s, "ad", phase);
    expect(s.available).toBe(10000);
    expect(grant(s, s.attempt!, 200)).toBe(s);
    expect(
      activeAttempt(
        recover(beginReward(fresh("a"), "refill", "other", 100, 0, 20)),
      ),
    ).toBe(false);
  });
  it("rejects conflicts, generation replays, expired offers and zero bonus", () => {
    const s = beginReward(fresh("a"), "refill", "ad", 100, 0, 20);
    expect(() => beginReward(s, "refill", "other", 100, 0, 20)).toThrow();
    expect(() => transfer(s, "deposit", "1")).toThrow();
    const credited = rewardPhase(grant(s, s.attempt!, 200), "ad", "closed");
    expect(() =>
      beginReward(credited, "refill", "new", 210, 60000, 20),
    ).toThrow();
    expect(() =>
      beginReward(credited, "refill", "new", 100000, 0, 1),
    ).toThrow();
    expect(grant(fresh("new"), s.attempt!, 300).available).toBe(10000);
    expect(() =>
      beginReward(
        done(round(fresh("a"), "heads", "heads", ".01")),
        "bonus",
        "a",
        100,
        0,
        20,
      ),
    ).toThrow();
    const d = decline(done(round(fresh("a"))));
    expect(() => beginReward(d, "bonus", "a", 100, 0, 20)).toThrow();
  });
  it("allows an explicit retry after no fill and binds the original amount", () => {
    const s = done(round(fresh("a"), "heads", "heads", "100"));
    const a = beginReward(s, "bonus", "a", 100, 0, 20);
    const failed = rewardPhase(a, "a", "unavailable");
    const retry = beginReward(failed, "bonus", "b", 101, 0, 20);
    expect(retry.attempt!.amount).toBe(200);
    expect(grant(retry, a.attempt!, 102)).toBe(retry);
    expect(grant(retry, retry.attempt!, 102).available).toBe(20200);
  });
});
describe("save validation and recovery", () => {
  it("restores an already-settled toss without spending again", () => {
    const s = round(fresh("a"));
    const n = recover(restore(JSON.stringify(s)).snapshot);
    expect(n.available).toBe(11000);
    expect(n.last!.outcome).toBe("heads");
    expect(n.last!.presentationPending).toBe(false);
    expect(n.last!.bonusStatus).toBe("eligible");
    expect(recover(n)).toBe(n);
  });
  it("explicitly migrates the documented pre-ad v1 schema", () => {
    const { attempt, lastRewardAt, rewardCount, ...legacy } = fresh("a");
    void attempt;
    void lastRewardAt;
    void rewardCount;
    const migrated = restore(JSON.stringify({ ...legacy, version: 1 }));
    expect(migrated.migrated).toBe(true);
    expect(migrated.snapshot).toEqual(fresh("a"));
  });
  it.each([
    "{",
    "null",
    "[]",
    JSON.stringify({ ...fresh("a"), version: 99 }),
    JSON.stringify({ ...fresh("a"), available: "10000" }),
    JSON.stringify({ ...fresh("a"), available: -1 }),
    JSON.stringify({ ...fresh("a"), available: 10001 }),
    JSON.stringify({
      ...fresh("a"),
      stats: { ...fresh("a").stats, rounds: 1 },
    }),
    JSON.stringify({ ...fresh("a"), attempt: { id: "x" } }),
  ])("rejects malformed/impossible snapshots", (raw) =>
    expect(() => restore(raw)).toThrow(),
  );
  it("rejects edited round arithmetic, statuses and duplicate histories", () => {
    const s = round(fresh("a"));
    for (const edit of [
      { gross: 3000 },
      { wager: 0.5 },
      { outcome: "bogus" },
      { net: 0 },
      { bonus: 25 },
      { bonusStatus: "none" },
    ]) {
      const last = { ...s.last, ...edit };
      expect(() =>
        restore(JSON.stringify({ ...s, last, history: [last] })),
      ).toThrow();
    }
  });
});
