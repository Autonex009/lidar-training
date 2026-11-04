export const FIGURE_IDS = [
  "lidar-tof",
  "xyz-axes",
  "density-falloff",
  "image-vs-cloud",
  "views-top-front-side",
  "fg-bg",
  "cuboid-params",
  "yaw",
  "box-too-big",
  "box-cuts-points",
  "occlusion-shadow",
  "overlap",
] as const;

export type FigureId = (typeof FIGURE_IDS)[number];

/** Drawing briefs for the UI agent (inline SVG, simple flat style, labelled). */
export const FIGURE_DESCRIPTIONS: Record<FigureId, string> = {
  "lidar-tof":
    "Side view: sensor on the left emits a pulse arrow to a box-shaped object and a return arrow back. Label 'distance = time x speed of light / 2'. A dot appears where the pulse hits.",
  "xyz-axes":
    "3D axes: X (forward, red), Y (left, green), Z (up, blue) with a small sensor icon at the origin and a car-sized box on the X axis.",
  "density-falloff":
    "Top-down view of the sensor with concentric rings. Near ring: a car drawn with many dots. Far ring: same car with only 3-4 dots. Caption labels 'near = dense', 'far = sparse'.",
  "image-vs-cloud":
    "Two panels side by side: a 2D photo-style scene of a person and a pallet, and the same scene as dots only. Dots show shape and distance but no colour or texture.",
  "views-top-front-side":
    "Three small panels of one box-shaped object with dots: Top (shows length and width and yaw), Front (shows width and height), Side (shows length and height). Each panel labelled.",
  "fg-bg":
    "Point cloud scene with ground dots in grey, a wall in light grey, and a person, a pallet and a cart highlighted in colour. Legend: 'foreground = annotate', 'background = ignore'.",
  "cuboid-params":
    "A cuboid with centre dot (x, y, z), arrows labelled length, width, height, and a heading arrow. Caption: 'centre + size + yaw'.",
  "yaw":
    "Top-down box with a forward arrow. Three variants: yaw 0 (arrow along X), yaw 30 degrees counter-clockwise, and a wrong box rotated 90 degrees from the direction of travel marked with a cross.",
  "box-too-big":
    "Side view of an object's dots inside a box that has a large empty gap on top and one side. Gap marked in red with the label 'empty space'.",
  "box-cuts-points":
    "Side view of an object where a few dots stick out of the box edge. Those dots are circled red with the label 'points outside the box'.",
  "occlusion-shadow":
    "Top-down: sensor, a near box blocking rays, and a far object behind it with a dotted shadow region. Only the front face of the far object has dots; the hidden part is dashed.",
  "overlap":
    "Top-down: two touching pallets. Correct: two boxes with a thin gap or shared edge. Wrong: two boxes overlapping by a large area, overlap region shaded red.",
};
