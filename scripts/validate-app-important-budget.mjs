import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// The stylesheets game.html loads outside of the Single Player V2 cascade
// (which tracks its own budget in validate-single-player-v2-cascade.mjs).
// This mirrors that guard for the rest of the app so !important reductions
// there can't silently regress either.
const appStyleFiles = [
  '../src/styles/base.css',
  '../src/styles/spread.css',
  '../src/styles/hand.css',
  '../src/styles/cards.css',
  '../src/styles/market.css',
  '../src/styles/constellations.css',
  '../src/styles/mobile.css',
  '../src/styles/dragStability.css',
  '../src/styles/handDragFix.css',
  '../src/styles/attic.css',
  '../src/styles/drawers.css',
  '../src/styles/performance.css',
  '../src/styles/mainMenu.css',
  '../src/styles/loadout.css',
  '../src/styles/matchmaking.css',
  '../src/styles/mpGame.css',
  '../src/styles/mpMobile.css',
  '../src/styles/mpSpreadCards.css',
  '../src/styles/mpFixes.css',
  '../src/styles/mpMultMobile.css',
  '../src/styles/assetLazy.css',
  '../src/styles/ps1aesthetic.css',
  '../src/styles/actionDropTargets.css',
  '../src/styles/drawAnimation.css',
  '../src/styles/components/relicRack.css',
  '../src/styles/components/handSwipeZone.css',
  '../src/styles/components/tutTip.css',
  '../src/styles/components/invWrap.css',
  '../src/styles/components/invTab.css',
  '../src/styles/components/titleWrap.css',
  '../src/styles/components/atticFade.css',
  '../src/styles/components/mpGameChrome.css',
  '../src/styles/components/inGameMenu.css',
  '../src/styles/components/atticReturnPolish.css',
];

// Budget jumped 693 -> 706 not from new !important declarations but from
// closing a tracking gap: components/relicRack.css (31) and
// components/handSwipeZone.css (17) carried their consolidated declarations
// out of files that were tracked here (market.css, mobile.css, attic.css,
// ps1aesthetic.css, handDragFix.css) into two new files that weren't. The
// actual app-wide count didn't change; the check just stopped being blind
// to it. Every future component-consolidation pilot must add its new file
// here in the same commit, or this check silently stops covering it again.
// components/tutTip.css (706, unchanged) moved its 4 declarations out of
// market.css wholesale -- a net wash, tracked here from the start.
// components/invWrap.css (6) and components/invTab.css (1) split out of
// mobile.css/attic.css, both already tracked -- another net wash, total
// stays 706.
// components/titleWrap.css (711, a REAL +5) is different: it partitions
// #titleWrap/.score-stack's selectors out of a shared comma-selector rule
// in attic.css, but the two rules still each need their own full copy of
// the same opacity/transform/filter/pointer-events/transition values (the
// remaining rule in attic.css keeps its copy; this file gets its own).
// Selectors are partitioned, declaration values are duplicated -- so this
// is a genuine, deliberate increase, not a tracking-gap artifact.
// components/atticFade.css (716, another REAL +5) does the same partition
// for the rule's remaining four elements (.spread-wrap/.handDock/
// #relicRack/.refs-layer), leaving only #invWrap's single-selector line
// behind in attic.css. Same duplication trade, same reasoning.
// components/mpGameChrome.css (716, unchanged) is a solo/laddered SPLIT
// of mpGame.css (still tracked above) rather than a consolidation --
// declarations moved, none were duplicated or newly added, so the total
// stays flat: mpGame.css's own count dropped from 56 to 41 (it kept
// .card.mp-interaction's 2 important-tier declarations, which were
// briefly extracted here too before a full A/B diff showed that broke
// its pre-existing dead-code tie against ps1aesthetic.css), and
// mpGameChrome.css's 15 makes up the difference exactly.
// mpGame.css/mpMobile.css/mpFixes.css (716, unchanged) moved from the
// shared `legacy` layer into a new shared `mpCore` layer together (a
// trio-as-one-unit extraction, not a per-file move -- see mpFixes.css's
// header comment). Pure layer renames plus one same-file rule split
// (mpMobile.css's .handDock declarations, moved between two @layer
// blocks in the same file, not duplicated) -- no declarations were
// added, removed, or duplicated, so each file's own count is unchanged
// (mpGame.css 41, mpMobile.css 51, mpFixes.css 118, same as before).
// hand.css/market.css/mobile.css/attic.css/ps1aesthetic.css moved together
// from `legacy` into a new shared `classicCore` layer (another
// trio-as-one-unit extraction, five-wide this time -- see market.css's
// header comment). This one isn't quite net-zero: mpGame.css's
// .card.mp-interaction, kept alive in a residual `legacy` block purely to
// stay co-resident with ps1aesthetic.css for a dead-code specificity tie,
// lost its reason to exist once ps1aesthetic.css moved to classicCore too
// -- deleted outright instead of relocated, dropping mpGame.css's own
// count from 41 to 39. mp-action-btn/mp-ov-btn moved back into
// mpGame.css's main mpCore block (no count change, just a location change
// within the same file) now that market.css's new before-mpCore position
// wins their fight via layer order instead of a same-layer specificity
// trick. While reconciling this, the actual summed total across
// appStyleFiles turned out to be 713 pre-extraction, not the 716 the
// budget constant claimed -- this check is a ceiling (`total <=
// importantBudget`), not an exact tally, so that drift never tripped a
// failure, but it's corrected here to the real number (713 - 2 = 711)
// rather than carried forward.
// mpSinglePlayerIsolation.css (711 -> 652) was deleted outright: every one
// of its 59 !important declarations was confirmed dead code (every rule
// gated by body.mp-game-active.single-player-v2, a combination
// mpModeClassGuard.mjs's MutationObserver enforces can never coexist on
// <body> at runtime -- see game.html's own former entry for the full
// writeup). A real reduction, not a tracking-gap correction.
// 652 -> 651 (tally correction to the true current sum, same class of drift
// as the 716 -> 713 note above). More importantly, the A/B computed-style
// reduction pass (scripts/_ab) tested these app-side declarations against 18
// UI states and found them essentially all load-bearing: classicCore/mpCore
// sit early in the layer order, where important declarations win by design
// (importance inverts layer order between cascade layers), and the fix-tier
// files (actionDropTargets, assetLazy, handDragFix, dragStability, mpFixes)
// use importance as their documented mechanism. The redundancy the pass did
// find was concentrated in the SPv2 partials (816 removals) — tracked by
// validate-single-player-v2-cascade.mjs's own budget, now 90.
// 651 -> 652 (components/mpGameChrome.css, a REAL +1): its blanket
// body.mp-game-active #abilityPrompt/#purgePrompt hide was one shared
// declaration across 7 comma-separated selectors. mpGame.mjs's own
// ability-targeting/Surgeon-swap/Purge flows reuse #abilityPrompt/
// #purgePrompt (toggling the same .show class single-player uses) and were
// silently never able to show them — this file's marked-important rule sits
// in the mpGameChrome layer, declared earlier than mpCore, and earlier
// layers win the marked-important tier, beating mpGame.mjs's own unlayered
// (weakest-tier) show override regardless of specificity. Fixed by carving
// #abilityPrompt/#purgePrompt out into their own :not(.show)-qualified rule,
// leaving the other 5 selectors' blanket hide alone — two rules where there
// was one, so a second declaration, not a tracking-gap artifact.
// 652 -> 653 (hand.css, a REAL +1): the combined hover/sel z-index:999 rule was
// split so the :hover raise is scoped to @media(hover:hover) -- stopping a
// touch-press from lifting a card's z-index before it's selected -- while
// .card.sel keeps its own always-on important z-index (needed to beat the
// per-card inline zIndex renderHand sets). One rule became two important
// declarations.
// 653 -> 655 (actionDropTargets.css, a REAL +2): the ability-flick arming glow
// (filter + box-shadow on .ability-flick-arming) has to beat the card's own
// drag-tier styling while a card is held, so both declarations are important.
// The flick-and-pop clone, particle trail, and reduced-motion fallbacks are all
// plain -- only these two need the marked-important tier.
// inGameMenu.css is tracked from creation and still adds zero marked-important
// declarations, so it does not move the ceiling.
// 655 -> 661 (atticReturnPolish.css, a REAL +6): the "Refresh attic transition
// polish styles" pass added two unlayered visibility gates for the attic/table
// handoff — the archive-eye hide (body.mode-to-attic/.mode-attic #spv2ArchiveBtn:
// visibility/opacity/pointer-events/transition, +4) and the continuous-return
// deal-pending card hide (#hand > .card:not(.card-draw-dealt): opacity/
// transition, +2). Both are unlayered and must beat the layered single-player
// chrome that would otherwise show the eye and deal the cards early, so the
// marked-important tier is the mechanism, not decoration.
// 661 -> 669 (atticReturnPolish.css + invWrap.css, a REAL +8): direct-press
// attic interaction added two explicit state overrides. Hiding both the
// constellation pill and its open callout throughout the rise/attic state needs
// display/visibility/opacity/pointer-events/transition (+5) to beat the live
// table chrome. Opening the physical archive trunk while mode-attic remains set
// needs transform/pointer-events/z-index (+3) to outrank the general stowed
// drawer rule. These declarations encode the state transition rather than
// masking accidental cascade growth.
const importantBudget = 669;
const total = appStyleFiles
  .map(path => read(path).match(/!important/g)?.length ?? 0)
  .reduce((sum, count) => sum + count, 0);
assert.ok(total <= importantBudget, `App-wide (non-SPv2) !important count ${total} exceeds budget ${importantBudget}`);

console.log('App-wide !important budget check passed.');
