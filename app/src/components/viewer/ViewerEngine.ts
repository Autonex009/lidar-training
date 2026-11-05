import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NormalizedCloud, UpAxis } from "@/lib/pointcloud/types";
import { getInputDevice } from "@/lib/tour/inputDevice";
import { wheelAction } from "./wheelBindings";
import type {
  CameraState, ColorMode, ControlKind, CuboidOverlay, EngineHandlers, EngineOptions, FrameSource, NavigationProfile, PointPick, Preset,
} from "./types";

const ACCENT = 0xc6f135;
const PALETTE = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990"];
const DEFAULT_LABEL_COLORS: Record<number, string> = {
  1: "#6b7280", 2: "#4363d8", 3: "#e6194b", 4: "#f58231", 5: "#ffe119", 6: "#a9a9a9", 7: "#3cb44b", 8: "#911eb4",
};
const OVERLAY_LABEL_COLORS: Record<string, string> = {
  Vehicle: "#4f8cff", Pedestrian: "#ff5a5a", Cyclist: "#ff9f43", Pole: "#ffe119", Building: "#b0b0b0", Vegetation: "#4cd964", Unknown: "#c77dff",
};

const VERT = /* glsl */ `
  attribute vec3 color;
  attribute float hide;
  uniform float size;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(size * uScale / max(-mv.z, 0.001), 1.5, 24.0);
    vColor = color;
    if (hide > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
  }`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() { gl_FragColor = vec4(vColor, 1.0); }`;

interface OverlayItem { data: CuboidOverlay; group: THREE.Group; edges: THREE.LineSegments; solid: THREE.Mesh; arrow: THREE.Mesh; baseColor: THREE.Color }

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Gradient used for height colouring (blue -> cyan -> green -> yellow -> red). */
function ramp(t: number, out: [number, number, number]) {
  const stops: [number, number, number][] = [[0.15, 0.3, 0.9], [0.1, 0.8, 0.9], [0.2, 0.85, 0.3], [0.95, 0.9, 0.2], [0.95, 0.25, 0.15]];
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2), f = x - i;
  for (let k = 0; k < 3; k++) out[k] = stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f;
}

export class ViewerEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  /** Everything in the data frame lives under `root`; its rotation converts Z-up data to Three's Y-up. */
  readonly root = new THREE.Group();
  readonly canvas: HTMLCanvasElement;
  handlers: EngineHandlers = {};

  upAxis: UpAxis;
  profile: NavigationProfile;
  colorMode: ColorMode;
  pointSize: number;
  labelColors: Record<number, string>;

  protected orbit: OrbitControls;
  protected cloud: NormalizedCloud | null = null;
  protected points: THREE.Points | null = null;
  protected material: THREE.ShaderMaterial;
  protected hiddenLabels = new Set<number>();
  protected externalLabels: Uint16Array | null = null;
  protected overlays = new Map<string, OverlayItem>();
  protected overlayGroup = new THREE.Group();
  protected helperGroup = new THREE.Group();
  protected grid: THREE.GridHelper | null = null;
  protected axes: THREE.AxesHelper | null = null;
  protected reticle: THREE.Mesh;
  protected selectedId: string | null = null;
  protected frameSource: FrameSource | null = null;
  protected frameCache = new Map<number, NormalizedCloud>();
  protected frameToken = 0;
  protected currentFrame = 0;

  protected target = new THREE.Vector3();
  protected radius = 10;
  protected center = new THREE.Vector3();
  protected showAxes: boolean;
  protected showGrid: boolean;

  // fly state
  protected yaw = 0;
  protected pitch = 0;
  protected keys = new Set<string>();
  protected hovered = false;
  protected drag: { kind: "look" | "pan"; x: number; y: number; moved: boolean } | null = null;
  protected metaDown = false;
  protected reticleHit: THREE.Vector3 | null = null;

  protected navEnabled = true;
  protected dirty = true;
  protected raf = 0;
  protected lastT = 0;
  protected disposed = false;
  protected ro: ResizeObserver;
  protected lastCamKey = "";
  protected downInfo: { x: number; y: number; t: number; button: number } | null = null;
  protected lastKind: ControlKind = "rotate";
  protected raycaster = new THREE.Raycaster();
  private listeners: (() => void)[] = [];

  constructor(protected container: HTMLElement, opts: EngineOptions = {}) {
    this.upAxis = opts.upAxis ?? "Z";
    this.profile = opts.navigationProfile ?? "orbit";
    this.colorMode = opts.colorMode ?? "height";
    this.pointSize = opts.pointSize ?? 0.06;
    this.showAxes = opts.showAxes ?? true;
    this.showGrid = opts.showGrid ?? true;
    this.labelColors = { ...DEFAULT_LABEL_COLORS, ...(opts.labelColors ?? {}) };

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0b0b0b);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    Object.assign(this.canvas.style, { display: "block", width: "100%", height: "100%", outline: "none", touchAction: "none" });
    container.appendChild(this.canvas);

    this.root.rotation.x = this.upAxis === "Z" ? -Math.PI / 2 : 0;
    this.scene.add(this.root);
    this.root.add(this.helperGroup, this.overlayGroup);

    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { size: { value: this.pointSize }, uScale: { value: 500 } } });

    const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    this.reticle = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4a5fe0, side: THREE.DoubleSide, depthTest: false, transparent: true }));
    this.reticle.renderOrder = 999;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = false;
    this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.orbit.addEventListener("change", () => { this.dirty = true; });
    this.orbit.addEventListener("start", () => this.emitControl(this.lastKind));

    this.bind(this.container, "pointerdown", (e) => this.onPointerDownCapture(e as PointerEvent), true);
    this.bind(this.canvas, "pointerdown", (e) => this.onPointerDown(e as PointerEvent));
    this.bind(this.canvas, "pointermove", (e) => this.onPointerMove(e as PointerEvent));
    this.bind(this.canvas, "pointerup", (e) => this.onPointerUp(e as PointerEvent));
    this.bind(this.canvas, "pointerenter", () => { this.hovered = true; this.focusIfIdle(); });
    this.bind(this.canvas, "pointerleave", () => { this.hovered = false; this.reticle.visible = false; this.dirty = true; });
    this.bind(this.canvas, "wheel", (e) => this.onTrackpadWheel(e as WheelEvent), true, { passive: false });
    this.bind(this.canvas, "wheel", (e) => this.onWheel(e as WheelEvent), false, { passive: false });
    this.bind(this.canvas, "dblclick", (e) => this.onDblClick(e as MouseEvent));
    this.bind(this.canvas, "contextmenu", (e) => e.preventDefault());
    this.bind(this.canvas, "blur", () => { this.keys.clear(); });
    this.bind(window, "keydown", (e) => this.onKey(e as KeyboardEvent, true));
    this.bind(window, "keyup", (e) => this.onKey(e as KeyboardEvent, false));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.applyProfile(this.profile, true);
    this.setPresetInternal("perspective");
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---------- public API ----------

  setNavigationProfile(p: NavigationProfile) { this.applyProfile(p, false); }

  /** Enable/disable built-in navigation (annotation tools disable it while dragging a handle). */
  setNavigationEnabled(on: boolean) {
    this.navEnabled = on;
    this.orbit.enabled = on && this.profile === "orbit";
    if (!on) this.drag = null;
  }

  setPointSize(n: number) { this.pointSize = n; this.material.uniforms.size.value = n; this.dirty = true; }

  setColorMode(m: ColorMode) { this.colorMode = m; this.recolor(); }

  setShowAxes(on: boolean) { this.showAxes = on; if (this.axes) this.axes.visible = on; this.dirty = true; }
  setShowGrid(on: boolean) { this.showGrid = on; if (this.grid) this.grid.visible = on; this.dirty = true; }

  setLabelColors(c: Record<number, string>) { this.labelColors = { ...DEFAULT_LABEL_COLORS, ...c }; if (this.colorMode === "label") this.recolor(); }

  /** Per-point labels override those embedded in the cloud. */
  setPointLabels(l: Uint16Array | null) { this.externalLabels = l; this.updateHidden(); if (this.colorMode === "label") this.recolor(); }

  setHiddenLabels(s: Set<number>) { this.hiddenLabels = new Set(s); this.updateHidden(); }

  setFrameSource(src: FrameSource | null) { this.frameSource = src; this.frameCache.clear(); }

  async setFrame(i: number): Promise<void> {
    const src = this.frameSource;
    if (!src) return;
    const idx = Math.max(0, Math.min(src.frameCount - 1, i));
    const token = ++this.frameToken;
    let cloud = this.frameCache.get(idx);
    if (!cloud) {
      try { cloud = await src.load(idx); } catch (e) { this.handlers.onError?.(e instanceof Error ? e : new Error(String(e))); return; }
      this.frameCache.set(idx, cloud);
      if (this.frameCache.size > 4) {
        for (const k of this.frameCache.keys()) { if (k !== idx) { this.frameCache.delete(k); break; } }
      }
    }
    if (token !== this.frameToken || this.disposed) return;
    this.currentFrame = idx;
    this.setCloud(cloud, !this.cloud);
    this.handlers.onFrameChange?.(idx, cloud);
  }

  get isHovered() { return this.hovered; }
  get frameIndex() { return this.currentFrame; }
  get frameCount() { return this.frameSource?.frameCount ?? 1; }
  getCloud() { return this.cloud; }

  setCloud(cloud: NormalizedCloud, fit = true) {
    const first = !this.cloud;
    this.cloud = cloud;
    if (this.points) {
      this.root.remove(this.points);
      this.points.geometry.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cloud.pointCount * 3), 3));
    g.setAttribute("hide", new THREE.BufferAttribute(new Float32Array(cloud.pointCount), 1));
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.root.add(this.points);
    if (first) this.buildHelpers(cloud);
    this.recolor();
    this.updateHidden();
    if (fit) this.fitToBounds();
    this.dirty = true;
  }

  setOverlays(list: CuboidOverlay[]) {
    for (const id of [...this.overlays.keys()]) this.removeOverlay(id);
    for (const o of list) this.upsertOverlay(o);
  }

  upsertOverlay(o: CuboidOverlay) {
    this.removeOverlay(o.id);
    const [l, w, h] = o.dims;
    const z = this.upAxis === "Z";
    const size = z ? new THREE.Vector3(l, w, h) : new THREE.Vector3(l, h, w);
    const box = new THREE.BoxGeometry(size.x, size.y, size.z);
    const col = new THREE.Color(o.color ?? OVERLAY_LABEL_COLORS[o.label ?? ""] ?? hashColor(o.label ?? o.id));
    const lineMat = o.dashed ? new THREE.LineDashedMaterial({ color: col, dashSize: 0.25, gapSize: 0.15 }) : new THREE.LineBasicMaterial({ color: col });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat);
    if (o.dashed) edges.computeLineDistances();
    // heading marker: line from centre to the middle of the +x (front) face
    const head = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(size.x / 2, 0, 0)]),
      lineMat,
    );
    if (o.dashed) head.computeLineDistances();
    const solid = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.14, color: ACCENT, depthWrite: false }));
    solid.userData.overlayId = o.id;
    // heading arrow at the +length face (shown for the selected box only)
    const coneH = Math.min(0.6, Math.max(0.15, Math.min(size.x, size.y, size.z) * 0.4));
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(coneH * 0.45, coneH, 12), new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false }));
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(size.x / 2 + coneH / 2, 0, 0);
    arrow.visible = false;
    arrow.renderOrder = 11;
    const group = new THREE.Group();
    group.add(edges, head, solid, arrow);
    group.position.set(...o.center);
    if (z) group.rotation.z = o.yaw; else group.rotation.y = o.yaw;
    this.overlayGroup.add(group);
    this.overlays.set(o.id, { data: o, group, edges, solid, arrow, baseColor: col });
    this.paintOverlay(o.id);
    this.dirty = true;
  }

  removeOverlay(id: string) {
    const it = this.overlays.get(id);
    if (!it) return;
    this.overlayGroup.remove(it.group);
    it.group.traverse((c) => {
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    this.overlays.delete(id);
    this.dirty = true;
  }

  getOverlay(id: string) { return this.overlays.get(id)?.data; }

  setSelectedId(id: string | null) {
    const prev = this.selectedId;
    this.selectedId = id;
    if (prev) this.paintOverlay(prev);
    if (id) this.paintOverlay(id);
    this.dirty = true;
  }

  private paintOverlay(id: string) {
    const it = this.overlays.get(id);
    if (!it) return;
    const sel = id === this.selectedId;
    const mat = it.edges.material as THREE.LineBasicMaterial;
    mat.color.set(sel ? ACCENT : it.baseColor);
    mat.depthTest = !sel;
    (it.solid.material as THREE.MeshBasicMaterial).visible = sel;
    it.arrow.visible = sel;
    it.group.renderOrder = sel ? 10 : 0;
  }

  getCamera(): CameraState {
    const p = this.root.worldToLocal(this.camera.position.clone());
    const t = this.root.worldToLocal(this.currentTarget().clone());
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z], fov: this.camera.fov, profile: this.profile };
  }

  screenshot(): string {
    this.render();
    return this.canvas.toDataURL("image/png");
  }

  resetCamera() {
    this.setPresetInternal("perspective");
    this.emitControl("reset");
  }

  setPreset(p: Preset) {
    this.setPresetInternal(p);
    this.emitControl("preset", p);
  }

  fitToBounds() {
    this.setPresetInternal("perspective");
  }

  /** Camera target in data frame. */
  setTarget(dataPos: [number, number, number]) {
    const w = this.root.localToWorld(new THREE.Vector3(...dataPos));
    this.setTargetWorld(w);
  }

  /** Nearest rendered point under the cursor (visible points only). Click-time only, CPU raycast. */
  pickPoint(clientX: number, clientY: number): PointPick | null {
    if (!this.points || !this.cloud) return null;
    this.setRay(clientX, clientY);
    const dist = this.camera.position.distanceTo(this.target);
    const px = (Math.max(dist, 0.1) * 2 * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, this.canvas.clientHeight);
    this.raycaster.params.Points = { threshold: Math.max(this.pointSize * 0.5, px * 4) };
    const hits = this.raycaster.intersectObject(this.points, false);
    const hide = this.points.geometry.getAttribute("hide") as THREE.BufferAttribute;
    for (const h of hits) {
      if (h.index === undefined || hide.getX(h.index) > 0.5) continue;
      const p = this.root.worldToLocal(h.point.clone());
      return { index: h.index, position: [p.x, p.y, p.z], distance: h.distance };
    }
    return null;
  }

  pickOverlay(clientX: number, clientY: number): string | null {
    this.setRay(clientX, clientY);
    const solids = [...this.overlays.values()].filter((o) => o.data.selectable !== false).map((o) => o.solid);
    this.root.updateMatrixWorld(true);
    const hit = this.raycaster.intersectObjects(solids, false)[0];
    return hit ? (hit.object.userData.overlayId as string) : null;
  }

  /** Intersection with the data-frame ground plane (at min up-axis value), in data frame. */
  raycastGround(clientX: number, clientY: number): [number, number, number] | null {
    this.setRay(clientX, clientY);
    const w = this.groundPlaneHit();
    if (!w) return null;
    const p = this.root.worldToLocal(w);
    return [p.x, p.y, p.z];
  }

  /** World-space ray through a client position (for tools). */
  ray(clientX: number, clientY: number): THREE.Ray {
    this.setRay(clientX, clientY);
    return this.raycaster.ray.clone();
  }

  /** Intersection with the horizontal data-frame plane at up-axis value `level`, in data frame. */
  raycastLevel(clientX: number, clientY: number, level: number): [number, number, number] | null {
    this.setRay(clientX, clientY);
    const k = this.upAxis === "Z" ? 2 : 1;
    const gl = new THREE.Vector3(0, 0, 0).setComponent(k, level);
    this.root.updateMatrixWorld(true);
    const upW = new THREE.Vector3(0, 0, 0).setComponent(k, 1).transformDirection(this.root.matrixWorld);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(upW, this.root.localToWorld(gl));
    const out = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, out)) return null;
    const p = this.root.worldToLocal(out);
    return [p.x, p.y, p.z];
  }

  /** Up-axis value of the ground plane used by raycastGround (cloud minimum). */
  get groundLevel(): number {
    const b = this.cloud?.bounds;
    return b ? b.min[this.upAxis === "Z" ? 2 : 1] : 0;
  }

  /** Data-frame position -> client coordinates (null when behind the camera). */
  projectToScreen(pos: [number, number, number]): { x: number; y: number } | null {
    const v = this.root.localToWorld(new THREE.Vector3(...pos)).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Add/remove annotation-tool helper objects (data frame) under the root group. */
  addToRoot(o: THREE.Object3D) { this.root.add(o); this.dirty = true; }
  removeFromRoot(o: THREE.Object3D) { this.root.remove(o); this.dirty = true; }

  get navigationEnabled() { return this.navEnabled; }

  requestRender() { this.dirty = true; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.listeners.forEach((off) => off());
    this.orbit.dispose();
    for (const id of [...this.overlays.keys()]) this.removeOverlay(id);
    this.points?.geometry.dispose();
    this.material.dispose();
    this.grid?.geometry.dispose();
    this.axes?.geometry.dispose();
    this.reticle.geometry.dispose();
    (this.reticle.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  // ---------- internals ----------

  protected bind(target: EventTarget, type: string, fn: (e: Event) => void, capture = false, opts: { passive?: boolean } = {}) {
    target.addEventListener(type, fn, { capture, ...opts });
    this.listeners.push(() => target.removeEventListener(type, fn, { capture }));
  }

  protected emitControl(kind: ControlKind, detail?: string) { this.handlers.onControlUsed?.(kind, detail); }

  protected currentTarget(): THREE.Vector3 {
    return this.profile === "orbit" ? this.orbit.target : this.target;
  }

  protected resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.material.uniforms.uScale.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.dirty = true;
  }

  protected buildHelpers(cloud: NormalizedCloud) {
    const b = cloud.bounds;
    const up = this.upAxis === "Z" ? 2 : 1;
    const ext = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const horiz = this.upAxis === "Z" ? [0, 1] : [0, 2];
    const span = Math.max(ext[horiz[0]], ext[horiz[1]], 1);
    const size = Math.ceil(span / 10) * 10;
    this.grid = new THREE.GridHelper(size, Math.max(2, Math.round(size / (span > 80 ? 5 : 2))), 0x5a5a4a, 0x2a2a24);
    // GridHelper lies in XZ; in a Z-up data frame the ground is XY.
    if (this.upAxis === "Z") this.grid.rotation.x = Math.PI / 2;
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const pos: [number, number, number] = [c[0], c[1], c[2]];
    pos[up] = b.min[up];
    this.grid.position.set(...pos);
    this.grid.visible = this.showGrid;
    this.helperGroup.add(this.grid);

    const axLen = Math.max(1, span / 10);
    this.axes = new THREE.AxesHelper(axLen); // X red, Y green, Z blue, in the data frame
    const origin: [number, number, number] = [0, 0, 0];
    const inside = [0, 1, 2].every((k) => origin[k] >= b.min[k] - span * 0.2 && origin[k] <= b.max[k] + span * 0.2);
    if (inside) this.axes.position.set(0, 0, 0); else this.axes.position.set(b.min[0], b.min[1], b.min[2]);
    this.axes.visible = this.showAxes;
    this.helperGroup.add(this.axes);

    this.center.set(c[0], c[1], c[2]);
    this.center = this.root.localToWorld(this.center.clone());
    this.radius = Math.max(0.5, Math.hypot(ext[0], ext[1], ext[2]) / 2);
    this.camera.near = Math.max(0.01, this.radius * 0.002);
    this.camera.far = this.radius * 60;
    this.camera.updateProjectionMatrix();
  }

  protected recolor() {
    if (!this.points || !this.cloud) return;
    const c = this.cloud, n = c.pointCount;
    const col = (this.points.geometry.getAttribute("color") as THREE.BufferAttribute);
    const a = col.array as Float32Array;
    let mode = this.colorMode;
    if (mode === "intensity" && !c.intensity) mode = "height";
    if (mode === "rgb" && !c.colors) mode = "height";
    const labels = this.labels();
    if (mode === "label" && !labels) mode = "height";
    const tmp: [number, number, number] = [0, 0, 0];
    if (mode === "height") {
      const k = this.upAxis === "Z" ? 2 : 1;
      const lo = c.bounds.min[k], span = Math.max(1e-6, c.bounds.max[k] - lo);
      for (let i = 0; i < n; i++) {
        ramp((c.positions[i * 3 + k] - lo) / span, tmp);
        a[i * 3] = tmp[0]; a[i * 3 + 1] = tmp[1]; a[i * 3 + 2] = tmp[2];
      }
    } else if (mode === "intensity" && c.intensity) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { const v = c.intensity[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      const span = Math.max(1e-9, hi - lo);
      for (let i = 0; i < n; i++) { const t = 0.15 + 0.85 * ((c.intensity[i] - lo) / span); a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = t; }
    } else if (mode === "rgb" && c.colors) {
      for (let i = 0; i < n * 3; i++) a[i] = c.colors[i] / 255;
    } else if (mode === "label" && labels) {
      const cache = new Map<number, THREE.Color>();
      for (let i = 0; i < n; i++) {
        const id = labels[i];
        let cc = cache.get(id);
        if (!cc) { cc = new THREE.Color(this.labelColors[id] ?? "#9ca3af"); cache.set(id, cc); }
        a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b;
      }
    } else a.fill(0.82);
    col.needsUpdate = true;
    this.dirty = true;
  }

  protected labels(): Uint16Array | null {
    return this.externalLabels ?? this.cloud?.labels?.semantic ?? null;
  }

  protected updateHidden() {
    if (!this.points || !this.cloud) return;
    const attr = this.points.geometry.getAttribute("hide") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const labels = this.labels();
    if (!labels || this.hiddenLabels.size === 0) arr.fill(0);
    else for (let i = 0; i < this.cloud.pointCount; i++) arr[i] = this.hiddenLabels.has(labels[i]) ? 1 : 0;
    attr.needsUpdate = true;
    this.dirty = true;
  }

  // ---- camera presets ----

  protected presetDir(p: Preset): THREE.Vector3 {
    const z = this.upAxis === "Z";
    const d = new THREE.Vector3();
    if (p === "top") d.set(0, z ? -0.01 : 1, z ? 1 : 0.01);
    else if (p === "front") d.set(0, z ? -1 : 0, z ? 0 : 1);
    else if (p === "side") d.set(1, 0, 0);
    else d.set(-0.6, z ? -0.8 : 0.5, z ? 0.55 : 0.8);
    d.normalize();
    return d.applyQuaternion(this.root.quaternion); // data -> world direction
  }

  protected setPresetInternal(p: Preset) {
    const dist = (this.radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.05;
    const dir = this.presetDir(p);
    const target = this.center.clone();
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.target.copy(target);
    this.orbit.target.copy(target);
    this.orbit.update();
    this.syncFlyAnglesFromCamera();
    this.dirty = true;
  }

  protected setTargetWorld(w: THREE.Vector3) {
    this.target.copy(w);
    this.orbit.target.copy(w);
    if (this.profile === "orbit") this.orbit.update();
    else { this.camera.lookAt(w); this.syncFlyAnglesFromCamera(); }
    this.dirty = true;
    this.emitControl("target");
  }

  protected applyProfile(p: NavigationProfile, init: boolean) {
    const prev = this.profile;
    this.profile = p;
    if (p === "fly") {
      this.target.copy(this.orbit.target);
      this.orbit.enabled = false;
      this.syncFlyAnglesFromCamera();
    } else {
      if (!init && prev === "fly") {
        const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
        const d = Math.min(Math.max(this.camera.position.distanceTo(this.target), this.radius * 0.1), this.radius * 3);
        this.orbit.target.copy(this.camera.position).addScaledVector(fwd, d);
        this.target.copy(this.orbit.target);
      }
      this.orbit.enabled = this.navEnabled;
      this.orbit.update();
    }
    this.reticle.visible = false;
    this.dirty = true;
  }

  protected syncFlyAnglesFromCamera() {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
    this.yaw = e.y; this.pitch = e.x;
  }

  protected applyFlyAngles() {
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
  }

  // ---- input ----

  protected focusIfIdle() {
    const a = document.activeElement;
    if (!a || a === document.body || a === this.canvas) this.canvas.focus({ preventScroll: true });
  }

  protected onKey(e: KeyboardEvent, down: boolean) {
    if (e.key === "Meta" || e.key === "Control") {
      this.metaDown = down;
      if (!down) { this.reticle.visible = false; this.dirty = true; }
    }
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    const active = this.hovered || document.activeElement === this.canvas;
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "q", "e", "shift"].includes(k)) return;
    if (down) {
      if (!active || this.profile !== "fly" || !this.navEnabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!this.keys.has(k) && k !== "shift") this.emitControl(k === "q" || k === "e" ? "elevate" : "move", k.toUpperCase());
      this.keys.add(k);
      e.preventDefault();
    } else this.keys.delete(k);
  }

  protected onPointerDownCapture(e: PointerEvent) {
    this.downInfo = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    this.lastKind = e.button === 0 && !(e.shiftKey || e.ctrlKey || e.metaKey) ? "rotate" : "pan";
  }

  protected onPointerDown(e: PointerEvent) {
    this.canvas.focus({ preventScroll: true });
    if (this.profile !== "fly" || !this.navEnabled) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.button === 0) return; // handled on pointerup as target click
    this.drag = { kind: e.button === 0 && !e.shiftKey ? "look" : "pan", x: e.clientX, y: e.clientY, moved: false };
    this.canvas.setPointerCapture(e.pointerId);
  }

  protected onPointerMove(e: PointerEvent) {
    if (this.profile === "fly" && this.drag && this.navEnabled) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      if (!this.drag.moved && (dx || dy)) { this.drag.moved = true; this.emitControl(this.drag.kind === "look" ? "rotate" : "pan"); }
      if (this.drag.kind === "look") {
        this.yaw -= dx * 0.004; this.pitch -= dy * 0.004;
        this.applyFlyAngles();
      } else {
        const s = (this.camera.position.distanceTo(this.target) * 0.0015) + this.radius * 0.0005;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const upv = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.camera.position.addScaledVector(right, -dx * s).addScaledVector(upv, dy * s);
      }
      this.dirty = true;
      return;
    }
    if (this.profile === "fly" && (e.metaKey || e.ctrlKey) && !this.drag) this.updateReticle(e.clientX, e.clientY);
    else if (this.reticle.visible) { this.reticle.visible = false; this.dirty = true; }
  }

  protected updateReticle(cx: number, cy: number) {
    const hit = this.pickPoint(cx, cy);
    let w: THREE.Vector3 | null = null;
    if (hit) w = this.root.localToWorld(new THREE.Vector3(...hit.position));
    else { this.setRay(cx, cy); w = this.groundPlaneHit(); }
    this.reticleHit = w;
    if (!w) { this.reticle.visible = false; return; }
    this.reticle.position.copy(w);
    const s = this.camera.position.distanceTo(w) * 0.04;
    this.reticle.scale.setScalar(Math.max(s, 0.05));
    this.reticle.quaternion.copy(this.camera.quaternion);
    this.reticle.visible = true;
    this.dirty = true;
  }

  protected onPointerUp(e: PointerEvent) {
    const d = this.downInfo;
    const dragged = this.drag?.moved ?? false;
    if (this.drag) { try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ } }
    this.drag = null;
    if (!d || e.button !== 0) return;
    const click = Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4 && performance.now() - d.t < 600 && !dragged;
    if (!click) return;
    if (this.profile === "fly" && (e.metaKey || e.ctrlKey)) {
      this.updateReticle(e.clientX, e.clientY);
      if (this.reticleHit) this.setTargetWorld(this.reticleHit.clone());
      return;
    }
    const id = this.pickOverlay(e.clientX, e.clientY);
    if (id) { this.setSelectedId(id); this.handlers.onSelect?.(id); return; }
    this.handlers.onPointPick?.(this.pickPoint(e.clientX, e.clientY));
    if (this.selectedId) { this.setSelectedId(null); }
    this.handlers.onSelect?.(null);
  }

  protected onDblClick(e: MouseEvent) {
    if (!this.navEnabled) return;
    const p = this.pickPoint(e.clientX, e.clientY);
    let w: THREE.Vector3 | null = null;
    if (p) w = this.root.localToWorld(new THREE.Vector3(...p.position));
    else { this.setRay(e.clientX, e.clientY); w = this.groundPlaneHit(); }
    if (w) this.setTargetWorld(w);
  }

  protected onWheel(e: WheelEvent) {
    if (!this.navEnabled) return;
    this.emitControl("zoom");
    if (this.profile !== "fly") return; // OrbitControls handles its own wheel
    e.preventDefault();
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    const step = -Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) / 120 * this.radius * 0.06;
    this.camera.position.addScaledVector(fwd, step);
    this.dirty = true;
  }

  /** Trackpad bindings: two-finger scroll rotates, pinch zooms, shift + scroll pans. Mouse users keep the wheel-zooms behaviour. */
  protected onTrackpadWheel(e: WheelEvent) {
    if (!this.navEnabled || getInputDevice() !== "trackpad") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const k = e.deltaMode === 1 ? 16 : 1;
    const dx = e.deltaX * k, dy = e.deltaY * k;
    const action = wheelAction("trackpad", e);
    const orbit = this.profile === "orbit";
    const tgt = this.currentTarget();
    if (action === "zoom") {
      this.emitControl("zoom", "pinch");
      const f = Math.exp(Math.max(-60, Math.min(60, dy)) * 0.01);
      if (orbit) {
        const off = this.camera.position.clone().sub(tgt);
        const len = Math.min(Math.max(off.length() * f, this.radius * 0.05), this.radius * 8);
        this.camera.position.copy(tgt).add(off.setLength(len));
        this.orbit.update();
      } else {
        const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
        this.camera.position.addScaledVector(fwd, -Math.max(-60, Math.min(60, dy)) * 0.01 * this.radius * 0.3);
      }
    } else if (action === "pan") {
      this.emitControl("pan", "scroll");
      const s = this.camera.position.distanceTo(tgt) * 0.0015 + this.radius * 0.0005;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const upv = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      const d = new THREE.Vector3().addScaledVector(right, dx * s).addScaledVector(upv, -dy * s);
      this.camera.position.add(d);
      if (orbit) { this.orbit.target.add(d); this.target.copy(this.orbit.target); this.orbit.update(); }
    } else {
      this.emitControl("rotate", "scroll");
      if (orbit) {
        const off = this.camera.position.clone().sub(tgt);
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta -= dx * 0.005;
        sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dy * 0.005));
        off.setFromSpherical(sph);
        this.camera.position.copy(tgt).add(off);
        this.orbit.update();
      } else {
        this.yaw -= dx * 0.004; this.pitch -= dy * 0.004;
        this.applyFlyAngles();
      }
    }
    this.dirty = true;
  }

  protected setRay(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  protected groundPlaneHit(): THREE.Vector3 | null {
    const b = this.cloud?.bounds;
    const k = this.upAxis === "Z" ? 2 : 1;
    const gl = new THREE.Vector3(0, 0, 0);
    gl.setComponent(k, b ? b.min[k] : 0);
    this.root.updateMatrixWorld(true);
    const upW = new THREE.Vector3(0, 0, 0).setComponent(k, 1).transformDirection(this.root.matrixWorld);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(upW, this.root.localToWorld(gl));
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out);
  }

  // ---- loop ----

  protected tick = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    if (this.profile === "fly" && this.keys.size > 0 && this.navEnabled) {
      const sp = this.radius * 0.25 * (this.keys.has("shift") ? 3 : 1) * dt;
      const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const p = this.camera.position;
      if (this.keys.has("w")) p.addScaledVector(fwd, sp);
      if (this.keys.has("s")) p.addScaledVector(fwd, -sp);
      if (this.keys.has("d")) p.addScaledVector(right, sp);
      if (this.keys.has("a")) p.addScaledVector(right, -sp);
      if (this.keys.has("e")) p.y += sp;
      if (this.keys.has("q")) p.y -= sp;
      this.dirty = true;
    }
    if (this.dirty) { this.dirty = false; this.render(); }
  };

  protected render() {
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    const cam = this.camera;
    const key = `${cam.position.x.toFixed(4)},${cam.position.y.toFixed(4)},${cam.position.z.toFixed(4)},${cam.quaternion.x.toFixed(4)},${cam.quaternion.y.toFixed(4)},${cam.quaternion.z.toFixed(4)}`;
    if (key !== this.lastCamKey) { this.lastCamKey = key; this.handlers.onCameraChange?.(this.getCamera()); }
  }
}
