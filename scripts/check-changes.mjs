import { fileURLToPath } from "node:url";
import { checkChanges, recordChanges } from "./change-policy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
try {
  for (let i = 0; i < args.length; i += 2) {
    if (!["--base", "--record"].includes(args[i]) || !args[i + 1])
      throw new Error(
        "Usage: [--base <commit>] [--record docs/changes/<task>.md]",
      );
  }
  const option = (name) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const base = option("--base") ?? process.env.DOCS_BASE ?? "HEAD";
  const record = option("--record");
  if (record)
    console.log(
      `Recorded reviewed files:\n${recordChanges(root, record, base).join("\n")}`,
    );
  else
    console.log(
      `Change documentation: ${checkChanges(root, base)} changed files covered.`,
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
