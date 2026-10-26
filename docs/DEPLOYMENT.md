# Static deployment preparation

The website is hosted at **https://coin-flip-simulator.pages.dev/** from the existing repository **https://github.com/A-aronA/coin-flip-simulator**, branch `master`. It uses static hosting, with no Functions, Workers or application backend.

## Cloudflare Pages

Follow the current [Cloudflare React guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/). Use Node 24 LTS, install with `npm ci`, build command **`npm run build`**, output directory **`dist`**, and this project as the root directory. The checked-in npm lockfile pins the dependency graph. Preview locally with `npm run preview` after building. No deployment command is included or required for local work.

Use these settings for the reviewed production site. Preview builds should retain `VITE_ALLOW_INDEXING=false`:

| Setting                      | Value                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Framework preset             | **React (Vite)**                                                                                                    |
| Production branch            | **`master`**, the current local branch; select a different name only if you explicitly rename it before publication |
| Root directory               | Leave blank when this project is the repository root                                                                |
| Build command                | **`npm run build`**                                                                                                 |
| Build output directory       | **`dist`**                                                                                                          |
| Node.js                      | **24**, already selected by `.nvmrc`; optional matching Pages override `NODE_VERSION=24`                            |
| Dependency installation      | Keep Pages automatic installation enabled and include development dependencies, which contain Vite and TypeScript   |
| `VITE_AD_PROVIDER`           | **`disabled`**                                                                                                      |
| `VITE_AD_CONSENT_CONFIGURED` | **`false`**                                                                                                         |
| `VITE_SITE_URL`              | **`https://coin-flip-simulator.pages.dev`**                                                                         |
| `VITE_ALLOW_INDEXING`        | **`true`** in reviewed production; **`false`** for previews                                                         |

The [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) lists this React/Vite command and output directory. Its [build image documentation](https://developers.cloudflare.com/pages/configuration/build-image/) supports Node overrides through `.nvmrc` or `NODE_VERSION`. This is a static SPA; no Worker, Functions directory, Wrangler account setup, SPA router or custom server is required. Cloudflare Pages supplies its normal SPA fallback, so an all-path rewrite is unnecessary.

Serve over HTTPS for secure randomness and cross-tab Web Locks. Loopback development origins are considered secure by modern browsers. Changing origin/domain changes the local wallet; there is no device sync or automatic migration across domains.

## Metadata and indexing

Copy `.env.example` to `.env.local` for local configuration or set public build variables in Pages.

- With `VITE_SITE_URL` empty, output omits canonical/absolute OG URLs; meta robots is `noindex,nofollow`, robots.txt disallows crawling, and no sitemap is emitted.
- To index a real production deployment, set `VITE_SITE_URL` to the actual public HTTPS site URL **and** `VITE_ALLOW_INDEXING=true`, then rebuild. This emits canonical/OG URLs, index/follow, an allow policy and sitemap.xml.
- Keep previews' `VITE_ALLOW_INDEXING=false`, even if a production URL is known. Configure Pages production and preview environment variables separately. Verify generated HTML and robots after deployment; noindex should not remain enabled for intended indexed production.
- No example domain, localhost canonical, fabricated ratings, reviews or operator identity is emitted.

After the first deployment gives you a real Pages URL (or after you attach a real custom domain), set `VITE_SITE_URL` to that exact HTTPS origin with no extra path, query, fragment or credentials. Local addresses, IP literals, private/reserved test hosts and example domains are rejected at build time. Then set `VITE_ALLOW_INDEXING=true` in the production environment and rebuild. These are **build-time values**: changing them does not alter an already-built deployment until it is rebuilt. Keep preview environment indexing disabled. The build does not infer the canonical URL from `CF_PAGES_URL`, localhost or the browser address.

Explanations, Privacy and Terms are in the initial HTML outside the React root. Favicon and original sharing artwork are local. Review social-preview rendering on intended platforms after a real URL is configured.

There is no structured data, fabricated review/rating, placeholder operator or invented contact address. The homepage title and description are original. Sitemap omission before the final URL is known is intentional; no placeholder sitemap is published.

## Repository and configuration hygiene

Commit `package-lock.json`, application source, tests, `.env.example` (public defaults only), and the static assets. Git ignores `node_modules`, `dist`, generated test/coverage reports, `outputs`, scratch files, logs, `.env` and all `.env.*` variants except `.env.example`, local Cloudflare `.dev.vars`/`.wrangler` state, `.npmrc`, and common private-key/credential files. Never assume ignore rules can detect credentials embedded in application source: every `VITE_` value is public and must be checked before committing.

The existing `origin` points to `https://github.com/A-aronA/coin-flip-simulator.git`. Cloudflare is connected to `master` with automatic deployments enabled. No additional repository or infrastructure is needed. Build scripts themselves never push or deploy.

## Advertising, consent and headers

Leave all advertising disabled for the first deployment unless [AD_INTEGRATION.md](AD_INTEGRATION.md) has been completed. Environment values are public, never secrets. A real CMP integration is still required before the fail-closed consent gate permits requests. Fixed refill configuration and publisher review do not activate the variable post-win placement.

`public/_headers` supplies nosniff, a conservative referrer policy, denied embedding, disabled unneeded browser capabilities and baseline CSP restrictions on base URLs, objects, form actions and framing. It intentionally does not invent a restrictive script/frame/network allowlist that would silently break dynamic ad demand. Before enabling ads, review the deployed CSP with the actual provider/CMP domain requirements and consider a tested report-only policy first. Add HSTS only after confirming permanent HTTPS for the real domain.

## Publication tasks

1. Keep Privacy/Terms consistent with the independently operated California website and its actual hosting/data practices. The operator has chosen not to provide a public contact method or registered entity; no personal identity or invented contact is published. The launch review records the limitations of this choice and circumstances that require reassessment.
2. Confirm game classification, applicable publisher/age requirements, account/site/inventory eligibility and permitted demand before enabling monetization. The 18+ notice is not a compliance guarantee.
3. Configure production URL/indexing separately from previews; test robots, sitemap, sharing previews and static headers on the real origin.
4. Run the documented checks. Manually verify mobile, keyboard and reduced motion on target browsers; only Chromium is included in the local execution report.
5. Test live ad inventory and CMP behavior only after legitimate approval/configuration. No fill, revenue or complete browser-crash reward recovery is promised.

Live advertising remains disabled. No purchase, additional infrastructure, or publisher-account change is needed for SEO activation.

## Historical first-deployment review (October 24, 2026)

The local pre-deployment review passed type checking, linting, 124 unit/component/configuration tests, 21 Chromium browser tests (including the production preview), the production build, and the production dependency audit (zero reported vulnerabilities). The lockfile installation dry run also passed. Browser tests included reduced motion, keyboard access, responsive layouts and accessibility checks. Firefox/WebKit, the actual Cloudflare build environment and real ad inventory were not executed locally.

The built homepage has its original title/description, local favicon and sharing image, working same-page anchors, no missing referenced assets, no structured-data claims, and no development ad panel or simulated reward module. The unconfigured refill is visibly unavailable and disabled; production builds reject the mock provider. The unconfigured build is intentionally noindex, contains no canonical URL and emits no sitemap. Initial JavaScript remains 126.32 kB gzipped; the game's design, coin animation, settlement and Safe Bank source were unchanged by this review.

Technical deployment blockers: none for this ads-disabled, unknown-domain initial build. Operator/contact/disclosure review remains a publication decision. Public indexing needs the real production URL and an explicit indexing rebuild. Advertising requires the separate publisher/inventory/consent work described above and stays disabled. No GitHub repository, remote, push or deployment was created by this review.
