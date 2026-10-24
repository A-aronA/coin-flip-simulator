import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamAdapter } from "../src/ads/gam";
import { loadGpt } from "../src/ads/gpt";
import { beginReward, fresh } from "../src/domain";
vi.mock("../src/ads/gpt", () => ({
  loadGpt: vi.fn(() => Promise.resolve()),
  enableGpt: vi.fn(),
}));
const intent = () =>
  beginReward(fresh("g"), "refill", "attempt", 100, 0, 20).attempt!;
let handlers: Map<string, (e: unknown) => void>,
  slot: object,
  show: ReturnType<typeof vi.fn>,
  destroy: ReturnType<typeof vi.fn>;
const emit = (name: string, extra: Record<string, unknown> = {}) =>
  handlers.get(name)?.({ slot, ...extra });
beforeEach(() => {
  vi.useFakeTimers();
  handlers = new Map();
  slot = { addService: vi.fn() };
  show = vi.fn(() => true);
  destroy = vi.fn();
  const pub = {
    addEventListener: vi.fn((name: string, fn: (e: unknown) => void) => {
      handlers.set(name, fn);
    }),
    removeEventListener: vi.fn((name: string) => handlers.delete(name)),
  };
  Object.defineProperty(window, "googletag", {
    configurable: true,
    value: {
      pubads: () => pub,
      defineOutOfPageSlot: vi.fn(() => slot),
      enums: { OutOfPageFormat: { REWARDED: 1 } },
      display: vi.fn(),
      destroySlots: destroy,
    },
  });
  vi.mocked(loadGpt).mockResolvedValue();
});
afterEach(() => vi.useRealTimers());
const flush = () => Promise.resolve();
describe("real GPT adapter at SDK boundary", () => {
  it("requests only after consent and never enables the variable production bonus", () => {
    const fn = vi.fn(),
      a = new GamAdapter(
        "/network/unit",
        () => false,
        "game_credit_cent",
        1000,
      );
    a.run(intent(), fn);
    expect(fn).toHaveBeenCalledWith("unavailable");
    expect(loadGpt).not.toHaveBeenCalled();
    const b = new GamAdapter(
      "/network/unit",
      () => true,
      "game_credit_cent",
      1000,
    );
    b.run({ ...intent(), placement: "bonus" }, fn);
    expect(loadGpt).not.toHaveBeenCalled();
  });
  it("registers before display, ignores foreign slots, and grants only matching fixed metadata", async () => {
    const fn = vi.fn(),
      cancel = new GamAdapter(
        "/network/unit",
        () => true,
        "game_credit_cent",
        1000,
      ).run(intent(), fn);
    await flush();
    expect(handlers.has("rewardedSlotGranted")).toBe(true);
    emit("rewardedSlotReady", { slot: {}, makeRewardedVisible: show });
    expect(show).not.toHaveBeenCalled();
    emit("rewardedSlotReady", { makeRewardedVisible: show });
    emit("rewardedSlotReady", { makeRewardedVisible: show });
    expect(show).toHaveBeenCalledOnce();
    expect(fn).not.toHaveBeenCalledWith("granted");
    emit("rewardedSlotVideoCompleted");
    expect(fn).not.toHaveBeenCalledWith("granted");
    emit("rewardedSlotGranted", {
      slot: {},
      payload: { type: "game_credit_cent", amount: 1000 },
    });
    expect(fn).not.toHaveBeenCalledWith("granted");
    emit("rewardedSlotGranted", {
      payload: { type: "game_credit_cent", amount: 1000 },
    });
    emit("rewardedSlotGranted", {
      payload: { type: "game_credit_cent", amount: 1000 },
    });
    expect(fn.mock.calls.filter(([e]) => e === "granted")).toHaveLength(1);
    emit("rewardedSlotClosed");
    expect(destroy).toHaveBeenCalledWith([slot]);
    expect(handlers.size).toBe(0);
    cancel();
  });
  it.each([
    "null",
    "no-fill",
    "invisible",
    "throws",
    "metadata",
    "timeout",
  ] as const)("handles %s without a grant", async (scenario) => {
    const fn = vi.fn();
    if (scenario === "null")
      vi.spyOn(googletag, "defineOutOfPageSlot").mockReturnValue(null);
    const cancel = new GamAdapter(
      "/network/unit",
      () => true,
      "game_credit_cent",
      1000,
    ).run(intent(), fn);
    await flush();
    if (scenario === "no-fill") emit("slotRenderEnded", { isEmpty: true });
    if (scenario === "invisible")
      emit("rewardedSlotReady", { makeRewardedVisible: () => false });
    if (scenario === "throws")
      emit("rewardedSlotReady", {
        makeRewardedVisible: () => {
          throw new Error("unsupported");
        },
      });
    if (scenario === "metadata")
      emit("rewardedSlotGranted", {
        payload: { type: "unexpected", amount: 50000 },
      });
    if (scenario === "timeout") await vi.advanceTimersByTimeAsync(180000);
    expect(fn).not.toHaveBeenCalledWith("granted");
    expect(fn).toHaveBeenCalledWith(
      ["null", "no-fill"].includes(scenario) ? "unavailable" : "failed",
    );
    cancel();
  });
  it("cancels while the SDK loads, so a late ready cannot show an abandoned attempt", async () => {
    let finish!: () => void;
    vi.mocked(loadGpt).mockReturnValue(
      new Promise<void>((r) => {
        finish = r;
      }),
    );
    const fn = vi.fn(),
      cancel = new GamAdapter(
        "/network/unit",
        () => true,
        "game_credit_cent",
        1000,
      ).run(intent(), fn);
    cancel();
    finish();
    await flush();
    expect(googletag.display).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalledWith("granted");
  });
  it("handles a blocked or failed SDK without falling back to a mock", async () => {
    vi.mocked(loadGpt).mockRejectedValue(new Error("blocked"));
    const fn = vi.fn();
    new GamAdapter("/network/unit", () => true, "game_credit_cent", 1000).run(
      intent(),
      fn,
    );
    await flush();
    expect(fn).toHaveBeenCalledWith("failed");
    expect(fn).not.toHaveBeenCalledWith("granted");
  });
});
