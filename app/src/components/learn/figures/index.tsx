import type { FigureId } from "@/content";
import type { ComponentType } from "react";
import { BoxCutsPoints } from "./BoxCutsPoints";
import { BoxTooBig } from "./BoxTooBig";
import { CuboidParams } from "./CuboidParams";
import { DensityFalloff } from "./DensityFalloff";
import { FgBg } from "./FgBg";
import { ImageVsCloud } from "./ImageVsCloud";
import { LidarTof } from "./LidarTof";
import { OcclusionShadow } from "./OcclusionShadow";
import { Overlap } from "./Overlap";
import { ViewsTopFrontSide } from "./ViewsTopFrontSide";
import { XyzAxes } from "./XyzAxes";
import { Yaw } from "./Yaw";

export const FIGURES: Record<FigureId, ComponentType> = {
  "lidar-tof": LidarTof,
  "xyz-axes": XyzAxes,
  "density-falloff": DensityFalloff,
  "image-vs-cloud": ImageVsCloud,
  "views-top-front-side": ViewsTopFrontSide,
  "fg-bg": FgBg,
  "cuboid-params": CuboidParams,
  yaw: Yaw,
  "box-too-big": BoxTooBig,
  "box-cuts-points": BoxCutsPoints,
  "occlusion-shadow": OcclusionShadow,
  overlap: Overlap,
};

export function Figure({ id }: { id: string }) {
  const F = FIGURES[id as FigureId];
  return F ? <F /> : <p className="text-[12px] text-muted">[missing figure: {id}]</p>;
}
