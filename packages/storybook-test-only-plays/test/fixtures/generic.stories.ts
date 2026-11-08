import type { Meta, StoryObj } from "@storybook/html";

const identity = <T>(value: T): T => value;
const cast = <string>identity("x");

const meta: Meta = { title: "Plain", render: () => cast };
export default meta;

export const Plain: StoryObj = {
  play: async ({ canvasElement }) => {
    canvasElement.dataset.marker = "MARKER_TS_PLAY";
  },
};
