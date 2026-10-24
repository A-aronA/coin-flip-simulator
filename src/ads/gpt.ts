let loading: Promise<void> | undefined;
export function loadGpt(): Promise<void> {
  if (loading) return loading;
  if (window.googletag?.apiReady) return Promise.resolve();
  loading = new Promise<void>((resolve, reject) => {
    window.googletag =
      window.googletag || ({ cmd: [] } as unknown as typeof googletag);
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error("Ad SDK timed out or was blocked.")),
      12000,
    );
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-coin-gpt],script[src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"]',
    );
    if (existing) {
      window.googletag.cmd.push(() => finish());
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    script.dataset.coinGpt = "true";
    script.crossOrigin = "anonymous";
    script.onerror = () => finish(new Error("Ad SDK failed to load."));
    window.googletag.cmd.push(() => finish());
    document.head.append(script);
  });
  return loading;
}
let enabled = false;
export function enableGpt() {
  if (!enabled) {
    googletag.enableServices();
    enabled = true;
  }
}
