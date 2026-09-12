/**
 * Renderer contract for ScrollVideo.
 *
 * ScrollVideo itself knows nothing about <video> or <canvas>. It only knows how
 * to turn scroll position into a time in seconds and hand that to a renderer.
 * That means swapping HTML5 video for an image sequence on canvas is a one-line
 * change in ScrollVideo.tsx, not a rewrite.
 */

export interface ScrubRendererHandle {
  /**
   * Resolves with the clip duration in seconds once the renderer can be seeked.
   * Safe to call repeatedly; the same promise is returned.
   */
  whenReady(): Promise<number>;
  /** Duration in seconds, or NaN before the renderer is ready. */
  getDuration(): number;
  /** Nominal frame rate, used to quantise seeks to frame boundaries. */
  getFps(): number;
  /** Show the frame at the given time. Cheap to call every rAF tick. */
  seek(timeSeconds: number): void;
}

export interface ScrubRendererProps {
  /** MP4 path for VideoRenderer, or frame-URL template for the canvas renderer. */
  src: string;
  /** First-frame image. Used for initial paint and for reduced-motion mode. */
  poster?: string;
  /** Source frame rate. Your clip is 24fps. */
  fps?: number;
  className?: string;
  /** Fired once the renderer is seekable, with the duration in seconds. */
  onReady?: (duration: number) => void;
}
