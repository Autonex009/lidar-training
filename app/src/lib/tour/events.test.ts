import { describe, expect, it, vi } from "vitest";
import { _listenerCount, emitTourEvent, onTourEvent } from "./events";

describe("tour event bus", () => {
  it("delivers name and detail to subscribers and stops after unsubscribe", () => {
    const fn = vi.fn();
    const off = onTourEvent(fn);
    emitTourEvent("addCuboid", { id: 1 });
    expect(fn).toHaveBeenCalledWith({ name: "addCuboid", detail: { id: 1 } });
    off();
    emitTourEvent("addCuboid");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(_listenerCount()).toBe(0);
  });
  it("is safe with no listeners and survives a throwing listener", () => {
    expect(() => emitTourEvent("nobody")).not.toThrow();
    const bad = onTourEvent(() => { throw new Error("boom"); });
    const good = vi.fn();
    const off = onTourEvent(good);
    expect(() => emitTourEvent("x")).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    bad(); off();
  });
});
