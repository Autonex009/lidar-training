import { generateScene } from "./generate";
import type { ClassName, GeneratedScene, ObjectSpec, ReferenceCuboid, SceneSpec } from "./types";

export const DEMO_PREFIX = "DEMO / SYNTHETIC — ";

export interface PlantedError {
  type: "wrong_class" | "bad_yaw" | "missing_object" | "duplicate" | "wrong_dims";
  cuboidId: string;
  description: string;
}

export interface DemoScene {
  key: string;
  name: string;
  description: string;
  spec: SceneSpec;
  /** Deliberately flawed boxes for fix-it / error-detection tasks. */
  initialAnnotation?: ReferenceCuboid[];
  plantedErrors?: PlantedError[];
}

export type BuiltDemoScene = GeneratedScene & Pick<DemoScene, "key" | "name" | "description" | "initialAnnotation" | "plantedErrors">;

// ---- object helpers ----
let nextId = 1;
const reset = () => { nextId = 1; };
const mk = (kind: ObjectSpec["kind"], label: ClassName, center: [number, number], dims: [number, number, number], yaw = 0, extra: Partial<ObjectSpec> = {}): ObjectSpec => {
  const id = nextId++;
  return { kind, label, instanceId: id, trackId: id, center, dims, yaw, ...extra };
};
const car = (x: number, y: number, yaw = 0, e: Partial<ObjectSpec> = {}) => mk("wedge", "Vehicle", [x, y], [4.5, 1.9, 1.5], yaw, e);
const ped = (x: number, y: number, e: Partial<ObjectSpec> = {}) => mk("capsule", "Pedestrian", [x, y], [0.6, 0.6, 1.75], 0, e);
const cyc = (x: number, y: number, yaw = 0, e: Partial<ObjectSpec> = {}) => mk("lshape", "Cyclist", [x, y], [1.8, 0.7, 1.7], yaw, e);
const pole = (x: number, y: number, e: Partial<ObjectSpec> = {}) => mk("cylinder", "Pole", [x, y], [0.3, 0.3, 5], 0, e);
const building = (x: number, y: number, l = 10, w = 8, h = 9, yaw = 0) => mk("box", "Building", [x, y], [l, w, h], yaw);
const tree = (x: number, y: number, e: Partial<ObjectSpec> = {}) => mk("cylinder", "Vegetation", [x, y], [2.4, 2.4, 4.5], 0, e);
const unknown = (x: number, y: number, yaw = 0) => mk("box", "Unknown", [x, y], [1.2, 0.8, 0.9], yaw);

const toCuboid = (o: ObjectSpec): ReferenceCuboid => ({
  id: `cub-${o.instanceId}`, trackId: o.trackId, label: o.label, center: [o.center[0], o.center[1], o.dims[2] / 2],
  dims: [...o.dims], yaw: o.yaw, attributes: {},
});

type Def = () => DemoScene;

const defs: Record<string, Def> = {
  "demo-nav": () => {
    reset();
    return {
      key: "demo-nav", name: "Navigation scene", description: "Open scene with landmarks for practising navigation controls.",
      spec: {
        seed: 101, extent: [60, 60], groundNoise: 0.015, density: 1, walls: true, objects: [
          building(-18, 14, 12, 9, 10), building(20, -16, 9, 9, 7), car(8, 6, 0.4), car(-9, -7, 2.2), ped(4, -4), ped(-5, 8),
          pole(12, 15), pole(-14, -14), tree(-20, -4), tree(16, 0), tree(0, 22), cyc(-3, -12, 1.2),
        ],
      },
    };
  },
  "demo-identify": () => {
    reset();
    return {
      key: "demo-identify", name: "Object identification", description: "One of each object type, spread out, to identify from evidence.",
      spec: {
        seed: 202, extent: [44, 44], groundNoise: 0.012, density: 1.3, objects: [
          car(10, 4, 0.2), ped(-6, 8), cyc(5, -9, 1.0), pole(-10, -8), building(-14, 12, 8, 6, 8), tree(14, 14), unknown(-4, -4, 0.7), car(-12, -2, 1.9),
        ],
      },
    };
  },
  "demo-cuboid-basic": () => {
    reset();
    return {
      key: "demo-cuboid-basic", name: "Basic cuboids", description: "Clearly visible vehicles and pedestrians for first cuboids.",
      spec: {
        seed: 303, extent: [50, 50], groundNoise: 0.012, density: 1.2, objects: [
          car(9, 5, 0.1), car(-8, 10, 1.7), car(12, -9, -0.6), car(-14, -8, 3.0),
          ped(3, -3), ped(-4, 4), ped(6, 12), cyc(-3, -12, 0.8), pole(15, 8), pole(-16, 3),
        ],
      },
    };
  },
  "demo-cuboid-precision": () => {
    reset();
    const objs = [car(9, 5, 0.3), car(-9, 9, 1.4), ped(4, -5), car(-12, -8, 2.6), cyc(6, 13, 0.5), pole(14, -6)];
    const good = objs.map(toCuboid);
    const bad = good.map((c) => ({ ...c, center: [...c.center] as ReferenceCuboid["center"], dims: [...c.dims] as ReferenceCuboid["dims"] }));
    bad[0].dims = [bad[0].dims[0] * 1.5, bad[0].dims[1] * 1.45, bad[0].dims[2] * 1.4]; // oversized
    bad[1].dims = [bad[1].dims[0] * 0.6, bad[1].dims[1] * 0.65, bad[1].dims[2] * 0.7]; // undersized
    bad[2].center = [bad[2].center[0] + 0.7, bad[2].center[1] - 0.6, bad[2].center[2]]; // offset
    bad[3].yaw += 0.55; // misaligned yaw
    bad[4].center = [bad[4].center[0] - 0.5, bad[4].center[1] + 0.4, bad[4].center[2] + 0.3];
    bad[4].yaw -= 0.3; // offset + yaw
    // bad[5] left as a correct box
    return {
      key: "demo-cuboid-precision", name: "Cuboid precision", description: "Pre-placed boxes with deliberate flaws to fix.",
      spec: { seed: 404, extent: [50, 50], groundNoise: 0.012, density: 1.2, objects: objs },
      initialAnnotation: bad,
    };
  },
  "demo-occlusion": () => {
    reset();
    return {
      key: "demo-occlusion", name: "Occlusion and partial objects", description: "Partially visible and sparse objects.",
      spec: {
        seed: 505, extent: [70, 70], groundNoise: 0.015, density: 1.2, walls: true, objects: [
          building(-6, 6, 8, 6, 8), car(-6, -2, 0.1, { occlusionFraction: 0.5 }), ped(8, 6, { occlusionFraction: 0.55 }),
          car(14, -10, 1.0, { occlusionFraction: 0.25 }), car(30, 22, 0.4, { sparsity: 0.12 }), ped(28, -20, { sparsity: 0.2 }),
          cyc(-20, -12, 0.2, { occlusionFraction: 0.35 }), pole(10, -3), tree(-14, 18), car(22, 8, 2.8, { sparsity: 0.5 }),
        ],
      },
    };
  },
  "demo-seg": () => {
    reset();
    return {
      key: "demo-seg", name: "Semantic segmentation", description: "Ground, buildings, vegetation, vehicles and pedestrians for point labelling.",
      spec: {
        seed: 606, extent: [60, 60], groundNoise: 0.02, density: 0.8, objects: [
          building(-18, 16, 14, 8, 10), building(18, 18, 10, 8, 12), building(-22, -10, 8, 12, 7),
          tree(-6, 10), tree(2, 14), tree(8, 8), tree(16, -8), tree(-12, -18),
          car(6, -4, 0.2), car(-8, -4, 1.7), car(14, 2, 0.0), ped(0, 4), ped(-3, -9), ped(10, -12), pole(-2, 20), pole(22, 4),
        ],
      },
    };
  },
  "demo-instances": () => {
    reset();
    // parked side by side along x: width 1.9 along x after 90deg yaw -> spacing 2.0 (touching)
    const cars = [0, 1, 2, 3, 4].map((i) => car(-6 + i * 2.0, 8, Math.PI / 2));
    const peds = [0, 1, 2].map((i) => ped(5 + i * 0.7, -6));
    const bikes = [cyc(-8, -10, 0.2), cyc(-6.4, -10.2, 0.25)];
    return {
      key: "demo-instances", name: "Instance segmentation", description: "Several touching objects of the same class.",
      spec: { seed: 707, extent: [44, 44], groundNoise: 0.012, density: 1.6, objects: [...cars, ...peds, ...bikes, pole(14, 12), building(0, 20, 14, 5, 7)] },
    };
  },
  "demo-sequence": () => {
    reset();
    return {
      key: "demo-sequence", name: "Multi-frame sequence", description: "8 frames, 3 moving objects, one disappears for two frames.",
      spec: {
        seed: 808, extent: [50, 50], groundNoise: 0.012, density: 0.8, frames: 8, objects: [
          car(-12, 4, 0, { velocity: [3.0, 0] }),
          ped(2, -10, { velocity: [0.2, 1.1], hiddenFrames: [3, 4] }),
          cyc(10, 10, 3.5, { velocity: [-1.6, -1.2] }),
          pole(14, -8), building(-12, -18, 12, 6, 8),
        ],
      },
    };
  },
  "demo-errors": () => {
    reset();
    const objs = [car(9, 5, 0.2), car(-9, 8, 1.6), ped(4, -5), cyc(-6, -10, 0.9), pole(14, -4), car(-14, -2, 2.8)];
    const ref = objs.map(toCuboid);
    const init = ref.map((c) => ({ ...c, center: [...c.center] as ReferenceCuboid["center"], dims: [...c.dims] as ReferenceCuboid["dims"] }));
    const planted: PlantedError[] = [];
    init[1].label = "Pedestrian";
    planted.push({ type: "wrong_class", cuboidId: init[1].id, description: "A car is labelled Pedestrian." });
    init[3].yaw += 1.2;
    planted.push({ type: "bad_yaw", cuboidId: init[3].id, description: "Cyclist box heading is rotated about 70 degrees off." });
    const dup = { ...init[0], id: "cub-dup-1", center: [init[0].center[0] + 0.25, init[0].center[1] + 0.15, init[0].center[2]] as ReferenceCuboid["center"] };
    planted.push({ type: "duplicate", cuboidId: dup.id, description: "Second box on the same car (duplicate of cub-1)." });
    init[5].dims = [init[5].dims[0] * 1.7, init[5].dims[1] * 1.6, init[5].dims[2] * 1.5];
    planted.push({ type: "wrong_dims", cuboidId: init[5].id, description: "Box is far too large for the car." });
    const missing = init.splice(2, 1)[0]; // pedestrian box removed, and the bad_yaw on index 2 vanishes with it
    planted.push({ type: "missing_object", cuboidId: missing.id, description: "Pedestrian has no box." });
    init.push(dup);
    return {
      key: "demo-errors", name: "Error detection", description: "Annotated scene with planted mistakes to find.",
      spec: { seed: 909, extent: [50, 50], groundNoise: 0.012, density: 1.2, objects: objs },
      initialAnnotation: init, plantedErrors: planted,
    };
  },
  "demo-final": () => {
    reset();
    return {
      key: "demo-final", name: "Final practical", description: "Mixed scene: annotate all objects, check occlusion and heading.",
      spec: {
        seed: 1010, extent: [70, 70], groundNoise: 0.015, density: 1.3, walls: true, objects: [
          car(8, 4, 0.3), car(-10, 9, 1.9), car(16, -12, -0.8, { occlusionFraction: 0.3 }), car(-6, -3, 3.0, { occlusionFraction: 0.45 }), car(28, 14, 0.9, { sparsity: 0.25 }),
          ped(3, -4), ped(-3, 6), ped(5, 14, { occlusionFraction: 0.4 }), cyc(-4, -14, 0.6), cyc(20, 4, 2.4),
          pole(12, 12), pole(-14, -8), building(-22, 18, 12, 8, 11), tree(-18, -18), tree(24, -20),
        ],
      },
    };
  },
};

export const DEMO_SCENE_KEYS = Object.keys(defs);

export function getDemoScene(key: string): DemoScene {
  const d = defs[key];
  if (!d) throw new Error(`Unknown demo scene "${key}"`);
  return d();
}

export function buildDemoScene(key: string): BuiltDemoScene {
  const d = getDemoScene(key);
  const g = generateScene(d.spec);
  return { ...g, key: d.key, name: d.name, description: d.description, initialAnnotation: d.initialAnnotation, plantedErrors: d.plantedErrors };
}
