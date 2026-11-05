import { setInputDevice } from "@/lib/tour/inputDevice";
import { emitTourEvent } from "@/lib/tour/events";
import type { TourDefinition } from "../types";

const toFly = () => emitTourEvent("viewer:profile", "fly");

/** 3D scene navigation: interaction model follows the Encord tutorial screenshots. */
export const navigationTour: TourDefinition = {
  key: "navigation-3d",
  title: "3D scene navigation",
  scope: "page",
  intro: {
    heading: "Learn 3D scene navigation",
    body: "Learn the controls for moving around a 3D scene. You can reopen this tutorial from Help at any time.",
    estimatedMinutes: 2,
    previewKind: "viewer",
  },
  steps: [
    {
      key: "device", title: "Select an input device",
      instruction: "Pick the input device you want to use for scene navigation. You can switch later by reopening this tutorial from Help.",
      choice: { options: [{ key: "mouse", label: "Mouse", icon: "mouse" }, { key: "trackpad", label: "Trackpad", icon: "trackpad" }], onChoose: (k) => setInputDevice(k === "trackpad" ? "trackpad" : "mouse") },
      complete: { kind: "choice" }, onEnter: toFly,
    },
    {
      key: "rotate", title: "Rotate the view",
      instruction: "Hold the **left mouse button** and drag over the scene to rotate the view.",
      instructionBy: { trackpad: "Use a **two-finger scroll** gesture to rotate the view around the camera target." },
      keycaps: [{ glyph: "mouse-left" }], keycapsBy: { trackpad: [{ glyph: "trackpad-scroll" }] },
      complete: { kind: "control", control: "rotate" }, onEnter: toFly,
    },
    {
      key: "zoom", title: "Zoom in and out",
      instruction: "Scroll the **mouse wheel** over the scene to zoom in and out.",
      instructionBy: { trackpad: "**Pinch** on the trackpad over the scene to zoom in and out." },
      keycaps: [{ glyph: "wheel" }], keycapsBy: { trackpad: [{ glyph: "trackpad-pinch" }] },
      complete: { kind: "control", control: "zoom" },
    },
    {
      key: "move", title: "Move with the keyboard",
      instruction: "Use W, A, S and D to move forwards, left, backwards and right. Try every key to continue.",
      keycaps: ["W", "A", "S", "D"],
      complete: { kind: "control", control: "move", needs: ["W", "A", "S", "D"] },
    },
    {
      key: "elevate", title: "Move up and down",
      instruction: "Use Q and E to change the camera's elevation. Try both keys to continue.",
      keycaps: ["Q", "E"],
      complete: { kind: "control", control: "elevate", needs: ["Q", "E"] },
    },
    {
      key: "pan", title: "Pan the scene",
      instruction: "Hold the **right mouse button** (or **Shift**) and drag over the scene to pan it.",
      instructionBy: { trackpad: "Hold **Shift** and use a **two-finger scroll** over the scene to pan it." },
      keycaps: [{ glyph: "mouse-right" }], keycapsBy: { trackpad: [{ glyph: "shift" }, "+", { glyph: "trackpad-scroll" }] },
      complete: { kind: "control", control: "pan" },
    },
    {
      key: "target", title: "Set the camera target",
      instruction: "Hold **⌘** (**Ctrl** on Windows) and hover a point or the ground. A target follows the cursor. **Click** to set that spot as the center for orbiting and zooming.",
      keycaps: [{ glyph: "cmd" }, "/", { glyph: "ctrl" }, "+", { glyph: "click" }],
      complete: { kind: "control", control: "target" },
    },
    {
      key: "frames", title: "Step through the frames",
      instruction: "Use the **left and right arrow keys** to move along the timeline (hover the scene first, with nothing selected).",
      keycaps: [{ glyph: "arrow-left" }, { glyph: "arrow-right" }],
      spotlight: { selector: "viewer-timeline", padding: 2 },
      complete: { kind: "control", control: "frame" },
      when: (ctx) => ctx.hasFrames === true,
    },
    {
      key: "center", title: "Center the camera",
      instruction: "Press **Reset camera** in the viewer toolbar to bring the whole scene back into view whenever you get lost.",
      spotlight: { selector: "viewer-reset", padding: 4 }, placement: "bottom-center",
      complete: { kind: "control", control: "reset" },
    },
  ],
};
