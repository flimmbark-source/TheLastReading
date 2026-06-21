# Phase 2 Transparent Asset Prompt Pack

Use these as production briefs for image generation or manual illustration. Each prompt assumes a transparent background unless noted otherwise.

## Shared style prefix

Use this prefix for every asset:

> Premium dark tarot mobile game UI asset for The Last Reading. Antique brass and restrained gold edge highlights, deep charcoal leather and dark wood, subtle occult geometry, elegant high-end mobile game finish, consistent upper-left/front lighting, crisp edges at small mobile size, physically believable materials, no scanlines, no CRT effect, no persistent candle glow, no text, no numbers, no cards, no watermark.

## Shared negative instructions

> Do not create a complete screenshot. Do not add labels, values, symbols with fixed gameplay meaning, card faces, hands, buttons with text, parchment banners, excessive bloom, bright background rectangles, or non-transparent surroundings.

## Batch A

### HUD outer frame — `hud-frame.png`

> [Shared style prefix] Create a single wide rounded HUD outer frame divided into four connected segments with proportions 21%, 29%, 29%, 21%. The center two segments should feel more important but the frame must remain one coherent object. Thin antique brass border, restrained occult corner details, clean interior openings for live text, transparent outside the frame. Master canvas 1170×336. [Shared negative instructions]

### Score panel — `hud-score.png`

> [Shared style prefix] Create a center HUD panel shell with dark leather interior, thin warm-gold edge lighting concentrated near the lower center, enough darkness and visual quiet for large live numerals. No label or number. Transparent outside the panel silhouette. Master canvas 339×336. [Shared negative instructions]

### Threshold panel — `hud-threshold.png`

> [Shared style prefix] Create a center HUD panel shell with dark violet-black interior, restrained purple magical edge light, and a visually quiet lower strip reserved for a live progress bar. No label, number, bar, or marker. Transparent outside the panel silhouette. Master canvas 339×336. [Shared negative instructions]

### Spread slot — `spread-slot.png`

> [Shared style prefix] Create one reusable empty tarot placement frame in a strict 2:3 portrait ratio. Thin antique brass border, dark recessed interior, subtle celestial compass ornament in the center, readable when rendered only 64–74 pixels wide. It must look like an empty placement slot, not a finished tarot card. Transparent outside the frame. Master canvas 384×576. [Shared negative instructions]

### Primary action medallion — `action-primary.png`

> [Shared style prefix] Create a circular central action-button frame inspired by a brass sun medallion. Dark recessed center left blank for a live icon, restrained radial ornament, premium mobile tactile depth, transparent background, generous alpha padding for glow. Master canvas 384×384. [Shared negative instructions]

## Batch B

### Reserve panel — `hud-reserve.png`

> [Shared style prefix] Create a quieter left-side HUD panel shell with dark indigo-charcoal interior and subtle brass edge details. Leave clean areas for a small live label, large live value, and live resource pips. No icons or text. Transparent outside the panel. Master canvas 246×336. [Shared negative instructions]

### Discards panel — `hud-discards.png`

> [Shared style prefix] Create a quieter right-side HUD panel shell with dark charcoal interior, restrained red accent in the lower edge, and clean areas for a live label, value, and discard marks. No skull, text, X marks, or numbers. Transparent outside the panel. Master canvas 246×336. [Shared negative instructions]

### Reading circle — `reading-circle.png`

> [Shared style prefix] Create a subtle circular occult reading diagram made from thin antique gold lines, constellations, arcs, and restrained tarot geometry. It will sit beneath five live card slots, so the center must remain quiet and low contrast. Transparent background. Master canvas 1024×1024. [Shared negative instructions]

### Hand dock — `hand-dock.png`

> [Shared style prefix] Create a wide curved bottom hand-dock ornament for a portrait mobile tarot game. Dark wood and leather base, thin brass filigree, central low-profile flourish, open upper area so live cards can lift and move without clipping. No cards, no text, no buttons. Transparent background. Master canvas 1536×560. [Shared negative instructions]

### Secondary action frame — `action-secondary.png`

> [Shared style prefix] Create a reusable circular secondary-action button frame, quieter than the primary medallion, dark recessed center left blank for a live icon, thin brass edge, transparent background. Master canvas 256×256. [Shared negative instructions]

### Count badge — `badge-gem.png`

> [Shared style prefix] Create a small blank violet gemstone count badge with a dark rim and a clean center for one or two live digits. Transparent background. Master canvas 128×128. [Shared negative instructions]

### Card back — `card-back.png`

> Premium dark tarot card back for The Last Reading, exact 2:3 portrait ratio, dark indigo-black field, antique brass frame, centered celestial compass and subtle eye motif, symmetrical design, readable at 100×150 pixels, no text, no number, no watermark. Full rectangular card image, 768×1152.

### Table background — `table-bg.webp`

This asset is not transparent.

> Full portrait dark tarot reading table background for The Last Reading, 1536×2732. Dark aged wood, subtle embedded celestial markings, restrained props only at extreme edges, large quiet central play surface, no HUD, no cards, no text, no buttons, no scanlines, no candle glow wash, no watermark. The outer 5% must be safe to crop.

## Review prompt for revisions

Use this when an asset is close but inconsistent:

> Preserve the exact silhouette, dimensions, transparency, and functional empty areas. Match the approved antique brass color, upper-left lighting direction, edge thickness, dark interior value, and restrained glow of the approved Batch A assets. Remove any baked text, numbers, card imagery, excessive bloom, or background fill.
