"use client";

import { useEffect, useRef } from "react";
import type { ViewerEngine } from "@/components/viewer/ViewerEngine";

export interface Tag { id: string; text: string; pos: [number, number, number]; color?: string }

/** Small text tags that follow 3D positions (the viewer draws boxes but not their labels). Rendered inside the viewer's canvas area. */
export function BoxTags({ getEngine, tags }: { getEngine: () => ViewerEngine | null; tags: Tag[] }) {
  const host = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLSpanElement>());
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const eng = getEngine();
      const box = host.current?.getBoundingClientRect();
      if (eng && box) {
        for (const t of tagsRef.current) {
          const el = refs.current.get(t.id);
          if (!el) continue;
          const p = eng.projectToScreen(t.pos);
          if (!p) { el.style.display = "none"; continue; }
          el.style.display = "";
          el.style.transform = `translate(${Math.round(p.x - box.left)}px, ${Math.round(p.y - box.top)}px) translate(-50%, -100%)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getEngine]);
  return (
    <div ref={host} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {tags.map((t) => (
        <span key={t.id} ref={(el) => { if (el) refs.current.set(t.id, el); else refs.current.delete(t.id); }} data-testid={`box-tag-${t.id}`}
          className="absolute left-0 top-0 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[12px] font-medium" style={{ color: t.color ?? "#fff" }}>{t.text}</span>
      ))}
    </div>
  );
}
