import {
  attributesCorrect, boxFit, classAccuracy, completeness, criterion, flagging,
  orientation, requiredFields, reviewerErrorTags, tagsByKey,
} from './common';
import { foundationTasks } from './foundations';
import type { TaskTemplateContent } from './types';

/**
 * Neutral synthetic label -> Tonic class, per scene. The seed uses this to translate reference
 * labels (and initialAnnotation labels) before scoring. Neutral labels not listed (Building,
 * Vegetation, Unknown, Ground) are not annotated in Tonic tasks and must be dropped from the
 * reference cuboids.
 *
 * Shape logic: capsule -> Human; wedge (4.5 x 1.9 x 1.5 m) -> Forklift (AGV / AMR in the moving
 * sequence); lshape (1.8 x 0.7 x 1.7 m) -> Cart; cylinder pole (0.3 x 5 m) -> Safety Barrier.
 * Motion reference: "moving" only for objects with velocity in demo-sequence (vehicle, pedestrian,
 * cyclist/cart); everything else "static". Reference occlusion comes from the scene cuboids.
 */
const BASE_MAP = { Vehicle: 'Forklift', Pedestrian: 'Human', Cyclist: 'Cart', Pole: 'Safety Barrier' };
export const sceneClassMapping: Record<string, Record<string, string>> = {
  'demo-cuboid-basic': BASE_MAP,
  'demo-cuboid-precision': BASE_MAP,
  'demo-occlusion': BASE_MAP,
  'demo-sequence': { ...BASE_MAP, Vehicle: 'AGV / AMR' },
  'demo-errors': BASE_MAP,
  'demo-final': BASE_MAP,
};

const classesFor = (sceneKey: string): string[] => Object.values(sceneClassMapping[sceneKey]);

const mappingText = (sceneKey: string): string => {
  const m = sceneClassMapping[sceneKey];
  return `Shape guide for this training scene: car-shaped wedge = ${m.Vehicle}; upright capsule = ${m.Pedestrian}; ` +
    `L-shaped object = ${m.Cyclist}; tall thin cylinder = ${m.Pole}. Do not box buildings or trees.`;
};

const base = (code: string): TaskTemplateContent => {
  const t = foundationTasks.find((x) => x.code === code);
  if (!t) throw new Error(`Missing foundation task ${code}`);
  return t;
};

const REQ_ATTRS = ['occlusion', 'motion'];
const THR = { centerErrorM: 0.3, iou3d: 0.5, yawErrorDeg: 10 };
const ROI_NOTE = 'ROI rules (measured from the scene origin): ROI1 0-5 m needs perfect boxes, ROI2 0-10 m needs everything labelled, ROI3 beyond 10 m is good-effort and optional if points are poor.';
const ACTIVITY = 'Set the optional Activity attribute on every Human (for example Standing).';
const IMG_RULE = 'Project rule to remember: on real data the 3D box must also align with the 2D image. Synthetic scenes have no images.';

const t03: TaskTemplateContent = {
  ...base('TASK-03'),
  code: 'TONIC-03',
  title: 'Tonic: Basic Cuboid',
  description: `Draw Tonic-standard cuboids with full body volume and set required fields. ${mappingText('demo-cuboid-basic')} ${ROI_NOTE} ${IMG_RULE}`,
  objective: 'Box every object with the Tonic class, full volume, and required occlusion and motion attributes.',
  learningOutcome: 'You apply Tonic cuboid rules: one box per object, all points inside, length along travel direction.',
  prerequisiteCode: undefined,
  estimatedMinutes: 30,
  order: 1,
  instructions: [
    'Find every object in the Top view; relabel into Tonic classes using the shape guide.',
    'Draw one cuboid per object; never place two boxes on one object.',
    'Fit boxes so all points sit inside, including a Human\'s full body from feet to head.',
    'Align the box length axis with the direction of travel; height axis points up.',
    'Set Occlusion and Motion on every box; also set Activity on Humans.',
    'Label ROI1 and ROI2 objects first and most carefully, then ROI3.',
    'Check every box in Top, Front and Side views, then submit.',
  ],
  requiredOutput: ['One cuboid per object (10 objects) in Tonic classes', 'Occlusion and Motion on every box', 'Activity on every Human'],
  expectedOutput:
    'Ten cuboids: four Forklifts, three Humans, one Cart and two Safety Barriers. Each box holds every object point, sits on the geometric center, and follows the travel direction. Occlusion is None and Motion is Static on all objects. Humans have an Activity set. No boxes on buildings or trees.',
  sceneKey: 'demo-cuboid-basic',
  labelSchemaOverride: classesFor('demo-cuboid-basic'),
  requiredAttributes: REQ_ATTS(),
  scoringCriteria: { autoMetrics: ['classMatch', 'centerError', 'iou3d', 'yawError'], thresholds: THR, reviewerWeight: 0.5 },
  reviewerRubric: [classAccuracy(15), boxFit(30), orientation(15), completeness(15), requiredFields(25)],
  commonMistakes: [
    'Boxing only the torso of a Human instead of the full body volume.',
    'Leaving Occlusion or Motion blank because it looks obvious.',
    'Keeping the neutral label names instead of relabelling to Tonic classes.',
    'Placing two boxes on one object to cover a long shape.',
    'Aligning the length axis with the nearest grid line rather than the object\'s direction.',
    'Skipping a nearby object because it is small.',
  ],
  hints: [
    'Use the shape guide: wedge is Forklift, capsule is Human, L-shape is Cart, thin cylinder is Safety Barrier.',
    'For Humans, check the Side view so the box spans from the ground to the top of the head.',
    'Occlusion: None means more than 90 percent visible; Motion is Static in this scene.',
  ],
  reviewerErrorTags: reviewerErrorTags,
};
function REQ_ATTS() { return [...REQ_ATTRS]; }

const t04: TaskTemplateContent = {
  ...base('TASK-04'),
  code: 'TONIC-04',
  title: 'Tonic: Pre-label Review',
  description: `Review pre-labels and fix every box that breaks Tonic rules. Pre-labels use neutral names, so relabel into Tonic classes. ${mappingText('demo-cuboid-precision')} ${ROI_NOTE}`,
  objective: 'Treat pre-labels as untrusted: correct fit, center and heading, and leave correct boxes alone.',
  learningOutcome: 'You review pre-labels to Tonic standard instead of accepting them.',
  prerequisiteCode: 'TONIC-03',
  estimatedMinutes: 25,
  order: 2,
  instructions: [
    'Treat every pre-label as unchecked; inspect each in Top, Front and Side views.',
    'Relabel each box into its Tonic class using the shape guide.',
    'Fix size so all points are inside with no excess margin.',
    'Fix center to the geometric center and yaw to the direction of travel.',
    'Set Occlusion and Motion on every box, and Activity on Humans.',
    'Leave boxes that already fit untouched, then submit.',
  ],
  requiredOutput: ['Six reviewed cuboids in Tonic classes', 'Occlusion and Motion on every box'],
  expectedOutput:
    'Six boxes fit to Tonic standard: the oversized and undersized Forklifts resized, the Human and the Cart re-centred, the misaligned Forklift and the Cart rotated to heading, and the Safety Barrier box left as is. All are relabelled into Tonic classes with Occlusion and Motion set.',
  sceneKey: 'demo-cuboid-precision',
  labelSchemaOverride: classesFor('demo-cuboid-precision'),
  requiredAttributes: REQ_ATTS(),
  useInitialAnnotation: true,
  scoringCriteria: { autoMetrics: ['classMatch', 'centerError', 'iou3d', 'yawError'], thresholds: { ...THR, centerErrorM: 0.2, iou3d: 0.6 }, reviewerWeight: 0.5 },
  reviewerRubric: [
    boxFit(30), orientation(20),
    criterion('prelabel_scrutiny', 'Pre-label scrutiny', 'Flawed pre-labels corrected; correct one preserved.', 20,
      'Pre-labels accepted or correct box damaged.', 'Most flaws fixed; one missed or one correct box disturbed.', 'All flaws fixed and the correct box untouched.'),
    classAccuracy(10), requiredFields(20),
  ],
  commonMistakes: [
    'Accepting the pre-labels because they look roughly right.',
    'Fixing size but leaving the heading error on the misaligned Forklift.',
    'Moving the Safety Barrier box that was already correct.',
    'Forgetting to relabel from neutral names into Tonic classes.',
    'Leaving Occlusion or Motion blank on pre-labelled boxes.',
    'Cropping a Human box to the torso while resizing.',
  ],
  hints: [
    'Pre-labels often start close; check each box against the outermost points.',
    'Yaw errors show as a box edge crossing the points at an angle in the Top view.',
    'One box needs no geometry change; it still needs its Tonic class and attributes.',
  ],
  reviewerErrorTags: reviewerErrorTags,
};

const t05: TaskTemplateContent = {
  ...base('TASK-05'),
  code: 'TONIC-05',
  title: 'Tonic: Occlusion and Partial Objects',
  description: `Annotate occluded and sparse objects to Tonic rules: center on the whole object, not just visible points. ${mappingText('demo-occlusion')} ${ROI_NOTE} ${IMG_RULE}`,
  objective: 'Box partial objects at the full-object center and set Occlusion per the Tonic thresholds.',
  learningOutcome: 'You apply Tonic occlusion states and ROI tiers to partial and distant objects.',
  prerequisiteCode: 'TONIC-04',
  estimatedMinutes: 35,
  order: 3,
  instructions: [
    'Find every object including faint ones; relabel into Tonic classes using the shape guide.',
    'Place the box center at the geometric center of the whole object, including hidden parts.',
    'Set Occlusion: None above 90 percent visible, Partial 30-90, Heavy below 30.',
    'Set Motion on every box and Activity on Humans.',
    'Flag objects whose points are too sparse to judge, with a reason.',
    'Prioritise ROI1 and ROI2 objects; ROI3 objects are optional if points are poor.',
  ],
  requiredOutput: ['One cuboid per object (8 objects) in Tonic classes', 'Occlusion and Motion on every box', 'Flags with reasons on sparse objects'],
  expectedOutput:
    'Eight cuboids: four Forklifts, two Humans, one Cart and one Safety Barrier. Two heavily hidden objects (a Forklift and a Human) are Heavy, two (a Forklift and the Cart) are Partial, others None. Centers sit on the whole-object center, not on the visible half. Distant sparse Forklifts and the Human are boxed and flagged with reasons. Motion is Static throughout.',
  sceneKey: 'demo-occlusion',
  labelSchemaOverride: classesFor('demo-occlusion'),
  requiredAttributes: REQ_ATTS(),
  scoringCriteria: { autoMetrics: ['classMatch', 'centerError', 'iou3d', 'yawError'], thresholds: { ...THR, centerErrorM: 0.5, iou3d: 0.4 }, reviewerWeight: 0.6 },
  reviewerRubric: [
    boxFit(20), attributesCorrect(20),
    criterion('full_object_center', 'Full-object center', 'Box center is the center of the whole object, with hidden parts inferred from evidence.', 20,
      'Boxes centred on the visible half only, or extended without evidence.', 'One box centred on visible points only.', 'Centers sit on the full object, extension supported by edges.'),
    requiredFields(20), flagging(20),
  ],
  commonMistakes: [
    'Centering the box on the visible half of an occluded Forklift.',
    'Using the Safety Barrier or building as a clue to stretch a box into empty space.',
    'Marking Occlusion as None for a Forklift with half its points missing.',
    'Leaving ROI2 objects unlabelled because they have few points.',
    'Flagging with a reason like "unsure" instead of naming the missing evidence.',
    'Forgetting Motion on boxes that obviously are not moving.',
  ],
  hints: [
    'Find the visible edge first, then use class-typical size to complete the box.',
    'Estimate the visible share: under 30 percent is Heavy, 30-90 is Partial.',
    'Scan the outer area in the Top view for faint dots; they can be real objects.',
  ],
  reviewerErrorTags: reviewerErrorTags,
};

const t08: TaskTemplateContent = {
  ...base('TASK-08'),
  code: 'TONIC-08',
  title: 'Tonic: Multi-frame Tracking',
  description: `Track moving objects over 8 frames with persistent unsigned-integer track IDs. ${mappingText('demo-sequence')} ${ROI_NOTE}`,
  objective: 'Box every object in every frame where it appears, with one persistent ID and correct Motion.',
  learningOutcome: 'You keep track IDs persistent and never reassign them within a sequence.',
  prerequisiteCode: 'TONIC-05',
  estimatedMinutes: 45,
  order: 4,
  instructions: [
    'Step through all eight frames and note which objects move.',
    'In frame one, box each object, relabel into Tonic classes, and give each a unique unsigned integer ID.',
    'In each next frame, move boxes to follow their objects and keep the same IDs.',
    'When the Human vanishes, add no box; on return reuse its original ID.',
    'Set Motion to Moving for moving objects and Static for the Safety Barrier.',
    'Replay the sequence to confirm no ID is reused for another object.',
  ],
  requiredOutput: ['Boxes for 4 objects in each frame they appear', 'One persistent track ID per object', 'Occlusion and Motion on every box'],
  expectedOutput:
    'The AGV / AMR, Cart and Safety Barrier are boxed in all eight frames; the Human in six, with no box in the two-frame gap. IDs are unsigned integers, unique per object, and never change, including the Human after returning. Motion is Moving for the AGV / AMR, Human and Cart, Static for the Safety Barrier. Boxes follow each object closely; the building is not boxed.',
  sceneKey: 'demo-sequence',
  labelSchemaOverride: classesFor('demo-sequence'),
  requiredAttributes: REQ_ATTS(),
  scoringCriteria: { autoMetrics: ['classMatch', 'centerError', 'trackContinuity'], thresholds: { centerErrorM: 0.5, trackContinuity: 0.9 }, reviewerWeight: 0.5 },
  reviewerRubric: [
    criterion('track_id_persistence', 'Track ID persistence', 'Each object keeps one unsigned-integer ID in every frame and no ID is reused.', 35,
      'Several ID changes, swaps or reuse.', 'One ID change or one reuse.', 'IDs persistent across all frames, including after the gap.'),
    requiredFields(20),
    criterion('gap_handling', 'Gap handling', 'No box during the absence; original ID on return.', 15,
      'Box held in the gap or new ID after.', 'One of the two correct.', 'Both correct.'),
    boxFit(20), classAccuracy(10),
  ],
  commonMistakes: [
    'Assigning the Human a new ID after it reappears.',
    'Reusing the ID of the missing Human for another object during the gap.',
    'Leaving Motion as Static on the AGV / AMR because frame one looks still.',
    'Copying boxes forward without moving them to follow the objects.',
    'Swapping IDs between the Cart and Human when they pass close.',
    'Labelling the moving car-shaped object as Forklift instead of AGV / AMR.',
  ],
  hints: [
    'Choose IDs in frame one and write them down: they never change afterward.',
    'Moving objects in this scene are the car-shaped one, the capsule and the L-shape.',
    'After the gap, the Human reappears further along its path of travel.',
  ],
  reviewerErrorTags: reviewerErrorTags,
};

const t09: TaskTemplateContent = {
  ...base('TASK-09'),
  code: 'TONIC-09',
  title: 'Tonic: Pre-label Error Detection',
  description: `Audit pre-labels for planted errors, flag and fix each, and relabel into Tonic classes. Pre-labels use neutral names. ${mappingText('demo-errors')}`,
  objective: 'Find every error in the pre-labels using Tonic rules, not just obvious ones.',
  learningOutcome: 'You audit pre-labels critically against class, fit, heading, completeness and uniqueness rules.',
  prerequisiteCode: 'TONIC-05',
  estimatedMinutes: 30,
  order: 5,
  instructions: [
    'Inspect every pre-label in three views against the shape guide.',
    'Flag each wrong box with the matching error tag and a one-line reason.',
    'Fix class, size, heading; delete duplicates; add boxes for missing objects.',
    'Relabel all kept boxes into Tonic classes and set Occlusion and Motion.',
    'Leave correct boxes unchanged apart from relabelling, then submit.',
  ],
  requiredOutput: ['Flag, tag and reason for each error', 'All errors corrected', 'Tonic classes plus Occlusion and Motion on every box'],
  expectedOutput:
    'Five errors found and fixed: a Forklift labelled as Human, a Cart box about 70 degrees off heading, a duplicate box on a Forklift, an oversized Forklift box, and a Human with no box. Each has a tag and reason. The correct Forklift and Safety Barrier keep their geometry, and all boxes carry Tonic classes with Occlusion and Motion.',
  sceneKey: 'demo-errors',
  labelSchemaOverride: classesFor('demo-errors'),
  requiredAttributes: REQ_ATTS(),
  errorDetection: {
    plantedErrorCount: 5,
    errorTags: tagsByKey(['wrong_class', 'yaw_misaligned', 'missing_object', 'duplicate', 'box_too_large']),
  },
  scoringCriteria: { autoMetrics: ['errorsFound', 'classMatch', 'iou3d'], thresholds: { iou3d: 0.5 }, reviewerWeight: 0.5 },
  reviewerRubric: [
    criterion('errors_found', 'Errors found', 'Planted errors flagged with the right tag.', 35,
      'Two or fewer found.', 'Three or four found.', 'All five found and tagged correctly.'),
    criterion('prelabel_fixes', 'Corrections to Tonic standard', 'Each error fixed so the box meets Tonic rules.', 25,
      'Most errors unfixed.', 'Some fixes incomplete.', 'All fixed.'),
    requiredFields(20),
    criterion('no_new_errors', 'No new errors', 'Correct boxes left alone and none added wrongly.', 20,
      'Several new errors.', 'One correct box disturbed.', 'No new errors.'),
  ],
  commonMistakes: [
    'Missing the Human that has no box because only existing boxes were checked.',
    'Deleting the better-fitting box of the duplicate pair.',
    'Fixing the wrong-class box by relabelling to a class that does not match its shape.',
    'Leaving the Cart heading wrong because its center looked correct.',
    'Forgetting Occlusion and Motion on the boxes that were already right.',
    'Flagging correct pre-labels as errors.',
  ],
  hints: [
    'Check class, size, center, heading on every pre-label, and count objects against boxes.',
    'Two boxes nearly on top of each other mean one is a duplicate.',
    'Use the shape guide: a car-shaped wedge can never be a Human.',
  ],
  reviewerErrorTags: reviewerErrorTags,
};

const t10: TaskTemplateContent = {
  ...base('TASK-10'),
  code: 'TONIC-10',
  title: 'Tonic: Final Practical',
  description: `Annotate a full scene to Tonic standard with all required fields. ${mappingText('demo-final')} ${ROI_NOTE} ${IMG_RULE}`,
  objective: 'Complete a whole scene to Tonic rules, unaided.',
  learningOutcome: 'You deliver complete, tightly fitted Tonic cuboids with every required field.',
  prerequisiteCode: 'TONIC-09',
  estimatedMinutes: 50,
  order: 6,
  instructions: [
    'List every object from the Top view and relabel into Tonic classes using the shape guide.',
    'Box each object tightly with full volume, one box per object, length along travel direction.',
    'Set Occlusion and Motion on every box, and Activity on every Human.',
    'Center partially hidden objects on the whole object; flag sparse ones with a reason.',
    'Label ROI1 and ROI2 objects completely; ROI3 objects as good effort.',
    'Review every box in three views, fix issues, then submit.',
  ],
  requiredOutput: ['One cuboid per object (12 objects) in Tonic classes', 'Occlusion and Motion on every box', 'Activity on Humans', 'Flags with reasons where needed'],
  expectedOutput:
    'Twelve cuboids: five Forklifts, three Humans, two Carts and two Safety Barriers, none on the building or trees. Boxes are tight with full volume and correct heading. Occlusion is Partial on the Forklift near x 16, y -12, Heavy on the Forklift near x -6, y -3 and the Human near x 5, y 14, None elsewhere; Motion is Static throughout. Activity is set on Humans. The far sparse Forklift near x 28, y 14 is boxed and flagged.',
  sceneKey: 'demo-final',
  labelSchemaOverride: classesFor('demo-final'),
  requiredAttributes: REQ_ATTS(),
  scoringCriteria: { autoMetrics: ['classMatch', 'centerError', 'iou3d', 'yawError'], thresholds: { ...THR, centerErrorM: 0.4 }, reviewerWeight: 0.6 },
  reviewerRubric: [
    classAccuracy(10), boxFit(25), orientation(10), completeness(15), requiredFields(20),
    criterion('roi_priority', 'ROI priority', 'Nearest objects are perfect and ROI3 objects are handled sensibly.', 10,
      'Near objects sloppy or ignored.', 'Near objects good but not perfect.', 'ROI1 near perfect, ROI2 complete, ROI3 reasonable.'),
    flagging(10),
  ],
  commonMistakes: [
    'Leaving Motion or Occlusion blank on some boxes.',
    'Boxing a Human from shoulders to knees instead of full body.',
    'Skipping the far sparse Forklift without a flag.',
    'Keeping neutral class names on some boxes.',
    'Sloppy boxes on ROI1 objects while polishing distant ones.',
    'Boxing a tree or the building.',
  ],
  hints: [
    'Tick off every object from your list before submitting.',
    'Fit ROI1 objects first and tightest; they carry the strictest quality bar.',
    'Last pass: Top view for heading, Side view for height, then check required fields.',
  ],
  reviewerErrorTags: reviewerErrorTags,
};

export const tonicTasks: TaskTemplateContent[] = [t03, t04, t05, t08, t09, t10];
