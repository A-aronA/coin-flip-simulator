import { test, expect } from "@playwright/test";
import { available, flip, load, outcomes, readSave } from "./helpers";
test.beforeEach(async ({ page }) => {
  await outcomes(page, [0]);
  await load(page);
  await expect(
    page.getByText("Development ad simulator — no real ad"),
  ).toBeVisible();
});
for (const scenario of [
  "grant",
  "close",
  "no-fill",
  "error",
  "delayed",
  "repeated",
])
  test(`explicit development scenario: ${scenario}`, async ({ page }) => {
    await page.getByLabel("Test scenario").selectOption(scenario);
    await page.getByRole("button", { name: "Watch Ad — Earn $10" }).click();
    await expect(
      page.getByRole("button", { name: "Flip Coin", exact: true }),
    ).toBeEnabled();
    await expect(available(page)).toHaveText(
      ["grant", "delayed", "repeated"].includes(scenario)
        ? "$110.00"
        : "$100.00",
    );
    expect((await readSave(page)).stats.adCredits).toBe(
      ["grant", "delayed", "repeated"].includes(scenario) ? 1000 : 0,
    );
  });
test("optional 1% offer, Continue, failed retry and grant", async ({
  page,
}) => {
  await page.getByRole("button", { name: "$10", exact: true }).click();
  await flip(page);
  await expect(available(page)).toHaveText("$110.00");
  await expect(
    page.getByText("Optional bonus: +$0.20 in game credits."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Watch Ad for +1%" }),
  ).toHaveCount(0);
  await flip(page);
  await page.getByLabel("Test scenario").selectOption("no-fill");
  await page.getByRole("button", { name: "Watch Ad for +1%" }).click();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Test scenario").selectOption("repeated");
  await page.getByRole("button", { name: "Watch Ad for +1%" }).click();
  await expect(
    page.getByRole("button", { name: "Flip Coin", exact: true }),
  ).toBeEnabled();
  await expect(available(page)).toHaveText("$120.20");
  expect((await readSave(page)).stats.profit).toBe(2000);
  expect((await readSave(page)).stats.adCredits).toBe(20);
});
test("canceling delayed grant cannot credit; reload never invents reward", async ({
  page,
}) => {
  await page.getByLabel("Test scenario").selectOption("delayed");
  await page.getByRole("button", { name: "Watch Ad — Earn $10" }).click();
  await page.getByRole("button", { name: "Cancel ad" }).click();
  await expect(available(page)).toHaveText("$100.00");
  await page.getByRole("button", { name: "Watch Ad — Earn $10" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Flip Coin", exact: true }),
  ).toBeEnabled();
  await expect(available(page)).toHaveText("$100.00");
});
