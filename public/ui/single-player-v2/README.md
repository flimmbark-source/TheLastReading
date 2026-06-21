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

## Active runtime art (pre-cut element tiles)

The live single-player-v2 skin loads pre-cut, alpha-keyed PNGs from
`elements/` and the full-bleed `table-bg.png`, and binds each to a CSS custom
property in `src/ui/generatedSheetAssets.mjs`. There is no runtime slicing.

| CSS variable | file | notes |
|---|---|---|
| `--spv2-title-art` | `elements/title.png` | title flourish |
| `--spv2-hud-frame-art` | `elements/hud-frame.png` | outer HUD frame |
| `--spv2-hud-reserve-art` | `elements/hud-reserve.png` | panel (label + icon baked) |
| `--spv2-hud-score-art` | `elements/hud-score.png` | panel |
| `--spv2-hud-threshold-art` | `elements/hud-threshold.png` | panel |
| `--spv2-hud-discards-art` | `elements/hud-discards.png` | panel |
| `--spv2-utility-reference-art` | `elements/utility-reference.png` | corner button |
| `--spv2-utility-settings-art` | `elements/utility-settings.png` | corner button |
| `--spv2-spread-slot-art` | `elements/spread-slot.png` | face-down slot |
| `--spv2-reading-circle-art` | `elements/reading-circle.png` | constellation circle |
| `--spv2-hand-dock-art` | `elements/hand-dock.png` | hand tray |
| `--spv2-action-eye-art` | `elements/action-eye.png` | bottom-left button |
| `--spv2-action-center-art` | `elements/action-center.png` | center medallion |
| `--spv2-action-deck-art` | `elements/action-deck.png` | bottom-right button |
| `--spv2-table-bg-art` | `table-bg.png` | full table background |

Live **values** (Reserve/Score counts, the VS divider, the threshold progress
bar, card faces) are drawn by the DOM on top — they must not be baked in. The
panel **labels and stat icons** are intentionally baked into the panel art, so
the CSS-generated duplicates are suppressed in
`src/styles/singlePlayerV2ArtIntegration.css`.

### Regenerating the tiles

`elements/*.png` are sliced from `atlas-source.png` (white matte keyed to
transparency, connected-component boxes). To refresh them, re-run the
extraction against a new `atlas-source.png` that keeps the same layout.
