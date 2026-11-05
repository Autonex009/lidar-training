import { describe, expect, it } from "vitest";
import { wheelAction } from "./wheelBindings";

const w = (o: Partial<{ ctrlKey: boolean; shiftKey: boolean; deltaX: number; deltaY: number }> = {}) => ({ ctrlKey: false, shiftKey: false, deltaX: 0, deltaY: 10, ...o });

describe("wheel bindings", () => {
  it("mouse: the wheel always zooms (existing behaviour), whatever the modifiers", () => {
    expect(wheelAction("mouse", w())).toBe("zoom");
    expect(wheelAction("mouse", w({ shiftKey: true }))).toBe("zoom");
    expect(wheelAction("mouse", w({ ctrlKey: true }))).toBe("zoom");
  });
  it("trackpad: plain two-finger scroll rotates (horizontal or vertical)", () => {
    expect(wheelAction("trackpad", w())).toBe("rotate");
    expect(wheelAction("trackpad", w({ deltaX: 20, deltaY: 0 }))).toBe("rotate");
  });
  it("trackpad: pinch (ctrl+wheel) zooms, shift+scroll pans, pinch wins over shift", () => {
    expect(wheelAction("trackpad", w({ ctrlKey: true }))).toBe("zoom");
    expect(wheelAction("trackpad", w({ shiftKey: true }))).toBe("pan");
    expect(wheelAction("trackpad", w({ ctrlKey: true, shiftKey: true }))).toBe("zoom");
  });
});
