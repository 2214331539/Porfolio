import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5173/";
const windows = process.platform === "win32";
const children = new Set();
let stopping = false;
process.chdir(root);

// The frontend proxy and API must agree, regardless of the caller's PORT variable.
process.env.PORT = "4318";

function npm(command, args) {
  // All command arguments below are fixed strings from this file.
  const child = spawn(
    windows ? process.env.ComSpec || "cmd.exe" : "npm",
    windows ? ["/d", "/s", "/c", `npm.cmd ${[command, ...args].join(" ")}`] : [command, ...args],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  const task = { child, error: null, done: null };
  children.add(task);
  task.done = new Promise((resolve) => {
    child.once("error", (error) => {
      task.error = error;
      children.delete(task);
      resolve(1);
    });
    child.once("exit", (code) => {
      children.delete(task);
      resolve(code ?? 1);
    });
  });
  return task;
}

async function ready(kind) {
  try {
    const response = await fetch(
      kind === "web" ? url : "http://127.0.0.1:4318/api/session",
      { signal: AbortSignal.timeout(1500) },
    );
    if (!response.ok) return false;
    return kind === "web"
      ? (await response.text()).includes("<title>Server Deck")
      : typeof (await response.json()).authenticated === "boolean";
  } catch {
    return false;
  }
}

function occupied(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function openBrowser() {
  if (process.env.SERVER_DECK_OPEN_BROWSER === "0") return;
  const child = windows
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], { stdio: "ignore", windowsHide: true })
    : spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore" });
  child.once("error", () => console.log(`Open ${url} in your browser.`));
}

async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.all([...children].map(async ({ child }) => {
    if (!child.pid || child.exitCode !== null) return;
    if (windows) {
      // Only terminate process trees created by this launcher.
      await new Promise((resolve) => {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
        killer.once("error", resolve);
        killer.once("exit", resolve);
      });
    } else child.kill("SIGTERM");
  }));
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await stop();
    process.exit(0);
  });
}

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error("Node.js 22 or newer is required.");
  }
  console.log("Server Deck\nChecking local services...");
  const [web, api] = await Promise.all([ready("web"), ready("api")]);
  if (web && api) {
    console.log(`Already running: ${url}`);
    openBrowser();
    return;
  }
  for (const [running, port] of [[web, 5173], [api, 4318]]) {
    if (!running && await occupied(port)) {
      throw new Error(`Port ${port} is occupied by an unrecognized or unready service. Free the port and retry.`);
    }
  }
  const dependencies = ["vite", "tsx", "concurrently", "express", "ssh2"];
  if (dependencies.some((name) => !existsSync(`node_modules/${name}/package.json`))) {
    console.log("Installing project dependencies...");
    const install = npm(existsSync("package-lock.json") ? "ci" : "install", []);
    if (await install.done !== 0) throw new Error("Dependency installation failed.");
  }
  console.log("Starting Server Deck. Keep this window open; press Ctrl+C to stop.\n");
  const services = !web && !api
    ? [npm("run", ["dev"])]
    : web
      ? [npm("exec", ["--", "tsx", "watch", "server/index.ts"])]
      : [npm("exec", ["--", "vite", "--host", "127.0.0.1"])];
  const deadline = Date.now() + 45_000;
  while (true) {
    if (services.some((task) => task.error || task.child.exitCode !== null)) {
      throw new Error("A service exited during startup. Check its output above.");
    }
    const checks = await Promise.all([ready("web"), ready("api")]);
    if (checks.every(Boolean)) break;
    if (Date.now() > deadline) throw new Error("Startup timed out after 45 seconds.");
    await delay(500);
  }
  console.log(`\nReady: ${url}\n`);
  openBrowser();
  const results = await Promise.all(services.map((task) => task.done));
  if (!stopping && results.some((code) => code !== 0)) throw new Error("A service stopped unexpectedly.");
}

try {
  await main();
} catch (error) {
  console.error(`\n${error.message}`);
  await stop();
  process.exitCode = 1;
}
