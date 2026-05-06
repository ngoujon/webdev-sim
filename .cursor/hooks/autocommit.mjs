#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

// Cursor hook: auto-commit changes after agent/tab edits.
// Note: Cursor rules alone cannot run commands; hooks can.

const debounceMs = Number.parseInt(process.env.CURSOR_AUTOCOMMIT_DEBOUNCE_MS ?? "1500", 10);
const messagePrefix = process.env.CURSOR_AUTOCOMMIT_MESSAGE_PREFIX ?? "chore: cursor auto-commit";

function runGit(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { code: r.status ?? 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

function isRepoReadyForCommit() {
  if (fs.existsSync(".autocommit-disabled")) return false;
  if (fs.existsSync(".git/rebase-apply") || fs.existsSync(".git/rebase-merge")) return false;

  const mergeHead = runGit(["rev-parse", "-q", "--verify", "MERGE_HEAD"]);
  if (mergeHead.code === 0) return false;

  return true;
}

function hasWorktreeChanges() {
  const st = runGit(["status", "--porcelain=v1"]);
  return st.code === 0 && st.out.length > 0;
}

function readState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function writeState(statePath, state) {
  fs.mkdirSync(".cursor", { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state), "utf8");
}

function formatCommitMessage() {
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").replace("Z", " UTC");
  return `${messagePrefix}\n\n${ts}\n`;
}

function main() {
  // Read stdin to avoid broken pipes; we don't need the payload.
  try {
    fs.readFileSync(0, "utf8");
  } catch {
    // ignore
  }

  if (!isRepoReadyForCommit()) {
    process.stdout.write(JSON.stringify({}) + "\n");
    return;
  }

  const statePath = ".cursor/.autocommit-state.json";
  const now = Date.now();
  const state = readState(statePath);
  const last = typeof state.lastCommitAttemptMs === "number" ? state.lastCommitAttemptMs : 0;

  if (now - last < debounceMs) {
    process.stdout.write(JSON.stringify({}) + "\n");
    return;
  }

  writeState(statePath, { lastCommitAttemptMs: now });

  if (!hasWorktreeChanges()) {
    process.stdout.write(JSON.stringify({}) + "\n");
    return;
  }

  const add = runGit(["add", "-A"]);
  if (add.code !== 0) {
    process.stdout.write(JSON.stringify({}) + "\n");
    return;
  }

  const st2 = runGit(["status", "--porcelain=v1"]);
  if (st2.code !== 0 || st2.out.length === 0) {
    process.stdout.write(JSON.stringify({}) + "\n");
    return;
  }

  const msg = formatCommitMessage();
  runGit(["commit", "-m", msg]);

  process.stdout.write(JSON.stringify({}) + "\n");
}

main();

