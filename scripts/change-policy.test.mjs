import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkChanges,
  changedFiles,
  fingerprint,
  git,
  recordChanges,
  safePath,
} from "./change-policy.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "memo-docs-test-"));
  const write = (path, text) => writeFileSync(join(root, path), text);
  mkdirSync(join(root, "docs", "changes"), { recursive: true });
  git(root, "init");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "user.name", "Documentation fixture");
  git(root, "config", "core.autocrlf", "false");
  write("app.txt", "before\n");
  write(".gitignore", "output/\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture baseline");
  const base = git(root, "rev-parse", "HEAD");
  const record = "docs/changes/task.md";
  write(
    record,
    "# 작업\n\n## 변경\n동작 변경의 이유와 범위.\n\n## 문서\n기준 문서 영향 없음: 테스트 fixture.\n\n## 검증\n테스트 중.\n",
  );
  return { root, write, base, record };
}

test("rejects missing records, accepts attested content, rejects subsequent edits", () => {
  const f = fixture();
  f.write("app.txt", "after\n");
  assert.throws(() => checkChanges(f.root));
  recordChanges(f.root, f.record);
  assert.equal(checkChanges(f.root), 2);
  f.write("app.txt", "after again\n");
  assert.throws(() => checkChanges(f.root), /app.txt/);
});

test("old dirty documentation cannot cover a new untracked or staged file", () => {
  const f = fixture();
  recordChanges(f.root, f.record);
  f.write("new 파일.txt", "new\n");
  assert.throws(() => checkChanges(f.root), /new 파일.txt/);
  git(f.root, "add", "new 파일.txt");
  assert.throws(() => checkChanges(f.root), /new 파일.txt/);
  recordChanges(f.root, f.record);
  checkChanges(f.root);
});

test("deletion and rename require records for both paths", () => {
  const f = fixture();
  renameSync(join(f.root, "app.txt"), join(f.root, "renamed.txt"));
  assert.ok(changedFiles(f.root).includes("app.txt"));
  assert.ok(changedFiles(f.root).includes("renamed.txt"));
  recordChanges(f.root, f.record);
  checkChanges(f.root);
  unlinkSync(join(f.root, "renamed.txt"));
  // Record contains the reviewed deletion of the original tracked path.
  checkChanges(f.root);
});

test("CI base detects committed changes in a clean checkout and rejects invalid refs", () => {
  const f = fixture();
  f.write("app.txt", "after\n");
  recordChanges(f.root, f.record);
  git(f.root, "add", ".");
  git(f.root, "commit", "-m", "documented change");
  checkChanges(f.root, f.base);
  f.write("app.txt", "unrecorded commit\n");
  git(f.root, "add", "app.txt");
  git(f.root, "commit", "-m", "unrecorded change");
  assert.throws(() => checkChanges(f.root, f.base), /app.txt/);
  assert.throws(() => checkChanges(f.root, "no-such-ref"));
});

test("record edits invalidate attestations, ignored outputs do not enter the gate", () => {
  const f = fixture();
  recordChanges(f.root, f.record);
  mkdirSync(join(f.root, "output"));
  f.write("output/build.txt", "ignored");
  checkChanges(f.root);
  f.write(f.record, readFileSync(join(f.root, f.record), "utf8") + "修正\n");
  assert.throws(() => checkChanges(f.root), /task.md/);
});

test("line ending normalization is portable and document-only edits require records", () => {
  const f = fixture();
  f.write("guide.md", "# guide\r\ntext\r\n");
  const hash = fingerprint(f.root, "guide.md");
  f.write("guide.md", "# guide\ntext\n");
  assert.equal(fingerprint(f.root, "guide.md"), hash);
  recordChanges(f.root, f.record);
  f.write("guide.md", "# guide\nchanged\n");
  assert.throws(() => checkChanges(f.root), /guide.md/);
});

test("requires meaningful record structure and rejects unsafe paths", () => {
  const f = fixture();
  f.write(f.record, "# Empty\n");
  assert.throws(() => recordChanges(f.root, f.record), /nonempty/);
  assert.throws(() => safePath(f.root, "../secret"), /Invalid/);
  assert.throws(() => safePath(f.root, "docs/../../secret"), /Invalid/);
});

test("a later task preserves earlier reviewed entries", () => {
  const f = fixture();
  f.write("app.txt", "first\n");
  recordChanges(f.root, f.record);
  const next = "docs/changes/next.md";
  f.write(next, readFileSync(join(f.root, f.record), "utf8"));
  f.write("new.txt", "second\n");
  const selected = recordChanges(f.root, next);
  assert.ok(!selected.includes("app.txt"));
  checkChanges(f.root);
});

test("hook delivers current docs and blocks unrecorded commits using the session baseline", () => {
  const f = fixture();
  mkdirSync(join(f.root, "scripts"));
  for (const file of ["agent-docs-hook.mjs", "change-policy.mjs"]) {
    copyFileSync(new URL(file, import.meta.url), join(f.root, "scripts", file));
  }
  for (const file of [
    "AGENTS.md",
    "docs/STATUS.md",
    "docs/CODE_MAP.md",
    "docs/CHANGES.md",
  ])
    f.write(file, `# Current ${file}\n`);
  const hooks = JSON.parse(
    readFileSync(new URL("../.codex/hooks.json", import.meta.url), "utf8"),
  ).hooks;
  const invoke = (event) => {
    const result = spawnSync(hooks[event][0].hooks[0].command, {
      shell: true,
      cwd: join(f.root, "docs"),
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: event, session_id: f.root }),
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.equal(invoke("Stop").decision, "block");
  const start = invoke("SessionStart");
  assert.match(
    start.hookSpecificOutput.additionalContext,
    /Current docs\/STATUS.md/,
  );
  assert.equal(invoke("Stop").decision, "block");
  recordChanges(f.root, f.record);
  assert.deepEqual(invoke("Stop"), {});
  git(f.root, "add", ".");
  git(f.root, "commit", "-m", "documented change");
  f.write("app.txt", "unrecorded after commit\n");
  git(f.root, "add", "app.txt");
  git(f.root, "commit", "-m", "unrecorded change");
  // Subsequent prompts must not reset the baseline and hide earlier commits.
  invoke("UserPromptSubmit");
  assert.match(invoke("Stop").reason, /app.txt/);
});
