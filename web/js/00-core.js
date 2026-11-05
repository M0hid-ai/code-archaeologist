/* Core helpers shared by every wing of the museum. */
"use strict";

const R = JSON.parse(document.getElementById("museum-data").textContent);
const Museum = { wings: [], data: R };

const SERIES = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6", "--series-7", "--series-8"];
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const seriesColor = (i) => (i < SERIES.length ? css(SERIES[i]) : css("--series-other"));

/* Mood groups: ten raw moods fold into five readable categories (fixed slot order). */
const MOOD_GROUPS = [
  { id: "feature", label: "Features", moods: ["feature"] },
  { id: "fix", label: "Fixes", moods: ["fix", "panic", "revert"] },
  { id: "refactor", label: "Refactors", moods: ["refactor"] },
  { id: "docs", label: "Docs & tests", moods: ["docs", "test"] },
  { id: "chore", label: "Chores & merges", moods: ["chore", "merge"] },
];
const moodGroupOf = (m) => MOOD_GROUPS.findIndex((g) => g.moods.includes(m));
const moodColor = (m) => {
  const i = moodGroupOf(m);
  return i === -1 ? css("--series-other") : seriesColor(i);
};

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en") : n);
const compact = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n);
const date = (t) => new Date(t * 1000).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = (t) => new Date(t * 1000).toLocaleDateString("en", { year: "numeric", month: "short", timeZone: "UTC" });
const year = (t) => new Date(t * 1000).getUTCFullYear();
/** Label for one bucket of the activity series (unit chosen by the analysis). */
const UNIT = R.seriesUnit || "month";
const bucketLabel = (t) =>
  UNIT === "month"
    ? monthLabel(t)
    : UNIT === "day"
      ? date(t)
      : new Date(t * 1000).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const bucketSeconds = UNIT === "month" ? 31 * 86400 : UNIT === "day" ? 86400 : 3600;
const pct = (x) => Math.round(x * 100) + "%";
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;
function duration(sec) {
  const d = sec / 86400;
  if (d >= 730) return Math.round(d / 365) + " years";
  if (d >= 365) return "1 year";
  if (d >= 60) return Math.round(d / 30.4) + " months";
  if (d >= 2) return Math.round(d) + " days";
  const h = sec / 3600;
  if (h >= 2) return Math.round(h) + " hours";
  const m = Math.round(sec / 60);
  return m >= 2 ? m + " minutes" : "a moment";
}

/** Tiny DOM builder: h("div.card", {title: "x"}, child, "text", ...) */
function h(spec, attrs, ...children) {
  const [tag, ...classes] = spec.split(".");
  const el = document.createElement(tag || "div");
  if (classes.length) el.className = classes.join(" ");
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  appendAll(el, children);
  return el;
}
function appendAll(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat(Infinity)) {
    if (c == null) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* ---------- tooltip ---------- */
const tip = document.getElementById("tooltip");
function showTip(evt, content) {
  tip.replaceChildren(...(Array.isArray(content) ? content : [content]).map((c) => (c instanceof Node ? c : h("div", { html: c }))));
  tip.classList.add("on");
  moveTip(evt);
}
function moveTip(evt) {
  const pad = 14;
  const r = tip.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  tip.style.left = Math.max(8, x) + "px";
  tip.style.top = Math.max(8, y) + "px";
}
function hideTip() {
  tip.classList.remove("on");
}
/** Attach a hover tooltip; `content` may be a function evaluated on hover. */
function tooltip(el, content) {
  el.addEventListener("pointerenter", (e) => showTip(e, typeof content === "function" ? content(e) : content));
  el.addEventListener("pointermove", moveTip);
  el.addEventListener("pointerleave", hideTip);
  return el;
}
const ttRow = (k, v) => `<div class="tt-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
function esc(x) {
  return String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* ---------- shared pieces ---------- */
function wingHead(kicker, title, placardKey) {
  const text = R.narrative.placards[placardKey];
  return h(
    "header.wing-head",
    h("div.wing-kicker", kicker),
    h("h2", title),
    text ? h("p.placard" + (R.narrative.source !== "offline" ? ".ai" : ""), text) : null,
  );
}
function empty(msg) {
  return h("p.empty", msg);
}
/** Horizontal labelled bars (single series, text in ink colours). */
function barList(rows, color) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h(
    "div.bars",
    rows.map((r) =>
      tooltip(
        h(
          "div.bar-row",
          h("span", { title: r.label }, r.label),
          h("div.track", h("div.fill", { style: { width: Math.max(1, (r.value / max) * 100) + "%", background: color } })),
          h("span.n", fmt(r.value)),
        ),
        r.tip || `<b>${esc(r.label)}</b><br>${fmt(r.value)}`,
      ),
    ),
  );
}
/** Small inline sparkline. */
function sparkline(values, color, w = 220, hgt = 36) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(hgt - 2 - (v / max) * (hgt - 6)).toFixed(1)}`);
  return s(
    "svg",
    { viewBox: `0 0 ${w} ${hgt}`, class: "chart", preserveAspectRatio: "none", style: `height:${hgt}px` },
    s("polyline", { points: `0,${hgt} ${pts.join(" ")} ${w},${hgt}`, fill: color, "fill-opacity": 0.18, stroke: "none" }),
    s("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
  );
}
/** Deterministic hash for identicons and stable colours. */
function hash(str) {
  let x = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  return x >>> 0;
}
/** 5x5 mirrored identicon: no network, no emails, just a name. */
function identicon(name) {
  const hv = hash(name);
  const color = seriesColor(hv % 8);
  const cells = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++) {
      if ((hv >> (y * 3 + x)) & 1) {
        cells.push(s("rect", { x: x * 10 + 1, y: y * 10 + 1, width: 9, height: 9, rx: 2, fill: color }));
        if (x < 2) cells.push(s("rect", { x: (4 - x) * 10 + 1, y: y * 10 + 1, width: 9, height: 9, rx: 2, fill: color }));
      }
    }
  return s("svg", { viewBox: "-4 -4 59 59", class: "identicon", "aria-hidden": "true" }, cells);
}
/** A <details> table view so no chart is colour-only. */
function tableView(label, headers, rows) {
  return h(
    "details.table-view",
    h("summary", label),
    h("table.data", h("thead", h("tr", headers.map((x) => h("th", x)))), h("tbody", rows.map((r) => h("tr", r.map((c) => h("td", c)))))),
  );
}
/** Resize-aware canvas with device-pixel-ratio scaling. */
function hiDpiCanvas(canvas, draw) {
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, r.width, r.height);
  };
  new ResizeObserver(fit).observe(canvas);
  return fit;
}
