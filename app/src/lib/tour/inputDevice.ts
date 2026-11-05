export type InputDevice = "mouse" | "trackpad";
const KEY = "navInputDevice";

/** Navigation input device preference (localStorage only; defaults to mouse). */
export function getInputDevice(): InputDevice {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "trackpad" ? "trackpad" : "mouse"; } catch { return "mouse"; }
}

export function setInputDevice(d: InputDevice): void {
  try { localStorage.setItem(KEY, d); } catch { /* storage unavailable */ }
}
