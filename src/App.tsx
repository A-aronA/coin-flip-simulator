import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { game } from "./controller";
import { formatMoney, parseCents, type Round, type Side } from "./domain";
import "./styles.css";

const titleSide = (side: Side) => (side === "heads" ? "Heads" : "Tails");
const plainAmount = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

function Icon({
  name,
}: {
  name: "bank" | "arrow" | "coin" | "check" | "refresh";
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "bank" && (
        <>
          <path d="m3 9 9-6 9 6H3ZM4 21h16M6 10v7m6-7v7m6-7v7M3 18h18" />
        </>
      )}
      {name === "arrow" && (
        <>
          <path d="M5 12h14m-5-5 5 5-5 5" />
        </>
      )}
      {name === "coin" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 8v8m6-8v8m-6-4h6" />
        </>
      )}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "refresh" && (
        <>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 18 17" />
        </>
      )}
    </svg>
  );
}

function Coin({ round, tossing }: { round: Round | null; tossing: boolean }) {
  const rotor = useRef<HTMLDivElement>(null);
  const angle = useRef(round?.outcome === "tails" ? 180 : 0);
  const animated = useRef<string | null>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = rotor.current;
    if (!el) return;
    if (round && tossing && animated.current !== round.id) {
      animated.current = round.id;
      const from = angle.current;
      const to =
        Math.ceil(from / 360) * 360 +
        1440 +
        (round.outcome === "tails" ? 180 : 0);
      el.style.setProperty("--coin-from", `${from}deg`);
      el.style.setProperty("--coin-to", `${to}deg`);
      el.style.setProperty("--coin-angle", `${to}deg`);
      angle.current = to;
    } else if (!tossing && !round) {
      angle.current = 0;
      el.style.setProperty("--coin-angle", "0deg");
    } else if (!tossing && round && animated.current !== round.id) {
      const value = round.outcome === "tails" ? 180 : 0;
      angle.current = value;
      el.style.setProperty("--coin-angle", `${value}deg`);
    }
  }, [round, tossing]);
  return (
    <div
      className={`coin-stage${tossing && !reduced ? " is-tossing" : ""}`}
      role="img"
      aria-label={
        tossing
          ? "Coin is flipping"
          : round
            ? `Coin showing ${titleSide(round.outcome)}`
            : "Coin showing Heads"
      }
    >
      <div className="coin-shadow" />
      <div
        className="coin-toss"
        key={round?.id ?? "fresh"}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && round)
            game.reveal(round.id);
        }}
      >
        <div
          className="coin-rotor"
          ref={rotor}
          style={
            {
              "--coin-angle": round?.outcome === "tails" ? "180deg" : "0deg",
            } as CSSProperties
          }
        >
          <div className="coin-face coin-heads">
            <span className="coin-face-label">HEADS</span>
            <span className="coin-letter">H</span>
            <span className="coin-face-bottom">FIFTY · FIFTY</span>
            <i className="coin-dot dot-left" />
            <i className="coin-dot dot-right" />
          </div>
          <div className="coin-face coin-tails">
            <span className="coin-face-label">TAILS</span>
            <span className="coin-letter">T</span>
            <span className="coin-face-bottom">FIFTY · FIFTY</span>
            <i className="coin-dot dot-left" />
            <i className="coin-dot dot-right" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Celebration({
  round,
  tossing,
}: {
  round: Round | null;
  tossing: boolean;
}) {
  const celebrated = useRef<string | null>(round?.id ?? null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (
      !round ||
      tossing ||
      round.net <= 0 ||
      reduced ||
      celebrated.current === round.id
    )
      return;
    celebrated.current = round.id;
    let alive = true;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (alive)
        void confetti({
          particleCount: 25,
          spread: 45,
          startVelocity: 20,
          gravity: 1.15,
          scalar: 0.7,
          ticks: 110,
          origin: { x: 0.5, y: 0.42 },
          colors: ["#335dde", "#96acd9", "#b7c8b3"],
          disableForReducedMotion: true,
        });
    });
    return () => {
      alive = false;
    };
  }, [round, tossing, reduced]);
  return null;
}

function Result({ round, tossing }: { round: Round | null; tossing: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="result-space" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait" initial={false}>
        {tossing ? (
          <motion.div
            key="tossing"
            className="result-neutral"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.12 }}
          >
            <span className="tossing-indicator" />
            Stake committed. The coin is in the air.
          </motion.div>
        ) : round ? (
          <motion.div
            key={round.id}
            className={`result ${round.net > 0 ? "result-win" : "result-loss"}`}
            initial={{ opacity: 0, y: reduced ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          >
            <strong>
              {titleSide(round.outcome)} —{" "}
              {round.net > 0
                ? `You win +${formatMoney(round.net)}`
                : `You lost ${formatMoney(-round.net)}`}
            </strong>
            <span>
              {round.net > 0
                ? `${formatMoney(round.gross)} returned, including your stake.`
                : "A fresh 50/50 chance on every flip."}
            </span>
          </motion.div>
        ) : (
          <div key="ready" className="result-neutral">
            One coin. Two sides. Your call.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const view = useSyncExternalStore(game.subscribe, game.getView);
  const { snapshot, tossing, busy } = view;
  const [side, setSide] = useState<Side>("heads");
  const [wager, setWager] = useState("1.00");
  const [bankMode, setBankMode] = useState<"deposit" | "withdraw">("deposit");
  const [bankAmount, setBankAmount] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const bankPanel = useRef<HTMLDetailsElement>(null);
  const bankInput = useRef<HTMLInputElement>(null);
  const wagerId = useId();
  const bankId = useId();
  const locked =
    busy ||
    view.mode === "loading" ||
    view.mode === "readonly" ||
    view.mode === "blocked";
  const available = snapshot
    ? tossing && snapshot.last
      ? snapshot.last.before - snapshot.last.wager
      : snapshot.available
    : 0;
  const lastWager = snapshot?.last?.wager;
  let wagerError = "";
  if (wager.trim()) {
    try {
      const cents = parseCents(wager);
      if (cents > 10000) wagerError = "The maximum wager is $100.00.";
      else if (snapshot && cents > snapshot.available)
        wagerError = "This wager exceeds your available credits.";
    } catch (error) {
      wagerError =
        error instanceof Error ? error.message : "Enter a valid amount.";
    }
  }
  const normalize = (value: string, setter: (next: string) => void) => {
    try {
      setter(plainAmount(parseCents(value)));
    } catch {
      /* Keep incomplete input available for editing. */
    }
  };
  const openWithdrawal = () => {
    setBankMode("withdraw");
    if (bankPanel.current) bankPanel.current.open = true;
    bankInput.current?.focus();
  };
  const flip = (event: FormEvent) => {
    event.preventDefault();
    game.flip(side, wager);
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#game" aria-label="Coin Flip Simulator game">
          <span className="brand-mark">
            <Icon name="coin" />
          </span>
          <span>CHANCE, SIMPLIFIED</span>
        </a>
        <span className="free-label">
          <span />
          Free to play
        </span>
      </header>
      <section className="game-intro" id="game" aria-labelledby="game-title">
        <h1 id="game-title">
          Coin Flip Simulator<span className="title-period">.</span>
        </h1>
        <p>Pick a side. Give chance a spin.</p>
      </section>

      <section
        className="game-card"
        aria-label="Coin flip game"
        aria-busy={tossing}
      >
        {view.mode === "loading" && (
          <p className="storage-message">Opening your game…</p>
        )}
        {(view.mode === "readonly" ||
          view.mode === "session" ||
          view.mode === "blocked") && (
          <div className={`storage-message storage-${view.mode}`}>
            <strong>
              {view.mode === "readonly"
                ? "Another tab is playing"
                : view.mode === "session"
                  ? "Session-only game"
                  : "Your saved game needs attention"}
            </strong>
            <p>
              {view.mode === "readonly"
                ? "Balances stay synchronized here. Close the other game tab, then retry to play in this one."
                : view.mode === "session"
                  ? "Progress stays in this tab and will be lost when it closes or reloads."
                  : "Your saved credits have not been overwritten. Retry storage or explicitly continue without saving."}
            </p>
            {view.mode === "readonly" && (
              <button
                type="button"
                className="text-button"
                onClick={() => game.retryOwnership()}
              >
                Retry ownership <Icon name="arrow" />
              </button>
            )}
            {view.mode === "blocked" && (
              <div className="inline-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => game.retrySave()}
                >
                  Retry storage
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => game.continueSession()}
                >
                  Continue session-only
                </button>
              </div>
            )}
          </div>
        )}
        {view.error && (
          <div className="error-message" role="alert" id="game-error">
            {view.error}
          </div>
        )}
        <div className="transaction-notice" role="status" aria-live="polite">
          {view.notice === "Progress saved on this browser." ? "" : view.notice}
        </div>
        {snapshot && (
          <>
            <div className="balances">
              <div className="balance-available">
                <span className="eyebrow">Available credits</span>
                <motion.strong
                  key={available}
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {formatMoney(available)}
                </motion.strong>
              </div>
              <div className="balance-bank">
                <span className="eyebrow">
                  <Icon name="bank" />
                  Safe Bank
                </span>
                <strong>{formatMoney(snapshot.bank)}</strong>
              </div>
            </div>
            <Coin round={snapshot.last} tossing={tossing} />
            <Celebration round={snapshot.last} tossing={tossing} />
            <Result round={snapshot.last} tossing={tossing} />
            <form
              className="play-form"
              onSubmit={flip}
              onKeyDown={(event) => {
                if (event.repeat && event.key === "Enter")
                  event.preventDefault();
              }}
            >
              <fieldset className="side-picker" disabled={locked}>
                <legend className="field-label">Choose your side</legend>
                <div className="segmented">
                  {(["heads", "tails"] as const).map((option) => (
                    <label
                      className={
                        side === option ? "side-option selected" : "side-option"
                      }
                      key={option}
                    >
                      <input
                        type="radio"
                        name="side"
                        value={option}
                        checked={side === option}
                        onChange={() => setSide(option)}
                      />
                      <span className="mini-coin" aria-hidden="true">
                        {option === "heads" ? "H" : "T"}
                      </span>
                      <span>{titleSide(option)}</span>
                      {side === option && (
                        <span className="side-check">
                          <Icon name="check" />
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="wager-field">
                <label className="field-label" htmlFor={wagerId}>
                  Your wager <span>Fictional credits</span>
                </label>
                <div
                  className={`money-input${wagerError && !tossing ? " invalid" : ""}`}
                >
                  <span aria-hidden="true">$</span>
                  <input
                    id={wagerId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={20}
                    value={wager}
                    disabled={
                      view.mode === "readonly" ||
                      view.mode === "loading" ||
                      view.mode === "blocked"
                    }
                    readOnly={busy}
                    onChange={(event) => setWager(event.target.value)}
                    onBlur={() => normalize(wager, setWager)}
                    aria-describedby={`${wagerId}-help${wagerError && !tossing ? ` ${wagerId}-error` : ""}${view.error ? " game-error" : ""}`}
                    aria-invalid={!!wagerError && !tossing}
                  />
                  <span className="input-range">$0.01–$100</span>
                </div>
                <div
                  className="quick-bets"
                  role="group"
                  aria-label="Quick wager amounts"
                >
                  {[1, 5, 10, 25, 50, 100].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      disabled={locked || amount * 100 > snapshot.available}
                      onClick={() => setWager(`${amount}.00`)}
                    >
                      ${amount}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="quick-max"
                    disabled={locked || snapshot.available < 1}
                    onClick={() =>
                      setWager(plainAmount(Math.min(snapshot.available, 10000)))
                    }
                  >
                    Max
                  </button>
                </div>
                <div
                  className="quick-bets wager-multipliers"
                  role="group"
                  aria-label="Last wager shortcuts"
                  aria-describedby={`${wagerId}-last`}
                >
                  {([2, 3] as const).map((multiplier) => {
                    const amount = (lastWager ?? 0) * multiplier;
                    const reason = !lastWager
                      ? "Play a round first."
                      : amount > 10000
                        ? "This would exceed the $100.00 wager limit."
                        : amount > snapshot.available
                          ? "This would exceed your available credits."
                          : `Set the next wager to ${formatMoney(amount)}.`;
                    return (
                      <button
                        key={multiplier}
                        type="button"
                        disabled={
                          locked ||
                          !lastWager ||
                          amount > 10000 ||
                          amount > snapshot.available
                        }
                        title={reason}
                        onClick={() => setWager(plainAmount(amount))}
                      >
                        {multiplier === 2 ? "Double wager" : "Triple wager"}
                      </button>
                    );
                  })}
                </div>
                <p className="input-help" id={`${wagerId}-last`}>
                  {lastWager
                    ? `Based on your last wager of ${formatMoney(lastWager)}.`
                    : "Play a round to use the last wager shortcuts."}
                </p>
                <p className="input-help" id={`${wagerId}-help`}>
                  Use a decimal amount with up to 2 decimal places.
                </p>
                {wagerError && !tossing && (
                  <p className="field-error" id={`${wagerId}-error`}>
                    {wagerError}
                  </p>
                )}
              </div>
              <button
                className="flip-button"
                type="submit"
                disabled={locked || snapshot.available < 1 || !!wagerError}
                onKeyDown={(event) => {
                  if (
                    event.repeat &&
                    (event.key === "Enter" || event.key === " ")
                  )
                    event.preventDefault();
                }}
              >
                <Icon name="refresh" />
                {tossing ? "Flipping…" : "Flip Coin"}
                <span aria-hidden="true">↗</span>
              </button>
              <p className="odds-note">
                50/50 chance <span>·</span> Wins return 2× your wager
              </p>
            </form>
            {!tossing && snapshot.available === 0 && (
              <div className="empty-wallet" role="status">
                <strong>
                  {snapshot.bank > 0
                    ? "Your credits are safe in the bank."
                    : "Your available credits have run out."}
                </strong>
                <p>
                  {snapshot.bank > 0
                    ? "Withdraw some credits to make your next flip."
                    : "You can start over with $100.00 in Settings below."}
                </p>
                {snapshot.bank > 0 && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={openWithdrawal}
                  >
                    Withdraw from Safe Bank <Icon name="arrow" />
                  </button>
                )}
              </div>
            )}
            {!tossing &&
              snapshot.last?.bonusStatus === "eligible" &&
              view.bonusAvailable && (
                <motion.aside
                  className="bonus-offer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  aria-label="Optional winning bonus"
                >
                  <strong>
                    Optional bonus: +{formatMoney(snapshot.last.bonus)} in game
                    credits.
                  </strong>
                  <p>Your base winnings are already yours.</p>
                  <div className="inline-actions">
                    <button
                      className="small-primary"
                      type="button"
                      disabled={locked}
                      onClick={() => game.reward("bonus")}
                    >
                      Watch Ad for +1%
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      disabled={locked}
                      onClick={() => game.decline()}
                    >
                      Continue <Icon name="arrow" />
                    </button>
                  </div>
                </motion.aside>
              )}
            <div className="game-panels">
              <details ref={bankPanel} className="compact-panel">
                <summary>
                  <span>
                    <Icon name="bank" />
                    Manage Safe Bank
                  </span>
                  <span className="summary-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="panel-content">
                  <p>Set credits aside. Your bank is never used for a wager.</p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      game.transfer(bankMode, bankAmount);
                    }}
                  >
                    <fieldset className="bank-mode" disabled={locked}>
                      <legend className="sr-only">Transfer direction</legend>
                      {(["deposit", "withdraw"] as const).map((mode) => (
                        <label
                          key={mode}
                          className={bankMode === mode ? "active" : ""}
                        >
                          <input
                            type="radio"
                            name="bank-mode"
                            value={mode}
                            checked={bankMode === mode}
                            onChange={() => setBankMode(mode)}
                          />
                          {mode === "deposit" ? "Deposit" : "Withdraw"}
                        </label>
                      ))}
                    </fieldset>
                    <label htmlFor={bankId} className="field-label">
                      {bankMode === "deposit"
                        ? "Amount to deposit"
                        : "Amount to withdraw"}
                    </label>
                    <div className="bank-input-row">
                      <div className="money-input">
                        <span aria-hidden="true">$</span>
                        <input
                          id={bankId}
                          ref={bankInput}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          maxLength={20}
                          value={bankAmount}
                          placeholder="0.00"
                          disabled={
                            view.mode === "readonly" ||
                            view.mode === "loading" ||
                            view.mode === "blocked"
                          }
                          readOnly={busy}
                          onChange={(event) =>
                            setBankAmount(event.target.value)
                          }
                          onBlur={() => normalize(bankAmount, setBankAmount)}
                          aria-describedby={`${bankId}-help${view.error ? " game-error" : ""}`}
                        />
                        <button
                          type="button"
                          className="input-max"
                          disabled={
                            locked ||
                            (bankMode === "deposit"
                              ? snapshot.available
                              : snapshot.bank) < 1
                          }
                          onClick={() =>
                            setBankAmount(
                              plainAmount(
                                bankMode === "deposit"
                                  ? snapshot.available
                                  : snapshot.bank,
                              ),
                            )
                          }
                        >
                          Max
                        </button>
                      </div>
                      <button
                        className="small-primary"
                        type="submit"
                        disabled={locked}
                      >
                        {bankMode === "deposit" ? "Deposit" : "Withdraw"}
                      </button>
                    </div>
                    <p id={`${bankId}-help`} className="input-help">
                      Positive amounts, up to 2 decimal places. No transfer
                      limit beyond your source balance.
                    </p>
                  </form>
                </div>
              </details>
              <details className="compact-panel">
                <summary>
                  <span>
                    <span className="stats-icon" aria-hidden="true">
                      ▥
                    </span>
                    Your statistics
                  </span>
                  <span className="summary-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="panel-content">
                  {tossing ? (
                    <p>Statistics update when the result is revealed.</p>
                  ) : (
                    <>
                      <dl className="stats-grid">
                        <div>
                          <dt>Rounds</dt>
                          <dd>{snapshot.stats.rounds}</dd>
                        </div>
                        <div>
                          <dt>Wins / losses</dt>
                          <dd>
                            {snapshot.stats.wins} / {snapshot.stats.losses}
                          </dd>
                        </div>
                        <div>
                          <dt>Total wagered</dt>
                          <dd>{formatMoney(snapshot.stats.wagered)}</dd>
                        </div>
                        <div>
                          <dt>Base payouts</dt>
                          <dd>{formatMoney(snapshot.stats.payouts)}</dd>
                        </div>
                        <div>
                          <dt>Gameplay profit</dt>
                          <dd>
                            {snapshot.stats.profit > 0 ? "+" : ""}
                            {formatMoney(snapshot.stats.profit)}
                          </dd>
                        </div>
                        <div>
                          <dt>Ad credits</dt>
                          <dd>{formatMoney(snapshot.stats.adCredits)}</dd>
                        </div>
                      </dl>
                      <p className="input-help">
                        Gameplay profit excludes ad credits and bank transfers.
                      </p>
                      {snapshot.history.length > 0 && (
                        <>
                          <h3 className="history-label">Recent flips</h3>
                          <ol className="recent-flips">
                            {snapshot.history
                              .slice(-10)
                              .reverse()
                              .map((round) => (
                                <li
                                  key={round.id}
                                  className={
                                    round.net > 0
                                      ? "history-win"
                                      : "history-loss"
                                  }
                                >
                                  <span
                                    className="history-side"
                                    aria-hidden="true"
                                  >
                                    {round.outcome === "heads" ? "H" : "T"}
                                  </span>
                                  <span className="sr-only">
                                    {titleSide(round.outcome)},{" "}
                                    {round.net > 0 ? "won" : "lost"}{" "}
                                  </span>
                                  <span>
                                    {round.net > 0 ? "+" : "−"}
                                    {formatMoney(Math.abs(round.net))}
                                  </span>
                                </li>
                              ))}
                          </ol>
                        </>
                      )}
                    </>
                  )}
                </div>
              </details>
              <details className="compact-panel">
                <summary>
                  <span>
                    <span className="settings-icon" aria-hidden="true">
                      ⚙
                    </span>
                    Settings &amp; recovery
                  </span>
                  <span className="summary-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="panel-content">
                  <p>
                    {view.mode === "saved"
                      ? "Progress is saved in this browser."
                      : "Check the storage status above before closing this tab."}{" "}
                    A reset starts a new game with $100.00 available, $0.00 in
                    the bank, and zero statistics.
                  </p>
                  {confirmReset ? (
                    <div className="reset-confirmation">
                      <strong>
                        Start over and erase this game’s progress?
                      </strong>
                      <div className="inline-actions">
                        <button
                          className="danger-button"
                          type="button"
                          disabled={busy || view.mode === "readonly"}
                          onClick={() => {
                            game.reset();
                            setConfirmReset(false);
                            setWager("1.00");
                            setSide("heads");
                          }}
                        >
                          Yes, start over
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setConfirmReset(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy || view.mode === "readonly"}
                      onClick={() => setConfirmReset(true)}
                    >
                      Start over
                    </button>
                  )}
                </div>
              </details>
            </div>
            <div className="refill-area">
              <div>
                <span className="refill-label">Need a few more flips?</span>
                <p>Optional reward: $10 in fictional game credits.</p>
              </div>
              <button
                type="button"
                className="refill-button"
                disabled={locked || !view.adsAvailable}
                onClick={() => game.reward("refill")}
              >
                Watch Ad — Earn $10
              </button>
              {!view.adsAvailable && (
                <span className="ad-unavailable">
                  Rewarded ads are currently unavailable.
                </span>
              )}
            </div>
            {busy &&
              !tossing &&
              snapshot.attempt &&
              ["loading", "ready", "showing", "granted"].includes(
                snapshot.attempt.phase,
              ) && (
                <div className="ad-progress" role="status">
                  <span>{view.adState}</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => game.cancelReward()}
                  >
                    Cancel ad
                  </button>
                </div>
              )}
            {import.meta.env.DEV && view.mockEnabled && (
              <aside className="mock-panel">
                <strong>Development ad simulator — no real ad</strong>
                <label htmlFor="mock-scenario">Test scenario</label>
                <select
                  id="mock-scenario"
                  value={view.mockScenario}
                  disabled={busy}
                  onChange={(event) => game.setMockScenario(event.target.value)}
                >
                  <option value="grant">Grant</option>
                  <option value="close">Close without grant</option>
                  <option value="no-fill">No fill</option>
                  <option value="error">Error</option>
                  <option value="delayed">Delayed grant</option>
                  <option value="repeated">Repeated grant event</option>
                </select>
              </aside>
            )}
          </>
        )}
        {!snapshot && view.mode === "blocked" && (
          <div className="no-save-recovery">
            <p>
              If the save is incompatible or damaged, you can explicitly reset
              it.
            </p>
            {confirmReset ? (
              <div className="inline-actions">
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    game.reset();
                    setConfirmReset(false);
                  }}
                >
                  Confirm reset to $100
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-button"
                onClick={() => setConfirmReset(true)}
              >
                Start over
              </button>
            )}
          </div>
        )}
      </section>
      <p className="game-disclaimer">
        <span className="disclaimer-dot" />
        Fictional credits only. No purchases, cash value, transfers, or prizes.
      </p>
      <p className="age-notice">Intended for adults 18+.</p>
      <nav className="below-game-links" aria-label="Game information">
        <a href="#how-to-play">How it works</a>
        <span>·</span>
        <a href="#privacy">Privacy</a>
        <span>·</span>
        <a href="#terms">Terms</a>
      </nav>
    </div>
  );
}
