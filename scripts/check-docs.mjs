import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = ["AGENTS.md", "README.md", "SPEC.md"];
for (const directory of ["docs", "frontend/src/styles"]) {
  if (!existsSync(join(root, directory))) continue;
  for (const name of readdirSync(join(root, directory), { recursive: true })) {
    if (name.endsWith(".md")) files.push(join(directory, name));
  }
}
const failures = [];
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const match of source.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0]);
    if (!existsSync(resolve(root, dirname(file), path))) {
      failures.push(`${file}: missing link target ${target}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Documentation: local link targets exist in ${files.length} Markdown files (anchors not checked).`,
  );
}
