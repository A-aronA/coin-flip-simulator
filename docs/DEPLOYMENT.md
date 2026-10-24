# Static deployment preparation

Nothing was published. The app needs only static hosting, with no Functions, Workers, backend or paid infrastructure.

## Cloudflare Pages

Follow the current [Cloudflare React guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/). Use Node 24 LTS, install with `npm ci`, build command **`npm run build`**, output directory **`dist`**, and this project as the root directory. The checked-in npm lockfile pins the dependency graph. Preview locally with `npm run preview` after building. No deployment command is included or required for local work.

Serve over HTTPS for secure randomness and cross-tab Web Locks. Loopback development origins are considered secure by modern browsers. Changing origin/domain changes the local wallet; there is no device sync or automatic migration across domains.

## Metadata and indexing

Copy `.env.example` to `.env.local` for local configuration or set public build variables in Pages.

- With `VITE_SITE_URL` empty, output omits canonical/absolute OG URLs; meta robots is `noindex,nofollow`, robots.txt disallows crawling, and no sitemap is emitted.
- To index a real production deployment, set `VITE_SITE_URL` to the actual public HTTPS site URL **and** `VITE_ALLOW_INDEXING=true`, then rebuild. This emits canonical/OG URLs, index/follow, an allow policy and sitemap.xml.
- Keep previews' `VITE_ALLOW_INDEXING=false`, even if a production URL is known. Configure Pages production and preview environment variables separately. Verify generated HTML and robots after deployment; noindex should not remain enabled for intended indexed production.
- No example domain, localhost canonical, fabricated ratings, reviews or operator identity is emitted.

Explanations, Privacy and Terms are in the initial HTML outside the React root. Favicon and original sharing artwork are local. Review social-preview rendering on intended platforms after a real URL is configured.

## Advertising, consent and headers

Leave all advertising disabled for the first deployment unless [AD_INTEGRATION.md](AD_INTEGRATION.md) has been completed. Environment values are public, never secrets. A real CMP integration is still required before the fail-closed consent gate permits requests. Fixed refill configuration and publisher review do not activate the variable post-win placement.

`public/_headers` supplies nosniff, a conservative referrer policy, denied embedding, disabled unneeded browser capabilities and baseline CSP restrictions on base URLs, objects, form actions and framing. It intentionally does not invent a restrictive script/frame/network allowlist that would silently break dynamic ad demand. Before enabling ads, review the deployed CSP with the actual provider/CMP domain requirements and consider a tested report-only policy first. Add HSTS only after confirming permanent HTTPS for the real domain.

## Publication tasks

1. Supply the real operator identity/contact information where applicable and review visible Terms/Privacy for the actual deployment and audience.
2. Confirm game classification, applicable publisher/age requirements, account/site/inventory eligibility and permitted demand before enabling monetization. The 18+ notice is not a compliance guarantee.
3. Configure production URL/indexing separately from previews; test robots, sitemap, sharing previews and static headers on the real origin.
4. Run the documented checks. Manually verify mobile, keyboard and reduced motion on target browsers; only Chromium is included in the local execution report.
5. Test live ad inventory and CMP behavior only after legitimate approval/configuration. No fill, revenue or complete browser-crash reward recovery is promised.

No accounts have been connected, and no publication, purchase, publisher-account change or live ad request was made during development.
