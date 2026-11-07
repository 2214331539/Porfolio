import { createHash } from "node:crypto";
import type { Inventory, Project, Endpoint } from "../src/types.ts";

export function baseDirectory(value: string) {
  let result = value.replace(/\/+$/, "");
  while (/\/(backend|frontend|server|client|api|web|dist|build)$/i.test(result))
    result = result.replace(/\/[^/]+$/, "");
  return result;
}
function projectName(directory: string, fallback: string) {
  const parts = directory.split("/").filter(Boolean);
  const leaf = parts.at(-1) || fallback;
  if (/^(current|latest|release|dist|build)$/i.test(leaf) && parts.length > 1)
    return parts.at(-2) || fallback;
  return leaf;
}
function identifier(serverId: string, origin: string) {
  return createHash("sha256")
    .update(serverId + ":" + origin)
    .digest("hex")
    .slice(0, 18);
}
function mergeEndpoints(current: Endpoint[], additional: Endpoint[]) {
  const result = new Map(current.map((endpoint) => [endpoint.url, endpoint]));
  for (const endpoint of additional) result.set(endpoint.url, endpoint);
  return [...result.values()];
}

export function discover(
  serverId: string,
  data: Inventory | null,
  saved: Project[],
  host = "",
): Project[] {
  const groups = new Map<string, Project>();
  const group = (key: string, name: string, directory: string) => {
    if (!groups.has(key))
      groups.set(key, {
        id: identifier(serverId, key),
        serverId,
        originKey: key,
        name,
        description: "",
        directory,
        endpoints: [],
        services: [],
        cpuPercent: null,
        memoryBytes: null,
        source: "discovered",
        metricSource: null,
        confirmed: false,
      });
    return groups.get(key)!;
  };
  for (const container of data?.containers ?? []) {
    const directory = container.cwd ? baseDirectory(container.cwd) : "";
    const key =
      directory || "container:" + (container.project || container.name);
    const project = group(
      key,
      projectName(directory, container.project || container.name),
      directory,
    );
    const ports = [
      ...container.ports.matchAll(
        /(?:\d+\.\d+\.\d+\.\d+|\[::\]|::):([0-9]+)->/g,
      ),
    ].map((match) => Number(match[1]));
    project.services.push({
      name: container.service || container.name,
      kind: "container",
      memoryBytes: container.memoryBytes,
      cpuPercent: container.cpuPercent,
      ports: [...new Set(ports)],
    });
  }
  for (const process of data?.processes ?? []) {
    const directory = baseDirectory(process.cwd);
    if (!directory || (directory === "/root" && !process.ports.length))
      continue;
    const project = group(
      directory,
      projectName(directory, process.name),
      directory,
    );
    project.services.push({
      name: `${process.name} · ${process.pid}`,
      kind: "process",
      memoryBytes: process.memoryBytes,
      cpuPercent: process.cpuPercent,
      ports: process.ports,
    });
  }
  for (const site of [...(data?.sites ?? [])].sort(
    (a, b) => Number(b.tls) - Number(a.tls),
  )) {
    const ports = site.upstreams.flatMap((upstream) => {
      try {
        const url = new URL(upstream);
        return [Number(url.port || (url.protocol === "https:" ? 443 : 80))];
      } catch {
        return [];
      }
    });
    let match = [...groups.values()].find((project) =>
      project.services.some((service) =>
        service.ports.some((port) => ports.includes(port)),
      ),
    );
    // HTTP redirect and certificate challenge blocks belong to the same site's TLS block.
    if (!match)
      match = [...groups.values()].find((project) =>
        project.endpoints.some((endpoint) =>
          site.domains.includes(new URL(endpoint.url).hostname),
        ),
      );
    if (
      !match &&
      (site.upstreams.length ||
        (site.root && !/letsencrypt|acme|certbot/.test(site.root)))
    ) {
      const directory = site.root ? baseDirectory(site.root) : "";
      const key =
        directory && !/letsencrypt|acme/.test(directory)
          ? directory
          : "site:" + site.domains[0].replace(/^www\./, "");
      match = group(key, site.domains[0].replace(/^www\./, ""), directory);
    }
    if (match)
      match.endpoints = mergeEndpoints(
        match.endpoints,
        site.domains.map((domain) => ({
          url: `${site.tls ? "https" : "http"}://${domain}`,
          source: "nginx" as const,
        })),
      );
  }
  const automatic = [...groups.values()].map((project) => {
    const values = project.services;
    const sum = (field: "memoryBytes" | "cpuPercent") =>
      values.length && values.every((service) => service[field] !== null)
        ? values.reduce((total, service) => total + (service[field] ?? 0), 0)
        : null;
    project.memoryBytes = sum("memoryBytes");
    project.cpuPercent = sum("cpuPercent");
    project.metricSource = values.length
      ? values.every((v) => v.kind === "container")
        ? "docker"
        : values.every((v) => v.kind === "process")
          ? "process"
          : "mixed"
      : null;
    if (!project.endpoints.length && host) {
      const ports = [
        ...new Set(
          project.services
            .filter(
              (service) =>
                !/postgres|redis|mysql|maria|mongo|database/i.test(
                  service.name,
                ),
            )
            .flatMap((service) => service.ports),
        ),
      ];
      const published = ports.filter((port) =>
        data?.listeners.some(
          (listener) =>
            listener.port === port &&
            /^(0\.0\.0\.0|\[::\]|\*|::):/.test(listener.address),
        ),
      );
      project.endpoints = published.map((port) => ({
        url: `http://${host}:${port}`,
        source: "port" as const,
      }));
    }
    // Prefer HTTPS for each hostname instead of creating duplicate entries for redirects.
    project.endpoints = project.endpoints.filter(
      (endpoint) =>
        !endpoint.url.startsWith("http:") ||
        !project.endpoints.some(
          (other) => other.url === endpoint.url.replace("http:", "https:"),
        ),
    );
    const edit = saved.find(
      (item) =>
        item.serverId === serverId &&
        (item.originKey === project.originKey ||
          Boolean(
            item.directory &&
              project.directory &&
              baseDirectory(item.directory) === project.directory,
          )),
    );
    if (!edit) return project;
    return {
      ...project,
      ...edit,
      services: project.services,
      memoryBytes:
        edit.manualMemoryMB !== undefined
          ? edit.manualMemoryMB * 1024 ** 2
          : project.memoryBytes,
      cpuPercent:
        edit.manualCpuPercent !== undefined
          ? edit.manualCpuPercent
          : project.cpuPercent,
      metricSource:
        edit.manualMemoryMB !== undefined || edit.manualCpuPercent !== undefined
          ? ("manual" as const)
          : project.metricSource,
      endpoints: edit.endpoints,
    };
  });
  const remaining = saved.filter(
    (item) =>
      item.serverId === serverId &&
      !automatic.some((project) => project.originKey === item.originKey),
  );
  return [
    ...automatic,
    ...remaining.map((item) => ({
      ...item,
      services: [],
      memoryBytes:
        item.manualMemoryMB !== undefined
          ? item.manualMemoryMB * 1024 ** 2
          : null,
      cpuPercent: item.manualCpuPercent ?? null,
      metricSource:
        item.manualMemoryMB !== undefined || item.manualCpuPercent !== undefined
          ? ("manual" as const)
          : null,
    })),
  ].sort(
    (a, b) =>
      Number(b.confirmed) - Number(a.confirmed) || a.name.localeCompare(b.name),
  );
}
