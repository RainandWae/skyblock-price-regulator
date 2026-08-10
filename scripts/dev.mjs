import { spawn } from "node:child_process";

const commands = [
  ["server", "node", ["server/index.mjs"]],
  ["client", "npx", ["vite", "--host", "127.0.0.1"]],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
      for (const running of children) {
        if (running !== child && !running.killed) running.kill();
      }
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
