# Phase 1 Component and Asset Contract

This document separates layout responsibilities from final art production.

## Component map

### `SinglePlayerShell`
Owns the full portrait composition and responsive height band.

Children:

- `TitleStrip`
- `PrimaryHud`
- `UtilityControls`
- `ReadingField`
- `HandDock`
- `BottomActionRail`

### `PrimaryHud`

Children:

- `ReservePanel`
- `ScorePanel`
- `ThresholdPanel`
- `DiscardsPanel`

Rules:

- Uses one shared outer frame.
- Central panels receive visual priority.
- Values remain live text.
- Threshold bar remains live CSS.

### `ReadingField`

Children:

- `ReadingCircle`
- `SpreadRow`
- Five `SpreadSlot` instances

Rules:

- Slots are generated from game state, not authored separately.
- Arc geometry is controlled through CSS custom properties.
- Final slot art must be reusable at all five positions.

### `HandDock`

Uses the existing live hand renderer and gesture logic.

Rules:

- No card faces are baked into the dock art.
- Dock art must tolerate vertical hand movement.
- The hand remains above HUD panels in the z-index contract.

### `BottomActionRail`

Children:

- Left secondary action
- Center primary action
- Right secondary action
- Reusable count badges

## Asset boundary

### Final image assets

These may contain texture, ornament, material, shadow, and non-semantic decorative symbols:

- Main table background
- Reading-circle overlay
- Top HUD outer frame
- Reserve panel shell
- Score panel shell
- Threshold panel shell
- Discards panel shell
- Spread slot frame
- Hand dock ornament
- Center action medallion
- Side action frame
- Reusable badge gem
- Card back

### Must remain live

- Reserve label and value
- Score label and value
- Threshold label and value
- Discards label and value
- Progress bar
- Reserve pips
- Discard pips or X marks
- Button counts
- Slot validity and selection states
- Cards
- Card titles, points, and ability text
- Hover, touch, drag, disabled, success, and failure feedback

## Naming convention

Place final assets under:

`public/ui/single-player-v2/`

Suggested filenames:

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

## Export requirements

### Transparent UI assets

- PNG or WebP with alpha.
- No baked labels or numbers.
- No hard-coded background rectangle unless the component requires one.
- Use consistent light direction: warm upper-left/front glow.
- Use consistent gold material and line thickness.
- Leave 8–12% transparent padding for glows and shadows.

### Table background

- Portrait master: 1536 × 2732 or larger.
- Keep critical ornamentation away from the outer 5% safe crop.
- Do not include interactive cards or UI values.
- Export WebP quality 82–90.

### HUD frame

- Design master around 1170 × 330.
- Nine-slice-friendly whenever practical.
- Segment dividers may be part of the outer frame.
- Interior panel art should remain separately replaceable.

### Spread slot

- Master aspect ratio approximately 2:3.
- Recommended master: 384 × 576.
- Border must remain legible when rendered at 64–74 px wide.
- Center design must be subtle enough not to compete with placed cards.

### Bottom controls

- Primary master: 384 × 384.
- Secondary master: 256 × 256.
- Badge master: 128 × 128.
- Keep symbols separate from frames when the meaning may change.

## Phase 1 placeholder policy

Phase 1 does not wait for final art.

Use CSS placeholders representing:

- dark material panels
- gold borders
- purple threshold accent
- warm score accent
- circular ritual markings
- slot silhouettes
- bottom medallions

Placeholders must use the same dimensions as intended final assets so replacement does not alter layout.

## Accessibility and legibility

- Text contrast target: WCAG AA where practical.
- Never rely on glow alone for legibility.
- Score and Threshold use tabular numerals.
- Labels remain visible at 360 px width.
- Progress must have shape/position distinction, not color only.
- Touch targets are at least 44 × 44 CSS px.

## Animation budget

Allowed during Phase 1:

- subtle panel emphasis
- threshold fill transition
- slot target pulse
- hand idle motion
- action-button press feedback

Not allowed during Phase 1:

- expensive full-screen particle systems
- animated background video
- continuous high-frequency filters
- motion that changes component geometry

## Handoff checklist for Phase 2 art

Phase 2 may begin only after:

- final region heights are approved
- five-slot arc is approved
- HUD segment proportions are approved
- title treatment is approved
- bottom action positions are approved
- 360, 390, and 430 px widths are validated
- compact and tall viewport behavior is validated
- live data bindings are identified
