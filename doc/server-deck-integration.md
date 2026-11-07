# Server Deck 集成说明

Porfolio 的后台新增了“服务器”入口，路径为 `/admin/server-deck`。页面使用同源 iframe 打开 Server Deck 的服务器工作台，因此服务器卡片、SSH 采集、项目发现、域名登记和凭据浮层继续由 Server Deck 自己维护，Porfolio 只负责后台导航和登录态。Server Deck 的源码放在仓库根目录 `serverdeck/`，其中 `.local`、密钥和构建产物不会进入 Git。

嵌入模式使用 Porfolio 已有的管理员 JWT 完成单点登录。Server Deck 前端从同源 `localStorage` 读取 `inkfold_token`，请求 `/server-deck/api` 时带上 Bearer Token；Server Deck 后端使用同一个 `PORFOLIO_JWT_SECRET` 验证签名和过期时间。独立打开 `/server-deck/` 仍然保留原来的工作台口令登录，便于本地维护和故障排查。SSH 密码、密钥路径和主机指纹仍保存在 Server Deck 的 AES-256-GCM 加密库中，不进入 Porfolio 数据库和普通 API 响应。

生产部署需要单独运行 Server Deck Node 服务，建议监听 `127.0.0.1:4318`，并由 Nginx 将 `/server-deck/` 代理到该服务；Porfolio 的 `/api/` 仍然只代理到 FastAPI 的 8002 端口。Server Deck 的静态构建必须使用 `VITE_BASE_PATH=/server-deck/` 与 `VITE_API_PREFIX=/server-deck/api`，这样 iframe 的资源和接口不会误走 Porfolio 的 API。Nginx 需要保留 `/server-deck/` 的代理尾斜杠，使上游收到 `/`、`/assets/...` 和 `/api/...`。

首次在生产机启用时，先创建只允许 `pp` 读取的 `SERVER_DECK_DATA_DIR`，再从可信的 Server Deck 本地 `.local` 目录复制 `vault.enc`、`master.key`、`auth.json` 以及可选的 `inventory.json`、`registrations.json`、`rdap-bootstrap.json`。`master.key` 和 `vault.enc` 必须成对备份，单独备份密文无法恢复。若账号记录中的密钥路径是 `~/.ssh/id_ed25519`，服务运行用户需要在同一位置拥有对应私钥；Windows 路径不能直接用于 Linux 服务。

上线前必须验证四件事：未登录访问 `/server-deck/api/state` 返回 401；已登录 Porfolio 后 `/admin/server-deck` 内的 iframe 能直接显示服务器列表；刷新单台服务器不会把密码写入响应或日志；Nginx、FastAPI 和 Server Deck 三个服务重启后，旧快照、主机指纹和人工项目记录仍然存在。Server Deck 不执行远端部署命令，只通过 SSH 标准输入运行只读采集脚本；真正的重启、配置修改和发布仍应通过 SSH 或现有部署流程完成。
