# Coin Flip Simulator

A free, local-first React + TypeScript coin game using **fictional credits only**. No accounts, backend, payments, analytics, purchases, prizes, or deployment are included. Advertising is off by default.

## Run locally

Use Node **24 LTS** (tested with 24.16.0; minimum 22.12) and npm.

```sh
npm ci
npm run dev
```

Open the printed loopback URL. For an optimized preview:

```sh
npm run build
npm run preview
```

## Validation

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run build
npm run test:browser
```

Browser tests start isolated default/dev-ad/production servers on ports 5173, 5174, and 4173. Stop unrelated servers on those ports. The suite uses Chromium; Firefox/WebKit are not claimed. If a managed Windows shell gives Playwright a temporary profile, set `PLAYWRIGHT_BROWSERS_PATH` to the persistent installed browser cache before running it. Tests override randomness **only inside test-created browser contexts**; the application ships no outcome controls.

## Small architecture

- `src/domain.ts`: integer-cent parser, safe arithmetic, pure settlement/transfer/reward transitions, exact statistics, bounded history and semantic snapshot validation.
- `src/controller.ts`: sole wallet authority, synchronous guards, atomic snapshot commits, lifetime Web Lock, readonly synchronization, watchdog, recovery, and immutable ad intent handling.
- `src/ads/`: disabled adapter, DEV-only dynamically imported simulator, real GPT adapter, shared SDK loader, responsive display slots, and a fail-closed consent interface.
- `src/App.tsx`: accessible controls and presentation. CSS separates the toss from cumulative 3D rotation. Motion handles small transitions; confetti loads only for a revealed win and respects reduced motion.
- `index.html` and `vite.config.ts`: explanatory/privacy/terms content in initial HTML, metadata, preview noindex, robots and optional sitemap generation.

## Money and save guarantees

Initial wallet: $100.00 available and $0.00 banked. Wagers are $0.01–$100.00. Bank transfers have no wager cap. All balances and transactions use safe integer cents; decimal strings are parsed using digit arithmetic/BigInt, never arbitrary floating-point multiplication.

The round's outcome, settlement, statistics, immutable record and pending-presentation flag are saved in one localStorage write **before animation**. Animation completion and the watchdog only reveal that record. Reload does not reroll or resettle. During animation the UI displays the committed stake balance and hides the settled result/statistics.

One tab holds a lifetime Web Lock per origin. Other tabs synchronize readonly and can retry ownership after it closes. If Web Locks are unavailable, the game starts an explicitly isolated session that never writes the shared save. Storage errors preserve the last valid state and offer retry or explicit session-only continuation. Corrupt/unknown saves are not silently replaced; reset requires confirmation.

`coin-flip.save` schema v2 stores revision, generation, balances, cumulative statistics, latest round, at most 20 recent rounds, one bound reward attempt and completion status. Explicit v1 migration supports the same wallet/round/stat fields before ad fields existed: `attempt`, `lastRewardAt`, and `rewardCount` must be absent and `stats.adCredits` must be zero. Other legacy schemas are rejected. Old round commands cannot be replayed after history pruning because IDs must match the current generation and next monotonic round sequence.

Statistics: rounds = wins + losses; base payouts include returned winning stakes; gameplay profit = payouts − wagered; ad credits are separate; bank transfers change none of these. Total available + bank = initial credits + gameplay profit + ad credits.

## Limits and publication

localStorage is user-editable, clearable, origin-specific, and does not sync devices. It is not authentication, anti-cheat, or a tamper-proof wallet. There is no server-side ledger. A complete browser termination between an SDK grant and a successful save can lose that reward; a failed write in a living page retains it in memory for retry. This app cannot promise provider-backed recovery or server verification.

The consent interface denies requests until a real deployment CMP supplies a decision. Production post-win rewarded placement remains disabled because variable reward mapping has not been verified as provider-supported. The fixed $10 GPT refill adapter is implemented but requires publisher setup, classification review, consent integration, eligible inventory and genuine-inventory testing. No fill or revenue is promised.

See [ad integration](docs/AD_INTEGRATION.md), [deployment](docs/DEPLOYMENT.md), and [third-party notices](THIRD_PARTY_NOTICES.md). Add the real operator/contact details and review the visible Privacy/Terms before publication. The local SVG sharing artwork is original; PNG is supplied for social-preview compatibility. No site has been published.
