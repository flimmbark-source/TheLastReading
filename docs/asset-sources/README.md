# Asset sources (design-time only)

These files are **not loaded at runtime**. They are the source sprite sheets and
slicing specs the individual game sprites were cut from. They live here (rather
than the repo root) to keep the root clean while preserving the originals for
re-slicing.

| File | Purpose |
|---|---|
| `frames.png` | Source sprite sheet for the framed UI sprites (medallions, dividers, panels, pills) committed at the repo root / `assets/`. |
| `manifest.json` | Slice spec for `frames.png` — `source_box` / `size` per output sprite. |
| `Options-Discs.png` | Source sheet for the art-directed utility discs sliced into `public/ui/single-player-v2/elements/`. |

Runtime art the game actually loads lives under `assets/` (images, audio, card
sheets) and `public/ui/` (single-player v2 elements/events).
