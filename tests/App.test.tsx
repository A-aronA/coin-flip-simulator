import { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import App from "../src/App";
import { game } from "../src/controller";
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../src/controller", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/controller")>();
  return {
    ...actual,
    game: new actual.GameController({
      session: true,
      outcome: () => "heads",
      reduced: () => true,
      id: () => crypto.randomUUID(),
    }),
  };
});
beforeAll(async () => {
  await game.start();
});
afterEach(() => cleanup());
it("is accessible by labels and Strict Mode does not replay a financial transaction", async () => {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "$10" }));
  await user.click(screen.getByRole("button", { name: "Flip Coin" }));
  await waitFor(() =>
    expect(screen.getByText("Heads — You win +$10.00")).toBeVisible(),
  );
  expect(game.getView().snapshot!.stats.rounds).toBe(1);
  expect(game.getView().snapshot!.available).toBe(11000);
  expect(screen.getByRole("radio", { name: "Heads" })).toBeChecked();
  expect(screen.getByLabelText("Your wager Fictional credits")).toHaveValue(
    "10.00",
  );
});
it("preserves an unaffordable input rather than silently clamping the next wager", async () => {
  await act(async () => game.reset());
  render(<App />);
  const user = userEvent.setup();
  const wager = screen.getByLabelText("Your wager Fictional credits");
  await user.clear(wager);
  await user.type(wager, "100.00");
  await user.click(screen.getByText("Manage Safe Bank", { exact: true }));
  await user.type(
    screen.getByLabelText("Amount to deposit", { exact: true }),
    "100",
  );
  await user.click(screen.getByRole("button", { name: "Deposit" }));
  expect(wager).toHaveValue("100.00");
  expect(screen.getByRole("button", { name: "Flip Coin" })).toBeDisabled();
  expect(
    screen.getByText("This wager exceeds your available credits."),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Withdraw from Safe Bank" }),
  ).toBeVisible();
});
