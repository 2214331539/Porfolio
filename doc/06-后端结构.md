# 后端工程结构

## 1. 后端职责

后端负责：

- 管理员鉴权、会话、登录日志。
- 内容管理业务规则：状态流转、slug 唯一、定时发布。
- 媒体上传、压缩、对象存储、缩略图和变体。
- 简历结构化数据管理。
- 公开内容聚合和后台统计。
- 操作日志、安全限制和任务队列。

## 2. 技术栈

- NestJS + TypeScript
- Prisma + PostgreSQL
- Redis + BullMQ
- Sharp
- S3 SDK
- class-validator / Zod
- Swagger OpenAPI
- Jest + Supertest

## 3. 目录结构

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── env.schema.ts
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── storage.config.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── serializers/
│   │   └── utils/
│   ├── database/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── admin-users/
│   │   ├── media/
│   │   ├── blog/
│   │   ├── notes/
│   │   ├── resume/
│   │   ├── site-settings/
│   │   ├── navigation/
│   │   ├── analytics/
│   │   ├── dashboard/
│   │   └── operation-logs/
│   ├── jobs/
│   │   ├── queues.module.ts
│   │   ├── media-processing.processor.ts
│   │   ├── scheduled-publish.processor.ts
│   │   └── analytics-rollup.processor.ts
│   └── openapi/
│       └── swagger.ts
├── test/
│   ├── e2e/
│   └── fixtures/
└── package.json
```

## 4. 模块职责

### auth

职责：

- 登录、退出、刷新 Token。
- 密码校验与哈希。
- 登录失败频率限制。
- 会话撤销。
- 当前管理员信息。

内部文件：

```text
modules/auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.module.ts
├── dto/
├── guards/
│   ├── jwt-auth.guard.ts
│   └── admin-role.guard.ts
└── strategies/
    └── jwt.strategy.ts
```

### media

职责：

- 文件上传校验。
- 写入对象存储。
- 图片尺寸识别、压缩、WebP/AVIF 变体。
- 媒体文件夹。
- 引用计数和删除保护。

内部文件：

```text
modules/media/
├── media.controller.ts
├── media.service.ts
├── media.module.ts
├── media-storage.service.ts
├── media-transform.service.ts
├── media-reference.service.ts
├── dto/
└── serializers/
```

### blog

职责：

- 文章 CRUD。
- 分类、标签。
- Markdown 预处理：目录、阅读时长、HTML 缓存。
- 内容状态流转。
- 公开列表与详情。
- 文章统计。

内部文件：

```text
modules/blog/
├── admin-blog.controller.ts
├── public-blog.controller.ts
├── blog-posts.service.ts
├── blog-categories.service.ts
├── tags.service.ts
├── blog-render.service.ts
├── blog-metrics.service.ts
├── dto/
└── serializers/
```

### notes

职责：

- 图文笔记 CRUD。
- 多图排序。
- 话题管理。
- 公开瀑布流数据。
- 点赞、收藏、浏览统计。

```text
modules/notes/
├── admin-notes.controller.ts
├── public-notes.controller.ts
├── notes.service.ts
├── note-topics.service.ts
├── note-metrics.service.ts
├── dto/
└── serializers/
```

### resume

职责：

- 简历版本管理。
- 分区、经历、教育、技能、项目、证书的批量保存。
- 当前公开版本。
- PDF 导出配置。

```text
modules/resume/
├── admin-resume.controller.ts
├── public-resume.controller.ts
├── resume-profile.service.ts
├── resume-section.service.ts
├── resume-export.service.ts
├── dto/
└── serializers/
```

### site-settings / navigation

职责：

- 站点标题、SEO、主题、社交链接、备案。
- 首页 Hero 和推荐内容配置。
- 头部、底部和社交导航。

### analytics

职责：

- 记录浏览、阅读、点赞等事件。
- 去重和反刷。
- 聚合日统计。
- 为 dashboard 提供数据。

### operation-logs

职责：

- 记录后台关键操作。
- 支持按管理员、动作、资源过滤。
- 对发布、删除、系统设置变更强制记录。

## 5. Controller 分层

公开接口和后台接口必须拆开 controller：

```text
public-blog.controller.ts
admin-blog.controller.ts
```

原因：

- 权限规则不同。
- 返回字段不同。
- 缓存策略不同。
- 后台可见草稿和私密内容，前台不可见。

## 6. Service 边界

Service 不直接返回 Prisma 原始对象给前端。输出必须经过 serializer 或 DTO 转换。

示例：

```text
BlogPostsService
├── createDraft()
├── updatePost()
├── publish()
├── schedule()
├── moveToTrash()
├── findPublicList()
├── findPublicDetail()
└── findAdminList()
```

状态流转集中在 service 内，controller 不写业务判断。

## 7. 任务队列

### media-processing

触发时机：文件上传后。

任务：

- 读取图片尺寸。
- 生成缩略图。
- 生成 WebP/AVIF。
- 计算 blurhash 和主色。
- 更新 `media_variants`。

### scheduled-publish

触发时机：每分钟扫描。

任务：

- 将 `scheduled_at <= now()` 的文章和图文设置为 `published`。
- 写入操作日志。

### analytics-rollup

触发时机：每 5 到 15 分钟。

任务：

- 将 `analytics_events` 聚合到 `daily_content_stats`。
- 更新 `blog_post_metrics` 和 `note_metrics`。

## 8. 配置项

环境变量必须集中校验：

```text
NODE_ENV
API_PORT
DATABASE_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL
UPLOAD_MAX_FILE_SIZE
CORS_ORIGINS
ADMIN_BOOTSTRAP_EMAIL
ADMIN_BOOTSTRAP_PASSWORD
```

缺少必需变量时服务启动失败。

## 9. 安全策略

- 密码使用 Argon2id。
- 登录接口限流。
- 后台接口必须鉴权。
- 上传文件校验 MIME、扩展名和文件头。
- Markdown HTML 输出必须清洗。
- 所有列表接口限制最大 `pageSize`。
- 删除媒体前检查引用计数。
- 系统设置更新必须写操作日志。

## 10. 缓存策略

| 数据 | 策略 |
| --- | --- |
| 公开站点设置 | Redis 缓存 5 分钟，更新后主动失效 |
| 首页聚合数据 | Redis 缓存 1 分钟 |
| 热门文章/图文 | Redis 缓存 5 分钟 |
| 后台列表 | 不缓存，依赖数据库索引 |
| 媒体文件 | CDN 缓存，文件 key 不覆盖 |

## 11. Seed 策略

`prisma/seed.ts` 需要创建：

- 默认管理员。
- 默认站点设置。
- 默认导航：博客、图文、简历。
- 默认博客分类：技术开发、生活随笔、设计思考。
- 默认图文话题：旅行、日常、技术、生活。
- 一份空白简历版本。

