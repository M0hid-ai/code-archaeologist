/* Wing 8: Constellations. Files that secretly change together, drawn as a star map. */
function constellationSky() {
  const cs = R.couplings;
  if (!cs.length) return { el: empty("No strong change coupling found: files change independently."), mount() {} };
  const ids = new Map();
  const nodes = [];
  const node = (path) => {
    if (!ids.has(path)) {
      ids.set(path, nodes.length);
      const dir = path.includes("/") ? path.slice(0, path.indexOf("/")) : "(root)";
      nodes.push({ path, dir, x: 0, y: 0, vx: 0, vy: 0, deg: 0 });
    }
    return ids.get(path);
  };
  const edges = cs.map((c) => ({ a: node(c.a), b: node(c.b), w: c.together, conf: c.confidence, cross: c.crossDir }));
  edges.forEach((e) => {
    nodes[e.a].deg += e.w;
    nodes[e.b].deg += e.w;
  });
  const dirRank = new Map();
  [...new Set(nodes.map((n) => n.dir))]
    .map((d) => [d, nodes.filter((n) => n.dir === d).reduce((a, n) => a + n.deg, 0)])
    .sort((a, b) => b[1] - a[1])
    .forEach(([d], i) => dirRank.set(d, i));
  const colorOf = (n) => seriesColor(Math.min(dirRank.get(n.dir), 8));
  const maxW = Math.max(...edges.map((e) => e.w));
  const maxDeg = Math.max(...nodes.map((n) => n.deg));

  // Deterministic seeding on a circle, then a short force simulation.
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 + (hash(n.path) % 100) / 300;
    n.x = Math.cos(a) * 200;
    n.y = Math.sin(a) * 200;
  });
  for (let it = 0; it < 400; it++) {
    const alpha = 1 - it / 400;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const p = nodes[i], q = nodes[j];
        let dx = p.x - q.x, dy = p.y - q.y;
        const d2 = Math.max(25, dx * dx + dy * dy);
        const f = (1600 / d2) * alpha;
        dx *= f; dy *= f;
        p.vx += dx; p.vy += dy; q.vx -= dx; q.vy -= dy;
      }
    for (const e of edges) {
      const p = nodes[e.a], q = nodes[e.b];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 60 + 80 * (1 - e.conf);
      const f = ((d - target) / d) * 0.05 * alpha * (0.5 + e.w / maxW);
      p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f;
    }
    for (const n of nodes) {
      n.vx -= n.x * 0.004 * alpha;
      n.vy -= n.y * 0.004 * alpha;
      n.x += n.vx; n.y += n.vy;
      n.vx *= 0.6; n.vy *= 0.6;
    }
  }

  const canvas = h("canvas", { role: "img", "aria-label": "Change-coupling star map" });
  let view = { k: 1, cx: 0, cy: 0, W: 0, H: 0 }, ctx = null, hover = -1;
  const bounds = () => {
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const toScreen = (n) => [view.W / 2 + (n.x - view.cx) * view.k, view.H / 2 + (n.y - view.cy) * view.k];
  const radius = (n) => 3 + 7 * Math.sqrt(n.deg / maxDeg);

  // Label only the brightest stars, skipping any too close to one already labelled.
  const labelled = new Set();
  function chooseLabels() {
    labelled.clear();
    const placed = [];
    [...nodes.keys()].sort((a, b) => nodes[b].deg - nodes[a].deg).slice(0, 12).forEach((i) => {
      const [x, y] = toScreen(nodes[i]);
      if (placed.every(([px, py]) => Math.abs(px - x) > 90 || Math.abs(py - y) > 16)) {
        placed.push([x, y]);
        labelled.add(i);
      }
    });
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, view.W, view.H);
    // faint background stars
    for (let i = 0; i < 120; i++) {
      const hv = hash("star" + i);
      ctx.fillStyle = `rgba(240,239,236,${0.04 + (hv % 10) / 100})`;
      ctx.fillRect((hv % 1000) / 1000 * view.W, ((hv >> 10) % 1000) / 1000 * view.H, 1.2, 1.2);
    }
    for (const e of edges) {
      const [x1, y1] = toScreen(nodes[e.a]);
      const [x2, y2] = toScreen(nodes[e.b]);
      const lit = hover === e.a || hover === e.b;
      ctx.strokeStyle = lit ? css("--gold") : e.cross ? "rgba(217,180,90,.45)" : "rgba(195,194,183,.28)";
      ctx.lineWidth = (lit ? 1.5 : 0.8) + 2.5 * (e.w / maxW);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    nodes.forEach((n, i) => {
      const [x, y] = toScreen(n);
      const r = radius(n);
      ctx.fillStyle = colorOf(n);
      ctx.shadowColor = colorOf(n);
      ctx.shadowBlur = hover === i ? 18 : 8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#0c0c0b";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (hover === i || (labelled.has(i) && hover === -1)) {
        ctx.fillStyle = css("--text-secondary");
        ctx.font = "11px " + css("--mono");
        ctx.fillText(n.path.split("/").pop(), x + r + 4, y + 4);
      }
    });
  }
  const fitView = () => {
    const b = bounds();
    view.cx = (b.x0 + b.x1) / 2;
    view.cy = (b.y0 + b.y1) / 2;
    view.k = Math.min((view.W - 120) / Math.max(1, b.x1 - b.x0), (view.H - 60) / Math.max(1, b.y1 - b.y0), 3);
  };
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 14 * 14;
    nodes.forEach((n, i) => {
      const [x, y] = toScreen(n);
      const d = (x - mx) ** 2 + (y - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    if (best !== hover) { hover = best; draw(); }
    if (best === -1) return hideTip();
    const n = nodes[best];
    const partners = edges.filter((x) => x.a === best || x.b === best).sort((a, b) => b.w - a.w).slice(0, 5)
      .map((x) => ttRow(nodes[x.a === best ? x.b : x.a].path.split("/").pop(), `${x.w}× · ${Math.round(x.conf * 100)}%`)).join("");
    showTip(e, `<b class="mono">${esc(n.path)}</b><div style="color:var(--text-muted);margin:4px 0">changes together with</div>${partners}`);
  });
  canvas.addEventListener("pointerleave", () => { hover = -1; hideTip(); draw(); });

  const legendDirs = [...dirRank.entries()].sort((a, b) => a[1] - b[1]).slice(0, 8);
  const el = h(
    "div",
    h("div.sky", canvas),
    h(
      "div.legend",
      legendDirs.map(([d, i]) => h("span", h("i", { style: { background: seriesColor(i) } }), d === "(root)" ? "/" : d + "/")),
      dirRank.size > 8 ? h("span", h("i", { style: { background: css("--series-other") } }), "other directories") : null,
      h("span", h("i", { style: { background: "rgba(217,180,90,.6)", height: "3px", borderRadius: "2px" } }), "crosses directories"),
    ),
    tableView(
      "Show coupled pairs as a table",
      ["File A", "File B", "Together", "Confidence", "Cross-directory"],
      cs.map((c) => [h("span.path-cell", c.a), h("span.path-cell", c.b), fmt(c.together), pct(c.confidence), c.crossDir ? "yes" : "no"]),
    ),
  );
  return {
    el,
    mount() {
      hiDpiCanvas(canvas, (c, w, hh) => {
        ctx = c;
        view.W = w;
        view.H = hh;
        fitView();
        chooseLabels();
        draw();
      });
    },
  };
}

Museum.wings.push({
  id: "constellations",
  nav: "Constellations",
  render() {
    this.sky = constellationSky();
    return h("section.wing", { id: "constellations" }, wingHead("Hall VII", "Constellations", "constellations"), this.sky.el);
  },
  after() {
    this.sky.mount();
  },
});
