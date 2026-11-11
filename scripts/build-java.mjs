// Runs the Maven Wrapper of a Java game (default: dot-catcher) on Windows and POSIX.
// Usage: npm run build:java            -> package (compile to JavaScript)
//        npm run build:java -- test    -> run the JUnit tests only
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const game = process.env.JAVA_GAME || "dot-catcher";
const dir = path.join(root, "java", game);
const goals = process.argv.slice(2);
if (goals.length === 0) goals.push("package");
goals.unshift("-ntp"); // no transfer progress noise

const windows = process.platform === "win32";

// The Maven Wrapper needs JAVA_HOME. If it is not set, ask the `java` on the PATH where it lives.
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const probe = spawnSync("java", ["-XshowSettings:properties", "-version"], {
    encoding: "utf8",
    shell: windows,
  });
  const match = /java.home = (.+)/.exec(
    (probe.stderr || "") + (probe.stdout || ""),
  );
  if (match) env.JAVA_HOME = match[1].trim();
}
const command = windows ? ".\\mvnw.cmd" : "sh";
const args = windows ? goals : ["mvnw", ...goals];

const result = spawnSync(command, args, {
  cwd: dir,
  stdio: "inherit",
  shell: windows,
  env,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
