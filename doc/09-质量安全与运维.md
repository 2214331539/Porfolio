# 质量、安全与运维规范

## 1. 代码质量

必须配置：

- TypeScript strict mode。
- ESLint。
- Prettier。
- lint-staged。
- 统一 import 排序。
- CI 中执行类型检查、lint、测试。

提交前至少运行：

```text
pnpm lint
pnpm typecheck
pnpm test
```

## 2. 测试策略

### 后端测试

| 类型 | 工具 | 覆盖 |
| --- | --- | --- |
| 单元测试 | Jest | Service 状态流转、slug、阅读时长、权限判断 |
| 集成测试 | Supertest | Auth、博客、媒体、简历 API |
| 数据库测试 | Prisma + 测试库 | 迁移、唯一约束、软删除 |

核心用例：

- 登录成功/失败。
- Token refresh。
- 创建草稿文章。
- 发布文章。
- 草稿不能公开访问。
- 上传非法文件被拒绝。
- 媒体被引用时不能硬删除。

### 前端测试

| 类型 | 工具 | 覆盖 |
| --- | --- | --- |
| 组件测试 | Testing Library | 表单、表格、媒体选择器、Markdown 展示 |
| E2E | Playwright | 登录、发布文章、前台查看 |
| 视觉检查 | Playwright screenshot | 首页、博客详情、图文详情、简历打印 |

核心 E2E：

1. 管理员登录。
2. 上传封面。
3. 创建并发布文章。
4. 前台访问文章详情。
5. 编辑简历并访问前台简历页。

## 3. 安全规范

### 鉴权

- 后台接口必须使用 JWT guard。
- Refresh Token 只存哈希。
- 支持注销当前会话和全部会话。
- 登录失败限流。
- 默认管理员密码首次登录后提示修改。

### 内容安全

- Markdown 渲染前清洗 HTML。
- 禁止用户输入直接进入 `dangerouslySetInnerHTML`。
- 外链默认添加 `rel="noopener noreferrer"`。
- 图片 alt 文本可编辑。

### 上传安全

- 校验文件大小。
- 校验 MIME、扩展名和文件头。
- 上传文件 key 随机化，不使用原文件名作为路径。
- 禁止上传可执行文件。
- 对 SVG 默认按不可信处理，MVP 可禁止上传 SVG。

### 后台安全

- CSRF：如果使用 Cookie 鉴权，需要 CSRF Token。
- CORS：只允许配置中的前端域名。
- Rate Limit：登录、上传、统计事件接口限流。
- 操作日志：发布、删除、设置修改、密码修改必须记录。

## 4. 性能规范

### 前端

- 图片使用后端变体。
- 3D Hero 延迟加载。
- 首页聚合接口缓存。
- 博客详情可使用 ISR 或服务端缓存。
- 长列表分页或虚拟化。

### 后端

- 列表接口必须分页。
- 后台搜索字段建索引。
- 热门内容和站点设置使用 Redis 缓存。
- 媒体处理走队列，不阻塞上传响应。
- 统计写入可异步。

### 数据库

- 所有公开 slug 字段唯一索引。
- 内容列表按 `status + published_at` 建组合索引。
- 统计事件定期归档或清理。
- 大字段如 Markdown 不参与常规列表查询。

## 5. SEO 与可访问性

必须实现：

- 每个公开页面的 title 和 description。
- Open Graph 和 Twitter Card。
- sitemap。
- robots。
- 文章详情结构化标题层级。
- 图片 alt。
- 键盘可访问的导航和弹层。

## 6. 日志与监控

### 应用日志

后端日志至少包含：

- requestId。
- method。
- path。
- statusCode。
- duration。
- adminUserId，若存在。

错误日志需要包含堆栈，但不能输出 Token、密码或密钥。

### 业务日志

写入 `operation_logs`：

- 登录成功/失败记录在 `login_logs`。
- 发布文章。
- 删除文章。
- 发布图文。
- 删除媒体。
- 修改系统设置。
- 修改管理员密码。

## 7. 备份策略

生产环境必须备份：

- PostgreSQL。
- 对象存储 bucket。
- `.env` 配置需要安全保存，但不能进入代码仓库。

建议：

- 数据库每日自动备份。
- 对象存储开启版本控制或定期同步。
- 每月至少一次恢复演练。

## 8. 发布流程

### Staging

1. 部署最新 main 分支。
2. 执行迁移。
3. 执行 seed 或数据校验。
4. 运行 smoke test。
5. 手动验证后台登录、发布文章、前台访问。

### Production

1. 备份数据库。
2. 部署 API。
3. 执行数据库迁移。
4. 部署 Web。
5. 清理缓存。
6. 验证健康检查和核心页面。

## 9. 环境变量管理

仓库只提交 `.env.example`，不提交真实 `.env`。

必须区分：

- `apps/web/.env.local`
- `apps/api/.env`
- CI/CD Secret。

前端只能使用 `NEXT_PUBLIC_*` 暴露公开变量，不允许暴露 API 密钥、S3 Secret、JWT Secret。

## 10. 文档维护

当出现以下变化时必须同步更新 `doc`：

- 数据表字段变化。
- API 路径或响应变化。
- 前后端目录结构变化。
- 模块状态流转变化。
- 部署方式变化。

