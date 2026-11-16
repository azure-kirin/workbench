import preview from "../.storybook/preview";
import { Button } from "./button";

const meta = preview.meta({
  component: Button,
  play: async () => {
    document.title = "MARKER_META";
  },
});

export const Primary = meta.story({
  args: { label: "Save" },
  play: async ({ canvas }) => {
    await canvas.getByRole("button", { name: "MARKER_STORY" }).click();
  },
});

export const Secondary = Primary.extend({
  args: { variant: "secondary" },
  async play() {
    document.title = "MARKER_EXTEND";
  },
});

export const Shortcut = meta.story(() => <Button label="Render only" />);

// A test entry of its own: Storybook lists it, and opening it is opening a test.
Primary.test("saves on click", async ({ canvas }) => {
  await canvas.getByRole("button").click();
});
