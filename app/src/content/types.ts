export type LessonKind =
  | "TEXT"
  | "INTERACTIVE_CLOUD"
  | "INTERACTIVE_NAV"
  | "INTERACTIVE_CUBOID"
  | "INTERACTIVE_SCHEMA";

export type LessonBlock =
  | { type: "explain"; heading?: string; body: string[] }
  | { type: "bullets"; heading: string; items: string[] }
  | { type: "remember"; items: string[] }
  | { type: "mistakes"; items: string[] }
  | { type: "example"; heading: string; body: string[]; imageFile?: string }
  | { type: "figure"; kind: "svg"; id: string; caption: string }
  | {
      type: "interactive";
      widget: InteractiveWidget;
      sceneKey?: string;
      /** Keys must be unique within a lesson (they are persisted per lesson). */
      checkpoints: { key: string; label: string }[];
      instructions: string;
      /** find-object */
      find?: FindConfig;
      /** decision-cards */
      cards?: CardsConfig;
      /** spot-the-error */
      spot?: SpotConfig;
      /** views-drill */
      drill?: DrillConfig;
    };

export type InteractiveWidget =
  | "cloud" | "nav" | "cuboid" | "schema"
  | "cuboid-live" | "find-object" | "decision-cards" | "spot-the-error" | "views-drill";

/** Where a find-object click counts as correct. Resolved against the demo scene's reference cuboids. */
export type FindTarget =
  | { kind: "object"; label: string; /** Index among reference cuboids of that label; omit for "any of them". */ nth?: number; /** Pick the one closest to the sensor. */ nearest?: boolean }
  | { kind: "region"; center: [number, number]; radius: number }
  | { kind: "ground" };

export interface FindPrompt {
  id: string;
  /** "Click the ..." */
  text: string;
  target: FindTarget;
  /** Shown after two wrong clicks. */
  hint: string;
  /** Shown after a correct click. */
  why: string;
  /** m3: after the click, the learner must pick the label (one of `options`). */
  label?: { options: string[]; correct: string };
}

export interface FindConfig {
  prompts: FindPrompt[];
  /** Fixed seed for the prompt order. */
  seed: number;
}

export interface DecisionCard {
  id: string;
  title: string;
  scenario: string;
  figure?: string;
  choices: { label: string; why: string }[];
  /** Index into `choices`. */
  correct: number;
}

export interface CardsConfig {
  cards: DecisionCard[];
  /** Percent of cards that must be right (default 80). */
  passPct?: number;
}

export interface SpotPrompt {
  id: string;
  text: string;
  /** Ids in the scene's initial annotation that count as the answer. */
  targets: string[];
  hint: string;
  why: string;
}

export interface SpotConfig {
  prompts: SpotPrompt[];
  seed?: number;
}

export interface DrillConfig {
  /** Class to count in top view. */
  countLabel: string;
  /** Classes offered in the "tallest" question. */
  tallestOptions: string[];
}

export interface LessonContent {
  kind: LessonKind;
  title: string;
  estimatedMinutes: number;
  blocks: LessonBlock[];
}

export type QuizQuestionKind =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "INTERPRETATION"
  | "IDENTIFY_INCORRECT"
  | "CHOOSE_DECISION"
  | "IDENTIFY_OBJECT";

export interface QuizQuestionContent {
  kind: QuizQuestionKind;
  prompt: string;
  /** Omitted for TRUE_FALSE (UI shows True/False). */
  options?: string[];
  /** Option index for choice questions; boolean for TRUE_FALSE. */
  correctAnswer: number | boolean;
  explanation: string;
  media?: { kind: "svg"; id: string } | { kind: "image"; file: string };
}

export interface ModuleContent {
  key: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  isMandatory: boolean;
  trackKey?: string;
  lessons: LessonContent[];
  quiz: { passingScore?: number; questions: QuizQuestionContent[] };
}

export interface ProgramContent {
  slug: string;
  modules: ModuleContent[];
  finalAssessment: QuizQuestionContent[];
}
