/* Wing 2: the Timeline Hall. Monthly activity, eras, and milestone plaques. */
function timelineChart() {
  const months = R.months;
  if (!months.length) return empty("No commits to chart.");
  const W = 1100;
  const H = 300;
  const m = { t: 34, r: 8, b: 30, l: 40 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const n = months.length;
  const bw = iw / n;
  const gap = bw >= 6 ? 2 : bw >= 3 ? 1 : 0;
  const stacks = months.map((p) => MOOD_GROUPS.map((g) => g.moods.reduce((a, k) => a + (p.moods[k] || 0), 0)));
  const other = months.map((p, i) => p.commits - stacks[i].reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...months.map((p) => p.commits));
  const y = (v) => m.t + ih - (v / max) * ih;
  const x = (i) => m.l + i * bw;
  const tOf = (t) => {
    const first = months[0].t;
    const last = months[n - 1].t + 31 * 86400;
    return m.l + ((t - first) / (last - first)) * iw;
  };

  const g = [];
  // Era bands (alternating neutral shading) with serif labels.
  R.eras.forEach((e, k) => {
    const x0 = Math.max(m.l, tOf(e.start));
    const x1 = Math.min(m.l + iw, tOf(e.end));
    if (k % 2 === 0) g.push(s("rect", { x: x0, y: m.t - 26, width: Math.max(0, x1 - x0), height: ih + 26, fill: css("--surface-2"), opacity: 0.55 }));
    const label = (R.narrative.eras.find((x2) => x2.id === e.id) || e).title || e.name;
    const numeral = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][k] || String(k + 1);
    const text = x1 - x0 > 60 ? (label.length * 6.5 > x1 - x0 ? label.slice(0, Math.floor((x1 - x0) / 7)) + "…" : label) : x1 - x0 > 14 ? numeral : null;
    if (text) {
      const t = s("text", { x: x0 + 6, y: m.t - 10, class: "era-label" }, text);
      tooltip(t, `<b>${numeral}. ${esc(label)}</b><br>${monthLabel(e.start)} – ${monthLabel(e.end)}`);
      g.push(t);
    }
  });
  // Grid + axis.
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  for (const t of ticks) {
    g.push(s("line", { x1: m.l, x2: m.l + iw, y1: y(t), y2: y(t), stroke: css("--rule"), "stroke-dasharray": t ? "2 4" : null }));
    g.push(s("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end" }, compact(t)));
  }
  let lastYear = null;
  months.forEach((p, i) => {
    const yr = year(p.t);
    if (yr !== lastYear && (i === 0 || new Date(p.t * 1000).getUTCMonth() === 0)) {
      if (n < 400 || yr % 2 === 0) g.push(s("text", { x: x(i) + 1, y: H - 10 }, yr));
      lastYear = yr;
    }
  });
  // Stacked bars, one segment per mood group (fixed slot order), surface gaps between segments.
  months.forEach((p, i) => {
    let acc = 0;
    const parts = [...stacks[i], other[i]];
    parts.forEach((v, k) => {
      if (!v) return;
      const y1 = y(acc);
      const y0 = y(acc + v);
      const hgt = Math.max(0.5, y1 - y0 - (gap && acc ? 1 : 0));
      g.push(s("rect", { x: x(i) + gap / 2, y: y0, width: Math.max(0.6, bw - gap), height: hgt, fill: k < MOOD_GROUPS.length ? seriesColor(k) : css("--series-other"), rx: bw > 8 ? 2 : 0 }));
      acc += v;
    });
  });
  // Release ticks.
  const tags = R.milestones.filter((ms) => ms.kind === "release");
  for (const t of tags) {
    const tx = tOf(t.t);
    const tick = s("path", { d: `M${tx},${m.t + ih + 2} l4,7 h-8 z`, fill: css("--gold") });
    g.push(tick);
  }
  // Hover columns (hit targets wider than marks).
  const hits = months.map((p, i) => {
    const r = s("rect", { x: x(i), y: m.t - 26, width: Math.max(bw, 2), height: ih + 26, fill: "transparent" });
    tooltip(r, () => {
      const rows = MOOD_GROUPS.map((mg, k) => (stacks[i][k] ? ttRow(mg.label, fmt(stacks[i][k])) : "")).join("");
      return `<b>${monthLabel(p.t)}</b>${ttRow("Commits", fmt(p.commits))}${ttRow("Contributors", fmt(p.authors))}${ttRow("Lines +/-", `+${compact(p.added)} / -${compact(p.deleted)}`)}<hr style="border:0;border-top:1px solid var(--rule);margin:6px 0">${rows}`;
    });
    return r;
  });
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Commits per month, stacked by kind of work, with eras shaded" }, g, hits);

  const legend = h(
    "div.legend",
    MOOD_GROUPS.map((mg, k) => h("span", h("i", { style: { background: seriesColor(k) } }), mg.label)),
    h("span", h("i", { style: { background: css("--series-other") } }), "Other"),
    tags.length ? h("span", h("i", { style: { background: css("--gold"), borderRadius: "0", clipPath: "polygon(50% 0,100% 100%,0 100%)" } }), "Release") : null,
  );
  const table = tableView(
    "Show monthly data as a table",
    ["Month", "Commits", "Contributors", "Added", "Deleted"],
    months.filter((p) => p.commits).map((p) => [monthLabel(p.t), fmt(p.commits), fmt(p.authors), fmt(p.added), fmt(p.deleted)]),
  );
  return h("div.panel", svg, legend, table);
}

function eraCards() {
  return h(
    "div.eras",
    R.eras.map((e) => {
      const nar = R.narrative.eras.find((x) => x.id === e.id);
      const facts = [
        h("span.chip", plural(e.commits, "commit")),
        h("span.chip", plural(e.authors, "contributor")),
        e.added || e.deleted ? h("span.chip", h("span.add", "+" + compact(e.added)), " ", h("span.del", "−" + compact(e.deleted))) : null,
        e.filesBorn ? h("span.chip", `${fmt(e.filesBorn)} born`) : null,
        e.filesDied ? h("span.chip", `${fmt(e.filesDied)} buried`) : null,
        ...e.tags.slice(0, 4).map((t) => h("span.chip.gold", t)),
      ];
      return h(
        "article.card.era.reveal",
        h("div", h("div.when", monthLabel(e.start)), h("div.when", "to " + monthLabel(e.end)), h("div.when", duration(e.end - e.start))),
        h("div", h("h3", (nar && nar.title) || e.name), h("p.story", (nar && nar.story) || ""), h("div.facts", facts)),
      );
    }),
  );
}

function plaques() {
  if (!R.milestones.length) return null;
  return h(
    "div",
    h("h3.sub", "Plaques"),
    h(
      "div.plaques",
      R.milestones.map((ms) => h("div.plaque", h("div.date", date(ms.t)), h("h4", ms.title), h("p", ms.detail))),
    ),
  );
}

Museum.wings.push({
  id: "timeline",
  nav: "Timeline",
  render() {
    return h("section.wing", { id: "timeline" }, wingHead("Hall I", "The Timeline", "timeline"), timelineChart(), plaques(), h("h3.sub", "The Eras"), eraCards());
  },
});
