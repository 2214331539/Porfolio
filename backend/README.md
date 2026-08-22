# Inkfold 后端数据库

数据库表结构由 Alembic 管理，应用启动时不会自动建表、自动迁移或自动写入 seed 数据。

## 常用命令

在 `backend` 目录执行：

```powershell
# 应用已有迁移
uv run alembic upgrade head

# 查看当前数据库版本
uv run alembic current

# 修改模型后生成迁移（生成后必须人工检查）
uv run alembic revision --autogenerate -m "describe the change"

# 检查模型和迁移是否一致
uv run alembic check

# 显式初始化管理员和站点设置
uv run python -m app.db.seed
```

`app/db/seed.py` 仍然保留，但它只负责首次安装时创建管理员和站点配置，不负责数据库表结构，也不会在 FastAPI 启动时执行。文章、图文笔记、嵌套仓库和标签全部由后台管理并持久化在数据库中，seed 不会插入或恢复这些内容。
