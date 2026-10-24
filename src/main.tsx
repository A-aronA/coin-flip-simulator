import { Component, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { game } from "./controller";
import "./styles.css";
import { DisplayAd } from "./ads/DisplayAd";
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert">
        <h1>Coin Flip Simulator</h1>
        <p>
          The interface could not load. Your saved progress has not been reset.
        </p>
        <button onClick={() => window.location.reload()}>Reload safely</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
void game.start().catch(() => {});
// A BFCache page has released its lifetime lock; reinitialize ownership from the saved snapshot.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <DisplayAd position="top" />
      <App />
      <DisplayAd position="below" />
      <DisplayAd position="side" />
    </Boundary>
  </StrictMode>,
);
