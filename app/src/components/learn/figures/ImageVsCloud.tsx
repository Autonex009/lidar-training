import { C, Dots, Fig, grid } from "./shared";

export function ImageVsCloud() {
  return (
    <Fig label="A photo-style scene next to the same scene as points">
      <rect x="10" y="20" width="165" height="130" fill={C.fill} stroke={C.line} />
      <text x="14" y="14">Camera image</text>
      <circle cx="60" cy="60" r="10" fill="#e8b48a" />
      <rect x="48" y="72" width="24" height="50" rx="4" fill="#4a6fa5" />
      <rect x="105" y="100" width="55" height="22" fill="#b58a54" />
      <rect x="10" y="125" width="165" height="25" fill="#cfcfcf" />
      <rect x="185" y="20" width="165" height="130" fill="#0b0b0b" stroke={C.ink} />
      <text x="189" y="14">Point cloud</text>
      <Dots pts={grid(212, 50, 22, 12, 4, 3)} fill="#fff" r={1.3} />
      <Dots pts={grid(207, 62, 32, 50, 6, 9)} fill="#fff" r={1.3} />
      <Dots pts={grid(280, 100, 55, 22, 11, 4)} fill="#fff" r={1.3} />
      <Dots pts={grid(185, 130, 165, 20, 30, 3)} fill="#6b7280" r={1} />
      <text x="190" y="165">shape and distance only</text>
    </Fig>
  );
}
