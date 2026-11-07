import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Download from "lucide-react/dist/esm/icons/download";
import LockKeyhole from "lucide-react/dist/esm/icons/lock-keyhole";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { api, ApiError, errorMessage, post, reducedMotion } from "./api";
import ServerCard from "./ServerCard";
import ServerDetail from "./ServerDetail";
import { ProjectForm, ServerForm } from "./Forms";
import { BrandMark } from "./ui";
import type { DashboardState, Project, Server } from "./types";

type Form =
  | { type: "server"; server?: Server }
  | { type: "project"; server: Server; project?: Project }
  | null;

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [state, setState] = useState<DashboardState>({
    servers: [],
    refreshing: [],
  });
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem("server-deck.selected.v1") || "";
    } catch {
      return "";
    }
  });
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(null);
  const [error, setError] = useState("");
  const latest = useRef(state);
  latest.current = state;
  const load = useCallback(async () => {
    try {
      const result = await api<DashboardState>("/state");
      setState(result);
      setError("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthenticated(false);
        setState({ servers: [], refreshing: [] });
        setOpen(null);
        setForm(null);
      } else setError(errorMessage(error));
    }
  }, []);
  useEffect(() => {
    api<{ authenticated: boolean }>("/session")
      .then((result) => setAuthenticated(result.authenticated))
      .catch((error) => {
        setError(errorMessage(error));
        setAuthenticated(false);
      });
  }, []);
  const refresh = useCallback(
    async (serverId?: string) => {
      try {
        await post("/refresh", serverId ? { serverId } : {});
        await load();
      } catch (error) {
        setError(errorMessage(error));
      }
    },
    [load],
  );
  useEffect(() => {
    if (!authenticated) return;
    void load().then(() => refresh());
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 2500);
    const collect = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      latest.current.servers
        .filter((server) => !server.snapshot.error)
        .forEach((server) => {
          void refresh(server.id);
        });
    }, 60_000);
    return () => {
      clearInterval(poll);
      clearInterval(collect);
    };
  }, [authenticated, load, refresh]);
  useEffect(() => {
    if (
      state.servers.length &&
      !state.servers.some((server) => server.id === selected)
    )
      setSelected(state.servers[0].id);
  }, [state.servers, selected]);
  useEffect(() => {
    if (selected)
      try {
        localStorage.setItem("server-deck.selected.v1", selected);
      } catch {
        /* Private browsing can disable storage. */
      }
  }, [selected]);

  async function saved(id?: string) {
    await load();
    if (id) setSelected(id);
  }
  function details(id: string) {
    setSelected(id);
    setOpen(null);
    requestAnimationFrame(() =>
      document.getElementById("server-detail")?.scrollIntoView({
        behavior: reducedMotion() ? "instant" : "smooth",
        block: "start",
      }),
    );
  }
  if (authenticated === null)
    return (
      <div className="boot-state">
        <BrandMark />
        <span>打开工作台…</span>
      </div>
    );
  if (!authenticated)
    return (
      <Login onLogin={() => setAuthenticated(true)} initialError={error} />
    );
  const current = state.servers.find((server) => server.id === selected);
  const refreshing = state.refreshing.length > 0;
  const projectCount = state.servers.reduce(
    (sum, server) => sum + server.projects.length,
    0,
  );
  const domains = new Set<string>();
  for (const server of state.servers) {
    for (const project of server.projects) {
      for (const endpoint of project.endpoints) {
        try {
          const host = new URL(endpoint.url).hostname.replace(/^www\./, "");
          if (host.includes(".") && !/^[\d.]+$/.test(host)) domains.add(host);
        } catch {
          /* Incomplete manually entered URLs do not count as domains. */
        }
      }
    }
  }
  return (
    <div className="workspace">
      <header className="topbar">
        <a
          className="brand"
          href="#servers"
          aria-label="Server Deck，回到服务器列表"
        >
          <BrandMark />
          <span>Server Deck</span>
        </a>
        <div className="topbar-actions">
          <span className="private-label">
            <LockKeyhole size={13} />
            个人工作台
          </span>
          <a
            className="icon-button export-button"
            href="/api/export"
            download="server-deck-inventory.json"
            aria-label="导出清单"
            title="导出清单"
          >
            <Download size={17} />
          </a>
          <button
            className="icon-button logout-button"
            aria-label="退出登录"
            onClick={async () => {
              await post("/logout");
              setAuthenticated(false);
              setState({ servers: [], refreshing: [] });
              setOpen(null);
              setForm(null);
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main>
        <section
          className="servers-section"
          id="servers"
          aria-labelledby="servers-title"
        >
          <div className="servers-heading">
            <div>
              <h1 id="servers-title">服务器</h1>
              <p className="overview-summary">
                <span>{state.servers.length} 台服务器</span>
                <span>{projectCount} 个部署项目</span>
                <span>{domains.size} 个域名</span>
              </p>
            </div>
            <div className="button-group">
              <button
                className="button quiet"
                onClick={() => refresh()}
                disabled={refreshing}
              >
                <RefreshCw size={15} className={refreshing ? "spinning" : ""} />
                {refreshing ? "采集中" : "刷新全部"}
              </button>
              <button
                className="button primary"
                onClick={() => setForm({ type: "server" })}
              >
                <Plus size={16} />
                添加服务器
              </button>
            </div>
          </div>
          {error ? (
            <div className="global-error" role="alert">
              {error}
              <button className="text-button" onClick={() => load()}>
                重试
              </button>
            </div>
          ) : null}
          {state.servers.length ? (
            <div className="machine-grid">
              {state.servers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  selected={selected === server.id}
                  open={open === server.id}
                  refreshing={state.refreshing.includes(server.id)}
                  onSelect={() => {
                    setSelected(server.id);
                    setOpen((value) =>
                      value === server.id ? null : server.id,
                    );
                  }}
                  onClose={() => setOpen(null)}
                  onDetails={() => details(server.id)}
                  onEdit={() => {
                    setOpen(null);
                    setForm({ type: "server", server });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-servers">
              <p>从第一台服务器开始。</p>
              <button
                className="button"
                onClick={() => setForm({ type: "server" })}
              >
                添加服务器
              </button>
            </div>
          )}
          <div className="inventory-caption">
            <span>点击卡片查看连接信息</span>
            <span>
              <span
                className={`caption-marker ${refreshing ? "is-refreshing" : ""}`}
              />
              {refreshing ? "正在更新服务器状态" : "每 60 秒自动更新"}
            </span>
          </div>
        </section>
        {current ? (
          <ServerDetail
            key={current.id}
            server={current}
            refreshing={state.refreshing.includes(current.id)}
            onRefresh={() => refresh(current.id)}
            onEdit={() => setForm({ type: "server", server: current })}
            onProject={(project) =>
              setForm({ type: "project", server: current, project })
            }
          />
        ) : null}
        <details className="data-guide">
          <summary>
            数据说明
            <ChevronDown size={14} />
          </summary>
          <div className="data-guide-content">
            <div>
              <h3>直接登记</h3>
              <p>
                IP、SSH 端口、登录账号和提供的密码。服务器别名按同一 IP 合并。
              </p>
            </div>
            <div>
              <h3>通过 SSH 采集</h3>
              <p>
                系统、CPU、内存、根分区、运行时间，以及当前账号可见的容器与应用进程。云元数据可用时补充地区和服务商。
              </p>
            </div>
            <div>
              <h3>发现后确认</h3>
              <p>
                Nginx 中的域名、Compose
                项目和部署目录。公开登记可用时自动取得注册商与到期日；端口入口仍需验证公网可达性。
              </p>
            </div>
            <div>
              <h3>人工补充</h3>
              <p>
                项目名称与用途、无法公开查询的域名登记、服务器续费与费用记录。未归属的应用可先手动登记。
              </p>
            </div>
          </div>
        </details>
      </main>
      <footer className="page-footer">
        <span>Server Deck</span>
        <span>
          <LockKeyhole size={12} />
          本地私有工作台
        </span>
      </footer>
      {form?.type === "server" ? (
        <ServerForm
          key={form.server?.id || "new"}
          server={form.server}
          onClose={() => setForm(null)}
          onSaved={saved}
        />
      ) : null}
      {form?.type === "project" ? (
        <ProjectForm
          key={form.project?.id || "new-project"}
          server={form.server}
          project={form.project}
          onClose={() => setForm(null)}
          onSaved={() => saved()}
        />
      ) : null}
    </div>
  );
}

function Login({
  onLogin,
  initialError,
}: {
  onLogin: () => void;
  initialError: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await post("/login", { password });
      setPassword("");
      onLogin();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        <BrandMark />
        <span>Server Deck</span>
      </div>
      <div className="login-panel">
        <h1>登录工作台</h1>
        <p>查看服务器资源与项目部署。</p>
        <form onSubmit={login}>
          <label>
            管理口令
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入管理口令"
            />
          </label>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <button className="button primary login-submit" disabled={busy}>
            {busy ? "正在打开…" : "打开工作台"}
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="login-footnote">
          <LockKeyhole size={12} />
          本地私有 · 凭据加密保存
        </div>
      </div>
    </main>
  );
}
