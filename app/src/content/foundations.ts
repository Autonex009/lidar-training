import type { ModuleContent, ProgramContent, QuizQuestionContent } from "./types";

// ---------------------------------------------------------------------------
// M1 - LiDAR and point clouds
// ---------------------------------------------------------------------------
const m1: ModuleContent = {
  key: "m1-lidar",
  title: "Understanding LiDAR and 3D Point Clouds",
  summary: "What a point cloud is, why it gets sparse with distance, and what you can and cannot trust in it.",
  estimatedMinutes: 10,
  isMandatory: true,
  lessons: [
    {
      kind: "TEXT",
      title: "How LiDAR sees the world",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Points, not pictures",
          body: [
            "A LiDAR sensor fires laser pulses and times how long each one takes to bounce back.",
            "Each return becomes one point with an X, Y and Z position.",
            "A point cloud is just millions of these points. There are no colours and no textures.",
          ],
        },
        { type: "figure", kind: "svg", id: "lidar-tof", caption: "Distance comes from the time a pulse takes to return." },
        { type: "figure", kind: "svg", id: "xyz-axes", caption: "X is forward, Y is left, Z is up." },
        {
          type: "explain",
          heading: "Density drops with distance",
          body: [
            "Close objects are hit by many pulses. Far objects are hit by very few.",
            "A car 40 m away may be only a handful of points.",
          ],
        },
        { type: "figure", kind: "svg", id: "density-falloff", caption: "The same object: dense when near, sparse when far." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "You see a tight cluster of 300 points shaped like a person, 6 m from the sensor.",
            "A similar cluster of 8 points at 45 m is much harder to judge. Do not assume what it is.",
          ],
        },
        {
          type: "remember",
          items: [
            "Points only exist where a laser hit a surface.",
            "Fewer points means less certainty, not an empty scene.",
            "Distance changes how much evidence you have.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Treating a gap in the points as proof that nothing is there.",
            "Expecting far objects to look as detailed as near ones.",
            "Guessing an object class from a few stray points.",
          ],
        },
      ],
    },
    {
      kind: "INTERACTIVE_CLOUD",
      title: "Reading a point cloud",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Foreground and background",
          body: [
            "Ground and walls are background. People, pallets and vehicles are foreground.",
            "You annotate foreground objects the project asks for. You ignore the rest.",
          ],
        },
        { type: "figure", kind: "svg", id: "fg-bg", caption: "Annotate foreground objects. Ignore ground and walls." },
        { type: "figure", kind: "svg", id: "image-vs-cloud", caption: "A cloud shows shape and distance, not colour or texture." },
        {
          type: "interactive",
          widget: "cloud",
          sceneKey: "demo-nav",
          checkpoints: [
            { key: "rotate", label: "Rotate the cloud to look at it from another side" },
            { key: "zoom", label: "Zoom in on a cluster of points" },
          ],
          instructions:
            "Rotate and zoom the sample cloud. Find the ground, then find one object that stands out from it.",
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "From above, a flat patch of points looks like a pallet. From the side, it is only 15 cm tall.",
            "That is a thin sheet or a floor mark, not a pallet. Always check a second view.",
          ],
        },
        {
          type: "remember",
          items: [
            "Look from at least two angles before you decide.",
            "Shape and height together tell you what an object is.",
            "Annotate only what the points support.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Deciding from a single viewpoint.",
            "Labelling ground bumps as objects.",
            "Ignoring height and judging by outline alone.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "What does each point in a LiDAR cloud represent?",
        options: [
          "A pixel with a colour value",
          "A place where a laser pulse hit a surface",
          "A label placed by an annotator",
          "A camera frame",
        ],
        correctAnswer: 1,
        explanation:
          "A point is one laser return from a surface. Pixels and colours belong to cameras. Labels and frames are separate things.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "An empty area in the cloud always means there is no object there.",
        correctAnswer: false,
        explanation:
          "Gaps can come from distance, dark or shiny surfaces, or an object hidden behind another. Absence of points is not proof of absence.",
      },
      {
        kind: "INTERPRETATION",
        prompt: "The same car appears with 400 points at 5 m and about 6 points at 50 m. What explains this?",
        options: [
          "The car changed shape",
          "Point density falls as distance grows",
          "The sensor is broken at long range",
          "The far car is a different class",
        ],
        correctAnswer: 1,
        explanation:
          "Fewer pulses hit distant objects. The car is the same. Nothing is broken, it is normal LiDAR behaviour.",
        media: { kind: "svg", id: "density-falloff" },
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "You see a cluster of only 5 points at 60 m and cannot tell what it is. What do you do?",
        options: [
          "Pick the most common class",
          "Draw a box and guess the class",
          "Skip it or flag it, as the project rules allow, instead of guessing",
          "Delete nearby points",
        ],
        correctAnswer: 2,
        explanation:
          "Five points are not enough evidence. Guessing adds noise to the data. Other options either guess or damage the cloud.",
      },
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "Which axis points up?",
        options: ["X", "Y", "Z", "It depends on the object"],
        correctAnswer: 2,
        explanation: "Z is up in this portal. X is forward and Y is left.",
        media: { kind: "svg", id: "xyz-axes" },
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which statement about point clouds is wrong?",
        options: [
          "Colour and texture are not part of a plain point cloud.",
          "Distant objects have fewer points.",
          "A second viewing angle can change your judgement.",
          "A flat patch of points is always a pallet.",
        ],
        correctAnswer: 3,
        explanation:
          "A flat patch could be a floor mark or a sheet. Check height from another view. The other three statements are true.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// M2 - Navigation
// ---------------------------------------------------------------------------
const m2: ModuleContent = {
  key: "m2-navigation",
  title: "Navigating a 3D Scene",
  summary: "Rotate, pan, zoom, reset, and use top, front and side views to check every judgement.",
  estimatedMinutes: 9,
  isMandatory: true,
  lessons: [
    {
      kind: "INTERACTIVE_NAV",
      title: "Move around the scene",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Four moves you will use all day",
          body: [
            "Rotate to look around an object. Pan to slide the view sideways.",
            "Zoom to get close. Reset to return to a known view when you are lost.",
          ],
        },
        {
          type: "interactive",
          widget: "nav",
          sceneKey: "demo-nav",
          checkpoints: [
            { key: "rotate", label: "Rotate the view" },
            { key: "pan", label: "Pan the view" },
            { key: "zoom", label: "Zoom in and out" },
            { key: "reset", label: "Reset the view" },
          ],
          instructions: "Try each control at least once. Each checkpoint ticks when you use it.",
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A box looks perfect from your first angle. You rotate 90 degrees and see points sticking out the back.",
            "Without rotating you would have submitted a bad box.",
          ],
        },
        {
          type: "remember",
          items: [
            "Rotate before you trust any box.",
            "Reset when you lose orientation. It costs one click.",
            "Zoom in to check edges, zoom out to check context.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Working only from the default angle.",
            "Zooming so far in that you lose the object's shape.",
            "Staying lost instead of resetting the view.",
          ],
        },
      ],
    },
    {
      kind: "INTERACTIVE_NAV",
      title: "Top, front and side views",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Each view answers one question",
          body: [
            "Top view shows length, width and direction. Front and side views show height.",
            "Use all three to check a box.",
          ],
        },
        { type: "figure", kind: "svg", id: "views-top-front-side", caption: "Top shows length, width and heading. Front and side show height." },
        {
          type: "interactive",
          widget: "nav",
          sceneKey: "demo-nav",
          checkpoints: [
            { key: "top", label: "Switch to top view" },
            { key: "front", label: "Switch to front view" },
            { key: "side", label: "Switch to side view" },
          ],
          instructions: "Switch to each standard view. Notice what becomes easy to see in each one.",
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "In top view, a pallet box is neatly aligned. In side view, the box is 40 cm taller than the points.",
            "The top view could never show that.",
          ],
        },
        {
          type: "remember",
          items: [
            "Top view for position and heading. Side views for height.",
            "A box is only checked when it looks right in all three.",
            "Return to a standard view after free rotation.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Checking height only in top view.",
            "Judging yaw from a tilted angle.",
            "Skipping the side view because it looks fine from above.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "Which view is best for checking an object's height?",
        options: ["Top view", "Front or side view", "Any view equally", "Reset view only"],
        correctAnswer: 1,
        explanation:
          "Height is the Z direction, which top view flattens away. Front and side views show it. Reset is not a view type.",
        media: { kind: "svg", id: "views-top-front-side" },
      },
      {
        kind: "TRUE_FALSE",
        prompt: "If a box looks correct from one angle, it is correct.",
        correctAnswer: false,
        explanation: "A box can hide errors from one angle. Rotate and check other views.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "You rotated the scene and lost track of which way is forward. What is the quickest fix?",
        options: [
          "Delete the box and start over",
          "Reset the view",
          "Zoom out as far as possible",
          "Keep rotating until it looks familiar",
        ],
        correctAnswer: 1,
        explanation: "Reset returns you to a known view in one click. Other choices waste time or lose work.",
      },
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "Which view best shows an object's heading (yaw)?",
        options: ["Top view", "Front view", "Side view", "None of them"],
        correctAnswer: 0,
        explanation: "Yaw is rotation about the vertical axis, so you see it looking down from above.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which navigation habit is wrong?",
        options: [
          "Rotating to check the back of a box",
          "Zooming in to check an edge",
          "Using top view to confirm height",
          "Resetting when disoriented",
        ],
        correctAnswer: 2,
        explanation: "Top view hides height. Use front or side views for that. The other habits are good practice.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// M3 - Objects and labels
// ---------------------------------------------------------------------------
const m3: ModuleContent = {
  key: "m3-objects-labels",
  title: "Understanding Objects and Labels",
  summary: "What gets annotated, how classes and attributes work, and why evidence beats guessing.",
  estimatedMinutes: 9,
  isMandatory: true,
  lessons: [
    {
      kind: "TEXT",
      title: "Objects, classes and attributes",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "What gets a label",
          body: [
            "Each project gives a list of classes. You label only objects on that list.",
            "Everything else is background, even if it is a real object.",
          ],
        },
        {
          type: "explain",
          heading: "Class and attributes",
          body: [
            "The class says what the object is. Attributes add facts, like moving or parked.",
            "Required attributes must always be filled in. A box without them is incomplete.",
          ],
        },
        { type: "figure", kind: "svg", id: "fg-bg", caption: "Only listed foreground objects get labels." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "The project lists Person, Pallet and Cart. You see a fire extinguisher on a wall.",
            "It is not on the list, so you do not label it.",
          ],
        },
        {
          type: "remember",
          items: [
            "The project class list is the only source of truth.",
            "Choose the class the points support, not the one you expect.",
            "Fill in every required attribute.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Labelling real objects that are not on the class list.",
            "Using a similar class because the right one seems missing.",
            "Leaving required attributes empty.",
          ],
        },
      ],
    },
    {
      kind: "INTERACTIVE_SCHEMA",
      title: "Try an example schema",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "A schema is the rulebook",
          body: [
            "A schema lists classes, their attributes, and which attributes are required.",
            "This one is an example only. Real projects bring their own.",
          ],
        },
        {
          type: "interactive",
          widget: "schema",
          sceneKey: "example-schema",
          checkpoints: [
            { key: "add-class", label: "Add a new class to the example schema" },
            { key: "add-attribute", label: "Add an attribute to a class" },
            { key: "set-required", label: "Mark an attribute as required" },
          ],
          instructions:
            "Edit the example schema. Add a class, add an attribute, then mark one as required.",
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A schema says every Vehicle needs a Moving or Parked attribute.",
            "If you skip it, the task cannot be submitted. This is by design.",
          ],
        },
        {
          type: "remember",
          items: [
            "Read the schema before you start labelling.",
            "Class names matter. Pick the exact one.",
            "When the evidence is unclear, flag it. Do not guess.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Starting without reading the class list.",
            "Picking a class by habit from another project.",
            "Guessing an attribute value without evidence.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "CHOOSE_DECISION",
        prompt: "You see a real object that is not in the project class list. What do you do?",
        options: [
          "Label it with the closest class",
          "Do not label it",
          "Label it Other",
          "Label it and ask later",
        ],
        correctAnswer: 1,
        explanation:
          "Only listed classes are annotated. A near-match class pollutes the data. Do not invent an Other class that is not in the schema.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "A cuboid with a missing required attribute is still complete.",
        correctAnswer: false,
        explanation: "Required attributes are part of the label. Without them the label is incomplete.",
      },
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "What is an attribute?",
        options: [
          "A fact about an object, such as moving or parked",
          "The box colour in the viewer",
          "The class name",
          "The frame number",
        ],
        correctAnswer: 0,
        explanation:
          "Attributes add facts to a label. The class says what the object is. The other options are not attributes.",
      },
      {
        kind: "IDENTIFY_OBJECT",
        prompt:
          "The project lists Person, Pallet and Cart. A cluster is 1.7 m tall, narrow, and stands upright on the ground. Which class fits best?",
        options: ["Pallet", "Cart", "Person", "None, it is background"],
        correctAnswer: 2,
        explanation:
          "Height and narrow upright shape match a person. A pallet is flat and low. A cart is wide and low. It is clearly foreground.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "An object could be a Cart or a Pallet, and the points are too few to tell. What is correct?",
        options: [
          "Pick Cart because it is more common",
          "Pick Pallet because it is simpler",
          "Flag it for review instead of guessing",
          "Pick randomly",
        ],
        correctAnswer: 2,
        explanation:
          "A wrong class is worse than a flagged one. Frequency and randomness are not evidence.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// M4 - 3D bounding boxes
// ---------------------------------------------------------------------------
const m4: ModuleContent = {
  key: "m4-cuboids",
  title: "Understanding 3D Bounding Boxes",
  summary: "Centre, size and yaw. How to draw a box that is tight, complete and correctly oriented.",
  estimatedMinutes: 15,
  isMandatory: true,
  lessons: [
    {
      kind: "TEXT",
      title: "Anatomy of a cuboid",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Three things define a box",
          body: [
            "A cuboid has a centre, a size (length, width, height) and a yaw.",
            "Yaw is the rotation around the vertical axis. It sets which way the box faces.",
          ],
        },
        { type: "figure", kind: "svg", id: "cuboid-params", caption: "Centre + size + yaw." },
        { type: "figure", kind: "svg", id: "yaw", caption: "Align the length with the direction the object faces or travels." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A forklift drives along X. Its box should be long along X and narrow along Y.",
            "If your box is rotated 90 degrees, length and width are swapped. That is a yaw error.",
          ],
        },
        {
          type: "remember",
          items: [
            "Box = centre + size + yaw.",
            "Length follows the object's heading, unless the project says otherwise.",
            "Height runs along Z, straight up.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Swapping length and width.",
            "Leaving yaw at zero for a rotated object.",
            "Tilting the box instead of keeping it upright.",
          ],
        },
      ],
    },
    {
      kind: "INTERACTIVE_CUBOID",
      title: "Draw a cuboid",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "Four steps, in this order",
          body: [
            "Move the box onto the object. Resize it to cover all points. Rotate it to match the heading.",
            "Then fit: check every view and tighten until no points stick out.",
          ],
        },
        {
          type: "interactive",
          widget: "cuboid",
          sceneKey: "demo-cuboid",
          checkpoints: [
            { key: "move", label: "Move the box onto the object" },
            { key: "resize", label: "Resize the box" },
            { key: "rotate", label: "Rotate the box to match the heading" },
            { key: "fit", label: "Fit the box tightly around all points" },
          ],
          instructions:
            "Complete the four steps on the demo object. Check top and side views before you finish.",
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "After resizing, the box looks right from above. In side view it is 30 cm too tall.",
            "You lower the top edge until it just clears the highest point.",
          ],
        },
        {
          type: "remember",
          items: [
            "Move, resize, rotate, then fit.",
            "Check all three views before you finish.",
            "One object gets one box.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Fitting in only one view.",
            "Rotating last and then forgetting to refit.",
            "Drawing two boxes for one object.",
          ],
        },
      ],
    },
    {
      kind: "TEXT",
      title: "Tight, not tiny",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Two opposite errors",
          body: [
            "A box that is too big includes empty space. A box that is too small cuts off points.",
            "Both are wrong. The goal is a snug box around the whole object.",
          ],
        },
        { type: "figure", kind: "svg", id: "box-too-big", caption: "Too big: empty space around the object." },
        { type: "figure", kind: "svg", id: "box-cuts-points", caption: "Too small: points stick out of the box." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A pallet box leaves 20 cm of gap on every side. That is too loose.",
            "Another box clips the pallet corner. That is too tight. Aim between them: all points in, no wasted space.",
          ],
        },
        {
          type: "remember",
          items: [
            "Every point of the object should be inside the box.",
            "Do not add extra margin to be safe.",
            "Stray points from other objects do not belong in your box.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Adding a big safety margin.",
            "Cutting off points to make the box look neat.",
            "Including the floor in the box height.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "Which three things define a cuboid?",
        options: [
          "Colour, class and frame",
          "Centre, size and yaw",
          "Top, front and side",
          "Points, density and range",
        ],
        correctAnswer: 1,
        explanation:
          "A box is its centre, its size and its yaw. Colour, class and frame are label data. Top, front and side are views.",
        media: { kind: "svg", id: "cuboid-params" },
      },
      {
        kind: "INTERPRETATION",
        prompt: "A box has several object points sticking out of one side in side view. What is wrong?",
        options: [
          "The box is too big",
          "The box is too small or misplaced on that side",
          "The yaw is perfect",
          "Nothing, a few points can be left out",
        ],
        correctAnswer: 1,
        explanation:
          "Points outside the box mean it does not cover the object. A big box would not leave points out. Leftover points are an error.",
        media: { kind: "svg", id: "box-cuts-points" },
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which box is wrong?",
        options: [
          "A box with length along a forklift's heading",
          "A box that is upright with height along Z",
          "A box with 30 cm of empty space on every side of a pallet",
          "A box that holds all points of a person",
        ],
        correctAnswer: 2,
        explanation:
          "A 30 cm gap on every side is too loose. The other three are correct.",
        media: { kind: "svg", id: "box-too-big" },
      },
      {
        kind: "TRUE_FALSE",
        prompt: "A bigger box is safer than a tight one because it never misses points.",
        correctAnswer: false,
        explanation: "Extra space is also an error. Aim for a snug box with all points inside.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "Your box looks perfect from above, but you have not checked any other view. What next?",
        options: [
          "Submit it",
          "Check front and side views for height and gaps",
          "Make it larger to be safe",
          "Reset the yaw to zero",
        ],
        correctAnswer: 1,
        explanation:
          "Height and gaps hide in top view. Enlarging adds error. Resetting yaw would undo good work.",
      },
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "In the standard workflow, what comes right after you move and resize a box?",
        options: ["Delete it", "Rotate it to match the heading", "Add a second box", "Lock it forever"],
        correctAnswer: 1,
        explanation: "Order is move, resize, rotate, fit. A second box for one object is an error.",
        media: { kind: "svg", id: "yaw" },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// M5 - Difficult situations
// ---------------------------------------------------------------------------
const m5: ModuleContent = {
  key: "m5-difficult",
  title: "Difficult Annotation Situations",
  summary: "Occlusion, sparse points, touching objects and ambiguity. Use evidence, flag the rest.",
  estimatedMinutes: 14,
  isMandatory: true,
  lessons: [
    {
      kind: "TEXT",
      title: "Occlusion and shadows",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Hidden is not missing",
          body: [
            "When one object blocks another, the far object only shows its visible side.",
            "The blocked part is a shadow. No points there does not mean no object.",
          ],
        },
        { type: "figure", kind: "svg", id: "occlusion-shadow", caption: "Only the front face is visible. The rest is shadow." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "You see one flat wall of points behind a rack. The project says to label full objects.",
            "Follow the project rule on estimating hidden size. If the rule is silent, box only what the points support and flag it.",
          ],
        },
        {
          type: "remember",
          items: [
            "Occluded objects still exist.",
            "Look at other frames or views for the hidden extent.",
            "Follow the project rule for hidden parts. If silent, flag it.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Ignoring an object because only a sliver is visible.",
            "Inventing a full-size box with no evidence.",
            "Applying one project's occlusion rule to another project.",
          ],
        },
      ],
    },
    {
      kind: "TEXT",
      title: "Sparse points and unclear objects",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Evidence decides",
          body: [
            "If you cannot tell what it is, you do not know. Do not pick the likeliest answer.",
            "Flag it with a short note. A flag is a correct outcome.",
          ],
        },
        { type: "figure", kind: "svg", id: "density-falloff", caption: "Far objects have few points. Expect less detail." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A far cluster of six points could be a person or a post.",
            "You flag it and move on. The reviewer can use extra context you do not have.",
          ],
        },
        {
          type: "remember",
          items: [
            "Annotate only what the points support.",
            "Flag, do not guess.",
            "A short note beats a confident guess.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Guessing to avoid leaving a gap.",
            "Flagging everything instead of checking views first.",
            "Writing flag notes with no detail.",
          ],
        },
      ],
    },
    {
      kind: "TEXT",
      title: "Touching and overlapping objects",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "One object, one box",
          body: [
            "Objects close together still get their own boxes.",
            "Boxes may touch at an edge. They should not overlap by a large area.",
          ],
        },
        { type: "figure", kind: "svg", id: "overlap", caption: "Touching is fine. Large overlap is an error." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "Two pallets sit side by side with no gap. You draw two boxes sharing an edge.",
            "You do not draw one big box around both.",
          ],
        },
        {
          type: "remember",
          items: [
            "Separate objects get separate boxes.",
            "Use side and top views to find the dividing line.",
            "Follow the project rule if it treats stacks differently.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "One box around two objects.",
            "Two boxes on one object.",
            "Overlapping boxes by a wide margin.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "CHOOSE_DECISION",
        prompt: "A cluster of 6 far-away points could be a person or a post. What is the correct action?",
        options: [
          "Label it Person",
          "Label it Post",
          "Flag it with a note instead of guessing",
          "Delete the points",
        ],
        correctAnswer: 2,
        explanation:
          "Six points are not enough to tell. Either label would be a guess. Deleting points damages the data.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "An object that is mostly hidden behind another no longer exists for annotation purposes.",
        correctAnswer: false,
        explanation:
          "Hidden does not mean absent. Check other views and frames, and follow the project rule for partly visible objects.",
      },
      {
        kind: "INTERPRETATION",
        prompt: "In the diagram, why does the far object only show points on its front face?",
        options: [
          "The object is flat",
          "The near object blocks the sensor from seeing the rest",
          "The sensor skipped that area",
          "The far object is background",
        ],
        correctAnswer: 1,
        explanation:
          "Lasers cannot pass through the near box, so the rear is in its shadow. The object is not flat or background.",
        media: { kind: "svg", id: "occlusion-shadow" },
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Two pallets touch each other. Which annotation is wrong?",
        options: [
          "Two boxes sharing an edge",
          "Two boxes with a thin gap",
          "One large box around both pallets",
          "Each box checked in top and side views",
        ],
        correctAnswer: 2,
        explanation: "Separate objects need separate boxes. The other three are acceptable.",
        media: { kind: "svg", id: "overlap" },
      },
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "What should you check first when an object looks unclear?",
        options: [
          "Guess from the nearest class",
          "Other views and nearby frames",
          "Ask a friend",
          "Delete it",
        ],
        correctAnswer: 1,
        explanation:
          "More evidence is free and quick. If still unclear after that, flag it. Guessing or deleting skips the check.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "You drew two boxes on one forklift, one on the cab and one on the forks. What now?",
        options: [
          "Keep both, they cover everything",
          "Merge into one box around the whole forklift",
          "Delete the cab box only",
          "Flag the forklift",
        ],
        correctAnswer: 1,
        explanation:
          "One object gets one box. Both boxes covering parts is the error. Nothing is unclear here, so no flag is needed.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// M6 - Quality and workflow
// ---------------------------------------------------------------------------
const m6: ModuleContent = {
  key: "m6-quality",
  title: "Annotation Quality and Professional Workflow",
  summary: "A repeatable routine: annotate, self-check, flag, submit, then learn from feedback.",
  estimatedMinutes: 10,
  isMandatory: true,
  lessons: [
    {
      kind: "TEXT",
      title: "The self-check routine",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Check before you submit",
          body: [
            "Every box gets the same short check. This catches most errors before a reviewer sees them.",
          ],
        },
        {
          type: "bullets",
          heading: "Self-check list",
          items: [
            "Is every object on the class list labelled?",
            "Is each class right, and are required attributes filled?",
            "Do all points sit inside the box, with no big gaps?",
            "Is yaw right in top view?",
            "Is there exactly one box per object?",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "You finish a scene and run the list. Step four shows one box rotated 90 degrees.",
            "Fixing it takes ten seconds. A reviewer round trip takes a day.",
          ],
        },
        {
          type: "remember",
          items: [
            "Check your own work first.",
            "Use the same list every time.",
            "Fast and wrong is slower than careful and right.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Submitting right after drawing the last box.",
            "Checking only the boxes you feel unsure about.",
            "Skipping the check when the task looks easy.",
          ],
        },
      ],
    },
    {
      kind: "TEXT",
      title: "Flag, submit and learn from feedback",
      estimatedMinutes: 4,
      blocks: [
        {
          type: "explain",
          heading: "Flag, do not guess",
          body: [
            "When evidence is missing or the guideline is silent, flag the object with a note.",
            "Say what you saw, what you tried, and what you are unsure about.",
          ],
        },
        {
          type: "explain",
          heading: "Feedback is part of the job",
          body: [
            "Reviewers return comments. Fix each one, then check the whole scene again.",
            "Look for the pattern behind the comment, so you stop making the same mistake.",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "Two comments say your boxes are too loose. You tighten them and check every other box too.",
            "The same error was in three more boxes.",
          ],
        },
        {
          type: "remember",
          items: [
            "A good flag note is short and specific.",
            "Fix the pattern, not only the one box.",
            "Follow the project guideline over personal habit.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Flagging with no explanation.",
            "Fixing only the boxes the reviewer pointed at.",
            "Arguing with a guideline instead of asking.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "CHOOSE_DECISION",
        prompt: "You have drawn the last box. What should you do before submitting?",
        options: [
          "Submit immediately to save time",
          "Run your self-check list on every box",
          "Make all boxes slightly bigger",
          "Check only the first box",
        ],
        correctAnswer: 1,
        explanation:
          "A full check catches errors cheaply. Enlarging boxes adds error. Checking only one box misses the rest.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "When a reviewer comments on one box, fixing only that box is enough.",
        correctAnswer: false,
        explanation: "The same mistake often repeats. Look for the pattern and check the other boxes.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which flag note is poorly written?",
        options: [
          "Unclear, 7 points at 50 m, could be person or post.",
          "Unsure.",
          "Rear half hidden by rack, guideline silent on hidden extent.",
          "Two views checked, shape is ambiguous between cart and pallet.",
        ],
        correctAnswer: 1,
        explanation:
          "A one-word note gives the reviewer nothing to work with. The others state what was seen and what is unclear.",
      },
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "The project guideline conflicts with your habit from another project. What do you follow?",
        options: [
          "Your habit",
          "The project guideline",
          "Whatever is faster",
          "The majority of your colleagues",
        ],
        correctAnswer: 1,
        explanation:
          "The guideline is the single source of truth for that project. Habit and speed are not valid reasons to deviate.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "A reviewer says your box yaw is 90 degrees off. What is the best next step?",
        options: [
          "Fix that box only",
          "Fix it, then check yaw on all your other boxes",
          "Delete all boxes",
          "Ignore, since yaw is minor",
        ],
        correctAnswer: 1,
        explanation:
          "A yaw error often repeats across boxes. Deleting everything is excessive, and ignoring feedback is not acceptable.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Optional tracks
// ---------------------------------------------------------------------------
const tCuboid: ModuleContent = {
  key: "t-cuboid",
  title: "Track: Cuboid Detection",
  summary: "Extra practice on tight, correctly oriented boxes for detection tasks.",
  estimatedMinutes: 6,
  isMandatory: false,
  trackKey: "cuboid",
  lessons: [
    {
      kind: "TEXT",
      title: "Detection-quality cuboids",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "What detection needs",
          body: [
            "Detection models learn from your boxes. Sloppy boxes teach sloppy detection.",
            "Consistency matters as much as accuracy: treat similar objects the same way every time.",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "Three identical pallets get boxes of three different sizes.",
            "The model sees noise. Re-fit all three to the same snug standard.",
          ],
        },
        {
          type: "remember",
          items: [
            "Same object type, same fitting standard.",
            "Check centre, size and yaw on every box.",
            "Flag objects you cannot judge instead of guessing.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Fitting some boxes tight and others loose.",
            "Skipping far objects without following the project range rule.",
            "Using different heading conventions across boxes.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "Why does consistency matter for detection data?",
        options: [
          "It makes the viewer faster",
          "Models learn from patterns, and inconsistent boxes look like noise",
          "Reviewers prefer it",
          "It reduces file size",
        ],
        correctAnswer: 1,
        explanation: "Models learn patterns in the labels. Speed, preference and file size are not the reason.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which practice is wrong for detection labelling?",
        options: [
          "Fitting all pallets to the same snug standard",
          "Checking yaw on every box",
          "Making far boxes much larger than near ones for the same object type",
          "Flagging unclear objects",
        ],
        correctAnswer: 2,
        explanation:
          "Object size does not change with distance. Inflating far boxes teaches the wrong size. The other three are good practice.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "Two identical objects can have noticeably different box sizes if both are roughly correct.",
        correctAnswer: false,
        explanation: "Identical objects should get near-identical fits. Differences become label noise.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "You notice earlier boxes of the same object type were fitted looser than your current ones. What do you do?",
        options: [
          "Leave them, they are done",
          "Re-fit the loose ones to match the snug standard",
          "Loosen the new ones to match",
          "Delete the old ones",
        ],
        correctAnswer: 1,
        explanation:
          "Snug is the standard. Loosening new boxes spreads the error and deleting loses valid objects.",
      },
    ],
  },
};

const tSemanticSeg: ModuleContent = {
  key: "t-semantic-seg",
  title: "Track: Semantic Segmentation",
  summary: "Label every point by class, with clean boundaries.",
  estimatedMinutes: 6,
  isMandatory: false,
  trackKey: "semantic_seg",
  lessons: [
    {
      kind: "TEXT",
      title: "Point-level labelling",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "Every point gets a class",
          body: [
            "In segmentation you label points, not boxes. Ground, wall and objects all get a class.",
            "Boundaries matter. Points at an edge belong to the surface they hit.",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A person stands next to a wall. Points on the person are Person. Points on the wall are Wall.",
            "Do not paint the whole area around the person with one class.",
          ],
        },
        {
          type: "remember",
          items: [
            "Label by what each point hit.",
            "Use side views to separate ground from low objects.",
            "Leave nothing unclassified unless the project allows it.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Painting a loose region that includes neighbouring points.",
            "Labelling ground points under an object as the object.",
            "Skipping small clusters.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "In semantic segmentation, what receives a label?",
        options: ["Boxes", "Individual points", "Frames only", "Sensors"],
        correctAnswer: 1,
        explanation: "Segmentation labels each point by class. Boxes belong to detection tasks.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "Points at the base of a pallet touch the floor. Which points get the Pallet class?",
        options: [
          "All points within 1 m of the pallet",
          "Only the points that hit the pallet surface",
          "Everything above the floor",
          "None, skip the base",
        ],
        correctAnswer: 1,
        explanation:
          "Label by what each point hit. A wide radius labels floor and neighbours wrongly. Skipping the base leaves pallet points unlabelled.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which segmentation action is wrong?",
        options: [
          "Using side view to separate floor from a low object",
          "Labelling a person's points as Person",
          "Labelling the wall behind a person as Person because it is close",
          "Labelling floor points as Ground",
        ],
        correctAnswer: 2,
        explanation: "The wall points hit the wall, not the person. Proximity is not a reason to share a class.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "In segmentation, small clusters can be skipped because they do not matter.",
        correctAnswer: false,
        explanation: "Small clusters still carry class information. Skipping them leaves holes in the labelled cloud.",
      },
    ],
  },
};

const tInstanceSeg: ModuleContent = {
  key: "t-instance-seg",
  title: "Track: Instance Segmentation",
  summary: "Separate individual objects of the same class.",
  estimatedMinutes: 6,
  isMandatory: false,
  trackKey: "instance_seg",
  lessons: [
    {
      kind: "TEXT",
      title: "One object, one instance",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "Class plus identity",
          body: [
            "Instance segmentation labels points by class and by which object they belong to.",
            "Two pallets are both Pallet, but they are Instance 1 and Instance 2.",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "Two people walk side by side and their points touch.",
            "Use top view to find where one person ends and the next begins, then assign two instances.",
          ],
        },
        {
          type: "remember",
          items: [
            "One physical object is one instance.",
            "Touching objects still need separate instances.",
            "Use top and side views to find the boundary.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Merging touching objects into one instance.",
            "Splitting one object into two instances.",
            "Reusing an instance ID for a different object.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "Two pallets sit side by side, same class. How many instances are there?",
        options: ["One", "Two", "Zero", "It depends on the colour"],
        correctAnswer: 1,
        explanation: "Each physical object is its own instance, even when the class is the same.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which instance labelling is wrong?",
        options: [
          "Two touching people given two instances",
          "One cart given one instance",
          "One forklift split into two instances for cab and forks",
          "Each pallet in a row given its own instance",
        ],
        correctAnswer: 2,
        explanation: "A forklift is one object, so it is one instance. The other three are correct.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "Two people's points touch and you cannot see the boundary from the default view. What do you do?",
        options: [
          "Assign one instance to both",
          "Switch to top and side views to find the boundary",
          "Skip both people",
          "Assign random instances",
        ],
        correctAnswer: 1,
        explanation: "Other views usually show where one object ends. Merging, skipping and random assignment all add error.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "An instance ID can be reused for a different object in the same scene.",
        correctAnswer: false,
        explanation: "Each instance is one object. Reusing an ID merges two objects in the data.",
      },
    ],
  },
};

const tTracking: ModuleContent = {
  key: "t-tracking",
  title: "Track: Multi-frame Tracking",
  summary: "Keep identities stable across frames.",
  estimatedMinutes: 6,
  isMandatory: false,
  trackKey: "tracking",
  lessons: [
    {
      kind: "TEXT",
      title: "Stable identities over time",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "One object, one ID, every frame",
          body: [
            "In tracking, each object keeps the same ID in every frame where it appears.",
            "Never give that ID to a different object in the same sequence.",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A person walks behind a rack and comes out the other side.",
            "It is the same person, so it keeps the same ID. Do not start a new one.",
          ],
        },
        {
          type: "remember",
          items: [
            "Same object keeps the same ID.",
            "Do not reuse an ID for another object.",
            "Check each frame, not just the first and last.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Swapping IDs between two objects that cross paths.",
            "Starting a new ID after a short occlusion.",
            "Letting boxes drift between keyframes.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "A person disappears behind a rack for three frames, then reappears. What ID do they get?",
        options: [
          "A new ID",
          "The same ID as before",
          "The ID of the nearest object",
          "No ID",
        ],
        correctAnswer: 1,
        explanation: "It is the same object, so it keeps its identity. A new ID would split one track into two.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Two people cross paths. Which outcome is wrong?",
        options: [
          "Each person keeps their own ID after crossing",
          "IDs are checked in the frames around the crossing",
          "The two IDs are swapped after the crossing",
          "Boxes are re-fitted in each frame",
        ],
        correctAnswer: 2,
        explanation: "Swapped IDs break both tracks. The other three are correct habits.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "Checking only the first and last frames is enough for a track.",
        correctAnswer: false,
        explanation: "Errors happen in between, especially during occlusion and crossings. Check the middle frames too.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "You cannot tell which of two objects is which after they cross. What do you do?",
        options: [
          "Pick the ID you prefer",
          "Check earlier and later frames and other views, and flag if still unclear",
          "Delete both tracks",
          "Give both the same ID",
        ],
        correctAnswer: 1,
        explanation:
          "Evidence in neighbouring frames usually decides. If not, flag instead of guessing. Duplicating or deleting IDs corrupts the data.",
      },
    ],
  },
};

const tSceneClass: ModuleContent = {
  key: "t-scene-class",
  title: "Track: Scene Classification",
  summary: "Describe a whole scene with the right tags.",
  estimatedMinutes: 6,
  isMandatory: false,
  trackKey: "scene_classification",
  lessons: [
    {
      kind: "TEXT",
      title: "Labelling the whole scene",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "One judgement for the whole scene",
          body: [
            "Scene classification tags the entire cloud, such as indoor or outdoor, or busy or empty.",
            "Base it on what dominates the scene, not on one small detail.",
          ],
        },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A scene is mostly a long aisle with one person in a corner.",
            "A tag about the aisle fits better than a tag about the person.",
          ],
        },
        {
          type: "remember",
          items: [
            "Look at the whole scene before tagging.",
            "Use only the tags the project defines.",
            "Flag scenes that fit no tag.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Tagging from the first glance only.",
            "Choosing by one small object.",
            "Inventing tags.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "What should a scene tag reflect?",
        options: [
          "The smallest object in the scene",
          "What dominates the whole scene",
          "The first thing you notice",
          "Your guess about the next frame",
        ],
        correctAnswer: 1,
        explanation: "Scene tags describe the whole cloud. A small object or a first glance may mislead.",
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "A scene fits none of the defined tags. What do you do?",
        options: [
          "Invent a new tag",
          "Pick the closest tag silently",
          "Flag the scene with a short note",
          "Leave all tags empty and submit",
        ],
        correctAnswer: 2,
        explanation: "Flagging tells the project owner the tag set may have a gap. Inventing or silently forcing a tag hides it.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which scene-tagging habit is wrong?",
        options: [
          "Looking at the whole scene first",
          "Using only the project's tags",
          "Tagging a mostly empty hall as crowded because one person is near the sensor",
          "Flagging scenes that do not fit",
        ],
        correctAnswer: 2,
        explanation: "One person does not make the scene crowded. Judge the whole cloud.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "You may create your own scene tags when the list seems too short.",
        correctAnswer: false,
        explanation: "Only project-defined tags are valid. Flag a gap instead.",
      },
    ],
  },
};

const tSensorFusion: ModuleContent = {
  key: "t-sensor-fusion",
  title: "Track: Sensor Fusion and Context Images",
  summary: "Use camera images to confirm what the points suggest.",
  estimatedMinutes: 6,
  isMandatory: false,
  trackKey: "sensor_fusion",
  lessons: [
    {
      kind: "TEXT",
      title: "Cross-checking with the camera",
      estimatedMinutes: 5,
      blocks: [
        {
          type: "explain",
          heading: "Two sensors, one object",
          body: [
            "The camera shows colour and texture. LiDAR shows shape and distance.",
            "Use the image to confirm the class and to check your box lines up.",
          ],
        },
        { type: "figure", kind: "svg", id: "image-vs-cloud", caption: "Image and cloud show the same scene differently." },
        {
          type: "example",
          heading: "Practical example",
          body: [
            "A cluster could be a person or a post. The camera shows a person in a hi-vis vest.",
            "You label it a person and check the projected box sits on that person.",
          ],
        },
        {
          type: "remember",
          items: [
            "The image helps decide class. LiDAR sets the box.",
            "Check that the projected box matches the object in the image.",
            "If image and cloud disagree, flag it.",
          ],
        },
        {
          type: "mistakes",
          items: [
            "Fitting the box to the image outline instead of the points.",
            "Ignoring the image when the class is unclear.",
            "Trusting a camera that is blurred or blocked.",
          ],
        },
      ],
    },
  ],
  quiz: {
    questions: [
      {
        kind: "MULTIPLE_CHOICE",
        prompt: "What is the camera image best used for?",
        options: [
          "Setting exact box depth",
          "Confirming class and checking box alignment",
          "Replacing the point cloud",
          "Adding more points",
        ],
        correctAnswer: 1,
        explanation: "Images give colour and context. Depth and shape come from LiDAR. The image cannot replace the cloud.",
        media: { kind: "svg", id: "image-vs-cloud" },
      },
      {
        kind: "CHOOSE_DECISION",
        prompt: "The image is blurred and the cloud cluster is unclear. What do you do?",
        options: [
          "Guess from the image",
          "Flag it",
          "Delete the cluster",
          "Draw a large box to cover both options",
        ],
        correctAnswer: 1,
        explanation: "Neither sensor gives enough evidence. Flag it. A large box would be wrong for either object.",
      },
      {
        kind: "IDENTIFY_INCORRECT",
        prompt: "Which fusion habit is wrong?",
        options: [
          "Using the image to confirm class",
          "Fitting the box to the image outline even when points extend beyond it",
          "Checking the projected box against the image",
          "Flagging image and cloud disagreement",
        ],
        correctAnswer: 1,
        explanation: "The box must cover the points. The image only helps confirm class and alignment.",
      },
      {
        kind: "TRUE_FALSE",
        prompt: "If the image and the cloud disagree, you should trust the image automatically.",
        correctAnswer: false,
        explanation: "Disagreement is a reason to flag, not to pick a side. Either sensor can be blocked or noisy.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Final assessment (20 questions, spread across m1-m6)
// ---------------------------------------------------------------------------
const finalAssessment: QuizQuestionContent[] = [
  // m1
  {
    kind: "CHOOSE_DECISION",
    prompt: "A person-shaped cluster has 250 points at 8 m. A similar cluster has 5 points at 55 m. How do you treat them?",
    options: [
      "Label both as Person with equal confidence",
      "Label the near one from the evidence, and flag or skip the far one if you cannot tell",
      "Skip both because LiDAR is unreliable",
      "Label the far one first because it is more important",
    ],
    correctAnswer: 1,
    explanation:
      "The near cluster has plenty of evidence. Five points do not. Equal confidence ignores density, and skipping both throws away good evidence.",
    media: { kind: "svg", id: "density-falloff" },
  },
  {
    kind: "INTERPRETATION",
    prompt: "From above, a flat patch of points looks like a pallet. In side view it is 10 cm high. What is the best reading?",
    options: [
      "A pallet, since the outline matches",
      "Probably a floor mark or thin sheet, not a pallet",
      "A person lying down",
      "A cart",
    ],
    correctAnswer: 1,
    explanation:
      "Pallets have real height. A 10 cm patch is a thin item. Outline alone is not enough, which is why you check a second view.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "An annotator made four statements about a scene. Which one is wrong?",
    options: [
      "That gap behind the rack may be a shadow, so I checked other views.",
      "These far points are sparse because of distance.",
      "No points at the corner, so no object is there.",
      "The ground is background, so I did not box it.",
    ],
    correctAnswer: 2,
    explanation:
      "Missing points can mean shadow, distance or a dark surface. They do not prove absence. The other three statements are sound.",
  },
  // m2
  {
    kind: "CHOOSE_DECISION",
    prompt: "A box looks tight from the default angle. What is the correct next step?",
    options: [
      "Submit it, since it looks tight",
      "Check top, front and side views before finishing",
      "Make it 10% larger",
      "Lock it and move on",
    ],
    correctAnswer: 1,
    explanation:
      "Errors in height and yaw hide in a single view. Enlarging adds error and locking skips the check.",
    media: { kind: "svg", id: "views-top-front-side" },
  },
  {
    kind: "MULTIPLE_CHOICE",
    prompt: "You want to confirm the box is the right height. Which is the most direct check?",
    options: [
      "Top view only",
      "Front or side view",
      "Zoom in on the centre in top view",
      "Reset and look again",
    ],
    correctAnswer: 1,
    explanation:
      "Front and side views show Z directly. Top view flattens height, zooming does not add a new angle, and reset only restores the default view.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which navigation workflow is wrong?",
    options: [
      "Rotate to check the back of a box, then reset to regain orientation",
      "Use top view to judge yaw",
      "Judge the box height from top view only",
      "Zoom in to check an edge, then zoom out to check context",
    ],
    correctAnswer: 2,
    explanation:
      "Top view cannot show height. The other three workflows use each control for its purpose.",
  },
  // m3
  {
    kind: "CHOOSE_DECISION",
    prompt: "The class list has Person, Pallet and Cart. You find a clear, well-sampled traffic cone. What do you do?",
    options: [
      "Label it Cart, the closest class",
      "Label it Pallet because it sits on the floor",
      "Do not label it, since it is not on the list",
      "Label it Person because it is upright",
    ],
    correctAnswer: 2,
    explanation:
      "Only listed classes are annotated. Forcing a nearby class mislabels the data.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which finished label is incorrect?",
    options: [
      "A Pallet box with all required attributes filled",
      "A Person box with the required attribute left empty",
      "A Cart box flagged because the points were too few",
      "A Person box with correct class and attributes",
    ],
    correctAnswer: 1,
    explanation:
      "A missing required attribute makes the label incomplete. A flagged unclear object is a valid outcome.",
  },
  {
    kind: "IDENTIFY_OBJECT",
    prompt: "Classes: Person, Pallet, Cart. An object is about 15 cm tall, 1.2 m wide, with a flat top. Which fits?",
    options: ["Person", "Cart", "Pallet", "None, it is background"],
    correctAnswer: 2,
    explanation:
      "A low, flat, wide shape matches a pallet. A person is tall and narrow. A cart is usually taller and has a handle or frame.",
  },
  // m4
  {
    kind: "INTERPRETATION",
    prompt: "A forklift drives along X. Its box is 2 m along X and 1 m along Y. Is the yaw correct?",
    options: [
      "No, the box should be longer along Y",
      "Yes, the long side follows the direction of travel",
      "It cannot be judged without colour",
      "Only if the height is above 3 m",
    ],
    correctAnswer: 1,
    explanation:
      "Length follows the heading, and a forklift is longer than it is wide. Colour and height do not decide yaw.",
    media: { kind: "svg", id: "yaw" },
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which box is incorrectly drawn?",
    options: [
      "A snug box with every object point inside",
      "A box centred on the object's real middle",
      "A box with 40 cm of empty space on every side",
      "A box with length along the heading",
    ],
    correctAnswer: 2,
    explanation:
      "Extra space on every side is too loose. The other three describe correct fitting.",
    media: { kind: "svg", id: "box-too-big" },
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "In side view, three points of your object stick out above the box. What do you do?",
    options: [
      "Ignore them, three points are minor",
      "Raise the top edge until they are inside",
      "Make the box twice as tall",
      "Delete the three points",
    ],
    correctAnswer: 1,
    explanation:
      "Every object point belongs inside the box. Doubling height leaves a big gap, and deleting points alters the data.",
    media: { kind: "svg", id: "box-cuts-points" },
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "You have drawn a box, then rotated it to match the heading. What must you do before moving on?",
    options: [
      "Nothing, rotation never changes fit",
      "Re-check the fit, because rotation can leave points outside or gaps",
      "Rotate it back to zero",
      "Add a second box at the new angle",
    ],
    correctAnswer: 1,
    explanation:
      "Rotating changes which points fall inside. Rotating back undoes your work, and a second box breaks the one-box rule.",
  },
  // m5
  {
    kind: "CHOOSE_DECISION",
    prompt: "A cluster of 7 points at 50 m could be a person or a post. Other views do not help. What is correct?",
    options: [
      "Label it Person",
      "Label it Post",
      "Flag it with a note about distance and ambiguity",
      "Delete the points to avoid the problem",
    ],
    correctAnswer: 2,
    explanation:
      "Either label would be a guess. Deleting points removes evidence from the cloud.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Two pallets touch each other. Which annotation is wrong?",
    options: [
      "Two boxes sharing one edge",
      "Two boxes with a 2 cm gap",
      "One big box around both pallets",
      "Each box checked in top and side views",
    ],
    correctAnswer: 2,
    explanation:
      "Separate objects need separate boxes. Shared edges and small gaps are fine.",
    media: { kind: "svg", id: "overlap" },
  },
  {
    kind: "INTERPRETATION",
    prompt: "Behind a near box, a far object shows points only on its front face. What does this mean?",
    options: [
      "The object is as thin as a sheet",
      "The rear is in shadow and is not visible, not necessarily missing",
      "The sensor is broken",
      "The object should not be labelled",
    ],
    correctAnswer: 1,
    explanation:
      "The near box blocks the laser. The far object is not thin, the sensor is fine, and it may still need a label under project rules.",
    media: { kind: "svg", id: "occlusion-shadow" },
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "A guideline says nothing about how to box a mostly hidden object. What do you do?",
    options: [
      "Invent a rule and apply it to every similar case",
      "Box only what the points support and flag the object",
      "Skip it silently",
      "Copy the rule from another project",
    ],
    correctAnswer: 1,
    explanation:
      "Annotate only what the points support and flag the gap. Inventing rules or copying them from other projects breaks consistency, and skipping silently hides the issue.",
  },
  // m6
  {
    kind: "CHOOSE_DECISION",
    prompt: "A reviewer says two of your boxes are too loose. What is the best response?",
    options: [
      "Fix those two only",
      "Fix them, then check all other boxes for the same problem",
      "Reply that loose boxes are safer",
      "Delete the scene and start over",
    ],
    correctAnswer: 1,
    explanation:
      "Repeated errors are common, so check the pattern. Loose is not safer, and restarting wastes the good work.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which part of this workflow is wrong?",
    options: [
      "Annotate, then run the self-check list",
      "Flag objects with a specific note when unsure",
      "Submit immediately after the last box because the task looked easy",
      "Fix reviewer comments and re-check the whole scene",
    ],
    correctAnswer: 2,
    explanation:
      "Easy tasks still need the self-check. The other three steps are part of the professional workflow.",
  },
  {
    kind: "MULTIPLE_CHOICE",
    prompt: "You are unsure about an object and want to flag it. Which note is the most useful?",
    options: [
      "Not sure.",
      "Unclear.",
      "7 points at 50 m, two views checked, could be person or post.",
      "Please check everything.",
    ],
    correctAnswer: 2,
    explanation:
      "A good note says what you saw and what you tried. The others give the reviewer nothing to act on.",
  },
];

export const foundations: ProgramContent = {
  slug: "foundations",
  modules: [m1, m2, m3, m4, m5, m6, tCuboid, tSemanticSeg, tInstanceSeg, tTracking, tSceneClass, tSensorFusion],
  finalAssessment,
};
