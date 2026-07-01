# App-wide CSS Cascade Layer Migration

## Goal

`game.html` loads ~30 non-SPv2 stylesheets that all shared a single
`@layer legacy { ... }` cascade layer, so their relative priority was
whatever their `<link>` load order happened to produce. That's fragile: any
reordering of `<link>` tags (or adding a new file anywhere but the very end)
can silently flip which declaration wins. The migration goal is to carve
each file out of `legacy` into its own named cascade layer with an explicit,
reasoned position in one master `@layer` statement, so priority is a
documented fact instead of an accident of load order.

This is the same technique already used to stabilize the SPv2
(`singlePlayerV2/*`) stylesheet — see `scripts/validate-single-player-v2-cascade.mjs`
— just applied to everything outside SPv2.

## Where the order lives

`game.html`'s `<head>` pre-declares the entire app's layer order in one
`@layer a, b, c, ...;` statement before any stylesheet `<link>`, so every
layer's relative position is fixed regardless of what order the files
actually load in:

```
@layer spv2.tokens, spv2.base, spv2.components, spv2.mobile, spv2.states,
       spv2.compat, constellations, dragStability, legacy, handDragFix,
       performance, screens.main-menu, screens.loadout, screens.matchmaking;
```

`scripts/validate-app-cascade-layers.mjs` asserts this exact statement,
that it appears before the first stylesheet link, and that every extracted
file's first line matches `@layer <its-name> {`. It's wired into
`npm test` via `scripts/validate-all.mjs`.

## The one rule that makes this hard

Cascade layers have reversed tie-breaking depending on `!important`:

- **Normal declarations**: the *later*-declared layer wins ties.
- **`!important` declarations**: the *earlier*-declared layer wins ties
  (importance reverses layer order).

Layer/tier comparison happens **before** selector specificity. So moving a
file into a new layer can flip an outcome that specificity alone currently
protects, and a single two-layer relative ordering can only guarantee
"always wins" or "always loses" for **one** of the two tiers at a time —
never both simultaneously.

That's why some files can be extracted trivially (independent, or all their
real conflicts point the same direction) and others can't be extracted at
all without per-selector surgery.

## Methodology (repeat for each candidate file)

1. Read the file. List every real selector/property it touches.
2. Grep the rest of the codebase for the same class/id/selector fragments to
   find actual cross-file interactions (not hypothetical ones — read the
   competing rule's real properties and values).
3. For each interaction found, determine whether the candidate file needs to
   **win** or **lose** against it. Rule out non-conflicts: different
   properties, `:not()`-based mutual exclusion, identical values (no visible
   difference regardless of who wins), or unconditional importance
   dominance (an `!important` rule always beats a normal rule regardless of
   layer).
4. If every real interaction points the same direction (always win / always
   lose), the file is a **clean one-directional extraction**. If some
   interactions need it to win and others need it to lose against the same
   other layer, it's **mixed-direction** — skip it (see below).
5. Rename the file's `@layer legacy {` to `@layer <name> {`.
6. Add `<name>` to game.html's master `@layer` statement, before `legacy` if
   it must always win the `!important` tier, after `legacy` if it must
   always lose it. Add a comment explaining the reasoning.
7. Remove the file from `legacyLayeredFiles` in
   `scripts/validate-app-cascade-layers.mjs` and add its own assertion block
   with the same reasoning comment.
8. `npm test` (static checks).
9. Empirical verification: start `scripts/serve.mjs`, drive the real page
   with Playwright (`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`
   in this sandbox), force the relevant state classes via
   `page.evaluate`, and read `getComputedStyle` for every property the file
   touches that had a real interaction.
10. `git stash push` the in-progress change, re-run the exact same Playwright
    script against the untouched baseline, diff the two outputs — they must
    match exactly. `git stash pop` to restore.
11. Run the SPv2 visual smoke test if applicable
    (`scripts/validate-single-player-v2-visual-smoke.mjs`; it no-ops
    gracefully in this sandbox since the full browser isn't installed here).
12. Delete scratch scripts, confirm `git status` is clean of anything but
    the intended 3 files (game.html, the validator, the CSS file itself).
13. Commit with the win/lose reasoning in the message, push.

Static analysis alone was tried first and abandoned: proving the whole
`legacy` pile independent this way would require verifying real DOM tags for
~2,500 selectors. The grep-and-reason-per-file approach plus empirical
Playwright verification scales; exhaustive static proof doesn't.

## Skip rule (explicit user instruction, standing)

Whenever a candidate turns out to be mixed-direction or otherwise too
entangled to cleanly verify, **skip it and move to the next candidate**,
rather than doing the harder per-selector/per-pair surgery. Only extract
files that are cleanly one-directional or fully independent. This applies
every time it comes up, not just once.

## Done so far (4 extractions, on `claude/spv2-cleanup-assessment-438tt8`)

| File | Direction | Why |
|---|---|---|
| `constellations.css` | before `legacy` | Its own rules are all normal-tier and already lose via specificity to mainMenu.css's boot veil and SPv2's base/relics z-index rules on the same `#constellationPill` element; needs to keep losing. |
| `dragStability.css` | before `legacy` | Its one rule (`transition:none!important` on `.hand .card.hand-card-dragging`) exists specifically to beat mobile.css's own `!important` transition on the same selector; needs to always win. |
| `handDragFix.css` | after `legacy` | `.handDock{z-index:26!important}` needs to keep losing to actionDropTargets.css/mpGame.css's higher, state-gated z-index overrides still in legacy; its other rules are uncontested or already dominated by an existing `spv2.components` `!important` rule regardless of position. |
| `performance.css` | after `legacy` | Its mobile/reduced-motion overrides (`body` background-attachment, `#roomAmbient` animation/opacity/transform) need to keep losing to actionDropTargets.css's SPv2-mode override and ps1aesthetic.css's explicit "re-enable candle glow on mobile" override, both still in legacy. `#ambientFX`/`.mote`/`.slot.res-*` rules checked individually: no real conflict (uncontested, unconditional importance dominance, or identical values). |

Also handled earlier (before this session, same branch): `loadout.css`,
`matchmaking.css`, and part of `mainMenu.css` were split out as fully
self-scoped standalone screens (`screens.*` layer) — the boot-veil portion
of `mainMenu.css` stays in `legacy` since it's a real cross-file dependency
(fades other files' elements, e.g. `#titleWrap`, `.spread-wrap`, `.handDock`).

**Explicitly skipped (structural wall, not "fixed"):** the multiplayer CSS
cluster (`mpGame.css`, `mpMobile.css`, `mpSpreadCards.css`, `mpFixes.css`,
`mpMultMobile.css`, `mpSinglePlayerIsolation.css`). They're provably
mode-exclusive (`mp-game-active`), which made bundling them into one shared
layer look promising, but they need to win against `legacy` on the
`!important` tier in some places and lose on it in others — impossible to
satisfy with one relative two-layer ordering. Fixing this for real would
mean per-pair/per-selector surgery, not a bulk layer move. Left in `legacy`
until/unless that harder work is requested specifically.

**Reprioritized, not touched:** `cards.css` looked like an easy independent
extraction by size, but its classes (`.title`, `.art`, `.sym`, `.plaque`,
`.scroll`, `.seal`) are reused verbatim by `market.css`, `mpMobile.css`, and
`mpSpreadCards.css` for their own card-face rendering — needs the same
per-interaction treatment as the others, not a quick win. Moved down the
list.

## What's left

Remaining files still in the shared `legacy` layer, in the order they'll be
attempted (skip-ahead rule applies throughout):

- `drawAnimation.css` — **investigation in progress, no edits made.** Its
  `.hand .card.card-draw-dealt` rule (animation/z-index/pointer-events, all
  `!important`) was being checked against hand.css/market.css's
  `.sel`/`.ability-picked`/`.purge-picked` z-index rules (999/1000, also
  `!important`) and market.css's ungated `.hand .card:not(...)` wave
  animation (normal tier, so already dominated regardless of layer). Not
  yet concluded one-directional or mixed; pick this back up first.
- `drawers.css`
- `ps1aesthetic.css`
- `actionDropTargets.css`
- `market.css`
- `mobile.css`
- `base.css`
- `hand.css`
- `spread.css`
- `cards.css` (deprioritized, see above)
- The multiplayer cluster (skipped, see above — only revisit per-file/per-pair if asked)
- 10 SPv2 files still sitting in `legacy` rather than an `spv2.*` tier:
  `singlePlayerV2/base.css`, `compat.css`, `desktop.css`, `assets.css`,
  `layout.css`, `mobile.css`, `components/spread.css`,
  `components/scoreHud.css`, `states.css`, `components/artIntegration.css`

## Verification commands

```
node scripts/validate-app-cascade-layers.mjs   # this migration's static check
npm test                                       # full validate-all suite
node scripts/validate-single-player-v2-visual-smoke.mjs  # SPv2 smoke (no-ops without a full browser)
```

For empirical checks, serve the app and drive it with Playwright:

```
node scripts/serve.mjs 8123 &
# chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }) in this sandbox
```
