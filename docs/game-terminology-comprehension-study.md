# Terminology Comprehension Study

This plan compares the tokenized tutorial and mechanical language against the previous copy without sending any player data to a server.

## Enable instrumentation

Open the game with:

```text
?termstudy=1
```

The game records study events locally in the browser. It does not make network requests.

Export the current session from DevTools:

```js
copy(tlrExportComprehensionStudy())
```

Clear stored sessions:

```js
tlrClearComprehensionStudy()
```

## Participant task

Ask a new player to:

1. Start a new Reading.
2. Complete the opening tutorial.
3. Play enough cards to see a Pattern.
4. Use one Discard Ability.
5. Open Scoring and Abilities.
6. Reach or miss the first Threshold.
7. Enter the Market if they clear it.
8. Explain the system in their own words.

Do not explain Chips, Mult, Reveal, Take, or Threshold before the session.

## Questions

Ask immediately after play:

1. What are **Chips**?
2. What does **Mult** do?
3. What is the **Threshold**?
4. What is the difference between **Reveal** and **Take**?
5. What happens when you **Discard** a card?
6. Where is the **Spread**?
7. What is **Reserve** used for?
8. What part of the rules did you need to reread?

## Measures

Record:

- time from tutorial start to first Play;
- time to first successful Pattern;
- glossary opens;
- term-definition opens;
- Scoring and Ability reference opens;
- incorrect taps or verbal misunderstandings;
- whether each question is answered correctly without prompting.

## Success criteria

The terminology pass is successful when new players show at least one of these improvements without regression elsewhere:

- faster first Play;
- fewer repeated reference opens;
- correct explanation of Chips × Mult;
- correct distinction between Reveal and Take;
- correct understanding of Threshold and Reserve;
- shorter tutorial completion time with equal or better recall.

## Comparison design

Use alternating participants:

- Group A: the current tokenized build.
- Group B: a saved pre-tokenization preview.

Use the same task and questions. Avoid coaching either group. Five participants per group is enough to reveal major comprehension failures; more are needed for statistical claims.

## Interpretation

A frequently opened term is not automatically a failure. It may be doing useful work. Treat repeated opens of the same term, long hesitation, or incorrect explanations as stronger evidence that the copy or definition needs revision.
