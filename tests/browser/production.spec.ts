import { test, expect } from "@playwright/test";
import { available, flip, load, outcomes } from "./helpers";
test("production smoke: gameplay, assets, metadata, no mocks or third-party requests", async ({
  page,
  request,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:4173")
      external.push(r.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("VITE_AD_PROVIDER", "mock");
    localStorage.setItem("VITE_ENABLE_DEV_ADS", "true");
  });
  await outcomes(page, [0]);
  await load(page);
  await expect(
    page.getByText("Development ad simulator — no real ad"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Watch Ad — Earn $10" }),
  ).toBeDisabled();
  await flip(page);
  await expect(available(page)).toHaveText("$101.00");
  await page.reload();
  await expect(available(page)).toHaveText("$101.00");
  expect(
    await page.locator('meta[name="robots"]').getAttribute("content"),
  ).toBe("noindex,nofollow");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect((await request.get("/favicon.svg")).ok()).toBe(true);
  expect((await request.get("/share.png")).headers()["content-type"]).toContain(
    "image/png",
  );
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
