import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.head.innerHTML = "";
  Object.defineProperty(window, "googletag", {
    value: undefined,
    writable: true,
    configurable: true,
  });
});
afterEach(() => vi.useRealTimers());
it("loads GPT once and resolves through its ready command queue", async () => {
  const { loadGpt } = await import("../src/ads/gpt");
  const a = loadGpt(),
    b = loadGpt();
  expect(a).toBe(b);
  expect(document.querySelectorAll("script[data-coin-gpt]")).toHaveLength(1);
  (googletag.cmd as unknown as (() => void)[])[0]();
  await expect(a).resolves.toBeUndefined();
});
it("reuses an already-ready publisher SDK without loading another script", async () => {
  Object.defineProperty(window, "googletag", {
    value: { apiReady: true },
    writable: true,
  });
  const { loadGpt } = await import("../src/ads/gpt");
  await loadGpt();
  expect(document.querySelectorAll("script")).toHaveLength(0);
});
it("reports script errors and timeouts rather than inventing readiness", async () => {
  const { loadGpt } = await import("../src/ads/gpt");
  const p = loadGpt();
  const assertion = expect(p).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(12000);
  await assertion;
});
it("reports a blocked script load", async () => {
  const { loadGpt } = await import("../src/ads/gpt");
  const p = loadGpt();
  document.querySelector("script")!.dispatchEvent(new Event("error"));
  await expect(p).rejects.toThrow("failed to load");
});
