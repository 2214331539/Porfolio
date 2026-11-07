import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

function token(secret: string, expiresAt: number) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: expiresAt })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

test("accepts the Porfolio admin JWT without exposing a second login", { timeout: 25000 }, async () => {
  const data = mkdtempSync(path.join(tmpdir(), "server-deck-auth-"));
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const secret = "test-porfolio-jwt-secret";
  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      PORFOLIO_JWT_SECRET: secret,
      SERVER_DECK_ALLOWED_HOSTS: "127.0.0.1",
      SERVER_DECK_ALLOWED_ORIGINS: "http://127.0.0.1:5173",
      SERVER_DECK_DATA_DIR: data,
      SERVER_DECK_DISABLE_RDAP: "1",
    },
    stdio: "ignore",
  });
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) throw new Error("Server Deck API stopped early.");
      try {
        const response = await fetch(`${origin}/api/session`);
        if (response.ok) break;
      } catch {
        /* Wait for the listener. */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const valid = token(secret, Math.floor(Date.now() / 1000) + 3600);
    const session = await fetch(`${origin}/api/session`, {
      headers: { Authorization: `Bearer ${valid}` },
    });
    assert.deepEqual(await session.json(), { authenticated: true });
    assert.equal(
      (await fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${valid}` } })).status,
      200,
    );
    const invalid = token("wrong-secret", Math.floor(Date.now() / 1000) + 3600);
    assert.equal(
      (await fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${invalid}` } })).status,
      401,
    );
  } finally {
    if (child.exitCode === null) {
      const closed = once(child, "exit");
      child.kill();
      await closed;
    }
    rmSync(data, { recursive: true, force: true });
  }
});
