import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteMetadata } from "../scripts/site-metadata";

const source = readFileSync("index.html", "utf8");
const document = new DOMParser().parseFromString(source, "text/html");
const privacy = document.querySelector("#privacy")!.textContent!;
const terms = document.querySelector("#terms")!.textContent!;
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

describe("launch disclosures", () => {
  it("distinguishes fictional credits and Safe Bank from real money", () => {
    const text = compact(terms);
    expect(text).toContain("fictional credits exclusively");
    expect(text).toContain(
      "cannot deposit, purchase, wager, or withdraw real money",
    );
    expect(text).toContain(
      "cannot be redeemed for money, goods, services, or prizes",
    );
    expect(text).toContain("not real-money transactions");
    expect(text).toContain("adults 18+");
  });
  it("explains local storage, loss, hosting and disabled advertising accurately", () => {
    const text = compact(privacy);
    for (const phrase of [
      "localStorage",
      "does not upload",
      "may erase it",
      "no server backup",
      "Cloudflare Pages",
      "IP addresses",
      "Do Not Track",
      "No live advertisements or rewarded ads are currently served",
    ])
      expect(text).toContain(phrase);
    expect(
      document.querySelector(
        '#privacy a[href="https://www.cloudflare.com/privacypolicy/"]',
      ),
    ).not.toBeNull();
    expect(text).not.toMatch(
      /we collect nothing|no information is collected|legally certified/i,
    );
  });
  it("uses only the operator information authorized for publication", () => {
    const text = compact(privacy);
    expect(text).toContain(
      "independently operated website based in California, United States",
    );
    expect(text).toContain("public contact method is not currently provided");
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(privacy + terms).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    );
    expect(privacy + terms).not.toMatch(/\[(?:your|insert|operator|contact)/i);
  });
});

describe("approved production origin", () => {
  it("generates indexable metadata and an XML sitemap for the supplied live URL", () => {
    const url = "https://coin-flip-simulator.pages.dev";
    const meta = siteMetadata({
      VITE_SITE_URL: url,
      VITE_ALLOW_INDEXING: "true",
    });
    const head = new DOMParser().parseFromString(
      `<head>${meta.head}</head>`,
      "text/html",
    );
    expect(
      head.querySelector('meta[name="robots"]')!.getAttribute("content"),
    ).toBe("index,follow");
    expect(
      head.querySelector('link[rel="canonical"]')!.getAttribute("href"),
    ).toBe(`${url}/`);
    expect(
      head.querySelector('meta[property="og:url"]')!.getAttribute("content"),
    ).toBe(`${url}/`);
    expect(
      head.querySelector('meta[property="og:image"]')!.getAttribute("content"),
    ).toBe(`${url}/share.png`);
    expect(meta.robots).toBe(
      `User-agent: *\nAllow: /\nSitemap: ${url}/sitemap.xml\n`,
    );
    const sitemap = new DOMParser().parseFromString(
      meta.sitemap!,
      "application/xml",
    );
    expect(sitemap.querySelector("loc")!.textContent).toBe(`${url}/`);
    expect(meta.head + meta.robots + meta.sitemap).not.toMatch(
      /localhost|127\.0\.0\.1|noindex|example\.com/,
    );
  });
});
