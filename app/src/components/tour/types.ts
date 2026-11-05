export type GlyphId =
  | "mouse-left" | "mouse-right" | "wheel" | "trackpad-scroll" | "trackpad-pinch"
  | "shift" | "cmd" | "ctrl" | "alt"
  | "arrow-left" | "arrow-right" | "arrow-up" | "arrow-down" | "click";

/** A keycap: plain text ("W", "Ctrl+Z"), a glyph id, or "+" for a separator. */
export type KeycapSpec = string | { glyph: GlyphId };

export type InputDeviceKey = "mouse" | "trackpad";

export type Completion =
  /** Viewer control used (event name `control:<control>`); `needs` = details that must all be seen (e.g. W A S D). */
  | { kind: "control"; control: string; count?: number; needs?: string[] }
  /** Any app event emitted with emitTourEvent(name). */
  | { kind: "event"; event: string; count?: number; needs?: string[] }
  /** The user clicks the spotlighted element. */
  | { kind: "click-target" }
  /** The user picks one of `choice.options`. */
  | { kind: "choice" }
  /** Informational step: Next is enabled straight away. */
  | { kind: "manual" }
  | { kind: "timer"; ms: number }
  | { kind: "all"; of: Completion[] };

export interface TourStep {
  key: string;
  title: string;
  /** One line; may include **bold**. */
  instruction: string;
  /** Per input device override (navigation tour). */
  instructionBy?: Partial<Record<InputDeviceKey, string>>;
  keycaps?: KeycapSpec[];
  keycapsBy?: Partial<Record<InputDeviceKey, KeycapSpec[]>>;
  /** Spotlight a `[data-tour="..."]` element. */
  spotlight?: { selector: string; padding?: number };
  choice?: { options: { key: string; label: string; icon?: "mouse" | "trackpad" }[]; onChoose?: (key: string) => void };
  complete: Completion;
  allowSkip?: boolean;
  placement?: "bottom-center" | "near-target";
  /** Called when the step becomes current (e.g. switch the viewer to fly mode). */
  onEnter?: () => void;
  /** Step is dropped from the run when this returns false (e.g. no frames, no required attributes). */
  when?: (ctx: TourContext) => boolean;
}

export type TourContext = Record<string, unknown>;

export interface TourDefinition {
  key: string;
  title: string;
  intro: { heading: string; body: string; estimatedMinutes: number; previewKind?: "viewer" | "none" };
  steps: TourStep[];
  /** "global": offered in the Help menu on every page; "page": only on pages that register it. */
  scope?: "global" | "page";
  /** Restrict to these roles (default: everyone). */
  roles?: ("TRAINEE" | "REVIEWER" | "ADMIN")[];
}

export type TourStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
