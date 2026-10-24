import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { GameController } from "../src/controller";
import { fresh, SAVE_KEY } from "../src/domain";
import type { RewardAttempt } from "../src/domain";
import { DisabledAdapter } from "../src/ads/types";
import type { AdAdapter, AdEvent } from "../src/ads/types";
import { readAdConfig } from "../src/ads/config";
class MemoryStorage implements Storage {
  data = new Map<string, string>();
  fail = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    if (this.fail) throw new Error("quota denied");
    this.data.set(k, v);
  }
}
class ManualAds implements AdAdapter {
  available = true;
  events: ((e: AdEvent) => void)[] = [];
  intents: Readonly<RewardAttempt>[] = [];
  canceled = 0;
  run(i: Readonly<RewardAttempt>, fn: (e: AdEvent) => void) {
    this.intents.push(i);
    this.events.push(fn);
    return () => {
      this.canceled++;
    };
  }
}
let storage: MemoryStorage, controllers: GameController[], sequence: number;
function controller(
  extra: ConstructorParameters<typeof GameController>[0] = {},
) {
  const c = new GameController({
    storage,
    id: () => `gen-${++sequence}`,
    outcome: () => "heads",
    reduced: () => true,
    cooldown: 0,
    ...extra,
  });
  controllers.push(c);
  return c;
}
beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  controllers = [];
  sequence = 0;
  let held = false;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _opts: unknown,
        cb: (lock: object | null) => Promise<void>,
      ) => {
        if (held) {
          await cb(null);
          return;
        }
        held = true;
        try {
          await cb({});
        } finally {
          held = false;
        }
      },
    },
  });
});
afterEach(() => {
  controllers.forEach((c) => c.dispose());
  vi.useRealTimers();
});
describe("authoritative transaction controller", () => {
  it("retains a valid settled save if recovery writes fail, and retry keeps ownership", async () => {
    const c = controller();
    await c.start();
    c.flip("heads", "10");
    c.dispose();
    await vi.advanceTimersByTimeAsync(0);
    storage.fail = true;
    const next = controller();
    await next.start();
    expect(next.getView().mode).toBe("blocked");
    expect(next.getView().snapshot!.available).toBe(11000);
    storage.fail = false;
    next.retrySave();
    expect(next.getView().mode).toBe("saved");
    expect(next.getView().tossing).toBe(false);
    expect(next.getView().snapshot!.stats.rounds).toBe(1);
  });
  it("retries initial denied storage without giving up the active lock", async () => {
    const read = vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const c = controller();
    await c.start();
    expect(c.getView().mode).toBe("blocked");
    read.mockRestore();
    c.retrySave();
    expect(c.getView().mode).toBe("saved");
    expect(c.getView().snapshot!.available).toBe(10000);
  });
  it("commits before animation; double activation and repeated callbacks cannot transact", async () => {
    const c = controller();
    await c.start();
    c.flip("heads", "10");
    c.flip("heads", "10");
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).available).toBe(11000);
    expect(c.getView().tossing).toBe(true);
    const id = c.getView().snapshot!.last!.id;
    c.reveal(id);
    c.reveal(id);
    expect(c.getView().snapshot!.stats.rounds).toBe(1);
    expect(c.getView().snapshot!.available).toBe(11000);
  });
  it("recovers a reload during toss without another RNG call", async () => {
    const rng = vi.fn(() => "heads" as const),
      c = controller({ outcome: rng });
    await c.start();
    c.flip("heads", "10");
    c.dispose();
    await vi.advanceTimersByTimeAsync(0);
    const second = controller({ outcome: rng });
    await second.start();
    expect(second.getView().snapshot!.available).toBe(11000);
    expect(second.getView().tossing).toBe(false);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it("watchdog recovers absent animation completion and validates before randomness", async () => {
    const rng = vi.fn(() => "tails" as const),
      c = controller({ outcome: rng, reduced: () => false });
    await c.start();
    c.flip("heads", "0");
    expect(rng).not.toHaveBeenCalled();
    c.flip("heads", "10");
    await vi.advanceTimersByTimeAsync(2100);
    expect(c.getView().tossing).toBe(false);
    expect(c.getView().snapshot!.available).toBe(9000);
  });
  it("a missing secure outcome or write failure spends nothing", async () => {
    const c = controller({
      outcome: () => {
        throw new Error("Secure randomness unavailable");
      },
    });
    await c.start();
    c.flip("heads", "10");
    expect(c.getView().snapshot!.available).toBe(10000);
    const d = controller();
    c.dispose();
    await vi.advanceTimersByTimeAsync(0);
    await d.start();
    storage.fail = true;
    d.flip("heads", "10");
    expect(d.getView().mode).toBe("blocked");
    expect(d.getView().snapshot!.available).toBe(10000);
    expect(d.getView().tossing).toBe(false);
    storage.fail = false;
    d.retrySave();
    expect(d.getView().mode).toBe("saved");
    expect(d.getView().snapshot!.stats.rounds).toBe(0);
  });
  it("guards rapid stale transfers, saves stats, resets generation explicitly", async () => {
    const c = controller();
    await c.start();
    c.transfer("deposit", "35.75");
    c.transfer("deposit", "35.75");
    expect(c.getView().snapshot!.bank).toBe(3575);
    await vi.advanceTimersByTimeAsync(300);
    c.transfer("withdraw", "10.25");
    expect(c.getView().snapshot!.available).toBe(7450);
    await vi.advanceTimersByTimeAsync(300);
    const generation = c.getView().snapshot!.generation;
    c.reset();
    expect(c.getView().snapshot!.available).toBe(10000);
    expect(c.getView().snapshot!.generation).not.toBe(generation);
  });
  it("preserves corrupt/unknown saves until explicit reset", async () => {
    const raw = JSON.stringify({ ...fresh("a"), version: 999 });
    storage.setItem(SAVE_KEY, raw);
    const c = controller();
    await c.start();
    expect(c.getView().mode).toBe("blocked");
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
    c.reset();
    expect(c.getView().snapshot!.available).toBe(10000);
    expect(c.getView().mode).toBe("saved");
  });
  it("only one tab writes; readonly syncs and retries ownership after close", async () => {
    const a = controller(),
      b = controller();
    await a.start();
    await b.start();
    expect(b.getView().mode).toBe("readonly");
    b.flip("heads", "10");
    a.transfer("deposit", "25");
    window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY }));
    expect(b.getView().snapshot!.bank).toBe(2500);
    a.dispose();
    await vi.advanceTimersByTimeAsync(0);
    b.retryOwnership();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.getView().mode).toBe("saved");
  });
  it("uses isolated session-only state when Web Locks are missing", async () => {
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    });
    const c = controller();
    await c.start();
    c.flip("heads", "1");
    expect(c.getView().mode).toBe("session");
    expect(storage.length).toBe(0);
    expect(c.getView().snapshot!.available).toBe(10100);
  });
  it("storage failure can continue explicitly without touching shared data", async () => {
    const c = controller();
    await c.start();
    storage.fail = true;
    c.transfer("deposit", "1");
    c.continueSession();
    expect(c.getView().mode).toBe("session");
    c.transfer("deposit", "2");
    expect(c.getView().snapshot!.bank).toBe(200);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).bank).toBe(0);
  });
});
describe("reward lifecycle and production guards", () => {
  it("disabled ads and production mock configuration cannot simulate rewards", async () => {
    const fn = vi.fn();
    new DisabledAdapter().run({} as RewardAttempt, fn);
    expect(fn).toHaveBeenCalledWith("unavailable");
    expect(() =>
      readAdConfig(
        { VITE_AD_PROVIDER: "mock", VITE_ENABLE_DEV_ADS: "true" },
        false,
      ),
    ).toThrow();
    expect(() => readAdConfig({ VITE_AD_PROVIDER: "mock" }, true)).toThrow();
    const c = controller();
    await c.start();
    c.reward("refill");
    expect(c.getView().snapshot!.available).toBe(10000);
  });
  it("readiness, time and close never grant; matching grants apply once", async () => {
    const ads = new ManualAds(),
      c = controller({ adapter: ads });
    await c.start();
    c.reward("refill");
    ads.events[0]("ready");
    ads.events[0]("showing");
    await vi.advanceTimersByTimeAsync(5000);
    expect(c.getView().snapshot!.available).toBe(10000);
    ads.events[0]("closed");
    expect(c.getView().snapshot!.available).toBe(10000);
    c.reward("refill");
    ads.events[1]("granted");
    ads.events[1]("granted");
    ads.events[1]("failed");
    expect(c.getView().snapshot!.available).toBe(11000);
    expect(c.getView().snapshot!.stats.adCredits).toBe(1000);
  });
  it("late callbacks after cancellation or reset cannot credit a newer attempt", async () => {
    const ads = new ManualAds(),
      c = controller({ adapter: ads });
    await c.start();
    c.reward("refill");
    c.cancelReward();
    c.reset();
    c.reward("refill");
    ads.events[0]("granted");
    expect(c.getView().snapshot!.available).toBe(10000);
    ads.events[1]("granted");
    ads.events[1]("closed");
    expect(c.getView().snapshot!.available).toBe(11000);
  });
  it("retains a genuine grant in memory on quota failure and retries exactly that credit", async () => {
    const ads = new ManualAds(),
      c = controller({ adapter: ads });
    await c.start();
    c.reward("refill");
    storage.fail = true;
    ads.events[0]("granted");
    ads.events[0]("closed");
    expect(c.getView().mode).toBe("blocked");
    expect(c.getView().snapshot!.available).toBe(10000);
    storage.fail = false;
    c.retrySave();
    expect(c.getView().snapshot!.available).toBe(11000);
    ads.events[0]("granted");
    c.retrySave();
    expect(c.getView().snapshot!.available).toBe(11000);
  });
  it("reloading unconfirmed attempts retires old events without invented credits", async () => {
    const ads = new ManualAds(),
      c = controller({ adapter: ads });
    await c.start();
    c.reward("refill");
    c.dispose();
    await vi.advanceTimersByTimeAsync(0);
    const next = controller({ adapter: ads });
    await next.start();
    expect(next.getView().busy).toBe(false);
    expect(next.getView().snapshot!.available).toBe(10000);
    ads.events[0]("granted");
    expect(next.getView().snapshot!.available).toBe(10000);
  });
});
