"use client";

import { useMemo } from "react";
import { PointCloudViewer, assetFrameSource } from "@/components/viewer";

export function AssetPreview({ assetId, frameCount, title }: { assetId: string; frameCount: number; title: string }) {
  const frames = useMemo(() => assetFrameSource(assetId, frameCount), [assetId, frameCount]);
  return <div className="h-[calc(100vh-260px)] min-h-[420px]"><PointCloudViewer frames={frames} title={title} /></div>;
}
