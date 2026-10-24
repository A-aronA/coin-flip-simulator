export interface AdConfig {
  provider: "disabled" | "mock" | "gam";
  consent: boolean;
  refillPath: string;
  displayPath: string;
  top: boolean;
  side: boolean;
  below: boolean;
  cooldown: number;
  maxRewards: number;
  rewardType: string;
  rewardAmount: number;
}
export function readAdConfig(
  env: Record<string, unknown>,
  dev: boolean,
): AdConfig {
  const provider = String(env.VITE_AD_PROVIDER || "disabled");
  if (!["disabled", "mock", "gam"].includes(provider))
    throw new Error("Unknown ad provider configuration.");
  if (provider === "mock" && (!dev || env.VITE_ENABLE_DEV_ADS !== "true"))
    throw new Error(
      "Development ads require DEV and explicit opt-in; mocks are forbidden in production.",
    );
  const natural = (key: string, fallback: number) => {
    const s = String(env[key] ?? fallback);
    if (!/^\d{1,9}$/.test(s)) throw new Error(`Invalid ${key}.`);
    return Number(s);
  };
  return {
    provider: provider as AdConfig["provider"],
    consent: env.VITE_AD_CONSENT_CONFIGURED === "true",
    refillPath: String(env.VITE_GAM_REFILL_PATH || ""),
    displayPath: String(env.VITE_GAM_DISPLAY_PATH || ""),
    top: env.VITE_DISPLAY_TOP === "true",
    side: env.VITE_DISPLAY_SIDE === "true",
    below: env.VITE_DISPLAY_BELOW === "true",
    cooldown: natural("VITE_REWARD_COOLDOWN_MS", 60000),
    maxRewards: natural("VITE_MAX_REWARDS_PER_SAVE", 20),
    rewardType: String(env.VITE_GAM_REWARD_TYPE || ""),
    rewardAmount: natural("VITE_GAM_REWARD_AMOUNT", 0),
  };
}
export const adConfig = readAdConfig(
  import.meta.env ?? {},
  import.meta.env?.DEV ?? false,
);
// A deployment integrator must connect a real CMP/provider consent decision here.
// Configuration alone never constitutes visitor consent. No custom banner pretends to be a CMP.
let consentAllowed = false;
const consentListeners = new Set<() => void>();
export const consentGate = {
  allowsRequests: () => consentAllowed,
  subscribe: (fn: () => void) => {
    consentListeners.add(fn);
    return () => {
      consentListeners.delete(fn);
    };
  },
  // Only the deployment's real CMP integration should supply this decision.
  update: (allowed: boolean) => {
    if (consentAllowed === allowed) return;
    consentAllowed = allowed;
    consentListeners.forEach((fn) => fn());
  },
};
