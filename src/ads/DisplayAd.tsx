import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { adConfig, consentGate } from "./config";
export function DisplayAd({
  position,
}: {
  position: "below" | "top" | "side";
}) {
  const consent = useSyncExternalStore(
    consentGate.subscribe,
    consentGate.allowsRequests,
  );
  const id = `display-${useId().replace(/:/g, "")}`;
  const [supported, setSupported] = useState(false);
  const placeholder =
    import.meta.env.DEV && import.meta.env.VITE_DISPLAY_PLACEHOLDERS === "true";
  const configured =
    adConfig[position] &&
    (placeholder ||
      (adConfig.provider === "gam" &&
        adConfig.consent &&
        !!adConfig.displayPath &&
        consent));
  useEffect(() => {
    const media = window.matchMedia(
      position === "side" ? "(min-width: 1440px)" : "(min-width: 320px)",
    );
    const update = () => setSupported(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [position]);
  useEffect(() => {
    if (!configured || !supported || placeholder) return;
    let canceled = false,
      slot: googletag.Slot | null = null;
    void import("./gpt")
      .then(async ({ loadGpt, enableGpt }) => {
        await loadGpt();
        if (canceled || !consentGate.allowsRequests()) return;
        const sizes: googletag.GeneralSize =
          position === "side"
            ? [160, 600]
            : window.innerWidth >= 800
              ? [728, 90]
              : [300, 50];
        slot = googletag.defineSlot(adConfig.displayPath, sizes, id);
        if (slot) {
          slot.addService(googletag.pubads());
          enableGpt();
          googletag.display(slot);
        }
      })
      .catch(() => {});
    return () => {
      canceled = true;
      if (slot) googletag.destroySlots([slot]);
    };
  }, [configured, supported, placeholder, position, id]);
  if (!configured || !supported) return null;
  return (
    <aside
      className={`display-ad display-${position}`}
      aria-label="Advertisement"
    >
      <span>Advertisement</span>
      <div id={id}>{placeholder ? "Advertisement placeholder" : null}</div>
    </aside>
  );
}
