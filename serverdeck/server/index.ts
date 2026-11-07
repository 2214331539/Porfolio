import express from "express";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { collectServer } from "./ssh.ts";
import { baseDirectory, discover } from "./discovery.ts";
import { refreshRegistrations, withRegistrations } from "./registration.ts";
import {
  readSnapshots,
  readVault,
  writeSnapshots,
  writeVault,
  verifyPassword,
  type PrivateServer,
} from "./store.ts";
import type { Project, Snapshot } from "../src/types.ts";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
const sessions = new Map<string, number>();
const attempts = new Map<string, { count: number; until: number }>();
const snapshots: Record<string, Snapshot> = readSnapshots();
const refreshing = new Set<string>();
const configuredHosts = new Set(
  (process.env.SERVER_DECK_ALLOWED_HOSTS || "localhost,127.0.0.1,[::1]")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const configuredOrigins = new Set(
  (
    process.env.SERVER_DECK_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4318,http://127.0.0.1:4318"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const portfolioJwtSecret = process.env.PORFOLIO_JWT_SECRET?.trim() || "";

app.use("/api", (req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  // This application is deliberately bound to loopback; reject DNS rebinding and cross-origin writes.
  const requestHost = req.hostname.toLowerCase();
  if (
    !configuredHosts.has(requestHost) &&
    !configuredHosts.has(`[${requestHost}]`)
  )
    return res.status(403).json({ error: "请通过本机地址访问工作台。" });
  const origin = req.get("origin");
  if (origin && !configuredOrigins.has(origin)) {
    return res.status(403).json({ error: "访问来源不受支持。" });
  }
  next();
});

function sharedAdminToken(req: express.Request) {
  if (!portfolioJwtSecret) return false;
  const value = req.get("authorization") || "";
  const token = value.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const expected = createHmac("sha256", portfolioJwtSecret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");
    const actual = Buffer.from(parts[2]);
    const expectedBuffer = Buffer.from(expected);
    if (
      actual.length !== expectedBuffer.length ||
      !timingSafeEqual(actual, expectedBuffer)
    )
      return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return (
      typeof payload?.sub === "string" &&
      typeof payload?.exp === "number" &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
function session(req: express.Request) {
  const token = req.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("deck_session="))
    ?.slice(13);
  if (!token) return null;
  const expires = sessions.get(token);
  if (!expires || expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return token;
}
app.get("/api/session", (req, res) =>
  res.json({ authenticated: Boolean(session(req) || sharedAdminToken(req)) }),
);
app.post("/api/login", (req, res) => {
  const ip = req.ip || "local";
  const entry = attempts.get(ip);
  if (entry && entry.until > Date.now() && entry.count >= 8)
    return res.status(429).json({ error: "尝试次数较多，请 15 分钟后再试。" });
  const password = req.body?.password;
  if (
    typeof password !== "string" ||
    password.length > 256 ||
    !verifyPassword(password)
  ) {
    attempts.set(ip, {
      count: entry && entry.until > Date.now() ? entry.count + 1 : 1,
      until: Date.now() + 15 * 60_000,
    });
    return res.status(401).json({ error: "管理口令不正确。" });
  }
  attempts.delete(ip);
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + 8 * 60 * 60_000);
  for (const [key, expiry] of sessions)
    if (expiry < Date.now()) sessions.delete(key);
  res.cookie("deck_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.SERVER_DECK_SECURE_COOKIE === "1",
    maxAge: 8 * 60 * 60_000,
    path: "/",
  });
  res.json({ ok: true });
});
app.use("/api", (req, res, next) =>
  session(req) || sharedAdminToken(req)
    ? next()
    : res.status(401).json({ error: "请先登录工作台。" }),
);
app.post("/api/logout", (req, res) => {
  const token = session(req);
  if (token) sessions.delete(token);
  res.clearCookie("deck_session");
  res.json({ ok: true });
});

function state() {
  const vault = readVault();
  return {
    servers: vault.servers.map((server) => ({
      ...server,
      hostKeys: undefined,
      accounts: server.accounts.map((account) => ({
        id: account.id,
        alias: account.alias,
        username: account.username,
        hasPassword: Boolean(account.password),
        hasKey: Boolean(account.keyPath),
      })),
      snapshot: snapshots[server.id] ?? {
        data: null,
        lastAttempt: null,
        error: null,
      },
      projects: discover(
        server.id,
        snapshots[server.id]?.data ?? null,
        vault.projects,
        server.host,
      ).map(withRegistrations),
    })),
    refreshing: [...refreshing],
  };
}
app.get("/api/state", (_req, res) => res.json(state()));
app.get("/api/export", (_req, res) =>
  res
    .set(
      "Content-Disposition",
      'attachment; filename="server-deck-inventory.json"',
    )
    .json(state()),
);

async function refresh(server: PrivateServer) {
  if (refreshing.has(server.id)) return;
  refreshing.add(server.id);
  const lastAttempt = new Date().toISOString();
  const sameTarget = () =>
    readVault().servers.some(
      (item) =>
        item.id === server.id &&
        item.host === server.host &&
        item.port === server.port,
    );
  try {
    const result = await collectServer(server);
    if (sameTarget()) {
      snapshots[server.id] = { ...result, lastAttempt, error: null };
      void refreshRegistrations(
        discover(server.id, result.data, readVault().projects, server.host),
      ).catch(() => {});
    }
  } catch (error) {
    if (sameTarget())
      snapshots[server.id] = {
        data: snapshots[server.id]?.data ?? null,
        lastAttempt,
        error: error instanceof Error ? error.message : "采集暂时未完成。",
      };
  } finally {
    refreshing.delete(server.id);
    writeSnapshots(snapshots);
  }
}
app.post("/api/refresh", (req, res) => {
  const vault = readVault();
  const selected = req.body.serverId
    ? vault.servers.filter((item) => item.id === req.body.serverId)
    : vault.servers;
  if (!selected.length)
    return res.status(404).json({ error: "没有找到服务器。" });
  selected.forEach((server) => {
    void refresh(server);
  });
  res.status(202).json({ ok: true });
});
app.post("/api/servers/:serverId/accounts/:accountId/reveal", (req, res) => {
  const account = readVault()
    .servers.find((server) => server.id === req.params.serverId)
    ?.accounts.find((item) => item.id === req.params.accountId);
  if (!account) return res.status(404).json({ error: "没有找到登录账号。" });
  res.json({
    password: account.password || null,
    keyPath: account.keyPath || null,
  });
});

const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
app.post("/api/servers", (req, res) => {
  const vault = readVault();
  const input = req.body;
  const existing = vault.servers.find((item) => item.id === input.id);
  const host = text(input.host, 253);
  const name = text(input.name, 100);
  const port = Number(input.port || 22);
  if (
    !name ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    return res
      .status(400)
      .json({ error: "请填写服务器名称、有效的 IP / 主机地址和端口。" });
  if (
    vault.servers.some(
      (item) =>
        item.id !== existing?.id && item.host === host && item.port === port,
    )
  )
    return res
      .status(400)
      .json({ error: "这台服务器已经存在，请在原卡片中维护账号。" });
  if (
    !Array.isArray(input.accounts) ||
    input.accounts.length < 1 ||
    input.accounts.length > 8
  )
    return res.status(400).json({ error: "请保留 1 至 8 个登录账号。" });
  const accounts = input.accounts.map((account: Record<string, unknown>) => {
    const previous = existing?.accounts.find((item) => item.id === account.id);
    return {
      id: previous?.id || randomUUID(),
      username: text(account.username, 64),
      alias: text(account.alias, 100),
      password:
        typeof account.password === "string" && account.password
          ? account.password.slice(0, 1024)
          : previous?.password || "",
      keyPath: text(account.keyPath, 500) || previous?.keyPath || "",
    };
  });
  if (
    accounts.some(
      (account: { username: string; password: string; keyPath: string }) =>
        !/^[a-zA-Z_][a-zA-Z0-9_.-]*\$?$/.test(account.username) ||
        (!account.password && !account.keyPath),
    )
  )
    return res
      .status(400)
      .json({ error: "每个账号需要有效的用户名，以及密码或密钥文件路径。" });
  const server: PrivateServer = {
    id: existing?.id || randomUUID(),
    name,
    host,
    port,
    accounts,
    provider: text(input.provider, 100),
    region: text(input.region, 100),
    notes: text(input.notes, 2000),
    expiresAt: text(input.expiresAt, 10),
    monthlyCost: text(input.monthlyCost, 100),
    hostKeys:
      existing?.host === host && existing.port === port
        ? existing.hostKeys
        : [],
  };
  if (existing && (existing.host !== host || existing.port !== port)) {
    delete snapshots[existing.id];
    writeSnapshots(snapshots);
  }
  vault.servers = [
    ...vault.servers.filter((item) => item.id !== server.id),
    server,
  ];
  writeVault(vault);
  res.json({ ok: true, id: server.id });
});
app.delete("/api/servers/:id", (req, res) => {
  const vault = readVault();
  vault.servers = vault.servers.filter((item) => item.id !== req.params.id);
  vault.projects = vault.projects.filter(
    (item) => item.serverId !== req.params.id,
  );
  writeVault(vault);
  delete snapshots[String(req.params.id)];
  writeSnapshots(snapshots);
  res.json({ ok: true });
});
app.post("/api/projects", (req, res) => {
  const vault = readVault();
  const input = req.body;
  const server = vault.servers.find((item) => item.id === input.serverId);
  if (!server) return res.status(404).json({ error: "没有找到服务器。" });
  const projects = discover(
    server.id,
    snapshots[server.id]?.data ?? null,
    vault.projects,
    server.host,
  );
  const existing =
    projects.find((item) => item.id === input.id) ||
    projects.find(
      (item) =>
        input.directory &&
        item.directory &&
        baseDirectory(text(input.directory, 1000)) ===
          baseDirectory(item.directory),
    );
  const name = text(input.name, 100);
  if (!name) return res.status(400).json({ error: "请填写项目名称。" });
  if (
    projects.some(
      (item) =>
        item.id !== existing?.id &&
        item.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return res
      .status(400)
      .json({ error: "这个项目已存在，请在原条目中整理信息。" });
  let endpoints;
  try {
    if (!Array.isArray(input.endpoints) || input.endpoints.length > 30)
      throw new Error();
    endpoints = input.endpoints.map((endpoint: Record<string, unknown>) => {
      const url = new URL(text(endpoint.url, 1000));
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
      const normalized = url.toString().replace(/\/$/, "");
      return {
        url: normalized,
        source:
          existing?.endpoints.find((item) => item.url === normalized)?.source ||
          ("manual" as const),
        registrar: text(endpoint.registrar, 100),
        expiresAt: text(endpoint.expiresAt, 10),
      };
    });
  } catch {
    return res
      .status(400)
      .json({ error: "访问地址需要以 http:// 或 https:// 开头。" });
  }
  const manual = (value: unknown, max: number) =>
    value === "" || value === undefined || value === null
      ? undefined
      : Number.isFinite(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= max
        ? Number(value)
        : NaN;
  const manualMemoryMB = manual(input.manualMemoryMB, 10_000_000);
  const manualCpuPercent = manual(input.manualCpuPercent, 100);
  if (Number.isNaN(manualMemoryMB) || Number.isNaN(manualCpuPercent))
    return res
      .status(400)
      .json({ error: "请填写有效的内存值和 0–100 的 CPU 占用。" });
  const id = existing?.id || randomUUID();
  const project: Project = {
    id,
    serverId: server.id,
    originKey: existing?.originKey || "manual:" + id,
    name,
    description: text(input.description, 500),
    directory: text(input.directory, 1000),
    notes: text(input.notes, 2000),
    endpoints,
    services: [],
    memoryBytes: null,
    cpuPercent: null,
    source: existing?.source || "manual",
    metricSource: null,
    confirmed: true,
    manualMemoryMB,
    manualCpuPercent,
  };
  vault.projects = [
    ...vault.projects.filter((item) => item.id !== id),
    project,
  ];
  writeVault(vault);
  void refreshRegistrations([project]).catch(() => {});
  res.json({ ok: true });
});
app.delete("/api/projects/:id", (req, res) => {
  const vault = readVault();
  vault.projects = vault.projects.filter((item) => item.id !== req.params.id);
  writeVault(vault);
  res.json({ ok: true });
});

const dist = path.join(process.cwd(), "dist");
if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    }),
  );
  app.get("/", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(error instanceof SyntaxError ? 400 : 500).json({
      error:
        error instanceof SyntaxError
          ? "请求格式不正确。"
          : "操作暂时未完成，请重试。",
    });
  },
);
const port = Number(process.env.PORT || 4318);
app.listen(port, "127.0.0.1", () =>
  console.log(`Server Deck API · http://127.0.0.1:${port}`),
);
