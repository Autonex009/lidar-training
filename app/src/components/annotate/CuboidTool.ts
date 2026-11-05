import * as THREE from "three";
import type { ViewerEngine } from "@/components/viewer/ViewerEngine";
import { fitCuboidWithYaw } from "@/lib/annotation/fit";
import { pointInPolygon } from "@/lib/annotation/spatial";
import type { Cuboid, Vec3 } from "@/lib/annotation/types";

export type ToolMode = "select" | "create" | "move" | "rotate" | "brush" | "lasso" | "flag" | "mark";

export interface BoxGeom { center: Vec3; dims: Vec3; yaw: number }

export interface ToolHost {
  readOnly(): boolean;
  selected(): Cuboid | null;
  cuboids(): Cuboid[];
  /** Typical [l,w,h] of the active label, if known. */
  defaultDims(): Vec3 | undefined;
  positions(): Float32Array | null;
  isHidden(i: number): boolean;
  onCreate(box: BoxGeom): void;
  onPatch(id: string, patch: Partial<Cuboid>): void;
  onSelect(id: string | null): void;
  onClickPoint(mode: "flag" | "mark", pos: Vec3): void;
  onPaint(indices: ArrayLike<number>): void;
  onStrokeStart(): void;
  onStrokeEnd(): void;
}

type Handle = "l+" | "l-" | "w+" | "w-" | "h+" | "h-";
type Gesture =
  | { kind: "create"; start: Vec3; cur: Vec3 }
  | { kind: "move"; id: string; snap: BoxGeom; p0: Vec3; y0: number; live: BoxGeom }
  | { kind: "handle"; id: string; snap: BoxGeom; handle: Handle; t0: number; live: BoxGeom }
  | { kind: "rotate"; id: string; snap: BoxGeom; a0: number; live: BoxGeom }
  | { kind: "brush" }
  | { kind: "lasso"; pts: [number, number][] }
  | { kind: "click"; x: number; y: number; mode: "flag" | "mark" };

const ACCENT = 0x4a9bf5;
const norm = (a: number) => { let y = a % (2 * Math.PI); if (y > Math.PI) y -= 2 * Math.PI; else if (y < -Math.PI) y += 2 * Math.PI; return y; };

/**
 * Pointer tools layered on ViewerEngine: create / move / resize handles / rotate for cuboids,
 * brush and lasso for point labels, and click tools (flag, mark region). Gestures that consume the
 * pointer stop propagation (capture phase) so the engine's own navigation never sees them.
 */
export class CuboidTool {
  mode: ToolMode = "select";
  brushRadius = 0.5;
  private g: Gesture | null = null;
  private handles = new THREE.Group();
  private handleMeshes: THREE.Mesh[] = [];
  private preview: THREE.LineLoop;
  private cursor: THREE.Mesh;
  private markers = new THREE.Group();
  private lassoCanvas: HTMLCanvasElement | null = null;
  private raycaster = new THREE.Raycaster();
  private offs: (() => void)[] = [];
  private rHeld = false;
  private lastHover = 0;
  private paintQueued = false;
  private lastPaintClient: [number, number] | null = null;

  constructor(private engine: ViewerEngine, private host: ToolHost) {
    this.preview = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: ACCENT, depthTest: false }));
    this.preview.visible = false;
    this.preview.renderOrder = 20;
    this.cursor = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.5, depthTest: false }));
    this.cursor.visible = false;
    this.cursor.renderOrder = 20;
    engine.addToRoot(this.handles);
    engine.addToRoot(this.preview);
    engine.addToRoot(this.cursor);
    engine.addToRoot(this.markers);
    const c = engine.canvas;
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: string, fn: (e: HTMLElementEventMap[K]) => void) => {
      t.addEventListener(type, fn as EventListener, { capture: true });
      this.offs.push(() => t.removeEventListener(type, fn as EventListener, { capture: true }));
    };
    on(c, "pointerdown", (e) => this.down(e as unknown as PointerEvent));
    on(c, "pointermove", (e) => this.move(e as unknown as PointerEvent));
    on(c, "pointerup", (e) => this.up(e as unknown as PointerEvent));
    on(c, "pointercancel", () => this.cancel());
    on(window, "keydown", (e) => { if ((e as unknown as KeyboardEvent).key.toLowerCase() === "r" && !isTyping(e as unknown as KeyboardEvent)) this.rHeld = true; });
    on(window, "keyup", (e) => { if ((e as unknown as KeyboardEvent).key.toLowerCase() === "r") this.rHeld = false; });
  }

  dispose() {
    this.cancel();
    this.offs.forEach((o) => o());
    for (const o of [this.handles, this.preview, this.cursor, this.markers]) this.engine.removeFromRoot(o);
    this.preview.geometry.dispose();
    this.cursor.geometry.dispose();
    this.clearHandles();
    this.clearMarkers();
    this.lassoCanvas?.remove();
  }

  setMode(m: ToolMode) {
    this.mode = m;
    this.cursor.visible = false;
    this.engine.canvas.style.cursor = m === "select" ? "" : m === "create" || m === "brush" || m === "lasso" || m === "flag" || m === "mark" ? "crosshair" : "move";
    this.syncSelection();
    this.engine.requestRender();
  }

  // ---------- handles & markers ----------

  /** Rebuild resize handles for the selected cuboid (call after selection/document/frame changes). */
  syncSelection() {
    this.clearHandles();
    const c = this.host.selected();
    if (!c || this.host.readOnly() || this.mode !== "select") { this.engine.requestRender(); return; }
    this.buildHandles(c);
  }

  private clearHandles() {
    for (const m of this.handleMeshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.handleMeshes = [];
    this.handles.clear();
  }

  private buildHandles(b: BoxGeom) {
    this.clearHandles();
    const size = Math.min(0.3, Math.max(0.08, Math.min(...b.dims) * 0.14));
    const defs: [Handle, Vec3][] = [
      ["l+", [b.dims[0] / 2, 0, 0]], ["l-", [-b.dims[0] / 2, 0, 0]], ["w+", [0, b.dims[1] / 2, 0]], ["w-", [0, -b.dims[1] / 2, 0]], ["h+", [0, 0, b.dims[2] / 2]], ["h-", [0, 0, -b.dims[2] / 2]],
    ];
    for (const [key, p] of defs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false }));
      m.position.set(...p);
      m.renderOrder = 15;
      m.userData.handle = key;
      this.handles.add(m);
      this.handleMeshes.push(m);
    }
    this.handles.position.set(...b.center);
    this.handles.rotation.set(0, 0, b.yaw);
    this.handles.updateMatrixWorld(true);
    this.engine.requestRender();
  }

  /** Flag / error markers (data frame positions). */
  setMarkers(list: { pos: Vec3; color?: string }[]) {
    this.clearMarkers();
    for (const m of list) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: m.color ?? "#ffb020", depthTest: false }));
      mesh.position.set(...m.pos);
      mesh.renderOrder = 14;
      this.markers.add(mesh);
    }
    this.engine.requestRender();
  }

  private clearMarkers() {
    for (const c of [...this.markers.children]) { const m = c as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.markers.clear();
  }

  // ---------- gestures ----------

  private consume(e: PointerEvent) {
    e.preventDefault();
    e.stopImmediatePropagation();
    try { this.engine.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.engine.setNavigationEnabled(false);
  }

  private release(e?: PointerEvent) {
    if (e) { try { this.engine.canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ } }
    this.engine.setNavigationEnabled(true);
  }

  private effectiveMode(): ToolMode {
    return this.rHeld && this.host.selected() ? "rotate" : this.mode;
  }

  private pickHandle(x: number, y: number): Handle | null {
    if (!this.handleMeshes.length) return null;
    this.raycaster.ray.copy(this.engine.ray(x, y));
    this.engine.root.updateMatrixWorld(true);
    const hit = this.raycaster.intersectObjects(this.handleMeshes, false)[0];
    return hit ? (hit.object.userData.handle as Handle) : null;
  }

  private geomOf(c: Cuboid): BoxGeom { return { center: [...c.center], dims: [...c.dims], yaw: c.yaw }; }

  private down(e: PointerEvent) {
    if (e.button !== 0 || this.host.readOnly()) return;
    const mode = this.effectiveMode();
    const sel = this.host.selected();
    if (mode === "select" && !sel) return;
    if (mode === "select" && sel) {
      const h = this.pickHandle(e.clientX, e.clientY);
      if (h) {
        const snap = this.geomOf(sel);
        const t0 = this.axisParam(e.clientX, e.clientY, snap, h);
        if (t0 === null) return;
        this.g = { kind: "handle", id: sel.id, snap, handle: h, t0, live: snap };
        this.consume(e);
        return;
      }
    }
    switch (mode) {
      case "create": {
        const p = this.engine.raycastLevel(e.clientX, e.clientY, this.engine.groundLevel);
        if (!p) return;
        this.g = { kind: "create", start: p, cur: p };
        this.consume(e);
        return;
      }
      case "move": {
        const id = this.engine.pickOverlay(e.clientX, e.clientY);
        const c = id ? this.host.cuboids().find((x) => x.id === id) : null;
        if (!c) return;
        if (!sel || sel.id !== c.id) this.host.onSelect(c.id);
        const p0 = this.engine.raycastLevel(e.clientX, e.clientY, c.center[2]);
        if (!p0) return;
        const snap = this.geomOf(c);
        this.g = { kind: "move", id: c.id, snap, p0, y0: e.clientY, live: snap };
        this.consume(e);
        return;
      }
      case "rotate": {
        const c = sel;
        if (!c) return;
        const p = this.engine.raycastLevel(e.clientX, e.clientY, c.center[2]);
        if (!p) return;
        const snap = this.geomOf(c);
        this.g = { kind: "rotate", id: c.id, snap, a0: Math.atan2(p[1] - c.center[1], p[0] - c.center[0]), live: snap };
        this.consume(e);
        return;
      }
      case "brush":
        this.g = { kind: "brush" };
        this.consume(e);
        this.host.onStrokeStart();
        this.lastPaintClient = [e.clientX, e.clientY];
        this.paintAt(e.clientX, e.clientY);
        return;
      case "lasso":
        this.g = { kind: "lasso", pts: [this.rel(e)] };
        this.consume(e);
        this.drawLasso();
        return;
      case "flag":
      case "mark":
        this.g = { kind: "click", x: e.clientX, y: e.clientY, mode };
        return;
      default:
    }
  }

  private rel(e: PointerEvent): [number, number] {
    const r = this.engine.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private move(e: PointerEvent) {
    const g = this.g;
    if (!g) {
      if (this.mode === "brush" && !this.host.readOnly()) this.hoverBrush(e);
      return;
    }
    if (g.kind === "click") return;
    e.stopImmediatePropagation();
    switch (g.kind) {
      case "create": {
        const p = this.engine.raycastLevel(e.clientX, e.clientY, this.engine.groundLevel);
        if (!p) return;
        g.cur = p;
        const z = this.engine.groundLevel + 0.02;
        const pts = [[g.start[0], g.start[1]], [g.cur[0], g.start[1]], [g.cur[0], g.cur[1]], [g.start[0], g.cur[1]]];
        this.preview.geometry.setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, y, z)));
        this.preview.visible = true;
        this.engine.requestRender();
        return;
      }
      case "move": {
        const live = { ...g.snap, center: [...g.snap.center] as Vec3 };
        if (e.altKey) {
          const dist = this.engine.camera.position.distanceTo(this.engine.root.localToWorld(new THREE.Vector3(...g.snap.center)));
          live.center[2] = g.snap.center[2] - (e.clientY - g.y0) * dist * 0.002;
        } else {
          const p = this.engine.raycastLevel(e.clientX, e.clientY, g.snap.center[2]);
          if (!p) return;
          live.center[0] = g.snap.center[0] + (p[0] - g.p0[0]);
          live.center[1] = g.snap.center[1] + (p[1] - g.p0[1]);
        }
        g.live = live;
        this.preview_(g.id, live);
        return;
      }
      case "rotate": {
        const p = this.engine.raycastLevel(e.clientX, e.clientY, g.snap.center[2]);
        if (!p) return;
        let yaw = g.snap.yaw + (Math.atan2(p[1] - g.snap.center[1], p[0] - g.snap.center[0]) - g.a0);
        if (e.shiftKey) yaw = Math.round(yaw / (Math.PI / 12)) * (Math.PI / 12);
        g.live = { ...g.snap, yaw: norm(yaw) };
        this.preview_(g.id, g.live);
        return;
      }
      case "handle": {
        const t = this.axisParam(e.clientX, e.clientY, g.snap, g.handle);
        if (t === null) return;
        g.live = this.resized(g.snap, g.handle, t - g.t0);
        this.preview_(g.id, g.live);
        return;
      }
      case "brush":
        this.lastPaintClient = [e.clientX, e.clientY];
        this.queuePaint();
        return;
      case "lasso":
        g.pts.push(this.rel(e));
        this.drawLasso();
        return;
    }
  }

  private up(e: PointerEvent) {
    const g = this.g;
    if (!g) return;
    this.g = null;
    if (g.kind === "click") {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 4) {
        const pick = this.engine.pickPoint(e.clientX, e.clientY);
        const pos = pick?.position ?? this.engine.raycastGround(e.clientX, e.clientY);
        if (pos) this.host.onClickPoint(g.mode, pos);
      }
      return;
    }
    e.stopImmediatePropagation();
    this.release(e);
    switch (g.kind) {
      case "create": this.finishCreate(g); break;
      case "move": case "rotate": case "handle": {
        const a = g.snap, b = g.live;
        if (a.yaw !== b.yaw || a.center.some((v, i) => v !== b.center[i]) || a.dims.some((v, i) => v !== b.dims[i])) this.host.onPatch(g.id, { center: b.center, dims: b.dims, yaw: b.yaw });
        break;
      }
      case "brush": this.host.onStrokeEnd(); break;
      case "lasso": this.finishLasso(g); break;
    }
  }

  private cancel() {
    if (!this.g) return;
    const g = this.g;
    this.g = null;
    this.preview.visible = false;
    if (g.kind === "brush") this.host.onStrokeEnd();
    if (g.kind === "lasso") this.clearLasso();
    if (g.kind !== "click") this.release();
    this.engine.requestRender();
  }

  /** Live preview: update the engine overlay and handles without touching React state. */
  private preview_(id: string, b: BoxGeom) {
    const o = this.engine.getOverlay(id);
    if (o) this.engine.upsertOverlay({ ...o, center: b.center, dims: b.dims, yaw: b.yaw });
    this.buildHandles(b);
  }

  // ---------- create ----------

  private finishCreate(g: Extract<Gesture, { kind: "create" }>) {
    this.preview.visible = false;
    const gl = this.engine.groundLevel;
    const dx = Math.abs(g.cur[0] - g.start[0]), dy = Math.abs(g.cur[1] - g.start[1]);
    const def = this.host.defaultDims();
    const tiny = dx < 0.25 && dy < 0.25;
    const l = tiny ? def?.[0] ?? 1.5 : Math.max(0.2, dx), w = tiny ? def?.[1] ?? 1.5 : Math.max(0.2, dy);
    const h = def?.[2] ?? 1.5;
    const cx = tiny ? g.start[0] : (g.start[0] + g.cur[0]) / 2, cy = tiny ? g.start[1] : (g.start[1] + g.cur[1]) / 2;
    let box: BoxGeom = { center: [cx, cy, gl + h / 2], dims: [l, w, h], yaw: 0 };
    const pos = this.host.positions();
    if (pos) {
      // a tall search region so the object's full height is captured, then auto-fit to the points
      const search: BoxGeom = { ...box, dims: [l, w, Math.max(h, 2.5)], center: [cx, cy, gl + Math.max(h, 2.5) / 2] };
      const fit = fitCuboidWithYaw(pos, search, { groundZ: gl, margin: 0.3, headroom: 0 });
      if (fit) box = { center: fit.center, dims: fit.dims, yaw: fit.yaw };
    }
    this.host.onCreate(box);
  }

  // ---------- handle math ----------

  private axisDir(b: BoxGeom, h: Handle): THREE.Vector3 {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    return h[0] === "l" ? new THREE.Vector3(c, s, 0) : h[0] === "w" ? new THREE.Vector3(-s, c, 0) : new THREE.Vector3(0, 0, 1);
  }

  /** Parameter along the handle axis of the point closest to the pointer ray. */
  private axisParam(x: number, y: number, b: BoxGeom, h: Handle): number | null {
    const ray = this.engine.ray(x, y);
    const root = this.engine.root;
    const o = root.worldToLocal(ray.origin.clone());
    const q = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const r = ray.direction.clone().applyQuaternion(q).normalize();
    const d = this.axisDir(b, h);
    const idx = h[0] === "l" ? 0 : h[0] === "w" ? 1 : 2;
    const sign = h[1] === "+" ? 1 : -1;
    const P = new THREE.Vector3(...b.center).addScaledVector(d, (sign * b.dims[idx]) / 2);
    const w0 = P.clone().sub(o);
    const bb = d.dot(r), dd = d.dot(w0), ee = r.dot(w0);
    const den = 1 - bb * bb;
    if (Math.abs(den) < 1e-4) return null;
    return (bb * ee - dd) / den;
  }

  private resized(b: BoxGeom, h: Handle, delta: number): BoxGeom {
    const idx = h[0] === "l" ? 0 : h[0] === "w" ? 1 : 2;
    const sign = h[1] === "+" ? 1 : -1;
    const nd = Math.max(0.1, b.dims[idx] + sign * delta);
    const eff = (nd - b.dims[idx]) * sign; // actual face displacement
    const d = this.axisDir(b, h);
    const dims = [...b.dims] as Vec3;
    dims[idx] = nd;
    const center: Vec3 = [b.center[0] + (d.x * eff) / 2, b.center[1] + (d.y * eff) / 2, b.center[2] + (d.z * eff) / 2];
    return { center, dims, yaw: b.yaw };
  }

  // ---------- brush & lasso ----------

  private hoverBrush(e: PointerEvent) {
    const now = performance.now();
    if (now - this.lastHover < 40) return;
    this.lastHover = now;
    const p = this.engine.pickPoint(e.clientX, e.clientY);
    if (!p) { this.cursor.visible = false; this.engine.requestRender(); return; }
    this.cursor.position.set(...p.position);
    this.cursor.scale.setScalar(this.brushRadius);
    this.cursor.visible = true;
    this.engine.requestRender();
  }

  private queuePaint() {
    if (this.paintQueued) return;
    this.paintQueued = true;
    requestAnimationFrame(() => {
      this.paintQueued = false;
      if (this.g?.kind === "brush" && this.lastPaintClient) this.paintAt(this.lastPaintClient[0], this.lastPaintClient[1]);
    });
  }

  private grid: { src: Float32Array; ref: import("@/lib/annotation/spatial").SpatialGrid } | null = null;
  /** Provided by the host through setGrid (built once per frame). */
  setGrid(g: import("@/lib/annotation/spatial").SpatialGrid | null) { this.grid = g ? { src: g.positions, ref: g } : null; }

  private paintAt(cx: number, cy: number) {
    const p = this.engine.pickPoint(cx, cy);
    if (!p || !this.grid) return;
    this.cursor.position.set(...p.position);
    this.cursor.scale.setScalar(this.brushRadius);
    this.cursor.visible = true;
    const idx = this.grid.ref.query(p.position[0], p.position[1], p.position[2], this.brushRadius).filter((i) => !this.host.isHidden(i));
    if (idx.length) this.host.onPaint(idx);
  }

  private drawLasso() {
    const g = this.g;
    if (g?.kind !== "lasso") return;
    const host = this.engine.canvas.parentElement;
    if (!host) return;
    if (!this.lassoCanvas) {
      const c = document.createElement("canvas");
      Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
      host.appendChild(c);
      this.lassoCanvas = c;
    }
    const c = this.lassoCanvas;
    const r = this.engine.canvas.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    g.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(198,241,53,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#4a9bf5";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private clearLasso() { this.lassoCanvas?.remove(); this.lassoCanvas = null; }

  private finishLasso(g: Extract<Gesture, { kind: "lasso" }>) {
    this.clearLasso();
    const pos = this.host.positions();
    if (!pos || g.pts.length < 3) return;
    const eng = this.engine;
    eng.root.updateMatrixWorld(true);
    eng.camera.updateMatrixWorld();
    const m = new THREE.Matrix4().multiplyMatrices(eng.camera.projectionMatrix, eng.camera.matrixWorldInverse).multiply(eng.root.matrixWorld);
    const e = m.elements;
    const rect = eng.canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of g.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const out: number[] = [];
    for (let i = 0; i < pos.length / 3; i++) {
      const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
      const w = e[3] * px + e[7] * py + e[11] * pz + e[15];
      if (w <= 0) continue;
      const nx = (e[0] * px + e[4] * py + e[8] * pz + e[12]) / w, ny = (e[1] * px + e[5] * py + e[9] * pz + e[13]) / w;
      const sx = (nx * 0.5 + 0.5) * rect.width, sy = (1 - (ny * 0.5 + 0.5)) * rect.height;
      if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
      if (this.host.isHidden(i)) continue;
      if (pointInPolygon(sx, sy, g.pts)) out.push(i);
    }
    this.host.onStrokeStart();
    if (out.length) this.host.onPaint(out);
    this.host.onStrokeEnd();
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}
