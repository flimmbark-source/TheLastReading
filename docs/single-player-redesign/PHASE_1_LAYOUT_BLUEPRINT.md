# The Last Reading — Single-Player Redesign
## Phase 1 Layout Blueprint

Status: Ready for implementation
Target: Mobile portrait first
Primary reference viewport: 390 × 844 CSS px
Secondary validation widths: 360, 375, 412, 430 CSS px

## Phase 1 goal

Lock the new single-player screen architecture before producing final art or rebuilding the ten card sheets.

Phase 1 is complete when the screen can be represented as a responsive wireframe with the correct hierarchy, spacing, interaction zones, and live game values using placeholder art.

## Product principles

1. The game state must be readable in under one second.
2. Score and Threshold are the primary comparison.
3. Reserve and Discards are secondary resources.
4. The five-card reading is the visual center of the screen.
5. The hand remains physically present at the bottom and can move vertically without breaking HUD readability.
6. All values, labels, bars, counts, and interaction states remain live HTML/CSS.
7. Images provide frames, materials, and atmosphere only.
8. The layout must work before final artwork is introduced.

## Screen regions

### 1. Safe title strip

Purpose: Branding only.

- Height: 34–46 px depending on viewport height.
- Contains the game title or a compact emblem.
- Must never compete with Score or Threshold.
- May collapse to emblem-only on screens shorter than 760 px.

### 2. Primary HUD

Purpose: Immediate reading of the run state.

Structure:

- Reserve: 21% width
- Score: 29% width
- Threshold: 29% width
- Discards: 21% width

The Score and Threshold panels form a paired comparison in the center. Their values use the largest type in the HUD.

HUD height targets:

- 390 × 844: 112 px
- Short screens: 96 px
- Tall screens: up to 124 px

Content hierarchy:

- Label: 10–12 px uppercase
- Score/Threshold value: 28–36 px
- Reserve/Discards value: 24–31 px
- Secondary pips/bar: 8–12 px high

Threshold progress:

- Live CSS bar.
- Width represents `min(score / threshold, 1)`.
- It must remain understandable without color.

### 3. Utility controls

Purpose: Non-core controls such as references and settings.

- One circular control on each upper side.
- Minimum touch target: 44 × 44 px.
- Visual diameter may be 38–42 px with invisible hit padding.
- Must remain below modal/tutorial layers and above the table.

### 4. Reading field

Purpose: Main play area.

- Occupies the largest uninterrupted vertical region.
- Contains a subtle ritual circle or table marking.
- The actual spread is five slots in a shallow horizontal arc.
- It is not a cross.

Five-slot geometry at 390 px width:

- Slot visual width: 68–74 px
- Slot height: 102–111 px
- Horizontal overlap/gap: -4 to 2 px depending on width
- Arc vertical offsets from left to right: 10, 3, 0, 3, 10 px
- Rotations: -4°, -2°, 0°, 2°, 4°

At widths below 375 px:

- Reduce slot width to 64–68 px.
- Preserve all five slots on one row.
- Never convert to a cross or two rows.

Placement feedback:

- Empty: subdued border.
- Valid target: brighter outer ring.
- Occupied: card replaces slot face.
- Selected target: pulse or halo without changing layout.

### 5. Hand field

Purpose: Player cards and hand manipulation.

- Fixed near the bottom.
- May be lifted by the user.
- Must render over the Score/Threshold/Reserve/Discards HUD if dragged upward.
- Must remain below references, modals, and tutorials.

Hand proportions:

- Default visible hand band: 150–178 px.
- Card width target: 92–104 px.
- Five cards should form a readable fan.
- Center card may sit 8–14 px higher.

The hand is not part of the background art. It remains live DOM.

### 6. Bottom action rail

Purpose: High-frequency actions and counts.

- Central primary action medallion.
- Secondary action left.
- Secondary action right.
- Remains anchored to the bottom safe area.
- May sit visually behind the hand, but interaction targets cannot be obscured.

Minimum targets:

- Primary: 56 × 56 px
- Secondary: 48 × 48 px
- Count badge: 20–24 px

## Responsive vertical layout

Use viewport-height bands instead of one fixed composition.

### Compact: height < 760 px

- Title: 30–34 px
- HUD: 92–100 px
- Reduce utility margins.
- Spread slots: 64–68 × 96–102 px
- Hand card height: 138–146 px

### Standard: 760–900 px

- Title: 36–42 px
- HUD: 104–116 px
- Spread slots: 68–74 × 102–111 px
- Hand card height: 146–156 px

### Tall: height > 900 px

- Title: 42–48 px
- HUD: 116–126 px
- Allow additional atmosphere between HUD and spread.
- Do not scale cards beyond readability needs.

## Z-index contract

- Table/background: 0–5
- Reading field and slots: 10–19
- HUD pills: 25
- Hand dock and cards: 26
- References: 30
- Modals: 50+
- Tutorials: 90+
- Full-screen archives/overlays: existing higher layers preserved

## Live data contract

The Phase 1 HUD must bind to the existing values:

- Reserve: `#pool`
- Score: `#current`
- Threshold: `#threshold`
- Discards: `#discards`

No duplicate state stores are permitted.

## Required placeholder states

The wireframe must demonstrate:

1. Score below threshold.
2. Score close to threshold.
3. Threshold cleared.
4. Zero discards.
5. High reserve value.
6. Empty spread.
7. Partially filled spread.
8. Full five-card spread.
9. Hand lifted over the HUD.
10. Compact-height viewport.

## Phase 1 acceptance criteria

- Five spread slots remain in one horizontal spread from 360–430 px widths.
- Score and Threshold remain readable without zooming.
- No value is baked into an image.
- Hand can overlap the HUD visually.
- HUD does not block spread slots at default hand position.
- All touch targets meet 44 px minimum hit size.
- Layout survives 360 × 740 and 430 × 932.
- Existing game logic can be connected without changing scoring rules.
- Final-art production can begin without revisiting layout geometry.
