import { C, Fig } from "./shared";

function Variant({ cx, deg, label, bad }: { cx: number; deg: number; label: string; bad?: boolean }) {
  return (
    <g transform={`translate(${cx} 80)`}>
      <g transform={`rotate(${-deg})`}>
        <rect x="-32" y="-14" width="64" height="28" fill="none" stroke={bad ? C.red : C.ink} strokeWidth="1.5" />
        <line x1="0" y1="0" x2="48" y2="0" stroke={C.blue} strokeWidth="2" markerEnd="url(#ah)" />
      </g>
      {bad && <path d="M-8-8 8 8M8-8-8 8" stroke={C.red} strokeWidth="2" transform="translate(0 -40)" />}
      <text x="-44" y="62">{label}</text>
    </g>
  );
}

export function Yaw() {
  return (
    <Fig label="Top-down boxes with heading arrows: yaw 0, yaw 30 degrees, and a wrong box">
      <Variant cx={60} deg={0} label="yaw 0" />
      <Variant cx={180} deg={30} label="yaw 30 deg CCW" />
      <Variant cx={300} deg={90} label="wrong: 90 deg off" bad />
      <text x="8" y="14">Arrow = direction of travel (length axis)</text>
    </Fig>
  );
}
