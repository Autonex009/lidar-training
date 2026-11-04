"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PointCloudViewer, ToolButton, assetFrameSource, type CameraState, type ControlKind, type CuboidOverlay, type FrameSource, type ViewerApi } from "@/components/viewer";
import { Button } from "@/components/ui/Button";
import { classColor, UNLABELED_COLOR } from "@/lib/annotation/colors";
import { fitCuboidToPoints } from "@/lib/annotation/fit";
import { nudgeCuboid } from "@/lib/annotation/nudge";
import { canRedo, canUndo } from "@/lib/annotation/history";
import { editorReducer, initEditor, newId, type Edit } from "@/lib/annotation/reducer";
import { SpatialGrid } from "@/lib/annotation/spatial";
import { allCuboids, b64ToU16, cuboidsOf, u16ToB64, type Cuboid, type Vec3 } from "@/lib/annotation/types";
import { validateForSubmit } from "@/lib/annotation/validate";
import { rulesFromTask } from "@/lib/tasks/runtime";
import type { WorkspaceData } from "@/lib/tasks/service";
import { CuboidTool, type ToolMode } from "./CuboidTool";
import { HelpDialog, InstructionsDrawer, SubmitDialog } from "./Dialogs";
import { AttributeEditor, CheckpointsPanel, ErrorsList, FlagsList, ObjectsList, PendingForm, QuestionsForm, Section, TracksPanel } from "./panels";
import { useAutosave } from "./useAutosave";

const ico = (d: string) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ICON = {
  select: ico("M3 2l9 5-4 1.2L6.5 13z"), create: ico("M2.5 5.5 8 3l5.5 2.5v5L8 13l-5.5-2.5zM8 8v5M2.5 5.5 8 8l5.5-2.5"), move: ico("M8 1.5v13M1.5 8h13M8 1.5 6.3 3.3M8 1.5l1.7 1.8M8 14.5l-1.7-1.8M8 14.5l1.7-1.8M1.5 8l1.8-1.7M1.5 8l1.8 1.7M14.5 8l-1.8-1.7M14.5 8l-1.8 1.7"),
  rotate: ico("M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"), brush: ico("M3 13c1.5 0 2.5-.5 2.5-2l6-6a1.4 1.4 0 0 0-2-2l-6 6c-1.5 0-1 3.5-.5 4z"), lasso: ico("M8 3C4.5 3 2 4.6 2 6.5S4.5 10 8 10s6-1.6 6-3.5S11.5 3 8 3zM6 10c0 2-.5 3 1 3.5"),
  flag: ico("M4 14V2.5M4 3h8l-1.8 2.5L12 8H4"), mark: ico("M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14zM8 8a1.5 1.5 0 1 0 0-3"), undo: ico("M5 4 2 7l3 3M2 7h7a4 4 0 0 1 0 8"), redo: ico("M11 4l3 3-3 3M14 7H7a4 4 0 0 0 0 8"),
  help: ico("M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM6.2 6.2a1.8 1.8 0 1 1 2.6 1.6c-.5.3-.8.7-.8 1.3M8 11.5v.2"),
};

type Pending = { kind: "flag"; cuboidId?: string; position?: Vec3 } | { kind: "error"; cuboidId?: string; position?: Vec3 } | null;
const hhmm = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function AnnotateWorkspace({ data }: { data: WorkspaceData }) {
  const { task } = data;
  const router = useRouter();
  const type = task.annotationType;
  const isSeg = type === "SEMANTIC_SEG" || type === "INSTANCE_SEG";
  const cuboidTask = !isSeg && type !== "INSPECTION" && type !== "IDENTIFICATION";
  const readOnly = data.readOnly;
  const toolsOff = task.asset.upAxis !== "Z";

  const [state, dispatch] = useReducer(editorReducer, data.document, initEditor);
  const doc = state.history.present;
  const selectedId = state.selectedId;
  const [frame, setFrameState] = useState(0);
  const [mode, setModeState] = useState<ToolMode>(isSeg ? "brush" : cuboidTask ? "create" : "select");
  const [activeLabel, setActiveLabel] = useState(task.classes[0]?.name ?? "");
  const [pending, setPending] = useState<Pending>(null);
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [brush, setBrush] = useState(0.6);
  const [instance, setInstance] = useState(1);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [display, setDisplay] = useState<Uint16Array | null>(null);
  const [labeledCount, setLabeledCount] = useState(0);

  const viewer = useRef<ViewerApi>(null);
  const tool = useRef<CuboidTool | null>(null);
  const started = useRef(false);
  const autosave = useAutosave({ assignmentId: data.assignmentId, doc, enabled: !readOnly, savedAt: data.savedAt });

  const live = useRef({ doc, frame, selectedId, activeLabel, readOnly, hidden, mode, instance, display: null as Uint16Array | null });
  live.current = { doc, frame, selectedId, activeLabel, readOnly, hidden, mode, instance, display };

  const colors = useMemo(() => {
    const m: Record<string, string> = { "?": "#9ca3af" };
    task.classes.forEach((c, i) => { m[c.name] = classColor(c.name, i); });
    return m;
  }, [task.classes]);

  // ---------- editing ----------
  const edit = useCallback((e: Edit, select?: string | null) => {
    if (live.current.readOnly) return;
    if (!started.current && e.type !== "checkpoint") {
      started.current = true;
      void fetch(`/api/assignments/${data.assignmentId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "annotation_started" }) }).catch(() => undefined);
    }
    dispatch({ type: "edit", edit: e, select });
  }, [data.assignmentId]);
  const select = useCallback((id: string | null) => dispatch({ type: "select", id }), []);
  const cubs = cuboidsOf(doc, frame);
  const selected = cubs.find((c) => c.id === selectedId) ?? null;

  const maxTrack = () => Math.max(0, ...allCuboids(live.current.doc).map((x) => x.cuboid.trackId ?? 0));

  // ---------- point labels (segmentation) ----------
  const arrays = useRef(new Map<number, { semantic: Uint16Array; instance: Uint16Array }>());
  const committed = useRef(new Map<number, { semantic?: string; instance?: string }>());
  const grids = useRef(new Map<number, SpatialGrid>());
  const classIdByName = useMemo(() => Object.fromEntries(task.classes.map((c) => [c.name, c.classId])), [task.classes]);
  const instanceDisplay = type === "INSTANCE_SEG";

  const loadFrameLabels = useCallback((f: number, n: number) => {
    let a = arrays.current.get(f);
    if (!a || a.semantic.length !== n) {
      const pl = live.current.doc.pointLabels?.find((p) => p.frame === f);
      a = { semantic: pl?.semantic ? b64ToU16(pl.semantic) : new Uint16Array(n), instance: pl?.instance ? b64ToU16(pl.instance) : new Uint16Array(n) };
      committed.current.set(f, { semantic: pl?.semantic, instance: pl?.instance });
      arrays.current.set(f, a);
    }
    return a;
  }, []);
  const showArrays = useCallback((f: number) => {
    const eng = viewer.current?.getEngine();
    const cloud = eng?.getCloud();
    if (!cloud) return;
    const a = loadFrameLabels(f, cloud.pointCount);
    const disp = instanceDisplay ? a.instance : a.semantic;
    setDisplay(disp);
    let n = 0;
    for (let i = 0; i < disp.length; i++) if (disp[i]) n++;
    setLabeledCount(n);
  }, [instanceDisplay, loadFrameLabels]);

  // undo/redo of point labels: rebuild arrays when the document differs from what we last committed
  useEffect(() => {
    if (!isSeg) return;
    const pl = doc.pointLabels?.find((p) => p.frame === frame);
    const c = committed.current.get(frame);
    if ((pl?.semantic ?? undefined) !== c?.semantic || (pl?.instance ?? undefined) !== c?.instance) {
      arrays.current.delete(frame);
      showArrays(frame);
    }
  }, [doc.pointLabels, frame, isSeg, showArrays]);

  // ---------- tool host ----------
  useEffect(() => {
    const eng = viewer.current?.getEngine();
    if (!eng || toolsOff) return;
    const t = new CuboidTool(eng, {
      readOnly: () => live.current.readOnly,
      selected: () => cuboidsOf(live.current.doc, live.current.frame).find((c) => c.id === live.current.selectedId) ?? null,
      cuboids: () => cuboidsOf(live.current.doc, live.current.frame),
      defaultDims: () => task.classes.find((c) => c.name === live.current.activeLabel)?.defaultDims,
      positions: () => eng.getCloud()?.positions ?? null,
      isHidden: (i) => { const d = live.current.display; return !!d && live.current.hidden.has(d[i]); },
      onCreate: (b) => {
        const id = newId("c");
        const c: Cuboid = { id, label: live.current.activeLabel, center: b.center, dims: b.dims, yaw: b.yaw, attributes: {}, ...(type === "TRACKING" ? { trackId: maxTrack() + 1 } : {}) };
        edit({ type: "addCuboid", frame: live.current.frame, cuboid: c }, id);
      },
      onPatch: (id, patch) => edit({ type: "patchCuboid", frame: live.current.frame, id, patch }),
      onSelect: (id) => select(id),
      onClickPoint: (m, pos) => {
        if (m === "mark") {
          for (const cp of task.checkpoints) {
            if (cp.kind === "region_located" && cp.region && Math.hypot(pos[0] - cp.region.center[0], pos[1] - cp.region.center[1]) <= cp.region.radiusM) edit({ type: "checkpoint", key: cp.key });
          }
        } else setPending(type === "ERROR_DETECTION" ? { kind: "error", position: pos } : { kind: "flag", position: pos });
      },
      onPaint: (idx) => {
        const f = live.current.frame;
        const a = arrays.current.get(f);
        if (!a) return;
        const erase = live.current.activeLabel === "";
        const cls = erase ? 0 : classIdByName[live.current.activeLabel] ?? 0;
        for (let k = 0; k < idx.length; k++) {
          const i = idx[k];
          a.semantic[i] = cls;
          if (instanceDisplay) a.instance[i] = erase ? 0 : live.current.instance;
        }
        eng.setPointLabels(instanceDisplay ? a.instance : a.semantic);
      },
      onStrokeStart: () => undefined,
      onStrokeEnd: () => {
        const f = live.current.frame;
        const a = arrays.current.get(f);
        if (!a) return;
        const semantic = u16ToB64(a.semantic), instance = u16ToB64(a.instance);
        committed.current.set(f, { semantic, instance });
        edit({ type: "setPointLabels", frame: f, semantic, instance });
        const disp = instanceDisplay ? a.instance : a.semantic;
        let n = 0;
        for (let i = 0; i < disp.length; i++) if (disp[i]) n++;
        setLabeledCount(n);
      },
    });
    tool.current = t;
    // dev-only hook so scripts/dev-stage4-verify.ts can compute screen coordinates for drags
    if (process.env.NODE_ENV !== "production") (window as unknown as { __engine?: unknown }).__engine = eng;
    t.setMode(live.current.mode);
    return () => { t.dispose(); tool.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsOff]);

  useEffect(() => { tool.current?.setMode(mode); }, [mode]);
  useEffect(() => { if (tool.current) tool.current.brushRadius = brush; }, [brush]);
  useEffect(() => { tool.current?.syncSelection(); }, [doc, selectedId, frame, readOnly]);
  useEffect(() => {
    tool.current?.setMarkers([
      ...doc.flags.filter((f) => (f.frame ?? 0) === frame).map((f) => {
        const c = f.cuboidId ? cubs.find((x) => x.id === f.cuboidId) : null;
        const pos = f.position ?? (c ? ([c.center[0], c.center[1], c.center[2] + c.dims[2] / 2 + 0.4] as Vec3) : null);
        return pos ? { pos, color: "#ffb020" } : null;
      }).filter((x): x is { pos: Vec3; color: string } => x !== null),
      ...(doc.errorsFound ?? []).filter((e) => e.position).map((e) => ({ pos: e.position as Vec3, color: "#ff4d4d" })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.flags, doc.errorsFound, frame, doc.frames]);

  // ---------- viewer wiring ----------
  const frames = useMemo<FrameSource>(() => {
    const base = assetFrameSource(task.asset.id, task.asset.frameCount);
    // ground-truth labels in synthetic caches must never be shown to the trainee
    return { frameCount: base.frameCount, load: async (i) => ({ ...(await base.load(i)), labels: undefined }) };
  }, [task.asset.id, task.asset.frameCount]);

  const overlays = useMemo<CuboidOverlay[]>(() => cubs.map((c) => ({
    id: c.id, label: c.label, center: c.center, dims: c.dims, yaw: c.yaw, color: colors[c.label] ?? "#9ca3af",
  })), [cubs, colors]);

  const onFrameChange = useCallback((i: number) => {
    const cur = live.current;
    const sel = cuboidsOf(cur.doc, cur.frame).find((c) => c.id === cur.selectedId);
    setFrameState(i);
    const next = sel?.trackId !== undefined ? cuboidsOf(cur.doc, i).find((c) => c.trackId === sel.trackId) : null;
    dispatch({ type: "select", id: next?.id ?? null });
    const eng = viewer.current?.getEngine();
    const cloud = eng?.getCloud();
    if (isSeg) {
      showArrays(i);
      if (cloud) { const g = grids.current.get(i) ?? new SpatialGrid(cloud.positions, 0.5); grids.current.set(i, g); tool.current?.setGrid(g); }
    }
  }, [isSeg, showArrays]);

  const onControlUsed = useCallback((kind: ControlKind, detail?: string) => {
    for (const cp of task.checkpoints) {
      if (cp.kind === "control_used" && cp.control === kind) edit({ type: "checkpoint", key: cp.key });
      if (cp.kind === "preset_viewed" && kind === "preset" && cp.preset === detail) edit({ type: "checkpoint", key: cp.key });
    }
  }, [task.checkpoints, edit]);

  const onCamera = useCallback((c: CameraState) => {
    for (const cp of task.checkpoints) {
      if (cp.kind === "region_located" && cp.region && !live.current.doc.checkpoints[cp.key]) {
        if (Math.hypot(c.target[0] - cp.region.center[0], c.target[1] - cp.region.center[1]) <= cp.region.radiusM) edit({ type: "checkpoint", key: cp.key });
      }
    }
  }, [task.checkpoints, edit]);

  const labelColors = useMemo<Record<number, string>>(() => {
    const m: Record<number, string> = { 0: UNLABELED_COLOR };
    if (instanceDisplay) for (let i = 1; i < 400; i++) m[i] = classColor("", i * 3 + 1);
    else task.classes.forEach((c, i) => { m[c.classId] = classColor(c.name, i); });
    return m;
  }, [task.classes, instanceDisplay]);

  useEffect(() => { viewer.current?.setHiddenLabels(hidden); }, [hidden]);

  // ---------- actions ----------
  const goFrame = (i: number) => void viewer.current?.setFrame(i);
  const fit = () => {
    if (!selected) return;
    const eng = viewer.current?.getEngine();
    const pos = eng?.getCloud()?.positions;
    if (!eng || !pos) return;
    const r = fitCuboidToPoints(pos, selected, { margin: 0.3, groundZ: eng.groundLevel, headroom: 0.3 });
    if (r) edit({ type: "patchCuboid", frame, id: selected.id, patch: { center: r.center, dims: r.dims } });
  };
  const duplicate = () => {
    if (!selected) return;
    const id = newId("c");
    edit({ type: "addCuboid", frame, cuboid: { ...selected, id, center: [selected.center[0] + 0.6, selected.center[1] + 0.6, selected.center[2]], dims: [...selected.dims], attributes: { ...selected.attributes }, ...(selected.trackId !== undefined ? { trackId: maxTrack() + 1 } : {}) } }, id);
  };
  const del = () => { if (selected) edit({ type: "deleteCuboid", frame, id: selected.id }); };
  const copyPrev = () => {
    if (frame < 1) return;
    const n = cuboidsOf(doc, frame - 1).length;
    edit({ type: "copyFrame", from: frame - 1, to: frame, newIds: Array.from({ length: n }, () => newId("c")) });
  };
  const interpolate = () => {
    if (!selected || selected.trackId === undefined) return;
    let to = -1;
    for (let f = frame + 1; f < task.asset.frameCount; f++) if (cuboidsOf(doc, f).some((c) => c.trackId === selected.trackId)) { to = f; break; }
    if (to < 0) return;
    edit({ type: "interpolate", trackId: selected.trackId, from: frame, to, newIds: Array.from({ length: to - frame }, () => newId("c")) });
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === "?") { setHelp(true); return; }
      if (ctrl && k.toLowerCase() === "s") { e.preventDefault(); void autosave.save(); return; }
      if (ctrl && k.toLowerCase() === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); return; }
      if (ctrl && k.toLowerCase() === "y") { e.preventDefault(); dispatch({ type: "redo" }); return; }
      if (readOnly) return;
      if (ctrl && k.toLowerCase() === "d") { e.preventDefault(); if (cuboidTask) duplicate(); return; }
      if (k === "Escape") { select(null); setPending(null); if (mode !== "select") setModeState("select"); return; }
      if (k === "Delete" || k === "Backspace") { if (cuboidTask && selected) { e.preventDefault(); del(); } return; }
      if (k === "," ) { goFrame(frame - 1); return; }
      if (k === ".") { goFrame(frame + 1); return; }
      if (!ctrl && /^[1-9]$/.test(k)) {
        const c = task.classes[Number(k) - 1];
        if (c) { setActiveLabel(c.name); if (cuboidTask && selected) edit({ type: "patchCuboid", frame, id: selected.id, patch: { label: c.name } }); }
        return;
      }
      if (!ctrl && !e.altKey) {
        const low = k.toLowerCase();
        if (!selected || !cuboidTask) {
          // tool shortcuts
        }
        if (low === "v") { setModeState("select"); return; }
        if (low === "c" && cuboidTask) { setModeState("create"); return; }
        if (low === "m" && cuboidTask) { setModeState("move"); return; }
        if (low === "b" && isSeg) { setModeState("brush"); return; }
        if (low === "l" && isSeg) { setModeState("lasso"); return; }
        if (low === "f" && type !== "INSPECTION") { setModeState("flag"); return; }
        if (low === "g" && selected && cuboidTask) { fit(); return; }
      }
      if (selected && cuboidTask) {
        const patch = nudgeCuboid(selected, { key: k, shift: e.shiftKey, ctrl });
        if (patch) { e.preventDefault(); edit({ type: "patchCuboid", frame, id: selected.id, patch }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- submit ----------
  const rules = useMemo(() => rulesFromTask(task), [task]);
  const validation = useMemo(() => validateForSubmit(doc, rules), [doc, rules]);
  const openSubmit = async () => {
    setSubmitErr(null);
    await autosave.save();
    setSubmitOpen(true);
  };
  const confirmSubmit = async () => {
    setSubmitBusy(true);
    setSubmitErr(null);
    try {
      if (!(await autosave.save())) throw new Error("Could not save your latest changes. Retry and submit again.");
      const res = await fetch(`/api/assignments/${data.assignmentId}/submit`, { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { error?: string; issues?: { message: string }[] };
      if (!res.ok) throw new Error([j.error, ...(j.issues ?? []).map((i) => i.message)].filter(Boolean).join(" "));
      router.push("/annotate");
      router.refresh();
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Submit failed");
      setSubmitBusy(false);
    }
  };

  const navTo = async (id: string | null) => { if (!id) return; await autosave.save(); router.push(`/annotate/${id}`); };

  // ---------- render ----------
  const tools: { m: ToolMode; label: string; icon: keyof typeof ICON; show: boolean }[] = [
    { m: "select", label: "Select / resize handles (V)", icon: "select", show: true },
    { m: "create", label: "Create cuboid: drag on the ground (C)", icon: "create", show: cuboidTask },
    { m: "move", label: "Move: drag a box, Alt = vertical (M)", icon: "move", show: cuboidTask },
    { m: "rotate", label: "Rotate yaw: drag, or hold R", icon: "rotate", show: cuboidTask },
    { m: "brush", label: "Brush (B)", icon: "brush", show: isSeg },
    { m: "lasso", label: "Lasso (L)", icon: "lasso", show: isSeg },
    { m: "flag", label: type === "ERROR_DETECTION" ? "Missing object: click where a box is missing (F)" : "Flag: click to place a flag (F)", icon: "flag", show: type !== "INSPECTION" },
    { m: "mark", label: "Mark region: click on the area you located", icon: "mark", show: type === "INSPECTION" },
  ];
  const extras = (
    <>
      <span className="mx-1 h-4 w-px bg-line" />
      {tools.filter((t) => t.show).map((t) => (
        <ToolButton key={t.m} label={t.label} active={mode === t.m} disabled={readOnly || toolsOff} onClick={() => setModeState(t.m)}>{ICON[t.icon]}</ToolButton>
      ))}
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolButton label="Undo (Ctrl+Z)" disabled={readOnly || !canUndo(state.history)} onClick={() => dispatch({ type: "undo" })}>{ICON.undo}</ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={readOnly || !canRedo(state.history)} onClick={() => dispatch({ type: "redo" })}>{ICON.redo}</ToolButton>
      <ToolButton label="Keyboard shortcuts (?)" onClick={() => setHelp(true)}>{ICON.help}</ToolButton>
    </>
  );

  const status = data.status;
  const bannerText = !data.isOwner ? "Viewing another user's work (read-only)." : status === "PENDING_REVIEW" ? "Submitted and waiting for review. This task is read-only." : status === "APPROVED" ? "Approved. This task is read-only." : null;
  const fb = data.feedback;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const saveText = readOnly ? "Read-only" : autosave.status === "saving" ? "Saving…" : autosave.status === "dirty" ? "Unsaved changes" : autosave.status === "error" ? "Save failed" : autosave.savedAt ? `Saved${mounted ? ` · ${hhmm(autosave.savedAt)}` : ""}` : "No changes yet";
  const pendingClose = () => setPending(null);
  const panelProps = { task, doc, frame, selectedId, readOnly, colors, edit, select, goFrame };
  const dupFrames = type === "TRACKING";
  const marks = useMemo(() => Object.entries(doc.frames).filter(([, f]) => f.cuboids.length).map(([k]) => Number(k)), [doc.frames]);
  const flagsHere = doc.flags;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface text-[13px]" data-testid="workspace">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <Link href="/annotate" className="text-[12px] text-muted underline" onClick={(e) => { if (autosave.status === "dirty") { e.preventDefault(); void autosave.save().then(() => router.push("/annotate")); } }}>Tasks</Link>
        <span className="font-semibold">{task.code}</span>
        <span className="truncate text-muted">{task.title}</span>
        <Button className="ml-2" onClick={() => setDrawer((d) => !d)}>Instructions</Button>
        <Button onClick={() => document.getElementById("flags-section")?.scrollIntoView({ block: "nearest" })}>Issues / Flags ({flagsHere.length})</Button>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[12px] ${autosave.status === "error" ? "text-red-700" : "text-muted"}`} data-testid="save-status">{saveText}</span>
          <Button disabled={readOnly} onClick={() => void autosave.save()}>Save draft</Button>
          <Button variant="primary" disabled={readOnly} onClick={() => void openSubmit()} data-testid="submit-button">Submit</Button>
          <Button disabled={!data.nav.prevId} onClick={() => void navTo(data.nav.prevId)}>Previous</Button>
          <Button disabled={!data.nav.nextId} onClick={() => void navTo(data.nav.nextId)}>Next</Button>
        </div>
      </header>
      {bannerText && <div className="border-b border-line bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800" data-testid="status-banner">{bannerText}</div>}
      {data.isOwner && status === "REVISION_REQUIRED" && fb?.decision === "REQUEST_REVISION" && (
        <div className="border-b border-line bg-red-50 px-3 py-1.5 text-[12px] text-red-800" data-testid="revision-banner">
          <b>Revision required.</b> {fb.feedback}
          {fb.errorTags.length > 0 && <> Tags: {fb.errorTags.map((t) => data.tagNames[t] ?? t).join(", ")}.</>}
          {fb.correctionInstructions && <> Correction: {fb.correctionInstructions}</>}
        </div>
      )}
      {toolsOff && <div className="border-b border-line bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">Annotation tools support Z-up assets only; this asset is Y-up.</div>}
      <div className="relative flex min-h-0 flex-1">
        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface" aria-label="Labels panel">
          <Section title="Labels" right={<span className="text-[11px] text-muted">{allCuboids(doc).length ? `${cubs.length} in frame` : ""}</span>}>
            {isSeg ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {task.classes.map((c, i) => (
                    <button key={c.name} type="button" disabled={readOnly} onClick={() => setActiveLabel(c.name)} title={`${i < 9 ? `Key ${i + 1}` : ""}`}
                      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[12px] ${activeLabel === c.name ? "border-ink bg-accent-tint" : "border-line"}`}>
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[c.name] }} />{i < 9 ? `${i + 1} ` : ""}{c.name}
                    </button>
                  ))}
                  <button type="button" disabled={readOnly} onClick={() => setActiveLabel("")} className={`rounded border px-1.5 py-0.5 text-[12px] ${activeLabel === "" ? "border-ink bg-accent-tint" : "border-line"}`}>Erase</button>
                </div>
                <label className="flex items-center gap-2 text-[12px]"><span className="w-16 text-muted">Brush {brush.toFixed(1)} m</span>
                  <input type="range" min={0.1} max={3} step={0.1} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="flex-1 accent-[#8aa81d]" aria-label="Brush radius" /></label>
                {instanceDisplay && (
                  <div className="flex items-center gap-2 text-[12px]"><span>Instance {instance}</span>
                    <button type="button" className="h-6 rounded border border-line px-2 hover:bg-panel" disabled={readOnly} onClick={() => setInstance((n) => n + 1)}>New instance</button>
                    <button type="button" className="h-6 rounded border border-line px-2 hover:bg-panel" disabled={readOnly || instance < 2} onClick={() => setInstance((n) => Math.max(1, n - 1))}>Prev</button></div>
                )}
                <p className="text-[11px] text-muted">{labeledCount.toLocaleString()} points labelled. Hide a class to reveal unlabelled points.</p>
                <div className="flex flex-wrap gap-2 text-[12px]">
                  {task.classes.map((c) => (
                    <label key={c.name} className="flex items-center gap-1"><input type="checkbox" checked={!hidden.has(c.classId)} onChange={() => setHidden((h) => { const n = new Set(h); if (n.has(c.classId)) n.delete(c.classId); else n.add(c.classId); return n; })} />{c.name}</label>
                  ))}
                </div>
                <p className="text-[11px] text-muted">Lasso selects everything under the outline regardless of depth: rotate to a side view first.</p>
              </div>
            ) : (
              <>
                {cuboidTask && !readOnly && (
                  <label className="mb-1.5 flex items-center gap-2 text-[12px]"><span className="text-muted">New box label</span>
                    <select className="h-6 flex-1 rounded border border-line bg-surface px-1 text-[12px]" value={activeLabel} onChange={(e) => setActiveLabel(e.target.value)} aria-label="New box label">
                      {task.classes.map((c, i) => <option key={c.name} value={c.name}>{i < 9 ? `${i + 1} · ` : ""}{c.name}</option>)}
                    </select></label>
                )}
                {type !== "INSPECTION" && <ObjectsList {...panelProps} />}
                {selected && type !== "INSPECTION" && (
                  <AttributeEditor {...panelProps} cuboid={selected} onFit={fit} onDuplicate={duplicate} onDelete={del}
                    onFlag={() => setPending({ kind: "flag", cuboidId: selected.id })}
                    onReportError={type === "ERROR_DETECTION" ? () => setPending({ kind: "error", cuboidId: selected.id }) : undefined} />
                )}
              </>
            )}
            {type === "INSPECTION" && <CheckpointsPanel task={task} doc={doc} />}
          </Section>
          {dupFrames && (
            <Section title="Tracking" right={<span className="text-[11px] text-muted">Frame {frame + 1}/{task.asset.frameCount}</span>}>
              <div className="mb-1.5 flex flex-wrap gap-1">
                <button type="button" className="h-6 rounded border border-line px-2 text-[12px] hover:bg-panel disabled:opacity-50" disabled={readOnly || frame < 1} onClick={copyPrev}>Copy boxes from previous frame</button>
                <button type="button" className="h-6 rounded border border-line px-2 text-[12px] hover:bg-panel disabled:opacity-50" disabled={readOnly || !selected} onClick={interpolate}>Interpolate to next keyframe</button>
              </div>
              <TracksPanel {...panelProps} />
            </Section>
          )}
          {pending && (
            <Section title={pending.kind === "error" ? "Report error" : "New flag"}>
              <PendingForm
                title={pending.kind === "error" ? (pending.cuboidId ? "Report an error on the selected box" : "Report a missing object") : pending.cuboidId ? "Flag the selected box" : "Flag this location"}
                tags={pending.kind === "error" ? (pending.cuboidId ? task.errorTags : task.errorTags.filter((t) => t.key === "missing_object")) : undefined}
                hint={pending.position ? `Position ${pending.position.map((v) => v.toFixed(1)).join(", ")}` : undefined}
                onCancel={pendingClose}
                onAdd={(reason, tag) => {
                  if (pending.kind === "error") edit({ type: "addError", error: { id: newId("e"), tag: tag ?? "missing_object", targetAnnotationId: pending.cuboidId, explanation: reason, frame, position: pending.position } });
                  else edit({ type: "addFlag", flag: { id: newId("f"), frame, cuboidId: pending.cuboidId, reason, position: pending.position } });
                  setPending(null);
                }} />
            </Section>
          )}
          {type === "ERROR_DETECTION" && <Section title={`Reported errors (${doc.errorsFound?.length ?? 0})`}><ErrorsList doc={doc} task={task} readOnly={readOnly} onRemove={(id) => edit({ type: "removeError", id })} /></Section>}
          {task.questions.length > 0 && <Section title="Questions"><QuestionsForm task={task} doc={doc} readOnly={readOnly} onAnswer={(key, value) => edit({ type: "setAnswer", key, value })} /></Section>}
          <Section id="flags-section" title={`Flags (${flagsHere.length})`}>
            <FlagsList flags={flagsHere} readOnly={readOnly} onRemove={(id) => edit({ type: "removeFlag", id })}
              onSelect={(f) => { if (f.frame !== undefined && f.frame !== frame) goFrame(f.frame); if (f.cuboidId) select(f.cuboidId); }} />
          </Section>
        </aside>
        <main className="relative min-w-0 flex-1">
          <PointCloudViewer
            ref={viewer} frames={frames} upAxis={task.asset.upAxis} navigationProfile={task.program.navigationProfile}
            overlays={overlays} selectedId={selectedId} onSelect={select} onControlUsed={onControlUsed} onCameraChange={onCamera}
            onFrameChange={onFrameChange} toolbarExtras={extras} title={task.asset.name} frameMarks={marks}
            pointLabels={isSeg ? display ?? undefined : undefined} labelColors={labelColors} colorMode={isSeg ? "label" : undefined}
          />
          <InstructionsDrawer open={drawer} onClose={() => setDrawer(false)} task={task} feedback={fb} tagNames={data.tagNames}
            onHint={(index) => void fetch(`/api/assignments/${data.assignmentId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "hint_revealed", index }) }).catch(() => undefined)} />
        </main>
      </div>
      {autosave.status === "error" && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          Could not save: {autosave.error}<Button onClick={autosave.retry}>Retry</Button>
        </div>
      )}
      <HelpDialog open={help} onClose={() => setHelp(false)} />
      <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)} errors={validation.errors} warnings={validation.warnings} busy={submitBusy} serverError={submitErr} onConfirm={() => void confirmSubmit()} />
    </div>
  );
}
