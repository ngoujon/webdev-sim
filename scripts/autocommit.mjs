import chokidar from "chokidar";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const debounceMs = Number.parseInt(process.env.AUTOCOMMIT_DEBOUNCE_MS ?? "1500", 10);
const messagePrefix = process.env.AUTOCOMMIT_MESSAGE_PREFIX ?? "chore: auto-commit";

function runGit(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { code: r.status ?? 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

function isRepoReadyForCommit() {
  // Allow local opt-out without touching git config.
  if (fs.existsSync(".autocommit-disabled")) return false;

  const mergeHead = runGit(["rev-parse", "-q", "--verify", "MERGE_HEAD"]);
  if (mergeHead.code === 0) return false;

  // Rebase in progress
  if (fs.existsSync(".git/rebase-apply") || fs.existsSync(".git/rebase-merge")) return false;

  return true;
}

function hasWorktreeChanges() {
  const st = runGit(["status", "--porcelain=v1"]);
  return st.code === 0 && st.out.length > 0;
}

function formatCommitMessage() {
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").replace("Z", " UTC");
  return `${messagePrefix}\n\n${ts}\n`;
}

let timer = null;
let committing = false;

function scheduleCommit() {
  if (!isRepoReadyForCommit()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    if (committing) return;
    committing = true;
    try {
      if (!hasWorktreeChanges()) return;

      // Respect .gitignore: add everything that is trackable.
      const add = runGit(["add", "-A"]);
      if (add.code !== 0) return;

      // Still nothing? (e.g. only ignored files changed)
      const st = runGit(["status", "--porcelain=v1"]);
      if (st.code !== 0 || st.out.length === 0) return;

      const msg = formatCommitMessage();
      runGit(["commit", "-m", msg]);
    } finally {
      committing = false;
    }
  }, debounceMs);
}

const watcher = chokidar.watch(".", {
  ignored: [
    "**/.git/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/.vite/**",
    "**/.DS_Store",
  ],
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
});

watcher
  .on("add", scheduleCommit)
  .on("change", scheduleCommit)
  .on("unlink", scheduleCommit)
  .on("addDir", scheduleCommit)
  .on("unlinkDir", scheduleCommit);

process.on("SIGINT", async () => {
  await watcher.close();
  process.exit(0);
});
