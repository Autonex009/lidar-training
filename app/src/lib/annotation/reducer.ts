import { commit, createHistory, redo, replacePresent, undo, type History } from "./history";
import type { AnnotationDocument, Cuboid, ErrorFound, Flag, PointLabelFrame } from "./types";

export type Edit =
  | { type: "addCuboid"; frame: number; cuboid: Cuboid }
  | { type: "patchCuboid"; frame: number; id: string; patch: Partial<Omit<Cuboid, "id">> }
  | { type: "setAttribute"; frame: number; id: string; key: string; value: string }
  | { type: "deleteCuboid"; frame: number; id: string }
  | { type: "copyFrame"; from: number; to: number; newIds: string[] }
  | { type: "interpolate"; trackId: number; from: number; to: number; newIds: string[] }
  | { type: "setAnswer"; key: string; value: string | number }
  | { type: "checkpoint"; key: string }
  | { type: "addFlag"; flag: Flag }
  | { type: "updateFlag"; id: string; reason: string }
  | { type: "removeFlag"; id: string }
  | { type: "addError"; error: ErrorFound }
  | { type: "removeError"; id: string }
  | { type: "setPointLabels"; frame: number; semantic?: string; instance?: string };

/** Edits that do not create undo steps (answers, checkpoints). */
const TRANSIENT = new Set<Edit["type"]>(["setAnswer", "checkpoint"]);

const mapFrame = (doc: AnnotationDocument, frame: number, fn: (c: Cuboid[]) => Cuboid[]): AnnotationDocument => ({
  ...doc, frames: { ...doc.frames, [frame]: { cuboids: fn(doc.frames[frame]?.cuboids ?? []) } },
});

const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
};

export function applyEdit(doc: AnnotationDocument, e: Edit): AnnotationDocument {
  switch (e.type) {
    case "addCuboid": return mapFrame(doc, e.frame, (l) => [...l, e.cuboid]);
    case "patchCuboid": return mapFrame(doc, e.frame, (l) => l.map((c) => (c.id === e.id ? { ...c, ...e.patch } : c)));
    case "setAttribute": return mapFrame(doc, e.frame, (l) => l.map((c) => {
      if (c.id !== e.id) return c;
      const attributes = { ...c.attributes };
      if (e.value) attributes[e.key] = e.value; else delete attributes[e.key];
      return { ...c, attributes };
    }));
    case "deleteCuboid": {
      const flags = doc.flags.filter((f) => f.cuboidId !== e.id);
      const errorsFound = doc.errorsFound?.filter((x) => x.targetAnnotationId !== e.id);
      return { ...mapFrame(doc, e.frame, (l) => l.filter((c) => c.id !== e.id)), flags, ...(errorsFound ? { errorsFound } : {}) };
    }
    case "copyFrame": {
      const src = doc.frames[e.from]?.cuboids ?? [];
      const have = new Set((doc.frames[e.to]?.cuboids ?? []).map((c) => c.trackId).filter((x) => x !== undefined));
      let n = 0;
      const add = src.filter((c) => c.trackId === undefined || !have.has(c.trackId)).map((c) => ({ ...c, id: e.newIds[n++] ?? `${c.id}-${e.to}`, center: [...c.center] as Cuboid["center"], dims: [...c.dims] as Cuboid["dims"], attributes: { ...c.attributes } }));
      return add.length ? mapFrame(doc, e.to, (l) => [...l, ...add]) : doc;
    }
    case "interpolate": {
      const a = doc.frames[e.from]?.cuboids.find((c) => c.trackId === e.trackId);
      const b = doc.frames[e.to]?.cuboids.find((c) => c.trackId === e.trackId);
      if (!a || !b || e.to - e.from < 2) return doc;
      let next = doc, n = 0;
      for (let f = e.from + 1; f < e.to; f++) {
        if (next.frames[f]?.cuboids.some((c) => c.trackId === e.trackId)) continue;
        const t = (f - e.from) / (e.to - e.from);
        const mix = (p: number[], q: number[]) => p.map((v, i) => v + (q[i] - v) * t) as Cuboid["center"];
        const c: Cuboid = { ...a, id: e.newIds[n++] ?? `${a.id}-i${f}`, center: mix(a.center, b.center), dims: mix(a.dims, b.dims), yaw: lerpAngle(a.yaw, b.yaw, t), attributes: { ...a.attributes } };
        next = mapFrame(next, f, (l) => [...l, c]);
      }
      return next;
    }
    case "setAnswer": return { ...doc, answers: { ...doc.answers, [e.key]: e.value } };
    case "checkpoint": return doc.checkpoints[e.key] ? doc : { ...doc, checkpoints: { ...doc.checkpoints, [e.key]: true } };
    case "addFlag": return { ...doc, flags: [...doc.flags, e.flag] };
    case "updateFlag": return { ...doc, flags: doc.flags.map((f) => (f.id === e.id ? { ...f, reason: e.reason } : f)) };
    case "removeFlag": return { ...doc, flags: doc.flags.filter((f) => f.id !== e.id) };
    case "addError": return { ...doc, errorsFound: [...(doc.errorsFound ?? []), e.error] };
    case "removeError": return { ...doc, errorsFound: (doc.errorsFound ?? []).filter((x) => x.id !== e.id) };
    case "setPointLabels": {
      const rest = (doc.pointLabels ?? []).filter((p) => p.frame !== e.frame);
      const prev = (doc.pointLabels ?? []).find((p) => p.frame === e.frame);
      const entry: PointLabelFrame = { frame: e.frame, semantic: e.semantic ?? prev?.semantic, instance: e.instance ?? prev?.instance };
      return { ...doc, pointLabels: [...rest, entry].sort((x, y) => x.frame - y.frame) };
    }
  }
}

export interface EditorState { history: History; selectedId: string | null }
export type EditorAction =
  | { type: "edit"; edit: Edit; select?: string | null }
  | { type: "select"; id: string | null }
  | { type: "undo" } | { type: "redo" }
  | { type: "reset"; doc: AnnotationDocument };

export const initEditor = (doc: AnnotationDocument): EditorState => ({ history: createHistory(doc), selectedId: null });

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case "edit": {
      const next = applyEdit(s.history.present, a.edit);
      const history = TRANSIENT.has(a.edit.type) ? replacePresent(s.history, next) : commit(s.history, next);
      let selectedId = a.select !== undefined ? a.select : s.selectedId;
      if (a.edit.type === "deleteCuboid" && selectedId === a.edit.id) selectedId = null;
      return { history, selectedId };
    }
    case "select": return s.selectedId === a.id ? s : { ...s, selectedId: a.id };
    case "undo": case "redo": {
      const cur = s.history.present;
      const h = a.type === "undo" ? undo(s.history) : redo(s.history);
      if (h === s.history) return s;
      // answers and checkpoints are not undoable: carry them over
      return { ...s, history: replacePresent(h, { ...h.present, answers: cur.answers, checkpoints: cur.checkpoints }) };
    }
    case "reset": return initEditor(a.doc);
  }
}

let counter = 0;
export function newId(prefix = "c"): string {
  counter++;
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${counter}`;
}
