import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");
const port = process.env.PORT || "3000";

function run(command) {
  execSync(command, { stdio: "inherit" });
}

function killPortListener(targetPort) {
  try {
    const output = execSync(`lsof -ti tcp:${targetPort}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (!output) {
      return;
    }

    const pids = [...new Set(output.split(/\s+/).filter(Boolean))];
    for (const pid of pids) {
      run(`kill ${pid}`);
    }
  } catch {
    // No listener on the port, or lsof not available.
  }
}

killPortListener(port);

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
}

const child = spawn("npx", ["next", "dev", "-p", String(port)], {
  stdio: "inherit",
  shell: false,
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
