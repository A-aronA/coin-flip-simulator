import { expect, type Page } from "@playwright/test";
import { SAVE_KEY, type Snapshot } from "../../src/domain";
export async function outcomes(page: Page, bits: number[]) {
  await page.addInitScript((values) => {
    let i = 0;
    Object.defineProperty(crypto, "getRandomValues", {
      value: (array: Uint8Array) => {
        array.fill(values[i++ % values.length]);
        return array;
      },
    });
  }, bits);
}
export async function readSave(page: Page): Promise<Snapshot> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    SAVE_KEY,
  );
}
export async function load(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Flip Coin", exact: true }),
  ).toBeEnabled();
}
export async function flip(page: Page) {
  await page.getByRole("button", { name: "Flip Coin", exact: true }).click();
  await expect(page.locator(".game-card")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".result strong")).toBeVisible();
}
export const available = (page: Page) =>
  page.locator(".balance-available strong");
