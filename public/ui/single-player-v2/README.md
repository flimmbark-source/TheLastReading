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

## Active runtime sheet (`generated-sheet.b64.txt`)

The live single-player-v2 skin does **not** read the individual files above. It
loads one base64-encoded WebP atlas, `generated-sheet.b64.txt`, and slices it
into tiles at runtime in `src/ui/generatedSheetAssets.mjs`.

The region map in that module is authored in a **1024 × 1337** design space and
each box is scaled by `naturalWidth / 1024` (and `naturalHeight / 1337`). This
means **any resolution sheet works** as long as it keeps the same relative
layout — the slicer is resolution-independent and a full-res sheet is drawn 1:1.

### To improve fidelity (depth / polish)

The committed `generated-sheet.b64.txt` is a **192 × 251** placeholder. Every UI
element is therefore upscaled ~5×, which is why the live UI looks softer and
flatter than the target mockup. To fix this, replace it with a full-resolution
atlas (ideally **1024 × 1337** or larger) that preserves the layout below, then
base64-encode it into `generated-sheet.b64.txt`.

Region boxes (`[x, y, width, height]`, 1024 × 1337 space):

| CSS variable | box | notes |
|---|---|---|
| `--spv2-title-art` | `[12, 12, 462, 202]` | transparent PNG/WebP |
| `--spv2-hud-frame-art` | `[486, 12, 500, 238]` | transparent frame, no values baked in |
| `--spv2-hud-reserve-art` | `[12, 262, 210, 245]` | panel, no number baked in |
| `--spv2-hud-score-art` | `[234, 262, 215, 245]` | panel |
| `--spv2-hud-threshold-art` | `[461, 262, 216, 245]` | panel, no progress bar baked in |
| `--spv2-hud-discards-art` | `[689, 262, 236, 245]` | panel |
| `--spv2-utility-reference-art` | `[12, 519, 125, 125]` | corner button |
| `--spv2-utility-settings-art` | `[149, 519, 125, 125]` | corner button |
| `--spv2-spread-slot-art` | `[286, 519, 164, 280]` | face-down slot |
| `--spv2-reading-circle-art` | `[462, 519, 380, 348]` | constellation circle |
| `--spv2-hand-dock-art` | `[12, 879, 503, 172]` | hand tray |
| `--spv2-action-eye-art` | `[527, 879, 129, 149]` | bottom-left button |
| `--spv2-action-center-art` | `[668, 879, 153, 143]` | center medallion |
| `--spv2-action-deck-art` | `[833, 879, 129, 139]` | bottom-right button |
| `--spv2-table-bg-art` | `[12, 1063, 426, 262]` | tiled table background |

Keep labels, values, progress bars, button counts, and live cards **out** of the
sheet — those are drawn by the DOM on top of the art.
