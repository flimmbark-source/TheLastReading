# Phase 2 Card Sheet Specification

## Purpose

Rebuild all ten card sheets in the new visual language without changing card lookup order, sprite coordinates, gameplay data, or card footprint.

## Non-negotiable rules

1. Ten sheets remain ten sheets.
2. Each replacement sheet is one-for-one with the existing sheet it replaces.
3. Every card keeps the exact existing footprint.
4. Empty sheet cells remain empty; cards are never enlarged to fill unused space.
5. The current card order and sheet index remain unchanged.
6. Text, numbers, seals, title areas, and ability areas must use one frozen master template.
7. The template is approved at mobile render size before producing all ten sheets.

## Production sequence

### Step 1 — Audit

Before generating new cards, record for each current sheet:

- source filename
- pixel dimensions
- row count
- column count
- card cell width
- card cell height
- gutter width
- gutter height
- card identities in reading order
- unused cells

Store the completed mapping in:

`docs/single-player-redesign/card-sheet-map.json`

No art production begins until this map is complete.

### Step 2 — Freeze one card master

Produce one representative card containing:

- title treatment
- central illustration window
- point indicator
- ability plaque
- suit or Major Arcana symbol
- upright/reversed meaning treatment only if still required by the current card face

The master must be tested at the existing mobile card size, approximately 100×150 CSS px.

Approve:

- title readability
- point readability
- ability readability
- border thickness
- illustration contrast
- visual consistency with the new HUD

### Step 3 — Template, not free generation

The fixed frame and all text-bearing regions should be composited from a controlled template. AI-generated art may supply illustration content, but must not reinterpret the card frame independently on every card.

Use a deterministic layout process for:

- title position
- title font scale
- seals/point medallions
- ability plaque dimensions
- icon placement
- sheet cell placement

### Step 4 — Pilot sheet

Produce only `cards-sheet-01.png` first.

Validate:

- exact pixel dimensions
- exact cell positions
- no bleed into gutters
- no inconsistent card scaling
- correct card identity order
- readability in hand and spread
- no obvious frame drift between cells

### Step 5 — Remaining sheets

After pilot approval, produce sheets 02–10 with the same template and export settings.

## Visual direction

- Strong tarot identity, not generic fantasy cards
- Dark field with antique brass/gold frame
- High-contrast central illustration
- Clean, dominant title
- Ability plaque readable at mobile size
- Minimal tiny decorative text
- Consistent top/bottom orientation and card silhouette
- Symbols remain clear at 100×150 px

## Sheet QA

For every sheet:

- [ ] Canvas dimensions match source exactly
- [ ] Grid dimensions match source exactly
- [ ] Card cells match source exactly
- [ ] Empty cells preserved
- [ ] Card order preserved
- [ ] No text clipped
- [ ] No card stretched
- [ ] No frame reinterpreted
- [ ] Alpha/background behavior matches renderer expectations
- [ ] Tested in hand
- [ ] Tested in spread
- [ ] Tested selected/lifted
- [ ] Tested with hint glow

## Repository paths

Final replacement sheets:

`public/ui/single-player-v2/cards/cards-sheet-01.png`
through
`public/ui/single-player-v2/cards/cards-sheet-10.png`

Controlled source/template files should be stored separately under:

`art-source/single-player-v2/cards/`

Do not mix editable source files with runtime assets.
