import type { AdAdapter, AdEvent } from "./types";
import type { RewardAttempt } from "../domain";
import { enableGpt, loadGpt } from "./gpt";
export class GamAdapter implements AdAdapter {
  get available() {
    return (
      !!this.path &&
      !!this.rewardType &&
      this.rewardAmount === 1000 &&
      this.consent()
    );
  }
  constructor(
    private path: string,
    private consent: () => boolean,
    private rewardType: string,
    private rewardAmount: number,
  ) {}
  run(
    intent: Readonly<RewardAttempt>,
    emit: (event: AdEvent) => void,
  ): () => void {
    // Variable post-win mapping has not been verified: production bonus is deliberately unavailable.
    if (
      !this.available ||
      !this.consent() ||
      intent.placement !== "refill" ||
      intent.amount !== 1000
    ) {
      emit("unavailable");
      return () => {};
    }
    let canceled = false,
      slot: googletag.Slot | null = null,
      cleanup = () => {};
    const cancel = () => {
      if (canceled) return;
      canceled = true;
      cleanup();
    };
    void (async () => {
      try {
        await loadGpt();
        if (canceled || !this.consent()) return;
        const pub = googletag.pubads();
        slot = googletag.defineOutOfPageSlot(
          this.path,
          googletag.enums.OutOfPageFormat.REWARDED,
        );
        if (!slot) {
          emit("unavailable");
          return;
        }
        const exact = slot;
        let granted = false;
        let shown = false;
        const end = (state: AdEvent) => {
          if (canceled) return;
          emit(state);
          cancel();
        };
        const ready = (e: googletag.events.RewardedSlotReadyEvent) => {
          if (canceled || shown || e.slot !== exact) return;
          emit("ready");
          if (canceled || !this.consent()) {
            end("failed");
            return;
          }
          try {
            if (e.makeRewardedVisible()) {
              shown = true;
              emit("showing");
            } else end("failed");
          } catch {
            end("failed");
          }
        };
        const grant = (e: googletag.events.RewardedSlotGrantedEvent) => {
          if (canceled || e.slot !== exact || granted) return;
          const p = e.payload;
          if (
            !p ||
            p.type !== this.rewardType ||
            p.amount !== this.rewardAmount
          ) {
            end("failed");
            return;
          }
          granted = true;
          emit("granted");
        };
        const closed = (e: googletag.events.RewardedSlotClosedEvent) => {
          if (e.slot === exact) end("closed");
        };
        const rendered = (e: googletag.events.SlotRenderEndedEvent) => {
          if (e.slot === exact && e.isEmpty) end("unavailable");
        };
        const timer = setTimeout(
          () => end(granted ? "closed" : "failed"),
          180000,
        );
        cleanup = () => {
          clearTimeout(timer);
          pub.removeEventListener("rewardedSlotReady", ready);
          pub.removeEventListener("rewardedSlotGranted", grant);
          pub.removeEventListener("rewardedSlotClosed", closed);
          pub.removeEventListener("slotRenderEnded", rendered);
          googletag.destroySlots([exact]);
        };
        pub.addEventListener("rewardedSlotReady", ready);
        pub.addEventListener("rewardedSlotGranted", grant);
        pub.addEventListener("rewardedSlotClosed", closed);
        pub.addEventListener("slotRenderEnded", rendered);
        slot.addService(pub);
        enableGpt();
        googletag.display(slot);
      } catch {
        if (!canceled) {
          emit("failed");
          cancel();
        }
      }
    })();
    return cancel;
  }
}
