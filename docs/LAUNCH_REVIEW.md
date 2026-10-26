# Pre-indexing content and privacy review — October 25, 2026

Production origin: **https://coin-flip-simulator.pages.dev/**. Repository: **https://github.com/A-aronA/coin-flip-simulator**, branch `master`. This is a factual content/technical review, not legal certification or a guarantee of compliance in every jurisdiction.

## Confirmed facts and corrections

The operator supplied only: independently operated website; California, United States; no registered legal entity; no public contact method. No personal name, personal contact information, company, address or email has been invented for the website. A registered company is not a technical prerequisite for this static site or indexing.

The public Privacy Policy and Terms now clearly distinguish fictional credits from money: no real-money deposits, purchases or withdrawals; no cash value or redemption for money, goods, services or prizes; no player-to-player transfer. Safe Bank stores and moves fictional credits only. Game mechanics, probabilities, integer-cent calculations, balances, bank behavior, animations, confetti and CSS are unchanged.

Game progress (balances, bank, statistics, bounded recent history, save IDs and reward status) stays in this browser. There is no account, operator-hosted wallet or game-progress upload. localStorage has no application expiry and can be cleared or edited; browser policies may erase it. Session-only progress ends on close/reload. Reset and browser site-data settings are the available local controls; there is no server backup.

Cloudflare Pages delivers the site. Cloudflare may process visitor IP addresses and technical request/traffic information for delivery and security. Its records are separate from local game storage; no retention period or guaranteed deletion of hosting records was invented. The policy links [Cloudflare's own explanation](https://www.cloudflare.com/privacypolicy/). The reviewed rendered live site requested no external ad/analytics resources, and its refill control was disabled. Hosting traffic processing must not be described as “no information collected.”

The policy now describes Do Not Track behavior, policy-update notices and effective date. It explicitly says no live ads/rewarded ads are currently served. Future activation requires updated disclosures, appropriate consent and provider approval; it does not promise currently unavailable live rewards.

## Contact-method assessment

California's [Attorney General guidance and CalOPPA appendix](https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf) distinguish minimum disclosures from recommended practices. The listed CalOPPA requirements include data/third-party categories, an existing review/change process if one is maintained, policy-change notification, effective date and tracking disclosures. The guidance recommends a privacy contact; its contact recommendation is not itself a universal requirement to create an email or register a company.

No evidence in the supplied facts establishes that the operator meets the CCPA's business-coverage thresholds. That is not a finding that a free or unregistered operation is automatically exempt. If CCPA coverage applies, valid request methods and the required notices/responses would need to be provided. See the [California Attorney General CCPA guidance](https://oag.ca.gov/privacy/ccpa) and [CPPA's effective 2025 monetary adjustment](https://www.cppa.ca.gov/regulations/cpi_adjustment.html); the adjusted revenue threshold is $26,625,000, alongside the separate data-volume and sale/sharing-revenue tests.

On the reviewed current facts, the absence of a registered company/public email is not by itself an established critical blocker to technical indexing. It remains a transparency/support limitation, which the site accurately discloses. Reassess contact/rights obligations if coverage thresholds, data practices, target audiences or applicable law change. No blanket exemption, legal approval, regulatory endorsement or legal certification is claimed.

## Production configuration and verification

```text
VITE_SITE_URL=https://coin-flip-simulator.pages.dev
VITE_ALLOW_INDEXING=true
VITE_AD_PROVIDER=disabled
VITE_AD_CONSENT_CONFIGURED=false
```

These are production **build-time** variables. Keep preview indexing false. Changing the dashboard variables alone does not alter already published assets; rebuild/deploy the reviewed commit and verify the production alias.

Expected artifacts: one canonical homepage URL with trailing slash; `index,follow`; absolute OG/Twitter image URLs to the local 1200×630 sharing image with alt text; `robots.txt` allowing `/` and declaring the sitemap; XML at **https://coin-flip-simulator.pages.dev/sitemap.xml** containing only the canonical homepage. Same-page Privacy/Terms anchors do not need separate sitemap URLs. No fabricated structured-data reviews, ratings or organization identity are added.

The title, description, favicon and semantic heading structure are already suitable and were retained. Public content remains in the initial HTML under the existing compact disclosures. Automated launch tests cover accurate disclosures, production-origin metadata and XML generation; existing game/accessibility/browser tests continue to protect the game.

## Search Console handoff

After live verification, add a **URL-prefix property** for `https://coin-flip-simulator.pages.dev/` in Google Search Console. Use the exact HTML verification tag or HTML file Google supplies; do not invent a token. The operator cannot verify ownership of the whole `pages.dev` parent DNS zone. No analytics installation is needed. Keep the verification artifact after verification, submit `sitemap.xml`, and use URL Inspection on the canonical homepage. See [Google's verification instructions](https://support.google.com/webmasters/answer/9008080). Indexable metadata and a sitemap permit discovery but do not guarantee indexing or rankings.

Any deployment/push completion must be checked against the actual Git remote and Cloudflare deployment status; this document is not proof of a completed deployment by itself.
