import type { Commit } from "../types.js";

export interface Death {
  time: number;
  by: string;
  hash: string;
  subject: string;
  linesAtDeath: number;
}

/** The full life of one file, followed through renames. */
export interface FileLife {
  id: number;
  /** Current path (or the path it died at). */
  path: string;
  /** Earlier names, oldest first. */
  formerNames: string[];
  born: number;
  bornBy: string;
  bornHash: string;
  bornSubject: string;
  /** True when the file already existed before the analysed window. */
  preexisting: boolean;
  /** Set when the file was created by copying another file. */
  copiedFrom?: string;
  /** Id of an earlier, dead life that had the same path (a zombie). */
  resurrectionOf?: number;
  lines: number;
  peakLines: number;
  added: number;
  deleted: number;
  binary: boolean;
  /** Indices into the commit array of every commit that touched the file. */
  touches: number[];
  authors: Map<string, number>;
  lastTime: number;
  lastBy: string;
  lastSubject: string;
  died?: Death;
}

export interface Lifecycle {
  alive: FileLife[];
  dead: FileLife[];
  all: FileLife[];
  /**
   * Line counts sampled at each requested frame time:
   * frames[i] is a flat [id, lines, id, lines, ...] array.
   */
  frames: Int32Array[];
}

/**
 * Replay the history commit by commit, tracking every file from birth
 * (through renames and copies) to death or to the present day.
 * `frameTimes` (ascending) asks for line-count snapshots at those instants.
 */
export function trackLifecycles(commits: Commit[], frameTimes: number[] = []): Lifecycle {
  const alive = new Map<string, FileLife>();
  const all: FileLife[] = [];
  const graveByPath = new Map<string, FileLife>();
  const frames: Int32Array[] = [];
  let nextFrame = 0;

  const snapshot = () => {
    const arr = new Int32Array(alive.size * 2);
    let i = 0;
    for (const life of alive.values()) {
      arr[i++] = life.id;
      arr[i++] = life.lines;
    }
    frames.push(arr);
  };

  const create = (path: string, c: Commit, preexisting: boolean): FileLife => {
    const life: FileLife = {
      id: all.length,
      path,
      formerNames: [],
      born: c.time,
      bornBy: c.author,
      bornHash: c.hash,
      bornSubject: c.subject,
      preexisting,
      lines: 0,
      peakLines: 0,
      added: 0,
      deleted: 0,
      binary: false,
      touches: [],
      authors: new Map(),
      lastTime: c.time,
      lastBy: c.author,
      lastSubject: c.subject,
    };
    const ghost = graveByPath.get(path);
    if (ghost && !preexisting) life.resurrectionOf = ghost.id;
    all.push(life);
    alive.set(path, life);
    return life;
  };

  const touch = (life: FileLife, c: Commit, index: number, added: number, deleted: number) => {
    if (added < 0 || deleted < 0) {
      life.binary = true;
    } else {
      life.added += added;
      life.deleted += deleted;
      life.lines = Math.max(0, life.lines + added - deleted);
      if (life.lines > life.peakLines) life.peakLines = life.lines;
    }
    if (life.touches[life.touches.length - 1] !== index) life.touches.push(index);
    life.authors.set(c.author, (life.authors.get(c.author) ?? 0) + 1);
    life.lastTime = c.time;
    life.lastBy = c.author;
    life.lastSubject = c.subject;
  };

  commits.forEach((c, index) => {
    while (nextFrame < frameTimes.length && c.time >= frameTimes[nextFrame]) {
      snapshot();
      nextFrame++;
    }
    for (const f of c.files) {
      switch (f.status) {
        case "A": {
          const life = alive.get(f.path) ?? create(f.path, c, false);
          touch(life, c, index, f.added, f.deleted);
          break;
        }
        case "C": {
          const life = alive.get(f.path) ?? create(f.path, c, false);
          if (f.oldPath) life.copiedFrom = f.oldPath;
          touch(life, c, index, f.added, f.deleted);
          break;
        }
        case "R": {
          const from = f.oldPath ?? f.path;
          let life = alive.get(from);
          if (life) {
            alive.delete(from);
            life.formerNames.push(from);
            life.path = f.path;
            alive.set(f.path, life);
          } else {
            life = create(f.path, c, true);
          }
          touch(life, c, index, f.added, f.deleted);
          break;
        }
        case "D": {
          const life = alive.get(f.path) ?? create(f.path, c, true);
          const linesAtDeath = Math.max(life.lines, f.deleted > 0 ? f.deleted : 0);
          touch(life, c, index, f.added, f.deleted);
          life.died = { time: c.time, by: c.author, hash: c.hash, subject: c.subject, linesAtDeath };
          alive.delete(f.path);
          graveByPath.set(f.path, life);
          break;
        }
        default: {
          const life = alive.get(f.path) ?? create(f.path, c, true);
          touch(life, c, index, f.added, f.deleted);
        }
      }
    }
  });
  while (nextFrame < frameTimes.length) {
    snapshot();
    nextFrame++;
  }

  return {
    alive: [...alive.values()],
    dead: all.filter((l) => l.died),
    all,
    frames,
  };
}
