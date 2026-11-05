/* Wing 10: the Archive. A searchable record of recent commits. */
Museum.wings.push({
  id: "archive",
  nav: "Archive",
  render() {
    const all = R.archive;
    const list = h("div.archive-list");
    const PAGE = 60;
    let shown = PAGE;
    let rows = all;
    const more = h("button.btn", { style: { margin: "16px auto 0", display: "block" } }, "Older commits");
    const count = h("span.muted.small");
    const search = h("input", { type: "search", placeholder: "Search messages, authors, hashes…", "aria-label": "Search commits" });
    const mood = h(
      "select",
      { "aria-label": "Kind of work" },
      h("option", { value: "" }, "All kinds of work"),
      MOOD_GROUPS.map((g, i) => h("option", { value: String(i) }, g.label)),
    );
    const row = (c) =>
      h(
        "div.row",
        h("span.h", c.h.slice(0, 8)),
        h("span.s", h("span.mood-dot", { style: { background: moodColor(c.m) }, title: c.m }), c.s),
        h("span.a", c.a),
        h("span.d", date(c.t)),
      );
    const paint = () => {
      list.replaceChildren(...rows.slice(0, shown).map(row));
      more.style.display = shown < rows.length ? "block" : "none";
      count.textContent = `${fmt(Math.min(shown, rows.length))} of ${fmt(rows.length)} commits`;
    };
    let timer = 0;
    const apply = () => {
      const q = search.value.trim().toLowerCase();
      const gi = mood.value === "" ? -1 : Number(mood.value);
      rows = all.filter((c) => (!q || c.s.toLowerCase().includes(q) || c.a.toLowerCase().includes(q) || c.h.startsWith(q)) && (gi === -1 || moodGroupOf(c.m) === gi));
      shown = PAGE;
      paint();
    };
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    });
    mood.addEventListener("change", apply);
    more.addEventListener("click", () => {
      shown += PAGE;
      paint();
    });
    paint();
    return h(
      "section.wing",
      { id: "archive" },
      wingHead("Hall IX", "The Archive", "archive"),
      h("div.toolbar", search, mood, count),
      h("div.panel", { style: { padding: "4px" } }, list),
      more,
    );
  },
});
