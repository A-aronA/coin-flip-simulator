import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { siteMetadata } from "../scripts/site-metadata";

describe("publication metadata", () => {
  it("keeps an unconfigured first deployment out of indexing", () => {
    const meta = siteMetadata({});
    expect(meta.indexed).toBe(false);
    expect(meta.head).toContain('content="noindex,nofollow"');
    expect(meta.head).not.toContain('rel="canonical"');
    expect(meta.head).not.toContain('property="og:url"');
    expect(meta.robots).toBe("User-agent: *\nDisallow: /\n");
    expect(meta.sitemap).toBeNull();
    expect(siteMetadata({ VITE_ALLOW_INDEXING: "true" }).indexed).toBe(false);
  });

  // A known public host is only a pure-function fixture; it is never configured as this game's domain.
  const publicOrigin = "https://developers.cloudflare.com";
  it("emits a canonical origin and sitemap only after explicit configuration", () => {
    const meta = siteMetadata({
      VITE_SITE_URL: publicOrigin,
      VITE_ALLOW_INDEXING: "true",
    });
    expect(meta.indexed).toBe(true);
    expect(meta.head).toContain('content="index,follow"');
    expect(meta.head).toContain(`rel="canonical" href="${publicOrigin}/"`);
    expect(meta.head).toContain(`${publicOrigin}/share.png`);
    expect(meta.robots).toContain(`Sitemap: ${publicOrigin}/sitemap.xml`);
    expect(meta.sitemap).toContain(`<loc>${publicOrigin}/</loc>`);
  });
  it("keeps known-origin previews noindex unless indexing is enabled", () => {
    const meta = siteMetadata({
      VITE_SITE_URL: `${publicOrigin}/`,
      VITE_ALLOW_INDEXING: "false",
    });
    expect(meta.siteUrl).toBe(publicOrigin);
    expect(meta.indexed).toBe(false);
    expect(meta.sitemap).toBeNull();
    expect(meta.robots).not.toContain("Sitemap:");
  });
  it.each([
    "http://developers.cloudflare.com",
    "https://localhost:5173",
    "https://preview.localhost",
    "https://localhost.",
    "https://127.0.0.1",
    "https://127.1",
    "https://127.0.0.2",
    "https://[::1]",
    "https://[::]",
    "https://0.0.0.0",
    "https://192.168.1.2",
    "https://game.local",
    "https://game.home.arpa",
    "https://server",
    "https://example.com",
    "https://www.example.com",
    "https://game.example",
    "https://game.test",
    "https://game.invalid",
    `${publicOrigin}/subpath`,
    `${publicOrigin}/?secret=value`,
    `${publicOrigin}/#game`,
    "https://user:password@developers.cloudflare.com",
    "not a URL",
  ])("refuses unsafe publication URL %s", (url) => {
    expect(() =>
      siteMetadata({ VITE_SITE_URL: url, VITE_ALLOW_INDEXING: "true" }),
    ).toThrow();
  });
});

describe("Git publication boundary", () => {
  it("excludes local environment files, private keys and generated output", () => {
    const paths = [
      ".env",
      ".env.local",
      ".env.production",
      ".env.production.local",
      ".env.development.local",
      ".dev.vars",
      ".dev.vars.production",
      ".npmrc",
      "secrets/token.json",
      "credentials.json",
      "service-account.json",
      "private.pem",
      "private.key",
      "node_modules/package/package.json",
      "dist/index.html",
      "outputs/archive.zip",
      "coverage/index.html",
      "test-results/result.json",
      ".wrangler/state.json",
    ];
    const ignored = execFileSync("git", ["check-ignore", "--stdin"], {
      input: `${paths.join("\n")}\n`,
      encoding: "utf8",
    })
      .trim()
      .split(/\r?\n/);
    expect(ignored).toEqual(paths);
    expect(
      spawnSync("git", ["check-ignore", "--no-index", ".env.example"]).status,
    ).toBe(1);
    expect(
      execFileSync(
        "git",
        ["ls-files", "--cached", "--ignored", "--exclude-standard"],
        { encoding: "utf8" },
      ).trim(),
    ).toBe("");
  });
});
