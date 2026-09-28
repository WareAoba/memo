import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkChanges, safePath, git } from "./change-policy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const event = input.hook_event_name;
  if (!input.session_id) throw new Error("Missing session_id");
  const key = createHash("sha256")
    .update(root + input.session_id)
    .digest("hex");
  const baseline = join(tmpdir(), `memo-docs-${key}.json`);
  if (["SessionStart", "UserPromptSubmit"].includes(event)) {
    if (!existsSync(baseline))
      writeFileSync(
        baseline,
        JSON.stringify({ base: git(root, "rev-parse", "HEAD") }),
        { flag: "wx" },
      );
    const files = [
      "AGENTS.md",
      "docs/STATUS.md",
      "docs/CODE_MAP.md",
      "docs/CHANGES.md",
      "docs/DESIGN_SYSTEM.md",
    ];
    const context = files
      .map(
        (path) =>
          `--- ${path} ---\n${readFileSync(safePath(root, path), "utf8")}`,
      )
      .join("\n\n");
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event,
          additionalContext: `작업 전 필수 프로젝트 문서입니다. 관련 SPEC/기능 문서와 최신 변경 기록을 확인하고, 변경 후 기록 게이트를 통과해야 합니다.\n현재 Git 상태:\n${git(root, "status", "--short")}\n${context}`,
        },
      }),
    );
  } else if (event === "Stop") {
    if (!existsSync(baseline))
      throw new Error(
        "시작 문서 훅의 기준점이 없습니다. SessionStart/UserPromptSubmit 훅 활성화를 확인하세요.",
      );
    checkChanges(root, JSON.parse(readFileSync(baseline, "utf8")).base);
    console.log("{}");
  } else throw new Error(`Unsupported documentation hook: ${event}`);
} catch (error) {
  console.log(
    JSON.stringify({
      decision: "block",
      reason: `프로젝트 문서 게이트: ${error.message}`,
    }),
  );
}
