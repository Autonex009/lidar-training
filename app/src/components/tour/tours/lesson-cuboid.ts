import type { TourDefinition } from "../types";

/** Mini walkthrough for the live cuboid exercise in Learn (module 4). Events come from `CuboidLiveWidget`. */
export const lessonCuboidTour: TourDefinition = {
  key: "lesson-cuboid",
  title: "Draw your first cuboid",
  scope: "page",
  intro: {
    heading: "Draw your first cuboid",
    body: "Six short steps with the real cuboid tools: draw, move, resize, rotate, fit and label a box on the pulsing car. You can reopen this from Help at any time.",
    estimatedMinutes: 3,
    previewKind: "none",
  },
  steps: [
    {
      key: "create", title: "Draw a box",
      instruction: "Press **C** or pick the **Create** tool, then drag on the ground around the car with the pulsing outline.",
      keycaps: ["C", "+", { glyph: "mouse-left" }],
      spotlight: { selector: "lc-canvas", padding: 2 }, placement: "near-target",
      complete: { kind: "event", event: "lc:created" },
    },
    {
      key: "move", title: "Move the box",
      instruction: "Press **M** and drag the box onto the car, or nudge it with the **arrow keys**.",
      keycaps: ["M", "/", { glyph: "arrow-left" }, { glyph: "arrow-right" }],
      spotlight: { selector: "lc-canvas", padding: 2 }, placement: "near-target",
      complete: { kind: "event", event: "lc:moved" },
    },
    {
      key: "resize", title: "Resize it",
      instruction: "Press **V** (select) and drag a lime handle on a face, or hold **Shift** and use the arrow keys.",
      keycaps: ["V", "/", { glyph: "shift" }, "+", { glyph: "arrow-up" }],
      spotlight: { selector: "lc-canvas", padding: 2 }, placement: "near-target",
      complete: { kind: "event", event: "lc:resized" },
    },
    {
      key: "rotate", title: "Match the heading",
      instruction: "Press **Q** or **E** to rotate the box about 2° per press until its length lines up with the car.",
      keycaps: ["Q", "E"],
      spotlight: { selector: "lc-canvas", padding: 2 }, placement: "near-target",
      complete: { kind: "event", event: "lc:rotated" },
    },
    {
      key: "fit", title: "Fit to points",
      instruction: "Click **Fit to points** (or press **G**) to snap the box tightly around the points inside it.",
      keycaps: ["G"],
      spotlight: { selector: "lc-fit", padding: 4 }, placement: "near-target",
      complete: { kind: "event", event: "lc:fit-clicked" },
    },
    {
      key: "label", title: "Set the label",
      instruction: "Choose **Vehicle** in the Label list for the selected box.",
      spotlight: { selector: "lc-label", padding: 4 }, placement: "near-target",
      complete: { kind: "event", event: "lc:labelled" },
    },
    {
      key: "mistakes", title: "Check your mistakes",
      instruction: "Turn on **Show my mistakes**: red faces cut object points, yellow faces include more than 20% empty margin. Aim for IoU 0.70 or better.",
      spotlight: { selector: "lc-mistakes", padding: 4 }, placement: "near-target",
      complete: { kind: "manual" },
    },
  ],
};
