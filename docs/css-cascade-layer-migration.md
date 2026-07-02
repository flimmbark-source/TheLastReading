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
       spv2.compat, constellations, dragStability, actionDropTargets,
       legacy, handDragFix, performance, screens.main-menu, screens.loadout, screens.matchmaking;
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
9. Empirical verification: write a small probe module (default export
   `async (page) => ({...jsonSafe})`) that forces the relevant state classes
   via `page.evaluate` and reads `getComputedStyle` for every property that
   had a real interaction, then run
   `node scripts/cascade-probe.mjs <probe.mjs> -- <changed files>`. The
   harness boots the real game (New Game flow), runs the probe against the
   current tree, `git stash push`es the given files, reloads and re-runs the
   probe against that pre-extraction baseline, `git stash pop`s, and diffs
   the two JSON results — no need to hand-roll the boot/stash/diff dance per
   file anymore. Keep probe modules in the scratchpad; they're throwaway.
10. Run the SPv2 visual smoke test if applicable
    (`scripts/validate-single-player-v2-visual-smoke.mjs`; it no-ops
    gracefully in this sandbox since the full browser isn't installed here).
11. Confirm `git status` is clean of anything but the intended files
    (game.html, the validator, the CSS file itself, the doc).
12. Commit with the win/lose reasoning in the message, push.

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

## Done so far (6 extractions, on `claude/spv2-cleanup-assessment-438tt8`)

| File | Direction | Why |
|---|---|---|
| `constellations.css` | before `legacy` | Its own rules are all normal-tier and already lose via specificity to mainMenu.css's boot veil and SPv2's base/relics z-index rules on the same `#constellationPill` element; needs to keep losing. |
| `dragStability.css` | before `legacy` | Its one rule (`transition:none!important` on `.hand .card.hand-card-dragging`) exists specifically to beat mobile.css's own `!important` transition on the same selector; needs to always win. |
| `handDragFix.css` | after `legacy` | `.handDock{z-index:26!important}` needs to keep losing to actionDropTargets.css's higher state-gated z-index in its earlier layer and mpGame.css's higher state-gated z-index overrides still in legacy; its other rules are uncontested or already dominated by an existing `spv2.components` `!important` rule regardless of position. |
| `performance.css` | after `legacy` | Its mobile/reduced-motion overrides (`body` background-attachment, `#roomAmbient` animation/opacity/transform) need to keep losing to actionDropTargets.css's SPv2-mode override and ps1aesthetic.css's explicit "re-enable candle glow on mobile" override. `#ambientFX`/`.mote`/`.slot.res-*` rules checked individually: no real conflict (uncontested, unconditional importance dominance, or identical values). |
| `actionDropTargets.css` | before `legacy` | Dynamically appended by `gestureActionDrops.mjs`; all real cross-file conflicts that affect layer order are `!important` fixes that need to keep winning over the remaining `legacy` pile. Normal-tier hits from `rg` are non-conflicts (new state selectors/elements, different properties/pseudo-elements, identical values, or mode-exclusive branches). |
| `drawers.css` | after `legacy` | Needs to keep LOSING two `!important` ties (SPv2 desktop.css's `display:block!important` un-hide of `#scoringBtn`/`#abilitiesBtn`/`#menuBtn`, and drawAnimation.css's reduced-motion deal-in fade, both still in `legacy`) while needing to keep WINNING two normal-tier ties (`handCardIdleCycle` vs market.css's `card-wave`, and `#settingsPanel` sizing vs mobile.css's base rule, both still in `legacy`) — both satisfied by the same "after legacy" placement. Verified empirically via `scripts/cascade-probe.mjs`, including a `prefers-reduced-motion` emulation check. |

Also handled earlier (before this session, same branch): `loadout.css`,
`matchmaking.css`, and part of `mainMenu.css` were split out as fully
self-scoped standalone screens (`screens.*` layer) — the boot-veil portion
of `mainMenu.css` stays in `legacy` since it's a real cross-file dependency
(fades other files' elements, e.g. `#titleWrap`, `.spread-wrap`, `.handDock`).

**Explicitly skipped (structural wall, not "fixed"):** `attic.css` was already handled/skipped as not a clean extraction target: it intentionally reaches across table UI surfaces (`#titleWrap`, `.score-stack`, `.spread-wrap`, `.handDock`, `#relicRack`, `#invWrap`, `.refs-layer`, `#handSwipeZone`, `#settingsPanel`) during mode transitions and mobile hint repair. Do not attempt it again without fresh interaction proof showing those cross-file dependencies are one-directional.

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

**Explicitly skipped (structural wall, confirmed via parallel research):**

- `market.css` — sits in the middle of a documented load-order dependency
  chain (`base,spread,hand,cards,market,mobile,attic,drawers`) and needs to
  win `!important` ties against `hand.css` (`.sel`/`.ability-picked`
  z-index) while also needing to keep *losing* an `!important` tie against
  `mobile.css` (`.spread .card` box-shadow vs. `.ability-target`/
  `.ability-picked`'s highlight ring) and a normal-tier tie against
  `mobile.css` (`.relic-rack` `align-items`). No single layer position
  before/after `legacy` satisfies both.
- `ps1aesthetic.css` — needs to keep losing on the `!important` tier to
  `mpSinglePlayerIsolation.css`/`attic.css`/`singlePlayerV2/states.css`
  overrides (`.handDock`, `.hand-swipe-zone`, `.slot.target`, mobile SPv2
  `#roomAmbient` opacity) while also needing to keep losing on the *normal*
  tier to `attic.css`'s mode-gated `filter:blur(...)` on
  `#titleWrap`/`.score-stack`/`#relicRack` — normal-tier and `!important`-tier
  ties resolve in opposite layer directions, so those two requirements demand
  opposite placements relative to `legacy`.
- `drawAnimation.css` — needs to win an `!important` tie against
  `drawers.css`'s `@media(prefers-reduced-motion:reduce){.hand .card{animation:none!important}}`
  (today only via specificity: `.hand .card.card-draw-dealt` beats `.hand .card`),
  but needs to keep losing an `!important` tie against
  `singlePlayerV2/mobile.css`'s `body.single-player-v2.generated-sheet-ready
  .handDock .hand .card{pointer-events:auto!important}` (shipped in the
  compiled `singlePlayerV2/index.css`, still inside its own `legacy` block) —
  ordinary, frequent Adventure Mode traffic on mobile, not a corner case.
  Both competing rules currently live inside the same undivided `legacy`
  layer, so no single relative position satisfies both. (`.sel`/
  `.ability-picked`/`.ability-target`/`.purge-picked` z-index conflicts
  against hand.css/market.css/mobile.css are all moot — the app's reducer
  structurally clears selection/ability/purge state in the same dispatch
  that precedes any queued draw animation, so those classes never co-occur
  with `.card-draw-dealt` on the same card.)

## What's left

Remaining files still in the shared `legacy` layer, in the order they'll be
attempted (skip-ahead rule applies throughout):

- `drawers.css` — investigation in progress.
- `mobile.css`
- `base.css`
- `hand.css`
- `spread.css`
- `cards.css` (deprioritized, see above)
- `market.css` (skipped, see above)
- `ps1aesthetic.css` (skipped, see above)
- `drawAnimation.css` (skipped, see above)
- The multiplayer cluster (skipped, see above — only revisit per-file/per-pair if asked)
- 10 SPv2 files still sitting in `legacy` rather than an `spv2.*` tier:
  `singlePlayerV2/base.css`, `compat.css`, `desktop.css`, `assets.css`,
  `layout.css`, `mobile.css`, `components/spread.css`,
  `components/scoreHud.css`, `states.css`, `components/artIntegration.css`


### Extracted candidate: `actionDropTargets.css`

Investigated after confirming `attic.css` should not be retried. The stylesheet
is dynamically appended by `src/ui/gestureActionDrops.mjs`, so it previously
won same-layer ties by source order. The real cross-file conflicts that matter
for layer extraction are one-directional: candidate `!important` rules must keep
winning, so the new `actionDropTargets` layer is declared before `legacy`.
Normal-tier `rg` hits were checked as non-conflicts.

Selector/property inventory (all declarations in the file):

| Selector | Properties |
|---|---|
| `body.hand-card-action-drag-active .handDock` | `z-index:10040!important` |
| `body.hand-card-action-drag-active .hand` | `position:relative`; `z-index:10041!important` |
| `body.hand-card-action-drag-active .hand .card.hand-card-dragging`, `.hand-card-dragging` | `position:fixed!important`; `z-index:10042!important`; `pointer-events:none` |
| `body:has(#hand .card.hand-card-dragging) .handDock` | `z-index:10040!important` |
| `body:has(#hand .card.hand-card-dragging) .hand` | `position:relative`; `z-index:10041!important` |
| `body:has(#hand .card.hand-card-dragging) #hand .card.hand-card-dragging` | `position:fixed!important`; `z-index:10042!important`; `pointer-events:none` |
| `.spread-actions .sbtn.card-drop-target` | `position:relative`; `z-index:10030`; `opacity:1!important`; `transform:scale(1.04)!important`; `overflow:visible`; `transition:transform .12s ease,box-shadow .12s ease,filter .12s ease!important` |
| `.spread-actions .sbtn.card-drop-target::after` | `content:attr(data-drop-label)`; `position:absolute`; `left:50%`; `bottom:calc(100% + 8px)`; `transform:translateX(-50%)`; `min-width:max-content`; `padding:5px 9px`; `border-radius:999px`; `background:rgba(18,10,7,.96)`; `font:800 10px/1 system-ui,Segoe UI,sans-serif`; `letter-spacing:.05em`; `text-transform:uppercase`; `white-space:nowrap`; `pointer-events:none`; `box-shadow:0 7px 18px rgba(0,0,0,.68)` |
| `.spread-actions .sbtn-discard.card-drop-target` | `filter:brightness(1.16)!important`; `box-shadow:0 0 4px rgba(255,139,66,.52),0 0 11px rgba(255,94,46,.32)!important` |
| `.spread-actions .sbtn-discard.card-drop-target::after` | `color:#ffd1a4`; `border:1px solid rgba(255,135,72,.58)`; `text-shadow:0 0 5px rgba(255,108,52,.38)` |
| `.spread-actions .sbtn-purge.card-drop-target` | `filter:brightness(1.16)!important`; `box-shadow:0 0 4px rgba(189,130,255,.52),0 0 11px rgba(126,76,225,.34)!important` |
| `.spread-actions .sbtn-purge.card-drop-target::after` | `color:#e6ccff`; `border:1px solid rgba(183,126,255,.56)`; `text-shadow:0 0 5px rgba(147,91,230,.4)` |
| `#abilityPrompt .ability-prompt-actions` | `margin-left:auto`; `display:flex`; `align-items:center`; `gap:8px`; `flex:0 0 auto` |
| `#abilityPrompt .ability-prompt-actions button` | `margin-left:0!important` |
| `#abilityCancel` | `background:rgba(33,22,17,.94)!important`; `color:#cdbb98!important`; `border:1px solid rgba(133,101,54,.78)!important`; `box-shadow:none!important` |
| `#abilityCancel:hover` | `filter:brightness(1.08)` |
| `#abilityCancel[hidden]` | `display:none!important` |
| `#spread .slot` | `overflow:visible!important`; `z-index:1!important` |
| `#spread .slot > .card` | `position:relative!important`; `z-index:2!important` |
| `#spread .slot:has(> .card)` | `z-index:20!important` |
| `#spread .slot:nth-child(1):has(> .card)` | `z-index:21!important` |
| `#spread .slot:nth-child(2):has(> .card)` | `z-index:23!important` |
| `#spread .slot:nth-child(3):has(> .card)` | `z-index:25!important` |
| `#spread .slot:nth-child(4):has(> .card)` | `z-index:23!important` |
| `#spread .slot:nth-child(5):has(> .card)` | `z-index:21!important` |
| `#spread .slot:has(> .card.press-highlight)`, `#spread .slot:has(> .card.ability-picked)`, `#spread .slot:has(> .card.sel)`, `#spread .slot:has(> .card:active)` | `z-index:60!important` |
| `html body #spread .slot > .card[data-hint]` | `overflow:visible!important` |
| `#spread .slot > .card[data-hint]::after` | `z-index:140!important` |
| `.modal.show` | `z-index:10080!important` |
| `.ability-prompt.show` | `z-index:10070!important` |
| `#tutTip.show` | `z-index:10130!important` |
| `.card-detail-backdrop` | `z-index:10120!important` |
| `#packAnim.pack-anim-overlay` | `z-index:10140!important` |
| `.refs-layer:has(.ref:not(.hidden))` | `z-index:10080!important` |
| `#titleWrap:has(#settingsPanel:not(.hidden))` | `z-index:10090!important` |
| `#settingsPanel:not(.hidden)` | `z-index:10091!important` |
| `.spread-wrap:has(#scorePreview:not(.hidden))` | `z-index:10060!important` |
| `#scorePreview:not(.hidden)` | `position:relative`; `z-index:10080!important` |
| `.relic-callout`, `.inv-tut` | `z-index:10090!important` |
| `.store-relic-callout`, `.store-pack-callout` | `z-index:10150!important` |
| `#summary.modal.show:has(.tarot-shop)`, `#summary.modal.show:has(.store-front-shell)` | `z-index:10110!important` |
| shop/store `body:has(#summary ...) #discardBtn/#purgeBtn/#spv2ArchiveBtn` selectors | `z-index:10!important` |
| `html body.single-player-v2.generated-sheet-ready` | `--spv2-action-edge-gap:max(24px,6.5vw)`; `background-color:#0b0805!important`; `background-image:url('/assets/background.webp')!important`; `background-position:center top!important`; `background-size:cover!important`; `background-repeat:no-repeat!important`; `background-attachment:fixed!important` |
| `html body.single-player-v2.generated-sheet-ready::before` | `content:none`; `display:none!important`; `background:none!important` |
| `html body.single-player-v2.generated-sheet-ready .handDock` | `z-index:44!important` |
| `html body.single-player-v2.generated-sheet-ready #handSwipeZone.hand-swipe-zone` | `z-index:43!important` |
| `html body.single-player-v2.generated-sheet-ready #handSwipeZone .hand-swipe-hint` | `position:relative!important`; `z-index:2!important` |
| `html body.single-player-v2.generated-sheet-ready .hand .card[data-hint]::after` | `z-index:60!important` |
| `html body.single-player-v2.generated-sheet-ready #abilityPrompt.ability-prompt` | `top:142px!important`; `bottom:auto!important` |
| generated-sheet `#discardBtn/#purgeBtn/#menuBtn/#spv2ArchiveBtn/#scoringBtn/#abilitiesBtn` | `position:fixed!important`; `z-index:65!important` |
| generated-sheet `#discardBtn` | `top:calc(var(--spv2-hud-top) + var(--spv2-compact-hud-h) + var(--spv2-action-edge-gap))!important`; `bottom:auto!important`; `left:var(--spv2-action-edge-gap)!important`; `right:auto!important` |
| generated-sheet `#purgeBtn` | `top:calc(var(--spv2-hud-top) + var(--spv2-compact-hud-h) + var(--spv2-action-edge-gap))!important`; `bottom:auto!important`; `left:auto!important`; `right:var(--spv2-action-edge-gap)!important` |
| generated-sheet `#menuBtn/#spv2ArchiveBtn` | `top:auto!important`; `bottom:max(24px,3dvh,calc(env(safe-area-inset-bottom) + 14px))!important`; `right:auto!important` |
| generated-sheet `#menuBtn` | `left:4vw!important` |
| generated-sheet `#spv2ArchiveBtn` | `left:calc(4vw + var(--spv2-control-size,clamp(46px,12vw,58px)) + 1.2vw)!important` |
| generated-sheet `#scoringBtn/#abilitiesBtn` | `top:auto!important`; `bottom:max(24px,3dvh,calc(env(safe-area-inset-bottom) + 14px))!important`; `left:auto!important` |
| generated-sheet `#scoringBtn` | `right:calc(4vw + var(--spv2-control-size,clamp(46px,12vw,58px)) + 1.2vw)!important` |
| generated-sheet `#abilitiesBtn` | `right:4vw!important` |
| generated-sheet shop/store `#discardBtn/#purgeBtn/#spv2ArchiveBtn` selectors | `z-index:10!important` |
| generated-sheet `#discardBtn:disabled` | `opacity:.74!important`; `box-shadow:none!important` |
| generated-sheet `#discardBtn:disabled::before` | `filter:brightness(1.45) contrast(1.02) saturate(.92) drop-shadow(0 0 3px rgba(0,0,0,.42))!important` |
| generated-sheet `#discardBtn:disabled #spv2DiscardBadge` | `border-color:rgba(202,202,202,.62)!important`; `background:radial-gradient(circle at 40% 32%,#9a9a9a,#4b4b4b 78%)!important`; `color:#e2e2e2!important`; `text-shadow:0 1px 2px rgba(0,0,0,.72)!important`; `box-shadow:0 2px 4px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.14)!important` |
| generated-sheet `#discardBtn:not(:disabled)` | `box-shadow:0 0 0 1px rgba(255,217,120,.48),0 0 7px rgba(255,200,84,.34),0 0 13px rgba(100,168,255,.14)!important` |
| generated-sheet `#discardBtn:not(:disabled)::before` | `filter:brightness(2) contrast(1.06) saturate(1.12) drop-shadow(0 0 3px rgba(255,220,132,.42)) drop-shadow(0 0 6px rgba(85,156,255,.25))!important` |
| generated-sheet `:has(#purgePrompt.show) #purgeBtn` | `opacity:1!important`; `box-shadow:0 0 0 1px rgba(255,217,120,.48),0 0 7px rgba(255,200,84,.34),0 0 13px rgba(100,168,255,.14)!important`; `filter:brightness(1.55) contrast(1.05) saturate(1.08) drop-shadow(0 0 3px rgba(255,220,132,.4)) drop-shadow(0 0 6px rgba(85,156,255,.24))!important` |
| generated-sheet `#discardBtn.card-drop-target/#purgeBtn.card-drop-target` | `transform:scale(1.04)!important`; `overflow:visible!important` |
| generated-sheet `#discardBtn.card-drop-target` | `filter:brightness(1.45) contrast(1.04) saturate(1.08) drop-shadow(0 0 4px rgba(255,139,66,.58)) drop-shadow(0 0 9px rgba(255,94,46,.34))!important` |
| generated-sheet `#purgeBtn.card-drop-target` | `filter:brightness(1.4) contrast(1.05) saturate(1.08) drop-shadow(0 0 4px rgba(189,130,255,.58)) drop-shadow(0 0 9px rgba(126,76,225,.36))!important` |
| generated-sheet `#discardBtn.card-drop-target::after/#purgeBtn.card-drop-target::after` | `content:attr(data-drop-label)!important`; `display:block!important`; `position:absolute!important`; `top:calc(100% + 8px)!important`; `bottom:auto!important`; `left:50%!important`; `transform:translateX(-50%)!important`; `min-width:max-content!important`; `padding:5px 9px!important`; `border-radius:999px!important`; `background:rgba(18,10,7,.96)!important`; `font:800 10px/1 system-ui,Segoe UI,sans-serif!important`; `letter-spacing:.05em!important`; `text-transform:uppercase!important`; `white-space:nowrap!important`; `pointer-events:none!important`; `box-shadow:0 7px 18px rgba(0,0,0,.68)!important` |
| generated-sheet `#discardBtn.card-drop-target::after` | `color:#ffd1a4!important`; `border:1px solid rgba(255,135,72,.58)!important`; `text-shadow:0 0 5px rgba(255,108,52,.38)!important` |
| generated-sheet `#purgeBtn.card-drop-target::after` | `color:#e6ccff!important`; `border:1px solid rgba(183,126,255,.56)!important`; `text-shadow:0 0 5px rgba(147,91,230,.4)!important` |
| mobile `#abilityPrompt .ability-prompt-actions` | `flex-direction:column`; `gap:6px`; `align-items:stretch` |
| mobile `#abilityPrompt .ability-prompt-actions button` | `min-width:74px` |
| reduced-motion `.spread-actions .sbtn.card-drop-target` | `transition:none!important` |

Overlap classification from `rg` against `src/styles/**/*.css`:

| Overlap source found by `rg` | Classification | Reason |
|---|---|---|
| `base.css`: `body` background; `.refs-layer`; `.spread-wrap`; `.spread-actions`; buttons | Candidate must win for body/background, visible refs, score preview/action overlays, and fixed action-button states. Other button hits are non-conflicts where the candidate uses narrower state selectors or different properties. | Candidate rules are late fixes for SPv2 generated-sheet background, visible reference overlay stacking, and drag/drop affordances. They are `!important` where they overlap real legacy declarations. |
| `spread.css`: `.ability-prompt`, `.ability-prompt.show`, `.slot`, `.slot > .card` | Candidate must win for ability prompt z-index/top/bottom and spread-slot/card z-index/overflow while drag/target/hint states are active. | These are `!important` stack/position repairs over base spread layout. |
| `market.css`: `.modal.show`, `#tutTip.show`, `.refs-layer`, `.handDock`, `.relic-callout`, `.sbtn-*`, `.tarot-shop` | Candidate must win for overlay/callout z-index and shop suppression z-index; non-conflict for `.sbtn-*` size/art and `.tarot-shop` layout/background because candidate changes different properties or state-gated buttons. | Candidate only raises/lower stacks for active contextual surfaces and does not replace market card/button art dimensions. |
| `mobile.css`: `#menuBtn`, `.spread .slot.ability-*`, `.handDock`, `.hand-swipe-zone`, `#spread .slot.drop-target`, `.hand .card.hand-card-dragging` | Candidate must win for drag lift, SPv2 generated-sheet button placement/z-index, hand swipe hint z-index, and slot/card z-index/overflow; non-conflict for ability target slot color/box-shadow and drag-active transitions. | Candidate uses more specific state selectors and `!important` where it must override mobile behavior during drag/drop. |
| `handDragFix.css`: `.handDock` | Candidate must win when `hand-card-action-drag-active` or SPv2 generated-sheet state is present. | The existing extraction already documents that `handDragFix.css` must lose to action drop target z-index overrides. |
| `performance.css`: generated-sheet `body` background attachment/image | Candidate must win. | The existing extraction already documents that performance overrides must lose to the action-drop SPV2 background repair. |
| `mainMenu.css`: boot veil selectors, `#tutTip`, `#packAnim`, `#summary`, `#modal` | Non-conflict for active menu/loading modes or candidate must win for contextual surface stack once the app is interactive. | Boot veil visibility/opacity/pointer-events are separate from candidate z-index fixes; z-index fixes need to remain high when those surfaces are shown. |
| `drawers.css`: `.refs-layer`, `#settingsPanel`, pull-tab/menu surfaces, hand idle animation exclusions | Non-conflict except candidate must win visible refs/settings/score-preview stack. | Drawers mostly owns display/layout of pull desks; candidate only restores high z-index for visible contextual surfaces. |
| `attic.css`: mode transition selectors for table surfaces; `#handSwipeZone`; `#settingsPanel` | Non-conflict / mode-exclusive. | Attic mode classes intentionally hide/reposition table surfaces, but candidate action-drop states are table-interaction states; no clean attic extraction was attempted. |
| `ps1aesthetic.css`: generated-sheet body/ambient/handDock/title styling | Candidate must win for generated-sheet background attachment/image and selected z-index repairs; visual filter/aesthetic-only properties are non-conflicts. | Candidate background and z-index declarations are `!important` repairs; PS1 visual treatment does not require reversing them. |
| Multiplayer cluster (`mpGame.css`, `mpMobile.css`, `mpSpreadCards.css`, `mpFixes.css`, `mpMultMobile.css`, `mpSinglePlayerIsolation.css`) | Non-conflict for this extraction. | Multiplayer selectors are `body.mp-game-active`/opponent-surface scoped. Where they reuse `#spread`, `.handDock`, or `.hand-swipe-zone`, they either set different geometry properties or mode-exclusive MP state properties. No candidate declaration was found that must lose to preserve current MP source-order behavior. |
| SPv2 legacy files still in `legacy` and bundled SPv2 index hits: generated-sheet body, spread/slot/card, fixed utility/action buttons, hand swipe zone, hints, and discard/purge badge/labels | Candidate must win for generated-sheet action-drop/mobile repairs; non-conflict for utility icon labels, card art/layout properties, and hint states not matching `.card-drop-target`. | Candidate rules are intentionally later SPv2 repairs and use `!important` for real overlapping properties; normal-tier hits are either new `.card-drop-target`/`.ability-prompt-actions` state or different pseudo-elements/properties. |

Conclusion: clean one-directional extraction. Place `actionDropTargets` before
`legacy` so its `!important` repairs keep winning; the normal-tier overlap scan
did not identify a declaration that depends on candidate source-order winning
against another legacy normal declaration.

Independently re-verified empirically (git-stash A/B against the pre-extraction
baseline, real boot flow via Playwright) before trusting this analysis, since
it's the most state-heavy file extracted so far. One edge case looked risky on
paper and turned out fine in practice: `drawers.css`'s
`#menuPullDesk #settingsPanel{z-index:auto!important}` (specificity 2,0,0) and
this file's `#settingsPanel:not(.hidden){z-index:10091!important}`
(specificity 1,1,0) target the same element once `gestureDrawers.mjs` moves
`#settingsPanel` into `#menuPullDesk` on menu-drawer open (`CONTENT =
{menu:'settingsPanel'}` in that file) -- moving `actionDropTargets` before
`legacy` flips which one wins on paper (layer order beats specificity for
`!important` ties). But `menuControls.mjs` only drives that drawer-based
`toggleMenu` path when `tlrTogglePullTab` is installed, and that path never
clears `#settingsPanel`'s `.hidden` class -- it's shown via drawers.css's own
`#menuPullDesk #settingsPanel.hidden{display:flex!important}` override
instead. So `:not(.hidden)` never matches while the panel is parented in the
drawer in the app's current wiring; confirmed both by reading the two
`toggleMenu` implementations and by measuring `getComputedStyle` before and
after the extraction (`z-index: auto` in both cases). Also confirmed
identical: dragging-card z-index/pointer-events under
`body.hand-card-action-drag-active`, empty `#spread .slot` z-index, and
`.modal.show` z-index.

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
