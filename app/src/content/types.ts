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
      widget: "cloud" | "nav" | "cuboid" | "schema";
      sceneKey?: string;
      checkpoints: { key: string; label: string }[];
      instructions: string;
    };

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
