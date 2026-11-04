import { C, Dots, Fig, grid } from "./shared";

export function BoxCutsPoints() {
  return (
    <Fig label="Points sticking out of the box edge are circled red">
      <line x1="10" y1="150" x2="350" y2="150" stroke={C.line} />
      <rect x="110" y="70" width="110" height="80" fill="none" stroke={C.ink} strokeWidth="1.5" />
      <Dots pts={grid(110, 80, 100, 70, 12, 8)} r={1.6} />
      <Dots pts={[[232, 100], [236, 112], [229, 124], [150, 62]]} r={2} fill={C.red} />
      {[[232, 100], [236, 112], [229, 124], [150, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill="none" stroke={C.red} />)}
      <text x="240" y="70" fill={C.red}>points outside</text>
      <text x="240" y="82" fill={C.red}>the box</text>
      <text x="110" y="168">Box is too tight: it cuts the object</text>
    </Fig>
  );
}
