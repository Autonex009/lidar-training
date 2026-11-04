import { C, Dots, Fig, grid } from "./shared";

export function OcclusionShadow() {
  return (
    <Fig label="A near box blocks rays so the far object has points only on its front face">
      <circle cx="30" cy="90" r="6" fill={C.ink} />
      <text x="14" y="110">sensor</text>
      <rect x="110" y="70" width="20" height="40" fill={C.fill} stroke={C.ink} />
      <text x="96" y="124">near box</text>
      <path d="M130 72 330 40M130 108 330 140" stroke={C.mute} strokeDasharray="3 3" />
      <path d="M130 72 330 40v100l-200-32z" fill={C.mute} opacity="0.12" />
      <text x="190" y="30" fill={C.mute}>shadow: no rays reach here</text>
      <rect x="250" y="78" width="50" height="24" fill="none" stroke={C.mute} strokeDasharray="4 3" />
      <Dots pts={grid(250, 78, 3, 24, 1, 6)} fill={C.red} r={1.8} />
      <line x1="30" y1="90" x2="250" y2="90" stroke={C.blue} markerEnd="url(#ah)" />
      <text x="232" y="136">far object</text>
      <text x="205" y="152">only the front face has points</text>
    </Fig>
  );
}
