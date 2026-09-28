import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

export const ledgerPath = "docs/change-ledger.json";
export function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}
export function safePath(root, path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\\") ||
    isAbsolute(path) ||
    path.split("/").includes("..")
  )
    throw new Error(`Invalid repository path: ${path}`);
  const result = resolve(root, path);
  if (relative(root, result).startsWith(".."))
    throw new Error(`Outside repository: ${path}`);
  return result;
}
export function fingerprint(root, path) {
  const absolute = safePath(root, path);
  if (!existsSync(absolute)) return null;
  const bytes = readFileSync(absolute);
  // Git may check text out as CRLF on Windows. Preserve binary bytes exactly.
  const content =
    bytes.includes(0) || !isUtf8(bytes)
      ? bytes
      : Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"));
  return createHash("sha256").update(content).digest("hex");
}
export function changedFiles(root, base = "HEAD") {
  const revision = git(root, "rev-parse", "--verify", `${base}^{tree}`);
  const tracked = git(
    root,
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    revision,
    "--",
  );
  const untracked = git(
    root,
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  );
  return [...new Set((tracked + "\0" + untracked).split("\0").filter(Boolean))]
    .filter((p) => p !== ledgerPath)
    .sort();
}
export function readLedger(root) {
  const ledger = JSON.parse(readFileSync(safePath(root, ledgerPath), "utf8"));
  if (ledger.version !== 1 || !Array.isArray(ledger.entries))
    throw new Error("Invalid change ledger schema");
  for (const entry of ledger.entries) {
    safePath(root, entry.record);
    if (
      !/^docs\/changes\/.+\.md$/.test(entry.record) ||
      !/^[a-f0-9]{64}$/.test(entry.recordHash) ||
      !entry.files ||
      typeof entry.files !== "object" ||
      Array.isArray(entry.files)
    )
      throw new Error("Invalid change ledger entry");
    for (const [path, hash] of Object.entries(entry.files)) {
      safePath(root, path);
      if (hash !== null && !/^[a-f0-9]{64}$/.test(hash))
        throw new Error(`Invalid fingerprint: ${path}`);
    }
  }
  return ledger;
}
export function missingRecords(root, files, ledger) {
  return files.filter((path) => {
    const entry = ledger.entries.findLast((item) =>
      Object.hasOwn(item.files, path),
    );
    return (
      !entry ||
      fingerprint(root, path) !== entry.files[path] ||
      fingerprint(root, entry.record) !== entry.recordHash
    );
  });
}
export function checkChanges(root, base = "HEAD") {
  const files = changedFiles(root, base);
  const ledger = readLedger(root);
  for (const entry of ledger.entries) {
    if (fingerprint(root, entry.record) !== entry.recordHash)
      throw new Error(
        `변경 기록 본문이 삭제되거나 다시 수정됐습니다: ${entry.record}`,
      );
  }
  const missing = missingRecords(root, files, ledger);
  if (missing.length)
    throw new Error(
      `변경 기록이 없거나 기록 이후 다시 수정된 파일:\n${missing.join("\n")}\n관련 기준 문서와 docs/changes/ 기록을 갱신한 뒤 npm run record:change -- --record docs/changes/<작업>.md 를 실행하세요. 해시만 갱신해 검사를 우회하지 마세요.`,
    );
  return files.length;
}
export function recordChanges(root, record, base = "HEAD") {
  if (!/^docs\/changes\/.+\.md$/.test(record))
    throw new Error("Record must be docs/changes/<task>.md");
  const source = readFileSync(safePath(root, record), "utf8");
  for (const section of ["변경", "문서", "검증"]) {
    if (!new RegExp(`^## ${section}\\r?\\n\\s*\\S`, "m").test(source))
      throw new Error(`Record needs a nonempty '## ${section}' section`);
  }
  const ledger = existsSync(resolve(root, ledgerPath))
    ? readLedger(root)
    : { version: 1, entries: [] };
  const files = changedFiles(root, base);
  const selected = new Set(missingRecords(root, files, ledger));
  const previous = ledger.entries.find((entry) => entry.record === record);
  for (const path of Object.keys(previous?.files ?? {})) selected.add(path);
  selected.add(record);
  const entry = {
    record,
    recordHash: fingerprint(root, record),
    files: Object.fromEntries(
      [...selected].sort().map((path) => [path, fingerprint(root, path)]),
    ),
  };
  ledger.entries = [
    ...ledger.entries.filter((item) => item.record !== record),
    entry,
  ];
  writeFileSync(
    resolve(root, ledgerPath),
    JSON.stringify(ledger, null, 2) + "\n",
  );
  return [...selected];
}
