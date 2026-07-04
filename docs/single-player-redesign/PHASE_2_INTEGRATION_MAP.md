# Phase 2 Integration Map

## Purpose

Map each produced asset to the Phase 1 live layout without changing gameplay state or DOM ownership.

## Runtime paths

All shell assets:

`/ui/single-player-v2/`

Card sheets:

`/ui/single-player-v2/cards/`

## Selector map

### Table background

Asset: `table-bg.webp`

Target:

```css
body.single-player-v2
```

Replacement behavior:

- Replace current CSS background image only.
- Preserve body sizing and fixed mobile layout.
- Do not add new content nodes.

### Reading circle

Asset: `reading-circle.png`

Target:

```css
body.single-player-v2 .spread-wrap::before
```

Replacement behavior:

- Replace generated conic/radial placeholder.
- Keep current width and aspect ratio.
- Use `background: url(...) center/contain no-repeat`.

### HUD outer frame

Asset: `hud-frame.png`

Target:

```css
body.single-player-v2 .score-stack
```

Replacement behavior:

- Apply as decorative background.
- Preserve CSS grid and live child panels.
- Do not make the image define component height.

### HUD panels

Assets and targets:

```text
hud-reserve.png   → .reserve-pill
hud-score.png     → .score-pill
hud-threshold.png → .threshold-pill
hud-discards.png  → .discards-pill
```

Replacement behavior:

- Apply as `background-image` with `100% 100%` sizing.
- Preserve live labels, values, and progress.
- Remove placeholder gradients only after assets are approved.

### Spread slot

Asset: `spread-slot.png`

Target:

```css
body.single-player-v2 .slot
```

Replacement behavior:

- Apply to all five slots.
- Preserve current 2:3 dimensions and transforms.
- Valid target/selected effects remain CSS overlays.
- Occupied slots continue to contain live cards.

### Hand dock

Asset: `hand-dock.png`

Target:

```css
body.single-player-v2 .handDock
```

Replacement behavior:

- Apply as bottom-centered transparent ornament.
- Preserve live hand movement and overflow.
- Never place dock art above cards in stacking order.

### Action frames

Assets:

- `action-primary.png`
- `action-secondary.png`
- `badge-gem.png`

Prepared selectors:

```css
.spv2-action-primary
.spv2-action-secondary
.spv2-badge
```

Integration requirement:

- Add classes to the final selected existing buttons only after the action assignment is approved.
- Keep all button labels accessible through `aria-label`.
- Icons and counts remain live.

### Card back

Asset: `card-back.png`

Target:

- Any existing hidden/deck card surface identified during card audit.
- Do not globally overwrite `.card.photo`.

## Asset CSS layer

Prepared file:

`src/styles/singlePlayerV2/assets.css`

This file is not loaded until Batch A is approved and files exist. It provides one isolated replacement layer above Phase 1 placeholder CSS.

## Cache strategy

When each batch is integrated:

- increment the query version on `singlePlayerV2/assets.css`
- keep filenames stable
- avoid renaming approved files after integration

## Fallback strategy

Every asset-backed rule must retain a dark CSS background color beneath the image. Missing or slow-loading art must not expose white or transparent unreadable UI.

## Performance budget

Recommended runtime targets:

- Table background: under 700 KB WebP
- HUD frame: under 220 KB
- Each HUD panel: under 120 KB
- Spread slot: under 120 KB
- Reading circle: under 250 KB
- Hand dock: under 300 KB
- Action assets combined: under 250 KB
- Card back: under 180 KB

The shell asset kit should remain under approximately 2.2 MB before card sheets.

## Integration order

1. Add Batch A files.
2. Load `singlePlayerV2/assets.css` behind a new cache version.
3. Validate at 360, 390, and 430 px widths.
4. Correct art, not Phase 1 geometry, unless a genuine clipping defect is discovered.
5. Add Batch B files.
6. Validate gameplay states.
7. Freeze card frame master.
8. Begin ten-sheet pilot and production.
