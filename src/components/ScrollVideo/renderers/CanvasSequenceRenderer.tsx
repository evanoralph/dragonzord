"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { ScrubRendererHandle, ScrubRendererProps } from "./types";

export interface CanvasSequenceProps extends ScrubRendererProps {
  /**
   * Frame URL template containing `{i}`, e.g. "/videos/frames/frame-{i}.jpg".
   * `{i}` is replaced with a 1-based, zero-padded index.
   */
  src: string;
  frameCount: number;
  /** Digits to pad the index to. `frame-0001.jpg` -> 4. */
  pad?: number;
  /** Matches CSS object-fit. */
  fit?: "cover" | "contain";
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Not used by default. This exists so that if MP4 seeking is ever too choppy on
 * a target device, you can swap the renderer in ScrollVideo.tsx without
 * touching the ScrollTrigger logic, the overlays, or the page.
 *
 * Extract frames with:
 *   ffmpeg -i cinematic-video.mp4 -vf scale=1600:-2 -q:v 4 frames/frame-%04d.jpg
 */
const CanvasSequenceRenderer = forwardRef<ScrubRendererHandle, CanvasSequenceProps>(
  function CanvasSequenceRenderer(
    { src, frameCount, pad = 4, fps = 24, fit = "cover", className, onReady, onProgress },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const framesRef = useRef<Array<ImageBitmap | HTMLImageElement | null>>([]);
    const readyRef = useRef<Promise<number> | null>(null);
    const lastFrameRef = useRef(-1);
    const abortedRef = useRef(false);

    const urlFor = useCallback(
      (index: number) => src.replace("{i}", String(index + 1).padStart(pad, "0")),
      [src, pad]
    );

    const draw = useCallback(
      (index: number) => {
        const canvas = canvasRef.current;
        const frame = framesRef.current[index];
        if (!canvas || !frame) return;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
        }

        const fw = "width" in frame ? frame.width : 0;
        const fh = "height" in frame ? frame.height : 0;
        if (!fw || !fh) return;

        const scale =
          fit === "cover"
            ? Math.max(canvas.width / fw, canvas.height / fh)
            : Math.min(canvas.width / fw, canvas.height / fh);
        const dw = fw * scale;
        const dh = fh * scale;

        ctx.drawImage(frame as CanvasImageSource, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      },
      [fit]
    );

    const whenReady = useCallback(() => {
      if (readyRef.current) return readyRef.current;

      readyRef.current = (async () => {
        framesRef.current = new Array(frameCount).fill(null);

        const loadOne = async (index: number) => {
          const response = await fetch(urlFor(index));
          if (!response.ok) throw new Error(`ScrollVideo: missing frame ${index + 1}`);
          const blob = await response.blob();
          framesRef.current[index] =
            typeof createImageBitmap === "function"
              ? await createImageBitmap(blob)
              : await new Promise<HTMLImageElement>((resolve, reject) => {
                  const img = new Image();
                  img.onload = () => resolve(img);
                  img.onerror = reject;
                  img.src = URL.createObjectURL(blob);
                });
        };

        // Paint frame 0 as soon as it lands so the section is never blank.
        await loadOne(0);
        draw(0);
        lastFrameRef.current = 0;

        // Then fill the rest with bounded concurrency.
        let cursor = 1;
        let loaded = 1;
        const CONCURRENCY = 6;
        await Promise.all(
          Array.from({ length: CONCURRENCY }, async () => {
            while (cursor < frameCount && !abortedRef.current) {
              const index = cursor++;
              try {
                await loadOne(index);
              } catch {
                // A dropped frame just repeats the previous one; not fatal.
              }
              onProgress?.(++loaded, frameCount);
            }
          })
        );

        const duration = frameCount / fps;
        onReady?.(duration);
        return duration;
      })();

      return readyRef.current;
    }, [frameCount, fps, urlFor, draw, onReady, onProgress]);

    const seek = useCallback(
      (timeSeconds: number) => {
        const index = Math.max(0, Math.min(frameCount - 1, Math.round(timeSeconds * fps)));
        if (index === lastFrameRef.current) return;
        // Hold the last decoded frame rather than flashing an empty canvas.
        if (!framesRef.current[index]) return;
        lastFrameRef.current = index;
        draw(index);
      },
      [frameCount, fps, draw]
    );

    useEffect(() => {
      abortedRef.current = false;
      const onResize = () => {
        if (lastFrameRef.current >= 0) draw(lastFrameRef.current);
      };
      window.addEventListener("resize", onResize);
      return () => {
        abortedRef.current = true;
        window.removeEventListener("resize", onResize);
        framesRef.current.forEach((frame) => {
          if (frame && "close" in frame) frame.close();
        });
        framesRef.current = [];
      };
    }, [draw]);

    useImperativeHandle(
      ref,
      (): ScrubRendererHandle => ({
        whenReady,
        getDuration: () => frameCount / fps,
        getFps: () => fps,
        seek,
      }),
      [whenReady, seek, frameCount, fps]
    );

    return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
  }
);

export default CanvasSequenceRenderer;
