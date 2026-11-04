import { C, Fig } from "./shared";

export function XyzAxes() {
  return (
    <Fig label="X forward, Y left, Z up axes with a sensor and a car-sized box">
      <line x1="100" y1="120" x2="320" y2="120" stroke={C.red} strokeWidth="2" markerEnd="url(#ah)" />
      <line x1="100" y1="120" x2="100" y2="20" stroke={C.blue} strokeWidth="2" markerEnd="url(#ah)" />
      <text x="322" y="124" fill={C.red}>X forward</text>
      <text x="108" y="24" fill={C.blue}>Z up</text>
      <line x1="100" y1="120" x2="40" y2="90" stroke={C.green} strokeWidth="2" markerEnd="url(#ah)" />
      <text x="8" y="86" fill={C.green}>Y left</text>
      <circle cx="100" cy="120" r="6" fill={C.ink} />
      <text x="106" y="138">sensor</text>
      <rect x="190" y="96" width="70" height="24" fill="none" stroke={C.ink} />
      <text x="196" y="90">car-sized box</text>
    </Fig>
  );
}
