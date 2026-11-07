import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import {
  readVault,
  writeVault,
  writeSnapshots,
  local,
  type PrivateServer,
} from "../server/store.ts";
import type { Snapshot } from "../src/types.ts";

// Input comes only from stdin. The source never contains server credentials.
const input: PrivateServer[] = JSON.parse(readFileSync(0, "utf8"));
if (readVault().servers.length)
  throw new Error("已有服务器数据，初始化已停止。");
const snapshots: Record<string, Snapshot> = {};
for (const server of input) {
  try {
    const records = execFileSync(
      "ssh-keygen",
      ["-F", server.host, "-f", path.join(homedir(), ".ssh", "known_hosts")],
      { encoding: "utf8" },
    );
    server.hostKeys = records
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const key = line.trim().split(/\s+/)[2];
        return createHash("sha256")
          .update(Buffer.from(key, "base64"))
          .digest("hex");
      });
  } catch {
    server.hostKeys = [];
  }
  const file = path.join(local, `probe-${server.host}.json`);
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    data.processes = data.processes.filter(
      (p: { name: string; cwd: string; ports: number[] }) =>
        !(
          p.name === "python3" &&
          !p.ports.length &&
          ["/root", "/home/pp"].includes(p.cwd)
        ),
    );
    snapshots[server.id] = { data, lastAttempt: data.collectedAt, error: null };
  }
}
writeVault({ servers: input, projects: [] });
writeSnapshots(snapshots);
console.log(`已初始化 ${input.length} 台服务器。密码已加密保存。`);
