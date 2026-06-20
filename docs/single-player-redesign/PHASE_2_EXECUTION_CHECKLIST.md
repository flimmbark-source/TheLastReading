# Phase 2 Execution Checklist

## Preparation complete

- [x] Art direction frozen
- [x] Material and lighting rules defined
- [x] Asset dimensions frozen
- [x] Runtime filenames frozen
- [x] Transparent-background prompt pack written
- [x] Integration selector map written
- [x] Runtime asset folder prepared
- [x] Asset replacement stylesheet prepared but not loaded
- [x] Ten-sheet replacement strategy defined
- [x] Card-sheet audit template created

## Batch A — visual proof

Produce:

- [ ] `hud-frame.png`
- [ ] `hud-score.png`
- [ ] `hud-threshold.png`
- [ ] `spread-slot.png`
- [ ] `action-primary.png`

Review each asset:

- [ ] Correct canvas dimensions
- [ ] Correct transparency
- [ ] No baked text or numbers
- [ ] Gold color and lighting are consistent
- [ ] Readable at 390 px viewport
- [ ] Readable at 360 px viewport
- [ ] Does not alter Phase 1 geometry

Batch A approval gate:

- [ ] HUD feels like one coherent object
- [ ] Score and Threshold remain the visual center
- [ ] Spread slot reads as empty placement, not a finished card
- [ ] Primary medallion is premium but not visually louder than the hand

## Batch A integration

- [ ] Add approved files under `public/ui/single-player-v2/`
- [ ] Load `src/styles/singlePlayerV2Assets.css`
- [ ] Increment stylesheet cache version
- [ ] Validate missing-asset fallback colors
- [ ] Validate labels and numbers remain live
- [ ] Validate threshold progress remains live
- [ ] Validate target glow remains visible over slot art

## Batch B — supporting shell

Produce:

- [ ] `hud-reserve.png`
- [ ] `hud-discards.png`
- [ ] `reading-circle.png`
- [ ] `hand-dock.png`
- [ ] `action-secondary.png`
- [ ] `badge-gem.png`
- [ ] `card-back.png`
- [ ] `table-bg.webp`

Review:

- [ ] Background keeps center quiet
- [ ] No persistent candle wash
- [ ] No scanlines
- [ ] Hand dock does not clip lifted cards
- [ ] Reading circle does not compete with placed cards
- [ ] Card back is clear at 100×150 px
- [ ] Full shell asset package stays near performance budget

## Batch B integration

- [ ] Add assets to runtime folder
- [ ] Assign primary/secondary action classes
- [ ] Preserve 44 px minimum touch targets
- [ ] Validate bottom actions above hand drag zone
- [ ] Validate hand renders over HUD
- [ ] Validate references, modals, and tutorials remain above hand

## Card-sheet audit

- [ ] Duplicate `card-sheet-map.template.json` as `card-sheet-map.json`
- [ ] Locate all ten current source sheets
- [ ] Record exact canvas dimensions
- [ ] Record grid dimensions
- [ ] Record card cell size
- [ ] Record gutters
- [ ] Record card order
- [ ] Record unused cells
- [ ] Confirm renderer lookup paths

## Card frame master

- [ ] Build one controlled card template
- [ ] Test at 100×150 px
- [ ] Test in hand fan
- [ ] Test in five-card spread
- [ ] Test selected/lifted state
- [ ] Test hint glow
- [ ] Freeze title, art, points, ability, and symbol regions

## Pilot sheet

- [ ] Produce `cards-sheet-01.png`
- [ ] Match source canvas exactly
- [ ] Match source cell positions exactly
- [ ] Preserve card order
- [ ] Preserve empty cells
- [ ] Confirm no frame drift
- [ ] Integrate and test before sheets 02–10

## Remaining sheets

- [ ] Sheet 02
- [ ] Sheet 03
- [ ] Sheet 04
- [ ] Sheet 05
- [ ] Sheet 06
- [ ] Sheet 07
- [ ] Sheet 08
- [ ] Sheet 09
- [ ] Sheet 10

## Phase 2 sign-off

- [ ] All shell art integrated
- [ ] All live data remains live DOM
- [ ] Phase 1 layout geometry unchanged
- [ ] Mobile readability approved at 360, 390, and 430 px
- [ ] Asset package within performance budget
- [ ] Card frame master approved
- [ ] Pilot sheet approved
- [ ] Ten-sheet production path verified
