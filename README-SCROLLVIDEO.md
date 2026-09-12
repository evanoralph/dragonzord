# ScrollVideo — integration notes

## Read this first: your video could not have worked as-is

I probed the uploaded MP4 before writing any code:

| | Original upload | Re-encoded (`public/videos/cinematic-video.mp4`) |
|---|---|---|
| Duration | 10.000s | 10.000s |
| Resolution | 1280×720 | 1280×720 |
| Frame rate | 24 fps (240 frames) | 24 fps (240 frames) |
| **Keyframes** | **1 — at t=0 only** | **240 — every frame** |
| B-frames | 2 | 0 |
| Audio | AAC stereo | stripped |
| `moov` atom | after `mdat` | at front (`+faststart`) |
| Size | 4.3 MB | 4.1 MB |

The original has a single keyframe in the entire clip. Every `video.currentTime = t`
assignment would force the browser to decode from frame 0 up to frame *t*. Near
the end of the clip that is 239 dependent frames per seek, and reverse scrubbing
would have been a slideshow. No amount of interpolation in JavaScript fixes that —
it is a property of the file.

So the fix was in the encode, not the code:

```bash
ffmpeg -i input.mp4 -an \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
  -crf 26 -preset veryslow -movflags +faststart \
  public/videos/cinematic-video.mp4
```

`-g 1 -keyint_min 1 -sc_threshold 0` makes every frame an I-frame, so any seek is
O(1). `-bf 0` removes B-frames, which otherwise make decode order differ from
display order and add latency to short seeks. Dropping the audio track costs
nothing since the element is muted. It came out *smaller* than the original.

Re-run that command any time you swap the footage.

---

## What I could not do

There is no project in this environment — only the video file. I inspected
`/mnt/user-data/uploads`, the working directory and the outputs directory; the
upload was the only thing present. So I could not detect your framework, read
your `package.json`, or edit your files directly.

What I have instead is a complete, typechecked drop-in. Two things need your
judgement when you paste it in:

1. **Styling.** I used CSS Modules, which work unmodified in Next.js and Vite
   whether or not you also use Tailwind. If your project is consistently
   Tailwind, see the class map at the bottom and delete the `.module.css`.
2. **Paths.** Adjust the `src/components/...` prefix to match your structure.

---

## Install

```bash
npm install gsap
```

ScrollTrigger ships inside the free `gsap` package — no Club plugin, no extra
dependency. Nothing else was added.

## Files

```
public/videos/cinematic-video.mp4          ← re-encoded, all-keyframe
public/videos/cinematic-video-poster.jpg   ← first frame, 42 KB
src/components/ScrollVideo/
   ScrollVideo.tsx                         ← ScrollTrigger, pin, scrub loop, overlays
   ScrollVideo.module.css
   scenes.ts                               ← overlay copy and progress ranges
   index.ts
   renderers/
      types.ts                             ← renderer contract
      VideoRenderer.tsx                    ← default: HTML5 <video>
      CanvasSequenceRenderer.tsx           ← fallback: image sequence on canvas
```

## Use

```tsx
import ScrollVideo from "@/components/ScrollVideo";

export default function Page() {
  return (
    <>
      <Hero />
      <ScrollVideo />
      <NextSection />
    </>
  );
}
```

In the Next.js App Router the component carries its own `"use client"`, so the
page importing it stays a server component. GSAP is imported at module scope but
`registerPlugin` and every DOM read happen inside `useLayoutEffect`, so nothing
touches `window` during SSR.

All props are optional:

```tsx
<ScrollVideo
  src="/videos/cinematic-video.mp4"
  poster="/videos/cinematic-video-poster.jpg"
  fps={24}
  scenes={myScenes}
/>
```

---

## Tuning

Everything worth changing is a named constant at the top of `ScrollVideo.tsx`:

| Constant | Value | Effect |
|---|---|---|
| `PIXELS_PER_SECOND` | `450` | Scroll travel per second of footage. Your 10s clip gets 4500px. Raise for a slower, more deliberate scrub. |
| `MIN/MAX_SCROLL_DISTANCE` | `1200` / `9000` | Guard rails if you swap in a much shorter or longer clip. |
| `VIDEO_SMOOTHING` | `0.12` | Lower drifts more cinematically; higher tracks the wheel more tightly. |
| `SCENE_FADE` | `0.25` | Fraction of each scene's range spent fading. |
| `OVERLAY_TRAVEL` / `OVERLAY_BLUR` | `20px` / `6px` | Entrance offset and blur. |
| `DEBUG_MARKERS` | `false` | Set true to show ScrollTrigger markers while tuning. |

The scroll distance is derived from the measured duration, not hardcoded, and
recomputed on refresh via `invalidateOnRefresh` — so resizing recalculates
correctly and swapping the clip needs no code change.

## Overlay scenes

Edit `scenes.ts`. Ranges are in scroll progress (0–1), not seconds, so they stay
correct if the clip length or scroll distance changes. Nothing in the component
assumes a scene count — add, remove or reorder freely. Overlapping ranges
crossfade, since all scenes share one CSS grid cell.

A scene starting at `0` or ending at `1` skips the ramp on that side, so the
closing message holds at full opacity until the pin releases rather than
vanishing at the handoff.

---

## How the scrub works

```
scroll  →  ScrollTrigger.onUpdate  →  targetTime (raw, no smoothing)
                                          ↓
                       rAF loop: exponential ease toward target
                                          ↓
                  renderer.seek() — quantised to frame boundaries
```

Three details that matter:

**One source of smoothing.** ScrollTrigger reports raw progress and all easing
happens in the rAF loop. Using `scrub: 1` *and* a lerp stacks two independent
smoothers and feels laggy and unpredictable to tune.

**Framerate-independent easing.** `smoothed += diff * (1 - (1 - S) ** (dt * 60))`
rather than `diff * S`. A plain lerp runs twice as fast on a 120Hz display and
stalls on a throttled tab; this behaves identically everywhere. `dt` is clamped
to 100ms so returning to a backgrounded tab doesn't produce one huge jump.

**Frame quantisation.** `seek()` snaps to the nearest frame boundary and skips
the assignment if it would decode the same picture. Without it the loop issues
~60 seeks/sec for a 24fps clip, most of them redundant, and the decoder queue
backs up.

I simulated the loop over forward, reverse and instant-jump scroll paths:

- Slow forward 0→1: paints all **240 unique frames**, zero backward steps.
- Reverse 1→0: lands exactly on frame 0.
- Forward to end: lands exactly on frame 239, the true final frame.

## Performance

No React state is written during scrolling — `progress`, `targetTime` and
`smoothedTime` are closure variables inside the effect, and overlay opacity is
written straight to `element.style` only when a value actually changed by more
than 0.005. The component renders once and never re-renders while you scroll.

The video sits on its own compositor layer (`transform: translateZ(0)`) so seeks
don't repaint the overlay text.

## Cleanup

`gsap.context()` scoped to the section, reverted on unmount — that kills the
ScrollTrigger, removes the pin spacer and clears GSAP's inline styles. The rAF
loop is cancelled by the `matchMedia` branch cleanup. Video listeners are removed
inside `VideoRenderer` as soon as metadata arrives or loading fails. React
StrictMode's double-invoke in dev is handled by a `cancelled` flag, so the
in-flight `whenReady()` promise can't create a ScrollTrigger after unmount.

## Loading

The animation never initialises before `loadedmetadata`. `whenReady()` resolves
only once `readyState >= 1` **and** `duration` is finite and positive, so
`NaN` duration cannot reach the scroll math. If the video 404s or fails to
decode, the promise rejects and the section degrades to a static poster instead
of throwing.

## iOS

iOS Safari ignores `currentTime` until the element has been played once.
`VideoRenderer` calls `play()` then immediately `pause()` after metadata —
permitted without a gesture because the video is muted. If autoplay is blocked
anyway, the `catch` is silent and the first touch-scroll unblocks it.
`playsInline`, `webkit-playsinline`, `disablePictureInPicture` and
`disableRemotePlayback` keep it from entering the native fullscreen player.
`ScrollTrigger.config({ ignoreMobileResize: true })` stops the URL bar
collapsing from re-running the pin calculation mid-scroll.

## Reduced motion

`gsap.matchMedia()` branches on `prefers-reduced-motion`. Under `reduce` there is
no pin, no ScrollTrigger and no rAF loop at all — the section is one normal
viewport tall, shows the first frame, and the overlay copy stacks into a readable
scrollable column. GSAP swaps branches automatically if the OS setting changes.

## Responsive framing

`object-fit: cover` with `object-position: center center`, plus two overrides
worth checking against your actual footage:

- `min-aspect-ratio: 21/9` → `center 45%`, so ultra-wide crops less off the top.
- portrait ≤768px → `center 40%`, keeping the subject visible when the sides crop.

Your source is 1280×720 (16:9). On a tall phone, cover crops roughly 45% of the
frame width away — worth scrubbing through on a real device to confirm the
subject stays in frame, and adjusting those two percentages if not.

---

## If MP4 seeking is still choppy

The all-keyframe encode should make this unnecessary, but the fallback is wired
up. `ScrollVideo` talks to a `ScrubRendererHandle` interface
(`whenReady` / `getDuration` / `getFps` / `seek`) and knows nothing about video
elements. Switching renderers is two lines in `ScrollVideo.tsx`:

```bash
mkdir -p public/videos/frames
ffmpeg -i public/videos/cinematic-video.mp4 \
  -vf scale=1600:-2 -q:v 4 public/videos/frames/frame-%04d.jpg
```

```tsx
import CanvasSequenceRenderer from "./renderers/CanvasSequenceRenderer";

<CanvasSequenceRenderer
  ref={rendererRef}
  className={styles.media}
  src="/videos/frames/frame-{i}.jpg"
  frameCount={240}
  fps={24}
/>
```

The ScrollTrigger setup, pinning, overlays and page stay untouched. Note the
tradeoff: 240 JPEGs at 1600px is roughly 15–25 MB versus 4.1 MB, so only reach
for this if a real device actually demands it.

---

## Tailwind equivalents

If your project is consistently Tailwind, delete `ScrollVideo.module.css`, drop
the `styles.` references and use:

| CSS Module class | Tailwind |
|---|---|
| `.section` | `relative w-full` |
| `.viewport` | `relative w-full h-screen [height:100svh] overflow-hidden bg-black isolate` |
| `.media` | `absolute inset-0 w-full h-full object-cover object-center block pointer-events-none [transform:translateZ(0)]` |
| `.scrim` | `absolute inset-0 pointer-events-none bg-gradient-to-t from-black/55 via-transparent to-transparent` |
| `.overlays` | `absolute inset-0 grid pointer-events-none` |
| `.scene` | `[grid-area:1/1] flex p-6 md:p-20 opacity-0 invisible will-change-[opacity,transform,filter]` |
| `.sceneInner` | `max-w-lg text-white text-balance` |
| `.align_left/center/right` | `justify-start text-left` / `justify-center text-center` / `justify-end text-right` |
| `.pos_top/center/bottom` | `items-start` / `items-center` / `items-end` |
| `.eyebrow` | `mb-3 text-xs font-medium tracking-[0.18em] uppercase opacity-70` |
| `.title` | `text-3xl md:text-6xl font-semibold leading-none tracking-tight` |
| `.body` | `mt-4 text-base md:text-lg leading-relaxed opacity-80` |

Keep the responsive `object-position` overrides — they have no clean Tailwind
equivalent and are the part most likely to need adjusting for your footage.

---

## Verification performed

- TypeScript `strict` compile: clean against React 18 and React 19 typings.
- Scrub loop simulated: 240/240 frames reachable, no backward steps on forward
  scroll, exact landing on frames 0 and 239.
- Overlay opacity swept across 1001 progress points: no scene stuck visible, no
  summed opacity above 1.0, closing scene holds through progress 1.0.
- No React state updates during scroll; single render.
- `markers` disabled in the shipped code.

Not verified, because it needs a browser and your actual page: real-device scrub
feel, subject framing under mobile crop, and interaction with any smooth-scroll
library you may already have. If you use Lenis or similar, it needs
`ScrollTrigger.scrollerProxy` wiring — tell me which one and I'll add it.
