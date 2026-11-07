import { useState } from "react";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import Folder from "lucide-react/dist/esm/icons/folder";
import {
  address,
  formatBytes,
  formatTime,
  reducedMotion,
  serverRegion,
} from "./api";
import { CopyButton, Meter } from "./ui";
import { formatDate } from "./api";
import type { Endpoint, Project, Server } from "./types";

export default function ServerDetail({
  server,
  refreshing,
  onRefresh,
  onEdit,
  onProject,
}: {
  server: Server;
  refreshing: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onProject: (project?: Project) => void;
}) {
  const data = server.snapshot.data;
  const stale =
    !data ||
    Date.now() - new Date(data.collectedAt).getTime() > 90_000 ||
    Boolean(server.snapshot.error);
  return (
    <section
      className="server-detail"
      id="server-detail"
      aria-labelledby="detail-title"
    >
      <div className="section-kicker">
        <span>部署详情</span>
        <button
          className="text-button"
          onClick={() =>
            document.getElementById("servers")?.scrollIntoView({
              behavior: reducedMotion() ? "instant" : "smooth",
            })
          }
        >
          服务器列表 <ArrowUp size={14} />
        </button>
      </div>
      <div className="detail-title-row">
        <div>
          <h2 id="detail-title">{server.name}</h2>
          <div className="detail-meta">
            <span>{data?.provider || server.provider}</span>
            <span>{serverRegion(data?.region || server.region)}</span>
            <span className="mono">{server.host}</span>
            <span>{data?.os || "系统待采集"}</span>
          </div>
        </div>
        <button className="button small" onClick={onEdit}>
          管理服务器
        </button>
      </div>
      {server.snapshot.error ? (
        <div className="connection-error" role="status">
          <span>
            {server.snapshot.error}
            {data ? " 当前保留上次采集的数据。" : ""}
          </span>
          <button
            className="text-button"
            disabled={refreshing}
            onClick={onRefresh}
          >
            重试
          </button>
        </div>
      ) : null}
      <div className="metrics-strip">
        <Meter
          label="CPU 占用"
          value={data ? `${data.cpuPercent.toFixed(1)}%` : "—"}
          percent={data?.cpuPercent ?? null}
          detail={data ? `${data.cpuCores} vCPU · 总容量` : "等待首次采集"}
        />
        <Meter
          label="内存使用"
          value={formatBytes(data?.memoryUsed)}
          percent={data ? (data.memoryUsed / data.memoryTotal) * 100 : null}
          detail={data ? `共 ${formatBytes(data.memoryTotal)}` : "等待首次采集"}
        />
        <Meter
          label="磁盘使用"
          value={formatBytes(data?.diskUsed)}
          percent={data ? (data.diskUsed / data.diskTotal) * 100 : null}
          detail={
            data ? `共 ${formatBytes(data.diskTotal)} · /` : "等待首次采集"
          }
        />
      </div>
      <div className="snapshot-line">
        <span className={`snapshot-dot ${stale ? "stale" : ""}`} />
        <span>
          {data
            ? `${stale ? "快照采集于" : "采集于"} ${formatTime(data.collectedAt)}`
            : "尚未采集"}
          {server.snapshot.login ? ` · 账号 ${server.snapshot.login}` : ""}
        </span>
        {data ? (
          <span className="uptime">
            连续运行 {Math.floor(data.uptimeSeconds / 86400)} 天{" "}
            {Math.floor((data.uptimeSeconds % 86400) / 3600)} 小时
          </span>
        ) : null}
        <button
          className="text-button refresh-link"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw size={13} className={refreshing ? "spinning" : ""} />
          {refreshing ? "采集中" : "刷新"}
        </button>
      </div>
      {server.notes || server.expiresAt || server.monthlyCost ? (
        <div className="server-notes">
          {server.expiresAt ? (
            <span>
              续费日期 <strong>{server.expiresAt}</strong>
            </span>
          ) : null}
          {server.monthlyCost ? (
            <span>
              费用记录 <strong>{server.monthlyCost}</strong>
            </span>
          ) : null}
          {server.notes ? <p>{server.notes}</p> : null}
        </div>
      ) : null}
      <div className="projects-heading">
        <h3>
          部署项目 <span className="count">{server.projects.length}</span>
        </h3>
        <button className="text-button" onClick={() => onProject()}>
          <Plus size={15} />
          添加项目
        </button>
      </div>
      {server.projects.length ? (
        <ProjectList projects={server.projects} onProject={onProject} />
      ) : (
        <div className="empty-projects">
          <FolderOpen size={27} strokeWidth={1.25} />
          <h3>这里还没有项目记录</h3>
          <p>
            {data
              ? "当前账号可见范围内，暂未识别到运行中的应用。可以手动补充部署关系。"
              : "连接服务器后发现应用，或先手动登记一个项目。"}
          </p>
          <button className="button small" onClick={() => onProject()}>
            添加第一个项目
          </button>
        </div>
      )}
      <div className="detail-footnote">
        <span>CPU 按整机归一 · 进程内存为 RSS 估算 · 未采集值显示为 —</span>
        <span>
          {data?.capabilities.privileged ? "完整账号视角" : "当前账号视角"}
        </span>
      </div>
    </section>
  );
}

function RegistrationDetail({ endpoint }: { endpoint: Endpoint }) {
  const registrar = endpoint.registrar || endpoint.registration?.registrar;
  const expiry = endpoint.expiresAt || endpoint.registration?.expiresAt;
  if (!registrar && !expiry) return null;
  return (
    <span className="registration-detail">
      {registrar ? <span>注册商 {registrar}</span> : null}
      {expiry ? <span>到期 {formatDate(expiry)}</span> : null}
      <span className="registration-source">
        {endpoint.registrar || endpoint.expiresAt
          ? "含人工补充"
          : "RDAP 公开登记"}
        {endpoint.registration ? (
          <a
            href={endpoint.registration.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            查询来源 <ArrowUpRight size={10} />
          </a>
        ) : null}
      </span>
    </span>
  );
}

function ProjectList({
  projects,
  onProject,
}: {
  projects: Project[];
  onProject: (project: Project) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  function toggle(id: string) {
    setExpanded((value) => (value === id ? null : id));
  }
  return (
    <div className="project-table-wrap">
      <table className="project-table">
        <thead>
          <tr>
            <th>项目</th>
            <th>访问入口</th>
            <th>内存使用</th>
            <th>CPU 占用</th>
            <th>
              <span className="sr-only">详情</span>
            </th>
          </tr>
        </thead>
        {projects.map((project) => (
          <tbody
            key={project.id}
            className={expanded === project.id ? "project-expanded" : ""}
          >
            <tr
              className="project-row"
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest("button,a"))
                  toggle(project.id);
              }}
            >
              <td className="project-cell">
                <div className="project-identity">
                  <span className="project-icon" aria-hidden="true">
                    <Folder size={19} strokeWidth={1.5} />
                  </span>
                  <div>
                    <button
                      className="project-name"
                      onClick={() => toggle(project.id)}
                      aria-expanded={expanded === project.id}
                      aria-controls={`project-${project.id}`}
                    >
                      {project.name}
                    </button>
                    <span className="project-subtitle">
                      {project.description ||
                        (project.services.length
                          ? `${project.services.length} 个服务`
                          : "部署记录")}
                      {!project.confirmed ? (
                        <span className="unconfirmed">待确认</span>
                      ) : null}
                    </span>
                  </div>
                </div>
              </td>
              <td className="endpoint-cell">
                {project.endpoints[0] ? (
                  <>
                    <a
                      href={project.endpoints[0].url}
                      target="_blank"
                      rel="noreferrer"
                      className="endpoint-link"
                    >
                      {address(project.endpoints[0].url)}
                      <ArrowUpRight size={13} />
                    </a>
                    <span className="endpoint-note">
                      {project.endpoints[0].source === "port"
                        ? "端口推断 · 访问待验证"
                        : project.endpoints[0].source === "nginx"
                          ? "Nginx 配置"
                          : "人工登记"}
                      {project.endpoints.length > 1
                        ? ` · 另有 ${project.endpoints.length - 1} 个入口`
                        : ""}
                    </span>
                  </>
                ) : (
                  <button
                    className="text-button muted-button"
                    onClick={() => onProject(project)}
                  >
                    补充访问地址 <Plus size={12} />
                  </button>
                )}
              </td>
              <td data-label="内存" className="metric-cell">
                <span className="numeric">
                  {formatBytes(project.memoryBytes)}
                </span>
                {project.manualMemoryMB !== undefined ? (
                  <span className="metric-source">手工记录</span>
                ) : null}
              </td>
              <td data-label="CPU" className="metric-cell">
                <span className="numeric">
                  {project.cpuPercent === null
                    ? "—"
                    : `${project.cpuPercent.toFixed(2)}%`}
                </span>
                {project.manualCpuPercent !== undefined ? (
                  <span className="metric-source">手工记录</span>
                ) : null}
              </td>
              <td className="expand-cell">
                <button
                  className="icon-button"
                  aria-label={`${expanded === project.id ? "收起" : "展开"} ${project.name}`}
                  onClick={() => toggle(project.id)}
                  aria-expanded={expanded === project.id}
                >
                  <ChevronDown
                    size={17}
                    className={expanded === project.id ? "rotated" : ""}
                  />
                </button>
              </td>
            </tr>
            {expanded === project.id ? (
              <tr className="project-detail-row" id={`project-${project.id}`}>
                <td colSpan={5}>
                  <div className="project-detail-content">
                    <div className="project-detail-heading">
                      <span>
                        {project.source === "discovered"
                          ? "自动发现的部署"
                          : "人工登记的部署"}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => onProject(project)}
                      >
                        {project.confirmed ? "编辑项目" : "整理并确认"}
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                    {project.directory ? (
                      <div className="directory-line">
                        <span>部署目录</span>
                        <code>{project.directory}</code>
                        <CopyButton
                          value={project.directory}
                          label="复制部署目录"
                        />
                      </div>
                    ) : null}
                    {project.services.length ? (
                      <div className="service-list">
                        {project.services.map((service, index) => (
                          <div
                            className="service-row"
                            key={`${service.name}-${index}`}
                          >
                            <span className="service-name">
                              <span className="service-mark" />
                              {service.name}
                              <span className="service-kind">
                                {service.kind === "container" ? "容器" : "进程"}
                              </span>
                            </span>
                            <span className="numeric">
                              {formatBytes(service.memoryBytes)}
                            </span>
                            <span className="numeric">
                              {service.cpuPercent === null
                                ? "—"
                                : `${service.cpuPercent.toFixed(2)}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-services">
                        尚未关联可采集的进程或容器。
                      </p>
                    )}
                    {project.endpoints.length ? (
                      <div className="all-endpoints">
                        {project.endpoints.map((endpoint, endpointIndex) => (
                          <div key={endpoint.url} className="full-endpoint">
                            <a
                              href={endpoint.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {endpoint.url}
                              <ArrowUpRight size={12} />
                            </a>
                            <CopyButton
                              value={endpoint.url}
                              label="复制访问链接"
                            />
                            {!endpoint.registration ||
                            endpoint.registrar ||
                            endpoint.expiresAt ||
                            project.endpoints.findIndex(
                              (item) =>
                                item.registration?.sourceUrl ===
                                endpoint.registration?.sourceUrl,
                            ) === endpointIndex ? (
                              <RegistrationDetail endpoint={endpoint} />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {project.notes ? (
                      <p className="project-notes">{project.notes}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        ))}
      </table>
    </div>
  );
}
