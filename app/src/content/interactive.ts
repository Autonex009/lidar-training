import type { CardsConfig, DecisionCard, DrillConfig, FindConfig, SpotConfig, SpotPrompt } from "./types";

/**
 * Authored data for the hands-on Learn widgets. Scene coordinates refer to the deterministic demo scenes in
 * src/lib/synthetic/scenes.ts; object targets resolve against each scene's reference cuboids at runtime.
 */

// ---- M1: demo-occlusion -> dense vs sparse, ground vs object ----
export const M1_FIND: FindConfig = {
  seed: 11,
  prompts: [
    {
      id: "find-ped",
      text: "Click the pedestrian closest to the sensor",
      target: { kind: "object", label: "Pedestrian", nearest: true },
      hint: "A pedestrian is a small upright cluster, about 1.7 m tall and 0.6 m wide. Look near the middle of the scene.",
      why: "Close objects return many points, so even a small person is easy to pick out.",
    },
    {
      id: "find-dense",
      text: "Click the densest vehicle (the one closest to the sensor)",
      target: { kind: "object", label: "Vehicle", nearest: true },
      hint: "Density falls with distance. The vehicle with the most points is the nearest one, a few metres from the middle of the scene.",
      why: "Nearby vehicles are hit by many pulses, so their shape is clear.",
    },
    {
      id: "find-sparse",
      text: "Click the far, sparse vehicle (about 37 m away, at x = 30, y = 22)",
      target: { kind: "region", center: [30, 22], radius: 4 },
      hint: "Zoom out and look to the far corner of the scene. Only a thin scatter of points is left of this car.",
      why: "Far objects are hit by very few pulses. A handful of points is still evidence, but you should not over-read it.",
    },
    {
      id: "find-ground",
      text: "Click the ground (flat, evenly spread points with no object on them)",
      target: { kind: "ground" },
      hint: "Click a low point away from every object. Ground is the flat sheet the objects stand on.",
      why: "Ground is background: you never box it.",
    },
  ],
};

// ---- M3: demo-identify -> pick the object, then name it ----
export const M3_FIND: FindConfig = {
  seed: 31,
  prompts: [
    {
      id: "id-pole",
      text: "Click the object that is about 5 m tall and very thin",
      target: { kind: "object", label: "Pole" },
      hint: "It stands far taller than everything else and is only about 30 cm wide.",
      why: "Tall and thin means a pole.",
      label: { options: ["Pole", "Vegetation", "Building", "Pedestrian"], correct: "Pole" },
    },
    {
      id: "id-person",
      text: "Click the small upright object about 1.7 m tall that stands alone",
      target: { kind: "object", label: "Pedestrian" },
      hint: "Narrow, roughly human height, away from the vehicles. Look to the upper left of the scene.",
      why: "A narrow upright cluster of human height is a pedestrian.",
      label: { options: ["Pedestrian", "Cyclist", "Pole", "Unknown"], correct: "Pedestrian" },
    },
    {
      id: "id-vehicle",
      text: "Click a long, low object about 4.5 m long and 1.5 m tall",
      target: { kind: "object", label: "Vehicle" },
      hint: "There are two of them. Look for the long rectangular footprint from above.",
      why: "Size and a long low shape are the evidence for a vehicle.",
      label: { options: ["Vehicle", "Building", "Cyclist", "Vegetation"], correct: "Vehicle" },
    },
    {
      id: "id-unknown",
      text: "Click the small box-shaped cluster about 1 m wide that you cannot name",
      target: { kind: "object", label: "Unknown" },
      hint: "It is low (under a metre) and sits near the middle of the scene.",
      why: "When the points do not support a class, the honest label is Unknown (or a flag). Do not guess.",
      label: { options: ["Unknown", "Vehicle", "Pole", "Pedestrian"], correct: "Unknown" },
    },
  ],
};

// ---- M2: demo-nav ----
export const M2_DRILL: DrillConfig = { countLabel: "Vehicle", tallestOptions: ["Vehicle", "Pedestrian", "Pole", "Building"] };

// ---- spot-the-error on demo-errors ----
const SPOT: Record<string, SpotPrompt> = {
  yaw: {
    id: "spot-yaw",
    text: "One of these boxes has a wrong yaw. Click it.",
    targets: ["cub-4"],
    hint: "Check the heading arrow of each box against the way the object is pointing. One box is turned about 70 degrees off.",
    why: "The cyclist's box is rotated away from its direction of travel. Length must follow the heading.",
  },
  big: {
    id: "spot-big",
    text: "One of these boxes is far too big for its object. Click it.",
    targets: ["cub-6"],
    hint: "Compare each box with the points inside it. One box has a large empty gap on every side.",
    why: "That box is about 1.6 times too large: it includes a lot of empty space.",
  },
  cls: {
    id: "spot-class",
    text: "One box carries the wrong class. Click it.",
    targets: ["cub-2"],
    hint: "Read the class tag above each box and compare it with the object's size and shape.",
    why: "A 4.5 m long object is a vehicle, not a pedestrian. Wrong class is a serious error even when the box is tight.",
  },
  dup: {
    id: "spot-dup",
    text: "One object has two boxes on it. Click either of them.",
    targets: ["cub-1", "cub-dup-1"],
    hint: "Look for two boxes almost on top of each other, slightly offset.",
    why: "One object gets exactly one box. Delete the extra one.",
  },
};
export const M4_SPOT: SpotConfig = { prompts: [SPOT.yaw, SPOT.big, SPOT.cls] };
export const M6_SPOT: SpotConfig = { seed: 61, prompts: [SPOT.cls, SPOT.dup, SPOT.yaw] };

// ---- decision cards ----
export const M5_CARDS: CardsConfig = {
  passPct: 80,
  cards: [
    {
      id: "occluded-ped",
      title: "Occluded pedestrian",
      scenario: "A pedestrian walks behind a parked van. About 40 points show the head and shoulders; the legs are hidden in the van's shadow. The project guideline says: box the full object and estimate hidden parts from typical size.",
      figure: "occlusion-shadow",
      choices: [
        { label: "Annotate full extent", why: "Right. The guideline asks for the full object, so extend the box to the ground using a typical pedestrian height and set the occlusion attribute." },
        { label: "Annotate visible only", why: "That would follow a different rule. This project wants the full extent, estimated from typical size." },
        { label: "Flag as uncertain", why: "There is plenty of evidence that this is a person, and the rule tells you what to do. A flag is not needed." },
        { label: "Skip it", why: "Hidden is not missing. The pedestrian exists, so skipping it leaves a missed object." },
      ],
      correct: 0,
    },
    {
      id: "edge-car",
      title: "Half-cut vehicle at the scene edge",
      scenario: "A car is cut in half by the edge of the scan. The visible half has about 200 clean points. The guideline says: for objects cut by the scan edge, box only as far as points exist.",
      choices: [
        { label: "Annotate full extent", why: "No points support the missing half, and the rule says not to invent it." },
        { label: "Annotate visible only", why: "Right. Box what the points support, up to the edge of the scan." },
        { label: "Flag as uncertain", why: "The class and extent are clear and the rule covers this case. A flag is not needed." },
        { label: "Skip it", why: "200 clean points is plenty of evidence. Skipping would miss a real object." },
      ],
      correct: 1,
    },
    {
      id: "five-points",
      title: "A 5-point blob",
      scenario: "A tiny cluster of 5 points sits 45 m from the sensor. It could be a pedestrian or a post, and there is no other frame or context image to check.",
      figure: "density-falloff",
      choices: [
        { label: "Annotate it as a pedestrian", why: "That is a guess. Five points cannot tell a person from a post." },
        { label: "Annotate it as a pole", why: "Also a guess. Do not pick the likeliest answer." },
        { label: "Flag as uncertain", why: "Right. State what you saw and that the evidence is too thin. A flag is a correct outcome." },
        { label: "Skip it silently", why: "Silence loses information. A short flag lets the reviewer use context you do not have." },
      ],
      correct: 2,
    },
    {
      id: "touching-cars",
      title: "Two cars touching",
      scenario: "Two cars are parked bumper to bumper. In top view their points form one long blob, but side view shows a dip between them where they meet.",
      figure: "overlap",
      choices: [
        { label: "One long box around both", why: "One object, one box. Two objects must not share a box." },
        { label: "Two boxes that share an edge", why: "Right. Use the dip in the side view as the dividing line. Touching edges are fine." },
        { label: "Two boxes overlapping by about a metre", why: "A large overlap is an error. Boxes may touch but should not overlap heavily." },
        { label: "Skip the one that is harder to see", why: "Both objects exist. Annotate both." },
      ],
      correct: 1,
    },
    {
      id: "one-frame",
      title: "An object in only one frame",
      scenario: "In an 8-frame sequence a cyclist shows up in frame 5 with 150 points, and is gone in frames 4 and 6. No other frame has it.",
      choices: [
        { label: "Skip it: it does not persist", why: "It exists in frame 5 with plenty of points. Every frame is annotated on its own evidence." },
        { label: "Copy the box into every frame", why: "It is not there in the other frames. Do not annotate objects the points do not show." },
        { label: "Annotate it in frame 5 only", why: "Right. Annotate it where the evidence is, and nowhere else." },
        { label: "Flag as uncertain and leave it out", why: "The evidence is clear in frame 5, so a flag in place of the box would lose a real object." },
      ],
      correct: 2,
    },
    {
      id: "mirror-ghost",
      title: "Mirror ghost points",
      scenario: "Behind a glass wall you see a faint copy of a pallet, 3 m beyond the wall. The real pallet is in front of the glass. The ghost has the same shape but far fewer points.",
      choices: [
        { label: "Annotate it as a second pallet", why: "It is a reflection artifact, not an object. A box would create a false object." },
        { label: "Skip it: it is a reflection", why: "Right. Ghost points mirrored behind glass are noise. Box only the real pallet." },
        { label: "Annotate it visible only", why: "There is nothing real to box: the points are a mirror image." },
        { label: "Merge it into the real pallet's box", why: "That would stretch the real pallet's box 3 m too far." },
      ],
      correct: 1,
    },
  ] satisfies DecisionCard[],
};

export const M6_CARDS: CardsConfig = {
  passPct: 80,
  cards: [
    {
      id: "after-last-box",
      title: "You have just drawn the last box",
      scenario: "Every object on the class list has a box. The scene looks complete from the angle you are looking at.",
      choices: [
        { label: "Submit now", why: "Fast and wrong is slower than careful and right. Run the check first." },
        { label: "Run the self-check list on every box", why: "Right. Same list, every box, every time." },
        { label: "Check only the boxes you feel unsure about", why: "Errors hide in the boxes you feel sure about too." },
        { label: "Wait for the reviewer to find mistakes", why: "A reviewer round trip takes a day. Ten seconds of checking takes less." },
      ],
      correct: 1,
    },
    {
      id: "yaw-off",
      title: "A box is rotated 90 degrees",
      scenario: "During your check, top view shows one vehicle box whose length runs across the car instead of along it.",
      choices: [
        { label: "Fix its yaw, then recheck the other boxes for the same slip", why: "Right. Fix the pattern, not only the one box." },
        { label: "Leave it: it still covers the points", why: "Covering the points is not enough. Wrong yaw is a heading error." },
        { label: "Delete all boxes and start again", why: "Far too much. Correct the one box and check the rest." },
        { label: "Flag it and submit", why: "You can fix this yourself in seconds. A flag is for missing evidence, not for your own mistakes." },
      ],
      correct: 0,
    },
    {
      id: "double-box",
      title: "Two boxes on one object",
      scenario: "Checking the cluster by the wall, you find two overlapping boxes on the same forklift: one on the cab, one on the forks.",
      figure: "overlap",
      choices: [
        { label: "Keep both: together they cover the whole forklift", why: "One object gets one box." },
        { label: "Replace them with one box that covers the whole forklift", why: "Right. One object, one box, sized to the whole object." },
        { label: "Delete the smaller one only", why: "The remaining box would still miss part of the forklift." },
        { label: "Flag the forklift as uncertain", why: "The object is clear. The mistake is yours to fix." },
      ],
      correct: 1,
    },
    {
      id: "empty-attribute",
      title: "Required attributes left empty",
      scenario: "Three boxes have an empty required attribute (Moving or Parked). For two of them the evidence is clear from earlier frames. For the third you cannot tell.",
      choices: [
        { label: "Fill in the two you can support and flag the third with a note", why: "Right. Use evidence where you have it, and flag where you do not. Never guess." },
        { label: "Guess a value for the third so the task can be submitted", why: "A guessed attribute is wrong data that looks right." },
        { label: "Leave all three empty", why: "Required attributes must be filled. A box without them is incomplete." },
        { label: "Set all three to Parked, the likeliest value", why: "Likeliest is not evidence." },
      ],
      correct: 0,
    },
    {
      id: "silent-guideline",
      title: "The guideline is silent",
      scenario: "A half-visible vehicle at the edge of the scan is not covered by the project guideline. Time is short.",
      choices: [
        { label: "Use the rule from your last project", why: "Never apply one project's rule to another." },
        { label: "Box what the points support and flag it with a short, specific note", why: "Right. Say what you saw, what you did, and what you are unsure about." },
        { label: "Skip the vehicle", why: "It is a real object with real evidence." },
        { label: "Flag it with no note", why: "A flag with no explanation gives the reviewer nothing to work with." },
      ],
      correct: 1,
    },
  ] satisfies DecisionCard[],
};
