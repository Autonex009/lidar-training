import type { Cuboid } from "./types";

export const NUDGE_STEP = 0.05;
export const YAW_STEP = (2 * Math.PI) / 180;

const wrap = (a: number) => {
  let y = a % (2 * Math.PI);
  if (y > Math.PI) y -= 2 * Math.PI; else if (y < -Math.PI) y += 2 * Math.PI;
  return y;
};

export interface NudgeKey { key: string; shift: boolean; ctrl: boolean }

/**
 * Keyboard edit of a box. Arrows move the centre (data frame x/y, PageUp/PageDown = z); with Shift,
 * Up/Down change length, Left/Right change width and PageUp/PageDown height; Q/E rotate yaw by 2
 * degrees. Ctrl multiplies by 10. Returns null when the key does nothing.
 */
export function nudgeCuboid(c: Cuboid, k: NudgeKey): Partial<Cuboid> | null {
  const m = k.ctrl ? 10 : 1;
  const step = NUDGE_STEP * m;
  const key = k.key.length === 1 ? k.key.toLowerCase() : k.key;
  if (key === "q") return { yaw: wrap(c.yaw + YAW_STEP * m) };
  if (key === "e") return { yaw: wrap(c.yaw - YAW_STEP * m) };
  const move = (dx: number, dy: number, dz: number) => ({ center: [c.center[0] + dx, c.center[1] + dy, c.center[2] + dz] as Cuboid["center"] });
  const size = (dl: number, dw: number, dh: number) => ({ dims: [Math.max(0.1, c.dims[0] + dl), Math.max(0.1, c.dims[1] + dw), Math.max(0.1, c.dims[2] + dh)] as Cuboid["dims"] });
  if (k.shift) {
    switch (key) {
      case "ArrowUp": return size(step, 0, 0);
      case "ArrowDown": return size(-step, 0, 0);
      case "ArrowRight": return size(0, step, 0);
      case "ArrowLeft": return size(0, -step, 0);
      case "PageUp": return size(0, 0, step);
      case "PageDown": return size(0, 0, -step);
    }
    return null;
  }
  switch (key) {
    case "ArrowUp": return move(0, step, 0);
    case "ArrowDown": return move(0, -step, 0);
    case "ArrowRight": return move(step, 0, 0);
    case "ArrowLeft": return move(-step, 0, 0);
    case "PageUp": return move(0, 0, step);
    case "PageDown": return move(0, 0, -step);
  }
  return null;
}
