import { C, Fig } from "./shared";

export function Overlap() {
  return (
    <Fig label="Two touching pallets: correct boxes touch, wrong boxes overlap">
      <text x="30" y="16" fill={C.green}>Correct</text>
      <rect x="20" y="30" width="60" height="90" fill="none" stroke={C.ink} />
      <rect x="84" y="30" width="60" height="90" fill="none" stroke={C.ink} />
      <text x="206" y="16" fill={C.red}>Wrong</text>
      <rect x="196" y="30" width="70" height="90" fill="none" stroke={C.ink} />
      <rect x="236" y="30" width="70" height="90" fill="none" stroke={C.ink} />
      <rect x="236" y="30" width="30" height="90" fill={C.red} opacity="0.3" />
      <text x="206" y="140" fill={C.red}>large overlap</text>
      <text x="20" y="140">thin gap or shared edge</text>
    </Fig>
  );
}
