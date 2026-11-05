/* Wing 6: the Graveyard. Every deleted file gets a tombstone. */
function tombstone(t) {
  const name = t.path.split("/").pop();
  const dir = t.path.slice(0, t.path.length - name.length);
  const stone = h(
    "div.stone",
    t.zombie ? h("span.zombie", { title: "Rose again later" }, "🧟") : null,
    h("div.rip", "R · I · P"),
    h("div.name", name),
    dir ? h("div.dir", dir) : null,
    h("div.dates", `${date(t.born)} – ${date(t.died)}`),
    h("div.epitaph", "“" + t.epitaph + "”"),
    h("div.cause", t.cause),
  );
  return tooltip(
    stone,
    () =>
      `<b class="mono">${esc(t.path)}</b>${ttRow("Lived", duration(t.died - t.born))}${ttRow("Born to", t.bornBy)}${ttRow("Laid to rest by", t.killedBy)}${ttRow("Lines at death", fmt(t.lines))}${ttRow("Peak size", fmt(t.peakLines) + " lines")}${ttRow("Commits", fmt(t.commits))}${
        t.formerNames.length ? ttRow("Also known as", t.formerNames.join(", ")) : ""
      }<div style="margin-top:6px;color:var(--text-muted)">Last words: “${esc(t.lastWords)}”</div>`,
  );
}

function graveyardYard() {
  const g = R.graveyard;
  if (!g.total) return empty("The graveyard is empty. Nothing has ever been deleted.");
  const PAGE = 24;
  let shown = PAGE;
  let filtered = g.tombstones;
  const yard = h("div.yard");
  const more = h("button.btn", { style: { margin: "20px auto 0", display: "block" } }, "Walk further into the graveyard");
  const count = h("span.muted.small");
  const paint = () => {
    yard.replaceChildren(...filtered.slice(0, shown).map(tombstone));
    more.style.display = shown < filtered.length ? "block" : "none";
    count.textContent = `${fmt(Math.min(shown, filtered.length))} of ${fmt(filtered.length)} tombstones${g.total > g.tombstones.length ? ` (the ${fmt(g.tombstones.length)} most notable of ${fmt(g.total)})` : ""}`;
  };
  const search = h("input", { type: "search", placeholder: "Search the dead…", "aria-label": "Search tombstones" });
  const causes = h("select", { "aria-label": "Cause of death" }, h("option", { value: "" }, "Any cause of death"), g.causes.map((c) => h("option", { value: c.cause }, `${c.cause} (${c.count})`)));
  const sort = h(
    "select",
    { "aria-label": "Sort" },
    [["notable", "Most notable"], ["recent", "Most recently buried"], ["oldest", "Longest lived"], ["brief", "Shortest lived"], ["big", "Largest at death"]].map(([v, l]) => h("option", { value: v }, l)),
  );
  const apply = () => {
    const q = search.value.trim().toLowerCase();
    filtered = g.tombstones.filter(
      (t) => (!q || t.path.toLowerCase().includes(q) || t.killedBy.toLowerCase().includes(q) || t.epitaph.toLowerCase().includes(q)) && (!causes.value || t.cause === causes.value),
    );
    const by = {
      notable: null,
      recent: (a, b) => b.died - a.died,
      oldest: (a, b) => b.died - b.born - (a.died - a.born),
      brief: (a, b) => a.died - a.born - (b.died - b.born),
      big: (a, b) => b.lines - a.lines,
    }[sort.value];
    if (by) filtered = [...filtered].sort(by);
    shown = PAGE;
    paint();
  };
  search.addEventListener("input", apply);
  causes.addEventListener("change", apply);
  sort.addEventListener("change", apply);
  more.addEventListener("click", () => {
    shown += PAGE;
    paint();
  });
  paint();
  return h("div", h("div.toolbar", search, causes, sort, count), yard, more);
}

function graveyardStats() {
  const g = R.graveyard;
  if (!g.total) return null;
  const blocks = [
    h("div", h("h3.sub", "Causes of death"), barList(g.causes.slice(0, 8).map((c) => ({ label: c.cause, value: c.count })), seriesColor(6))),
    g.reapers.length ? h("div", h("h3.sub", "The Reapers"), barList(g.reapers.slice(0, 8).map((r) => ({ label: r.name, value: r.kills, tip: `<b>${esc(r.name)}</b><br>deleted ${plural(r.kills, "file")}` })), seriesColor(7))) : null,
  ];
  const extra = [];
  if (g.massacres.length)
    extra.push(
      h(
        "div",
        h("h3.sub", "Massacres"),
        h("p.muted.small", "Days when many files died at once."),
        h(
          "div.panel",
          h("table.data", h("thead", h("tr", h("th", "Day"), h("th.num", "Deaths"), h("th", "By"), h("th", "Commit"))), h("tbody", g.massacres.map((m) => h("tr", h("td.nowrap", m.day), h("td.num", fmt(m.deaths)), h("td", m.by), h("td.muted", m.subject))))),
        ),
      ),
    );
  if (g.zombies.length)
    extra.push(
      h(
        "div",
        h("h3.sub", "The Undead"),
        h("p.muted.small", "Deleted, then brought back."),
        h(
          "div.panel",
          h(
            "table.data",
            h("thead", h("tr", h("th", "File"), h("th", "Buried"), h("th", "Rose"), h("th", "By"))),
            h("tbody", g.zombies.slice(0, 12).map((z) => h("tr", h("td.path-cell", "🧟 " + z.path), h("td.nowrap", date(z.diedAt)), h("td.nowrap", date(z.returnedAt)), h("td", z.returnedBy)))),
          ),
        ),
      ),
    );
  return h("div", h("div.grid.cols-2", blocks), extra.length ? h("div.grid.cols-2", extra) : null);
}

Museum.wings.push({
  id: "graveyard",
  nav: "Graveyard",
  render() {
    return h("section.wing", { id: "graveyard" }, wingHead("Hall V", "The Graveyard", "graveyard"), graveyardYard(), graveyardStats());
  },
});
