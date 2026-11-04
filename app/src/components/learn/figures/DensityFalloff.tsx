import { C, Dots, Fig, grid } from "./shared";

export function DensityFalloff() {
  return (
    <Fig label="Top-down rings: near car dense, far car sparse">
      <circle cx="40" cy="90" r="60" fill="none" stroke={C.line} />
      <circle cx="40" cy="90" r="130" fill="none" stroke={C.line} />
      <circle cx="40" cy="90" r="200" fill="none" stroke={C.line} />
      <circle cx="40" cy="90" r="5" fill={C.ink} />
      <text x="20" y="110">sensor</text>
      <rect x="70" y="60" width="30" height="18" fill="none" stroke={C.mute} strokeDasharray="3 2" />
      <Dots pts={grid(70, 60, 30, 18, 8, 5)} r={1.4} />
      <text x="62" y="50">near = dense</text>
      <rect x="250" y="95" width="30" height="18" fill="none" stroke={C.mute} strokeDasharray="3 2" />
      <Dots pts={[[258, 100], [272, 104], [262, 109]]} r={2} fill={C.red} />
      <text x="236" y="136">far = sparse</text>
    </Fig>
  );
}
