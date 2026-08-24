# Ubuntu 部署配置

项目采用 Nginx 托管前端静态文件、systemd 托管 FastAPI、服务器本机 PostgreSQL 的部署方式。代码目录中的 `uploads/` 是持久数据目录，部署脚本不会删除、清空或同步该目录。

## 1. 服务器环境文件

首次克隆代码后创建 `backend/.env`：

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:数据库密码@127.0.0.1:5432/inkfold
SECRET_KEY=替换为足够长的随机字符串
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为首次初始化使用的管理员密码
FRONTEND_URL=http://121.196.165.152
ACCESS_TOKEN_MINUTES=10080
```

再创建 `frontend/.env.production`：

```dotenv
VITE_API_URL=/api
```

这两个文件均已被 Git 忽略，不会随代码提交或 `git pull` 被覆盖。`ADMIN_PASSWORD` 仅在数据库中不存在管理员时用于初始化；修改该变量不会更改已有管理员的密码。

## 2. systemd 必要信息

- 服务名：`portfolio-api.service`
- 工作目录：`项目绝对路径/backend`
- 启动命令：`项目绝对路径/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1`
- 运行用户：代码目录和 `uploads/` 目录的所有者
- 环境文件：`项目绝对路径/backend/.env`
- 重启策略：`Restart=always`

如果使用其他服务名，每次执行脚本时可以设置 `DEPLOY_SERVICE=其他服务名`，或者直接修改脚本顶部的默认值。

## 3. Nginx 必要信息

- `server_name 121.196.165.152;`
- 前端根目录：`项目绝对路径/frontend/dist`
- `/api/` 反向代理到 `http://127.0.0.1:8000`
- `/uploads/` 使用 `alias 项目绝对路径/uploads/`
- `/` 使用 `try_files $uri $uri/ /index.html`，支持 React 前端路由
- `client_max_body_size 20m`，允许上传简历 PDF
- 代理时传递 `Host`、`X-Real-IP`、`X-Forwarded-For` 和 `X-Forwarded-Proto`

Nginx 参考路由：

```nginx
root /项目绝对路径/frontend/dist;
client_max_body_size 20m;

location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /uploads/ {
    alias /项目绝对路径/uploads/;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

## 4. 一键更新

首次部署需要安装 Git、Node、npm、uv、Python 3.13，并完成 PostgreSQL、systemd 和 Nginx 配置。之后在项目目录执行：

```bash
bash scripts/deploy.sh
```

脚本会按顺序执行：检查环境、`git pull --ff-only`、安装前端依赖、构建前端、同步后端依赖、执行 Alembic 迁移、执行幂等初始化、重启 systemd 服务、访问健康检查接口。

如需从本地直接触发：

```bash
ssh pp@121.196.165.152 'cd /项目绝对路径 && bash scripts/deploy.sh'
```

部署脚本不会执行 `git reset`、`git clean` 或删除 `uploads/`。如果服务器上的受 Git 管理文件被手动修改，脚本会停止，避免覆盖修改。
