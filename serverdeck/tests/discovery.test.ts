import { test } from "node:test";
import assert from "node:assert/strict";
import { discover } from "../server/discovery.ts";
import type { Inventory, Project } from "../src/types.ts";

function inventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    collectedAt: new Date().toISOString(),
    durationMs: 200,
    hostname: "test",
    os: "Linux",
    kernel: "6",
    cpuModel: null,
    cpuCores: 4,
    cpuPercent: 1,
    memoryTotal: 4 * 1024 ** 3,
    memoryUsed: 1024 ** 3,
    diskTotal: 40 * 1024 ** 3,
    diskUsed: 5 * 1024 ** 3,
    uptimeSeconds: 600,
    provider: null,
    region: null,
    instanceId: null,
    processes: [],
    containers: [],
    sites: [],
    listeners: [],
    capabilities: { docker: true, sockets: true, privileged: false },
    ...overrides,
  };
}
test("Compose services, private upstream ports and HTTP redirects form one project", () => {
  const data = inventory({
    containers: ["frontend", "backend", "postgres"].map((name, index) => ({
      id: name,
      name,
      image: name,
      status: "running",
      ports: index === 0 ? "127.0.0.1:18090->80/tcp" : "",
      project: "site",
      service: name,
      cwd: "/home/pp/Site",
      memoryBytes: 100 * (index + 1),
      cpuPercent: index,
    })),
    sites: [
      {
        domains: ["example.com", "www.example.com"],
        tls: false,
        upstreams: [],
        root: "/var/www/certbot",
        source: "nginx",
      },
      {
        domains: ["example.com", "www.example.com"],
        tls: true,
        upstreams: ["http://127.0.0.1:18090"],
        root: null,
        source: "nginx",
      },
    ],
  });
  const projects = discover("server", data, [], "192.0.2.1");
  assert.equal(projects.length, 1);
  assert.equal(projects[0].services.length, 3);
  assert.equal(projects[0].memoryBytes, 600);
  assert.equal(projects[0].cpuPercent, 3);
  assert.deepEqual(
    projects[0].endpoints.map((item) => item.url),
    ["https://example.com", "https://www.example.com"],
  );
});
test("frontend/backend processes share one project and missing metrics stay unknown", () => {
  const data = inventory({
    processes: [
      {
        pid: 1,
        name: "node",
        cwd: "/opt/app/frontend",
        ports: [3000],
        memoryBytes: 100,
        cpuPercent: 0,
      },
      {
        pid: 2,
        name: "uvicorn",
        cwd: "/opt/app/backend",
        ports: [8000],
        memoryBytes: 200,
        cpuPercent: null,
      },
    ],
    listeners: [
      { port: 3000, address: "127.0.0.1:3000", pids: [1] },
      { port: 8000, address: "0.0.0.0:8000", pids: [2] },
    ],
  });
  const [project] = discover("server", data, [], "192.0.2.1");
  assert.equal(project.name, "app");
  assert.equal(project.services.length, 2);
  assert.equal(project.cpuPercent, null);
  assert.equal(project.memoryBytes, 300);
  assert.deepEqual(project.endpoints, [
    { url: "http://192.0.2.1:8000", source: "port" },
  ]);
});
test("manual project details survive new samples; explicit zero remains a manual value", () => {
  const data = inventory({
    processes: [
      {
        pid: 5,
        name: "node",
        cwd: "/srv/app",
        ports: [],
        cpuPercent: 10,
        memoryBytes: 200,
      },
    ],
  });
  const [found] = discover("server", data, []);
  const saved: Project = {
    ...found,
    id: 'manual-id',
    originKey: 'manual:pre-registered',
    source: 'manual',
    name: "My project",
    description: "Custom description",
    confirmed: true,
    manualMemoryMB: 0,
    manualCpuPercent: 0,
    endpoints: [{ url: "https://example.com", source: "manual" }],
  };
  const projects = discover("server", data, [saved]);
  assert.equal(projects.length, 1);
  const [project] = projects;
  assert.equal(project.id, 'manual-id');
  assert.equal(project.name, "My project");
  assert.equal(project.memoryBytes, 0);
  assert.equal(project.cpuPercent, 0);
  assert.equal(project.metricSource, "manual");
  assert.equal(project.services[0].cpuPercent, 10);
  assert.equal(project.endpoints[0].url, "https://example.com");
});
test("no inventory does not fabricate deployments or resource metrics", () => {
  assert.deepEqual(discover("server", null, []), []);
});
