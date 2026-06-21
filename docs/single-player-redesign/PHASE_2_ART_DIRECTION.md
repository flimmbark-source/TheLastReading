# The Last Reading — Phase 2 Art Direction

Status: Ready for asset production
Scope: Single-player mobile portrait
Depends on: Approved Phase 1 geometry

## Objective

Replace the Phase 1 CSS placeholders with a coherent transparent-asset kit while preserving all live text, counters, progress, card logic, and interactions.

## Visual direction

- Premium dark tarot mobile game
- Deep wood, charcoal, antique brass, restrained gold edge light
- Purple reserved for Threshold and magical contrast
- Warm gold reserved for Score and primary actions
- Compact, readable, modern mobile HUD rather than stacked fantasy banners
- Blank reusable frames, not baked screenshots
- Physical materials should feel related but not identical
- Detail belongs in borders and ornaments; data surfaces stay quiet

## Material palette

### Base
- Near-black brown: `#0d0a08`
- Dark wood: `#17100b`
- Charcoal leather: `#191512`
- Warm parchment accent: `#d5bd8b`

### Metal
- Antique brass dark: `#6f4c20`
- Mid gold: `#a87935`
- Highlight gold: `#e3be72`

### State accents
- Score glow: `#e0a847`
- Threshold violet: `#8f74d9`
- Valid target green: `#79c778`
- Discard warning red: `#c75454`

## Lighting rules

- Shared light direction: upper-left/front
- Gold edge highlights must be thin and consistent
- Inner panels remain darker than their frames
- No full-panel bloom behind text
- Glows must include transparent padding and remain separable from content
- Avoid scanlines and CRT overlays
- Avoid candle glow as a persistent screen wash

## Surface hierarchy

1. Score and Threshold receive strongest frame contrast.
2. Reserve and Discards remain quieter and narrower.
3. Spread slots should guide placement without looking like active cards.
4. Hand dock ornament frames the live cards but must not compete with them.
5. Bottom action medallion is the strongest decorative object below the spread.

## Typography boundary

The art kit contains no labels, values, progress, counts, or card text.

Live HTML/CSS remains responsible for:

- Reserve
- Score
- Threshold
- Discards
- all numerical values
- progress bars
- pips and X marks
- button counts
- card titles and game text

## Asset production order

### Batch A — visual proof

1. `hud-frame.png`
2. `hud-score.png`
3. `hud-threshold.png`
4. `spread-slot.png`
5. `action-primary.png`

Approve this batch before generating the rest.

### Batch B — supporting shell

6. `hud-reserve.png`
7. `hud-discards.png`
8. `hand-dock.png`
9. `action-secondary.png`
10. `badge-gem.png`
11. `reading-circle.png`
12. `table-bg.webp`
13. `card-back.png`

### Batch C — card system

14. Card frame master
15. Ten replacement card sheets

## Rejection criteria

Reject any asset that:

- contains baked text or numbers
- contains cards that belong to the live hand or spread
- uses a different gold material than approved Batch A
- loses border definition at target mobile size
- adds unnecessary parchment banners
- uses heavy bloom behind live text
- cannot be cropped or scaled without changing layout
- includes a non-transparent background when transparency is required
- makes the UI read like a menu stack rather than a unified game table

## Approval views

Every transparent asset must be reviewed:

- on transparency checkerboard
- on near-black background
- at 100% master size
- at final 390 px mobile render size
- at 360 px narrow render size

## Phase 2 completion condition

Phase 2 is complete when all non-card shell assets are integrated and approved, the card-back asset is integrated, and the card frame master is frozen so the ten-sheet production can proceed without resizing or layout reinterpretation.
