import { useState, type FormEvent } from "react";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { Dialog } from "./ui";
import { api, errorMessage, post } from "./api";
import type { Project, Server } from "./types";

type AccountInput = {
  id: string;
  username: string;
  alias: string;
  password: string;
  keyPath: string;
};
export function ServerForm({
  server,
  onClose,
  onSaved,
}: {
  server?: Server;
  onClose: () => void;
  onSaved: (id?: string) => Promise<void>;
}) {
  const [values, setValues] = useState({
    name: server?.name || "",
    host: server?.host || "",
    port: String(server?.port || 22),
    provider: server?.provider || "",
    region: server?.region || "",
    expiresAt: server?.expiresAt || "",
    monthlyCost: server?.monthlyCost || "",
    notes: server?.notes || "",
  });
  const [accounts, setAccounts] = useState<AccountInput[]>(
    server?.accounts.map((account) => ({
      id: account.id,
      username: account.username,
      alias: account.alias,
      password: "",
      keyPath: "",
    })) || [
      {
        id: crypto.randomUUID(),
        username: "",
        alias: "",
        password: "",
        keyPath: "~/.ssh/id_ed25519",
      },
    ],
  );
  const [primary, setPrimary] = useState(accounts[0]?.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setValues((v) => ({ ...v, [key]: event.target.value })),
  });
  function updateAccount(id: string, key: keyof AccountInput, value: string) {
    setAccounts((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await post<{ id: string }>("/servers", {
        ...values,
        id: server?.id,
        accounts: [...accounts].sort(
          (a, b) => Number(b.id === primary) - Number(a.id === primary),
        ),
      });
      await onSaved(result.id);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={server ? "编辑服务器" : "添加服务器"}
      subtitle="一张卡片对应一台机器，登录账号归在同一处。"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-content">
          <div className="form-grid">
            <label>
              服务器名称
              <input
                autoFocus
                required
                maxLength={100}
                placeholder="例如 Learn2AI"
                {...field("name")}
              />
            </label>
            <label>
              公网 IP / 主机地址
              <input
                required
                placeholder="例如 47.79.122.59"
                {...field("host")}
              />
            </label>
            <label>
              服务商
              <input
                placeholder="阿里云 / 腾讯云 / 其他"
                {...field("provider")}
              />
            </label>
            <label>
              SSH 端口
              <input
                type="number"
                min={1}
                max={65535}
                required
                {...field("port")}
              />
            </label>
          </div>
          <div className="form-section-heading">
            <h3>登录账号</h3>
            <button
              type="button"
              className="text-button"
              disabled={accounts.length >= 8}
              onClick={() =>
                setAccounts((rows) => [
                  ...rows,
                  {
                    id: crypto.randomUUID(),
                    username: "",
                    alias: "",
                    password: "",
                    keyPath: "",
                  },
                ])
              }
            >
              <Plus size={14} />
              添加账号
            </button>
          </div>
          {accounts.map((account) => (
            <fieldset className="account-fields" key={account.id}>
              <div className="account-heading">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="primaryAccount"
                    checked={primary === account.id}
                    onChange={() => setPrimary(account.id)}
                  />
                  用于指标采集
                </label>
                {accounts.length > 1 ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`移除账号 ${account.username || "未命名"}`}
                    onClick={() => {
                      setAccounts((rows) =>
                        rows.filter((row) => row.id !== account.id),
                      );
                      if (primary === account.id)
                        setPrimary(
                          accounts.find((row) => row.id !== account.id)?.id ||
                            "",
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
              <div className="form-grid">
                <label>
                  用户名
                  <input
                    required
                    autoComplete="off"
                    value={account.username}
                    onChange={(event) =>
                      updateAccount(account.id, "username", event.target.value)
                    }
                    placeholder="pp / root / ubuntu"
                  />
                </label>
                <label>
                  SSH 别名
                  <input
                    value={account.alias}
                    onChange={(event) =>
                      updateAccount(account.id, "alias", event.target.value)
                    }
                    placeholder="例如 learn2ai"
                  />
                </label>
                <label>
                  登录密码
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={account.password}
                    onChange={(event) =>
                      updateAccount(account.id, "password", event.target.value)
                    }
                    placeholder={
                      server ? "留空保留原密码" : "密码或密钥至少填写一项"
                    }
                  />
                </label>
                <label>
                  本机密钥路径
                  <input
                    value={account.keyPath}
                    onChange={(event) =>
                      updateAccount(account.id, "keyPath", event.target.value)
                    }
                    placeholder={
                      server ? "留空保留原密钥" : "~/.ssh/id_ed25519"
                    }
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <details className="form-optional">
            <summary>
              补充信息 <span>地区、续费与备注</span>
            </summary>
            <div className="form-grid">
              <label>
                地区
                <input placeholder="留空时使用采集结果" {...field("region")} />
              </label>
              <label>
                续费日期
                <input type="date" {...field("expiresAt")} />
              </label>
              <label className="full-width">
                费用记录
                <input
                  placeholder="例如 ¥99 / 年，或 $5 / 月"
                  {...field("monthlyCost")}
                />
              </label>
              <label className="full-width">
                备注
                <textarea rows={2} {...field("notes")} />
              </label>
            </div>
          </details>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {confirmDelete ? (
            <div className="delete-confirm">
              <p>
                删除这台服务器的本地记录和项目关联？服务器上的内容不受影响。
              </p>
              <button
                type="button"
                className="button danger small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/servers/${server?.id}`, { method: "DELETE" });
                    await onSaved();
                    onClose();
                  } catch (error) {
                    setError(errorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                确认删除记录
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setConfirmDelete(false)}
              >
                保留
              </button>
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          {server ? (
            <button
              type="button"
              className="text-button danger-text"
              onClick={() => setConfirmDelete(true)}
            >
              删除记录
            </button>
          ) : (
            <span />
          )}
          <div className="button-group">
            <button type="button" className="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "保存中…" : "保存服务器"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function ProjectForm({
  server,
  project,
  onClose,
  onSaved,
}: {
  server: Server;
  project?: Project;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState({
    name: project?.name || "",
    description: project?.description || "",
    directory: project?.directory || "",
    urls: project?.endpoints.map((endpoint) => endpoint.url).join("\n") || "",
    registrar: project?.endpoints[0]?.registrar || "",
    expiresAt: project?.endpoints[0]?.expiresAt || "",
    manualMemoryMB:
      project?.manualMemoryMB === undefined
        ? ""
        : String(project.manualMemoryMB),
    manualCpuPercent:
      project?.manualCpuPercent === undefined
        ? ""
        : String(project.manualCpuPercent),
    notes: project?.notes || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setValues((v) => ({ ...v, [key]: event.target.value })),
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoints = values.urls
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url, index) => ({
          ...project?.endpoints.find((endpoint) => endpoint.url === url),
          url,
          ...(index === 0
            ? { registrar: values.registrar, expiresAt: values.expiresAt }
            : {}),
        }));
      await post("/projects", {
        ...values,
        id: project?.id,
        serverId: server.id,
        endpoints,
      });
      await onSaved();
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={project ? "整理项目" : "添加项目"}
      subtitle={`${server.name} · 前端、后端与多个入口归在同一个项目下。`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-content">
          <div className="form-grid">
            <label className="full-width">
              项目名称
              <input
                autoFocus
                required
                {...field("name")}
                placeholder="给项目一个容易辨认的名字"
              />
            </label>
            <label className="full-width">
              用途简介
              <input
                {...field("description")}
                placeholder="一句话说明它是做什么的"
              />
            </label>
            <label className="full-width">
              访问地址
              <textarea
                rows={3}
                {...field("urls")}
                placeholder={"https://example.com\nhttp://服务器IP:端口"}
              />
              <span className="field-hint">
                每行一个地址，第一行作为主入口。
              </span>
            </label>
            <label className="full-width">
              部署目录
              <input
                {...field("directory")}
                placeholder="例如 /home/pp/Impromptu"
              />
            </label>
          </div>
          <details className="form-optional">
            <summary>
              补充信息 <span>主域名登记、手工指标与备注</span>
            </summary>
            <div className="form-grid">
              <label>
                主域名注册商
                <input {...field("registrar")} placeholder="人工登记" />
              </label>
              <label>
                主域名到期日
                <input type="date" {...field("expiresAt")} />
              </label>
              <label>
                内存记录 / MB
                <input
                  type="number"
                  min={0}
                  step="any"
                  {...field("manualMemoryMB")}
                  placeholder="留空使用采集值"
                />
              </label>
              <label>
                CPU 记录 / %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  {...field("manualCpuPercent")}
                  placeholder="留空使用采集值"
                />
              </label>
              <p className="field-hint full-width">
                手工指标会明确标记为「手工记录」，清空后恢复使用采集值。
              </p>
              <label className="full-width">
                备注
                <textarea rows={3} {...field("notes")} />
              </label>
            </div>
          </details>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {confirmDelete ? (
            <div className="delete-confirm">
              <p>
                {project?.source === "discovered"
                  ? "清除人工整理的信息后，将恢复自动发现的项目记录。"
                  : "删除此项目的本地记录？服务器上的内容不受影响。"}
              </p>
              <button
                type="button"
                className="button danger small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/projects/${project?.id}`, { method: "DELETE" });
                    await onSaved();
                    onClose();
                  } catch (error) {
                    setError(errorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                确认清除
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setConfirmDelete(false)}
              >
                保留
              </button>
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          {project?.confirmed ? (
            <button
              type="button"
              className="text-button danger-text"
              onClick={() => setConfirmDelete(true)}
            >
              清除人工记录
            </button>
          ) : (
            <span />
          )}
          <div className="button-group">
            <button type="button" className="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary" disabled={busy}>
              {busy
                ? "保存中…"
                : project?.confirmed
                  ? "保存项目"
                  : "保存并确认"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
