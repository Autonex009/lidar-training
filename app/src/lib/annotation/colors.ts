const KNOWN: Record<string, string> = {
  Vehicle: "#4f8cff", Pedestrian: "#ff5a5a", Cyclist: "#ff9f43", Pole: "#ffe119", Building: "#b0b0b0", Vegetation: "#4cd964", Unknown: "#c77dff", Ground: "#8d6e63",
};
const PALETTE = ["#4f8cff", "#ff5a5a", "#ff9f43", "#ffe119", "#4cd964", "#c77dff", "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990", "#9a6324", "#aaffc3", "#e6beff", "#808000", "#00bcd4", "#e91e63", "#8bc34a", "#795548", "#607d8b", "#ff7043", "#7e57c2"];

export function classColor(name: string, index: number): string {
  return KNOWN[name] ?? PALETTE[index % PALETTE.length];
}

export const UNLABELED_COLOR = "#4b5563";
