import type { TourDefinition } from "../types";

/** First open of /review/[id] (REVIEWER / ADMIN). */
export const reviewFirstOpenTour: TourDefinition = {
  key: "review-first-open",
  title: "Reviewing a submission",
  scope: "page",
  roles: ["REVIEWER", "ADMIN"],
  intro: {
    heading: "Review a submission",
    body: "A short walkthrough of the review screen: history, advisory metrics, the reference overlay and how to decide.",
    estimatedMinutes: 2,
    previewKind: "none",
  },
  steps: [
    {
      key: "layout", title: "Queue to detail",
      instruction: "You opened this from the **review queue**. The left panel describes the submission, the center shows the trainee's boxes, and the right panel is your decision.",
      spotlight: { selector: "rv-left", padding: 0 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "history", title: "Attempt history",
      instruction: "Every attempt is kept. Earlier versions link to their own review, with the score and feedback they received.",
      spotlight: { selector: "rv-history", padding: 4 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "metrics", title: "Advisory metrics",
      instruction: "Class match, centre error, IoU and yaw error are computed against the hidden reference. They are **advisory**: you set the final score.",
      spotlight: { selector: "rv-metrics", padding: 4 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "reference", title: "Show the reference",
      instruction: "Tick **Show reference** to overlay the reference boxes (dashed white) on the trainee's work.",
      spotlight: { selector: "rv-toggle-ref", padding: 6 }, placement: "near-target", complete: { kind: "event", event: "toggle-reference" },
    },
    {
      key: "select", title: "Inspect an object",
      instruction: "**Click a box** in the scene or in the Objects list to see its matched reference, IoU and centre error.",
      spotlight: { selector: "rv-objects", padding: 4 }, placement: "near-target", complete: { kind: "event", event: "select-object" }, allowSkip: true,
    },
    {
      key: "decision", title: "Decide",
      instruction: "Use the **decision form**. **Approve** needs a score. **Request revision** needs error tags, feedback and correction instructions, and sends the work back to the trainee.",
      spotlight: { selector: "rv-decision", padding: 0 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "rules", title: "Approve or request revision",
      instruction: "Approve only when the work meets the task standard. Otherwise request a revision: the trainee edits a new version and resubmits. You never edit a submitted version.",
      spotlight: { selector: "rv-decision", padding: 0 }, placement: "near-target", complete: { kind: "manual" },
    },
    {
      key: "rubric", title: "Rubric",
      instruction: "The **rubric** lists the criteria and what each score level means. Rating the criteria feeds a suggested score you can override.",
      spotlight: { selector: "rv-rubric", padding: 4 }, placement: "near-target", complete: { kind: "manual" },
      when: (ctx) => ctx.hasRubric === true,
    },
  ],
};
