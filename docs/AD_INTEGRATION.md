# Advertising integration — disabled by default

Official sources reviewed during implementation on 2026-10-24. Recheck before activation; no publisher account has been connected or approved.

## Product distinctions and policy

Ordinary AdSense display inventory is not authorization for a custom credit-reward callback. [AdSense Offerwall](https://support.google.com/adsense/answer/13866332) is a content-access product. This game's optional rewards use [Ad Manager rewarded web inventory](https://developers.google.com/publisher-tag/samples/display-rewarded-ad), with a GPT out-of-page rewarded slot and explicit publisher-delivered rewards.

[Rewarded-ad policies](https://support.google.com/adsense/answer/9121589) require an accurately disclosed reward, affirmative opt-in, optional participation, and delivery of the promise. Monetary rewards are prohibited; permitted nonmonetary rewards have restrictions including nontransferability. Here dollar signs denote fictional game units only: no money, purchases, prizes, redemption or player-to-player transfers. Do not imply Google's endorsement.

The [publisher restriction on online gambling](https://support.google.com/publisherpolicies/answer/10437963) addresses real-money/value wagering for real money or prizes. That is distinct from [Google Ads advertiser rules for social casino promotion](https://support.google.com/adspolicy/answer/15132179). Advertiser certification does not approve a publisher site or its inventory. Obtain a classification/eligibility decision for this exact fictional-credit coin game and intended countries before monetizing. The 18+ notice alone does not establish age-policy compliance. This implementation makes no approval/prohibition claim and promises no fill or revenue.

## Public configuration

All `VITE_` values are compiled into public browser assets; none is a secret. A GPT browser integration does not inherently require an API secret. Never embed passwords, OAuth secrets, service-account keys or account credentials.

| Value                                                         | Default / purpose                                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `VITE_AD_PROVIDER`                                            | `disabled`; `gam` selects real GPT; `mock` only in DEV with the next flag                                 |
| `VITE_ENABLE_DEV_ADS`                                         | `false`; explicit DEV simulator opt-in                                                                    |
| `VITE_AD_CONSENT_CONFIGURED`                                  | `false`; acknowledges that a real consent integration has been configured, does not grant visitor consent |
| `VITE_GAM_REFILL_PATH`                                        | Empty; approved public `/networkCode/adUnit` path                                                         |
| `VITE_GAM_REWARD_TYPE`                                        | Empty; exact configured type, recommend a fictional cent unit such as `game_credit_cent`                  |
| `VITE_GAM_REWARD_AMOUNT`                                      | `0`; must equal **1000** for the fixed refill                                                             |
| `VITE_GAM_DISPLAY_PATH`                                       | Empty; separate ordinary display ad-unit path                                                             |
| `VITE_DISPLAY_BELOW`, `VITE_DISPLAY_TOP`, `VITE_DISPLAY_SIDE` | All `false`; enable only selected placements                                                              |
| `VITE_DISPLAY_PLACEHOLDERS`                                   | `false`; clearly labelled DEV placeholders only                                                           |
| `VITE_REWARD_COOLDOWN_MS`                                     | `60000`; local UX cooldown after a grant                                                                  |
| `VITE_MAX_REWARDS_PER_SAVE`                                   | `20`; local per-save reward limit                                                                         |

Cooldowns are not fraud controls; resets/storage edits bypass them. Configure publisher-side frequency caps and honor demand/provider restrictions independently.

## Consent seam

`src/ads/config.ts` exports `consentGate`, initially false. Connect the deployment's actual provider-approved CMP decision to `consentGate.update(allowed)`. The application subscribes; revocation removes display slots/cancels an active rewarded flow without reversing a prior grant. Set `VITE_AD_CONSENT_CONFIGURED=true` only once this integration is complete. Decide the appropriate signals/consent modes with the provider/CMP; a boolean seam is not a complete legal/CMP implementation. There is intentionally no homemade consent banner, analytics or third-party request by default.

## Fixed refill activation

1. Confirm site/account eligibility and the game's classification with Google; create appropriate rewarded web inventory and eligible demand in Ad Manager.
2. Follow [Ad Manager's trafficking guide](https://support.google.com/admanager/answer/9116812) for current creative/demand settings. Rewarded inventory can include display and video; UI deliberately says **ad**.
3. Configure the unit's reward type to your selected fictional-cent unit and amount to **1000**, matching environment values. This is exactly $10.00 of in-game credit. Mismatched payload metadata fails closed; the app does not multiply arbitrary SDK data.
4. Integrate the real consent gate, set the path/type/amount, provider `gam`, and acknowledged consent configuration; rebuild.
5. Test with legitimate publisher-authorized test/house inventory on an appropriate test origin, following current Google instructions. Do not generate invalid traffic or click ads. The official sample is a reference, not a production ad-unit entitlement.
6. Verify real no-fill, close, blocked script, consent revocation, grant-before-close and saved-credit behavior on supported devices before production activation.

## Event/attempt flow

An explicit button click discloses and freezes the reward into one intent: unique ID, save generation, placement, exact cents, bound round if any, phase and credited marker. Only one attempt is active. All wallet mutations/reset are blocked while active.

The shared loader requests GPT once, only with enabled configuration and consent. It has a 12-second blocked/script timeout. The adapter defines `OutOfPageFormat.REWARDED`, handles null slots, registers listeners before display, scopes all events to that exact slot, and calls `makeRewardedVisible()` only for the opted-in attempt. A false return, empty render, script failure, unsupported environment or 180-second attempt timeout fails safely. Cancel works while the SDK is still loading. Cleanup removes only its listeners and destroys only its own slot. GPT may already have destroyed a closed slot; repeated targeted cleanup is harmless.

Only `rewardedSlotGranted` with matching fixed reward metadata triggers the bound credit. Ready, showing, video completed, time, close and clicks do not grant. Grants are saved atomically with the credited marker; repeated/stale/previous-generation callbacks cannot credit twice. Later close/error cannot reverse a grant. The exact API contracts are in the [GPT reference](https://developers.google.com/publisher-tag/reference).

Reload retires an unconfirmed attempt without inventing completion; an interrupted bonus can remain eligible for explicit retry. A committed grant remains credited once. A living page retains failed reward writes in memory and exposes retry. A terminated browser can lose a grant received before saving: no recovery service or server verification is implemented. Investigate any provider-supported rewarded-web server verification with your account team as a future enhancement; do not assume app SDK SSV applies to this frontend.

Google separately documents [Ad Manager mediation SSV for apps](https://support.google.com/admanager/answer/7386053) using a publisher postback URL. The reviewed GPT web contracts did not provide a verified drop-in recovery implementation for this app. Any future server verification would require a newly scoped backend and an applicable provider contract; this static project supplies neither.

## Post-win placement stays disabled in production

`GamAdapter` rejects bonus placement and the controller hides its live offer. Ad Manager documents fixed unit reward metadata, but this app's bonus varies by originating gross payout (nearest-cent 1%, half-up). A single fixed currency reward must not be represented as arbitrary variable amounts. Activation requires a deliberately disclosed **provider-supported** per-opportunity mapping, confirmation/approval for it, an implementation update with tests, and genuine inventory validation. An environment flag cannot bypass this dependency. Base winnings are always paid independently.

## Development-only simulator

Set provider `mock` and `VITE_ENABLE_DEV_ADS=true` in development only. The panel says **Development ad simulator — no real ad** and offers grant, close without grant, no fill, error, delayed grant and repeated grant. Its timer emits test scenarios, never a production completion path. Production builds reject provider `mock`, tree-shake the simulator import/panel, and ignore URL/localStorage attempts to enable it. Live failure never substitutes a mock.

## Ordinary display placements

Choose at most the intended placements, beginning with below-game. They use the same GPT loader with separate slot IDs and no reward logic. Labels, reserved responsive sizes and generous separation keep ads away from financial controls. Side inventory is not requested below 1440px; top is an explicit opt-in. No sticky mobile ads, refresh loops, hidden-slot requests or incentives for ordinary clicks exist. Update privacy disclosures and test actual creatives, sizing, blocked inventory and consent before activation.

SDK/network-boundary tests and the development simulator were used locally. **No genuine ad inventory, publisher approval, provider recovery, CMP or production ad serving has been verified.**
