import { useEffect, useRef, useState } from "react";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import X from "lucide-react/dist/esm/icons/x";
import Cloud from "lucide-react/dist/esm/icons/cloud";
import Check from "lucide-react/dist/esm/icons/check";
import {
  post,
  formatBytes,
  serverRegion,
  errorMessage,
  reducedMotion,
} from "./api";
import { CopyButton } from "./ui";
import type { Account, Server } from "./types";

export function status(server: Server, refreshing: boolean) {
  if (refreshing) return { label: "采集中", kind: "pending" };
  if (server.snapshot.error) return { label: "需检查", kind: "error" };
  if (!server.snapshot.data) return { label: "未检测", kind: "unknown" };
  if (
    Date.now() - new Date(server.snapshot.data.collectedAt).getTime() >
    90_000
  )
    return { label: "历史快照", kind: "unknown" };
  return { label: "已连接", kind: "online" };
}

export default function ServerCard({
  server,
  selected,
  open,
  refreshing,
  onSelect,
  onClose,
  onDetails,
  onEdit,
}: {
  server: Server;
  selected: boolean;
  open: boolean;
  refreshing: boolean;
  onSelect: () => void;
  onClose: () => void;
  onDetails: () => void;
  onEdit: () => void;
}) {
  const state = status(server, refreshing);
  const data = server.snapshot.data;
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 720px)");
    function revealSelected() {
      const card = ref.current;
      const container = card?.parentElement;
      if (!selected || !viewport.matches || !card || !container) return;
      const offset =
        card.getBoundingClientRect().left -
        container.getBoundingClientRect().left;
      container.scrollTo({
        left:
          container.scrollLeft +
          offset -
          parseFloat(getComputedStyle(container).paddingLeft),
        behavior: reducedMotion() ? "instant" : "smooth",
      });
    }
    revealSelected();
    const container = ref.current?.parentElement;
    const observer = new ResizeObserver(revealSelected);
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [selected]);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        trigger.current?.focus();
      }
      if (event.key === "Tab" && panel.current) {
        const controls = Array.from(
          panel.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled), select, a[href]",
          ),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose]);
  return (
    <div
      className={`machine-wrap ${selected ? "is-selected" : ""} ${open ? "is-open" : ""}`}
      ref={ref}
    >
      <button
        ref={trigger}
        className="machine"
        onClick={onSelect}
        aria-expanded={open}
        aria-controls={`connection-${server.id}`}
        aria-label={`${server.name}，查看连接信息`}
      >
        <div className="machine-topline">
          <span className="provider">
            <Cloud size={16} strokeWidth={1.6} />
            {data?.provider || server.provider || "服务商待补充"}
          </span>
          <span className={`machine-status ${state.kind}`}>
            <span className="status-led" />
            {state.label}
          </span>
        </div>
        <div className="machine-title">
          <h2>{server.name}</h2>
          <ArrowUpRight size={18} className="card-connect-arrow" />
        </div>
        <div className="machine-location">
          {serverRegion(data?.region || server.region)}
          <span className="small-dot">/</span>
          <span>{data?.cpuCores ? `${data.cpuCores} vCPU` : "CPU 待采集"}</span>
          <span className="small-dot">/</span>
          <span>{data ? formatBytes(data.memoryTotal) : "内存待采集"}</span>
        </div>
        <div className={`rack-unit ${state.kind}`} aria-hidden="true">
          <span className="rack-ear" />
          <span className="rack-drives">
            {Array.from({ length: 4 }, (_, i) => (
              <span className="drive" key={i}>
                <i />
                <b />
              </span>
            ))}
          </span>
          <span className="rack-vents" />
          <span className="rack-indicators">
            <i className="power-led" />
            <i className="activity-led" />
            <span className="power-ring" />
          </span>
          <span className="rack-ear" />
        </div>
        <span className="machine-address mono">
          {server.host}
          <span>SSH :{server.port}</span>
        </span>
      </button>
      <div className="machine-bottom">
        <span className="card-project-count">
          {selected ? <Check size={13} /> : null}
          {server.projects.length} 个项目
        </span>
        <button
          className="card-details"
          onClick={onDetails}
          aria-label={`查看 ${server.name} 的部署`}
        >
          查看部署
          <ArrowDown size={14} />
        </button>
      </div>
      {open ? (
        <>
          <button
            className="connection-scrim"
            onClick={onClose}
            tabIndex={-1}
            aria-label="关闭连接浮层"
          />
          <div
            ref={panel}
            className="connection-panel"
            id={`connection-${server.id}`}
            role="dialog"
            aria-label={`${server.name} 连接信息`}
          >
            <div className="connection-heading">
              <span>连接信息</span>
              <button
                className="icon-button"
                aria-label="关闭连接信息"
                onClick={() => {
                  onClose();
                  trigger.current?.focus({ preventScroll: true });
                }}
              >
                <X size={16} />
              </button>
            </div>
            <ConnectionInfo key={server.id} server={server} />
            <div className="connection-actions">
              <button className="text-button" onClick={onEdit}>
                编辑服务器
              </button>
              <button className="button primary small" onClick={onDetails}>
                查看部署 <ArrowDown size={14} />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConnectionInfo({ server }: { server: Server }) {
  const [accountId, setAccountId] = useState(server.accounts[0]?.id || "");
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const account = server.accounts.find((item) => item.id === accountId);
  const current = useRef(accountId);
  current.current = accountId;
  useEffect(() => {
    if (!password) return;
    const timer = setTimeout(() => setPassword(null), 60_000);
    return () => clearTimeout(timer);
  }, [password]);
  async function reveal() {
    if (password) {
      setPassword(null);
      return;
    }
    if (!account) return;
    setError("");
    setLoading(true);
    const requested = account.id;
    try {
      const result = await getSecret(server, account);
      if (current.current === requested) setPassword(result.password);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="connection-content">
      <div className="connection-row">
        <span>公网 IP</span>
        <span className="connection-value mono">
          {server.host}
          <CopyButton value={server.host} label="复制 IP" />
        </span>
      </div>
      <div className="connection-row">
        <span>SSH 端口</span>
        <span className="mono">{server.port}</span>
      </div>
      <label className="connection-row">
        <span>登录账号</span>
        <select
          aria-label="登录账号"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setPassword(null);
            setError("");
          }}
        >
          {server.accounts.map((item) => (
            <option value={item.id} key={item.id}>
              {item.username}
              {item.id === server.accounts[0]?.id ? " · 采集账号" : ""}
            </option>
          ))}
        </select>
      </label>
      {account ? (
        <>
          <div className="connection-row">
            <span>用户名</span>
            <span className="connection-value mono">
              {account.username}
              <CopyButton value={account.username} label="复制用户名" />
            </span>
          </div>
          <div className="connection-row password-row">
            <span>密码</span>
            <span className="connection-value mono">
              <span className="secret-value">
                {password || (account.hasPassword ? "••••••••" : "未保存")}
              </span>
              {account.hasPassword ? (
                <>
                  <button
                    className="icon-button"
                    aria-label={password ? "隐藏密码" : "显示密码"}
                    disabled={loading}
                    onClick={reveal}
                  >
                    {password ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <CopyButton
                    label="复制密码"
                    load={async () =>
                      (await getSecret(server, account)).password || ""
                    }
                  />
                </>
              ) : null}
            </span>
          </div>
          <div className="connection-note">
            {account.alias || account.username}
            <span> {account.hasKey ? "密钥优先" : "密码登录"}</span>
          </div>
          <div className="ssh-command">
            <code>
              ssh {account.username}@{server.host}
              {server.port !== 22 ? ` -p ${server.port}` : ""}
            </code>
            <CopyButton
              value={`ssh ${account.username}@${server.host}${server.port !== 22 ? ` -p ${server.port}` : ""}`}
              label="复制 SSH 命令"
            />
          </div>
        </>
      ) : (
        <p>尚未添加账号。</p>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
function getSecret(server: Server, account: Account) {
  return post<{ password: string | null }>(
    `/servers/${encodeURIComponent(server.id)}/accounts/${encodeURIComponent(account.id)}/reveal`,
  );
}
