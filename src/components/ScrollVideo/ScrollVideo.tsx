"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import VideoRenderer from "./renderers/VideoRenderer";
import type { ScrubRendererHandle } from "./renderers/types";
import { SCENES, type Scene } from "./scenes";
import styles from "./ScrollVideo.module.css";

/* ------------------------------------------------------------------ *
 * Tuning
 * ------------------------------------------------------------------ */

/** Virtual scroll distance granted per second of footage. Higher = slower,
 *  more deliberate scrub. 450 gives your 10s clip ~4500px of travel. */
const PIXELS_PER_SECOND = 450;
const MIN_SCROLL_DISTANCE = 1200;
const MAX_SCROLL_DISTANCE = 9000;

/** Exponential smoothing applied to currentTime, per 60fps frame.
 *  Lower = heavier, more cinematic drift. Higher = tighter to the wheel. */
const VIDEO_SMOOTHING = 0.12;

/** Fraction of a scene's range spent fading in and out. */
const SCENE_FADE = 0.25;
/** Overlay entrance offset in px, and entrance blur in px. */
const OVERLAY_TRAVEL = 20;
const OVERLAY_BLUR = 6;

/** Flip to true while tuning, then flip back. */
const DEBUG_MARKERS = false;

/* ------------------------------------------------------------------ */

export interface ScrollVideoProps {
  src?: string;
  poster?: string;
  /** Source frame rate. Your clip is 24fps. */
  fps?: number;
  scenes?: Scene[];
  className?: string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Opacity for a scene at a given scroll progress, with eased in/out ramps.
 *
 *  A scene pinned to progress 0 or 1 skips the ramp on that side. Without this
 *  the opening scene is invisible the instant the section pins, and the closing
 *  scene fades to nothing exactly as the pin releases. */
function sceneAlpha(progress: number, scene: Scene): number {
  if (progress < scene.start || progress > scene.end) return 0;
  const span = Math.max(scene.end - scene.start, 0.0001);
  const ramp = Math.max(span * SCENE_FADE, 0.0001);
  const fadeIn = scene.start <= 0 ? 1 : Math.min(1, (progress - scene.start) / ramp);
  const fadeOut = scene.end >= 1 ? 1 : Math.min(1, (scene.end - progress) / ramp);
  return easeOut(Math.max(0, Math.min(fadeIn, fadeOut)));
}

export default function ScrollVideo({
  src = "/videos/cinematic-video.mp4",
  poster = "/videos/cinematic-video-poster.jpg",
  fps = 24,
  scenes = SCENES,
  className,
}: ScrollVideoProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const overlaysRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ScrubRendererHandle | null>(null);
  const sceneRefs = useRef<Array<HTMLDivElement | null>>([]);

  useLayoutEffect(() => {
    console.log("[ScrollVideo] mount", { src, fps, sceneCount: scenes.length });
    gsap.registerPlugin(ScrollTrigger);
    // Mobile browsers fire resize when the URL bar collapses; without this the
    // pin recalculates mid-scroll and the video visibly jumps.
    ScrollTrigger.config({ ignoreMobileResize: true });

    let cancelled = false;
    let ctx: gsap.Context | null = null;

    const setup = async () => {
      const renderer = rendererRef.current;
      const section = sectionRef.current;
      if (!renderer || !section) {
        console.warn("[ScrollVideo] setup skipped — missing renderer or section");
        return;
      }

      let duration: number;
      try {
        // Never read duration before metadata exists, or it is NaN.
        duration = await renderer.whenReady();
        console.log("[ScrollVideo] video ready", { duration });
      } catch (err) {
        console.error("[ScrollVideo] video failed to load — static poster fallback", err);
        return; // video failed to load; section stays as a static poster
      }
      if (cancelled || !Number.isFinite(duration) || duration <= 0) return;

      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();

        mm.add(
          {
            animate: "(prefers-reduced-motion: no-preference)",
            reduced: "(prefers-reduced-motion: reduce)",
          },
          (context) => {
            const { reduced } = context.conditions as { animate: boolean; reduced: boolean };

            /* ---------- Reduced motion: no pin, no scrub ---------- */
            if (reduced) {
              renderer.seek(0);
              overlaysRef.current?.classList.add(styles.overlaysStatic);
              sceneRefs.current.forEach((el) => {
                if (!el) return;
                el.style.opacity = "1";
                el.style.transform = "none";
                el.style.filter = "none";
                el.style.visibility = "visible";
              });
              return () => {
                overlaysRef.current?.classList.remove(styles.overlaysStatic);
              };
            }

            /* ---------- Full scroll-scrubbed experience ---------- */
            const frameDuration = 1 / renderer.getFps();

            let targetTime = 0;
            let smoothedTime = 0;
            let progress = 0;
            let rafId = 0;
            let lastTick = performance.now();

            // Cache the last written opacity per scene so we only touch the DOM
            // when a value actually changes.
            const lastAlpha = scenes.map(() => -1);

            const paintOverlays = (p: number) => {
              for (let i = 0; i < scenes.length; i += 1) {
                const el = sceneRefs.current[i];
                if (!el) continue;
                const alpha = sceneAlpha(p, scenes[i]);
                if (Math.abs(alpha - lastAlpha[i]) < 0.005) continue;
                lastAlpha[i] = alpha;

                el.style.opacity = String(alpha);
                el.style.transform = `translate3d(0, ${((1 - alpha) * OVERLAY_TRAVEL).toFixed(2)}px, 0)`;
                el.style.filter =
                  alpha > 0.995 ? "none" : `blur(${((1 - alpha) * OVERLAY_BLUR).toFixed(2)}px)`;
                el.style.visibility = alpha <= 0.001 ? "hidden" : "visible";
              }
            };

            const tick = (now: number) => {
              rafId = requestAnimationFrame(tick);

              // Clamp dt so a backgrounded tab doesn't cause one huge jump.
              const dt = Math.min((now - lastTick) / 1000, 0.1);
              lastTick = now;

              const diff = targetTime - smoothedTime;
              if (Math.abs(diff) < frameDuration * 0.25) {
                smoothedTime = targetTime; // settle exactly, don't creep forever
              } else {
                // Framerate-independent exponential smoothing: VIDEO_SMOOTHING
                // means the same thing at 60Hz, 120Hz or on a throttled tab.
                smoothedTime += diff * (1 - Math.pow(1 - VIDEO_SMOOTHING, dt * 60));
              }

              renderer.seek(smoothedTime);
              paintOverlays(progress);
            };

            const scrollDistance = () =>
              Math.round(
                Math.max(
                  MIN_SCROLL_DISTANCE,
                  Math.min(MAX_SCROLL_DISTANCE, duration * PIXELS_PER_SECOND)
                )
              );

            ScrollTrigger.create({
              trigger: section,
              start: "top top",
              end: () => `+=${scrollDistance()}`,
              pin: true,
              pinSpacing: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              markers: DEBUG_MARKERS,
              // Raw progress. All smoothing happens in the rAF loop above, so
              // there is exactly one place that decides how the scrub feels.
              onUpdate: (self) => {
                progress = self.progress;
                targetTime = self.progress * duration;
              },
              onRefresh: (self) => {
                progress = self.progress;
                targetTime = self.progress * duration;
              },
            });

            // Paint the first frame and initial overlay state immediately.
            paintOverlays(0);
            renderer.seek(0);
            rafId = requestAnimationFrame(tick);

            return () => {
              cancelAnimationFrame(rafId);
            };
          }
        );
      }, section);

      // Layout is only final once we know the duration, so the end distance
      // and pin spacing have to be recomputed here.
      ScrollTrigger.refresh();
    };

    void setup();

    return () => {
      cancelled = true;
      // Reverts the matchMedia branches, kills the ScrollTriggers created in
      // this context, removes pin spacers and clears inline styles GSAP set.
      ctx?.revert();
    };
  }, [scenes]);

  return (
    <section ref={sectionRef} className={[styles.section, className].filter(Boolean).join(" ")}>
      <div className={styles.viewport}>
        <VideoRenderer
          ref={rendererRef}
          className={styles.media}
          src={src}
          poster={poster}
          fps={fps}
        />

        <div className={styles.scrim} aria-hidden="true" />

        <div ref={overlaysRef} className={styles.overlays}>
          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              ref={(el) => {
                sceneRefs.current[index] = el;
              }}
              className={[
                styles.scene,
                styles[`align_${scene.align ?? "center"}`],
                styles[`pos_${scene.position ?? "center"}`],
              ].join(" ")}
            >
              <div className={styles.sceneInner}>
                {scene.eyebrow ? <p className={styles.eyebrow}>{scene.eyebrow}</p> : null}
                {scene.title ? <h2 className={styles.title}>{scene.title}</h2> : null}
                {scene.body ? <p className={styles.body}>{scene.body}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
