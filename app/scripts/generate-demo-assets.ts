import { ensureDemoAssets } from "../src/lib/synthetic/assets-io";

// Deterministic: re-running rewrites byte-identical files. Always regenerates.
const metas = ensureDemoAssets({ force: true });
for (const m of metas) console.log(`${m.key.padEnd(24)} ${String(m.pointCount).padStart(7)} pts  ${m.frameCount} frame(s)`);
console.log(`Wrote ${metas.length} demo assets to data/assets/`);
