/* Wing 5: the Battlefield. Hotspots, rivalries, reverts and earthquakes. */
function hotspotTable() {
  const hs = R.battlefield.hotspots;
  if (!hs.length) return empty("No contested files. A peaceful codebase.");
  const max = Math.max(...hs.map((x) => x.score)) || 1;
  return h(
    "div.panel",
    h(
      "table.data",
      h("thead", h("tr", h("th", "File"), h("th", "Heat"), h("th.num", "Commits"), h("th.num", "Authors"), h("th.num", "Fixes"), h("th.num", "Lines"), h("th", "Last touched"))),
      h(
        "tbody",
        hs.slice(0, 20).map((x) =>
          h(
            "tr",
            h("td.path-cell", x.path),
            h("td", h("div.meter", { title: `score ${x.score}` }, h("span", { style: { width: (x.score / max) * 100 + "%" } }))),
            h("td.num", fmt(x.commits)),
            h("td.num", fmt(x.authors)),
            h("td.num", fmt(x.fixes)),
            h("td.num", fmt(x.lines)),
            h("td.nowrap", date(x.lastTouched)),
          ),
        ),
      ),
    ),
    h("p.muted.small", "Heat combines commits, number of authors, size, share of bug fixes and recency."),
  );
}

function rivalryCards() {
  const rs = R.battlefield.rivalries;
  if (!rs.length) return empty("No tug-of-war detected: nobody keeps undoing anybody else.");
  return h(
    "div.grid.cols-3",
    rs.slice(0, 9).map((r) =>
      h(
        "div.card.reveal",
        h("div.rival", h("div.who", r.a), h("div.vs", "⚔"), h("div.who", r.b)),
        h("div.rival-path", r.path),
        h("div.small.muted", { style: { textAlign: "center", marginTop: "6px" } }, `${fmt(r.skirmishes)} skirmish${r.skirmishes === 1 ? "" : "es"}: edit, counter-edit, edit again within a month`),
      ),
    ),
  );
}

function revertList() {
  const rv = R.battlefield.reverts;
  if (!rv.length) return empty("Not a single revert. Either very careful, or very stubborn.");
  return h(
    "div.panel",
    h(
      "table.data",
      h("thead", h("tr", h("th", "When"), h("th", "Who"), h("th", "Revert"), h("th", "Regret time"))),
      h(
        "tbody",
        rv.slice(0, 15).map((r) =>
          h(
            "tr",
            h("td.nowrap", date(r.t)),
            h("td", r.by),
            h("td", r.subject),
            h("td", r.original ? duration(r.t - r.original.t) + (r.original.by !== r.by ? ` (undoing ${r.original.by})` : "") : h("span.muted", "unknown")),
          ),
        ),
      ),
    ),
  );
}

function earthquakeList() {
  const eq = R.battlefield.earthquakes.filter((e) => e.churn > 0);
  if (!eq.length) return null;
  return barList(
    eq.map((e) => ({
      label: `${e.subject.slice(0, 60)}${e.subject.length > 60 ? "…" : ""}`,
      value: e.churn,
      tip: `<b>${esc(e.subject)}</b>${ttRow("By", e.by)}${ttRow("When", date(e.t))}${ttRow("Files", fmt(e.files))}${ttRow("Lines changed", fmt(e.churn))}${ttRow("Commit", e.hash.slice(0, 10))}`,
    })),
    seriesColor(1),
  );
}

Museum.wings.push({
  id: "battlefield",
  nav: "Battlefield",
  render() {
    return h(
      "section.wing",
      { id: "battlefield" },
      wingHead("Hall IV", "The Battlefield", "battlefield"),
      h("h3.sub", "Hotspots"),
      hotspotTable(),
      h("h3.sub", "Rivalries"),
      rivalryCards(),
      h("h3.sub", "Earthquakes"),
      h("p.muted.small", "The single commits that moved the most lines."),
      earthquakeList(),
      h("h3.sub", "Regrets"),
      revertList(),
    );
  },
});
