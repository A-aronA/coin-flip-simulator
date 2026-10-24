import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { readAdConfig } from "./src/ads/config.ts";
function metadata(env: Record<string, string>): Plugin {
  let url = "";
  if (env.VITE_SITE_URL) {
    const u = new URL(env.VITE_SITE_URL);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      u.hostname === "localhost" ||
      u.hostname.endsWith(".example") ||
      ["example.com", "example.org", "example.net"].includes(u.hostname) ||
      u.hostname.endsWith(".test") ||
      u.hostname.endsWith(".invalid") ||
      u.hostname === "127.0.0.1"
    )
      throw new Error("VITE_SITE_URL must be a real production HTTPS URL.");
    url = u.href.replace(/\/$/, "");
  }
  const indexed = !!url && env.VITE_ALLOW_INDEXING === "true";
  return {
    name: "local-site-metadata",
    transformIndexHtml(html) {
      return html.replace(
        "<!-- BUILD_METADATA -->",
        `<meta name="robots" content="${indexed ? "index,follow" : "noindex,nofollow"}">${url ? `<link rel="canonical" href="${url}/"><meta property="og:url" content="${url}/"><meta property="og:image" content="${url}/share.png"><meta name="twitter:image" content="${url}/share.png">` : ""}`,
      );
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\n${indexed ? `Allow: /\nSitemap: ${url}/sitemap.xml` : "Disallow: /"}\n`,
      });
      if (url && indexed)
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url}/</loc></url></urlset>`,
        });
    },
  };
}
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  readAdConfig(env, command === "serve" && mode !== "production");
  return {
    plugins: [react(), metadata(env)],
    test: {
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      clearMocks: true,
    },
    build: { target: "es2022" },
  };
});
