# Changelog

## 0.1.0 (2026-11-06)

First excavation.

- Streaming git history ingestion with rename tracking and mailmap-aware identity merging
- File lifecycle replay from birth to death through renames and copies
- Wings: Entrance, Timeline (eras and plaques), Timelapse Theater, Hall of Survivors (function
  longevity and code strata), Battlefield, Graveyard, Portrait Gallery, Constellations,
  Rhythm & Mood, Archive
- Offline narration plus optional Claude and Gemini curators
- Single self-contained HTML output, `?wings=` filter
- `codearch` CLI accepting local paths or git URLs
- `--exclude` globs and `.codearchignore`
- `card.svg` summary card written next to every museum
- Keyboard shortcuts (space, arrows, `[` `]`, `/`, `?`)
- Truncated excavations (`--max-commits`, `--since`) recover true file sizes from HEAD
- Activity series adapts to the length of the history (hours, days or months)
- Era highlights: biggest commit, busiest day, opening commit
- Installable straight from GitHub (`npm install -g github:M0hid-ai/code-archaeologist`)
