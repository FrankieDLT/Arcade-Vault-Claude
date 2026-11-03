// PostToolUse hook: run Prettier on React/Markdown files and ESLint --fix on React files.
import { spawnSync } from "node:child_process";
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const input = JSON.parse(raw);
  const file = input?.tool_input?.file_path;
  if (!file) process.exit(0);

  const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const abs = path.resolve(file);
  const rel = path.relative(projectDir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);

  const ext = path.extname(abs).toLowerCase();
  const isReact = ext === ".tsx" || ext === ".jsx";
  if (!isReact && ext !== ".md") process.exit(0);

  const run = (cmd) =>
    spawnSync(cmd, { cwd: projectDir, shell: true, stdio: "ignore" });

  run(`npx prettier --write --ignore-unknown "${abs}"`);
  if (isReact) run(`npx eslint --fix "${abs}"`);
} catch {
  // Never block the tool call.
}
process.exit(0);
