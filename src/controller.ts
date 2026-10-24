import {
  activeAttempt,
  beginReward,
  decline,
  fresh,
  grant,
  recover,
  restore,
  reveal,
  rewardPhase,
  SAVE_KEY,
  secureOutcome,
  settle,
  transfer,
  unlocked,
  validateWager,
} from "./domain";
import type { Placement, RewardAttempt, Side, Snapshot } from "./domain";
import { DisabledAdapter } from "./ads/types";
import type { AdAdapter, AdEvent } from "./ads/types";
import { adConfig, consentGate } from "./ads/config";
export interface View {
  snapshot: Snapshot | null;
  mode: "loading" | "saved" | "readonly" | "session" | "blocked";
  error: string;
  notice: string;
  busy: boolean;
  tossing: boolean;
  adState: string;
  adsAvailable: boolean;
  bonusAvailable: boolean;
  mockEnabled: boolean;
  mockScenario: string;
}
export interface ControllerOptions {
  storage?: Storage;
  outcome?: () => Side;
  id?: () => string;
  now?: () => number;
  adapter?: AdAdapter;
  session?: boolean;
  cooldown?: number;
  maxRewards?: number;
  reduced?: () => boolean;
}
export class GameController {
  private view: View = {
    snapshot: null,
    mode: "loading",
    error: "",
    notice: "",
    busy: false,
    tossing: false,
    adState: "disabled",
    adsAvailable: false,
    bonusAvailable: false,
    mockEnabled: false,
    mockScenario: "grant",
  };
  private listeners = new Set<() => void>();
  private started = false;
  private owner = false;
  private release?: () => void;
  private retryCandidate: Snapshot | null = null;
  private cancelAd?: () => void;
  private adToken = 0;
  private watchdog?: ReturnType<typeof setTimeout>;
  private transferTimer?: ReturnType<typeof setTimeout>;
  private quickGuard = false;
  private disposed = false;
  private unsubscribeConsent?: () => void;
  private adapter: AdAdapter;
  private storage?: Storage;
  constructor(private options: ControllerOptions = {}) {
    this.adapter = options.adapter ?? new DisabledAdapter();
    this.storage = options.storage;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getView = () => this.view;
  private publish(update: Partial<View> = {}) {
    const v = { ...this.view, ...update },
      s = v.snapshot;
    v.tossing = !!s?.last?.presentationPending;
    v.busy = v.tossing || (!!s && activeAttempt(s)) || this.quickGuard;
    v.adsAvailable =
      this.adapter.available && ["saved", "session"].includes(v.mode);
    v.bonusAvailable = v.adsAvailable && adConfig.provider !== "gam";
    this.view = v;
    this.listeners.forEach((fn) => fn());
  }
  private id() {
    return (
      this.options.id?.() ??
      globalThis.crypto?.randomUUID?.() ??
      `session-${Date.now()}-${performance.now()}-${++fallbackId}`
    );
  }
  private now() {
    return this.options.now?.() ?? Date.now();
  }
  async start() {
    if (this.started) return;
    this.started = true;
    this.unsubscribeConsent = consentGate.subscribe(() => {
      if (!consentGate.allowsRequests() && adConfig.provider === "gam")
        this.cancelReward();
      this.publish();
    });
    if (!this.options.adapter) {
      if (import.meta.env.DEV && adConfig.provider === "mock") {
        const { MockAdapter } = await import("./ads/mock");
        this.adapter = new MockAdapter();
        this.publish({ mockEnabled: true, adState: "ready" });
      } else if (adConfig.provider === "gam" && adConfig.consent) {
        const { GamAdapter } = await import("./ads/gam");
        this.adapter = new GamAdapter(
          adConfig.refillPath,
          () => adConfig.consent && consentGate.allowsRequests(),
          adConfig.rewardType,
          adConfig.rewardAmount,
        );
      }
    }
    if (this.options.session) {
      this.owner = true;
      this.publish({
        snapshot: fresh(this.id()),
        mode: "session",
        notice: "Session only. Progress is not saved.",
      });
      return;
    }
    if (!navigator.locks) {
      this.owner = true;
      this.publish({
        snapshot: fresh(this.id()),
        mode: "session",
        notice:
          "Isolated session only: this browser cannot coordinate shared saves.",
      });
      return;
    }
    window.addEventListener("storage", this.onStorage);
    window.addEventListener("pagehide", this.dispose);
    await this.acquire();
  }
  private async acquire() {
    await new Promise<void>((resolve) => {
      void navigator.locks
        .request(
          "coin-flip.active-writer",
          { ifAvailable: true },
          async (lock) => {
            if (this.disposed) {
              resolve();
              return;
            }
            if (!lock) {
              this.owner = false;
              this.readSecondary();
              resolve();
              return;
            }
            this.owner = true;
            this.initialize();
            resolve();
            await new Promise<void>((done) => {
              this.release = done;
            });
          },
        )
        .catch((error) => {
          this.publish({ mode: "blocked", error: this.message(error) });
          resolve();
        });
    });
  }
  private initialize() {
    let original: Snapshot | null = null;
    try {
      this.storage ??= window.localStorage;
      const raw = this.storage.getItem(SAVE_KEY);
      const loaded =
        raw === null
          ? { snapshot: fresh(this.id()), migrated: false }
          : restore(raw);
      original = raw === null ? null : loaded.snapshot;
      const next = recover(loaded.snapshot);
      if (raw === null || loaded.migrated || next !== loaded.snapshot)
        this.storage.setItem(SAVE_KEY, JSON.stringify(next));
      this.publish({
        snapshot: next,
        mode: "saved",
        error: "",
        notice: "Progress saved on this browser.",
      });
    } catch (error) {
      this.publish({
        snapshot: original,
        mode: "blocked",
        error: this.message(error),
        notice:
          "Your existing save has not been replaced. Retry, reset explicitly, or continue in an isolated session.",
      });
    }
  }
  private readSecondary() {
    try {
      this.storage ??= window.localStorage;
      const raw = this.storage.getItem(SAVE_KEY);
      this.publish({
        snapshot: raw ? restore(raw).snapshot : null,
        mode: "readonly",
        error: "",
        notice:
          "Another tab owns this wallet. This tab is read-only; retry when the other tab closes.",
      });
    } catch (error) {
      this.publish({ mode: "readonly", error: this.message(error) });
    }
  }
  private onStorage = (e: StorageEvent) => {
    if (e.key !== SAVE_KEY && e.key !== null) return;
    if (!this.owner) this.readSecondary();
    else
      this.publish({
        mode: "blocked",
        error:
          "The shared save changed or was cleared outside this tab. Your in-memory progress is preserved. Retry saving or continue session-only.",
      });
  };
  retryOwnership = () => {
    if (!this.owner) void this.acquire();
  };
  private message(error: unknown) {
    return error instanceof Error
      ? error.message
      : "The save could not be accessed.";
  }
  private state(): Snapshot {
    if (
      !this.owner ||
      !["saved", "session"].includes(this.view.mode) ||
      !this.view.snapshot ||
      this.quickGuard
    )
      throw new Error("Wallet is unavailable or busy.");
    return this.view.snapshot;
  }
  private commit(next: Snapshot, retain = false): boolean {
    if (next === this.view.snapshot) return true;
    try {
      if (!["saved", "session"].includes(this.view.mode))
        throw new Error("Storage recovery is required.");
      if (this.view.mode === "saved") {
        if (!this.owner || !this.storage)
          throw new Error("Save ownership is unavailable.");
        this.storage.setItem(SAVE_KEY, JSON.stringify(next));
      }
      this.retryCandidate = null;
      this.publish({ snapshot: next, error: "" });
      return true;
    } catch (error) {
      if (retain) this.retryCandidate = next;
      this.publish({
        mode: "blocked",
        error: `Saving failed: ${this.message(error)} Your last valid balance is preserved.`,
        notice: retain
          ? "A confirmed reward or presentation update is held in memory. Retry saving before closing this tab."
          : "No new transaction was committed. Retry storage or choose session-only.",
      });
      return false;
    }
  }
  private action(fn: (s: Snapshot) => Snapshot) {
    try {
      const s = this.state();
      this.commit(fn(s));
    } catch (e) {
      this.publish({ error: this.message(e) });
    }
  }
  flip = (side: Side, wager: string) => {
    try {
      const s = this.state();
      unlocked(s);
      validateWager(s, wager);
      const outcome = (this.options.outcome ?? secureOutcome)();
      const next = settle(
        s,
        side,
        wager,
        outcome,
        `${s.generation}:${s.stats.rounds + 1}`,
      );
      if (!this.commit(next)) return;
      const id = next.last!.id;
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(
        () => this.reveal(id),
        (this.options.reduced?.() ??
          window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          ? 50
          : 2100,
      );
    } catch (e) {
      this.publish({ error: this.message(e) });
    }
  };
  reveal = (id: string) => {
    const s = this.view.snapshot;
    if (!s || !s.last?.presentationPending || s.last.id !== id) return;
    this.commit(reveal(s, id), true);
    clearTimeout(this.watchdog);
  };
  transfer = (mode: "deposit" | "withdraw", amount: string) => {
    try {
      const s = this.state();
      const next = transfer(s, mode, amount);
      this.quickGuard = true;
      const success = this.commit(next);
      if (success) {
        this.publish({
          notice: `${mode === "deposit" ? "Deposited" : "Withdrew"} credits successfully.`,
        });
        this.transferTimer = setTimeout(() => {
          this.quickGuard = false;
          this.publish();
        }, 300);
      } else {
        this.quickGuard = false;
        this.publish();
      }
    } catch (e) {
      this.publish({ error: this.message(e) });
    }
  };
  decline = () => this.action(decline);
  reset = () => {
    try {
      if (this.view.mode === "readonly")
        throw new Error("Only the active tab can reset.");
      if (this.view.snapshot) unlocked(this.view.snapshot);
      if (this.quickGuard) throw new Error("Please wait for the transfer.");
      if (this.view.mode === "blocked") {
        if (!this.owner) throw new Error("Obtain save ownership first.");
        this.publish({ mode: "saved" });
      }
      this.commit(fresh(this.id()));
      this.adToken++;
    } catch (e) {
      this.publish({ error: this.message(e) });
    }
  };
  retrySave = () => {
    if (!this.owner) return;
    try {
      this.storage ??= window.localStorage;
      if (!this.view.snapshot && !this.retryCandidate) {
        this.initialize();
        return;
      }
      const next = this.retryCandidate ?? this.view.snapshot!;
      this.storage.setItem(SAVE_KEY, JSON.stringify(next));
      this.retryCandidate = null;
      this.publish({
        snapshot: next,
        mode: "saved",
        error: "",
        notice: "Saving restored.",
      });
      if (next.last?.presentationPending) this.reveal(next.last.id);
    } catch (e) {
      this.publish({ error: this.message(e) });
    }
  };
  continueSession = () => {
    if (this.view.mode !== "blocked") return;
    this.adToken++;
    this.cancelAd?.();
    this.cancelAd = undefined;
    this.release?.();
    this.release = undefined;
    this.owner = true;
    const s = this.retryCandidate ?? this.view.snapshot ?? fresh(this.id());
    this.retryCandidate = null;
    this.storage = undefined;
    window.removeEventListener("storage", this.onStorage);
    this.publish({
      snapshot: recover(s),
      mode: "session",
      error: "",
      notice:
        "Isolated session only. Progress is not saved and does not replace the shared wallet.",
    });
  };
  reward = (placement: Placement) => {
    try {
      const s = this.state();
      if (
        !this.view.adsAvailable ||
        (placement === "bonus" && !this.view.bonusAvailable)
      )
        throw new Error("Rewarded ads are unavailable.");
      const next = beginReward(
        s,
        placement,
        this.id(),
        this.now(),
        this.options.cooldown ?? adConfig.cooldown,
        this.options.maxRewards ?? adConfig.maxRewards,
      );
      if (!this.commit(next)) return;
      const intent = Object.freeze({ ...next.attempt! }),
        token = ++this.adToken;
      this.publish({ adState: "loading" });
      const cancel = this.adapter.run(intent, (event) =>
        this.adEvent(intent, token, event),
      );
      if (
        token !== this.adToken ||
        !this.view.snapshot ||
        !activeAttempt(this.view.snapshot)
      )
        cancel();
      else this.cancelAd = cancel;
    } catch (e) {
      this.publish({ error: this.message(e) });
    }
  };
  private adEvent(intent: RewardAttempt, token: number, event: AdEvent) {
    if (token !== this.adToken) return;
    const s = this.retryCandidate ?? this.view.snapshot;
    if (
      !s ||
      s.attempt?.id !== intent.id ||
      s.generation !== intent.generation ||
      !activeAttempt(s)
    )
      return;
    const next =
      event === "granted"
        ? grant(s, intent, this.now())
        : rewardPhase(s, intent.id, event);
    if (this.view.mode === "blocked") {
      this.retryCandidate = next;
      this.publish({
        adState: event,
        notice:
          "Ad status retained in memory. Retry saving to complete recovery.",
      });
    } else {
      const committed = this.commit(
        next,
        event === "granted" || !!s.attempt?.credited,
      );
      if (committed)
        this.publish({
          adState: event,
          notice:
            event === "granted"
              ? "Your promised fictional-credit reward was credited."
              : event === "unavailable"
                ? "No ad is available. No reward was granted."
                : event === "failed"
                  ? next.attempt?.credited
                    ? "Your granted reward is preserved."
                    : "The ad could not finish. No reward was granted."
                  : event === "closed"
                    ? next.attempt?.credited
                      ? "Your granted reward is saved."
                      : "Ad closed without a grant. No credits were added."
                    : this.view.notice,
        });
    }
    if (["closed", "unavailable", "failed"].includes(event)) {
      this.cancelAd?.();
      this.cancelAd = undefined;
    }
  }
  cancelReward = () => {
    const s = this.retryCandidate ?? this.view.snapshot;
    if (!s?.attempt) return;
    this.adEvent(s.attempt, this.adToken, "closed");
    this.adToken++;
    this.cancelAd?.();
    this.cancelAd = undefined;
  };
  setMockScenario = (scenario: string) => {
    if (
      !this.view.mockEnabled ||
      !["grant", "close", "no-fill", "error", "delayed", "repeated"].includes(
        scenario,
      ) ||
      this.view.busy
    )
      return;
    (this.adapter as AdAdapter & { scenario: string }).scenario = scenario;
    this.publish({ mockScenario: scenario });
  };
  dispose = () => {
    this.disposed = true;
    this.owner = false;
    this.adToken++;
    clearTimeout(this.watchdog);
    clearTimeout(this.transferTimer);
    this.cancelAd?.();
    this.release?.();
    window.removeEventListener("storage", this.onStorage);
    this.unsubscribeConsent?.();
    window.removeEventListener("pagehide", this.dispose);
  };
}
let fallbackId = 0;
export const game = new GameController();
