export interface Account {
  id: string;
  alias: string;
  username: string;
  hasPassword: boolean;
  hasKey: boolean;
}
export interface Endpoint {
  url: string;
  source: "nginx" | "port" | "manual";
  registrar?: string;
  expiresAt?: string;
  registration?: {
    registrar: string;
    expiresAt: string;
    checkedAt: string;
    sourceUrl: string;
  };
}
export interface Service {
  name: string;
  kind: "container" | "process";
  cpuPercent: number | null;
  memoryBytes: number | null;
  ports: number[];
}
export interface Project {
  id: string;
  serverId: string;
  originKey: string;
  name: string;
  description: string;
  directory: string;
  endpoints: Endpoint[];
  services: Service[];
  cpuPercent: number | null;
  memoryBytes: number | null;
  source: "discovered" | "manual";
  metricSource: "docker" | "process" | "mixed" | "manual" | null;
  confirmed: boolean;
  manualMemoryMB?: number;
  manualCpuPercent?: number;
  notes?: string;
}
export interface ProcessSample {
  pid: number;
  name: string;
  cwd: string;
  ports: number[];
  memoryBytes: number;
  cpuPercent: number | null;
}
export interface ContainerSample {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  project: string | null;
  service: string | null;
  cwd: string | null;
  memoryBytes: number | null;
  cpuPercent: number | null;
}
export interface Inventory {
  collectedAt: string;
  durationMs: number;
  hostname: string;
  os: string;
  kernel: string;
  cpuModel: string | null;
  cpuCores: number;
  cpuPercent: number;
  memoryTotal: number;
  memoryUsed: number;
  diskTotal: number;
  diskUsed: number;
  uptimeSeconds: number;
  provider: string | null;
  region: string | null;
  instanceId: string | null;
  processes: ProcessSample[];
  containers: ContainerSample[];
  sites: {
    domains: string[];
    tls: boolean;
    upstreams: string[];
    root: string | null;
    source: string;
  }[];
  listeners: { port: number; address: string; pids: number[] }[];
  capabilities: { docker: boolean; sockets: boolean; privileged: boolean };
}
export interface Snapshot {
  data: Inventory | null;
  lastAttempt: string | null;
  error: string | null;
  login?: string;
}
export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  provider: string;
  region: string;
  notes: string;
  expiresAt: string;
  monthlyCost: string;
  accounts: Account[];
  snapshot: Snapshot;
  projects: Project[];
}
export interface DashboardState {
  servers: Server[];
  refreshing: string[];
}
