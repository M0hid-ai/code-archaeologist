/* Wing 1: the Entrance Hall. */
Museum.wings.push({
  id: "entrance",
  nav: "Entrance",
  render() {
    const o = R.overview;
    const years = (o.lastCommit - o.firstCommit) / (365 * 86400);
    const langs = o.languages.filter((l) => l.lines > 0);
    const totalLang = langs.reduce((a, l) => a + l.lines, 0) || 1;
    const shownLangs = langs.slice(0, 7);
    const otherLines = langs.slice(7).reduce((a, l) => a + l.lines, 0);
    const segs = shownLangs.map((l, i) => ({ label: l.name, lines: l.lines, color: seriesColor(i) }));
    if (otherLines) segs.push({ label: "Other", lines: otherLines, color: css("--series-other") });

    return h(
      "section.wing.hero",
      { id: "entrance" },
      h("div.kicker", o.truncated ? "An excavation of recent history" : "A museum of code history"),
      h("h1", o.name),
      h("div.span", `${date(o.firstCommit)}  to  ${date(o.lastCommit)}`),
      h("p.prologue" + (R.narrative.source !== "offline" ? ".ai" : ""), R.narrative.prologue),
      h(
        "div.tiles",
        [
          [fmt(o.commits), "commits"],
          [fmt(o.contributors), o.contributors === 1 ? "contributor" : "contributors"],
          [years >= 1 ? years.toFixed(1) : Math.max(1, Math.round(years * 365)), years >= 1 ? "years of history" : "days of history"],
          [compact(o.linesAlive), "lines alive"],
          [fmt(o.filesDead), "files buried"],
          [fmt(o.tags), o.tags === 1 ? "release tag" : "release tags"],
        ].map(([v, k]) => h("div.tile", h("div.v", v), h("div.k", k))),
      ),
      segs.length
        ? h(
            "div",
            h(
              "div.langbar",
              { role: "img", "aria-label": "Languages by surviving lines" },
              segs.map((sg) =>
                tooltip(h("span", { style: { width: (sg.lines / totalLang) * 100 + "%", background: sg.color } }), `<b>${esc(sg.label)}</b><br>${fmt(sg.lines)} lines (${pct(sg.lines / totalLang)})`),
              ),
            ),
            h("div.legend", segs.map((sg) => h("span", h("i", { style: { background: sg.color } }), `${sg.label} ${pct(sg.lines / totalLang)}`))),
          )
        : null,
      h("div.scroll-cue", "Scroll to enter the museum ↓"),
    );
  },
});
