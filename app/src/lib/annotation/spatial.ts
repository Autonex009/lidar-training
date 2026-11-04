/** Uniform 3D hash grid over a point cloud for radius queries (built once per frame). */
export class SpatialGrid {
  private cells = new Map<number, number[]>();
  private readonly inv: number;
  constructor(readonly positions: Float32Array, readonly cell = 0.5) {
    this.inv = 1 / cell;
    for (let i = 0; i < positions.length / 3; i++) {
      const k = this.key(Math.floor(positions[i * 3] * this.inv), Math.floor(positions[i * 3 + 1] * this.inv), Math.floor(positions[i * 3 + 2] * this.inv));
      const l = this.cells.get(k);
      if (l) l.push(i); else this.cells.set(k, [i]);
    }
  }
  private key(x: number, y: number, z: number) { return ((x + 512) & 1023) | (((y + 512) & 1023) << 10) | (((z + 512) & 1023) << 20); }

  /** Indices of points within `r` of (x,y,z). */
  query(x: number, y: number, z: number, r: number): number[] {
    const out: number[] = [];
    const x0 = Math.floor((x - r) * this.inv), x1 = Math.floor((x + r) * this.inv);
    const y0 = Math.floor((y - r) * this.inv), y1 = Math.floor((y + r) * this.inv);
    const z0 = Math.floor((z - r) * this.inv), z1 = Math.floor((z + r) * this.inv);
    const r2 = r * r, p = this.positions;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) {
      const l = this.cells.get(this.key(cx, cy, cz));
      if (!l) continue;
      for (const i of l) {
        const dx = p[i * 3] - x, dy = p[i * 3 + 1] - y, dz = p[i * 3 + 2] - z;
        if (dx * dx + dy * dy + dz * dz <= r2) out.push(i);
      }
    }
    return out;
  }
}

/** Point-in-polygon (even-odd) for screen-space lasso. */
export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
