import type { TourDefinition } from "../types";

/** First visit to /learn, all roles. */
export const welcomeTour: TourDefinition = {
  key: "welcome",
  title: "Welcome to the portal",
  scope: "global",
  intro: {
    heading: "Welcome to LiDAR Training",
    body: "A quick tour of how the portal is laid out. You can reopen it from the Help menu at any time.",
    estimatedMinutes: 1,
    previewKind: "none",
  },
  steps: [
    {
      key: "stages", title: "Four stages",
      instruction: "Work moves through **Learn, Annotate, Review** and **Complete**. Annotate, Review and Complete show a lock until you have finished every mandatory module and passed the final assessment.",
      spotlight: { selector: "sidebar", padding: 6 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "progress", title: "Your learning progress",
      instruction: "This bar shows how much of the mandatory learning you have completed.",
      spotlight: { selector: "topbar-progress", padding: 6 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "bell", title: "Notifications",
      instruction: "Reviewer decisions and revision requests arrive here. Check the bell after you submit a task.",
      spotlight: { selector: "topbar-bell", padding: 6 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "modules", title: "Modules and lessons",
      instruction: "**Learn** lists your modules. Each one has short lessons, some with interactive practice, and ends with a **knowledge check**.",
      spotlight: { selector: "learn-modules", padding: 4 }, complete: { kind: "manual" },
    },
    {
      key: "assessment", title: "The final assessment",
      instruction: "Once every mandatory module is done, the **final assessment** opens. Passing it unlocks Annotate, Review and Complete.",
      spotlight: { selector: "learn-assessment", padding: 4 }, complete: { kind: "manual" },
    },
    {
      key: "help", title: "Help menu",
      instruction: "Press **?** at any time to reopen this tour or any other tutorial for the page you are on.",
      spotlight: { selector: "topbar-help", padding: 6 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "first-module", title: "Open your first module",
      instruction: "Click the **first module** to start learning.",
      spotlight: { selector: "learn-module-first", padding: 2 }, complete: { kind: "click-target" }, allowSkip: true,
    },
  ],
};
