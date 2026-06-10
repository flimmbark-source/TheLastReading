# Architecture automation plan

This document defines how much of the migration can be automated and where human/browser verification is still required.

The goal is to make the migration repeatable without doing a dangerous one-shot rewrite of `index.html`.

## Short answer

Yes, most of the migration can be automated, but not all of it should be fully automated.

The safe automation model is:

```txt
extract module -> add validation -> bridge legacy behavior -> migrate one action -> run checks -> browser verify -> commit
```

Avoid:

```txt
rewrite the entire app at once
```

That would be especially risky because the current app is a large patched `index.html` with many intertwined global functions.

## Automation lanes

### Lane A: Fully automatable by assistant/GitHub commits

These can usually be done directly in small commits:

- Add new `src/data/*` modules.
- Add new `src/systems/*` modules.
- Add reducer actions and selectors.
- Add validation scripts.
- Add browser diagnostics modules.
- Add docs and migration checklists.
- Add PR comments documenting status.
- Add pure logic tests that do not require a browser.

Acceptance:

```sh
node scripts/validate-all.mjs
```

### Lane B: Semi-automatable with Codespaces patch scripts

These touch the giant `index.html`, so they should be done through local scripts in Codespaces where the whole file is available.

Examples:

- Injecting small module script tags.
- Adding legacy snapshot readers.
- Wrapping existing global functions.
- Replacing one legacy state mutation at a time.
- Adding bridge calls after `render()`.

Acceptance:

1. Run validation scripts.
2. Run the browser app.
3. Confirm console diagnostics.
4. Commit only after the browser behavior is confirmed.

### Lane C: Human/browser verification required

These should not be trusted to automated checks alone:

- Visual layout.
- Mobile hand behavior.
- Drag/tap feel.
- Card readability.
- Animation timing.
- Ability modal clarity.
- Shop/attic navigation feel.
- Any change involving CSS extraction.

Acceptance:

Manual playtest on desktop and mobile viewport.

## Recommended automation tools to add

### 1. A local migration patch runner

Add:

```txt
scripts/migration/apply-step.mjs
```

Purpose:

- Apply one named migration patch to `index.html`.
- Refuse to run if the target marker is missing.
- Refuse to run if the patch was already applied.
- Print exact manual checks after applying.

Example usage:

```sh
node scripts/migration/apply-step.mjs mount-live-mirror
node scripts/migration/apply-step.mjs mirror-after-render
node scripts/migration/apply-step.mjs selection-through-store
```

### 2. A browser checklist file

Add:

```txt
scripts/migration/checklists/*.md
```

Each migration step should have a matching checklist.

Example:

```txt
selection-through-store.md
```

Checks:

- Click card selects it.
- Click same card deselects it.
- Blank click deselects it.
- Discard button updates.
- Slot targeting updates.
- `window.tlrMirrorLiveState({ sync: true }).ok === true`.

### 3. A migration status tracker

Add:

```txt
docs/migration-status.md
```

Track every migrated behavior:

```txt
[done] cards data
[done] scoring system
[done] live mirror
[next] selection state
[blocked] full CSS extraction until reducer controls gameplay
```

## Safe execution order from here

Current confirmed state:

- `node scripts/validate-all.mjs` passes.
- Browser live mirror sync returns `ok: true`.
- Legacy snapshot is stored in `window.tlrStore.getState().run.legacySnapshot`.

Next automation target:

```txt
selection-through-store
```

Steps:

1. Add a migration patch script for selected-card state.
2. Patch only selection/deselection wrappers in `index.html`.
3. Keep old render function.
4. Mirror selected value back into legacy `state.selected` for compatibility.
5. Run validation.
6. Browser verify.
7. Commit.

## What the assistant can do reliably

I can:

- Write the migration scripts.
- Write the validation checks.
- Add the reducer/action/system code.
- Keep the PR/status docs updated.
- Review console output you paste back.
- Generate the next precise patch step.
- Commit each safe piece.

## What the assistant should not do blindly

I should not:

- Rewrite the entire `index.html` through the GitHub connector.
- Delete the patch chain before behavior is proven in `src/`.
- Extract CSS and gameplay logic in the same step.
- Assume browser behavior is correct without you running it.
- Claim checks passed unless you or a real runtime confirmed them.

## End-state automation goal

Eventually, the migration should reach this command sequence:

```sh
node scripts/validate-all.mjs
python3 -m http.server 5173
```

Then browser smoke tests verify:

```js
window.tlrMirrorLiveState().ok
```

When the old app is fully migrated, `window.tlrMirrorLiveState` should become unnecessary because there is no longer a legacy state to compare against.
