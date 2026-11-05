/* Open the doors: render every wing, build the nav, wire up scroll effects. */
(function boot() {
  const main = document.getElementById("museum");
  const nav = document.getElementById("nav");
  nav.append(h("span.brand", "🏺 " + R.overview.name));
  // ?wings=graveyard,gallery renders a subset (embedding, screenshots, slow devices).
  const only = new URLSearchParams(location.search).get("wings");
  const wanted = only ? new Set(only.split(",").map((x) => x.trim())) : null;
  for (const wing of Museum.wings) {
    if (wanted && !wanted.has(wing.id)) continue;
    let section;
    try {
      section = wing.render();
    } catch (err) {
      console.error(`wing ${wing.id} failed`, err);
      section = h("section.wing", { id: wing.id }, h("h2", wing.nav), empty("This wing could not be opened: " + err.message));
    }
    if (!section) continue;
    main.append(section);
    if (wing.nav) nav.append(h("a", { href: "#" + wing.id, "data-wing": wing.id }, wing.nav));
    if (wing.after) requestAnimationFrame(() => wing.after(section));
  }

  const footer = h(
    "footer.epilogue",
    h("div.wing-kicker", "Epilogue"),
    h("p", R.narrative.epilogue),
    h(
      "div.colophon",
      `Excavated by code-archaeologist v${R.version} on ${date(Date.parse(R.generatedAt) / 1000)} · ${R.overview.branch} @ ${R.overview.head.slice(0, 10)} · narration: ${
        R.narrative.source === "offline" ? "offline curator" : `${R.narrative.source} (${R.narrative.model})`
      }`,
    ),
  );
  main.append(footer);

  const links = [...nav.querySelectorAll("a[data-wing]")];
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle("active", a.dataset.wing === e.target.id));
        const active = links.find((a) => a.dataset.wing === e.target.id);
        if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  main.querySelectorAll("section.wing").forEach((sec) => spy.observe(sec));

  const reveal = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add("in");
          reveal.unobserve(e.target);
        }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  main.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));
})();
