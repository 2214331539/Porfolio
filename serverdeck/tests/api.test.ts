import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

test(
  "API protects credentials and preserves manual records across a restart",
  { timeout: 25000 },
  async () => {
    const data = mkdtempSync(path.join(tmpdir(), "server-deck-test-"));
    const listener = net.createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const port = (listener.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    const origin = `http://127.0.0.1:${port}`;
    let child: ReturnType<typeof spawn> | undefined;
    let cookie = "";
    async function launch() {
      child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(port),
          SERVER_DECK_DATA_DIR: data,
          SERVER_DECK_DISABLE_RDAP: "1",
        },
        stdio: "ignore",
      });
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null)
          throw new Error("Isolated API exited before startup.");
        try {
          if ((await fetch(origin + "/api/session")).ok) return;
        } catch {
          /* Wait for the isolated listener. */
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("Isolated API did not start.");
    }
    async function stop() {
      if (child && child.exitCode === null) {
        const closed = once(child, "exit");
        child.kill();
        await closed;
      }
    }
    async function request(
      route: string,
      method = "GET",
      body?: unknown,
      headers = {},
    ) {
      return fetch(origin + "/api" + route, {
        method,
        headers: { "Content-Type": "application/json", cookie, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    async function login() {
      const password = readFileSync(
        path.join(data, "dashboard-login.txt"),
        "utf8",
      ).split("\n")[1];
      const response = await request("/login", "POST", { password });
      assert.equal(response.status, 200);
      cookie = response.headers.get("set-cookie")!.split(";")[0];
    }
    try {
      await launch();
      assert.equal((await request("/state")).status, 401);
      assert.equal(
        (await request("/login", "POST", { password: "wrong" })).status,
        401,
      );
      await login();
      assert.equal(
        (
          await request(
            "/servers",
            "POST",
            {},
            { Origin: "https://untrusted.example" },
          )
        ).status,
        403,
      );
      const secret = "test-only-secret-$`@";
      const created = await request("/servers", "POST", {
        name: "Test server",
        host: "192.0.2.1",
        port: 22,
        accounts: [
          {
            username: "testuser",
            alias: "test",
            password: secret,
            keyPath: "",
          },
        ],
      });
      assert.equal(created.status, 200);
      const { id } = await created.json();
      const state = await (await request("/state")).json();
      assert.equal(state.servers.length, 1);
      assert.equal(JSON.stringify(state).includes(secret), false);
      assert.equal("password" in state.servers[0].accounts[0], false);
      assert.equal(
        (await (await request("/export")).text()).includes(secret),
        false,
      );
      const accountId = state.servers[0].accounts[0].id;
      assert.equal(
        (
          await (
            await request(`/servers/${id}/accounts/${accountId}/reveal`, "POST")
          ).json()
        ).password,
        secret,
      );
      assert.equal(
        readFileSync(path.join(data, "vault.enc")).includes(
          Buffer.from(secret),
        ),
        false,
      );
      const invalid = await request("/projects", "POST", {
        serverId: id,
        name: "Bad URL",
        endpoints: [{ url: "javascript:alert(1)" }],
      });
      assert.equal(invalid.status, 400);
      assert.equal(
        (
          await request("/projects", "POST", {
            serverId: id,
            name: "Manual project",
            directory: "/srv/app",
            endpoints: [
              {
                url: "https://example.com",
                registrar: "Manual registrar",
                expiresAt: "2027-01-01",
              },
            ],
            manualMemoryMB: 42,
            manualCpuPercent: 0,
          })
        ).status,
        200,
      );
      await stop();
      cookie = "";
      await launch();
      assert.equal((await request("/state")).status, 401);
      await login();
      const restored = await (await request("/state")).json();
      assert.equal(restored.servers[0].projects[0].name, "Manual project");
      assert.equal(restored.servers[0].projects[0].memoryBytes, 42 * 1024 ** 2);
      assert.equal(restored.servers[0].projects[0].cpuPercent, 0);
      assert.equal((await request("/logout", "POST")).status, 200);
      assert.equal(
        (await request(`/servers/${id}/accounts/${accountId}/reveal`, "POST"))
          .status,
        401,
      );
    } finally {
      await stop();
      const target = path.resolve(data);
      const parent = path.resolve(tmpdir()) + path.sep;
      if (
        !target.startsWith(parent) ||
        !path.basename(target).startsWith("server-deck-test-")
      )
        throw new Error("Unexpected test directory.");
      rmSync(target, { recursive: true, force: true });
    }
  },
);
