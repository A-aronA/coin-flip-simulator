import type { AdAdapter, AdEvent } from "./types";
import type { RewardAttempt } from "../domain";
export class MockAdapter implements AdAdapter {
  readonly available = true;
  scenario = "grant";
  run(_intent: Readonly<RewardAttempt>, emit: (event: AdEvent) => void) {
    if (!import.meta.env.DEV) throw new Error("Mock ads are development-only.");
    const timers: ReturnType<typeof setTimeout>[] = [];
    let canceled = false;
    const later = (ms: number, fn: () => void) =>
      timers.push(
        setTimeout(() => {
          if (!canceled) fn();
        }, ms),
      );
    emit("loading");
    const scenario = this.scenario;
    later(100, () => {
      if (scenario === "no-fill") {
        emit("unavailable");
        return;
      }
      if (scenario === "error") {
        emit("failed");
        return;
      }
      emit("ready");
      emit("showing");
    });
    if (!["no-fill", "error"].includes(scenario)) {
      later(scenario === "delayed" ? 2500 : 700, () => {
        if (scenario !== "close") {
          emit("granted");
          if (scenario === "repeated") emit("granted");
        }
        emit("closed");
      });
    }
    return () => {
      canceled = true;
      timers.forEach(clearTimeout);
    };
  }
}
