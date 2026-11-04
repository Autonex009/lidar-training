import { C, Fig } from "./shared";

export function CuboidParams() {
  return (
    <Fig label="Cuboid with centre, length, width, height and heading arrow">
      <path d="M90 60h140v70H90zM90 60l40-30h140l-40 30M270 30v70l-40 30" fill="none" stroke={C.ink} strokeWidth="1.5" />
      <circle cx="180" cy="80" r="4" fill={C.red} />
      <text x="186" y="76" fill={C.red}>centre (x, y, z)</text>
      <line x1="90" y1="144" x2="230" y2="144" stroke={C.blue} markerStart="url(#ah)" markerEnd="url(#ah)" />
      <text x="140" y="158" fill={C.blue}>length</text>
      <line x1="76" y1="60" x2="76" y2="130" stroke={C.green} markerStart="url(#ah)" markerEnd="url(#ah)" />
      <text x="36" y="98" fill={C.green}>height</text>
      <line x1="236" y1="134" x2="274" y2="104" stroke={C.mute} />
      <text x="276" y="120" fill={C.mute}>width</text>
      <line x1="230" y1="95" x2="320" y2="95" stroke={C.ink} strokeWidth="2" markerEnd="url(#ah)" />
      <text x="290" y="88">heading</text>
      <text x="100" y="14">centre + size + yaw</text>
    </Fig>
  );
}
