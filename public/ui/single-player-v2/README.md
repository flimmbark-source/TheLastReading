# Single-Player V2 Runtime Assets

Place approved Phase 2 runtime assets in this directory.

Expected files:

- `table-bg.webp`
- `reading-circle.png`
- `hud-frame.png`
- `hud-reserve.png`
- `hud-score.png`
- `hud-threshold.png`
- `hud-discards.png`
- `spread-slot.png`
- `hand-dock.png`
- `action-primary.png`
- `action-secondary.png`
- `badge-gem.png`
- `card-back.png`

Card sheets belong in:

`public/ui/single-player-v2/cards/`

Do not commit generated preview screenshots here. Only approved runtime assets should enter this folder.

Do not bake labels, values, progress bars, button counts, or live cards into these files.

The prepared integration layer is:

`src/styles/singlePlayerV2Assets.css`

It is intentionally not loaded until the asset files exist and Batch A has passed review.
