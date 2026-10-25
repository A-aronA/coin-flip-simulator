import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { readAdConfig } from "./src/ads/config.ts";
import { siteMetadata } from "./scripts/site-metadata.ts";
function metadata(env: Record<string, string>): Plugin {
  const meta = siteMetadata(env);
  return {
    name: "local-site-metadata",
    transformIndexHtml(html) {
      return html.replace("<!-- BUILD_METADATA -->", meta.head);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: meta.robots,
      });
      if (meta.sitemap)
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: meta.sitemap,
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
