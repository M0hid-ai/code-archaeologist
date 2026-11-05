/* Wing 7: the Portrait Gallery. One portrait per contributor. */
function portrait(c, maxCommits) {
  const first = year(c.first);
  const last = year(c.last);
  return h(
    "article.card.portrait.reveal",
    h(
      "div.top",
      identicon(c.name),
      h("div", h("div.name", c.name), h("div.years", first === last ? String(first) : `${first} – ${last}`, " · ", plural(c.activeDays, "active day"))),
    ),
    h(
      "div.badges",
      c.archetypes.map((a) => tooltip(h("span.badge", a.title), `<b>${esc(a.title)}</b><br>${esc(a.reason)}`)),
    ),
    h(
      "div.nums",
      h("span", h("b", fmt(c.commits)), " commits"),
      h("span.add", "+" + compact(c.added)),
      h("span.del", "−" + compact(c.deleted)),
    ),
    tooltip(sparkline(c.sparkline, seriesColor(0)), `<b>${esc(c.name)}</b><br>Commits over the project's lifetime`),
    c.topDirs.length ? h("div.small.muted", "Mostly in " + c.topDirs.map((d) => (d === "(root)" ? "/" : d + "/")).join(", ")) : null,
  );
}

Museum.wings.push({
  id: "gallery",
  nav: "Gallery",
  render() {
    const people = R.contributors;
    const max = Math.max(1, ...people.map((p) => p.commits));
    const grid = h("div.grid.cols-3");
    const PAGE = 18;
    let shown = PAGE;
    const more = h("button.btn", { style: { margin: "20px auto 0", display: "block" } }, "Show more portraits");
    const filter = h("select", { "aria-label": "Filter by archetype" }, h("option", { value: "" }, "Everyone"));
    const types = new Map();
    people.forEach((p) => p.archetypes.forEach((a) => types.set(a.id, a.title)));
    types.forEach((title, id) => filter.append(h("option", { value: id }, title)));
    const paint = () => {
      const list = filter.value ? people.filter((p) => p.archetypes.some((a) => a.id === filter.value)) : people;
      grid.replaceChildren(...list.slice(0, shown).map((p) => portrait(p, max)));
      grid.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      more.style.display = shown < list.length ? "block" : "none";
    };
    filter.addEventListener("change", () => {
      shown = PAGE;
      paint();
    });
    more.addEventListener("click", () => {
      shown += PAGE;
      paint();
    });
    paint();
    return h(
      "section.wing",
      { id: "gallery" },
      wingHead("Hall VI", "The Portrait Gallery", "gallery"),
      h("div.toolbar", filter, R.otherContributors ? h("span.muted.small", `plus ${plural(R.otherContributors, "more contributor")} with fewer commits`) : null),
      grid,
      more,
    );
  },
});
