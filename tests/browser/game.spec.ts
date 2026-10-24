import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fresh, settle, reveal, SAVE_KEY } from "../../src/domain";
import { available, flip, load, outcomes, readSave } from "./helpers";
test("real-duration flips land on stored faces through consecutive repeated outcomes", async ({
  page,
}) => {
  await outcomes(page, [0, 1, 1, 0, 0]);
  await load(page);
  for (const side of ["Heads", "Tails", "Tails", "Heads", "Heads"]) {
    await flip(page);
    await expect(
      page.getByRole("img", { name: `Coin showing ${side}` }),
    ).toBeVisible();
    const matrix = await page
      .locator(".coin-rotor")
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m11);
    expect(side === "Heads" ? matrix : -matrix).toBeGreaterThan(0.9);
  }
  expect((await readSave(page)).stats.rounds).toBe(5);
  await expect(available(page)).toHaveText("$101.00");
});
test("rapid activation cannot spend twice and reload mid-toss reveals committed result", async ({
  page,
}) => {
  await outcomes(page, [0]);
  await load(page);
  await page.getByRole("button", { name: "$10", exact: true }).click();
  await page.getByRole("button", { name: "Flip Coin", exact: true }).dblclick();
  expect((await readSave(page)).stats.rounds).toBe(1);
  await expect(page.locator(".result-space")).toContainText("Stake committed");
  await expect(available(page)).toHaveText("$90.00");
  await page.reload();
  await expect(page.locator(".result strong")).toHaveText(
    "Heads — You win +$10.00",
  );
  expect((await readSave(page)).stats.rounds).toBe(1);
  await expect(available(page)).toHaveText("$110.00");
});
test("bank examples, full balance, invalid input, and retained unaffordable wager", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await load(page);
  await page.getByText("Manage Safe Bank", { exact: true }).click();
  await page.getByLabel("Amount to deposit", { exact: true }).fill("35.75");
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await expect(available(page)).toHaveText("$64.25");
  await expect(page.getByLabel("Withdraw", { exact: true })).toBeEnabled();
  await page.getByLabel("Withdraw", { exact: true }).check();
  await page.getByLabel("Amount to withdraw", { exact: true }).fill("10.25");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(available(page)).toHaveText("$74.50");
  await expect(page.locator(".balance-bank strong")).toHaveText("$25.50");
  await expect(
    page.getByRole("button", { name: "Withdraw", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Amount to withdraw", { exact: true }).fill("0.001");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("up to 2");
  await expect(available(page)).toHaveText("$74.50");
  await page.getByLabel("Deposit", { exact: true }).check();
  await page.getByLabel("Amount to deposit", { exact: true }).fill("74.50");
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Withdraw from Safe Bank" }),
  ).toBeVisible();
  await expect(available(page)).toHaveText("$0.00");
  await page.reload();
  await expect(page.locator(".balance-bank strong")).toHaveText("$100.00");
});
test("reduced motion, keyboard focus, validation and held Enter", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await outcomes(page, [1]);
  await load(page);
  const input = page.getByLabel("Your wager Fictional credits");
  await input.fill("1.001");
  await expect(
    page.getByRole("button", { name: "Flip Coin", exact: true }),
  ).toBeDisabled();
  await input.fill("1.2");
  await input.press("Tab");
  await expect(input).toHaveValue("1.20");
  await input.focus();
  const start = Date.now();
  await page.keyboard.down("Enter");
  await expect(page.locator(".game-card")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".result strong")).toContainText("You lost $1.20");
  expect(Date.now() - start).toBeLessThan(1500);
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  expect((await readSave(page)).stats.rounds).toBe(1);
  await expect(input).toBeFocused();
});
test("secondary tabs synchronize and can take ownership after the writer closes", async ({
  page,
  context,
}) => {
  await load(page);
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByText("Another tab is playing")).toBeVisible();
  await expect(
    other.getByRole("button", { name: "Flip Coin", exact: true }),
  ).toBeDisabled();
  await page.getByText("Manage Safe Bank", { exact: true }).click();
  await page.getByLabel("Amount to deposit", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await expect(available(other)).toHaveText("$80.00");
  await page.close();
  await other.getByRole("button", { name: "Retry ownership" }).click();
  await expect(
    other.getByRole("button", { name: "Flip Coin", exact: true }),
  ).toBeEnabled();
});
test("empty-wallet recovery is explicit and changes the save generation", async ({
  page,
}) => {
  const s = reveal(
    settle(fresh("empty"), "heads", "100", "tails", "empty:1"),
    "empty:1",
  );
  await page.addInitScript(
    ({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
    { key: SAVE_KEY, save: s },
  );
  await page.goto("/");
  await expect(
    page.getByText("Your available credits have run out."),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Settings & recovery" })
    .click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(available(page)).toHaveText("$0.00");
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page
    .getByRole("button", { name: "Yes, start over", exact: true })
    .click();
  await expect(available(page)).toHaveText("$100.00");
  expect((await readSave(page)).generation).not.toBe("empty");
});
for (const width of [320, 390, 768, 1440])
  test(`layout and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await load(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: `outputs/${width === 320 ? "mobile" : "desktop"}-full.png`,
        fullPage: true,
      });
  });
test("default build uses no third-party requests or failed local assets", async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = [],
    failed: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:5173")
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failed.push(r.url()));
  await load(page);
  await flip(page);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
test("200% text remains usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await load(page);
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await page.getByText("Manage Safe Bank", { exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByLabel("Amount to deposit", { exact: true }),
  ).toBeVisible();
});
