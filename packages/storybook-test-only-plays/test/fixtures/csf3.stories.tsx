import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Player } from "./player";

const meta = {
  title: "Media/Player",
  component: Player,
  // A play on the meta runs for every story that has none of its own.
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeVisible();
  },
} satisfies Meta<typeof Player>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Shared by several stories below, by reference. */
const pressPlay: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "MARKER_PRESS_PLAY" }));
};

/** Not a story: a control the render function calls. Its `play` is the player's. */
const controls = {
  play(video: HTMLVideoElement) {
    return video.play();
  },
};

export const Paused: Story = {
  args: { src: "clip.mp4", play: false, onPlay: () => {} },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("video")?.focus();
    canvasElement.dataset.marker = "MARKER_ARROW";
  },
};

export const Playing = {
  args: { src: "clip.mp4", play: true },
  play: pressPlay,
  render: (args) => {
    const ref = (video: HTMLVideoElement | null) => video && controls.play(video);
    return <Player {...args} ref={ref} />;
  },
} satisfies Story;

export const Method: Story = {
  async play() {
    document.title = "MARKER_METHOD";
  },
  name: "Method play",
};

const base: Story = { args: { src: "base.mp4" }, "play": async () => {} };

export const Spread: Story = { ...base, play: pressPlay };

export const FromBase: Story = { ...base };

export const NoPlay: Story = {
  parameters: { player: { play: () => "parameter, not a play" } },
};
