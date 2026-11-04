import type { NormalizedCloud, UpAxis } from "@/lib/pointcloud/types";

export type ColorMode = "height" | "intensity" | "rgb" | "label" | "flat";
export type NavigationProfile = "orbit" | "fly";
export type Preset = "top" | "front" | "side" | "perspective";
export type ControlKind = "rotate" | "pan" | "zoom" | "move" | "elevate" | "preset" | "reset" | "target";

export interface CuboidOverlay {
  id: string;
  label?: string;
  /** Data frame: center xyz, dims [length (heading), width, height-along-up], yaw radians about the up axis. */
  center: [number, number, number];
  dims: [number, number, number];
  yaw: number;
  /** CSS colour; defaults to labelColors[label] or a hash colour. */
  color?: string;
  selectable?: boolean;
  /** Dashed edges (used for the reference overlay in Review). */
  dashed?: boolean;
}

export interface CameraState {
  /** All in the data frame. */
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  profile: NavigationProfile;
}

export interface PointPick {
  index: number;
  position: [number, number, number];
  distance: number;
}

export interface FrameSource {
  frameCount: number;
  load: (index: number) => Promise<NormalizedCloud>;
}

export interface ViewerApi {
  setPreset(p: Preset): void;
  resetCamera(): void;
  fitToBounds(): void;
  setPointSize(n: number): void;
  setColorMode(m: ColorMode): void;
  setFrame(i: number): Promise<void>;
  getCamera(): CameraState;
  screenshot(): string;
  setHiddenLabels(s: Set<number>): void;
  /** Escape hatch for tools built on the engine (Annotate stage). */
  getEngine(): import("./ViewerEngine").ViewerEngine;
}

export interface EngineHandlers {
  onSelect?: (id: string | null) => void;
  onCameraChange?: (c: CameraState) => void;
  onControlUsed?: (kind: ControlKind, detail?: string) => void;
  onFrameChange?: (index: number, cloud: NormalizedCloud) => void;
  onPointPick?: (pick: PointPick | null) => void;
  onError?: (err: Error) => void;
}

export interface EngineOptions {
  upAxis?: UpAxis;
  navigationProfile?: NavigationProfile;
  pointSize?: number;
  showAxes?: boolean;
  showGrid?: boolean;
  colorMode?: ColorMode;
  labelColors?: Record<number, string>;
}
