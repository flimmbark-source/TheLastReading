# The Last Reading — canonical game language

Mechanical copy uses a controlled vocabulary so players learn a term once and recognize it everywhere. Source strings use `[[term]]` or `[[term|visible label]]`; the renderer owns color, icons, definitions, accessibility, and future localization.

## Scoring and economy

- **Chips** — base scoring value before Mult. Never call these “points” in rules text.
- **Mult** — multiplies Chips. Never alternate with “multiplier” in rules text.
- **Score** — the final scoring value.
- **Threshold** — the Score required to clear a Reading.
- **Reserve** — Market currency. “Pool” remains an internal/legacy implementation word only.

## Actions

- **Play** — move a card from Hand to an open Spread slot.
- **Draw** — move card(s) from Deck to Hand.
- **Discard** — spend a Discard to activate a card Ability instead of Playing it.
- **Reveal** — expose cards without automatically moving them.
- **Take** — move one revealed card into Hand.
- **Choose** — select an option; this is an instruction, not a state transition.
- **Banish** — permanently remove a card where the rule specifies.

Adventure reward verbs are also explicit: **Echo**, **Upgrade**, **Seal**, and **Transmute**.

## Areas and systems

- **Hand**, **Spread**, and **Deck** are zones.
- **Ability**, **Pattern**, **Relic**, **Status**, **Reading**, **Event**, **Resolve**, and **Potency** are systems/resources.
- Named Abilities (**Search**, **Peek**, **Neighbor**, **Kin**, **Between**, **Mirror**) require explicit markup. Ordinary prose is never matched to them automatically.

## Authoring rules

```text
Cards add [[chips]].
[[pattern|Patterns]] add more [[chips]] and [[mult]].
[[score]] = [[chips]] × [[mult]].
[[reveal]] 3 cards. [[take]] 1.
```

1. Use one canonical term per mechanic.
2. Use numerals in rules text.
3. Put the condition first and effect second.
4. Do not hand-author `<span>` token markup.
5. Do not automatically tokenize fiction or puzzle prose.
6. Explicit markup is safe inside escaped strings because the runtime transforms text nodes after rendering.

## Content boundaries

- Tutorials, Ability rules, Relics, statuses, Market offers, rewards, HUDs, and result screens may use automatic and explicit tokens.
- Original letters, newspaper text, photographs, Sophia’s notes, and puzzle clues use `data-game-terms="off"`.
- Player analysis may opt into explicit markup, but never automatic matching.
- Normal English words such as “between,” “mirror,” or “draw” remain unstyled unless the field is mechanical or explicitly annotated.

## Localization

Source strings store semantic IDs, not English presentation. A locale registers labels and definitions through `registerGameTermsLocale(locale, terms)`; missing entries inherit the English contract.
