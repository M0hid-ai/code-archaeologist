/* Wing 3: the Timelapse Theater. An animated treemap of the codebase across its whole life. */

/** Squarified treemap layout (Bruls et al.), preserving the given item order. */
function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((a, it) => a + it.value, 0);
  if (!total || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  let rest = items.filter((it) => it.value > 0).map((it) => ({ it, area: it.value * scale }));
  let rx = x, ry = y, rw = w, rh = h;
  const worst = (row, side) => {
    const sum = row.reduce((a, r) => a + r.area, 0);
    let max = 0, min = Infinity;
    for (const r of row) { max = Math.max(max, r.area); min = Math.min(min, r.area); }
    const s2 = sum * sum, side2 = side * side;
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  };
  while (rest.length) {
    const side = Math.min(rw, rh);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) row.push(rest[i++]);
    rest = rest.slice(i);
    const sum = row.reduce((a, r) => a + r.area, 0);
    if (rw >= rh) {
      const cw = sum / rh;
      let cy = ry;
      for (const r of row) { const ch = r.area / cw; out.push({ it: r.it, x: rx, y: cy, w: cw, h: ch }); cy += ch; }
      rx += cw; rw -= cw;
    } else {
      const ch = sum / rw;
      let cx = rx;
      for (const r of row) { const cw = r.area / ch; out.push({ it: r.it, x: cx, y: ry, w: cw, h: ch }); cx += cw; }
      ry += ch; rh -= ch;
    }
  }
  return out;
}

function timelapseTheater() {
  const T = R.timelapse;
  if (!T.frames.length || !T.files.length) return empty("Not enough history to film a timelapse.");
  const F = T.frames.length;
  const N = T.files.length;
  const sizes = T.frames.map((fr) => {
    const arr = new Float32Array(N);
    for (let i = 0; i < fr.sizes.length; i += 2) arr[fr.sizes[i]] = fr.sizes[i + 1];
    return arr;
  });
  // Directory order and colour are fixed for the whole film (by peak size), so tiles never repaint.
  const dirPeak = new Map();
  sizes.forEach((arr) => {
    const per = new Map();
    T.files.forEach((f, i) => arr[i] && per.set(f.dir, (per.get(f.dir) || 0) + arr[i]));
    per.forEach((v, d) => dirPeak.set(d, Math.max(dirPeak.get(d) || 0, v)));
  });
  const dirs = [...dirPeak.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  const dirColor = new Map(dirs.map((d, i) => [d, i < 7 ? seriesColor(i) : css("--series-other")]));
  const filesByDir = new Map(dirs.map((d) => [d, []]));
  T.files.forEach((f, i) => filesByDir.get(f.dir) && filesByDir.get(f.dir).push(i));

  const canvas = h("canvas", { role: "img", "aria-label": "Animated treemap of files over time" });
  const dateEl = h("div.date");
  const statsEl = h("div.stats");
  const scrub = h("input", { type: "range", min: 0, max: F - 1, step: 0.01, value: 0, "aria-label": "Timeline position" });
  const playBtn = h("button.btn", "▶ Play");
  const soundBtn = h("button.btn", { title: "Sound design: a chime per month, pitched by activity" }, "♪ Sound off");
  const speedSel = h("select.btn", { "aria-label": "Speed" }, ["0.5", "1", "2", "4"].map((v) => h("option", { value: v, selected: v === "1" }, v + "×")));

  let pos = 0;
  let playing = false;
  let last = 0;
  let lastWhole = -1;
  let rects = [];
  let W = 0, H = 0, ctx = null;
  let audio = null;
  let soundOn = false;

  const frameSizes = (p) => {
    const a = Math.floor(p), b = Math.min(F - 1, a + 1), t = p - a;
    const A = sizes[a], B = sizes[b];
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = A[i] + (B[i] - A[i]) * t;
    return { out, a, b, t };
  };

  function draw() {
    if (!ctx) return;
    const { out, a } = frameSizes(pos);
    const prev = sizes[Math.max(0, a - 1)];
    ctx.fillStyle = "#0c0c0b";
    ctx.fillRect(0, 0, W, H);
    const dirItems = dirs.map((d) => ({ d, value: filesByDir.get(d).reduce((s2, i) => s2 + out[i], 0) }));
    rects = [];
    for (const dr of squarify(dirItems, 0, 0, W, H)) {
      const color = dirColor.get(dr.it.d);
      const pad = dr.w > 40 && dr.h > 40 ? 3 : 1;
      const head = dr.w > 70 && dr.h > 50 ? 16 : 0;
      const items = filesByDir.get(dr.it.d).map((i) => ({ i, value: out[i] }));
      for (const fr of squarify(items, dr.x + pad, dr.y + pad + head, dr.w - pad * 2, dr.h - pad * 2 - head)) {
        const i = fr.it.i;
        const born = prev[i] === 0 && sizes[a][i] > 0;
        ctx.globalAlpha = born ? 1 : 0.82;
        ctx.fillStyle = color;
        const gx = fr.w > 3 ? 1 : 0, gy = fr.h > 3 ? 1 : 0; // 2px surface gap between tiles
        ctx.fillRect(fr.x + gx, fr.y + gy, Math.max(0.5, fr.w - gx * 2), Math.max(0.5, fr.h - gy * 2));
        if (born) {
          ctx.strokeStyle = css("--text-primary");
          ctx.lineWidth = 1.5;
          ctx.strokeRect(fr.x + 1.5, fr.y + 1.5, Math.max(0, fr.w - 3), Math.max(0, fr.h - 3));
        }
        ctx.globalAlpha = 1;
        if (fr.w > 64 && fr.h > 18) {
          ctx.fillStyle = "rgba(11,11,11,.82)";
          ctx.font = "11px " + css("--mono");
          const name = T.files[i].path.split("/").pop();
          ctx.fillText(name.length * 6.6 > fr.w - 8 ? name.slice(0, Math.max(1, Math.floor((fr.w - 8) / 6.6) - 1)) + "…" : name, fr.x + 5, fr.y + 14);
        }
        rects.push({ ...fr, i });
      }
      if (head) {
        ctx.fillStyle = css("--text-secondary");
        ctx.font = "600 12px " + css("--sans");
        const label = dr.it.d === "(root)" ? "/" : dr.it.d + "/";
        ctx.fillText(label.length * 7 > dr.w - 8 ? label.slice(0, Math.floor((dr.w - 8) / 7)) + "…" : label, dr.x + 5, dr.y + 14);
      }
    }
    const fr = T.frames[a];
    dateEl.textContent = monthLabel(T.frames[Math.round(pos)].t);
    statsEl.replaceChildren(
      ...[
      h("span", h("b", compact(fr.totalLines)), " lines"),
      h("span", h("b", fmt(fr.totalFiles)), " files"),
      h("span", h("b", fmt(fr.commits)), " commits this period"),
      fr.born ? h("span.add", "+" + fmt(fr.born) + " born") : null,
      fr.died ? h("span.del", "−" + fmt(fr.died) + " died") : null,
      fr.authors.length ? h("span", "by ", h("b", fr.authors.join(", "))) : null,
      ].filter(Boolean),
    );
    scrub.value = pos;
  }

  function chime(k) {
    if (!soundOn) return;
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const fr = T.frames[k];
    const now = audio.currentTime;
    if (fr.commits) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine";
      o.frequency.value = 220 * Math.pow(2, Math.min(3, Math.log2(1 + fr.commits) / 2.2));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      o.connect(g).connect(audio.destination);
      o.start(now);
      o.stop(now + 0.55);
    }
    if (fr.died) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(110, now);
      o.frequency.exponentialRampToValueAtTime(45, now + 0.35);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      o.connect(g).connect(audio.destination);
      o.start(now);
      o.stop(now + 0.45);
    }
  }

  function tick(ts) {
    if (!playing) return;
    const dt = last ? (ts - last) / 1000 : 0;
    last = ts;
    const fps = Math.max(2, Math.min(10, F / 20)) * Number(speedSel.value);
    pos = Math.min(F - 1, pos + dt * fps);
    const whole = Math.floor(pos);
    if (whole !== lastWhole) {
      lastWhole = whole;
      chime(whole);
    }
    draw();
    if (pos >= F - 1) setPlaying(false);
    else requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = on;
    playBtn.textContent = on ? "❚❚ Pause" : pos >= F - 1 ? "↺ Replay" : "▶ Play";
    if (on) {
      if (pos >= F - 1) pos = 0;
      last = 0;
      requestAnimationFrame(tick);
    }
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "♪ Sound on" : "♪ Sound off";
    soundBtn.classList.toggle("on", soundOn);
  });
  scrub.addEventListener("input", () => {
    pos = Number(scrub.value);
    draw();
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const hit = rects.find((q) => mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h);
    if (!hit) return hideTip();
    const lines = Math.round(frameSizes(pos).out[hit.i]);
    showTip(e, `<b class="mono">${esc(T.files[hit.i].path)}</b>${ttRow("Lines", fmt(lines))}${ttRow("Language", T.files[hit.i].lang)}`);
  });
  canvas.addEventListener("pointerleave", hideTip);

  const theater = h(
    "div.theater",
    canvas,
    h("div.hud", dateEl, statsEl),
    h("div.controls", playBtn, scrub, speedSel, soundBtn),
  );
  Museum.timelapse = {
    element: theater,
    toggle() {
      setPlaying(!playing);
    },
    step(delta) {
      setPlaying(false);
      pos = Math.max(0, Math.min(F - 1, Math.round(pos) + delta));
      draw();
    },
    mount() {
      hiDpiCanvas(canvas, (c, w, hh) => {
        ctx = c; W = w; H = hh;
        draw();
      });
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        pos = F - 1;
        draw();
        return;
      }
      const io = new IntersectionObserver((es) => {
        if (es.some((x) => x.isIntersecting)) {
          io.disconnect();
          setPlaying(true);
        }
      }, { threshold: 0.5 });
      io.observe(canvas);
    },
  };
  const legend = h(
    "div.legend",
    dirs.slice(0, 7).map((d, i) => h("span", h("i", { style: { background: seriesColor(i) } }), d === "(root)" ? "/ (root files)" : d + "/")),
    dirs.length > 7 ? h("span", h("i", { style: { background: css("--series-other") } }), `${dirs.length - 7} other directories`) : null,
    h("span", h("i", { style: { background: "transparent", outline: "1.5px solid " + css("--text-primary") } }), "Newborn file"),
  );
  return h("div", theater, legend);
}

Museum.wings.push({
  id: "timelapse",
  nav: "Timelapse",
  render() {
    return h("section.wing", { id: "timelapse" }, wingHead("Hall II", "The Timelapse Theater", "timelapse"), timelapseTheater());
  },
  after() {
    if (Museum.timelapse) Museum.timelapse.mount();
  },
});
