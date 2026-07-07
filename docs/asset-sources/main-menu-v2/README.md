# Main menu v2 asset sources

Design reference for the "reading-table lobby" main menu redesign. Not loaded
at runtime — see `docs/asset-sources/README.md` for the general convention.

| File | Purpose |
|---|---|
| `sprite-sheet.jpeg` | Source contact sheet: title lockup, buttons, status bar, mode dock (normal + active states), icons, dividers, and material swatches. |
| `background.jpeg` | Source art for the candlelit reading-table background. |
| `blueprint.jpeg` | Annotated rationale mockup — the "why" behind each region of the redesigned menu. |
| `manifest.json` | Slice spec for `sprite-sheet.jpeg` — `source_box`/`size` per output sprite, same shape as `../manifest.json`. |
| `crops/` | Every candidate crop from the sheet, including ones not wired into the game (see below). |

## What got used vs. reference-only

The sheet's "Buttons" and "Status Bar" cells (`btn_continue`, `btn_new_reading`,
`status_pill` in `crops/`) render *example* text baked into the image
("Reading II · Threshold 60", etc). Per this repo's existing art-direction rule
(no baked text/numbers — see `docs/single-player-redesign/PHASE_2_ART_DIRECTION.md`),
those three are kept as reference only, not copied into `assets/`:

- The primary CTA reuses the existing blank `assets/parchment_plaque_large_center.png`
  plaque (already proven, already close to the sheet's own button styling) with
  live button text on top.
- The status pill and secondary "New Reading" action are CSS-drawn shapes with
  live text, bound to actual reading/threshold state instead of the sheet's
  example values.

Everything else in `manifest.json` has no baked dynamic text, so it was sliced
and copied into `assets/` directly (`main_menu_title.png`,
`main_menu_shop_sign.png`, `main_menu_dock_*.png`, `main_menu_icon_gear.png`,
`main_menu_table.webp`). The dock tiles are cropped just above their label so
the mode name stays live HTML underneath, matching the title/shop-sign
treatment of using the art for chrome only.

Note: `main_menu_shop_sign.png` is just the hanging-sign art. The button it's
used on opens the real-money premium store (`tlrOpenPremiumStore`, see
`src/app/premiumStore.mjs`/`src/styles/premiumStore.css`), not the in-game
Reserve-currency market (`openShopMain` in `src/ui/renderMarket.mjs`) — the
two are unrelated systems that happen to share "shop" in their names.

Elements with a black sheet backdrop (title, shop sign, dock tiles, icons,
dividers) were re-keyed from flat JPEG to real alpha transparency via a
luminance ramp (near-black → transparent, ~24/255 brightness and above →
opaque) rather than a naive color-key, since backdrop and some panel fills
sit close together in brightness. See `manifest.json`'s `"alpha"` field.

`main_menu_table.webp` also differs from `background.jpeg` in exposure:
the source photo is very underexposed as delivered (mean brightness
12/255, 83% of pixels below 20/255), which read as "the menu is too dark"
once shipped as-is with only a CSS vignette on top. The shipped copy has a
gamma correction applied (gamma 2.0: `output = 255*(input/255)^(1/2.0)`,
same curve per RGB channel) to lift shadow/midtone visibility — table
etching, chair detail, curtains — without clipping the candle-flame
highlights, which a flat linear `brightness()` multiply strong enough to
matter would have blown out well before the shadows became visible.
`background.jpeg` stays the untouched reference; regenerate the shipped
asset from it if the gamma value ever needs revisiting.
