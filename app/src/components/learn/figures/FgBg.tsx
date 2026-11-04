import { C, Dots, Fig, grid } from "./shared";

export function FgBg() {
  return (
    <Fig label="Ground and wall in grey, objects highlighted in colour">
      <Dots pts={grid(10, 130, 340, 30, 50, 5)} fill={C.mute} r={1.2} />
      <Dots pts={grid(10, 30, 14, 100, 2, 14)} fill={C.line} r={1.4} />
      <Dots pts={grid(150, 70, 14, 60, 3, 9)} fill={C.red} r={1.6} />
      <Dots pts={grid(200, 100, 50, 30, 8, 5)} fill={C.blue} r={1.6} />
      <Dots pts={grid(280, 85, 30, 45, 5, 7)} fill={C.green} r={1.6} />
      <text x="140" y="62">person</text>
      <text x="205" y="94">pallet</text>
      <text x="282" y="78">cart</text>
      <rect x="10" y="8" width="8" height="8" fill={C.mute} /><text x="22" y="16">background = ignore</text>
      <rect x="138" y="8" width="8" height="8" fill={C.blue} /><text x="150" y="16">foreground = annotate</text>
    </Fig>
  );
}
