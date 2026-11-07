import { Client } from "ssh2";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  readVault,
  writeVault,
  type PrivateServer,
  type PrivateAccount,
} from "./store.ts";
import type { Inventory } from "../src/types.ts";

const collector = await readFile(
  path.join(process.cwd(), "server/collector.py"),
  "utf8",
);
function resolveKey(value: string) {
  return value.startsWith("~/") ? path.join(homedir(), value.slice(2)) : value;
}

async function collectWith(
  server: PrivateServer,
  account: PrivateAccount,
  method: "key" | "password",
): Promise<Inventory> {
  const privateKey =
    method === "key" && account.keyPath
      ? await readFile(resolveKey(account.keyPath))
      : undefined;
  return new Promise((resolve, reject) => {
    const connection = new Client();
    let finished = false;
    let encounteredKey = "";
    const timer = setTimeout(
      () => finish(new Error("连接或采集超时，请稍后手动刷新。")),
      45_000,
    );
    const finish = (error?: Error, result?: Inventory) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      connection.end();
      if (error) reject(error);
      else resolve(result!);
    };
    connection.on("error", (error) => finish(error));
    connection.on("close", () => {
      if (!finished) finish(new Error("SSH 连接提前关闭。"));
    });
    connection.on("ready", () => {
      if (!server.hostKeys.length && encounteredKey) {
        const vault = readVault();
        const stored = vault.servers.find((item) => item.id === server.id);
        if (stored) {
          stored.hostKeys = [encounteredKey];
          writeVault(vault);
        }
      }
      connection.exec("python3 -", (error, stream) => {
        if (error) return finish(error);
        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (output.length > 2_000_000)
            finish(new Error("服务器返回的数据过大。"));
        });
        // Stderr can contain remote file contents or private paths; never log it.
        stream.stderr.resume();
        stream.on("close", (code: number) => {
          try {
            const result = JSON.parse(output);
            if (code !== 0 || result.error || !result.collectedAt)
              return finish(
                new Error("远端采集未完成，请检查 Python 3 和账号权限。"),
              );
            finish(undefined, result as Inventory);
          } catch {
            finish(
              new Error("无法读取远端指标，请确认服务器安装了 Python 3。"),
            );
          }
        });
        stream.end(collector);
      });
    });
    connection.connect({
      host: server.host,
      port: server.port,
      username: account.username,
      privateKey,
      password: method === "password" ? account.password : undefined,
      readyTimeout: 12_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 2,
      hostVerifier: (key: Buffer) => {
        encounteredKey = createHash("sha256").update(key).digest("hex");
        return (
          !server.hostKeys.length || server.hostKeys.includes(encounteredKey)
        );
      },
    });
  });
}

export async function collectServer(server: PrivateServer) {
  // Use one configured account. Repeatedly trying every username can trigger login lockouts.
  const account = server.accounts[0];
  if (!account) throw new Error("请先添加 SSH 登录账号。");
  if (account.keyPath) {
    try {
      return {
        data: await collectWith(server, account, "key"),
        login: account.username,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        !/All configured authentication methods failed|ENOENT|privateKey|encrypted/i.test(
          message,
        ) ||
        !account.password
      )
        throw explain(error);
    }
  }
  if (!account.password)
    throw new Error("密钥登录未通过，请检查密钥或补充密码。");
  try {
    return {
      data: await collectWith(server, account, "password"),
      login: account.username,
    };
  } catch (error) {
    throw explain(error);
  }
}
function explain(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/authentication|auth.*fail/i.test(message))
    return new Error(
      "登录认证未通过；已保留资源信息，请核对当前采集账号或密码。",
    );
  if (/host.*verif|fingerprint/i.test(message))
    return new Error("SSH 主机指纹与已保存记录不一致，连接已停止。");
  if (/ECONNREFUSED/.test(message))
    return new Error("SSH 端口拒绝连接，请检查端口和防火墙。");
  if (/ETIMEDOUT|Timed out|ENETUNREACH/.test(message))
    return new Error("SSH 连接超时，请检查服务器网络和访问规则。");
  if (/ENOENT/.test(message))
    return new Error("本机找不到配置的 SSH 密钥文件。");
  return new Error("SSH 暂时无法完成采集，请检查连接后手动刷新。");
}
