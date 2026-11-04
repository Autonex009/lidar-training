import type { ModuleContent, QuizQuestionContent } from "./types";

// Quiz seeds are copied inline from project-configs/tonic/config.json (quizSeeds)
// to avoid importing JSON from outside the app package. TRUE_FALSE answers are
// converted from option index to boolean; `imageFile` becomes `media`.
const tonicQuizQuestions: QuizQuestionContent[] =
[
  {
    "kind": "MULTIPLE_CHOICE",
    "prompt": "An object is visible in 60% of its expected extent. Which occlusion state applies?",
    "options": [
      "None",
      "Partial",
      "Heavy",
      "Not annotated"
    ],
    "correctAnswer": 1,
    "explanation": "Partial = 30-90% visible; None > 90%; Heavy < 30%."
  },
  {
    "kind": "MULTIPLE_CHOICE",
    "prompt": "An object is only about 20% visible. Which occlusion state applies?",
    "options": [
      "None",
      "Partial",
      "Heavy",
      "Partial, because the object is a Human"
    ],
    "correctAnswer": 2,
    "explanation": "Heavy = <30% visible."
  },
  {
    "kind": "MULTIPLE_CHOICE",
    "prompt": "Which ROI tier requires perfect quality with at most 5% error?",
    "options": [
      "0-5 m",
      "0-10 m",
      "Beyond 10 m",
      "All tiers equally"
    ],
    "correctAnswer": 0,
    "explanation": "ROI 0-5 needs perfect quality (5% error); 0-10 everything labelled; >10 m optional if LiDAR points are bad."
  },
  {
    "kind": "TRUE_FALSE",
    "prompt": "Objects beyond 10 m must always be annotated even if the LiDAR points are poor.",
    "correctAnswer": false,
    "explanation": "Beyond 10 m is good but optional if LiDAR points are bad."
  },
  {
    "kind": "MULTIPLE_CHOICE",
    "prompt": "Which statement describes the required cuboid orientation?",
    "options": [
      "Length axis along direction of travel, height up, width perpendicular to both",
      "Length axis always along the sensor X axis",
      "Height axis along direction of travel",
      "Width axis along direction of travel"
    ],
    "correctAnswer": 0,
    "explanation": "Length aligns with direction of travel; height points upward; width is perpendicular to both."
  },
  {
    "kind": "MULTIPLE_CHOICE",
    "prompt": "Which is a valid track ID rule?",
    "options": [
      "IDs are unsigned integers and the assignment order does not matter",
      "IDs must be assigned in order of distance from the sensor",
      "IDs may be reused for a different object in a later frame",
      "IDs are negative integers for static objects"
    ],
    "correctAnswer": 0,
    "explanation": "IDs are unsigned integers (0, 1, 2...), persistent across frames, never reassigned; order is not important."
  },
  {
    "kind": "TRUE_FALSE",
    "prompt": "A track ID may be reassigned to a different object later in the same sequence.",
    "correctAnswer": false,
    "explanation": "Never reassigned within a sequence/camera; do not switch IDs between objects."
  },
  {
    "kind": "CHOOSE_DECISION",
    "prompt": "A model-generated pre-label cuboid is not relevant to the objects covered in your branch. What do you do?",
    "options": [
      "Keep it as-is",
      "Delete it and continue annotating the other relevant objects",
      "Change it to Machines",
      "Leave it for the reviewer"
    ],
    "correctAnswer": 1,
    "explanation": "If not relevant, delete the pre-label. If relevant, review, set the class and align across every frame. Never accept as-is."
  },
  {
    "kind": "TRUE_FALSE",
    "prompt": "If a pre-label looks roughly right, it can be accepted without review.",
    "correctAnswer": false,
    "explanation": "All pre-labels must be reviewed rather than accepted as-is."
  },
  {
    "kind": "CHOOSE_DECISION",
    "prompt": "A person is seated in a wheelchair. What do you annotate?",
    "options": [
      "Only the Wheelchair",
      "Only the Human with activity In-Wheelchair/ADA",
      "Both a Wheelchair cuboid and a Human cuboid with activity In-Wheelchair/ADA",
      "One combined cuboid labelled Wheelchair"
    ],
    "correctAnswer": 2,
    "explanation": "Annotate the device as Wheelchair and also the person as Human with In-Wheelchair/ADA.",
    "media": {
      "kind": "image",
      "file": "project-configs/tonic/images/image14.png"
    }
  },
  {
    "kind": "CHOOSE_DECISION",
    "prompt": "A long aisle of racking is visible. How should it be annotated?",
    "options": [
      "One cuboid covering the full aisle",
      "One cuboid per rack section",
      "Annotate only the pallets",
      "One cuboid per aisle side"
    ],
    "correctAnswer": 1,
    "explanation": "Annotate each rack section individually - never combine a full aisle into one cuboid.",
    "media": {
      "kind": "image",
      "file": "project-configs/tonic/images/image28.png"
    }
  },
  {
    "kind": "IDENTIFY_OBJECT",
    "prompt": "Which class is shown: loose cardboard cartons stacked in an aisle?",
    "options": [
      "Tote",
      "Bin",
      "Boxes",
      "Pallet"
    ],
    "correctAnswer": 2,
    "explanation": "Boxes are loose cardboard boxes/shipping cartons (non-rigid, disposable). Tote and Bin are rigid reusable containers. Stacked-but-separable boxes are annotated individually.",
    "media": {
      "kind": "image",
      "file": "project-configs/tonic/images/image24.png"
    }
  },
  {
    "kind": "IDENTIFY_OBJECT",
    "prompt": "Which class is shown: rigid reusable blue containers stacked on a pallet?",
    "options": [
      "Boxes",
      "Tote",
      "Shelf",
      "Machines"
    ],
    "correctAnswer": 1,
    "explanation": "Totes are rigid, reusable containers for smaller items; not loose cardboard boxes.",
    "media": {
      "kind": "image",
      "file": "project-configs/tonic/images/image23.png"
    }
  },
  {
    "kind": "IDENTIFY_OBJECT",
    "prompt": "Which class is shown: a low machine with two forks and a handle, no raised mast?",
    "options": [
      "Forklift",
      "Cart",
      "Pallet Jack",
      "AGV / AMR"
    ],
    "correctAnswer": 2,
    "explanation": "A Pallet Jack is low and small with two forks and no raised mast; a Forklift has a fork/mast assembly and operator compartment.",
    "media": {
      "kind": "image",
      "file": "project-configs/tonic/images/image15.png"
    }
  },
  {
    "kind": "MULTIPLE_CHOICE",
    "prompt": "A Human is half hidden behind a rack. How should the cuboid be drawn?",
    "options": [
      "Fit only the visible points",
      "Estimate the hidden body portion and keep a physically representative full-body cuboid",
      "Skip annotation until the person is fully visible",
      "Use two cuboids, visible and hidden parts"
    ],
    "correctAnswer": 1,
    "explanation": "Cuboids shall not be reduced solely to fit visible pixels; estimate the hidden portion. Only one cuboid per object."
  }
];

const IMG = "project-configs/tonic/images";

const lessonScope: ModuleContent["lessons"][number] = {
  kind: "TEXT",
  title: "Scope, ROI tiers, required fields and track IDs",
  estimatedMinutes: 6,
  blocks: [
    {
      type: "explain",
      heading: "What this project asks for",
      body: [
        "You draw 3D cuboids around warehouse objects from a list of 22 classes.",
        "Each object gets one cuboid. Never put two cuboids on one object.",
      ],
    },
    {
      type: "bullets",
      heading: "ROI tiers by distance from the sensor",
      items: [
        "0 to 5 m: perfect quality, at most 5% error.",
        "0 to 10 m: everything must be labelled.",
        "Beyond 10 m: good quality, but optional if the LiDAR points are bad.",
      ],
    },
    {
      type: "bullets",
      heading: "Required on every object",
      items: [
        "Track ID: an unsigned integer such as 0, 1, 2.",
        "Class (the classId).",
        "Occlusion state: None (over 90% visible), Partial (30 to 90%), Heavy (under 30%).",
        "Motion state: Static or Moving.",
      ],
    },
    {
      type: "bullets",
      heading: "Track ID rules",
      items: [
        "The ID stays the same in every frame where the object appears.",
        "Never switch IDs between objects.",
        "Never reassign an ID within a sequence.",
        "The order you assign IDs in does not matter.",
      ],
    },
    {
      type: "explain",
      heading: "Cuboid rules that apply everywhere",
      body: [
        "The centre is the geometric centre of the whole object, including parts you cannot see.",
        "Length follows the direction of travel, height points up, width is perpendicular to both.",
        "Check every frame that all LiDAR points are inside the cuboid.",
      ],
    },
    {
      type: "example",
      heading: "Practical example",
      body: [
        "A pallet jack is 7 m away and fully visible. It must be labelled, with track ID, class, occlusion and motion.",
        "A distant object at 14 m has very few points. Labelling it is optional because the points are bad.",
      ],
    },
    {
      type: "remember",
      items: [
        "Every visible listed object within 10 m is annotated in every frame it appears.",
        "Beyond 10 m is optional only when the points are bad.",
        "Track ID, class, occlusion and motion are required.",
      ],
    },
    {
      type: "mistakes",
      items: [
        "Skipping objects within 10 m.",
        "Forgetting the occlusion or motion state.",
        "Switching track IDs between objects, or reassigning an ID.",
        "Placing the centre on the visible points only.",
        "Aligning the length axis arbitrarily instead of with the direction of travel.",
      ],
    },
  ],
};

const lessonDynamic: ModuleContent["lessons"][number] = {
  kind: "TEXT",
  title: "Dynamic object classes",
  estimatedMinutes: 7,
  blocks: [
    {
      type: "explain",
      heading: "Eight dynamic classes",
      body: [
        "Human, Humanoid Robot, Forklift, Pallet Jack, Cart, AGV / AMR, Wheelchair and Vehicle.",
        "Each needs occlusion and motion. Human can also take an activity.",
      ],
    },
    {
      type: "example",
      heading: "Human: full body volume",
      body: [
        "The cuboid covers head, torso, arms and legs, including any hidden part.",
        "Do not shrink the cuboid to the visible points. Activities include standing, walking, running, sitting, kneeling, bending, pushing, pulling, carrying and reaching.",
      ],
      imageFile: IMG + "/image34.png",
    },
    {
      type: "example",
      heading: "Human: wheelchair user",
      body: [
        "If a person is in a wheelchair, annotate two things: the Wheelchair and the Human.",
        "Set the Human activity to In-Wheelchair/ADA.",
      ],
      imageFile: IMG + "/image14.png",
    },
    {
      type: "example",
      heading: "Humanoid Robot",
      body: [
        "A bipedal, human-shaped robot. It is not a person.",
        "For articulated poses, the cuboid covers the robot's overall occupied space.",
      ],
      imageFile: IMG + "/image9.png",
    },
    {
      type: "example",
      heading: "Forklift",
      body: [
        "A powered truck with a fork and mast assembly.",
        "The cuboid covers the chassis, operator compartment and forks.",
      ],
      imageFile: IMG + "/image20.png",
    },
    {
      type: "example",
      heading: "Pallet Jack",
      body: [
        "Low and small, two forks, no raised mast.",
        "The cuboid covers the pallet footprint and any load permanently attached to the pallet.",
      ],
      imageFile: IMG + "/image15.png",
    },
    {
      type: "example",
      heading: "Cart",
      body: [
        "A wheeled, hand-pushed or hand-pulled cart for goods, tools or totes. Not motorised, and not a pallet jack.",
      ],
      imageFile: IMG + "/image31.png",
    },
    {
      type: "example",
      heading: "AGV / AMR",
      body: [
        "A driverless, self-navigating robotic vehicle. No onboard human operator.",
      ],
      imageFile: IMG + "/image3.png",
    },
    {
      type: "example",
      heading: "Vehicle",
      body: [
        "Any motorised vehicle that does not belong to the other dynamic classes.",
      ],
      imageFile: IMG + "/image18.png",
    },
    {
      type: "remember",
      items: [
        "Human cuboid = full expected body volume, including hidden parts.",
        "Occupied wheelchair = Wheelchair plus Human with In-Wheelchair/ADA.",
        "Pallet Jack is low with no raised mast. Forklift has a mast and operator compartment.",
      ],
    },
    {
      type: "mistakes",
      items: [
        "Shrinking a Human cuboid to visible points.",
        "Annotating a wheelchair user only once.",
        "Labelling a Pallet Jack as Forklift.",
      ],
    },
  ],
};

const lessonStatic: ModuleContent["lessons"][number] = {
  kind: "TEXT",
  title: "Static classes, pre-labels, image alignment and confusions",
  estimatedMinutes: 7,
  blocks: [
    {
      type: "explain",
      heading: "Fourteen static classes",
      body: [
        "Pallet, Tote, Bin, Rack, Shelf, Conveyor, Workstation, Table, Chair, Charging Station, Dock Door, Safety Barrier, Machines and Boxes.",
        "Static objects still need occlusion and motion states, and a track ID.",
      ],
    },
    {
      type: "example",
      heading: "Rack: one cuboid per section",
      body: [
        "Annotate each rack section individually.",
        "Never combine a full aisle into one cuboid.",
      ],
      imageFile: IMG + "/image28.png",
    },
    {
      type: "example",
      heading: "Boxes: separable boxes get their own cuboid",
      body: [
        "Boxes are loose cardboard cartons. The cuboid includes any lid or flap overhang.",
        "Stacked-but-separable boxes are annotated individually, not as one stack.",
      ],
      imageFile: IMG + "/image24.png",
    },
    {
      type: "example",
      heading: "Tote: rigid and reusable",
      body: [
        "Totes are rigid, reusable containers for smaller items. They are not cardboard boxes.",
      ],
      imageFile: IMG + "/image23.png",
    },
    {
      type: "example",
      heading: "Bin: rigid storage, distinct from Tote",
      body: [
        "A Bin is a rigid, reusable storage container. It is a separate class from Tote and from Boxes.",
      ],
      imageFile: IMG + "/image7.png",
    },
    {
      type: "example",
      heading: "Shelf: smaller, non-palletized items",
      body: [
        "A shelf is an individual shelving unit for smaller items. A Rack holds palletized or shelved goods in a multi-level structure.",
      ],
      imageFile: IMG + "/image4.png",
    },
    {
      type: "bullets",
      heading: "Pre-label rules",
      items: [
        "Pre-labels are model-generated cuboids that assist you.",
        "Review every one. Never accept as-is.",
        "If relevant to your branch: check it, set the right class, and align it in every frame.",
        "If not relevant: delete it and continue with the other objects.",
      ],
    },
    {
      type: "bullets",
      heading: "2D image alignment",
      items: [
        "The cuboid must align with the object in the 2D image.",
        "Check that the 3D cuboid fits the visible 2D object.",
      ],
    },
    {
      type: "bullets",
      heading: "Common confusions",
      items: [
        "Tote is rigid and reusable. Bin is rigid storage, a different class. Boxes are non-rigid, disposable cardboard.",
        "Pallet Jack is low and small with no raised mast. Forklift has a mast, operator compartment and forks.",
        "Rack is a multi-level structure for palletized goods. Shelf is an individual unit for smaller items.",
        "Wheelchair with a person: label Wheelchair and Human (In-Wheelchair/ADA). Do not pick one.",
      ],
    },
    {
      type: "remember",
      items: [
        "Review every pre-label in every frame.",
        "One rack section = one cuboid.",
        "Check your cuboid against the 2D image.",
      ],
    },
    {
      type: "mistakes",
      items: [
        "Using one cuboid for a whole rack aisle.",
        "Annotating stacked-but-separable boxes as a single stack.",
        "Accepting pre-labels without checking class and alignment.",
        "Confusing Tote, Bin and Boxes.",
        "Leaving the cuboid out of alignment with the 2D image.",
      ],
    },
  ],
};

export const tonicProjectModules: ModuleContent[] = [
  {
    key: "p-tonic-guidelines",
    title: "Tonic Warehouse Guidelines",
    summary: "Scope, ROI tiers, required fields, all 22 classes, pre-label review and image alignment.",
    estimatedMinutes: 20,
    isMandatory: true,
    lessons: [lessonScope, lessonDynamic, lessonStatic],
    quiz: { questions: tonicQuizQuestions },
  },
];

export const tonicFinalAssessmentExtra: QuizQuestionContent[] = [
  {
    kind: "CHOOSE_DECISION",
    prompt: "A pallet jack is 14 m from the sensor and has only a few poor LiDAR points. What do you do?",
    options: [
      "Annotate it, because every object must be labelled",
      "Annotation is optional here because the points are bad",
      "Delete the nearby points",
      "Label it Forklift, since it is far",
    ],
    correctAnswer: 1,
    explanation:
      "Beyond 10 m, objects are optional when the LiDAR points are bad. Labelling it as a Forklift would be a wrong class, and deleting points is never the rule.",
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "A person stands half hidden behind a rack, about 4 m away. How do you draw the Human cuboid?",
    options: [
      "Fit only the visible points",
      "Estimate the hidden body and keep a full-body cuboid",
      "Draw two cuboids, visible and hidden",
      "Skip the person until fully visible",
    ],
    correctAnswer: 1,
    explanation:
      "Human cuboids cover the full expected body volume. Fitting only visible points is the listed mistake. One object gets one cuboid, and the person is within 10 m so must be labelled.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which annotation of a low, two-fork truck with a handle and no raised mast is wrong?",
    options: [
      "Class: Pallet Jack",
      "Cuboid covers the pallet footprint",
      "Class: Forklift",
      "Occlusion and motion states filled in",
    ],
    correctAnswer: 2,
    explanation:
      "No raised mast and a low profile means Pallet Jack. Forklifts have a mast and operator compartment. The other options match the rules.",
    media: { kind: "image", file: "project-configs/tonic/images/image15.png" },
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which track ID handling breaks the rules?",
    options: [
      "A person keeps ID 3 in every frame",
      "IDs 0, 1, 2 are assigned in any order",
      "ID 3 is reused for a different object later in the sequence",
      "An ID of 12 is used for a forklift",
    ],
    correctAnswer: 2,
    explanation:
      "IDs must never be reassigned within a sequence. The order does not matter and any unsigned integer is fine.",
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "A person sits in a wheelchair. You have drawn a Human cuboid with In-Wheelchair/ADA. What is still missing?",
    options: [
      "Nothing, one cuboid is enough",
      "A separate Wheelchair cuboid",
      "A Cart cuboid",
      "A second Human cuboid",
    ],
    correctAnswer: 1,
    explanation:
      "When a person uses a wheelchair you annotate both the Wheelchair and the Human. A second Human would be two cuboids on one object, and a Cart is the wrong class.",
    media: { kind: "image", file: "project-configs/tonic/images/image14.png" },
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "A model-generated pre-label looks like a good fit on a Tote, but its class says Boxes. What do you do?",
    options: [
      "Accept it as-is, it is a good fit",
      "Delete it, because pre-labels are unreliable",
      "Change the class to Tote and check alignment in every frame",
      "Leave the class and fix only the first frame",
    ],
    correctAnswer: 2,
    explanation:
      "Relevant pre-labels are reviewed, the class is corrected and alignment is checked in every frame. Accepting as-is is forbidden, and deleting a relevant object loses work.",
  },
  {
    kind: "IDENTIFY_INCORRECT",
    prompt: "Which annotation of a long aisle of racking and stacked cardboard cartons is wrong?",
    options: [
      "One cuboid per rack section",
      "Stacked-but-separable cartons each get their own cuboid",
      "One cuboid covering the whole rack aisle",
      "Cartons labelled Boxes, not Tote",
    ],
    correctAnswer: 2,
    explanation:
      "A full aisle must never be combined into one cuboid. The other three follow the Rack and Boxes rules.",
    media: { kind: "image", file: "project-configs/tonic/images/image28.png" },
  },
  {
    kind: "CHOOSE_DECISION",
    prompt: "Your cuboid fits all LiDAR points, but in the 2D camera image it sits clearly off the object. What do you do?",
    options: [
      "Submit it, since the points are correct",
      "Adjust the cuboid so it fits the visible 2D object and still contains the points",
      "Delete the cuboid",
      "Add a second cuboid that matches the image",
    ],
    correctAnswer: 1,
    explanation:
      "Cuboids must align with the object in the 2D image as well as contain the points. A second cuboid breaks the one-per-object rule, and deleting loses a valid object.",
  },
];
