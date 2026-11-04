import type { ErrorTag, RubricCriterion } from './types';

/** Shared reviewer tags. Keys are stable; the seed and reviewer UI reference them. */
export const reviewerErrorTags: ErrorTag[] = [
  { key: 'wrong_class', name: 'Wrong class', description: 'Box carries the wrong class label for the object.' },
  { key: 'box_too_large', name: 'Box too large', description: 'Box has clear empty margin beyond the object points.' },
  { key: 'box_too_small', name: 'Box too small', description: 'Box is smaller than the object extent.' },
  { key: 'box_cuts_points', name: 'Box cuts points', description: 'Object points fall outside the box.' },
  { key: 'yaw_misaligned', name: 'Yaw misaligned', description: 'Box length axis does not follow the object heading.' },
  { key: 'center_offset', name: 'Center offset', description: 'Box center is shifted from the object center.' },
  { key: 'missing_object', name: 'Missing object', description: 'A required object has no box.' },
  { key: 'duplicate', name: 'Duplicate', description: 'More than one box on the same object.' },
  { key: 'invented_geometry', name: 'Invented hidden geometry', description: 'Box extends far into space with no point evidence or class-size support.' },
  { key: 'missing_attribute', name: 'Missing attribute', description: 'A required attribute is not set.' },
  { key: 'wrong_attribute', name: 'Wrong attribute', description: 'An attribute value does not match the evidence.' },
  { key: 'id_switch', name: 'ID switch', description: 'Track ID changed or was swapped between objects across frames.' },
  { key: 'wrong_point_labels', name: 'Wrong point labels', description: 'Points carry the wrong class or instance.' },
  { key: 'boundary_bleed', name: 'Boundary bleed', description: 'Label spills across an object edge onto neighbours or ground.' },
  { key: 'uncertain_not_flagged', name: 'Uncertain case not flagged', description: 'An ambiguous or sparse object was labelled without a flag and reason.' },
  { key: 'instructions_not_followed', name: 'Instructions not followed', description: 'Task steps or required output were skipped.' },
];

export const tagsByKey = (keys: string[]): ErrorTag[] =>
  keys.map((k) => {
    const t = reviewerErrorTags.find((x) => x.key === k);
    if (!t) throw new Error(`Unknown reviewer error tag "${k}"`);
    return t;
  });

/** Build a 3-level (0/50/100) criterion. */
export const criterion = (
  key: string, name: string, description: string, weight: number,
  low: string, mid: string, high: string,
): RubricCriterion => ({
  key, name, description, weight,
  levels: [
    { score: 0, label: 'Not met', description: low },
    { score: 50, label: 'Partly met', description: mid },
    { score: 100, label: 'Met', description: high },
  ],
});

export const classAccuracy = (weight: number): RubricCriterion => criterion(
  'class_accuracy', 'Class accuracy', 'Each object carries the correct class.', weight,
  'Several objects mislabelled.', 'One or two objects mislabelled.', 'All objects correctly labelled.');

export const boxFit = (weight: number): RubricCriterion => criterion(
  'box_fit', 'Box fit', 'Boxes are tight, contain all object points, and sit on the object center.', weight,
  'Boxes are loose, cut points, or are clearly offset.', 'Most boxes are acceptable; some are loose or slightly offset.', 'Boxes are tight and centred with no cut points.');

export const orientation = (weight: number): RubricCriterion => criterion(
  'orientation', 'Orientation', 'Box length axis follows the object heading.', weight,
  'Several headings are clearly wrong.', 'Headings mostly right; one or two off by more than 10 degrees.', 'All headings within about 10 degrees.');

export const completeness = (weight: number): RubricCriterion => criterion(
  'completeness', 'Completeness', 'Every required object is annotated once, with no duplicates or extras.', weight,
  'Multiple objects missing or duplicated.', 'One object missing, duplicated, or extra.', 'Every required object has exactly one box.');

export const attributesCorrect = (weight: number): RubricCriterion => criterion(
  'attributes', 'Attributes', 'Required attributes are set and match the evidence.', weight,
  'Attributes missing or mostly wrong.', 'Attributes set but one or two do not match.', 'All attributes set and correct.');

export const flagging = (weight: number): RubricCriterion => criterion(
  'flagging', 'Flagging uncertainty', 'Uncertain or sparse objects are flagged with a clear reason instead of guessed.', weight,
  'No flags, or flags without reasons.', 'Some uncertain objects flagged; reasons thin.', 'Uncertain objects flagged with specific, evidence-based reasons.');

export const followsInstructions = (weight: number): RubricCriterion => criterion(
  'instructions', 'Instructions followed', 'All task steps and required outputs are delivered as written.', weight,
  'Major steps skipped.', 'Minor steps skipped.', 'All steps done and output complete.');

export const requiredFields = (weight: number): RubricCriterion => criterion(
  'required_fields', 'Required fields present', 'Every object has class, track ID, occlusion and motion set.', weight,
  'Many objects missing required fields.', 'One or two objects missing a field.', 'All required fields present on every object.');
