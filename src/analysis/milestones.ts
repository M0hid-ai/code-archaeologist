import type { Commit, Tag } from "../types.js";
import type { Lifecycle } from "./lifecycle.js";
import type { Milestone } from "./report.js";
import { isNoise } from "../util/files.js";
import { revertedSubject } from "../util/messages.js";
import { humanDuration } from "../util/time.js";

const ORDINALS = [100, 1000, 5000, 10000, 25000, 50000, 100000];

/** Pick the tags worth a plaque: majors first, then whatever fits. */
export function notableTags(tags: Tag[], max = 10): Tag[] {
  if (tags.length <= max) return tags;
  const major = tags.filter((t) => /^v?\d+\.0(\.0)?$/.test(t.name));
  const chosen = new Set<Tag>([tags[0], ...major.slice(-max + 2), tags[tags.length - 1]]);
  return [...chosen].sort((a, b) => a.time - b.time).slice(-max);
}

/** The plaques on the wall of the Timeline Hall. */
export function buildMilestones(commits: Commit[], tags: Tag[], lifecycle: Lifecycle, truncated: boolean): Milestone[] {
  if (commits.length === 0) return [];
  const out: Milestone[] = [];
  const first = commits[0];
  out.push({
    t: first.time,
    kind: truncated ? "window" : "genesis",
    title: truncated ? "Excavation begins" : "Genesis",
    detail: truncated ? `The dig starts here: "${first.subject}" by ${first.author}.` : `${first.author} writes the first commit: "${first.subject}".`,
    hash: first.hash,
  });

  const founder = first.author;
  const second = commits.find((c) => c.author !== founder);
  if (second) {
    out.push({
      t: second.time,
      kind: "arrival",
      title: "No longer alone",
      detail: `${second.author} becomes the second contributor, ${humanDuration(second.time - first.time)} after genesis.`,
      hash: second.hash,
    });
  }

  for (const n of ORDINALS) {
    if (commits.length >= n) {
      const c = commits[n - 1];
      out.push({ t: c.time, kind: "ordinal", title: `Commit #${n.toLocaleString("en")}`, detail: `"${c.subject}" by ${c.author}.`, hash: c.hash });
    }
  }

  for (const t of notableTags(tags)) {
    out.push({ t: t.time, kind: "release", title: `Release ${t.name}`, detail: `Tagged ${t.name}.`, hash: t.hash });
  }

  let biggest: { c: Commit; added: number } | null = null;
  let purge: { c: Commit; deleted: number } | null = null;
  for (const c of commits) {
    if (c.parents.length > 1) continue;
    let added = 0;
    let deleted = 0;
    for (const f of c.files) {
      if (isNoise(f.path)) continue;
      added += Math.max(0, f.added);
      deleted += Math.max(0, f.deleted);
    }
    if (c !== first && (!biggest || added > biggest.added)) biggest = { c, added };
    if (!purge || deleted > purge.deleted) purge = { c, deleted };
  }
  if (biggest && biggest.added > 0)
    out.push({
      t: biggest.c.time,
      kind: "boom",
      title: "The Big Bang",
      detail: `${biggest.added.toLocaleString("en")} lines arrive at once: "${biggest.c.subject}" by ${biggest.c.author}.`,
      hash: biggest.c.hash,
    });
  if (purge && purge.deleted > 0)
    out.push({
      t: purge.c.time,
      kind: "purge",
      title: "The Great Deletion",
      detail: `${purge.deleted.toLocaleString("en")} lines erased: "${purge.c.subject}" by ${purge.c.author}.`,
      hash: purge.c.hash,
    });

  const firstRevert = commits.find((c) => revertedSubject(c.subject) !== null || /^revert\b/i.test(c.subject));
  if (firstRevert)
    out.push({ t: firstRevert.time, kind: "revert", title: "The first regret", detail: `${firstRevert.author}: "${firstRevert.subject}".`, hash: firstRevert.hash });

  const firstDeath = [...lifecycle.dead].filter((l) => !isNoise(l.path)).sort((a, b) => a.died!.time - b.died!.time)[0];
  if (firstDeath)
    out.push({
      t: firstDeath.died!.time,
      kind: "death",
      title: "The first burial",
      detail: `${firstDeath.path} is deleted by ${firstDeath.died!.by} after ${humanDuration(firstDeath.died!.time - firstDeath.born)}.`,
      hash: firstDeath.died!.hash,
    });

  let gap = { from: first, to: first, len: 0 };
  for (let i = 1; i < commits.length; i++) {
    const len = commits[i].time - commits[i - 1].time;
    if (len > gap.len) gap = { from: commits[i - 1], to: commits[i], len };
  }
  if (gap.len >= 30 * 86400)
    out.push({
      t: gap.to.time,
      kind: "silence",
      title: "The silence breaks",
      detail: `After ${humanDuration(gap.len)} without a single commit, ${gap.to.author} returns: "${gap.to.subject}".`,
      hash: gap.to.hash,
    });

  const last = commits[commits.length - 1];
  out.push({ t: last.time, kind: "present", title: "The present day", detail: `Latest commit: "${last.subject}" by ${last.author}.`, hash: last.hash });
  return out.sort((a, b) => a.t - b.t);
}
