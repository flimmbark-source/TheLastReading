# Archive terminology review

Archive text was reviewed item by item. Mechanical tokenization remains disabled unless a future field explicitly opts in.

| Content | Classification | Token decision | Reason |
|---|---|---|---|
| Strange Obituary | In-world newspaper source | Off | Mechanical highlighting would break the document and over-emphasize “full moon.” |
| Unsigned Letter | In-world correspondence | Off | Ordinary references to cards and readings are narrative, not rules text. |
| The Reading Room | Player-facing diegetic analysis | Off | “Between” is a spatial clue and must not become the **Between** Ability token. |
| Note on the Table | Sophia’s private source note | Off | Highlighting “shuffle” or “three” would turn a clue into UI copy. |
| Sophia’s Fall fragment | Sophia’s private source note | Off | “Pattern” is used naturally and should not reveal a mechanical interpretation. |

## Rule

Archive entries carry:

```js
contentKind: 'source' | 'analysis'
gameTerms: 'off' | 'markup' | 'auto'
```

The default is `off`. A future player-analysis entry may use `markup`, but only with explicit `[[term]]` annotations. Archive content must never use automatic matching.
