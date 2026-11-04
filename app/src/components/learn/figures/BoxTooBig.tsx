import { C, Dots, Fig, grid } from "./shared";

export function BoxTooBig() {
  return (
    <Fig label="Box with large empty gaps above and to one side of the points">
      <line x1="10" y1="150" x2="350" y2="150" stroke={C.line} />
      <rect x="100" y="40" width="170" height="110" fill="none" stroke={C.ink} strokeWidth="1.5" />
      <Dots pts={grid(100, 100, 100, 50, 14, 7)} r={1.6} />
      <rect x="100" y="40" width="170" height="60" fill={C.red} opacity="0.12" />
      <rect x="200" y="100" width="70" height="50" fill={C.red} opacity="0.12" />
      <text x="140" y="74" fill={C.red}>empty space</text>
      <text x="206" y="130" fill={C.red}>empty</text>
      <text x="100" y="168">Box is much larger than the object</text>
    </Fig>
  );
}
