import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { local } from "./store.ts";
import type { Project } from "../src/types.ts";

interface Registration {
  domain: string;
  registrar: string;
  expiresAt: string;
  checkedAt: string;
  sourceUrl: string;
  error?: string;
}
const file = path.join(local, "registrations.json");
let records: Record<string, Registration> = {};
try {
  if (existsSync(file)) records = JSON.parse(readFileSync(file, "utf8"));
} catch {
  /* This cache can be rebuilt. */
}
const pending = new Set<string>();
type Bootstrap = { services: [string[], string[]][] };
let bootstrap: Promise<Bootstrap> | undefined;
const bootstrapFile = path.join(local, "rdap-bootstrap.json");

function domain(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return !isIP(host) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}
async function registry(domain: string) {
  // Verified registry endpoint; no intermediary redirect or credentials required.
  if (domain.endsWith(".cyou")) return "https://rdap.centralnic.com/cyou/";
  bootstrap ??= (async () => {
    if (existsSync(bootstrapFile))
      return JSON.parse(readFileSync(bootstrapFile, "utf8")) as Bootstrap;
    const response = await fetch("https://data.iana.org/rdap/dns.json", {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("注册局目录暂不可用");
    const data = (await response.json()) as Bootstrap;
    if (!Array.isArray(data.services)) throw new Error("注册局目录格式未知");
    writeFileSync(bootstrapFile, JSON.stringify(data), { mode: 0o600 });
    return data;
  })().catch((error) => {
    bootstrap = undefined;
    throw error;
  });
  const data = await bootstrap;
  return (
    data.services
      .find(([tlds]) => tlds.includes(domain.split(".").pop()!))?.[1]
      .find((url) => url.startsWith("https://")) || null
  );
}

export function withRegistrations(project: Project): Project {
  return {
    ...project,
    endpoints: project.endpoints.map((endpoint) => {
      const name = domain(endpoint.url);
      const record = name ? records[name] : undefined;
      if (!record || record.error) return endpoint;
      return {
        ...endpoint,
        registration: {
          registrar: record.registrar,
          expiresAt: record.expiresAt,
          checkedAt: record.checkedAt,
          sourceUrl: record.sourceUrl,
        },
      };
    }),
  };
}

export async function refreshRegistrations(projects: Project[]) {
  if (process.env.SERVER_DECK_DISABLE_RDAP === "1") return;
  const names = [
    ...new Set(
      projects
        .flatMap((project) =>
          project.endpoints.map((endpoint) => domain(endpoint.url)),
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  await Promise.all(
    names.map(async (name) => {
      const existing = records[name];
      const ttl = existing?.error ? 60 * 60_000 : 24 * 60 * 60_000;
      if (
        pending.has(name) ||
        (existing && Date.now() - new Date(existing.checkedAt).getTime() < ttl)
      )
        return;
      pending.add(name);
      const record: Registration = {
        domain: name,
        registrar: "",
        expiresAt: "",
        checkedAt: new Date().toISOString(),
        sourceUrl: "",
      };
      try {
        const base = await registry(name);
        if (!base) throw new Error("注册局尚未提供可用的 RDAP 服务");
        record.sourceUrl =
          base.replace(/\/?$/, "/") + "domain/" + encodeURIComponent(name);
        const response = await fetch(record.sourceUrl, {
          headers: { Accept: "application/rdap+json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("公开登记查询暂未取得结果");
        const data = (await response.json()) as {
          ldhName?: string;
          events?: { eventAction: string; eventDate: string }[];
          entities?: { roles?: string[]; vcardArray?: [string, unknown[][]] }[];
        };
        if (data.ldhName?.toLowerCase() !== name)
          throw new Error("登记结果与域名不一致");
        const registrar = data.entities
          ?.filter((entity) => entity.roles?.includes("registrar"))
          .flatMap((entity) => entity.vcardArray?.[1] || [])
          .find((row) => row[0] === "fn")?.[3];
        record.registrar =
          typeof registrar === "string" ? registrar.slice(0, 300) : "";
        const expiry = data.events?.find(
          (event) => event.eventAction === "expiration",
        )?.eventDate;
        record.expiresAt =
          expiry && Number.isFinite(Date.parse(expiry)) ? expiry : "";
        if (!record.registrar && !record.expiresAt)
          throw new Error("公开登记中未提供这些字段");
      } catch (error) {
        record.error =
          error instanceof Error ? error.message : "公开登记暂不可用";
      } finally {
        records[name] = record;
        const temp = file + ".tmp";
        writeFileSync(temp, JSON.stringify(records), { mode: 0o600 });
        renameSync(temp, file);
        pending.delete(name);
      }
    }),
  );
}
