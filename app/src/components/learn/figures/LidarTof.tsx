import { C, Dots, Fig } from "./shared";

export function LidarTof() {
  return (
    <Fig label="A sensor emits a pulse that hits an object and returns">
      <rect x="20" y="70" width="26" height="40" fill={C.fill} stroke={C.ink} />
      <text x="16" y="128">Sensor</text>
      <rect x="270" y="60" width="50" height="60" fill={C.fill} stroke={C.ink} />
      <text x="272" y="136">Object</text>
      <line x1="48" y1="82" x2="266" y2="82" stroke={C.blue} strokeWidth="1.5" markerEnd="url(#ah)" />
      <line x1="266" y1="98" x2="48" y2="98" stroke={C.green} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#ah)" />
      <text x="120" y="76" fill={C.blue}>pulse out</text>
      <text x="120" y="114" fill={C.green}>return</text>
      <Dots pts={[[270, 82], [270, 98]]} r={3.5} fill={C.red} />
      <text x="60" y="160">distance = time x speed of light / 2</text>
    </Fig>
  );
}
