/* Wing 9: Rhythm. When the work happened and how people wrote about it. */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function heatmap() {
  const hm = R.rhythm.heatmap;
  const max = Math.max(1, ...hm.flat());
  const cell = 34, gap = 3, left = 40, top = 22;
  const W = left + 24 * (cell + gap);
  const H = top + 7 * (cell + gap);
  // Sequential single hue (blue): near-surface for zero, brightest for the busiest hour.
  const ramp = ["#1f2a38", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6"];
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  const g = [];
  for (let hr = 0; hr < 24; hr += 3) g.push(s("text", { x: left + hr * (cell + gap) + cell / 2, y: 14, "text-anchor": "middle" }, String(hr).padStart(2, "0") + ":00"));
  order.forEach((d, row) => {
    g.push(s("text", { x: left - 8, y: top + row * (cell + gap) + cell / 2 + 4, "text-anchor": "end" }, DAYS[d]));
    for (let hr = 0; hr < 24; hr++) {
      const v = hm[d][hr];
      const k = v ? 1 + Math.round(Math.sqrt(v / max) * (ramp.length - 2)) : 0;
      const r = s("rect", { x: left + hr * (cell + gap), y: top + row * (cell + gap), width: cell, height: cell, rx: 4, fill: ramp[k] });
      tooltip(r, `<b>${DAYS[d]} ${String(hr).padStart(2, "0")}:00–${String(hr).padStart(2, "0")}:59</b>${ttRow("Commits", fmt(v))}`);
      g.push(r);
    }
  });
  const scale = h(
    "div.legend",
    h("span", "fewer"),
    ramp.slice(1).map((c) => h("i", { style: { background: c, marginRight: "2px" } })),
    h("span", "more commits (author's local time)"),
  );
  return h("div.panel", s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Commits by weekday and hour" }, g), scale);
}

function moodBar() {
  const moods = R.rhythm.moods;
  const groups = MOOD_GROUPS.map((g, i) => ({ label: g.label, color: seriesColor(i), value: moods.filter((m) => g.moods.includes(m.mood)).reduce((a, m) => a + m.count, 0) }));
  const other = moods.filter((m) => moodGroupOf(m.mood) === -1).reduce((a, m) => a + m.count, 0);
  if (other) groups.push({ label: "Other", color: css("--series-other"), value: other });
  const total = groups.reduce((a, g) => a + g.value, 0) || 1;
  return h(
    "div",
    h(
      "div.langbar",
      { style: { height: "22px", borderRadius: "6px" }, role: "img", "aria-label": "Commit messages by kind of work" },
      groups.filter((g) => g.value).map((g) => tooltip(h("span", { style: { width: (g.value / total) * 100 + "%", background: g.color } }), `<b>${g.label}</b><br>${fmt(g.value)} commits (${pct(g.value / total)})`)),
    ),
    h("div.legend", groups.filter((g) => g.value).map((g) => h("span", h("i", { style: { background: g.color } }), `${g.label} ${pct(g.value / total)}`))),
  );
}

Museum.wings.push({
  id: "rhythm",
  nav: "Rhythm",
  render() {
    const r = R.rhythm;
    const facts = [
      ["Night commits", pct(r.nightShare), "midnight to 5am"],
      ["Weekend commits", pct(r.weekendShare), "Saturday and Sunday"],
      ["Avg. message", r.averageSubjectLength + " chars", "subject line length"],
      r.busiestDay ? ["Busiest day", fmt(r.busiestDay.commits), r.busiestDay.day] : null,
      r.longestSilence ? ["Longest silence", plural(r.longestSilence.days, "day"), `ended ${date(r.longestSilence.to)}`] : null,
    ].filter(Boolean);
    return h(
      "section.wing",
      { id: "rhythm" },
      wingHead("Hall VIII", "Rhythm & Mood", "rhythm"),
      h("div.tiles", facts.map(([k, v, sub]) => h("div.tile", h("div.k", k), h("div.v", v), h("div.small.muted", sub)))),
      h("h3.sub", "The working week"),
      heatmap(),
      h("h3.sub", "What the commits were about"),
      moodBar(),
      h(
        "div.grid.cols-2",
        { style: { marginTop: "26px" } },
        h(
          "div",
          h("h3.sub", "Favourite first words"),
          h("div.words", r.firstWords.map((w) => h("span.chip", w.word, h("b", { style: { color: "var(--text-primary)" } }, fmt(w.count))))),
          r.longestMessage ? h("div", h("h3.sub", "The longest subject line"), h("p.placard", "“" + r.longestMessage.subject + "”"), h("p.muted.small", `${r.longestMessage.by}, ${date(r.longestMessage.t)}`)) : null,
        ),
        h(
          "div",
          h("h3.sub", "Hall of Shame"),
          h("p.muted.small", "Commit messages that explain nothing."),
          r.lazyMessages.length
            ? h("div.panel", h("table.data", h("tbody", r.lazyMessages.map((m) => h("tr", h("td.shame", "“" + m.subject + "”"), h("td.num", plural(m.count, "time")))))))
            : empty("Spotless. Every message says something."),
        ),
      ),
    );
  },
});
