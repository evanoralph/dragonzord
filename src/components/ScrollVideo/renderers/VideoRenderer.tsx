"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { ScrubRendererHandle, ScrubRendererProps } from "./types";

/**
 * Scrubs a native <video> by assigning currentTime.
 *
 * This only feels good if the source MP4 is encoded with dense keyframes.
 * With a normal web encode (one keyframe every 2-10s) the browser has to decode
 * from the previous keyframe on every seek, and backward scrubbing turns into a
 * slideshow. See README-SCROLLVIDEO.md for the encode settings.
 */
const VideoRenderer = forwardRef<ScrubRendererHandle, ScrubRendererProps>(
  function VideoRenderer({ src, poster, fps = 24, className, onReady }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const readyRef = useRef<Promise<number> | null>(null);
    const lastSeekRef = useRef(-1);

    const whenReady = useCallback(() => {
      if (readyRef.current) return readyRef.current;

      readyRef.current = new Promise<number>((resolve, reject) => {
        const video = videoRef.current;
        if (!video) {
          reject(new Error("ScrollVideo: video element is not mounted"));
          return;
        }

        const finish = async () => {
          video.removeEventListener("loadedmetadata", finish);
          video.removeEventListener("error", fail);

          // iOS Safari ignores currentTime assignments until the element has
          // been played at least once. The clip is muted, so this is allowed
          // without a user gesture; we pause again on the next tick.
          try {
            await video.play();
          } catch {
            // Autoplay blocked. Seeking still works on desktop, and on iOS the
            // first touch-scroll will unblock it.
          }
          video.pause();
          video.currentTime = 0;

          onReady?.(video.duration);
          resolve(video.duration);
        };

        const fail = () => {
          video.removeEventListener("loadedmetadata", finish);
          video.removeEventListener("error", fail);
          readyRef.current = null; // let a later call retry
          reject(new Error(`ScrollVideo: failed to load ${src}`));
        };

        // readyState >= HAVE_METADATA means duration is trustworthy.
        if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
          void finish();
        } else {
          video.addEventListener("loadedmetadata", finish);
          video.addEventListener("error", fail);
        }
      });

      return readyRef.current;
    }, [src, onReady]);

    const seek = useCallback(
      (timeSeconds: number) => {
        const video = videoRef.current;
        if (!video) return;

        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;

        const frame = 1 / fps;
        const clamped = Math.max(0, Math.min(timeSeconds, duration - frame));
        // Land a quarter-frame inside the target frame. Snapping to boundaries
        // keeps us from issuing two seeks that decode to the same picture, and
        // the offset avoids rounding landing on the seam between frames.
        const target = Math.round(clamped / frame) * frame + frame * 0.25;

        if (Math.abs(target - lastSeekRef.current) < frame * 0.5) return;
        lastSeekRef.current = target;

        if (!video.paused) video.pause();
        video.currentTime = Math.min(target, duration - 0.001);
      },
      [fps]
    );

    useImperativeHandle(
      ref,
      (): ScrubRendererHandle => ({
        whenReady,
        getDuration: () => videoRef.current?.duration ?? Number.NaN,
        getFps: () => fps,
        seek,
      }),
      [whenReady, seek, fps]
    );

    return (
      <video
        ref={videoRef}
        className={className}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="auto"
        // Stops older iOS builds hijacking into the native fullscreen player.
        webkit-playsinline="true"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden="true"
      />
    );
  }
);

export default VideoRenderer;
