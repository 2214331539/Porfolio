# 小潘同学

## 分支与功能开发

`main` 保留经过验证的可用版本，`dev` 用于新功能开发与验收。功能在 `dev` 上完成构建和交互检查后，再合并到 `main` 并部署；现有部署脚本默认拉取 `main`。

作品集入口为 `/portfolio`，管理入口为 `/admin/portfolio`。后台可编辑页面标题与个人介绍，新建、编辑、删除作品，维护图标、简介、详细介绍、类别、标签和访问链接，并按展示顺序排列作品。草稿只在后台显示，切换为已发布并保存后才会出现在前台。作品截图支持批量上传、调整顺序和填写说明；前台可横向浏览、点击放大，也可用方向键切换、Esc 退出。没有截图或访问链接时，相应区域不会显示。

作品集使用独立数据库表。首次升级需要在 `backend` 目录执行 `uv run alembic upgrade head`，迁移 `20261013_0006` 会一次性保留原有个人介绍和 Couploc、SoundTag、Cooking、Impromptu、Shopify 五个作品，之后以后台保存的内容为准，重启不会恢复已删除作品。部署时应先备份数据库，应用迁移，再更新后端与前端；该功能在 `dev` 验收完成后再合入 `main`。作品资料接口不使用浏览器缓存，返回前台页面时会重新读取已发布内容。上传文件使用独立文件名，替换图标或截图后不会沿用旧图片地址。

一个 React + TypeScript + FastAPI + PostgreSQL 的个人内容站点与后台 CMS。

文章与图文均通过可无限嵌套的内容仓库归档。后台可创建、移动、排序和删除空仓库，并在内容编辑器中将条目分配到任意层级；旧文章分类会在数据库迁移时自动转为顶层文章仓库。

## 项目结构

```text
frontend/   React 前端、页面、路由、样式
backend/    FastAPI API、SQLAlchemy 模型、认证与文件上传
uploads/    后端上传图片目录
doc/        项目文档
```

## 启动后端

后端使用 uv 管理依赖：

```powershell
cd backend
Copy-Item .env.example .env
# 根据本机 PostgreSQL 修改 .env
uv sync
uv run alembic upgrade head
uv run python run.py
```

`SEED_DEMO_DATA` 默认是 `false`。只有开发演示环境需要自动插入示例文章和图文时，才将它改为 `true`；生产环境保持关闭，避免已删除内容在重启后重新出现。

API 文档：<http://localhost:8000/api/docs>

## 启动前端

```powershell
npm install
npm run dev
```

前端地址：<http://localhost:5173>

后台地址：<http://localhost:5173/admin>

开发环境默认管理员账号为 `admin`，密码为 `admin123`。生产环境必须通过 `backend/.env` 修改。

## 检查与构建

```powershell
npm run build
cd backend
uv run python -m compileall -q app
uv run --with httpx python -m unittest discover -s tests -v
uv lock --check
```

前端所有内容均通过 API 获取。接口不可用时会显示错误状态，不会回退到静态 Mock 数据。

