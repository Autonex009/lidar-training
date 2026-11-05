import * as THREE from "three";
import type { ViewerEngine } from "@/components/viewer/ViewerEngine";
import type { Box } from "@/lib/geometry/cuboid";
import type { FaceKey, FaceStatus } from "@/lib/learn/interactive";

type V3 = [number, number, number];

/** Corner (sx,sy,sz in {-1,1}) of a box in its own frame. */
const corner = (b: Box, sx: number, sy: number, sz: number): V3 => [sx * b.dims[0] / 2, sy * b.dims[1] / 2, sz * b.dims[2] / 2];

const FACES: Record<FaceKey, V3[]> = {
  "l+": [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
  "l-": [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  "w+": [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
  "w-": [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  "h+": [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  "h-": [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
};

function place(g: THREE.Object3D, b: Box) {
  g.position.set(...b.center);
  g.rotation.set(0, 0, b.yaw);
}

function loop(pts: V3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; out.push(new THREE.Vector3(...a), new THREE.Vector3(...c)); }
  return out;
}

/** Pulsing outline around a box (the object the learner is asked to annotate). */
export class PulseBox {
  private group = new THREE.Group();
  private mat = new THREE.LineBasicMaterial({ color: 0xffa31a, transparent: true, depthTest: false });
  private raf = 0;
  private t0 = performance.now();
  private on = true;

  constructor(private engine: ViewerEngine, b: Box) {
    const pts: THREE.Vector3[] = [];
    for (const k of Object.keys(FACES) as FaceKey[]) pts.push(...loop(FACES[k].map(([x, y, z]) => corner(b, x, y, z))));
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), this.mat);
    lines.renderOrder = 12;
    this.group.add(lines);
    place(this.group, b);
    engine.addToRoot(this.group);
    const tick = () => {
      if (this.on) this.mat.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((performance.now() - this.t0) / 280));
      this.engine.requestRender();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Stop pulsing and show a steady colour (e.g. green when solved). */
  setSteady(color: number | null) {
    this.on = color === null;
    if (color !== null) { this.mat.color.setHex(color); this.mat.opacity = 1; }
    else this.mat.color.setHex(0xffa31a);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.engine.removeFromRoot(this.group);
    this.group.traverse((o) => (o as THREE.LineSegments).geometry?.dispose());
    this.mat.dispose();
  }
}

const COLORS: Record<Exclude<FaceStatus, "ok">, number> = { cut: 0xff3b3b, margin: 0xffd60a };

/** Colours the faces/edges of a box red (cuts points) or yellow (empty margin). */
export class MistakeOverlay {
  private group = new THREE.Group();

  constructor(private engine: ViewerEngine) { engine.addToRoot(this.group); }

  set(b: Box | null, status: Record<FaceKey, FaceStatus> | null) {
    this.clear();
    if (b && status) {
      for (const k of Object.keys(FACES) as FaceKey[]) {
        const s = status[k];
        if (s === "ok") continue;
        const pts = FACES[k].map(([x, y, z]) => corner(b, x, y, z));
        const col = COLORS[s];
        const edges = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(loop(pts)), new THREE.LineBasicMaterial({ color: col, depthTest: false }));
        edges.renderOrder = 13;
        const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]].map((p) => new THREE.Vector3(...p)));
        const quad = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
        quad.renderOrder = 12;
        this.group.add(edges, quad);
      }
      place(this.group, b);
    }
    this.engine.requestRender();
  }

  private clear() {
    for (const c of [...this.group.children]) {
      const m = c as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.group.remove(c);
    }
  }

  dispose() { this.clear(); this.engine.removeFromRoot(this.group); }
}
