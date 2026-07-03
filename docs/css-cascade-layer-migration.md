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

## Done so far (25 extractions, on `claude/spv2-cleanup-assessment-438tt8`)

Three methods are in play now, noted per row: **layer-move** (rename the
file's `@layer legacy {` and place the new layer before/after `legacy`,
per the Methodology section), **consolidation** (gather one component's
rules that were scattered across multiple `legacy` files into one new
file, in their original effective order, then give that file its own
layer — see the probe-design lessons below for why this unblocks files
a plain layer-move can't), and **pulled whole** (a component's rules were
never scattered — they already lived together in one `legacy` file — so
the extraction is just moving that self-contained block into its own
file/layer; same empirical-verification requirement as the other two,
since the file it came from can still hold *other*, unrelated rules that
compete with it). `invWrap.css`/`invTab.css` below is a fourth variant:
**pulled whole, split in two** — the same technique as tutTip, but the
gathered rules turned out to need opposite layer directions, so one
component became two files/layers instead of one. `mpGameChrome.css`
below is a fifth variant: **solo/laddered split** — mining a file that's
part of a larger cross-file "hard" bundle for an internally-solo
sub-portion (selectors with no counterpart anywhere in the sibling
ladder files), leaving the genuinely laddered remainder untouched in
its original file/layer. `mpCore` (mpGame.css's laddered core +
mpMobile.css + mpFixes.css) is a sixth variant: **trio-as-one-unit** —
three files that can't be split into DIFFERENT layers from each other
(their mutual ties depend on shared-layer source order), but don't need
to stay co-resident with the rest of `legacy` either, so all three moved
together into one new shared layer instead, preserving their relative
link order (and therefore every internal tie) exactly as it resolved in
`legacy`. One rule's declarations still had to split across two layers
within a single file (the same "split minority-direction rules into a
second layer block" technique used for mpGameChrome's exceptions), but
that's the only per-declaration surgery needed — the trio itself moved
as a whole, unlike `mpGameChrome.css`'s selector-level split. `classicCore`
(`hand.css`/`market.css`/`mobile.css`/`attic.css`/`ps1aesthetic.css`) is
the same trio-as-one-unit technique applied to what used to be this
migration's biggest unsolved problem — the five-file "structural wall"
cluster below, moved together for the exact same reason as mpCore (they
can't split from each other, but don't need to stay with the rest of
`legacy`). Extracting it also had a knock-on effect on an earlier pilot:
once two of its five files (market.css/ps1aesthetic.css) left `legacy`,
two rules that mpGameChrome.css's own pilot had kept behind specifically
to stay co-resident with them (`.card.mp-interaction`, `mp-action-btn`/
`mp-ov-btn`) needed to be revisited — one got deleted outright as
confirmed-dead code, the other moved back into `mpCore`'s main block.
See classicCore's own Done-table row below for the full writeup, and the
"re-examine skips after every extraction" section for why this cluster
turned out to be tractable now when it wasn't before.

| File | Method | Direction | Why |
|---|---|---|---|
| `constellations.css` | layer-move | before `legacy` | Its own rules are all normal-tier and already lose via specificity to mainMenu.css's boot veil and SPv2's base/relics z-index rules on the same `#constellationPill` element; needs to keep losing. |
| `dragStability.css` | layer-move | before `legacy` | Its one rule (`transition:none!important` on `.hand .card.hand-card-dragging`) exists specifically to beat mobile.css's own `!important` transition on the same selector; needs to always win. |
| `handDragFix.css` | layer-move | after `legacy` | `.handDock{z-index:26!important}` needs to keep losing to actionDropTargets.css's higher state-gated z-index in its earlier layer and mpGame.css's higher state-gated z-index overrides (now in the `mpCore` layer, still earlier than this file either way); its other rules are uncontested or already dominated by an existing `spv2.components` `!important` rule regardless of position. |
| `performance.css` | layer-move | after `legacy` | Its mobile/reduced-motion overrides (`body` background-attachment, `#roomAmbient` animation/opacity/transform) need to keep losing to actionDropTargets.css's SPv2-mode override and ps1aesthetic.css's explicit "re-enable candle glow on mobile" override. `#ambientFX`/`.mote`/`.slot.res-*` rules checked individually: no real conflict (uncontested, unconditional importance dominance, or identical values). |
| `actionDropTargets.css` | layer-move | before `legacy` | Dynamically appended by `gestureActionDrops.mjs`; all real cross-file conflicts that affect layer order are `!important` fixes that need to keep winning over the remaining `legacy` pile. Normal-tier hits from `rg` are non-conflicts (new state selectors/elements, different properties/pseudo-elements, identical values, or mode-exclusive branches). |
| `drawers.css` | layer-move | after `legacy` | Needs to keep LOSING two `!important` ties (SPv2 desktop.css's `display:block!important` un-hide of `#scoringBtn`/`#abilitiesBtn`/`#menuBtn`, and drawAnimation.css's reduced-motion deal-in fade, both still in `legacy`) while needing to keep WINNING two normal-tier ties (`handCardIdleCycle` vs market.css's `card-wave`, and `#settingsPanel` sizing vs mobile.css's base rule, both still in `legacy`) — both satisfied by the same "after legacy" placement. Verified empirically via `scripts/cascade-probe.mjs`, including a `prefers-reduced-motion` emulation check. |
| `spread.css` | layer-move | before `legacy` | Every real normal-tier interaction found (market.css's mobile `.ability-prompt`/`.spread`/`.slot`/`.slot .num` overrides, mobile.css's `.ability-target-slot`/`.ability-picked-slot` highlight colors, mpMobile.css's mobile `.slot .num`, and the SPv2 bundle's normal-tier mobile/generated-sheet layout overrides) requires spread's declarations to keep losing against files still in `legacy`; no interaction requires it to win against anything there. Verified empirically via `scripts/cascade-probe.mjs` — first attempt gave a false-positive diff from reading a live `.slot`'s `background-color` mid-`transition:.18s`, fixed by probing a freshly-created element instead. |
| `base.css` | layer-move | before `legacy` | It's the first file concatenated into `legacy`, so it already loses every normal-tier tie against every other still-in-`legacy` file by source order/specificity today (market.css's mobile `body`/`h1`/`.bar`/`.pill`/`.actions`/`button`/`.ref`/`.scoring-sheet` overrides, mobile.css's higher-specificity `.actions`/`touch-action` rules, attic.css's mode-gated `.score-stack` transform); moving it earlier just makes that load-order-proof instead of accidental. Its lone `!important` declaration (`.score-preview{display:none!important}`) has zero competing declarations anywhere in the tree. |
| `cards.css` | layer-move | before `legacy` | Zero `!important` declarations in the file. Every real normal-tier conflict (market.css's mobile `.title`/`.sym`/`.plaque`/`.seal` sizing, market.css's `.card.photo .title/.art{display:none}`, mpMobile.css's mp-mode `.seal` transform) needs cards to keep losing to files still in `legacy`, and nothing anywhere needs to lose to cards. The earlier "deprioritized" concern (its classes reused by market/mp files) turned out to be exactly this one-directional shape once actually checked. Verified empirically via `scripts/cascade-probe.mjs`. |
| `assetLazy.css` | layer-move | before `legacy` | All rules are `!important` and exist specifically to override attic.css's normal-tier background declarations on the same elements (`#atticScene::before`/`::after`, `#atticRoom`) — importance dominance already decides every current fight regardless of layer; declaring it before `legacy` keeps it winning even if a competing `!important` ever appears in the legacy pile. Its internal ungated-strip vs mode-gated-restore pair lives in one file and moves together. Verified empirically via `scripts/cascade-probe.mjs` (strip with no mode class, restore under `body.mode-attic`). |
| `drawAnimation.css` | layer-move | between `legacy` and `drawers` | Formerly a mixed-direction skip — it must WIN the `!important` tie against drawers.css's reduced-motion `.hand .card{animation:none!important}` but LOSE the `!important` ties against the SPv2 bundle's mobile `pointer-events:auto` override (still in `legacy`) and actionDropTargets' drag-lift z-index. Both directions were impossible while drawers.css shared `legacy`; once drawers got its own later layer, the slot between them satisfies everything. Verified empirically via `scripts/cascade-probe.mjs`: deal-in animation, drag-lift z-index (10042 wins over 10043), SPv2-mode pointer-events, and the reduced-motion fade all identical before/after. |
| `components/relicRack.css` | consolidation | before `legacy` | Gathers the relic rack's base market rules, classic/mobile patch, attic mobile row patch, PS1 tone, and SPv2 mobile override — previously scattered across `market.css`, `mobile.css`, `attic.css`, `ps1aesthetic.css`, and `singlePlayerV2/components/relics.css` — into one file in their original effective order, then removes every one of those scattered originals. **First placed after `legacy` (assumed unconstrained since the scattered competition was gone); this was wrong** — attic.css's mode-gated `filter:blur()` on `#relicRack` (still in `legacy`) needs to keep winning over the consolidated file's own unconditional `filter:saturate()`, previously decided by attic's higher specificity within the shared layer. Placing the new layer after `legacy` let normal-tier layer order override that specificity instead, flipping the computed filter during `body.mode-attic` from `blur(3px)` to `saturate(.7) contrast(1.03)` — caught via a git-checkout A/B against the pre-consolidation commit, not by re-reading the code, and fixed by moving to before `legacy`. Probed with `scripts/probes/relicRackCascadeProbe.mjs`. |
| `components/handSwipeZone.css` | consolidation | before `legacy` | Same technique: gathers the classic hand swipe surface, PS1 float offset, attic tutorial hint geometry, and lower swipe-capture extension — previously scattered across `mobile.css`, `ps1aesthetic.css`, `attic.css`, `handDragFix.css` — into one file in original order, then removes the scattered originals. **Also first placed after `legacy`, also wrong, same root cause:** mpMobile.css's `mp-game-active`-only height/bottom override (still in `legacy`) needs to keep losing to the consolidated file's ID-specific mobile-breakpoint rule; placing the layer after `legacy` let mpMobile.css win via layer order instead, changing computed height/bottom in plain multiplayer mode (no SPv2) from `97px`/`152px` to `46px`/`130px`, and separately let mpFixes.css's mp-mode hint-hiding rule beat the tutorial hint's ID-specific default the same way, making all three swipe-hint-line steps render at once instead of just the active one. Both fixed by the same before-`legacy` move; z-index was untouched either way (only ever set at normal-tier on the bare class inside the file, so `!important` always won regardless of position). Probed with `scripts/probes/handSwipeZoneCascadeProbe.mjs` across classic mobile/desktop, attic tutorial hints (in progress and completed), SPv2 mobile, and MP+SPv2 mobile samples (the last of which turned out to be an unreachable transient state — `body.mp-game-active` and `body.single-player-v2` are mutually exclusive at runtime via a class guard). |
| `components/tutTip.css` | pulled whole | after `legacy` (opposite direction from its siblings) | The `#tutTip` tutorial popover cluster was never scattered — it already lived together in `market.css` — so this was a whole-block move, not a gather. Most remaining touches are safe regardless of layer position (mpGame.css's `display:none!important`, actionDropTargets.css's `z-index:10130!important`, mainMenu.css's boot-veil `visibility`/`pointer-events`/`transition` are each either importance-dominant or a disjoint property) — but one is not: market.css's own mobile-breakpoint `button{font-size:12px;padding:6px 9px}` reset (still in `legacy`) needs to keep *losing* to `#tutSkipBtn`'s higher ID-based specificity, previously decided inside the shared layer. **First placed before `legacy` (mirroring relicRack/handSwipeZone, on the assumption the position was unconstrained) — wrong, but the opposite failure mode from those two:** relicRack/handSwipeZone each needed `legacy` to keep winning against them; tutTip needed *itself* to keep winning against `legacy`'s generic reset. Before `legacy`, layer order let the low-specificity `button{}` rule beat the ID-specific `#tutSkipBtn` rule outright, changing its computed `font-size`/`padding` from `11px`/`3px 8px` to `12px`/`6px 9px` and growing the popover's total height from `134px` to `144px` — caught via a full computed-style diff (every property on `#tutTip` and its children, not a hand-picked subset) against a git-checkout-A/B pre-extraction baseline, after two rounds of guessing individual properties failed to find it. Fixed by moving to after `legacy` instead; checked for the reverse risk (some legacy rule needing to win against tutTip's own low-specificity `.tut-arrow`/`.tut-foot`/`.tut-tap-prompt` selectors) and found no bare `span{}`/`div{}`/`p{}` reset anywhere in `legacy` that would compete. |
| `components/invWrap.css` + `components/invTab.css` | pulled whole, split in two | `invWrap` before `legacy`; `invTab` after `legacy` | The archive/inventory drawer (`#invWrap`/`#invDesk`) and its pull-tab (`#invTab`), pulled whole out of `mobile.css`'s base rules and `attic.css`'s mode-transition important-tier block — audited first (see "audited candidates" below) as a single "invWrap cluster" candidate, but that shape didn't survive contact with the actual rules. Two independent, opposite-direction constraints turned up: attic.css's shared 7-element mode-transition fade rule (still in `legacy`, also covers `#titleWrap`/`.score-stack`/`.spread-wrap`/`.handDock`/`#relicRack`/`.refs-layer` — so it can't be absorbed into either new file without duplicating a rule that isn't invWrap's alone) sets a normal-tier `transition` value on `#invWrap` that must keep winning via its higher specificity over `#invWrap`'s own base `transition:transform .45s...`, requiring `invWrap` *before* `legacy` (relicRack/handSwipeZone's direction) — while market.css's mobile-breakpoint `button{font-size:12px;padding:6px 9px}` reset (still in `legacy`) must keep losing to `#invTab`'s higher ID-based specificity, requiring `invTab` *after* `legacy` (tutTip's direction, the same failure mode `#tutSkipBtn` hit). One file could not satisfy both, so the pair was split before either shipped with a first-attempt regression the way the other three pilots did. Verified via a full computed-style A/B diff (every property, all three elements — `#invWrap`/`#invTab`/`#invDesk`) across seven states (classic closed/open, and all five attic mode-transition classes). First pass at a 60ms post-transition sample showed `transform`/`opacity`/`filter` diffs on `#invWrap` — re-run at a 1.5s settled-state wait (past the fade's full duration) came back byte-for-byte identical, confirming those were mid-animation sampling noise (same class of false-positive as the doc's other two documented cases), not a regression; the `transition` property itself and every `#invTab` property matched at both wait lengths, which was the actual signal. |
| `components/titleWrap.css` | pulled whole, partitioned | after `legacy` | Takes `#titleWrap`/`.score-stack`'s share of the originally 7-element attic fade rule that `invWrap.css` left behind — the selector list is *partitioned* out of it (no selector appears in both this file and the other split-off pieces), but the declaration *values* are necessarily duplicated (every piece needs its own full copy of the same opacity/transform/filter/pointer-events/transition values) — a genuine, deliberate `!important` budget increase of 5 (706 → 711), unlike every prior pilot's net-zero move. Declared after `legacy`, same direction as tutTip/invTab: ps1aesthetic.css's unconditional `filter:saturate()` on both elements (still in `legacy`) must keep losing to this file's mode-gated `filter:blur()` during attic transitions, previously decided by the fade rule's higher specificity within the shared layer; base.css's unconditional `.score-stack{transform:translateX(-50%)}` needs the same outcome but is trivially satisfied since base is declared far earlier than legacy already. Verified via a full computed-style A/B diff technique, across all five mode-transition states plus classic: a settled 1.5s-wait sample came back byte-for-byte identical; a 60ms mid-transition sample showed the same class of `opacity`/`filter` sampling noise as invWrap (and, reassuringly, identical noise values between `#titleWrap` and `.score-stack` within each run, since one rule drives both). |
| `components/atticFade.css` | pulled whole, partitioned | after `legacy` | Takes the fade rule's remaining four elements: `.spread-wrap`/`.handDock`/`#relicRack`/`.refs-layer`. `#invWrap` deliberately stays out — it already works correctly as `attic.css`'s own single-selector rule (see `invWrap.css`'s reasoning), and moving it here too would be redundant, not incorrect. This is the candidate the original audit rejected as "bigger scope than a single pilot"; re-examined once titleWrap.css proved selector-partition-without-full-duplication works, and a full per-property check (every remaining touch on all four elements, against opacity/transform/filter/pointer-events/transition specifically) found every one either property-disjoint or important-tier (importance-dominant regardless of layer) — the multiplayer cluster's `.spread-wrap`/`.handDock` geometry overrides are all `!important`, and ps1aesthetic.css's `.handDock` rule never touches `filter` the way its `#titleWrap`/`.score-stack` rules do. `#relicRack`'s own unconditional `filter:saturate(.7) contrast(1.03)` (in the `relicRack` layer, before `legacy`) needs to keep losing to this file's mode-gated `filter:blur()`, same as always — `relicRack` stays earlier than `legacy` either way, so this file (after `legacy`) stays later than `relicRack` regardless of specificity. Same partition/duplication trade as titleWrap.css: another genuine `!important` budget increase of 5 (711 → 716). Verified the same way: a settled 1.5s-wait full computed-style A/B diff across all five mode-transition states plus classic came back byte-for-byte identical for all four elements *and* `#invWrap` (confirming leaving `#invWrap` behind didn't disturb it), including `#relicRack`'s `filter:blur(3px)` in `mode-attic` specifically — the exact property/value that regressed in the original `relicRack.css` pilot. A 60ms mid-transition sample showed the same small class of `opacity`/`filter` sampling noise as the other two pilots. |
| `mpMultMobile.css` | layer-move | before `legacy` | The first crack in the multiplayer cluster: extracted **one file at a time** instead of bundling all six `mp*.css` files into one shared layer, which is the approach that failed before (see the "explicitly skipped" note below). Its four target selectors (`.mp-pills-opp`/`.mp-pills-self`/`.mp-pill-score`/`.mp-mult-inline`) appear nowhere in the app except `mpGame.css`/`mpMobile.css`/`mpFixes.css` (still in `legacy`), and every one of those other touches sets properties (`display`, `grid-row`/`grid-column`/`justify-self`, `width`/`height`/`padding`/`font-size`) disjoint from this file's own (`position`/`overflow`/`right`/`top`/`transform`/`margin-left`/`pointer-events`/`padding-left`/`box-sizing`) — zero property overlap anywhere, so its layer position is genuinely unconstrained; declared before `legacy` for consistency with the other unconstrained layer-moves. Its elements (`.mp-pill-score`, `.mp-mult-inline`) are purely dynamic — never present in static markup, only created by multiplayer JS — so verified via synthetic elements matching the exact selector structure (`body.mp-game-active`, mobile viewport) rather than a real multiplayer session: a full computed-style A/B diff came back byte-for-byte identical against the pre-extraction baseline. |
| `mpSpreadCards.css` | layer-move | before `legacy` | The second crack in the cluster. Every declaration in it is `!important`, and nothing else sets that tier on the same property for its `#spread .slot > .card` / `#mpOppSpread .slot > .card` targets (or their `.photo`/`.title` descendants) — `actionDropTargets.css`'s `position`/`z-index` on the same selector is a disjoint property, `mpFixes.css`'s `width`/`height` there targets the `.slot` itself rather than the `.card` inside it, and `market.css`'s unconditional non-important `.card.photo{background-size:200% 200%}` is importance-dominated regardless of layer (the values happen to match anyway). SPv2's own `#spread .slot > .card` hint rules are gated by `body.single-player-v2`, mutually exclusive with `body.mp-game-active` at runtime. Genuinely unconstrained for the same reasons as `mpMultMobile.css`; the file's original "loads after mpGame.css/mpMobile.css" comment predates this migration's importance-tier reasoning — importance dominance already made load order moot for every real conflict found. Verified the same way: synthetic `#spread`/`#mpOppSpread` slot-card elements, full computed-style A/B diff, byte-for-byte identical against baseline. |
| `mpSinglePlayerIsolation.css` | layer-move | before `legacy` | The third crack, and a different shape from the first two — not property-disjoint, just dead. Every rule in the file is gated by `body.mp-game-active.single-player-v2` (all of them, no exception), and those two classes are enforced mutually exclusive at runtime by `src/app/mpModeClassGuard.mjs`'s `MutationObserver`: the instant `mp-game-active` is added, `single-player-v2` is stripped on the same microtask, before the next paint. No other file in the app references this combined gate. So the file's entire ruleset is unreachable in any rendered frame, and its layer position genuinely cannot affect real behavior regardless of where it's declared. Verified by reading computed style in the actual transient window itself — set all three classes in one synchronous assignment and read immediately, before the guard's microtask could run (confirmed via `document.body.className` in the probe output: all three classes were still present at read time) — a full computed-style A/B diff on synthetic `#spread`/`#mpOppSpread`/`.handDock`/`#handSwipeZone` elements came back byte-for-byte identical against the pre-extraction baseline even in that window. |
| `components/mpGameChrome.css` | solo/laddered split | before `legacy` | The fourth crack, and a different technique from the first three: `mpGame.css`, `mpMobile.css`, and `mpFixes.css` form a genuine ~50-property-pair cross-file responsive-breakpoint ladder (confirmed via a full selector/property audit, not just reference-counting) that can't be split into different layers without swapping source-order resolution for layer-order resolution — the same shape that broke the reverted `hand.css` extraction. But 61 of `mpGame.css`'s 91 rules turned out to have no counterpart at all in `mpMobile.css`/`mpFixes.css` — its own top bar, player rows, opponent hand/badges, opponent spread state decorations, progress bar, and scoring overlay — and moved to this new file. Three families almost shipped wrong, all caught only by a full computed-style A/B diff against a real baseline, never by static reasoning: (1) `#spread .slot.mp-targetable`/`.mp-anchored`/`.mp-silenced`/`.mp-swap-a`/`.mp-swap-pick` (and their `.mp-opp-spread-transform` mirror) compete against `ps1aesthetic.css`'s bare `.slot{border-color:...!important}` and need this file *before* `legacy` to keep winning via specificity — genuinely required, not just consistency; (2) `.card.mp-interaction` looked unconstrained (only `hand.css`'s non-important base `.card` rule was found by static grep) but actually already loses a same-layer specificity tie to `ps1aesthetic.css`'s `.card:not(.photo){...!important}` via source order — `:not()` contributes its argument's specificity, so `.card:not(.photo)` and `.card.mp-interaction` tie exactly — meaning `.card.mp-interaction`'s own gradient has never rendered, a pre-existing dead-code situation confirmed against a true git-checkout baseline (not a probe artifact); extracting it would have revived dead code by swapping that tie-break for plain layer order; (3) the `mp-action-btn` family and `mp-ov-btn` also looked unconstrained, but in the *opposite* direction from (1): both render as real `<button>` elements (verified in `src/app/mpGame.mjs`) and need to keep beating `market.css`'s mobile-breakpoint bare `button{font-size:12px;padding:6px 9px}` reset via specificity — the same conflict already documented for `tutTip.css`'s `#tutSkipBtn` — which requires *after* `legacy`, the opposite of (1). One file position can't satisfy both (1) and (3), and neither (2) nor (3) has `!important` declarations of its own to make a cross-layer move net-zero, so both stayed behind in `mpGame.css`/`legacy` instead of spinning up a third layer for two small rule families. Verified via a comprehensive computed-style A/B diff (every extracted selector plus the laddered-core sanity checks) across the full split; the only remaining diff was the same `.mp-turn-badge.my-turn` animation-timing sampling noise documented elsewhere in this doc. |
| `mpCore` (mpGame.css's laddered core, mpMobile.css, mpFixes.css) | trio-as-one-unit | after `legacy` | The sixth crack: instead of a per-file layer-move, all three files that form the confirmed ~50-property-pair cross-file ladder moved together into one new shared layer, declared in the same relative link order (mpGame.css, mpMobile.css, mpFixes.css) so every internal tie between them keeps resolving via source order exactly as it did in `legacy` — nothing requires them to stay co-resident with the *rest* of `legacy` specifically, only with each other. A full selector/property audit against every other file in the app (everything still in `legacy`, every already-extracted layer, all 10 SPv2 files) found the trio's real external conflicts point overwhelmingly one direction: ~8 normal-tier specificity ties where the trio's higher specificity needs to keep beating bare, lower-specificity rules in `market.css`/`hand.css`/`spread.css` (`mpGame.css`'s `.mp-opp-spread-transform .spread`, `mpMobile.css`'s `#spread .slot .num`/`.hand .card` grid-template-rows/`.hand .card .seal` transform), requiring *after* `legacy`. Exactly one exception pointed the opposite way: `mpMobile.css`'s `.handDock{bottom,background}` needs to keep beating `ps1aesthetic.css`'s unconditional (not mode-gated), important-tier `.handDock` rule via specificity, requiring *before* `legacy`. Those two declarations were split into a small residual `legacy` block in `mpMobile.css` (mirroring `mpGameChrome.css`'s exception-splitting technique) rather than moving the whole trio the wrong way. Every already-extracted before-`legacy` multiplayer file (`mpMultMobile.css`/`mpSpreadCards.css`/`mpSinglePlayerIsolation.css`/`components/mpGameChrome.css`) is unaffected — they stay before `legacy` regardless of which side of `legacy` the trio sits on, since before-`legacy` < `legacy` < `mpCore` either way. The one already-extracted file with a real touch is `handDragFix.css`'s bare, important-tier `.handDock{z-index:26}`, which `mpGame.css`'s higher-specificity z-index override needs to keep beating — `mpCore` is declared immediately after `legacy`, before `handDragFix` and everything else already after it, none of which showed any real conflict with the trio. (`classicCore` was originally declared immediately after `legacy` too, i.e. immediately before `mpCore` — later moved to immediately *before* `legacy` instead to fix a regression; see `classicCore`'s own row below. Either way it stays transitively earlier than `mpCore`.) Verified via a full computed-style A/B diff across all three breakpoints (max-width:640px, the 380×740 narrow variant, min-width:641px desktop) using direct element references rather than `document.querySelector` (game.html has real static elements with the same ids/classes as the synthetic probe elements — `#spread`, `#mpGame`, `#modal`, `.hand`, `.handDock`, `.spread-wrap` all collide, and querying by selector after creation silently matched the wrong element; see the probe-design lessons below). The only remaining diffs were sub-pixel/sub-degree noise in `.card`'s continuous ambient wave animation (rotate/translate/filter), a property untouched by any of the three files. |
| `classicCore` (hand.css, market.css, mobile.css, attic.css, ps1aesthetic.css) | trio-as-one-unit (five-wide) | before `legacy` (shipped after `legacy` first — see the regression note below) | Resolves this migration's former "structural wall" (see the now-historical skip verdicts below). These five files form a deliberate cross-file specificity ladder with EACH OTHER — confirmed the hard way by an earlier, reverted attempt to extract `hand.css` alone: `market.css`'s mobile block deliberately uses LOW-specificity overrides and relies on `hand.css`'s HIGHER-specificity state combos (`.hand .card.ability-target.hint-card`, `.hand .card.hint-card.sel`, etc.) to keep beating them via specificity, and `mobile.css`/`attic.css`/`ps1aesthetic.css` lean on similar relationships. Layer separation removes specificity from the comparison entirely, which is exactly what broke that attempt. Like `mpCore`, the fix wasn't to solve the ladder — it was recognizing that nothing requires these five to stay co-resident with the *rest* of `legacy`, only with EACH OTHER, so all five moved together, in their original relative link order (hand, market, mobile, attic, ps1aesthetic), preserving every internal tie exactly as it resolved in `legacy`. **Regression, caught and fixed before it was reported:** the extraction first shipped `classicCore` *after* `legacy`, on the strength of a full selector/property audit against every other file in the app that found the cluster's real external conflicts pointing that direction — but that audit checked every already-extracted layer and every other `legacy`-resident file *except* the 10 SPv2 source files still sharing `legacy` themselves. Those ten files' `body.single-player-v2`-prefixed rules rely on much higher specificity to beat this cluster's classic-mode rules on shared elements (`#titleWrap`, `#menuBtn`, `.score-stack`, `#spread .slot`, among others) — previously decided by specificity within the one shared `legacy` layer, same as every other still-in-`legacy` tie. Declaring `classicCore` after `legacy` silently swapped that for pure layer order: since `classicCore` was now the later layer, it started winning every one of those normal-tier ties regardless of the SPv2 files' higher specificity — **286 real same-tier conflicts**, confirmed by a dedicated audit script and then by a computed-style A/B diff against a true pre-`classicCore` baseline (`body.single-player-v2`'s `#titleWrap` `filter` read back as `ps1aesthetic.css`'s `saturate(.74)` instead of `none`; `#menuBtn`'s `z-index`/`padding`/`border`/`color` all read back as `market.css`'s classic-mode values). This shipped as a real regression in single-player-v2 mode before it was caught — not by a bug report, but by re-checking `classicCore`'s relationship with the SPv2 files before starting to migrate them, per this doc's own "re-examine skips after every extraction" rule (see that section below). Moving `classicCore` to *before* `legacy` (immediately preceding it, the last of the before-`legacy` layers) restores the specificity-based tie-break for all ten SPv2 files and still satisfies every direction the original audit found: `classicCore` has to stay declared before `mpCore` (its `.mp-opp-spread-transform .spread`/`#spread .slot .num`/`.hand .card` family needs to keep winning normal-tier specificity ties against this cluster's bare rules), before `drawAnimation.css` (its `.hand .card.card-draw-dealt` `will-change` needs the same), before `drawers.css` (its `handCardIdleCycle` idle-sway needs to keep beating this cluster's own `card-wave`), and before `titleWrap.css` (its mode-gated `filter:blur()` on `.score-stack`/`#titleWrap` needs to keep beating this cluster's unconditional `filter:saturate()`), and before `performance.css` (`ps1aesthetic.css`'s important-tier `#roomAmbient` override needs to keep *winning* against `performance.css`'s mobile override, and important-tier ties favor the earlier layer) — before-`legacy` is earlier than after-`legacy` either way, so none of those directions flip, and every already-extracted before-`legacy` layer (dragStability, actionDropTargets, spread, base, cards, assetLazy, the multiplayer cracks, relicRack, handSwipeZone, invWrap, constellations) is unaffected too, since `classicCore` was already later than all of them as the last "after legacy" layer and stays later than all of them as the last "before legacy" layer. The one real trade-off: `mainMenu.css`'s zero-specificity `:where(...)` boot-veil rule and `attic.css`'s own `#atticScene` transition now tie the other way during boot states (`mainMenu.css` wins instead of `attic.css`'s after-`legacy` layer-order trick) — checked via the same true-baseline technique and found to only change an invisible transition duration on an element that isn't visible during boot either way, accepted given the alternative was a confirmed, visible single-player-v2 regression. Two cascading fixes fell out of the original extraction in `mpGame.css`, both unaffected by the position fix: `mp-action-btn`/`mp-ov-btn` moved back into `mpCore`'s main block, since `market.css`'s before-`mpCore` position either way already wins their font-size/padding fight via normal-tier layer order without the same-layer specificity trick they used to need; and `.card.mp-interaction` — which only existed to preserve a same-layer specificity tie against `ps1aesthetic.css` that kept it correctly dead — was deleted outright once `ps1aesthetic.css` moved to `classicCore` too, a genuine (if small) important-tier budget reduction rather than a net-zero move. While reconciling the budget for this pilot, the actual summed total across the tracked app-wide files turned out to be 713 pre-extraction, not the 716 the budget constant claimed — the check is a ceiling (`total <= importantBudget`), not an exact tally, so that drift never tripped a failure, but it's corrected to the real number (713 − 2 = 711) rather than carried forward. Verified via a full computed-style A/B diff across the game's whole reachable state space: all five attic mode-transition states plus classic, mobile/narrow/desktop breakpoints, `prefers-reduced-motion`, `hand-card-action-drag-active`, and the `card-draw-dealt`/`card-wave`/`handCardIdleCycle` animation states — clean pass both before and after the position fix. |
| `spv2Core` (singlePlayerV2/base.css, compat.css, desktop.css, assets.css, layout.css, mobile.css, components/spread.css, components/scoreHud.css, states.css, components/artIntegration.css) | ten-as-one-unit | immediately after `legacy`, before `mpCore` | The tenth crack, and the last of the 10 SPv2 source files that stayed in the app-wide `legacy` layer (the other 6 — `tokens.css`, `components/hand.css`, `components/relics.css`, `components/spreadHints.css`, `components/utilityButtons.css`, `components/utilityIcons.css` — already own `spv2.tokens`/`spv2.components`). Assessed at first as a quick win (similar in shape to the already-migrated `spreadHints.css`/`relics.css`/`components/hand.css`), but a real audit of the first candidate, `scoreHud.css`, found it deeply entangled with most of its 9 siblings: they're all gated to the same `@media(max-width:640px)` breakpoint and form a genuine cross-file specificity/media ladder with each other — e.g. `base.css`'s low-specificity `body.single-player-v2 .score-stack` base rule is deliberately overridden by `compat.css`'s higher-specificity `body.single-player-v2.generated-sheet-ready .score-stack` (one more class) at the generated-sheet breakpoint, the same "low-specificity base + higher-specificity override" shape as `classicCore`'s market/hand ladder — the same structural-wall pattern, at a larger scale (9 files, not 5). The tenth, `desktop.css`, is gated to `@media(min-width:641px)` — mutually exclusive with the other nine's breakpoint, so no intra-cluster ties, but it shares the same external position requirements as the rest (see below), so it moved along with them rather than getting its own layer for one file's sake. A crude token-based audit script (adapted from `subjectCompound()`, see probe-design lesson 12) found 300–800+ raw candidate matches per tier against the rest of the app — almost all noise: `@media` range mismatches (a media-query-aware rewrite of the audit, tracking each declaration's actual breakpoint scope and treating disjoint width ranges as non-conflicts, cut this dramatically) and `body.mp-game-active`/`body.single-player-v2` mode-exclusivity (enforced at runtime by `mpModeClassGuard.mjs`, same precedent as `mpSinglePlayerIsolation.css`'s dead code). After both filters, every remaining real conflict pointed the same two directions the cluster was *already satisfying* by sitting in `legacy` itself: later than `classicCore`/`actionDropTargets.css`/`mpGameChrome.css`/`handSwipeZone.css` and every other before-`legacy` layer (normal-tier ties against `market.css`'s/`mobile.css`'s/`hand.css`'s bare classic-mode `.score-stack`/`.spread-wrap`/`.spread`/`.slot`/`.card`/`.handDock` rules need this cluster to keep WINNING via being the later layer; important-tier ties against `actionDropTargets.css`'s drag-drop-target button overrides, e.g. `#discardBtn`/`#purgeBtn`'s `.card-drop-target` state, need this cluster to keep LOSING via being the later layer), and earlier than `mpCore`/`titleWrap.css`/`atticFade.css`/`handDragFix.css`/`performance.css`/`drawAnimation.css`/`drawers.css` (important-tier ties against `drawers.css`'s `#menuBtn`/`#scoringBtn`/`#abilitiesBtn` `display:none` defaults and `performance.css`'s mobile `#roomAmbient` opacity need this cluster to keep WINNING via being the earlier layer). The only two rules still in `legacy` itself (`mpMobile.css`'s residual `.handDock{bottom,background}`, gated to `body.mp-game-active`; `mainMenu.css`'s boot veil, which touches no property this cluster also touches) were both confirmed moot. Since `legacy`'s own position already satisfied every real requirement found, `spv2Core` is declared immediately after `legacy`, before `mpCore` — the smallest possible move, replacing "wins/loses because it happens to share a name with a big unsorted pile" with "wins/loses because of an explicit, reasoned position," without changing a single outcome. Verified via a full computed-style A/B diff: classic-vs-single-player-v2 layout ties at both the 640px and 641px breakpoints, the drag-drop-target button overrides, `drawers.css`'/`performance.css`'/`drawAnimation.css`'s ties, all five attic mode-transition states (with `single-player-v2` additionally set, since `base.css`'s own `filter:none` reset also competes with `titleWrap.css`'s mode-gated blur — confirmed to resolve identically before and after), and the already-migrated `spv2.components` ladder — clean pass, zero diffs. |

Also handled earlier (before this session, same branch): `loadout.css`,
`matchmaking.css`, and part of `mainMenu.css` were split out as fully
self-scoped standalone screens (`screens.*` layer) — the boot-veil portion
of `mainMenu.css` stays in `legacy` since it's a real cross-file dependency
(fades other files' elements, e.g. `#titleWrap`, `.spread-wrap`, `.handDock`).

**Explicitly skipped (structural wall, not "fixed"):** `attic.css` was already handled/skipped as not a clean extraction target: it intentionally reaches across table UI surfaces (`#titleWrap`, `.score-stack`, `.spread-wrap`, `.handDock`, `#relicRack`, `#invWrap`, `.refs-layer`, `#handSwipeZone`, `#settingsPanel`) during mode transitions and mobile hint repair. Do not attempt it again without fresh interaction proof showing those cross-file dependencies are one-directional.

**Explicitly skipped as a bundle, since resolved (see
`mpMultMobile.css`/`mpSpreadCards.css`/`mpSinglePlayerIsolation.css`/
`components/mpGameChrome.css`/`mpCore` in the Done table above):** the
whole multiplayer CSS cluster is now extracted. It looked unpromising as
a single bundle move at first — the six mp*.css files are provably
mode-exclusive (`mp-game-active`), which made *bundling them all into one
shared layer* look promising, but that bundle needs to win against
`legacy` on the `!important` tier in some places and lose on it in
others — impossible to satisfy with one relative two-layer ordering for
the whole cluster at once. That verdict is still correct for a naive
whole-cluster bundle, but it turned out every piece of the cluster is
extractable once split correctly: `mpMultMobile.css` (28 lines) is fully
self-contained with zero property overlap with anything;
`mpSpreadCards.css` (35 lines) is every-declaration-`!important` and
importance-dominant everywhere it's not simply disjoint;
`mpSinglePlayerIsolation.css` (124 lines) is gated entirely behind a
runtime-unreachable class combination (confirmed via the actual guard
source, `src/app/mpModeClassGuard.mjs`, not just assumed), making its
layer position moot; `mpGameChrome.css` mined 61 of `mpGame.css`'s 91
rules that have no counterpart at all in `mpMobile.css`/`mpFixes.css`
(the file's own UI chrome, not its laddered core); and `mpCore` took the
genuinely laddered remainder (`mpGame.css`'s 30-rule core, all of
`mpMobile.css`, all of `mpFixes.css`) and moved the whole trio together
into one new shared layer, since the ladder only requires them to stay
co-resident *with each other*, not with the rest of `legacy`. What's
left behind in `legacy` is now down to four rules total: `mpGame.css`'s
`.card.mp-interaction`/`mp-action-btn`/`mp-ov-btn` (each has a real,
opposite-direction conflict against `ps1aesthetic.css`/`market.css` that
`mpCore`'s position can't also satisfy) and `mpMobile.css`'s
`.handDock{bottom,background}` (needs the opposite direction from the
rest of that file, for the same kind of reason) — see the `mpGameChrome.css`
and `mpCore` rows above for each one's specific reasoning.

**Formerly deprioritized, since extracted:** `cards.css` looked like an easy
independent extraction by size, then got deprioritized when its classes
(`.title`, `.art`, `.sym`, `.plaque`, `.scroll`, `.seal`) turned out to be
reused verbatim by `market.css`, `mpMobile.css`, and `mpSpreadCards.css`.
Once actually checked per-interaction, every reuse was one-directional
(cards always loses) — see the Done table above.

**Explicitly skipped (structural wall), since resolved — see `classicCore`
in the Done table above:** for a long stretch of this migration, `market.css`,
`ps1aesthetic.css`, `hand.css`, `mobile.css`, and `attic.css` were believed
structurally unextractable, each for a different reason below. All five
verdicts were real *at the time they were written* — but every one of them
was checked against a `legacy` layer that has since shrunk enormously
(relicRack.css, handSwipeZone.css, titleWrap.css, atticFade.css, invWrap.css,
and the entire multiplayer cluster all extracted since), and re-checking
from scratch (per "re-examine skips after every extraction" below) found
the wall had crumbled: most of the specific competing rules cited below
had themselves moved to their own layers, mostly resolving into the "before
legacy stays before regardless" invariant established by `mpCore`'s own
extraction. What never went away was the five files' cross-file specificity
ladder *with each other* — but that only blocks splitting them into
different layers, not moving all five together as one unit, which is
exactly what `classicCore` did. Kept below for the historical record and
because parts of the underlying reasoning (the ladder itself, the reverted
`hand.css` attempt) remain true and load-bearing for classicCore's own
internal-cohesion requirement:

- `market.css` — sits in the middle of a documented load-order dependency
  chain (`base,spread,hand,cards,market,mobile,attic,drawers`) and needs to
  win `!important` ties against `hand.css` (`.sel`/`.ability-picked`
  z-index) while also needing to keep *losing* an `!important` tie against
  `mobile.css` (`.spread .card` box-shadow vs. `.ability-target`/
  `.ability-picked`'s highlight ring) and a normal-tier tie against
  `mobile.css` (`.relic-rack` `align-items`). No single layer position
  before/after `legacy` satisfies both. (The `.relic-rack` tie is gone now
  — both files' `.relic-rack` rules were later consolidated into
  `relicRack.css` — and the rest were all intra-cluster, resolved by
  moving hand/market/mobile together.)
- `ps1aesthetic.css` — needs to keep losing on the `!important` tier to
  `mpSinglePlayerIsolation.css`/`attic.css`/`singlePlayerV2/states.css`
  overrides (`.handDock`, `.hand-swipe-zone`, `.slot.target`, mobile SPv2
  `#roomAmbient` opacity) while also needing to keep losing on the *normal*
  tier to `attic.css`'s mode-gated `filter:blur(...)` on
  `#titleWrap`/`.score-stack`/`#relicRack` — normal-tier and `!important`-tier
  ties resolve in opposite layer directions, so those two requirements demand
  opposite placements relative to `legacy`. (`mpSinglePlayerIsolation.css` is
  confirmed dead code regardless of layer; the `#titleWrap`/`.score-stack`/
  `#relicRack` fade rule moved out of `attic.css` entirely into
  `titleWrap.css`/`atticFade.css`, both after `legacy` — ps1aesthetic (now
  in `classicCore`, before `legacy`) just needs to stay earlier than them,
  which holds either side of `legacy`.)
- ~~`drawAnimation.css`~~ — **since extracted** (see the Done table). Its
  original mixed-direction verdict was real, but one of the two competitors
  (drawers.css) later moved out of `legacy` into its own layer, which opened
  a slot between them that satisfies both directions. Lesson recorded below.
  (`.sel`/`.ability-picked`/`.ability-target`/`.purge-picked` z-index
  conflicts against hand.css/market.css/mobile.css were all moot — the
  app's reducer structurally clears selection/ability/purge state in the
  same dispatch that precedes any queued draw animation, so those classes
  never co-occur with `.card-draw-dealt` on the same card.)
- `hand.css` — **an extraction was attempted and REVERTED; do not retry
  without solving the specificity-ladder problem below.** The original
  mixed-direction verdict (normal-tier sizing must lose to market/mobile →
  before `legacy`; `!important` z-index ties must lose → after `legacy`)
  was partially resolved by declaration surgery: the `.ability-picked`
  z-index tie-breakers were provably dead and deleted (that deletion
  STANDS — mobile.css's unconditional `z-index:300!important` always won;
  budget ratcheted 695→694), and `.card.hint-multi`'s unscoped box-shadow
  was split into a residual `@layer legacy` block. But empirical probing
  of `.photo` cards (see the probe-design lessons below) exposed a deeper
  structural dependency the file-level analysis missed: market.css's
  mobile block deliberately uses LOW-specificity overrides
  (`.card{box-shadow:...}`, `.hand .card.ability-target{...}`) and relies
  on hand.css's HIGHER-specificity state combos
  (`.hand .card.ability-target.hint-card`, `.hand .card.hint-card.sel`,
  `:active`/`.press-highlight` rules) to keep beating them via
  specificity — a cross-file specificity ladder. Layer separation removes
  specificity from the comparison entirely, so market's generic rules
  start beating every hand state combo. The concrete regression: at
  ≤640px in non-SPv2 states, `ability-target`+`hint-card`/`hint-complete`
  cards lost their hint glow (mobile.css carries identical-value
  duplicates of the `sel`/`press-highlight` hint combos, which masked
  those — but not the ability-target ones). hand.css and market.css must
  stay co-resident in `legacy` unless the ladder rules themselves are
  restructured. (This ladder is exactly why `classicCore` moves hand.css
  and market.css *together* rather than separately — the reasoning here
  never stopped being true, it just stopped being a reason to leave both
  files in the shared app-wide `legacy` layer specifically.)
- `mobile.css` — "the biggest hub," and it turns out to be one of the root
  causes of the `market.css` conflict above (their `.relic-rack`/
  `.ability-picked` ties are the same rules pulling opposite ways here too).
  Needs to win `!important` ties against `hand.css`/`market.css`
  (`.hand .card.ability-picked`/`.sel` z-index) — requires **before**
  `legacy` — while needing to lose a normal-tier tie against `attic.css`
  (`#invWrap` transform/transition during attic-scene mode transitions) —
  also requires **before** `legacy` — but *also* needing to win two
  normal-tier ties against `market.css`/`hand.css` (`.relic-rack`
  `align-items`, `.hand .card` transition timing) — requires **after**
  `legacy`. No single position satisfies all three. (All three ties were
  intra-cluster — hand.css/market.css/attic.css all moved into
  `classicCore` alongside mobile.css, so these are non-issues now; the
  `#invWrap` tie specifically still works because `invWrap.css` stays
  before `legacy`, unambiguously earlier than `classicCore` either way.)
- `attic.css` — needs to WIN two `!important` ties against files still in
  `legacy` (its ungated `#handSwipeZone.hand-swipe-zone{bottom:197px!important}`
  beats ps1aesthetic.css's `.hand-swipe-zone{bottom:233px!important}` today
  only via specificity, and its mobile `.relic-rack{flex-direction:row!important}`
  beats mobile.css's `.relic-rack{flex-direction:column!important}` today
  only via source order — same specificity) — requires **before** `legacy` —
  while also needing to WIN normal-tier ties against ps1aesthetic.css (its
  mode-gated `filter:blur()` on `#titleWrap`/`.score-stack`/`#relicRack`
  beats ps1aesthetic's ungated `filter:saturate()` via specificity) —
  requires **after** `legacy`. Opposite placements; mixed-direction. This
  also retroactively validates the reverted extraction attempt on the old
  `codex/...` branch: placing attic after `legacy` would have broken the
  hand-swipe-zone geometry and mobile relic-rack row layout. (Both cited
  rules are gone from attic.css now — `#handSwipeZone` moved to
  `handSwipeZone.css`, the `#titleWrap`/`.score-stack`/`#relicRack` fade
  moved to `titleWrap.css`/`atticFade.css` — leaving attic.css's remaining
  content almost entirely self-contained plus one small real tie to
  mobile.css's `.settings-panel .settings-action`, satisfied by staying
  in `classicCore` together.)

## What's left

Remaining files still in the shared `legacy` layer, in the order they'll be
attempted (skip-ahead rule applies throughout):

- The multiplayer cluster is now fully extracted (`mpMultMobile.css`,
  `mpSpreadCards.css`, `mpSinglePlayerIsolation.css`,
  `components/mpGameChrome.css`, and `mpCore` — see Done table above).
  One rule remains behind in `legacy` on purpose: `mpMobile.css`'s
  `.handDock{bottom,background}` (see the `mpCore` row) — a real,
  opposite-direction conflict that no single layer position could also
  satisfy. (`mpGame.css`'s `.card.mp-interaction`/`mp-action-btn`/
  `mp-ov-btn`, the other three residual rules from the `mpGameChrome.css`
  pilot, were themselves resolved by the `classicCore` extraction — see
  that row.)
- The former "structural wall" cluster (`market.css`, `ps1aesthetic.css`,
  `hand.css`, `mobile.css`, `attic.css`) is now fully extracted too, as
  `classicCore` — see the Done table above and the now-historical skip
  verdicts a few sections up.
- The last 10 SPv2 files that shared `legacy` are now fully extracted too,
  as `spv2Core` — see the Done table above. They turned out to be their
  own (larger) structural-wall cluster, not individually one-directional
  as first assessed; see the "re-examine skips" section below for the
  full story of how that was discovered.

Every non-SPv2 file has now been either extracted or confirmed
mixed-direction *with a specific, still-genuine competitor* — no whole
file remains in `legacy` for lack of trying, only one residual rule
(`mpMobile.css`'s `.handDock{bottom,background}`) with a real,
irreducible opposite-direction conflict. What remains in `legacy` now is
just that one rule and `mainMenu.css`'s boot veil — everything else,
including every SPv2 source file, has its own named, reasoned layer.

**Narrowing what "structural wall" means.** The original skip verdicts
were about whole-file moves in isolation — "can this entire file get one
`before`/`after legacy` position, on its own" — and for `market.css`,
`mobile.css`, `attic.css`, `hand.css`, and `ps1aesthetic.css` individually,
that verdict still stands: none of them can move alone, because they form
a cross-file specificity ladder with each other that a per-file move
would break. But "alone" turned out to be the wrong constraint to accept.
Three different escape hatches emerged over the course of this migration,
and all three matter for understanding why nothing is truly stuck:
`relicRack.css`, `handSwipeZone.css`, and `tutTip.css` prove that a
*component-shaped selector cluster inside* one of those files can be
extractable even when the whole file isn't, by gathering just that
cluster into its own file (resolves the ladder by removing the
cross-file competitor, not by out-specificity-ing it). `mpGameChrome.css`
proves that a *solo, non-laddered subset* of a file that's otherwise part
of a hard bundle can be mined out, leaving the genuinely laddered
remainder behind. And `mpCore`/`classicCore` prove that when neither of
those applies — when the ladder really does span the whole file and
really is mutual, not one-directional — the files can still move
*together*, as one unit, out from under the rest of `legacy`, as long as
nothing requires them to stay co-resident with anything outside the
ladder. Combined, these three techniques closed out both of this
migration's largest "unsolvable" clusters. See "Component consolidation
pilots" below for the audited candidates and why not all of them turned
out to qualify.

## Re-examine skips after every extraction

`drawAnimation.css` proved that "mixed-direction" is relative to the
*current* layer landscape, not a permanent property of the file: its two
competitors pulled in opposite directions only while both sat in the same
undivided `legacy` layer. When one of them (drawers.css) was extracted to
its own layer, a slot between `legacy` and `drawers` satisfied both
directions and the file became cleanly extractable. After each extraction,
re-check whether any skipped file's opposing competitors have been
separated. As of `drawAnimation`'s extraction, the remaining skips were
re-checked and were still genuinely stuck *as separate per-file moves*:
each one's opposing constraints pointed at files that all remained inside
`legacy` itself (hand ↔ market ↔ mobile ↔ attic ↔ ps1aesthetic form a
strongly-connected cluster, e.g. market must beat hand on the normal tier
AND on the `!important` tier — contradictory placements against the same
file, unsolvable by any layer order without splitting rules). That
"unsolvable" verdict held for years of accumulated extractions in between
— what eventually broke it wasn't any of those competitors moving, it was
recognizing the whole cluster didn't need to move file-by-file at all
(see `classicCore` in the Done table, and "the path for the rest" below
for the full retrospective on why the original conclusion was too
narrow).

## The path for the rest (per-declaration surgery)

File-level moves are exhausted. The remaining cluster's contradictions
hinge on specific declarations, and the next viable technique is
declaration-level work, with two forms:

1. **Delete provably-dead tie-breakers.** Some of the blocking
   declarations never win anywhere today — hand.css's
   `.hand .card.ability-picked{z-index:1000!important}` was always beaten
   by mobile.css's unconditional `z-index:300!important` (same
   specificity, later source), and hand.css's `.sel` z-index 999 ties
   mobile.css's value exactly. Both were deleted (the deletion survived
   the hand.css revert; cascade-probe A/B verified, budget 695→694).
   Removing dead/identical declarations shrinks the conflict graph.
2. **Split minority-direction rules into a second layer block.** A file
   can contain multiple `@layer` blocks (mainMenu.css already does this:
   boot veil in `legacy`, the rest in `screens.main-menu`). For a file
   whose conflicts point one way except for a couple of rules, move just
   those rules into a separate block assigned to a layer on the other
   side of `legacy`.

**Hard limit discovered (the hand.css reverted attempt):** neither
technique helps when two files form a **cross-file specificity ladder** —
market.css's mobile block sets low-specificity base overrides and relies
on hand.css's higher-specificity state combos beating them via
specificity. Ties like that aren't carried by one deletable declaration
or a couple of splittable rules; they span ~10 interleaved state rules on
each side, and layer separation removes specificity from the comparison
entirely. Files joined by a ladder must stay co-resident in one layer —
but "one layer" doesn't have to mean `legacy` specifically, only the
*same* layer as each other (see the update below).

**The ladder was the whole remaining pile, but that wasn't terminal.**
Spot checks at the time confirmed the same structure everywhere in what
was left of `legacy` — hand ↔ market ↔ mobile ↔ attic ↔ ps1aesthetic form
a strongly-connected cluster, e.g. market must beat hand on the normal
tier AND on the `!important` tier, contradictory placements against the
same file if attempted as *separate* per-file moves. The intra-legacy
hierarchy was (and inside `classicCore`, still is) a deliberate four-story
specificity ladder: SPv2/mp mode bundles (highest, `html body.<mode>`
prefixes) > attic's ID/mode-gated patches > market/mobile's
mid-specificity patches > base-level rules. Every rung relies on
out-specifying the rung below across file boundaries, and layers can't
cut between rungs *within the cluster*. At the time this was written, the
conclusion was that the remaining files "must stay co-resident in
`legacy` until someone redesigns the ladder itself (a much bigger,
behavior-risking refactor)" — that conclusion turned out to be wrong in
one specific way: it conflated "must stay co-resident with each other"
(true, and still true) with "must stay co-resident with the rest of
`legacy`" (false — nothing actually required that). Once the multiplayer
cluster's `mpCore` extraction proved the "move the whole interdependent
group together, out from under the rest of `legacy`" technique works
without touching the ladder itself, applying the same technique to this
five-file cluster (`classicCore`, see the Done table) resolved it with no
ladder redesign at all. What CAN still be safely harvested inside any
remaining pile: dead-declaration deletions (three done now — hand.css's
and market.css's `.sel`/`.ability-picked` z-index tie-breakers, and
mpGame.css's `.card.mp-interaction` once classicCore's extraction removed
its reason to exist) and the budget ratchet that locks each one in.

## Probe-design lessons (hard-won, follow these)

The hand.css regression shipped briefly because the verification probe
had three blind spots — every future probe should check against all
three:

1. **Probe `.photo` cards, not bare `.card`s.** Real cards carry `.photo`
   (art sheets). ps1aesthetic.css's `.card:not(.photo){...!important}`
   reskin masks the entire normal-tier box-shadow cascade for non-photo
   probes, hiding real flips.
2. **Strip body mode classes before probing classic styling.** The
   harness boot lands in SPv2 mode (`single-player-v2
   generated-sheet-ready mode-reading` on `<body>`), whose `!important`
   rules mask classic-mode fights. `document.body.className = ''` inside
   the probe exposes them.
3. **Duplicate rules can protect some combos and not others.** mobile.css
   carries identical-value duplicates of hand.css's `sel`/`press-highlight`
   hint combos (which made those look safe) but not the `ability-target`
   ones (which flipped). Enumerate the full state matrix; don't
   extrapolate from a couple of green cells.
4. **A single-run probe result is not verification — always A/B against a
   real baseline.** Both `relicRack.css` and `handSwipeZone.css` shipped
   with real regressions despite each having its own dedicated probe file,
   because those probes were apparently only ever run once (single-run
   mode) and eyeballed, never diffed against the pre-consolidation commit.
   `scripts/cascade-probe.mjs`'s stash-based A/B only compares against
   *uncommitted* changes — for a consolidation whose "before" state is
   several commits back, stash the changed files or `git checkout
   <pre-consolidation-sha> -- <files>` to build a real baseline, run the
   probe against it, then restore. Don't trust "the probe passed" without
   having actually run it both ways.
5. **Layer moves for consolidated files still need the full remaining-file
   sweep, not just the files that were consolidated away.** Both
   regressions above came from stopping the interaction search once the
   obviously-related files (market/mobile/attic/ps1aesthetic) were fully
   absorbed, without re-checking the multiplayer cluster
   (`mpMobile.css`/`mpFixes.css`/`mpSinglePlayerIsolation.css`) and the
   `spv2.*`-layer files, which still reference the same selectors.
6. **When forcing mutually-exclusive mode classes on `<body>` for a test,
   wait a tick and re-read the class list.** `body.mp-game-active` and
   `body.single-player-v2` are enforced mutually exclusive at runtime by a
   class guard (`mpModeClassGuard.mjs`) that runs asynchronously; setting
   both via `document.body.className = '...'` and reading computed style
   in the same synchronous tick captures a state the guard hasn't
   corrected yet, producing results that don't reflect any real reachable
   UI state. `await page.waitForTimeout(...)` (however brief) before
   reading, and check `document.body.className` in the probe's own output
   to confirm which classes actually stuck.
7. **When a diff turns up a real, reproducible discrepancy but its cause
   isn't obvious, diff *every* computed-style property, not a hand-picked
   subset.** The `tutTip.css` pilot showed a genuine, deterministic 10px
   height difference on `#tutTip` that survived two rounds of guessing
   individual properties (padding, line-height, font-size, border,
   max-width, box-sizing, child display/margin — all identical between
   states). Only iterating `getComputedStyle(el)` itself (it's iterable —
   `for (let i = 0; i < cs.length; i++)` over `cs[i]`/`cs.getPropertyValue`)
   and diffing the full property set for `#tutTip` and each child surfaced
   the actual cause: `#tutSkipBtn`'s `font-size`/`padding` had changed,
   which is not a property anyone would have guessed to check on the
   popover's own height. Don't keep guessing after two misses — measure
   everything and let the diff find it.
8. **Writing prose comments with wildcard notation right before a slash
   creates an accidental `*/` token that silently truncates the comment.**
   Prose like `.mp-pill-*/.mp-pills-*/` (meant as shorthand for "the
   mp-pill-* and mp-pills-* selector families") contains a literal `*/`
   character sequence, which a CSS parser reads as the comment's close —
   everything after it becomes raw, invalid CSS, silently mis-parsed. This
   corrupted three separate header/explanatory comments during the
   `mpGameChrome.css` pilot (game.html's inline `<style>` block,
   `mpGame.css`'s header, `mpGameChrome.css`'s header) before being
   caught — confirmed severe, not cosmetic, by reading
   `document.styleSheets[i].cssRules[0].cssRules.length` directly in the
   browser: both affected external stylesheets reported 0 nested rules,
   meaning the entire file was invisible to the cascade. `grep -c '/\*'`
   vs `grep -c '\*/'` per file (openers must equal closers) catches this
   immediately; fix by spelling out full selector names comma-separated
   instead of using wildcard-asterisk-immediately-before-slash.
9. **`rule.type === CSSRule.LAYER_BLOCK_RULE` is not a reliable way to
   detect `@layer` blocks when walking `document.styleSheets` in this
   Playwright/Chromium environment.** A rule-matching diagnostic built
   around that check silently returned zero matches for everything nested
   inside any `@layer`, making it look like no rules existed at all.
   Switching to `rule.constructor.name === 'CSSStyleRule'` for leaf rules,
   and recursing into any rule with a truthy `.cssRules` (covers `@layer`,
   `@media`, etc. without needing to name the container type), found the
   real competing rules immediately — including the `ps1aesthetic.css`
   rule that the `mpGameChrome.css` pilot's first pass had missed
   entirely.
10. **A selector or file being referenced by many other files is not
    evidence of a real conflict, and being referenced by only one
    "obvious" file is not evidence of no conflict either — only a
    per-property, per-competitor check is.** The `mpGameChrome.css` pilot
    found two real, previously-undiscovered competitors this way in
    opposite directions: `.card.mp-interaction` looked safe because static
    grep only turned up `hand.css`'s non-important base rule, missing
    `ps1aesthetic.css`'s `.card:not(.photo){...!important}` (same
    effective specificity via `:not()`'s argument, so a genuine same-layer
    tie today, resolved by source order) — extracting the rule would have
    revived it from its current, correct, dead-code state. Conversely,
    `mp-action-btn`/`mp-ov-btn` looked safe by the same kind of check but
    actually needed to keep winning a specificity fight against
    `market.css`'s bare `button{}` mobile reset. Re-running the *same*
    reliable rule-matching diagnostic (lesson 9) across every remaining
    solo selector — not just the ones static reasoning flagged as
    plausible — is what surfaced both, immediately after the first miss
    was found, not before.
11. **Synthetic probe elements using an id/class that's also used by a
    real static element in game.html silently read the WRONG element's
    computed style if the result-gathering code re-queries by selector
    instead of holding a direct reference.** CSS id/class selectors don't
    care about duplicates — a synthetic `<div id="spread">` matches
    `#spread .slot` correctly regardless of a real `#spread` elsewhere in
    the document — but `document.querySelector('#spread .slot')` run
    *after* creating the synthetic element returns the first match in
    document order, which is usually the REAL element (already in the
    DOM from page load, appearing earlier than anything appended at the
    end of `<body>`), not the synthetic one. The `mpCore` pilot's first
    probe pass hit this for `#spread`, `#mpGame`, `#modal`, `.hand`,
    `.handDock`, and `.spread-wrap` — all real elements in game.html or
    created by real game JS — producing a batch of clean-looking but
    nonsensical diffs (proportionally-scaled slot dimensions matching
    neither side's declared values, card animation/hint noise unrelated
    to any changed file) that looked like real regressions until traced
    back to reading the wrong element entirely. Fixed by building all
    synthetic elements inside a dedicated wrapper and storing direct
    element references at creation time (`refs.spread = el(...)`,
    `getComputedStyle(refs.spread)`), never re-querying by selector for
    elements whose id/class might collide with real markup.
12. **A crude token-based CSS selector matcher needs to compare the
    selector's *subject* (its rightmost compound, ignoring combinators),
    not any shared token anywhere in the whole selector.** An early
    version of the `classicCore` audit script matched `.hand .card
    {transform}` against `.hand .card .seal {transform}` because both
    selectors contain the tokens `.hand` and `.card` — but they target
    different elements (the card itself vs. its descendant), so they
    never actually compete. It also matched `.spread-actions .sbtn
    {padding}` against `.spread-actions .sbtn.card-drop-target::after
    {padding}`, treating a `::after` pseudo-element as if it were the
    same box as the real button. Both are false positives that inflate
    a "things to check" list into unreviewable noise. Fixed by comparing
    only each selector's last space/combinator-separated compound
    (`subjectCompound()`), which correctly separates ancestor-context
    tokens from the actual target, cutting one such audit from 163
    candidate findings down to 46 real ones.
13. **The `!important` budget check is a ceiling (`total <=
    importantBudget`), not an exact running tally — drift between the
    documented number and the real sum doesn't fail CI, so it can go
    unnoticed for a long time.** While reconciling the `classicCore`
    extraction's budget, the actual summed total across every tracked
    app-wide file came out to 713, not the 716 several prior commits'
    comments had confidently carried forward as a precise value. Nothing
    was wrong with any individual file's count (each matched its own
    prior commit exactly) — the aggregate simply drifted at some earlier
    point without tripping the `<=` check, and successive commits kept
    citing the stale total as if it were exact. Recompute the real sum
    directly (`grep -o '!important' <file> | wc -l` per tracked file,
    summed) when reconciling a budget change instead of trusting the
    comment's running total, and correct the constant to the verified
    number rather than propagating the drift further.
14. **When extracting files that were previously co-resident with OTHER,
    already-shipped, differently-positioned content in the SAME shared
    layer, the extraction's audit needs to check the extracted files'
    relationship with THAT other content too — not just with everything
    outside the shared layer.** A layer-move audit naturally checks the
    files being moved against every *already-extracted* layer and every
    *other* file still in the shared layer — but the SPv2 bundle's 10
    source files are a third category: still literally *inside* `legacy`
    themselves (not "before legacy," not "after legacy," not
    already-extracted), sharing it with everything else that hasn't moved
    yet. The `classicCore` audit checked the first two categories
    thoroughly and found real conflicts pointing "after legacy" — but
    never checked the cluster's relationship with the 10 files still
    resident in `legacy` at the time, because those files' conflicts had
    been implicitly (and wrongly) assumed already covered by "everything
    still in legacy." They weren't: the SPv2 files' specificity-based wins
    against market.css/mobile.css/hand.css/attic.css/ps1aesthetic.css
    depended on all of them sharing one layer, which is exactly the
    relationship that changed the moment `classicCore` became a separate,
    later-declared layer. This shipped as a real, confirmed regression in
    single-player-v2 mode (286 conflicts, verified against a true
    baseline) before it was caught — not by a bug report, but by pausing
    to re-check `classicCore`'s relationship with the SPv2 files before
    starting to migrate them next, per lesson zero of this whole
    section: **"before touching file B, re-verify every relationship any
    *already-shipped* extraction has with B" is not optional diligence,
    it's the same "re-examine skips after every extraction" discipline
    applied one direction earlier than usual** — checking what the new
    work's predecessors did to the thing about to be touched, not just
    what the new work itself will do. Fixed by moving `classicCore` to
    before `legacy` instead (see its Done-table row), which happened to
    still satisfy every other requirement the original audit found, since
    before-legacy is earlier than after-legacy either way.
15. **A crude selector-overlap audit needs to know each declaration's
    `@media` scope and any mode-exclusive body classes in its selector, or
    its "conflict" count is mostly noise.** The `spv2Core` cluster's first
    pass (adapting the `classicCore`-era audit script) found 300–800+ raw
    matches per tier against the rest of the app — almost all false
    positives. Two blind spots accounted for nearly all of them: (1) not
    tracking which `@media` condition each declaration actually lives
    inside, so a mobile-only rule (`@media(max-width:640px)`) got flagged
    against a desktop-only rule (`@media(min-width:641px)`) that can never
    apply at the same time; (2) not recognizing `body.mp-game-active` and
    `body.single-player-v2` as runtime-exclusive (the same
    `mpModeClassGuard.mjs` fact already used for `mpSinglePlayerIsolation
    .css`'s dead-code verdict), so selectors gated to one mode kept getting
    flagged against selectors gated to the other. Fixing both — a real
    (recursive, brace-depth-tracking) block parser that threads the active
    `@media` stack through each extracted declaration, plus a width-range
    overlap check and a mode-gate check, both applied as filters before
    counting a match as real — cut the noise by roughly 90% and left a
    tractable list of genuine same-tier, same-breakpoint, same-mode
    conflicts to reason about individually. Absent this, a crude audit's
    raw count is not a proxy for real risk in either direction: it will
    both bury real conflicts in noise (making them easy to miss while
    skimming) and make a genuinely one-directional file look impossibly
    tangled (making it easy to give up on a tractable extraction).

The 10 SPv2 files that used to share `legacy` are no longer a separate
job — they're `spv2Core` now (see the Done table), positioned adjacent
to `legacy` rather than joining the earliest-declared `spv2.*` tier
system, precisely because moving them there naively would have flipped
their normal-tier wins over classic-mode files the same way `classicCore`
flipped its relationship with them. See `spv2Core`'s Done-table row and
`singlePlayerV2/base.css`'s header comment for the full writeup, and the
SPv2 cascade generator (`scripts/generate-single-player-v2-cascade.mjs`)
and its validator, both updated for the new layer name since the shipped
`singlePlayerV2/index.css` is compiled from these sources.

### SPv2 component pilot ownership rule

`src/styles/singlePlayerV2/index.css` is **authoritative checked-in output**,
not a hand-maintained stylesheet: it is generated by
`scripts/generate-single-player-v2-cascade.mjs`, committed for runtime loading,
and validated byte-for-byte by
`scripts/validate-single-player-v2-cascade.mjs`. Treat the partials listed in
`singlePlayerV2CascadeSources` as the hand-maintained/generated-source inputs
for the bundle, and rerun the generator after changing any bundled input.

For component pilots, do **not** keep the same component-owned rule in both the
standalone component file and the generated SPv2 bundle. Once a component rule
is owned by a file under `src/styles/singlePlayerV2/components/` and loaded as a
standalone stylesheet, list that file in `singlePlayerV2ExternalComponentSources`
instead of `singlePlayerV2CascadeSources`, load it next to
`singlePlayerV2/index.css` in both `game.html` and the runtime installer, and add
a validator assertion that the migrated selectors no longer appear in the old
generated bundle sections.

First pilot: utility-button visibility (`components/utilityButtons.css`). The
matching selector inventory before externalizing the pilot was:

| Selector | Source partial matches | Generated `index.css` matches before externalizing |
|---|---|---|
| `body.single-player-v2.generated-sheet-ready #mullBtn` | `components/utilityButtons.css` owned the hidden-button `display:none!important` rule; `assets.css` still shares art/background and `::before` reset rules; `base.css`/`desktop.css` define legacy glyph `::before` content; other utility partials mention the visible utility buttons but not this standalone hidden selector. | The generated bundle repeated the `components/utilityButtons.css` hidden-button rule in its `singlePlayerV2/components/utilityButtons.css` section, while older generated sections still contained the art/background and glyph references from their source partials. |
| `body.single-player-v2.generated-sheet-ready #scoringBtn`, `body.single-player-v2.generated-sheet-ready #abilitiesBtn`, `body.single-player-v2.generated-sheet-ready #menuBtn` | `components/utilityButtons.css` owned the `display:block`, size, and radius contract; `layout.css` was already validated not to own display; `base.css`, `compat.css`, `desktop.css`, `mobile.css`, `assets.css`, `components/spread.css`, `components/scoreHud.css`, `components/artIntegration.css`, and `components/utilityIcons.css` still contain matching utility-button selectors for position, art, labels, or state styling. | The generated bundle repeated all of those source matches, including the component-owned display/size/radius rule in its `singlePlayerV2/components/utilityButtons.css` section. |

The validator now treats those two utility-button visibility selectors as
migrated: if either exact component-owned rule reappears in the generated bundle,
`node scripts/validate-single-player-v2-cascade.mjs` must fail. Matching selectors
for non-migrated properties may remain in their old sections until each property
cluster is migrated and documented with its own assertion.


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

## Component consolidation pilots

`relicRack.css`, `handSwipeZone.css`, and `tutTip.css` are the three
standing pilots — see the Done table above for what each gathers (or, for
`tutTip.css`, pulls whole) and, importantly, the bug each one shipped with
and how it was found and fixed. The general technique for **consolidation**:
gather one component's rules that were scattered across multiple `legacy`
files into a new file, in their original effective order, remove the
scattered originals, then determine the new layer's position the same way
as any other candidate (re-derive win/lose against everything still in
`legacy`, including the multiplayer cluster and `spv2.*`-layer files — see
lesson 5 above). Do not assume "unconstrained" just because the obviously
related files were absorbed. For **pulled-whole** extractions like
`tutTip.css`, where the rules were never scattered in the first place, the
same re-derivation is still required: the file the block came from can
hold *other*, unrelated rules (a generic `button{}` reset, in tutTip's
case) that used to lose to the block via specificity while co-resident in
the same layer, and silently start winning once the block moves to a
layer with the wrong relative position. "Never scattered" is not the same
as "unconstrained" — check every remaining rule in the source file too,
not just the other files that used to touch the component.

### Component pilot checklist

Every consolidation or pulled-whole pilot needs all six of these before
it counts as done — skipping any one of them is exactly how relicRack,
handSwipeZone, and tutTip each shipped a first-attempt regression:

1. **Inventory** every selector and property being moved, across every
   file that currently declares them.
2. **Confirm self-containment** — the component's rules describe one UI
   concept and can be gathered into one file without duplicating a rule
   that also governs elements outside the component (see the audited
   candidates below for a case where this gate fails).
3. **Preserve original effective order** inside the new file, so
   intra-file specificity/source-order resolves priority the same way
   cross-file specificity used to.
4. **Search every remaining reference** to the moved selectors — not just
   the files the rules came from, but the multiplayer cluster and the
   `spv2.*`-layer files too (lesson 5 above).
5. **Derive the new layer's position** (before or after `legacy`) from
   that search — for each remaining competitor, does the component need
   to keep winning or keep losing against it? There is no default-safe
   side; relicRack/handSwipeZone needed `legacy` to keep winning, tutTip
   needed itself to keep winning.
6. **Run a real A/B probe** against a pre-extraction baseline (git-stash
   or git-checkout, per lesson 4) — diff every computed-style property on
   the affected elements, not a hand-picked subset (lesson 7), since the
   property that actually differs is often not the one you'd guess.

## Component consolidation pilots — audited candidates

Three follow-on candidates were audited against this checklist before
picking a next pilot. All three have since shipped
(`components/invWrap.css` + `components/invTab.css`,
`components/titleWrap.css`, `components/atticFade.css`) — two of them in a
different, narrower shape than the original audit thought possible.

- **`#invWrap` attic-mode cluster — shipped as two files, and the audit
  undersold the real complexity.** The narrower cut identified here
  (`attic.css`'s `#invWrap`-only important-tier block plus `mobile.css`'s
  base rules) was correctly gatherable, but this audit only checked
  `transform`/`pointer-events`/`z-index` for entanglement with the shared
  7-element fade rule and missed `transition` — the shared rule's
  higher-specificity `transition` value on `#invWrap` needed to keep
  beating the gathered file's own base `transition:transform .45s...`,
  which the important-tier block doesn't touch at all (only importance
  dominance was checked; the normal-tier `transition` property was not).
  That forced `invWrap` before `legacy`. Separately, `#invTab`'s own
  font-size/padding turned out to need the opposite direction (after
  `legacy`, to keep beating market.css's mobile `button{}` reset) — a
  conflict this audit never went looking for because "the invWrap
  cluster" was still being treated as one candidate at audit time. Lesson:
  an audit's job is to establish *whether* a candidate is shaped right,
  not to enumerate every constraint — still do the full checklist search
  once you commit to extracting, even for a candidate the audit called
  narrow. See the Done table entry above for the full before/after story.
- **`#titleWrap`/`.score-stack` filter cluster — shipped, but the original
  "fails gate 2" verdict was wrong.** The original audit rejected this
  because there's no selector-specific carve-out for these two anywhere —
  their entire attic-mode behavior *is* the shared 7-element rule — and
  assumed extracting them meant either duplicating the whole rule (drift
  risk) or taking on all seven elements at once. Re-examined: **selectors**
  can be partitioned out of a comma-list without duplication (no selector
  needs to appear twice), even though the **declaration values** still
  have to be copied into both the new file and the rule that keeps the
  remaining five elements — a real cost (tracked as a deliberate `!important`
  budget increase, not hidden), but a much smaller and more honest one than
  "duplicate the whole rule" implied. That reframing is what unlocked
  `components/titleWrap.css` as its own pilot without touching
  `.spread-wrap`/`.handDock`/`#relicRack`/`#invWrap`/`.refs-layer` at all.
  Lesson: a "fails gate 2" verdict can hide an unexamined middle option
  between "duplicate nothing" and "duplicate everything" — check whether
  the shared rule can be partitioned by selector before ruling out a
  narrower cut entirely.
- **The remaining four elements (`.spread-wrap`/`.handDock`/`#relicRack`/
  `.refs-layer`) — shipped as `components/atticFade.css`, and this audit's
  "still bigger than a single pilot" verdict was also wrong.** `.handDock`
  really is referenced by many more files than `#titleWrap`/`.score-stack`
  ever were (`actionDropTargets.css` three times, the whole multiplayer
  cluster, `market.css`, `mobile.css`, `ps1aesthetic.css`, plus its *base*
  geometry rule living in `hand.css`) — that part of the audit held up. What
  didn't hold up was the conclusion drawn from it: every one of those many
  touches turned out to be either property-disjoint from the fade rule's
  five properties (most of them just set `z-index`/`bottom`/`height`) or
  `!important` (the multiplayer cluster's geometry overrides), so volume of
  references was not the same thing as volume of real conflicts. `#relicRack`
  and `#invWrap` "already having their own extracted files to reconcile
  with" also turned out to be a non-issue in practice: both relationships
  reduce to simple layer-order transitivity (`relicRack` stays before
  `legacy` either way; `#invWrap` was left out of this file entirely rather
  than reconciled with). Lesson, sharpened again: "more files touch this
  selector" is not evidence of a mixed-direction conflict on its own — only
  a real per-property check tells you that, and skipping straight to "this
  looks bigger, therefore riskier" cost real progress here for a while.
- **`hand.css` state-card ladder — real, but the largest and riskiest by
  far; confirmed hardest.** `.sel`/`.ability-picked`/`.ability-target`/
  `.press-highlight`/`.hint-card`/`.hint-complete`/`.hint-multi`/
  `.purge-picked` combos are declared across `hand.css` (base),
  `market.css` (≤640px override, different pixel values, not just
  duplicates), and `mobile.css` (its own overlapping set) — dozens of
  selector blocks with three breakpoint/file tiers apiece. This is the
  exact ladder that broke the original reverted `hand.css` attempt; any
  future pass needs the full state × breakpoint × mode matrix verified,
  not a sample. Last in line if attempted at all.

## Dead-declaration candidate scanner

`scripts/find-css-dead-declaration-candidates.mjs` performs a deliberately
conservative first-pass static scan for declarations that may be dead because a
later declaration in the same layer uses the same property with equal-or-higher
specificity. Run `npm run css:dead-candidates` for markdown output or
`node scripts/find-css-dead-declaration-candidates.mjs --json` for full machine
readable output. Its output is only a candidate list: every deletion still needs
state-specific cascade-probe confirmation before removal and budget ratcheting.
