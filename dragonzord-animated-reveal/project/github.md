repo: evanoralph/dragonzord
branch: main

## Last sync

date: 2026-09-12T06:52:14Z

### Updated in this project

- Recreated the pinned scroll-video stage from `ScrollVideo` (sticky viewport, scrim, crossfading overlay scenes) as a Design Component.
- Replaced the placeholder scene copy with Dragonzord information (command, armament, allegiance).
- Added an opening Dragon Power Coin logo title with letter-by-letter animation.
- Added a light-ground dossier below the stage: facts row, armament list, controllers, combinations table.

## Screen map

| Screen | Repo files |
| --- | --- |
| Dragonzord.dc.html — scroll stage | src/components/ScrollVideo/ScrollVideo.tsx, ScrollVideo.module.css, scenes.ts, renderers/VideoRenderer.tsx, renderers/types.ts |
| Dragonzord.dc.html — page shell | src/app/page.tsx, src/app/layout.tsx, src/app/globals.css |
| Assets | public/videos/cinematic-video-poster.jpg, dcab7f82888fc04dd48252ca1e31e16d.jpg |
