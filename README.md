# 纸上见山

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
uv lock --check
```

前端所有内容均通过 API 获取。接口不可用时会显示错误状态，不会回退到静态 Mock 数据。
