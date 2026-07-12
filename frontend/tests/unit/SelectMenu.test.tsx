import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SelectMenu } from "@/components/SelectMenu";

const options = [
  { value: "most", label: "Most backed" },
  { value: "new", label: "Newest" },
  { value: "closing", label: "Closing soon" },
];

function Harness() {
  const [value, setValue] = useState("most");
  return (
    <SelectMenu
      value={value}
      options={options}
      onChange={setValue}
      ariaLabel="Sort campaigns"
    />
  );
}

describe("SelectMenu", () => {
  it("opens and commits a selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Sort campaigns" });
    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Sort campaigns" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Newest" }));
    expect(trigger).toHaveTextContent("Newest");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("supports arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Sort campaigns" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Most backed" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(trigger).toHaveTextContent("Newest");
  });
});
