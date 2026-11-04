export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type AnnotationType =
  | 'INSPECTION' | 'IDENTIFICATION' | 'CUBOID' | 'SEMANTIC_SEG'
  | 'INSTANCE_SEG' | 'TRACKING' | 'ERROR_DETECTION' | 'MIXED';

export interface RubricCriterion {
  key: string;
  name: string;
  description: string;
  /** Weights sum to 100 per task. */
  weight: number;
  levels: { score: number; label: string; description: string }[];
}

export interface ScoringCriteria {
  autoMetrics: (
    | 'classMatch' | 'centerError' | 'iou3d' | 'yawError' | 'pointLabelAccuracy'
    | 'instanceSeparation' | 'trackContinuity' | 'errorsFound' | 'checkpointsDone' | 'answersProvided'
  )[];
  thresholds?: Record<string, number>;
  /** 0..1 share of the final score that is reviewer judgement. */
  reviewerWeight: number;
}

export interface InspectionQuestion {
  key: string;
  prompt: string;
  kind: 'free_text' | 'single_select';
  options?: string[];
  expectedAnswer?: string | number;
  rubricHint: string;
}

export interface InspectionCheckpoint {
  key: string;
  label: string;
  kind: 'control_used' | 'preset_viewed' | 'region_located';
  control?: string;
  preset?: string;
  region?: { center: [number, number, number]; radiusM: number };
}

export interface ErrorTag {
  key: string;
  name: string;
  description: string;
}

export interface TaskTemplateContent {
  code: string;
  title: string;
  description: string;
  objective: string;
  learningOutcome: string;
  difficulty: Difficulty;
  prerequisiteCode?: string;
  annotationType: AnnotationType;
  estimatedMinutes: number;
  /** Numbered steps, concrete, <= 20 words each. */
  instructions: string[];
  requiredOutput: string[];
  /** One paragraph. */
  expectedOutput: string;
  /** Demo asset key. */
  sceneKey: string;
  trackKey?: string;
  isRequiredForCertification: boolean;
  order: number;
  /** Class names allowed in this task; omit = program schema. */
  labelSchemaOverride?: string[];
  requiredAttributes?: string[];
  inspection?: { checkpoints: InspectionCheckpoint[]; questions: InspectionQuestion[] };
  identification?: {
    targets: { refCuboidId: string; hint: string }[];
    allowFlag: true;
    questions: InspectionQuestion[];
  };
  errorDetection?: { plantedErrorCount: number; errorTags: ErrorTag[] };
  /** Load the scene's initialAnnotation as the starting point. */
  useInitialAnnotation: boolean;
  scoringCriteria: ScoringCriteria;
  reviewerRubric: RubricCriterion[];
  commonMistakes: string[];
  hints: string[];
  /** Tags a reviewer can pick when requesting revision. */
  reviewerErrorTags: ErrorTag[];
}
