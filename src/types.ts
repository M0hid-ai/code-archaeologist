/** Core data model shared by every analysis pass. */

export type ChangeStatus = "A" | "M" | "D" | "R" | "C" | "T";

export interface FileChange {
  /** Path after the change (for deletions: the path that was removed). */
  path: string;
  /** Previous path for renames / copies. */
  oldPath?: string;
  status: ChangeStatus;
  /** Lines added, or -1 for binary files. */
  added: number;
  /** Lines deleted, or -1 for binary files. */
  deleted: number;
}

export interface Commit {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  /** Author time as unix seconds (UTC). */
  time: number;
  /** Hour of day (0-23) in the author's own timezone. */
  localHour: number;
  /** Day of week (0 = Sunday) in the author's own timezone. */
  localWeekday: number;
  subject: string;
  files: FileChange[];
}

export interface Tag {
  name: string;
  time: number;
  hash: string;
}

export interface RepoHistory {
  name: string;
  /** Oldest first. */
  commits: Commit[];
  tags: Tag[];
  head: string;
  branch: string;
}
