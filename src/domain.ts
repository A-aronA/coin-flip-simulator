export type Side = "heads" | "tails";
export type Placement = "refill" | "bonus";
export type BonusStatus = "none" | "eligible" | "declined" | "credited";
export type RewardPhase =
  | "loading"
  | "ready"
  | "showing"
  | "granted"
  | "closed"
  | "unavailable"
  | "failed";
export interface Round {
  id: string;
  side: Side;
  outcome: Side;
  wager: number;
  gross: number;
  net: number;
  before: number;
  after: number;
  presentationPending: boolean;
  bonus: number;
  bonusStatus: BonusStatus;
}
export interface Stats {
  wins: number;
  losses: number;
  rounds: number;
  wagered: number;
  payouts: number;
  profit: number;
  adCredits: number;
}
export interface RewardAttempt {
  id: string;
  generation: string;
  placement: Placement;
  amount: number;
  roundId: string | null;
  phase: RewardPhase;
  credited: boolean;
}
export interface Snapshot {
  version: 2;
  revision: number;
  generation: string;
  available: number;
  bank: number;
  stats: Stats;
  last: Round | null;
  history: Round[];
  attempt: RewardAttempt | null;
  lastRewardAt: number;
  rewardCount: number;
}
export const SAVE_KEY = "coin-flip.save";
export const HISTORY_LIMIT = 20;
export const integer = (n: number) => Number.isSafeInteger(n);
export function checked(...values: number[]): number {
  const n = values.reduce((a, b) => a + b, 0);
  if (!values.every(integer) || !integer(n))
    throw new Error("This amount exceeds the safe credit limit.");
  return n;
}
export function parseCents(input: string): number {
  const value = input.trim();
  if (value.length > 18 || !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value))
    throw new Error(
      "Enter a positive amount with up to 2 decimal places, such as 1.50.",
    );
  const [whole = "", fraction = ""] = value.split(".");
  const cents = BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents <= 0n) throw new Error("Amount must be at least $0.01.");
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("This amount exceeds the safe credit limit.");
  return Number(cents);
}
export function formatMoney(cents: number): string {
  const n = BigInt(cents);
  const a = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}$${(a / 100n).toLocaleString("en-US")}.${(a % 100n).toString().padStart(2, "0")}`;
}
export const bonusFor = (gross: number): number =>
  Math.floor(checked(gross, 50) / 100);
export function fresh(generation: string): Snapshot {
  return {
    version: 2,
    revision: 0,
    generation,
    available: 10000,
    bank: 0,
    stats: {
      wins: 0,
      losses: 0,
      rounds: 0,
      wagered: 0,
      payouts: 0,
      profit: 0,
      adCredits: 0,
    },
    last: null,
    history: [],
    attempt: null,
    lastRewardAt: 0,
    rewardCount: 0,
  };
}
export const activeAttempt = (s: Snapshot) =>
  !!s.attempt &&
  ["loading", "ready", "showing", "granted"].includes(s.attempt.phase);
export function unlocked(s: Snapshot) {
  if (s.last?.presentationPending || activeAttempt(s))
    throw new Error("Finish the current flip or ad first.");
}
export function validateWager(s: Snapshot, input: string): number {
  const n = parseCents(input);
  if (n > 10000) throw new Error("The maximum wager is $100.00.");
  if (n > s.available)
    throw new Error("Your wager exceeds your available credits.");
  checked(s.available, n, s.bank);
  checked(s.stats.wagered, n);
  checked(s.stats.payouts, n, n);
  return n;
}
export function settle(
  s: Snapshot,
  side: Side,
  input: string,
  outcome: Side,
  id: string,
): Snapshot {
  unlocked(s);
  if (
    !["heads", "tails"].includes(side) ||
    !["heads", "tails"].includes(outcome)
  )
    throw new Error("Invalid coin side.");
  if (id !== `${s.generation}:${s.stats.rounds + 1}`)
    throw new Error("This round is stale or has already settled.");
  const wager = validateWager(s, input),
    won = side === outcome,
    gross = won ? wager * 2 : 0,
    net = gross - wager;
  const after = checked(s.available, -wager, gross);
  checked(after, s.bank);
  const bonus = won ? bonusFor(gross) : 0;
  const round: Round = {
    id,
    side,
    outcome,
    wager,
    gross,
    net,
    before: s.available,
    after,
    presentationPending: true,
    bonus,
    bonusStatus: bonus ? "eligible" : "none",
  };
  const history = s.history.map((r) =>
    r.bonusStatus === "eligible"
      ? { ...r, bonusStatus: "declined" as const }
      : r,
  );
  return {
    ...s,
    attempt: null,
    revision: checked(s.revision, 1),
    available: after,
    stats: {
      ...s.stats,
      wins: checked(s.stats.wins, won ? 1 : 0),
      losses: checked(s.stats.losses, won ? 0 : 1),
      rounds: checked(s.stats.rounds, 1),
      wagered: checked(s.stats.wagered, wager),
      payouts: checked(s.stats.payouts, gross),
      profit: checked(s.stats.profit, net),
    },
    last: round,
    history: [...history, round].slice(-HISTORY_LIMIT),
  };
}
function updateLast(s: Snapshot, round: Round): Snapshot {
  return {
    ...s,
    revision: checked(s.revision, 1),
    last: round,
    history: s.history.map((r) => (r.id === round.id ? round : r)),
  };
}
export function reveal(s: Snapshot, id: string): Snapshot {
  return s.last?.id === id && s.last.presentationPending
    ? updateLast(s, { ...s.last, presentationPending: false })
    : s;
}
export function decline(s: Snapshot): Snapshot {
  unlocked(s);
  return s.last?.bonusStatus === "eligible"
    ? updateLast(s, { ...s.last, bonusStatus: "declined" })
    : s;
}
export function transfer(
  s: Snapshot,
  mode: "deposit" | "withdraw",
  input: string,
): Snapshot {
  unlocked(s);
  if (!["deposit", "withdraw"].includes(mode))
    throw new Error("Invalid transfer mode.");
  const n = parseCents(input),
    from = mode === "deposit" ? s.available : s.bank;
  if (n > from) throw new Error("Amount exceeds the source balance.");
  return {
    ...s,
    revision: checked(s.revision, 1),
    available: checked(s.available, mode === "deposit" ? -n : n),
    bank: checked(s.bank, mode === "deposit" ? n : -n),
  };
}
export function beginReward(
  s: Snapshot,
  placement: Placement,
  id: string,
  now: number,
  cooldown: number,
  maxRewards: number,
): Snapshot {
  unlocked(s);
  if (!["refill", "bonus"].includes(placement) || !id || id === s.attempt?.id)
    throw new Error("Invalid reward attempt.");
  if (
    s.rewardCount >= maxRewards ||
    (s.lastRewardAt > 0 && now - s.lastRewardAt < cooldown)
  )
    throw new Error("Ad reward limit reached. Please try again later.");
  if (
    placement === "bonus" &&
    (!s.last || s.last.bonusStatus !== "eligible" || !s.last.bonus)
  )
    throw new Error("This bonus is no longer available.");
  const amount = placement === "refill" ? 1000 : s.last!.bonus;
  checked(s.available, s.bank, amount);
  checked(s.stats.adCredits, amount);
  return {
    ...s,
    revision: checked(s.revision, 1),
    attempt: {
      id,
      generation: s.generation,
      placement,
      amount,
      roundId: placement === "bonus" ? s.last!.id : null,
      phase: "loading",
      credited: false,
    },
  };
}
export function grant(
  s: Snapshot,
  intent: RewardAttempt,
  now: number,
): Snapshot {
  const a = s.attempt;
  if (
    !a ||
    a.id !== intent.id ||
    a.generation !== s.generation ||
    intent.generation !== s.generation ||
    a.roundId !== intent.roundId ||
    a.amount !== intent.amount ||
    a.placement !== intent.placement ||
    !activeAttempt(s) ||
    a.credited
  )
    return s;
  if (
    a.placement === "bonus" &&
    (s.last?.id !== a.roundId ||
      s.last.bonusStatus !== "eligible" ||
      s.last.bonus !== a.amount)
  )
    return s;
  let next: Snapshot = {
    ...s,
    revision: checked(s.revision, 1),
    available: checked(s.available, a.amount),
    stats: { ...s.stats, adCredits: checked(s.stats.adCredits, a.amount) },
    attempt: { ...a, phase: "granted" as const, credited: true },
    lastRewardAt: now,
    rewardCount: checked(s.rewardCount, 1),
  };
  checked(next.available, next.bank);
  if (a.placement === "bonus")
    next = updateLast(next, { ...next.last!, bonusStatus: "credited" });
  return next;
}
export function rewardPhase(
  s: Snapshot,
  id: string,
  phase: RewardPhase,
): Snapshot {
  if (s.attempt?.id !== id || !activeAttempt(s)) return s;
  // A grant is durable; an error/close cannot undo it.
  return {
    ...s,
    revision: checked(s.revision, 1),
    attempt: {
      ...s.attempt,
      phase:
        s.attempt.credited && ["failed", "unavailable"].includes(phase)
          ? "closed"
          : phase,
    },
  };
}
export function secureOutcome(): Side {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Secure randomness is unavailable. No credits were spent.");
  return (crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 0
    ? "heads"
    : "tails";
}

function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid save structure.");
  return v as Record<string, unknown>;
}
function nonnegative(v: unknown): number {
  if (typeof v !== "number" || !integer(v) || v < 0)
    throw new Error("Invalid save amount or counter.");
  return v;
}
function text(v: unknown): string {
  if (typeof v !== "string" || !v.length || v.length > 160)
    throw new Error("Invalid save identifier.");
  return v;
}
function validRound(v: unknown, generation: string): Round {
  const r = obj(v);
  text(r.id);
  if (
    !String(r.id).startsWith(`${generation}:`) ||
    !["heads", "tails"].includes(String(r.side)) ||
    !["heads", "tails"].includes(String(r.outcome)) ||
    typeof r.presentationPending !== "boolean" ||
    !["none", "eligible", "declined", "credited"].includes(
      String(r.bonusStatus),
    )
  )
    throw new Error("Invalid saved round.");
  for (const k of ["wager", "gross", "before", "after", "bonus"])
    nonnegative(r[k]);
  const a = r as unknown as Round,
    won = a.side === a.outcome;
  if (
    a.wager < 1 ||
    a.wager > 10000 ||
    a.before < a.wager ||
    a.gross !== (won ? a.wager * 2 : 0) ||
    a.net !== a.gross - a.wager ||
    a.after !== checked(a.before, a.net) ||
    a.bonus !== (won ? bonusFor(a.gross) : 0) ||
    (a.bonus === 0) !== (a.bonusStatus === "none")
  )
    throw new Error("Inconsistent saved round.");
  return a;
}
export function restore(raw: string): {
  snapshot: Snapshot;
  migrated: boolean;
} {
  const input = obj(JSON.parse(raw));
  if (input.version !== 1 && input.version !== 2)
    throw new Error(
      "Unsupported save version. Your original data has been preserved.",
    );
  // Explicit v1 schema: same wallet/round/stat fields, before reward attempts were introduced.
  const migrated = input.version === 1;
  if (
    migrated &&
    (obj(input.stats).adCredits !== 0 ||
      input.attempt !== undefined ||
      input.lastRewardAt !== undefined ||
      input.rewardCount !== undefined)
  )
    throw new Error("Unsupported legacy reward data.");
  const data = migrated
    ? { ...input, version: 2, attempt: null, lastRewardAt: 0, rewardCount: 0 }
    : input;
  text(data.generation);
  nonnegative(data.revision);
  nonnegative(data.available);
  nonnegative(data.bank);
  nonnegative(data.lastRewardAt);
  nonnegative(data.rewardCount);
  const stats = obj(data.stats);
  for (const k of [
    "wins",
    "losses",
    "rounds",
    "wagered",
    "payouts",
    "adCredits",
  ])
    nonnegative(stats[k]);
  if (typeof stats.profit !== "number" || !integer(stats.profit))
    throw new Error("Invalid saved profit.");
  const s = data as unknown as Snapshot,
    st = s.stats;
  if (
    st.rounds !== checked(st.wins, st.losses) ||
    st.profit !== checked(st.payouts, -st.wagered) ||
    checked(s.available, s.bank) !== checked(10000, st.profit, st.adCredits) ||
    st.wagered < st.rounds ||
    BigInt(st.wagered) > BigInt(st.rounds) * 10000n ||
    st.payouts % 2 !== 0 ||
    BigInt(st.payouts) > BigInt(st.wins) * 20000n ||
    st.payouts < st.wins * 2 ||
    s.rewardCount > st.adCredits ||
    (s.rewardCount === 0) !== (st.adCredits === 0) ||
    (s.rewardCount === 0) !== (s.lastRewardAt === 0)
  )
    throw new Error("Inconsistent saved balances or statistics.");
  if (
    !Array.isArray(data.history) ||
    s.history.length > HISTORY_LIMIT ||
    s.history.length !== Math.min(st.rounds, HISTORY_LIMIT)
  )
    throw new Error("Invalid saved history.");
  const losingStakes = BigInt(st.wagered) - BigInt(st.payouts) / 2n;
  if (
    losingStakes < BigInt(st.losses) ||
    losingStakes > BigInt(st.losses) * 10000n
  )
    throw new Error("Impossible saved loss accounting.");
  const ids = new Set<string>();
  s.history.forEach((v, i) => {
    const r = validRound(v, s.generation);
    if (
      ids.has(r.id) ||
      r.id !== `${s.generation}:${st.rounds - s.history.length + i + 1}` ||
      (i < s.history.length - 1 &&
        (r.presentationPending || r.bonusStatus === "eligible"))
    )
      throw new Error("Invalid round history.");
    ids.add(r.id);
  });
  const recentTotals = s.history.reduce(
    (a, r) => ({
      wager: checked(a.wager, r.wager),
      payout: checked(a.payout, r.gross),
      wins: a.wins + (r.net > 0 ? 1 : 0),
      losses: a.losses + (r.net < 0 ? 1 : 0),
      bonus: checked(a.bonus, r.bonusStatus === "credited" ? r.bonus : 0),
    }),
    { wager: 0, payout: 0, wins: 0, losses: 0, bonus: 0 },
  );
  if (
    recentTotals.wager > st.wagered ||
    recentTotals.payout > st.payouts ||
    recentTotals.wins > st.wins ||
    recentTotals.losses > st.losses ||
    recentTotals.bonus > st.adCredits
  )
    throw new Error("History contradicts saved totals.");
  if (
    st.rounds === 0
      ? s.last !== null
      : !s.last ||
        JSON.stringify(validRound(s.last, s.generation)) !==
          JSON.stringify(s.history.at(-1))
  )
    throw new Error("Invalid latest round.");
  if (data.attempt !== null) {
    const a = obj(data.attempt);
    text(a.id);
    if (
      a.generation !== s.generation ||
      !["refill", "bonus"].includes(String(a.placement)) ||
      ![
        "loading",
        "ready",
        "showing",
        "granted",
        "closed",
        "unavailable",
        "failed",
      ].includes(String(a.phase)) ||
      typeof a.credited !== "boolean"
    )
      throw new Error("Invalid reward attempt.");
    nonnegative(a.amount);
    if (a.placement === "refill") {
      if (a.amount !== 1000 || a.roundId !== null)
        throw new Error("Invalid bound refill.");
    } else {
      const allowedStatuses = a.credited
        ? ["credited"]
        : activeAttempt(s)
          ? ["eligible"]
          : ["eligible", "declined"];
      if (
        !s.last ||
        a.roundId !== s.last.id ||
        a.amount !== s.last.bonus ||
        !s.last.bonus ||
        !allowedStatuses.includes(s.last.bonusStatus)
      )
        throw new Error("Invalid bound bonus.");
    }
    if (
      a.credited &&
      (s.stats.adCredits < (a.amount as number) ||
        !s.rewardCount ||
        !["granted", "closed"].includes(String(a.phase)))
    )
      throw new Error("Invalid reward completion.");
    if (a.phase === "granted" && !a.credited)
      throw new Error("Unconfirmed saved grant.");
    if (s.last?.presentationPending && activeAttempt(s))
      throw new Error("Conflicting saved actions.");
  }
  return { snapshot: s, migrated };
}
export function recover(s: Snapshot): Snapshot {
  let next = s.last?.presentationPending ? reveal(s, s.last.id) : s;
  if (activeAttempt(next)) next = rewardPhase(next, next.attempt!.id, "closed");
  return next;
}
