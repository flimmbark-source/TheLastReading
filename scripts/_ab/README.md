# A/B computed-style verification harness

Tooling behind the verified `!important` reduction (see the budget notes in
`scripts/validate-app-important-budget.mjs` and
`scripts/validate-single-player-v2-cascade.mjs`).

## Pieces

- **capture.mjs** — boots the game into deterministic UI states (seeded
  `Math.random`, preset localStorage, reduced motion, phone + desktop
  viewports, real mid-drag holds via CDP touch) and dumps the computed style
  of every element and its `::before`/`::after` to JSON.
  Env: `TLR_PORT` (default 8080), `TLR_SKIP` (comma-separated state names to
  skip — trimmed runs must be backstopped by one full-state verification).
- **diff.mjs** — compares two captures. `--write-mask` records the differing
  keys of two *control* runs (ambient animation noise); `--mask` applies it.
- **reduceB2.mjs** — the reduction driver: enumerates every `!important`
  outside comments, removes them in group batches against a repo copy, and
  accepts a batch only when a capture matches the baseline at zero diffs.
  Dirty batches are bisected diff-guided: the failing computed properties
  select suspect declarations, so keepers cost ~2–3 targeted runs instead of
  a blind binary search. Progress is checkpointed after every decision and
  the driver resumes from the checkpoint on restart. Copy paths, port, file
  list, and the enumeration commit SHA are set at the top of the file.
- **recover.mjs** — reconstructs a checkpoint from a working tree that
  already has removals applied (tree-vs-`git show` diff), used after a
  container restart.

## Method

1. Two control captures; their diff becomes the noise mask.
2. Per-batch: apply removals → capture → diff vs baseline → accept at zero.
3. Bisect dirty batches to the load-bearing declarations; they keep
   `!important`.
4. Final full-state verification of the combined result before committing.

## Findings (July 2026 pass)

- SPv2 partials: 816 of ~900 declarations were redundant — the `@layer`
  order already decided those fights. Removed.
- Everything else (classicCore, mpCore, fix-tier files): load-bearing.
  classicCore/mpCore sit early in the layer order, where `!important` wins
  *because* importance inverts layer order; the fix-tier files use
  importance as their documented mechanism. Left intact.
