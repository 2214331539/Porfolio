# Server Deck

一个以服务器为中心的本地私有工作台：上方选择服务器与查看连接信息，下方查看当前机器的项目、访问入口和资源占用。没有侧边导航，也没有独立作品集。

## 启动

需要 Node.js 22 或更新版本。本机已安装依赖。

Windows 下双击项目根目录的 **`start.bat`** 即可启动并打开浏览器。缺少依赖时自动安装；已经运行时直接打开现有页面；仅一项服务在运行时补齐另一项。启动后保留终端窗口，按 `Ctrl+C` 停止本次启动的服务。管理口令保存在 `.local/dashboard-login.txt`，脚本不会重置口令或服务器数据。

也可以手动启动：

```powershell
Set-Location F:\Project\PersonalProject\Project\ServerDeck
npm run dev
```

打开 http://127.0.0.1:5173 。管理口令保存在 `.local/dashboard-login.txt`。它与服务器密码相互独立。

生产模式仍绑定本机回环地址：

```powershell
npm run build
npm start
```

打开 http://127.0.0.1:4318 。对公网开放、HTTPS 和远程部署不在本次开发操作中；后续上线时需要单独配置访问域名、来源白名单与安全 Cookie。

## 已实现

- 参考 Mercury 官网与公开产品演示重做的深色界面，包含服务器机架示意、细微活动灯与适配手机的连接浮层。参考来源与设计说明见 [界面参考](docs/design-reference.md)。
- 三台真实服务器、六组账号按 IP 合并。点击卡片打开连接浮层，支持切换账号、临时显示密码、复制信息和 SSH 命令。
- 查看部署按钮平滑定位到详情；记住上次选择的服务器。
- 只读 SSH 采集 Linux 系统、CPU、内存、根分区、运行时间、容器、应用进程和可读取的 Nginx 配置。
- 同一 Compose 项目的前端、后端和数据库合并为一个项目。进程按归一化部署目录合并，项目内展开服务与所有链接。
- 注册局 RDAP 可用时自动查询域名注册商与到期时间，注明来源；已取得 shorpan.cyou 的公开登记。登记查询独立缓存，成功结果每天更新，失败结果一小时后才重试。
- 服务器、账号和项目可新增、编辑。支持人工补充名称、用途、访问地址、主域名登记、费用、续费日期与备注。
- 可选择手工记录 CPU / 内存；显示来源，留空恢复采集值。未获取的指标保持未知。
- 已采集的结果在重启后保留；失败时保留旧快照并显示错误，不继续自动重试认证失败的服务器。
- 管理登录、限速、HttpOnly 会话、同源检查、凭据按需读取、AES-256-GCM 加密保存和排除凭据的清单导出。
- 本地打包字体，手机布局、键盘操作及减少动态效果支持。

## 数据与凭据

`.local/` 已加入 `.gitignore`，包含：

| 文件 | 内容 |
| --- | --- |
| `vault.enc` | 加密后的服务器、账号及人工项目记录 |
| `master.key` | 本机解密密钥，需与密文一起妥善保管 |
| `auth.json` | 管理口令的带盐 scrypt 摘要 |
| `dashboard-login.txt` | 初始管理口令，仅用于首次取用 |
| `inventory.json` | 最近一次采集结果，不含登录密码或私钥 |
| `registrations.json` | 公开域名登记的白名单字段和查询状态，不保存注册人联系信息 |
| `rdap-bootstrap.json` | IANA 公开的注册局查询目录 |
| `qa/` | 本地浏览器验证截图 |

源代码、前端构建产物、普通资源接口和清单导出均不包含服务器密码。只有已登录后的按需读取接口会返回指定账号的密码。浏览器不把凭据写入 localStorage；密码在关闭浮层、切换账号或显示 60 秒后隐藏。

本机 SSH 私钥通过文件路径读取，不上传到服务器。首次连接新机器采用首次信任并记录指纹；已经保存的指纹发生变化时停止连接。此次录入的机器优先使用本机已有 known_hosts 中的指纹。

可通过 `SERVER_DECK_DATA_DIR` 指定另外的数据目录。备份时同时备份 `vault.enc` 和 `master.key`；只备份密文无法恢复。数据写入采用临时文件与原子替换，适用于本次单进程、个人使用规模。

## 采集范围

详细结论见 [数据可获得性评估](docs/data-assessment.md)。

远端只需已有的 SSH 服务和 Python 3。采集脚本通过 SSH 标准输入在内存中执行，没有安装 Agent、创建定时任务、修改配置、读取进程环境变量或执行部署操作。

页面可见时每 60 秒采集一次；隐藏页面暂停发起新采集。关闭页面后停止发起新采集，已经开始的采集会结束并缓存。没有后台驻留监控或提醒任务。

## 开发与验证

技术栈：React 19、TypeScript、Vite、Express、ssh2、Python 标准库。账户与资源数据留在本机后端，浏览器不直接连接 SSH。

```powershell
npm test
npm run build
npm run check:browser
```

浏览器验证需要先启动开发服务，以及已安装的 Playwright Chromium 或 Microsoft Edge。脚本从本地口令文件读取口令，不打印凭据。测试覆盖认证隔离、导出脱敏、加密篡改检测、项目合并、人工记录持久化、交互及窄屏布局。

目录：`src/` 为界面，`server/` 为本机 API 与采集，`tests/` 为验证，`docs/` 为产品与数据说明。

## Porfolio 集成

Porfolio 的后台通过 `/admin/server-deck` 嵌入本工作台。生产构建时使用 `VITE_BASE_PATH=/server-deck/` 和 `VITE_API_PREFIX=/server-deck/api`，后端由独立 Node 服务监听回环地址，再由 Nginx 代理 `/server-deck/`。若设置 `PORFOLIO_JWT_SECRET` 为 Porfolio 的 `SECRET_KEY`，工作台会接受 Porfolio 管理员 JWT，已登录后台无需再次输入工作台口令；独立打开或本地运行时仍可使用原有口令登录。完整的服务、Nginx 和加密数据迁移说明见 Porfolio 的 [集成文档](../doc/server-deck-integration.md)。
