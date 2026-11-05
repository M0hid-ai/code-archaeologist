/* Wing 4: the Hall of Survivors. The oldest living code and the layers it sits in. */
function survivorCards() {
  const fns = R.survivors.functions;
  if (!fns.length) return empty("No function definitions could be excavated (unsupported languages or too little history).");
  return h(
    "div.grid.cols-3",
    fns.slice(0, 12).map((f, i) =>
      h(
        "article.card.survivor.reveal",
        h("div.rank", "#" + (i + 1)),
        h("div.fn", f.name + "()"),
        h("div.path", `${f.path}:${f.line}`),
        h("div.big", fmt(f.commitsSurvived)),
        h("div.muted.small", `commits survived · ${plural(f.refactorsSurvived, "refactor")} · ${plural(f.authorsTouched, "author")}`),
        h("p.small", { style: { margin: "10px 0 0", color: "var(--text-secondary)" } }, `Written by ${f.bornBy} on ${date(f.born)}, ${duration(Date.now() / 1000 - f.born)} ago.`),
      ),
    ),
  );
}

/** Code strata: a core sample, one band per year, thickness = surviving lines. */
function strata() {
  const st = R.survivors.strata;
  if (!st.length) return null;
  const total = st.reduce((a, x) => a + x.lines, 0) || 1;
  // Ordinal one-hue ramp (blue), oldest layers darkest, every step >= 2:1 against the dark surface.
  const ramp = ["#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6"];
  const color = (k) => ramp[Math.round((k / Math.max(1, st.length - 1)) * (ramp.length - 1))];
  const H = Math.max(260, Math.min(520, st.length * 34));
  const sample = h(
    "div.core-sample",
    { role: "img", "aria-label": "Surviving lines by year written" },
    [...st].reverse().map((x, k) => {
      const idx = st.length - 1 - k;
      const hgt = Math.max(4, (x.lines / total) * H);
      const band = h(
        "div",
        { style: { height: hgt + "px", background: color(idx), color: idx > st.length / 2 ? "#0b0b0b" : "#f0efec" } },
        hgt >= 16 ? h("span", x.year) : null,
        hgt >= 16 ? h("span", `${fmt(x.lines)} lines · ${pct(x.lines / total)}`) : null,
      );
      return tooltip(band, `<b>${x.year}</b>${ttRow("Surviving lines", fmt(x.lines))}${ttRow("Share", pct(x.lines / total))}`);
    }),
  );
  const oldest = st[0];
  const dominant = [...st].sort((a, b) => b.lines - a.lines)[0];
  return h(
    "div.grid.cols-2",
    { style: { alignItems: "start" } },
    sample,
    h(
      "div",
      h("p.placard", R.narrative.placards.strata || ""),
      h("p", { style: { color: "var(--text-secondary)" } }, `The deepest layer dates from ${oldest.year}: ${fmt(oldest.lines)} lines written then are still running today. The thickest layer is ${dominant.year} (${pct(dominant.lines / total)} of what survives).`),
      h("p.muted.small", `Excavated ${fmt(R.survivors.sampledFiles)} files, ${fmt(R.survivors.sampledLines)} lines, with git blame.`),
      tableView("Show strata as a table", ["Year", "Surviving lines", "Share"], st.map((x) => [x.year, fmt(x.lines), pct(x.lines / total)])),
    ),
  );
}

function fossilTable(rows, mode) {
  if (!rows.length) return empty("Nothing here.");
  return h(
    "table.data",
    h("thead", h("tr", h("th", "File"), h("th", mode === "elders" ? "Born" : "Last touched"), h("th", "By"), h("th.num", "Commits"), h("th.num", "Lines"))),
    h(
      "tbody",
      rows.map((f) =>
        h(
          "tr",
          h("td.path-cell", f.path),
          h("td.nowrap", mode === "elders" ? date(f.born) : date(f.lastTouched)),
          h("td", f.bornBy),
          h("td.num", fmt(f.commits)),
          h("td.num", fmt(f.lines)),
        ),
      ),
    ),
  );
}

Museum.wings.push({
  id: "survivors",
  nav: "Survivors",
  render() {
    return h(
      "section.wing",
      { id: "survivors" },
      wingHead("Hall III", "The Hall of Survivors", "survivors"),
      survivorCards(),
      h("h3.sub", "Code strata"),
      strata(),
      h(
        "div.grid.cols-2",
        { style: { marginTop: "36px" } },
        h("div", h("h3.sub", "The Elders"), h("p.muted.small", "The oldest files still alive."), h("div.panel", fossilTable(R.survivors.elders.slice(0, 8), "elders"))),
        h("div", h("h3.sub", "Fossils"), h("p.muted.small", "Living files nobody has touched in the longest time."), h("div.panel", fossilTable(R.survivors.fossils.slice(0, 8), "fossils"))),
      ),
    );
  },
});
