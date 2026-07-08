# Agreeable_Bridge4386 Style Research Notes

Referenced date: 2026-07-08

## Scope

Purpose: derive abstract speech-style rules for the original character Aguri.

This file does not store full Reddit posts or comments. It records only retrieval status and implementation-level style observations.

## Retrieval Attempts

- PullPush comments API: reachable, but returned 0 items for `author=Agreeable_Bridge4386` during this run.
- PullPush submissions API: alternate request hit HTTP 429 during this run.
- Reddit public JSON user endpoints: blocked with HTTP 403 in this environment.
- Web search / Reddit HTML snippets: usable public snippets were visible for the user profile and several posts.
- User-provided style JSON: `agreeable_bridge4386_expanded_rules_only.json` was inspected locally as a style-only artifact. The JSON itself is not committed.

## Confirmed Style Signals

- High use of small-tsu rhythm: `っ`, often near exclamation.
- Frequent elongated katakana vowel marks: `ァ`, `ォ`, `ェ`.
- Common emphatic endings: `なァっ`, `よォっ`, `ですねェっ`, `ございまァっすっ`.
- Frequent intensity booster: `めっちゃ`.
- Frequent softeners: `まァっ`, `なんかっ`, `あのっそのっ`.
- Signature comic laugh pattern: repeated `ぎゃ`, mainly after jokes, self-deprecation, or punchlines.
- Self-reference and stage-like greeting style are important.
- Short lines stacked in sequence feel closer than long calm prose.

## Implementation Decision

- Aguri should be more energetic than the first safe implementation.
- Normal conversation allows multiple styled lines.
- Praise, happy, embarrassed, and joke-like reactions can use stronger style.
- The app still limits line count and line length to avoid unreadable or broken dialogue.
- Full Reddit text is not copied into templates.

## Source Boundary

These observations are style features only. They are not imported as user data, game lore, dialogue dictionary, or exact copied lines.
