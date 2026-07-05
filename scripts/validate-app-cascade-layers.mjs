import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// game.html must pre-declare the whole app's layer order before any
// stylesheet loads, so that every file's later `@layer legacy { ... }` (or
// SPv2's own spv2.* layers) resolves to the same fixed position regardless
// of load order. Losing this statement -- or reordering it -- would change
// which declarations win across the whole app, not just cosmetically.
const html = read('../game.html');
// game.html no longer links most stylesheets directly -- scripts/build-bundle.mjs
// concatenates them into dist/styles-core.css / dist/styles-components.css, and
// that script's CSS_GROUPS lists are now the source of truth for "is this file
// loaded by the app". Checks below that used to match against `html` for a
// specific components/*.css path now match against `buildScript` instead.
const buildScript = read('../scripts/build-bundle.mjs');
assert.match(
  html,
  /@layer spv2\.tokens, spv2\.base, spv2\.components, spv2\.mobile, spv2\.states, spv2\.compat, constellations, dragStability, actionDropTargets, spread, base, cards, assetLazy, mpMultMobile, mpSpreadCards, mpGameChrome, relicRack, handSwipeZone, invWrap, classicCore, legacy, spv2Core, mpCore, tutTip, invTab, titleWrap, atticFade, handDragFix, performance, drawAnimation, drawers, screens\.main-menu, screens\.loadout, screens\.matchmaking;/,
  'game.html should pre-declare the app-wide cascade layer order (spv2.* tiers, constellations, dragStability, actionDropTargets, spread, base, cards, assetLazy, mpMultMobile, mpSpreadCards, mpGameChrome, relicRack, handSwipeZone, invWrap, classicCore, legacy, spv2Core, mpCore, tutTip, invTab, titleWrap, atticFade, handDragFix, performance, drawAnimation, drawers, then standalone screens) before any stylesheet link',
);
assert.ok(
  html.indexOf('@layer spv2.tokens') < html.indexOf('<link rel="stylesheet"'),
  'the layer order pre-declaration must appear before the first stylesheet link',
);

// The last 10 SPv2 source files that shared cross-file !important
// dependencies with each other (and previously lived in the app-wide
// `legacy` layer for that reason) have since moved together into their own
// `spv2Core` layer -- see that block further below for the full reasoning
// (same ten-as-one-unit technique as mpCore/classicCore, preserving every
// internal and external tie exactly as it resolved in `legacy`).

// constellations.css: self-namespaced (.constellation-*) but NOT independent
// -- its #constellationPill/.constellation-pill element is also targeted by
// mainMenu.css's boot veil and by SPv2's base.css/relics.css for z-index and
// position. Declared before `legacy` in the master order on purpose (see
// game.html); the assertion above already locks that relative order in.
const constellations = read('../src/styles/constellations.css');
assert.match(constellations, /^@layer constellations \{/, 'constellations.css should live in its own constellations layer');
assert.match(constellations.trimEnd(), /\}$/, 'constellations.css should close its layer wrapper');

// dragStability.css: its only real interaction is mobile.css's own
// !important transition on the exact same selector -- dragStability always
// needs to win that fight (its whole purpose is disabling the transition
// while a card is actively being dragged). Its other property (will-change)
// is uncontested anywhere. Declared before `legacy` on purpose (see
// game.html); the assertion above already locks that relative order in.
const dragStability = read('../src/styles/dragStability.css');
assert.match(dragStability, /^@layer dragStability \{/, 'dragStability.css should live in its own dragStability layer');
assert.match(dragStability.trimEnd(), /\}$/, 'dragStability.css should close its layer wrapper');


// actionDropTargets.css: dynamically appended by gestureActionDrops.mjs, but
// its real cross-file conflicts are all !important-tier fixes that must keep
// beating the remaining legacy pile (drag lift z-index, contextual overlay
// stacks, SPv2 mobile action-button/drop-target states, and the generated-sheet
// background override). Normal-tier overlap hits were checked as non-conflicts:
// different target properties/pseudo-elements, identical base values, or state
// classes/elements introduced specifically for this behavior. Declared BEFORE
// `legacy` so those !important fixes keep winning even when the link is loaded
// dynamically after the initial stylesheet set.
const actionDropTargets = read('../src/styles/actionDropTargets.css');
assert.match(actionDropTargets, /^@layer actionDropTargets \{/, 'actionDropTargets.css should live in its own actionDropTargets layer');
assert.match(actionDropTargets.trimEnd(), /\}$/, 'actionDropTargets.css should close its layer wrapper');

// spread.css: every real normal-tier interaction found (market.css's mobile
// .ability-prompt/.spread/.slot/.slot .num overrides, mobile.css's
// .ability-target-slot/.ability-picked-slot highlight colors, mpMobile.css's
// mobile .slot .num, and the SPv2 bundle's normal-tier mobile/generated-sheet
// layout overrides) requires spread's declarations to keep losing against
// files still in legacy. Every !important interaction is unconditional
// importance dominance. No interaction requires spread to win against
// anything still in legacy. Declared BEFORE `legacy` on purpose (see
// game.html); the assertion above already locks that relative order in.
const spread = read('../src/styles/spread.css');
assert.match(spread, /^@layer spread \{/, 'spread.css should live in its own spread layer');
assert.match(spread.trimEnd(), /\}$/, 'spread.css should close its layer wrapper');

// base.css: the first file concatenated into legacy, so it already loses
// every normal-tier tie against every other still-in-legacy file by source
// order/specificity today. Its lone !important declaration
// (.score-preview{display:none!important}) has zero competing declarations
// anywhere. Declared BEFORE `legacy` on purpose (see game.html); the
// assertion above already locks that relative order in.
const base = read('../src/styles/base.css');
assert.match(base, /^@layer base \{/, 'base.css should live in its own base layer');
assert.match(base.trimEnd(), /\}$/, 'base.css should close its layer wrapper');

// cards.css: zero !important declarations; every real normal-tier conflict
// (market.css's mobile .title/.sym/.plaque/.seal sizing, market.css's
// .card.photo .title/.art{display:none}, mpMobile.css's mp-mode .seal
// transform) needs cards to keep losing to files still in legacy, and
// nothing anywhere needs to lose to cards. Declared BEFORE `legacy` on
// purpose (see game.html); the assertion above already locks that in.
const cards = read('../src/styles/cards.css');
assert.match(cards, /^@layer cards \{/, 'cards.css should live in its own cards layer');
assert.match(cards.trimEnd(), /\}$/, 'cards.css should close its layer wrapper');

// assetLazy.css: all rules are !important and exist specifically to override
// attic.css's normal-tier background declarations on the same elements
// (#atticScene::before/::after, #atticRoom) -- importance dominance already
// decides every current fight, and declaring it before legacy keeps it
// winning even if a competing !important ever appears in the legacy pile.
const assetLazy = read('../src/styles/assetLazy.css');
assert.match(assetLazy, /^@layer assetLazy \{/, 'assetLazy.css should live in its own assetLazy layer');
assert.match(assetLazy.trimEnd(), /\}$/, 'assetLazy.css should close its layer wrapper');

// mpMultMobile.css: a first cut at the multiplayer cluster, extracted one
// file at a time instead of bundled into one shared layer (bundling all six
// mp*.css files failed -- see the "explicitly skipped" notes below for why).
// Its four target selectors (.mp-pills-opp/.mp-pills-self/.mp-pill-score/
// .mp-mult-inline) appear nowhere in the app except mpGame.css/mpMobile.css/
// mpFixes.css (still in legacy), and every one of those other touches sets
// properties disjoint from this file's own -- zero property overlap
// anywhere, so its position is genuinely unconstrained. Declared before
// legacy for consistency with the other unconstrained layer-moves.
const mpMultMobile = read('../src/styles/mpMultMobile.css');
assert.match(mpMultMobile, /^@layer mpMultMobile \{/, 'mpMultMobile.css should live in its own mpMultMobile layer');
assert.match(mpMultMobile.trimEnd(), /\}$/, 'mpMultMobile.css should close its layer wrapper');

// mpSpreadCards.css: the second crack in the multiplayer cluster. Every
// declaration is !important, and nothing else sets that tier on the same
// property for its #spread .slot > .card / #mpOppSpread .slot > .card
// targets -- actionDropTargets.css's position/z-index there is a disjoint
// property, mpFixes.css's width/height there targets the .slot itself
// rather than the .card inside it, and market.css's unconditional
// non-important .card.photo{background-size} is importance-dominated
// regardless of layer. SPv2's own hint rules on the same selector are
// gated by body.single-player-v2, mutually exclusive with
// body.mp-game-active at runtime. Genuinely unconstrained; declared
// before legacy for consistency.
const mpSpreadCards = read('../src/styles/mpSpreadCards.css');
assert.match(mpSpreadCards, /^@layer mpSpreadCards \{/, 'mpSpreadCards.css should live in its own mpSpreadCards layer');
assert.match(mpSpreadCards.trimEnd(), /\}$/, 'mpSpreadCards.css should close its layer wrapper');

// mpSinglePlayerIsolation.css was the third crack, a different shape from
// the first two: every rule was gated by body.mp-game-active.single-player-v2
// (all of them, no exception), and those two classes are enforced mutually
// exclusive at runtime by src/app/mpModeClassGuard.mjs's MutationObserver --
// no other file referenced this combined gate. So the file's entire ruleset
// was unreachable in any rendered frame -- not property-disjoint like the
// first two, just dead. Deleted outright once every other file had its own
// reasoned layer position too, rather than keeping a whole file around just
// to document that its position didn't matter.
assert.doesNotMatch(html, /<link[^>]*mpSinglePlayerIsolation/, 'game.html should not link the deleted mpSinglePlayerIsolation.css');
assert.doesNotMatch(html, /@layer[^;]*\bmpSinglePlayerIsolation\b/, 'the master layer statement should not declare a deleted mpSinglePlayerIsolation layer');
assert.equal(existsSync(new URL('../src/styles/mpSinglePlayerIsolation.css', import.meta.url)), false, 'mpSinglePlayerIsolation.css should stay deleted');

// mpGameChrome.css: the fourth crack, a solo/laddered SPLIT of mpGame.css,
// not a whole-file layer-move. A full selector/property audit found
// mpGame.css/mpMobile.css/mpFixes.css form a deliberate cross-file
// responsive-breakpoint cascade (~50 property/selector pairs, mostly
// important-tier, resolved by source order today) -- the same shape that
// broke the reverted hand.css extraction. 61 of mpGame.css's 91 rules have
// no counterpart at all in mpMobile.css/mpFixes.css and moved here. Most
// are genuinely unconstrained (self-contained .mp-* classes, or already
// importance-dominant/property-disjoint against their one remaining
// touch), but three families needed a full computed-style A/B diff (not
// just static reasoning, which missed all three) to catch:
//   1. #spread .slot.mp-targetable/.mp-anchored/.mp-silenced/.mp-swap-a/
//      .mp-swap-pick genuinely needs to stay before legacy, to keep
//      winning a real specificity fight against ps1aesthetic.css's bare
//      .slot{border-color:...!important}.
//   2. .card.mp-interaction was NOT safe to move here: it already lost a
//      same-layer specificity tie to ps1aesthetic.css's
//      .card:not(.photo){...!important} via source order today
//      (pre-existing dead code, confirmed against a true git-checkout
//      baseline), and relocating it would revive it by swapping that
//      tie-break for plain layer order. (Since deleted outright -- see
//      the classicCore block below, where market.css/ps1aesthetic.css
//      moved out of legacy entirely and this rule stopped having
//      anywhere safe to live.)
//   3. mp-action-btn/mp-ov-btn were NOT safe to move here either, in the
//      opposite direction from #1: both render as real <button> elements
//      and need to keep beating market.css's mobile-breakpoint bare
//      button{font-size:12px;padding:6px 9px} reset via specificity,
//      which requires AFTER legacy -- the same conflict already
//      documented above for tutTip.css's #tutSkipBtn. (Since moved back
//      into mpCore's main block -- see the classicCore block below.)
// Items 2 and 3 stayed behind in mpGame.css/legacy at the time (no single
// file position satisfied both #1 and #3). The other 32 rules (the
// laddered core, plus .card.mp-interaction, mp-action-btn, mp-ov-btn)
// stayed in mpGame.css/legacy untouched -- until the classicCore
// extraction below moved market.css/ps1aesthetic.css out of legacy too,
// which resolved items 2 and 3 differently (see that block).
const mpGameChrome = read('../src/styles/components/mpGameChrome.css');
assert.match(mpGameChrome, /^@layer mpGameChrome \{/, 'mpGameChrome.css should live in its own mpGameChrome layer');
assert.match(mpGameChrome.trimEnd(), /\}$/, 'mpGameChrome.css should close its layer wrapper');
assert.match(buildScript, /components\/mpGameChrome\.css/, 'build-bundle.mjs should bundle the extracted mpGameChrome component stylesheet');
assert.doesNotMatch(mpGameChrome, /\.card\.mp-interaction\s*\{/, 'mpGameChrome.css should not own a .card.mp-interaction rule -- it was deleted outright as confirmed-dead code, not relocated here');
assert.doesNotMatch(mpGameChrome, /\.mp-action-btn\s*\{|\.mp-ov-btn\s*\{/, 'mpGameChrome.css should not own mp-action-btn/mp-ov-btn -- they live in mpCore\'s main block now that market.css moved to classicCore');
assert.doesNotMatch(read('../src/styles/mpGame.css'), /\.mp-persona|\.mp-ov-box/, 'mpGame.css should no longer own the solo chrome rules moved to mpGameChrome.css');
assert.match(read('../src/styles/mpGame.css'), /\.mp-action-btn\s*\{/, 'mpGame.css should retain the mp-action-btn rule (now in its main mpCore block, since market.css moved to classicCore)');
assert.match(read('../src/styles/mpGame.css'), /\.mp-ov-btn\s*\{/, 'mpGame.css should retain the mp-ov-btn rule (now in its main mpCore block, since market.css moved to classicCore)');
assert.doesNotMatch(read('../src/styles/mpGame.css'), /\.card\.mp-interaction\s*\{/, 'mpGame.css should no longer own a .card.mp-interaction rule -- deleted outright as confirmed-dead code once ps1aesthetic.css moved to classicCore');
assert.doesNotMatch(read('../src/styles/mpGame.css'), /@layer legacy/, 'mpGame.css should no longer need a residual legacy block -- both of its former exceptions were resolved by the classicCore extraction');

// mpCore: the fifth crack, a trio-as-one-unit extraction of mpGame.css's
// laddered core + mpMobile.css + mpFixes.css into one new shared layer --
// not a single-file layer-move. These three can't be split into DIFFERENT
// layers from each other (their ~50-property-pair cross-file ladder relies
// on source order within one shared layer), but nothing requires them to
// stay co-resident with the rest of legacy specifically, so all three moved
// together, declared in the same relative link order (mpGame.css,
// mpMobile.css, mpFixes.css) so their internal ties keep resolving exactly
// as before. A full audit against every other file in the app (everything
// still in legacy, every already-extracted layer, all 10 SPv2 files) found
// the trio's real external conflicts point overwhelmingly one direction
// (after legacy -- ~8 normal-tier specificity ties against bare rules in
// market.css/hand.css/spread.css), with exactly one exception: mpMobile.css's
// .handDock{bottom,background} needs the opposite direction (before legacy),
// to keep beating ps1aesthetic.css's unconditional, important-tier
// .handDock{bottom,background} rule via specificity. Those two declarations
// were split out into a small residual legacy block in mpMobile.css instead
// of moving the whole trio the wrong way. mpCore is declared shortly
// after legacy (classicCore is declared immediately BEFORE legacy instead --
// see that block below for why -- so it stays transitively earlier than
// mpCore either way; spv2Core now sits between legacy and mpCore too --
// see that block further below -- but needs the same "earlier than mpCore"
// direction for its own reasons, so this is unaffected); mpCore in turn
// sits before handDragFix.css's bare,
// important-tier .handDock{z-index:26} rule, which mpGame.css's z-index
// override needs to keep beating -- see src/styles/mpFixes.css's header
// comment for the full writeup.
const mpGameCore = read('../src/styles/mpGame.css');
const mpMobileCore = read('../src/styles/mpMobile.css');
const mpFixesCore = read('../src/styles/mpFixes.css');
assert.match(mpGameCore, /^@layer mpCore \{/, 'mpGame.css should open with its laddered core in the mpCore layer');
assert.doesNotMatch(mpGameCore, /\n@layer legacy \{/, 'mpGame.css should no longer carry a residual legacy block -- both former exceptions were resolved by the classicCore extraction');
assert.match(mpMobileCore, /^@layer mpCore \{/, 'mpMobile.css should open with its bulk content in the mpCore layer');
assert.match(mpMobileCore, /\n@layer legacy \{/, 'mpMobile.css should carry a residual legacy block for the .handDock bottom/background split');
assert.match(mpFixesCore, /^@layer mpCore \{/, 'mpFixes.css should live entirely in the mpCore layer');
assert.doesNotMatch(mpFixesCore, /@layer legacy \{/, 'mpFixes.css has no real conflicts requiring a legacy exception, unlike mpGame.css/mpMobile.css');
assert.doesNotMatch(
  mpMobileCore.slice(0, mpMobileCore.indexOf('@layer legacy')),
  /body\.mp-game-active \.handDock \{[^}]*bottom:/,
  'mpMobile.css\'s mpCore block should not retain .handDock\'s bottom declaration -- it must live in the residual legacy block instead',
);
assert.match(
  mpMobileCore.slice(mpMobileCore.indexOf('@layer legacy')),
  /body\.mp-game-active \.handDock \{[^}]*bottom:\s*0\s*!important;[^}]*background:/,
  'mpMobile.css\'s residual legacy block should retain .handDock\'s bottom/background declarations',
);

// classicCore: resolves what used to be this migration's "structural wall"
// -- hand.css, market.css, mobile.css, attic.css, and ps1aesthetic.css form
// a deliberate cross-file specificity ladder with EACH OTHER (confirmed by
// an earlier, reverted attempt to extract hand.css alone: market.css's
// mobile block deliberately uses low-specificity overrides and relies on
// hand.css's higher-specificity state combos to keep beating them via
// specificity). Like mpCore, nothing requires these five to stay
// co-resident with the rest of legacy, only with each other, so all five
// moved together into one new shared layer, in their original relative
// link order (hand, market, mobile, attic, ps1aesthetic).
//
// classicCore is declared BEFORE legacy, immediately preceding it (the last
// of the before-legacy layers) -- NOT after legacy, where this shipped
// originally. The first audit checked the cluster against every
// already-extracted layer and every other legacy-resident file EXCEPT the
// 10 SPv2 source files still sharing `legacy` themselves; those files'
// body.single-player-v2-prefixed rules rely on higher specificity to beat
// this cluster's classic-mode rules on shared elements (#titleWrap/
// #menuBtn/.score-stack/#spread .slot, among others), previously decided
// by specificity within the one shared legacy layer. Declaring classicCore
// AFTER legacy silently swapped that for pure layer order, and since
// classicCore was later, it started winning every one of those ties
// regardless of the SPv2 files' higher specificity -- 286 real same-tier
// conflicts, confirmed by audit and then by a computed-style A/B diff
// against a true pre-classicCore baseline (single-player-v2's #titleWrap
// filter read back as ps1aesthetic.css's saturate(.74) instead of none;
// #menuBtn's z-index/padding/border/color all read back as market.css's
// classic-mode values). This shipped as a real regression before it was
// caught by re-checking classicCore's relationship with the SPv2 files
// prior to migrating them, per this doc's own "re-examine skips after
// every extraction" rule. Moving classicCore before legacy restores the
// specificity-based tie-break for all ten files and still satisfies every
// other requirement the original audit found: classicCore stays earlier
// than mpCore/titleWrap/drawAnimation/drawers (normal-tier ties it needs
// to keep LOSING) and earlier than performance.css (an important-tier
// #roomAmbient tie it needs to keep WINNING) -- before-legacy is earlier
// than after-legacy either way, so none of those directions flip. Its
// order against every other before-legacy layer is unaffected too:
// classicCore was already later than all of them as the last "after
// legacy" layer, and stays later than all of them as the last "before
// legacy" layer. The one real trade-off: mainMenu.css's zero-specificity
// :where(...) boot-veil rule and attic.css's own #atticScene transition now
// tie the other way during boot states (mainMenu.css wins instead of
// attic.css's after-legacy layer-order trick) -- checked via the same
// true-baseline technique and found to only change an invisible transition
// duration on an element that isn't visible during boot either way, an
// acceptable trade given the alternative is a confirmed single-player-v2
// regression. See src/styles/market.css's header comment for the full
// writeup. This extraction also resolved mpGame.css's two former legacy
// exceptions, both unaffected by the position fix: mp-action-btn/mp-ov-btn
// moved back into mpCore's main block (market.css's before-mpCore position
// either way already wins their fight via normal-tier layer order), and
// .card.mp-interaction -- confirmed-dead code that only existed to preserve
// a same-layer specificity tie against ps1aesthetic.css -- was deleted
// outright instead of relocated.
const classicCoreFiles = [
  '../src/styles/hand.css',
  '../src/styles/market.css',
  '../src/styles/mobile.css',
  '../src/styles/attic.css',
  '../src/styles/ps1aesthetic.css',
];
for (const path of classicCoreFiles) {
  const text = read(path);
  assert.match(text, /^@layer classicCore \{/, `${path} should live in the classicCore layer`);
  assert.match(text.trimEnd(), /\}$/, `${path} should close its classicCore layer wrapper`);
}

// spv2Core: the tenth crack -- the last 10 SPv2 source files that stayed in
// the app-wide `legacy` layer (the other 6 -- tokens.css, components/hand.css,
// components/relics.css, components/spreadHints.css,
// components/utilityButtons.css, components/utilityIcons.css -- already own
// spv2.tokens/spv2.components). A ten-as-one-unit extraction, same technique
// as mpCore/classicCore: 9 of the 10 are gated to the same
// @media(max-width:640px) breakpoint and form a genuine cross-file
// specificity/media ladder with each other (base.css's low-specificity
// `body.single-player-v2 .score-stack` base rule is deliberately overridden
// by compat.css's higher-specificity `body.single-player-v2.generated-sheet-
// ready .score-stack` at the generated-sheet breakpoint -- the same shape as
// classicCore's market/hand ladder). The tenth, desktop.css, is gated to
// @media(min-width:641px) -- mutually exclusive with the other nine's
// breakpoint, so no intra-cluster ties, but it shares the same external
// position requirements, so it moved along with the rest. A full audit
// against every already-extracted layer and everything still in `legacy`
// (just mpMobile.css's one residual rule -- gated to `body.mp-game-active`,
// mutually exclusive with this cluster's `body.single-player-v2` at runtime
// -- and mainMenu.css's boot veil, which never touches any property this
// cluster also touches) found every real conflict already satisfied by this
// cluster's previous position (inside `legacy` itself, unmoved): later than
// classicCore/actionDropTargets/mpGameChrome/handSwipeZone and every other
// before-legacy layer, earlier than mpCore/titleWrap/atticFade/handDragFix/
// performance/drawAnimation/drawers. Declared immediately after legacy,
// before mpCore -- the smallest possible move, preserving every relationship
// unchanged. See src/styles/singlePlayerV2/base.css's header comment and
// game.html's own spv2Core entry for the complete audit writeup.
const spv2CoreFiles = [
  '../src/styles/singlePlayerV2/base.css',
  '../src/styles/singlePlayerV2/compat.css',
  '../src/styles/singlePlayerV2/desktop.css',
  '../src/styles/singlePlayerV2/assets.css',
  '../src/styles/singlePlayerV2/layout.css',
  '../src/styles/singlePlayerV2/mobile.css',
  '../src/styles/singlePlayerV2/components/spread.css',
  '../src/styles/singlePlayerV2/components/scoreHud.css',
  '../src/styles/singlePlayerV2/states.css',
  '../src/styles/singlePlayerV2/components/artIntegration.css',
];
for (const path of spv2CoreFiles) {
  const text = read(path);
  assert.match(text, /^@layer spv2Core \{/, `${path} should live in the spv2Core layer`);
  assert.match(text.trimEnd(), /\}$/, `${path} should close its spv2Core layer wrapper`);
}

// relicRack.css: consolidates the relic rack's previously scattered rules
// (market base, mobile/classic, attic, PS1, and SPv2 mode overrides) into
// one component stylesheet in their original effective order. Declared
// BEFORE legacy: attic.css's mode-gated filter:blur() on #relicRack (now in
// classicCore, itself before legacy but still later than relicRack) must
// keep winning over relicRack's own unconditional filter:saturate() --
// previously decided by attic's higher specificity within the shared legacy
// layer, now decided by classicCore remaining the later layer for this
// normal-tier property regardless of which side of legacy it sits on.
// Placing this layer AFTER legacy (the
// first attempt) silently flipped that: verified empirically that
// #relicRack's computed filter during body.mode-attic changed from
// blur(3px) to saturate(.7) contrast(1.03), a real regression caught and
// fixed via a git-checkout A/B against the pre-consolidation commit, not
// just by re-reading the code. Nothing else in legacy still touches
// .relic-rack/.relic-btn/.relic-slot-empty's box or position properties.
const relicRack = read('../src/styles/components/relicRack.css');
assert.match(relicRack, /^@layer relicRack \{/, 'relicRack.css should live in its own relicRack layer');
assert.match(relicRack.trimEnd(), /\}$/, 'relicRack.css should close its layer wrapper');

// handSwipeZone.css: consolidates the swipe gesture surface and tutorial hint
// rules that were previously spread across mobile.css, ps1aesthetic.css,
// attic.css, and the swipe-zone portion of handDragFix.css. Declared BEFORE
// legacy, same reasoning as relicRack: mpMobile.css's mp-game-active-only
// height/bottom !important override (still in legacy) must keep losing to
// the consolidated file's mobile-breakpoint #handSwipeZone.hand-swipe-zone
// rule (previously decided by the latter's higher ID-based specificity
// within the shared legacy layer). Placing this layer AFTER legacy (the
// first attempt) flipped that: verified empirically via a git-checkout A/B
// against the pre-consolidation commit that in mp-game-active mode without
// SPv2, computed height/bottom changed from 97px/152px to 46px/130px, a
// real regression in reachable plain-multiplayer mobile UI. The same
// misplacement also flipped a second, independent fight: in SPv2 mode the
// tutorial hint's #handSwipeZone .swipe-hint-line{display:none!important}
// default must keep beating mpFixes.css's mp-game-active hint-hiding rule
// via ID specificity, but lost to it via layer order instead, making all
// three swipe-hint-line steps render simultaneously instead of just the
// active one -- confirmed via the same A/B and fixed by the same move.
// mpMobile.css's z-index:9401 on the same selector is untouched either way
// -- the consolidated file only ever sets a normal-tier z-index on the bare
// .hand-swipe-zone class there, so !important always won regardless of
// layer position. mpSinglePlayerIsolation.css's (since deleted entirely,
// see above) mp+SPv2-gated #handSwipeZone block was already dead code
// before this file even existed -- singlePlayerV2/components/
// hand.css's own #handSwipeZone rule lives in the spv2.components layer,
// declared earlier than legacy in the master statement, so it already wins
// that fight on layer order alone regardless of specificity, confirmed
// identical before and after this file's move (also: body.mp-game-active
// and body.single-player-v2 are mutually exclusive at runtime via a class
// guard, so this combination is only reachable as a transient state).
const handSwipeZone = read('../src/styles/components/handSwipeZone.css');
assert.match(handSwipeZone, /^@layer handSwipeZone \{/, 'handSwipeZone.css should live in its own handSwipeZone layer');
assert.match(handSwipeZone.trimEnd(), /\}$/, 'handSwipeZone.css should close its layer wrapper');
assert.match(buildScript, /components\/handSwipeZone\.css/, 'build-bundle.mjs should bundle the consolidated hand swipe-zone component stylesheet');
assert.doesNotMatch(read('../src/styles/mobile.css'), /\.hand-swipe-zone\{position:fixed/, 'mobile.css should no longer own the swipe-zone base geometry');
assert.doesNotMatch(read('../src/styles/attic.css'), /#handSwipeZone\.hand-swipe-zone\{height:121px!important/, 'attic.css should no longer own swipe-zone tutorial geometry');

// tutTip.css: pulled whole out of market.css rather than consolidated --
// its rules weren't scattered across files to begin with. Most remaining
// touches are safe regardless of layer position (mpGame.css's
// display:none!important, actionDropTargets.css's z-index:10130!important,
// mainMenu.css's boot-veil visibility/pointer-events/transition are each
// either importance-dominant or a disjoint property) -- but one is not:
// market.css's mobile-breakpoint button{font-size:12px;padding:6px 9px}
// reset (still in legacy) must keep losing to #tutSkipBtn's higher
// ID-based specificity, previously decided within the shared legacy layer.
// Declared BEFORE legacy (the first attempt, mirroring relicRack/
// handSwipeZone) flipped that: verified empirically that computed
// font-size/padding on #tutSkipBtn changed from 11px/3px 8px to
// 12px/6px 9px, growing the popover's height from 134px to 144px.
// relicRack/handSwipeZone need legacy to keep winning; tutTip needs itself
// to keep winning -- the opposite constraint -- so tutTip is declared
// AFTER legacy instead. No bare span{}/div{}/p{} reset elsewhere in legacy
// competes with tutTip's own low-specificity selectors (.tut-arrow/
// .tut-foot/.tut-tap-prompt), so this move doesn't create the reverse bug.
const tutTip = read('../src/styles/components/tutTip.css');
assert.match(tutTip, /^@layer tutTip \{/, 'tutTip.css should live in its own tutTip layer');
assert.match(tutTip.trimEnd(), /\}$/, 'tutTip.css should close its layer wrapper');
assert.match(buildScript, /components\/tutTip\.css/, 'build-bundle.mjs should bundle the extracted tutTip component stylesheet');
assert.doesNotMatch(read('../src/styles/market.css'), /#tutTip\{position:fixed/, 'market.css should no longer own the tutTip popover rules');

// invWrap.css / invTab.css: the archive/inventory drawer and its pull-tab,
// consolidated out of mobile.css's base rules and attic.css's
// mode-transition important-tier block. Could not stay one file: attic.css's
// shared 7-element mode-transition fade rule (still in legacy -- also
// covers #titleWrap/.score-stack/.spread-wrap/.handDock/#relicRack/
// .refs-layer, so it can't be absorbed without duplicating a rule that
// isn't invWrap's alone) sets a normal-tier `transition` value on #invWrap
// that must keep winning via its higher specificity over invWrap's own
// base `transition:transform .45s...`, requiring invWrap BEFORE legacy
// (same direction as relicRack/handSwipeZone) -- while market.css's
// mobile-breakpoint `button{font-size:12px;padding:6px 9px}` reset (still
// in legacy) must keep losing to #invTab's higher ID-based specificity,
// requiring invTab AFTER legacy (same direction as tutTip, and the same
// failure mode tutTip hit with #tutSkipBtn). One file could not satisfy
// both directions, so the pair was split before either shipped with a
// first-attempt regression like the earlier three pilots did.
const invWrap = read('../src/styles/components/invWrap.css');
assert.match(invWrap, /^@layer invWrap \{/, 'invWrap.css should live in its own invWrap layer');
assert.match(invWrap.trimEnd(), /\}$/, 'invWrap.css should close its layer wrapper');
assert.match(buildScript, /components\/invWrap\.css/, 'build-bundle.mjs should bundle the extracted invWrap component stylesheet');
const invTab = read('../src/styles/components/invTab.css');
assert.match(invTab, /^@layer invTab \{/, 'invTab.css should live in its own invTab layer');
assert.match(invTab.trimEnd(), /\}$/, 'invTab.css should close its layer wrapper');
assert.match(buildScript, /components\/invTab\.css/, 'build-bundle.mjs should bundle the extracted invTab component stylesheet');
assert.doesNotMatch(read('../src/styles/mobile.css'), /#invWrap\{position:fixed/, 'mobile.css should no longer own the invWrap base geometry');
assert.doesNotMatch(read('../src/styles/mobile.css'), /#invTab\{position:absolute/, 'mobile.css should no longer own the invTab base geometry');
assert.doesNotMatch(read('../src/styles/attic.css'), /#invWrap,\nbody\.mode-attic #invWrap,/, 'attic.css should no longer own the old multi-line invWrap-only mode-transition block (a single-selector #invWrap{...} line per mode, now that titleWrap.css/atticFade.css split the rest of the once-shared fade rule out, is expected to remain)');

// titleWrap.css: #titleWrap and .score-stack's share of the originally
// shared 7-element attic fade rule. The selector list is partitioned, not
// duplicated (no selector appears in both places), but the declaration
// values ARE duplicated -- see the file's own header comment and
// validate-app-important-budget.mjs for why that raises the tracked
// budget by 5. Declared AFTER legacy, same direction as tutTip/invTab:
// ps1aesthetic.css's unconditional filter:saturate() on both elements
// (still in legacy) must keep losing to this file's mode-gated
// filter:blur() during attic transitions, previously decided by the fade
// rule's higher specificity within the shared layer.
const titleWrap = read('../src/styles/components/titleWrap.css');
assert.match(titleWrap, /^@layer titleWrap \{/, 'titleWrap.css should live in its own titleWrap layer');
assert.match(titleWrap.trimEnd(), /\}$/, 'titleWrap.css should close its layer wrapper');
assert.match(buildScript, /components\/titleWrap\.css/, 'build-bundle.mjs should bundle the extracted titleWrap component stylesheet');
assert.doesNotMatch(read('../src/styles/attic.css'), /#titleWrap|\.score-stack/, 'attic.css should no longer reference #titleWrap or .score-stack anywhere');

// atticFade.css: .spread-wrap/.handDock/#relicRack/.refs-layer's share of
// the same originally-shared fade rule. #invWrap deliberately stays behind
// as attic.css's own single-selector rule (see invWrap.css's header
// comment); moving it here too would be redundant, not incorrect. Same
// partition/duplication trade as titleWrap.css (another +5 on the
// !important budget) and the same AFTER-legacy direction: every remaining
// cross-file touch on these four elements checked out as property-disjoint
// from opacity/transform/filter/pointer-events/transition, or important-tier
// and therefore importance-dominant regardless of layer (mostly the
// multiplayer cluster's geometry overrides) -- see the file's own header
// comment for the full per-element breakdown. #relicRack's own unconditional
// filter:saturate() (in the relicRack layer, before legacy) needs to keep
// losing to this file's mode-gated filter:blur(), same as always -- relicRack
// stays earlier than legacy either way, so this file (after legacy) stays
// later than relicRack regardless of specificity.
const atticFade = read('../src/styles/components/atticFade.css');
assert.match(atticFade, /^@layer atticFade \{/, 'atticFade.css should live in its own atticFade layer');
assert.match(atticFade.trimEnd(), /\}$/, 'atticFade.css should close its layer wrapper');
assert.match(buildScript, /components\/atticFade\.css/, 'build-bundle.mjs should bundle the extracted atticFade component stylesheet');
assert.doesNotMatch(read('../src/styles/attic.css'), /\.spread-wrap|\.handDock|#relicRack|\.refs-layer/, 'attic.css should no longer reference .spread-wrap, .handDock, #relicRack, or .refs-layer anywhere');
assert.match(read('../src/styles/attic.css'), /#invWrap\{opacity:0;transform:scale\(\.9\)/, 'attic.css should still own the single-selector #invWrap mode-transition rule');

// drawAnimation.css: must WIN the !important tie against drawers.css's
// reduced-motion .hand .card{animation:none!important} (so its deal-in fade
// still plays) while LOSING the !important ties against the SPv2 bundle's
// mobile pointer-events override and actionDropTargets' drag-lift z-index.
// Unextractable while drawers.css shared legacy; now that drawers has its
// own later layer, the slot between legacy and drawers satisfies every
// direction at once. The master-statement assertion above locks that
// relative order (legacy < handDragFix/performance < drawAnimation < drawers).
const drawAnimation = read('../src/styles/drawAnimation.css');
assert.match(drawAnimation, /^@layer drawAnimation \{/, 'drawAnimation.css should live in its own drawAnimation layer');
assert.match(drawAnimation.trimEnd(), /\}$/, 'drawAnimation.css should close its layer wrapper');

// handDragFix.css: its .handDock z-index needs to keep losing to
// actionDropTargets.css's higher, state-gated z-index in the earlier
// actionDropTargets layer and to mpGame.css's higher, state-gated z-index
// overrides in legacy. Its other declarations either have no competing declaration
// anywhere, or are already dominated unconditionally by an existing
// spv2.components !important rule -- checked individually. Declared AFTER
// `legacy` on purpose (opposite direction from dragStability); the
// assertion above already locks that relative order in.
const handDragFix = read('../src/styles/handDragFix.css');
assert.match(handDragFix, /^@layer handDragFix \{/, 'handDragFix.css should live in its own handDragFix layer');
assert.match(handDragFix.trimEnd(), /\}$/, 'handDragFix.css should close its layer wrapper');

// performance.css: its mobile/reduced-motion overrides need to keep losing to
// actionDropTargets.css's SPv2-mode background-attachment override in the
// earlier actionDropTargets layer and to ps1aesthetic.css's explicit
// "re-enable candle glow on mobile" override still in legacy. Declared AFTER `legacy` on purpose, same direction as
// handDragFix; the assertion above already locks that relative order in.
const performance_ = read('../src/styles/performance.css');
assert.match(performance_, /^@layer performance \{/, 'performance.css should live in its own performance layer');
assert.match(performance_.trimEnd(), /\}$/, 'performance.css should close its layer wrapper');

// drawers.css: needs to keep LOSING two !important ties (SPv2 desktop.css's
// display:block!important un-hide of #scoringBtn/#abilitiesBtn/#menuBtn, and
// drawAnimation.css's reduced-motion deal-in fade, both still in legacy) while
// needing to keep WINNING two normal-tier ties (handCardIdleCycle vs
// market.css's card-wave, and its #settingsPanel sizing vs mobile.css's base
// rule, both still in legacy). Declared AFTER `legacy` on purpose, same
// direction as handDragFix/performance; the assertion above already locks
// that relative order in.
const drawers = read('../src/styles/drawers.css');
assert.match(drawers, /^@layer drawers \{/, 'drawers.css should live in its own drawers layer');
assert.match(drawers.trimEnd(), /\}$/, 'drawers.css should close its layer wrapper');

// Standalone screens: every selector is scoped to that screen's own classes
// or ids (verified against the actual render/DOM-construction code, not
// inferred), so they don't need to sit in the shared legacy pile. They live
// in their own `screens.*` layer instead.
const loadout = read('../src/styles/loadout.css');
assert.match(loadout, /^@layer screens\.loadout \{/, 'loadout.css should live in its own screens.loadout layer');
assert.match(loadout.trimEnd(), /\}$/, 'loadout.css should close its layer wrapper');

const matchmaking = read('../src/styles/matchmaking.css');
assert.match(matchmaking, /^@layer screens\.matchmaking \{/, 'matchmaking.css should live in its own screens.matchmaking layer');
assert.match(matchmaking.trimEnd(), /\}$/, 'matchmaking.css should close its layer wrapper');

// mainMenu.css is split: the "boot veil" rules reach into gameplay elements
// owned by other legacy files (a real cross-file dependency), so those stay
// in `legacy`. Everything else only ever touches #mainMenu/.main-menu-* and
// moves to its own screens.main-menu layer.
const mainMenu = read('../src/styles/mainMenu.css');
assert.match(mainMenu, /^@layer legacy \{/m, 'mainMenu.css should keep its boot-veil rules in the shared legacy layer');
assert.match(mainMenu, /@layer screens\.main-menu \{/, 'mainMenu.css should move its self-contained #mainMenu rules to screens.main-menu');
const mainMenuLegacyBlock = mainMenu.slice(mainMenu.indexOf('@layer legacy {'), mainMenu.indexOf('@layer screens.main-menu {'));
assert.match(mainMenuLegacyBlock, /#titleWrap/, 'the boot-veil block should still cover the shared gameplay elements it fades');
assert.doesNotMatch(mainMenuLegacyBlock, /#mainMenu\{/, 'the legacy block should not also contain the standalone #mainMenu overlay rules');

console.log('App-wide cascade layer checks passed.');
