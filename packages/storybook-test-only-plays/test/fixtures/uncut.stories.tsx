import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./card";
import { makeStory } from "./make-story";

export default { component: Card } satisfies Meta<typeof Card>;
type Story = StoryObj<typeof Card>;

export const Assigned: Story = { args: { title: "A" } };
Assigned.play = async () => {};

export const Wrapped = makeStory({
  play: async () => {},
});

function variant(title: string): Story {
  return {
    args: { title },
    play: async () => {},
  };
}

export const FromFactory = variant("B");
