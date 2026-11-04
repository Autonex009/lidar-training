import { C, Dots, Fig, grid } from "./shared";

function Panel({ x, title, w, h, note }: { x: number; title: string; w: number; h: number; note: string }) {
  return (
    <g>
      <rect x={x} y="20" width="110" height="110" fill={C.fill} stroke={C.line} />
      <text x={x + 4} y="14" fontWeight="600">{title}</text>
      <rect x={x + 55 - w / 2} y={75 - h / 2} width={w} height={h} fill="none" stroke={C.ink} />
      <Dots pts={grid(x + 55 - w / 2, 75 - h / 2, w, h, Math.round(w / 8), Math.round(h / 8))} r={1.4} />
      <text x={x + 4} y="146">{note}</text>
    </g>
  );
}

export function ViewsTopFrontSide() {
  return (
    <Fig label="Top, front and side views of one box-shaped object">
      <Panel x={8} title="Top" w={70} h={34} note="length, width, yaw" />
      <Panel x={125} title="Front" w={34} h={50} note="width, height" />
      <Panel x={242} title="Side" w={70} h={50} note="length, height" />
    </Fig>
  );
}
