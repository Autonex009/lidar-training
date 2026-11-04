import { Figure } from "./figures";

export type QuestionMedia = { kind: "svg"; id: string } | { kind: "image"; file: string };

export const projectImageUrl = (slug: string, file: string) => `/api/project-images/${encodeURIComponent(slug)}/${encodeURIComponent(file.split("/").pop() ?? file)}`;

export function MediaView({ media, programSlug }: { media: QuestionMedia; programSlug: string }) {
  if (media.kind === "svg") return <Figure id={media.id} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={projectImageUrl(programSlug, media.file)} alt="Reference" className="max-h-64 w-auto border border-line" />;
}
