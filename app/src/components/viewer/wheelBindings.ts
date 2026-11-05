import type { InputDevice } from "@/lib/tour/inputDevice";

export type WheelAction = "zoom" | "rotate" | "pan";

export interface WheelFields { ctrlKey: boolean; shiftKey: boolean; deltaX: number; deltaY: number }

/**
 * Maps a wheel event to a camera action.
 * - mouse: the wheel always zooms (existing behaviour).
 * - trackpad: pinch (browsers report it as ctrl+wheel) zooms, shift + two-finger scroll pans, plain two-finger scroll rotates.
 */
export function wheelAction(device: InputDevice, e: WheelFields): WheelAction {
  if (device === "mouse") return "zoom";
  if (e.ctrlKey) return "zoom";
  if (e.shiftKey) return "pan";
  return "rotate";
}
