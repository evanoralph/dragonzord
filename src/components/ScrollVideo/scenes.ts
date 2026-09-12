export type SceneAlign = "left" | "center" | "right";
export type ScenePosition = "top" | "center" | "bottom";

export interface Scene {
  id: string;
  /** Scroll progress at which the scene starts fading in (0-1). */
  start: number;
  /** Scroll progress at which the scene has finished fading out (0-1). */
  end: number;
  eyebrow?: string;
  title?: string;
  body?: string;
  align?: SceneAlign;
  position?: ScenePosition;
}

/**
 * Overlay moments, expressed in scroll progress rather than seconds so they
 * stay correct if the clip or the scroll distance changes.
 *
 * Ranges may overlap — each scene fades independently, so an overlap produces a
 * crossfade. Edit freely; nothing in ScrollVideo assumes a particular count.
 */
export const SCENES: Scene[] = [
  {
    id: "intro",
    start: 0.02,
    end: 0.2,
    eyebrow: "Introducing",
    title: "Built to be seen in motion",
    body: "Every surface considered, every angle intentional.",
    align: "center",
    position: "center",
  },
  {
    id: "head",
    start: 0.22,
    end: 0.42,
    eyebrow: "The head",
    title: "Precision where it counts",
    body: "Machined tolerances measured in microns.",
    align: "left",
    position: "bottom",
  },
  {
    id: "body",
    start: 0.44,
    end: 0.62,
    eyebrow: "The system",
    title: "A single continuous body",
    body: "Fewer parts. Fewer seams. More rigidity.",
    align: "left",
    position: "bottom",
  },
  {
    id: "detail",
    start: 0.64,
    end: 0.82,
    eyebrow: "Mechanical detail",
    title: "Engineered in the open",
    body: "Nothing hidden that deserves to be shown.",
    align: "right",
    position: "bottom",
  },
  {
    id: "outro",
    start: 0.84,
    end: 1.0,
    title: "See it for yourself",
    body: "Available now.",
    align: "center",
    position: "center",
  },
];
