import type { TourDefinition, TourStep } from "../types";

/** Shared first step: open the Instructions drawer (spotlight the button, complete when it opens). */
const instructionsStep: TourStep = {
  key: "instructions", title: "Read the instructions",
  instruction: "Open **Instructions** for the objective, the required output and hints for this task.",
  spotlight: { selector: "ws-instructions", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "instructions-opened" },
};
const saveStep: TourStep = {
  key: "save", title: "Save your draft",
  instruction: "Click **Save draft**. Your work also autosaves a few seconds after every change.",
  spotlight: { selector: "ws-save", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "draft-saved" },
};
const intro = (heading: string, body: string, minutes: number): TourDefinition["intro"] => ({ heading, body, estimatedMinutes: minutes, previewKind: "none" });

export const taskCuboidTour: TourDefinition = {
  key: "task-cuboid", title: "Cuboid task walkthrough", scope: "page",
  intro: intro("Draw your first cuboid", "A hands-on walkthrough of the cuboid tools. Each step completes when you do the action.", 3),
  steps: [
    instructionsStep,
    {
      key: "create", title: "Create a box",
      instruction: "Choose the **Create** tool, then **drag on the ground** around an object to draw a box.",
      spotlight: { selector: "ws-tool-create", padding: 4 }, placement: "near-target", keycaps: ["C"], complete: { kind: "event", event: "addCuboid" },
    },
    {
      key: "select", title: "Select it",
      instruction: "Press **V** for the Select tool, then **click the box** in the scene or in the Objects list.",
      spotlight: { selector: "ws-objects", padding: 4 }, placement: "near-target", keycaps: ["V", "+", { glyph: "click" }], complete: { kind: "event", event: "select" },
    },
    {
      key: "move", title: "Move it",
      instruction: "Choose **Move** (M) and drag the box, or nudge it with the **arrow keys**.",
      spotlight: { selector: "ws-tool-move", padding: 4 }, placement: "near-target", keycaps: ["M", { glyph: "arrow-left" }, { glyph: "arrow-right" }, { glyph: "arrow-up" }, { glyph: "arrow-down" }],
      complete: { kind: "event", event: "moveCuboid" },
    },
    {
      key: "resize", title: "Resize it",
      instruction: "Drag a **handle** on the selected box, or hold **Shift** and press the arrow keys to change its length and width.",
      keycaps: [{ glyph: "shift" }, "+", { glyph: "arrow-left" }, { glyph: "arrow-right" }], complete: { kind: "event", event: "resizeCuboid" },
    },
    {
      key: "rotate", title: "Rotate the heading",
      instruction: "Press **Q** or **E** to rotate the box (yaw), or choose the **Rotate** tool and drag. The arrow on the box points to its front.",
      spotlight: { selector: "ws-tool-rotate", padding: 4 }, placement: "near-target", keycaps: ["Q", "E"], complete: { kind: "event", event: "rotateCuboid" },
    },
    {
      key: "fit", title: "Fit to points",
      instruction: "Press **Fit to points** (or **G**) to snap the box tight around the points inside it.",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", keycaps: ["G"], complete: { kind: "event", event: "fitCuboid" },
    },
    {
      key: "label", title: "Set the label",
      instruction: "Pick the class from the **Label** dropdown, or press **1 to 9**.",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", keycaps: ["1", "-", "9"], complete: { kind: "event", event: "setLabel" },
    },
    {
      key: "attributes", title: "Set the attributes",
      instruction: "Fill the **attribute** dropdowns. Those marked * are required before you can submit.",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "setAttribute" },
      when: (ctx) => ctx.hasRequiredAttributes === true,
    },
    {
      key: "undo", title: "Undo and redo",
      instruction: "Press **Ctrl+Z** (**⌘Z** on Mac) to undo your last change. **Ctrl+Shift+Z** brings it back.",
      spotlight: { selector: "ws-undo", padding: 4 }, placement: "near-target", keycaps: [{ glyph: "ctrl" }, "+", "Z"], complete: { kind: "event", event: "undo" },
    },
    {
      key: "flag", title: "Flag a doubt",
      instruction: "Unsure about an object? Select it and press **Flag uncertain**, then say why. This step is optional.",
      spotlight: { selector: "flags-section", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "addFlag" }, allowSkip: true,
    },
    saveStep,
    {
      key: "submit", title: "Submit for review",
      instruction: "**Submit** checks that every box has a label, required attributes are filled and every flag has a reason, then sends the work to a reviewer. We will not submit now. A submitted version is read-only.",
      spotlight: { selector: "ws-submit", padding: 4 }, placement: "near-target", complete: { kind: "manual" },
    },
  ],
};

export const taskSegmentationTour: TourDefinition = {
  key: "task-segmentation", title: "Segmentation task walkthrough", scope: "page",
  intro: intro("Label points with the brush", "Learn the brush, lasso and label palette for point-level segmentation.", 3),
  steps: [
    instructionsStep,
    {
      key: "brush", title: "Pick the Brush",
      instruction: "Choose the **Brush** tool (B). It paints every point under the cursor.",
      spotlight: { selector: "ws-tool-brush", padding: 4 }, placement: "near-target", keycaps: ["B"], complete: { kind: "event", event: "tool:brush" },
    },
    {
      key: "radius", title: "Set the brush radius",
      instruction: "Drag the **radius** slider. Use a large brush for big surfaces and a small one near edges.",
      spotlight: { selector: "ws-brush", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "brush-radius" },
    },
    {
      key: "palette", title: "Choose a label",
      instruction: "Click a class in the **label palette** (or press **1 to 9**). Everything you paint gets that class.",
      spotlight: { selector: "ws-palette", padding: 4 }, placement: "near-target", keycaps: ["1", "-", "9"], complete: { kind: "event", event: "activeLabel" },
    },
    {
      key: "paint", title: "Paint some points",
      instruction: "**Drag across the scene** to label points. Orbit with the right mouse button if you need another angle.",
      spotlight: { selector: "viewer-canvas", padding: 0 }, placement: "bottom-center", keycaps: [{ glyph: "mouse-left" }], complete: { kind: "event", event: "paintPoints" },
    },
    {
      key: "lasso", title: "Try the Lasso",
      instruction: "Choose the **Lasso** (L) and draw around a region. It selects everything under the outline, regardless of depth, so rotate to a side view first.",
      spotlight: { selector: "ws-tool-lasso", padding: 4 }, placement: "near-target", keycaps: ["L"], complete: { kind: "event", event: "tool:lasso" },
    },
    {
      key: "hide", title: "Hide a label",
      instruction: "Untick a class to **hide** its points and reveal what is still unlabelled.",
      spotlight: { selector: "ws-hide", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "hide-label" },
    },
    {
      key: "undo", title: "Undo a stroke",
      instruction: "Press **Ctrl+Z** (**⌘Z** on Mac) to undo the last stroke.",
      spotlight: { selector: "ws-undo", padding: 4 }, placement: "near-target", keycaps: [{ glyph: "ctrl" }, "+", "Z"], complete: { kind: "event", event: "undo" },
    },
    saveStep,
  ],
};

export const taskTrackingTour: TourDefinition = {
  key: "task-tracking", title: "Tracking task walkthrough", scope: "page",
  intro: intro("Track objects across frames", "Learn the timeline, copying boxes between frames and consistent track IDs.", 3),
  steps: [
    instructionsStep,
    {
      key: "create", title: "Create a box",
      instruction: "Choose **Create** and **drag on the ground** around an object in this frame. It gets a track ID automatically.",
      spotlight: { selector: "ws-tool-create", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "addCuboid" },
    },
    {
      key: "timeline", title: "Move along the timeline",
      instruction: "Use the **frame timeline** (or **,** and **.**) to go to the next frame.",
      spotlight: { selector: "viewer-timeline", padding: 2 }, placement: "bottom-center", keycaps: [",", "."], complete: { kind: "event", event: "frame-changed" },
    },
    {
      key: "copy", title: "Copy from the previous frame",
      instruction: "Press **Copy boxes from previous frame**, then adjust each box to the object's new position. Track IDs carry over.",
      spotlight: { selector: "ws-copy-prev", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "copyFrame" },
    },
    {
      key: "trackid", title: "Edit the track ID",
      instruction: "Select a box and change its **Track ID**. The same object must keep the same ID in every frame, and no two boxes in a frame may share one.",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "setTrackId" }, allowSkip: true,
    },
    {
      key: "step", title: "Step through frames",
      instruction: "Step forwards and back a few frames to check the boxes follow the objects.",
      spotlight: { selector: "ws-tracking", padding: 4 }, placement: "near-target", keycaps: [",", "."], complete: { kind: "event", event: "frame-changed", count: 2 },
    },
    saveStep,
  ],
};

export const taskInspectionTour: TourDefinition = {
  key: "task-inspection", title: "Inspection task walkthrough", scope: "page",
  intro: intro("Inspect the scene", "Learn how checkpoints, views and written answers work in an inspection task.", 2),
  steps: [
    instructionsStep,
    {
      key: "checkpoints", title: "Checkpoints",
      instruction: "The **Checkpoints** list shows what you must do. Each one ticks by itself when you do it in the viewer.",
      spotlight: { selector: "ws-checkpoints", padding: 4 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "presets", title: "Use the view presets",
      instruction: "Switch between the **Top, Front and Side** views from the viewer toolbar. Each reveals different things.",
      spotlight: { selector: "viewer-toolbar", padding: 2 }, placement: "bottom-center", complete: { kind: "control", control: "preset", count: 2 },
    },
    {
      key: "mark", title: "Mark a region",
      instruction: "Choose **Mark region**, then click the area the task asks you to locate.",
      spotlight: { selector: "ws-tool-mark", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "tool:mark" },
    },
    {
      key: "answers", title: "Answer the questions",
      instruction: "Write short, specific **answers** based on what you can see in the cloud.",
      spotlight: { selector: "ws-questions", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "setAnswer" },
      when: (ctx) => ctx.hasQuestions === true,
    },
    saveStep,
  ],
};

export const taskIdentificationTour: TourDefinition = {
  key: "task-identification", title: "Identification task walkthrough", scope: "page",
  intro: intro("Identify unlabeled objects", "Learn how to name outlined objects, flag uncertainty and justify your choice.", 2),
  steps: [
    instructionsStep,
    {
      key: "outlines", title: "Unlabeled outlines",
      instruction: "Each **outlined object** has no label yet. Your job is to say what it is, from evidence in the points.",
      spotlight: { selector: "viewer-canvas", padding: 0 }, placement: "bottom-center", complete: { kind: "manual" },
    },
    {
      key: "select", title: "Select an object",
      instruction: "**Click an outline** in the scene or an entry in the Objects list.",
      spotlight: { selector: "ws-objects", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "select" },
    },
    {
      key: "label", title: "Assign a label",
      instruction: "Choose the class from the **Label** dropdown (or press **1 to 9**).",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "setLabel" },
    },
    {
      key: "flag", title: "Flag if uncertain",
      instruction: "If the evidence is not enough, press **Flag uncertain** and say what is missing. Optional here.",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "addFlag" }, allowSkip: true,
    },
    {
      key: "justify", title: "Justify your answers",
      instruction: "Explain **why** you chose each label, naming the evidence: shape, size, height, position.",
      spotlight: { selector: "ws-questions", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "setAnswer" }, allowSkip: true,
      when: (ctx) => ctx.hasQuestions === true,
    },
    saveStep,
  ],
};

export const taskErrorDetectionTour: TourDefinition = {
  key: "task-error-detection", title: "Error detection walkthrough", scope: "page",
  intro: intro("Find the planted errors", "Learn how to review existing annotations and report what is wrong with them.", 2),
  steps: [
    instructionsStep,
    {
      key: "concept", title: "Planted errors",
      instruction: "This scene already has boxes, and some contain **planted mistakes**: wrong class, bad size, wrong heading or missing objects. You report them; you do not fix them.",
      spotlight: { selector: "viewer-canvas", padding: 0 }, placement: "bottom-center", complete: { kind: "manual" },
    },
    {
      key: "select", title: "Select a box",
      instruction: "**Click a box** you think is wrong.",
      spotlight: { selector: "ws-objects", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "select" },
    },
    {
      key: "report", title: "Report the error",
      instruction: "Press **Report error**, choose the error type, **explain what is wrong** and why, then press **Add**.",
      spotlight: { selector: "ws-attributes", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "addError" },
    },
    {
      key: "missing", title: "Report a missing object",
      instruction: "Choose the **Missing object** tool (F), click where a box should be, and explain what is missing. Optional here.",
      spotlight: { selector: "ws-tool-flag", padding: 4 }, placement: "near-target", keycaps: ["F"], complete: { kind: "event", event: "addError" }, allowSkip: true,
    },
    saveStep,
  ],
};
