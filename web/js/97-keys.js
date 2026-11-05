/* Keyboard shortcuts: space/arrows drive the timelapse, [ ] walk the wings, / searches, ? helps. */
(function keys() {
  const SHORTCUTS = [
    ["Space", "Play / pause the timelapse"],
    ["← →", "Step the timelapse one frame"],
    ["[  ]", "Previous / next wing"],
    ["/", "Search the archive"],
    ["?", "Show or hide this help"],
  ];
  const help = h(
    "div.panel",
    {
      role: "dialog",
      "aria-label": "Keyboard shortcuts",
      style: { position: "fixed", right: "20px", bottom: "20px", zIndex: 40, display: "none", minWidth: "280px", boxShadow: "0 12px 40px rgba(0,0,0,.5)" },
    },
    h("div.wing-kicker", { style: { marginBottom: "8px" } }, "Keyboard shortcuts"),
    h("table.data", h("tbody", SHORTCUTS.map(([k, d]) => h("tr", h("td.nowrap", h("code", k)), h("td", d))))),
  );
  document.body.append(help);

  const inView = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };
  const sections = () => [...document.querySelectorAll("section.wing")];
  const currentIndex = () => {
    const list = sections();
    let best = 0;
    list.forEach((sec, i) => {
      if (sec.getBoundingClientRect().top <= innerHeight * 0.35) best = i;
    });
    return best;
  };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(tag)) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    const tl = Museum.timelapse;
    if ((e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") && tl && inView(tl.element)) {
      e.preventDefault();
      if (e.key === " ") tl.toggle();
      else tl.step(e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "[" || e.key === "]") {
      const list = sections();
      const next = Math.max(0, Math.min(list.length - 1, currentIndex() + (e.key === "]" ? 1 : -1)));
      list[next].scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    } else if (e.key === "/") {
      const input = document.querySelector("#archive input[type=search]");
      if (input) {
        e.preventDefault();
        input.scrollIntoView({ block: "center" });
        input.focus();
      }
    } else if (e.key === "?") {
      help.style.display = help.style.display === "none" ? "block" : "none";
    } else if (e.key === "Escape") {
      help.style.display = "none";
    }
  });
})();
