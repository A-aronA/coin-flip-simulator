import { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
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
beforeEach(async () => {
  await waitFor(() => expect(game.getView().busy).toBe(false));
  act(() => game.reset());
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

it("requires a completed wager and locks multiplier shortcuts during a toss", () => {
  render(<App />);
  const double = screen.getByRole("button", { name: "Double wager" });
  const triple = screen.getByRole("button", { name: "Triple wager" });
  expect(double).toBeDisabled();
  expect(triple).toBeDisabled();
  act(() => game.flip("heads", "1.00"));
  expect(double).toBeDisabled();
  expect(triple).toBeDisabled();
  act(() => game.reveal(game.getView().snapshot!.last!.id));
  expect(double).toBeEnabled();
  expect(triple).toBeEnabled();
  act(() => game.reset());
  expect(double).toBeDisabled();
  expect(triple).toBeDisabled();
});

it.each([
  ["0.01", "0.02", "0.03"],
  ["1.01", "2.02", "3.03"],
  ["33.33", "66.66", "99.99"],
])(
  "multiplies the last %s wager exactly without compounding or flipping",
  async (last, doubled, tripled) => {
    act(() => {
      game.flip("heads", last);
      game.reveal(game.getView().snapshot!.last!.id);
    });
    render(<App />);
    const user = userEvent.setup();
    const wager = screen.getByLabelText("Your wager Fictional credits");
    const settled = game.getView().snapshot;
    await user.clear(wager);
    await user.type(wager, "7.00");
    await user.click(screen.getByRole("button", { name: "Double wager" }));
    expect(wager).toHaveValue(doubled);
    await user.click(screen.getByRole("button", { name: "Double wager" }));
    expect(wager).toHaveValue(doubled);
    await user.click(screen.getByRole("button", { name: "Triple wager" }));
    expect(wager).toHaveValue(tripled);
    expect(game.getView().snapshot).toBe(settled);
  },
);

it("allows exactly $100 but disables multipliers above the per-wager cap", async () => {
  act(() => {
    game.flip("heads", "50.00");
    game.reveal(game.getView().snapshot!.last!.id);
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Double wager" }));
  expect(screen.getByLabelText("Your wager Fictional credits")).toHaveValue(
    "100.00",
  );
  expect(screen.getByRole("button", { name: "Triple wager" })).toBeDisabled();
});

it("uses losing wagers too and never funds shortcuts from the Safe Bank", async () => {
  act(() => {
    game.flip("tails", "10.00");
    game.reveal(game.getView().snapshot!.last!.id);
    game.transfer("deposit", "60.01");
  });
  render(<App />);
  await waitFor(() => expect(game.getView().busy).toBe(false));
  const double = screen.getByRole("button", { name: "Double wager" });
  const triple = screen.getByRole("button", { name: "Triple wager" });
  expect(double).toBeEnabled();
  expect(triple).toBeDisabled();
  expect(triple).toHaveAttribute(
    "title",
    "This would exceed your available credits.",
  );
  act(() => game.transfer("deposit", "10.00"));
  await waitFor(() => expect(game.getView().busy).toBe(false));
  expect(double).toBeDisabled();
  expect(screen.getByLabelText("Your wager Fictional credits")).toHaveValue(
    "1.00",
  );
  expect(game.getView().snapshot!.bank).toBe(7001);
});
