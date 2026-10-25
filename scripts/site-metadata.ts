import { isIP } from "node:net";

/** Build-time only: never infer a canonical origin from a preview or local URL. */
export function siteMetadata(env: Record<string, string | undefined>) {
  let siteUrl = "";
  if (env.VITE_SITE_URL) {
    const url = new URL(env.VITE_SITE_URL);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const reservedHosts = [
      "localhost",
      "local",
      "localdomain",
      "internal",
      "lan",
      "home.arpa",
      "test",
      "invalid",
      "example",
      "example.com",
      "example.org",
      "example.net",
    ];
    const localOrReserved = reservedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
    const domainLabels = hostname.split(".");
    const validDomain =
      domainLabels.length > 1 &&
      domainLabels.every((label) =>
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
      );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      localOrReserved ||
      !validDomain ||
      isIP(hostname.replace(/^\[|\]$/g, "")) !== 0
    ) {
      throw new Error(
        "VITE_SITE_URL must be your real public HTTPS site origin, without a path, credentials, query, or local/test address.",
      );
    }
    url.hostname = hostname;
    siteUrl = url.href.replace(/\/$/, "");
  }
  const indexed = !!siteUrl && env.VITE_ALLOW_INDEXING === "true";
  const head = `<meta name="robots" content="${indexed ? "index,follow" : "noindex,nofollow"}">${siteUrl ? `<link rel="canonical" href="${siteUrl}/"><meta property="og:url" content="${siteUrl}/"><meta property="og:image" content="${siteUrl}/share.png"><meta name="twitter:image" content="${siteUrl}/share.png">` : ""}`;
  return {
    siteUrl,
    indexed,
    head,
    robots: `User-agent: *\n${indexed ? `Allow: /\nSitemap: ${siteUrl}/sitemap.xml` : "Disallow: /"}\n`,
    sitemap: indexed
      ? `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url></urlset>`
      : null,
  };
}
