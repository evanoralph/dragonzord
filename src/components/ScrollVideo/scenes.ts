export type SceneAlign = "left" | "center" | "right";
export type ScenePosition = "top" | "center" | "bottom";

export interface Scene {
  id: string;
  /** Scroll progress at which the scene starts fading in (0-1). */
  start: number;
  /** Scroll progress at which the scene has finished fading out (0-1). */
  end: number;
  eyebrow?: string;
  /** Optional image above the eyebrow (e.g. Power Coin). */
  imageSrc?: string;
  imageAlt?: string;
  /** Primary title text. When titleAccent is set, this is the leading part. */
  title?: string;
  /** Optional accent-colored title suffix (e.g. "ZORD", "Power!"). */
  titleAccent?: string;
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
 *
 * Copy + timings match the Dragonzord handoff (Dragonzord.dc.html).
 */
export const SCENES: Scene[] = [
  {
    id: "intro",
    start: 0,
    end: 0.14,
    imageSrc: "/images/dragon-power-coin.jpg",
    imageAlt: "Dragon Power Coin",
    eyebrow: "Dragon Power Coin — Green",
    title: "DRAGON",
    titleAccent: "ZORD",
    body: "Summoned from the sea off Angel Grove by a flute that doubles as a blade. Scroll.",
    align: "left",
    position: "bottom",
  },
  {
    id: "command",
    start: 0.17,
    end: 0.4,
    eyebrow: "01 — Command",
    title: "Played, not piloted",
    body: "The Dragon Dagger is an enchanted flute as well as a weapon. Tommy Oliver usually commanded the Dragonzord remotely from the sidelines, taking its cockpit only when a fight demanded closer control.",
    align: "left",
    position: "bottom",
  },
  {
    id: "armament",
    start: 0.42,
    end: 0.63,
    eyebrow: "02 — Armament",
    title: "Finger missiles. Tail drill.",
    body: "Missiles launch from its fingertips, and the drill on the tip of its tail swings around to strike. Built for water, it fought submerged far better than the Dino Megazord.",
    align: "left",
    position: "bottom",
  },
  {
    id: "allegiance",
    start: 0.65,
    end: 0.84,
    eyebrow: "03 — Allegiance",
    title: "Whoever holds the coin",
    body: "The Zord answers to the Green Power Coin and the Dagger, not to a side. Rita Repulsa gave both to her evil Green Ranger; when the spell broke, Dragonzord followed Tommy to the Rangers — and when the Dagger was stolen, it turned on Angel Grove.",
    align: "right",
    position: "bottom",
  },
  {
    id: "outro",
    start: 0.86,
    end: 1.0,
    title: "Dragonzord ",
    titleAccent: "Power!",
    body: "Dormant beneath Angel Grove Bay",
    align: "left",
    position: "bottom",
  },
];

console.log("[ScrollVideo/scenes] Dragonzord scenes loaded", {
  count: SCENES.length,
  ids: SCENES.map((s) => s.id),
  withImage: SCENES.filter((s) => s.imageSrc).map((s) => s.id),
});
