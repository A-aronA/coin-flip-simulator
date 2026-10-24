import type { RewardAttempt } from "../domain";
export type AdEvent =
  | "loading"
  | "ready"
  | "showing"
  | "granted"
  | "closed"
  | "unavailable"
  | "failed";
export interface AdAdapter {
  readonly available: boolean;
  run(
    intent: Readonly<RewardAttempt>,
    event: (event: AdEvent) => void,
  ): () => void;
}
export class DisabledAdapter implements AdAdapter {
  readonly available = false;
  run(_intent: Readonly<RewardAttempt>, event: (event: AdEvent) => void) {
    event("unavailable");
    return () => {};
  }
}
