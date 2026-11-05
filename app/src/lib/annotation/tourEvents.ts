import type { EditorAction } from "./reducer";

/**
 * App-event names (for guided tours) that an editor action represents. The raw edit type is always included
 * (`addCuboid`, `addFlag`, `setAnswer`...); patches are classified by what they change.
 */
export function tourEventsForAction(a: EditorAction): string[] {
  switch (a.type) {
    case "select": return a.id ? ["select"] : [];
    case "undo": case "redo": return [a.type];
    case "reset": return [];
    case "edit": {
      const e = a.edit;
      const out: string[] = [e.type];
      if (e.type === "patchCuboid") {
        const keys = Object.keys(e.patch);
        if (keys.includes("dims")) out.push("resizeCuboid");
        else if (keys.includes("center")) out.push("moveCuboid");
        if (keys.includes("yaw")) out.push("rotateCuboid");
        if (keys.includes("label")) out.push("setLabel");
        if (keys.includes("trackId")) out.push("setTrackId");
      } else if (e.type === "setPointLabels") out.push("paintPoints");
      return out;
    }
  }
}
