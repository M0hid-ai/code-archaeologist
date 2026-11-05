# Contributing

Thanks for wanting to add to the museum! Bug reports, new exhibits and better epitaphs are all welcome.

## Setup

```bash
npm install
npm test
```

Tests use Node's built-in runner. Integration tests build throwaway repositories with
`test/fixture.ts`, so they need `git` on your `PATH` but no network.

To see your change in a real museum:

```bash
npm run museum -- /path/to/some/repo --open
```

## Adding a new wing

1. **Analysis.** Add a pure function in `src/analysis/` that takes the commits and the lifecycle
   (see `lifecycle.ts`) and returns plain data. Add its type to `src/analysis/report.ts` and call it
   from `analyze()` in `src/analysis/index.ts`.
2. **Tests.** Cover it with a unit test, and extend `test/fixture.ts` if you need a new kind of history.
3. **Placard.** Add a sentence for it in `src/narrate/offline.ts` (and its key to `PLACARD_KEYS` in
   `src/narrate/ai.ts` so models can write one too).
4. **Front end.** Add `web/js/NN-yourwing.js`. Files are concatenated in name order; push a wing with
   `Museum.wings.push({ id, nav, render() { ... }, after() { ... } })`. Use the helpers in
   `web/js/00-core.js` (`h`, `s`, `tooltip`, `barList`, `tableView`, `seriesColor`...).

## Design rules for exhibits

- Colour follows the entity, never its rank, and is never the only encoding: add a legend,
  direct labels or a table view.
- Use `seriesColor(i)` slots in order; fold anything past the eighth into "Other".
- Text uses the ink colours (`--text-*`), not series colours.
- Never put email addresses in the report or the page.

## Commit style

Small, focused commits with an imperative subject line ("Add X", "Fix Y").
