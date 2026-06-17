# 功能模块详细说明

## 1. Landing Page 首页

### 前台路由

```text
/
```

### 核心目标

首页是个人品牌第一入口，承担“建立印象、展示内容、引导访问博客/图文/简历”的功能。

### 页面结构

1. 顶部毛玻璃导航。
2. 3D Hero：云海、孤岛、卡通人物、鼠标视差。
3. 底部横向滚动内容卡片。
4. 简历可视化预览区。
5. 博客错落卡片预览区。
6. 图文笔记双列预览区。
7. 页脚。

### 后台配置

- Hero 昵称、英文名、Slogan。
- 3D 场景资源开关：动态/静态 fallback。
- 首页推荐博客数量和排序方式。
- 首页推荐图文数量和排序方式。
- 简历摘要显示开关。
- 社交链接、页脚、备案信息。

### 接口

- `GET /api/public/landing`
- `PATCH /api/admin/settings/landing.hero`
- `PATCH /api/admin/settings/landing.featured_content`

### 验收标准

- 首屏在桌面和移动端都不遮挡导航和文字。
- 低性能设备可禁用 3D，展示静态 Hero。
- 推荐内容为空时展示合理空状态。
- 点击所有内容卡片能跳转到对应详情页。

## 2. 博客文章系统

### 前台路由

```text
/blog
/blog/[slug]
/blog/category/[slug]
/blog/tag/[slug]
/blog/archive
```

### 前台功能

- 文章列表：关键词、分类、标签筛选。
- 文章卡片：封面、标题、摘要、发布时间、阅读时长。
- 文章详情：Markdown、代码高亮、目录、阅读进度条、上一篇/下一篇。
- 归档：分类、标签云、时间轴。
- 主题：明暗模式、字体大小调节。

### 后台功能

- 创建、编辑、删除文章。
- Markdown 编辑器。
- 图片拖拽上传。
- 自动保存草稿。
- 草稿、发布、定时发布、回收站。
- 分类标签管理。
- 阅读量和热门排行。

### 数据实体

- `blog_posts`
- `blog_categories`
- `tags`
- `blog_post_tags`
- `blog_post_revisions`
- `blog_post_metrics`
- `media_assets`

### 状态流转

```text
draft -> published
draft -> scheduled -> published
published -> draft
published -> archived
draft/published/archived -> trashed
trashed -> draft
trashed -> hard delete
```

### 验收标准

- slug 唯一，修改 slug 后旧 URL 处理策略需明确。MVP 可不做自动重定向。
- 草稿不出现在公开接口。
- Markdown 中的脚本不会执行。
- 上传图片可插入文章，并生成可用 URL。
- 文章保存时自动计算阅读时长和目录。

## 3. 小红书式图文笔记

### 前台路由

```text
/notes
/notes/[slug]
/notes/topic/[slug]
```

### 前台功能

- 瀑布流列表：桌面双列或多列，移动端单列。
- 图片卡片：竖版封面、标题、点赞数。
- 详情页：多图轮播、放大查看、正文、话题标签。
- 轻交互：点赞、收藏展示，MVP 可做匿名点赞。
- 话题筛选：旅行、日常、技术、生活等。

### 后台功能

- 多图上传。
- 拖拽调整图片顺序。
- 自动设置封面图。
- 文案编辑。
- 话题标签添加。
- 上下架、置顶、删除。
- 浏览量、点赞数展示。

### 数据实体

- `notes`
- `note_images`
- `note_topics`
- `note_topic_relations`
- `note_metrics`
- `media_assets`

### 验收标准

- 图片顺序在前后台一致。
- 封面缺失时默认使用第一张图片。
- 移动端轮播可滑动且不会误触页面滚动。
- 删除笔记不直接删除图片，只减少引用或由清理任务处理。

## 4. 个人简历模块

### 前台路由

```text
/resume
```

### 前台功能

- 头像、基本信息、一句话简介。
- 工作经历时间轴。
- 教育背景。
- 技能栈：进度条或标签。
- 项目经历：可展开详情。
- 荣誉证书。
- 联系方式、社交外链、邮箱复制。
- 打印/PDF 样式。

### 后台功能

- 简历版本管理。
- 基础信息编辑。
- 分区显示开关和拖拽排序。
- 工作、教育、项目、技能、证书独立维护。
- 极简、商务、创意 3 套主题预留。
- PDF 导出配置。

### 数据实体

- `resume_profiles`
- `resume_sections`
- `resume_experiences`
- `resume_educations`
- `resume_skills`
- `resume_projects`
- `resume_certificates`
- `resume_export_configs`

### 验收标准

- 同一时间只有一个 `is_active = true` 的公开简历版本。
- 后台批量保存经历时保持排序。
- 打印页面去除导航和交互按钮。
- 移动端简历仍保持清晰分区。

## 5. 后台管理系统

### 后台路由

```text
/admin/login
/admin/dashboard
/admin/blog/posts
/admin/blog/categories
/admin/blog/tags
/admin/notes
/admin/notes/topics
/admin/resume
/admin/media
/admin/settings
/admin/security
/admin/logs
```

### 通用能力

- 登录鉴权。
- 侧栏导航。
- 面包屑。
- 数据表格。
- 搜索、筛选、分页。
- 批量操作。
- 表单校验。
- 确认弹窗。
- Toast 反馈。
- 空状态和错误态。

### 控制台

显示：

- 文章数。
- 图文数。
- 媒体数。
- 总浏览量。
- 近期发布内容。
- 热门文章/图文。
- 登录日志摘要。

### 验收标准

- 未登录访问后台页面跳转 `/admin/login`。
- Token 过期后自动刷新，刷新失败则退出登录。
- 所有危险操作必须二次确认。
- 发布、删除、设置变更写入操作日志。

## 6. 媒体资源库

### 后台功能

- 文件夹管理。
- 图片/文件上传。
- 关键词搜索。
- 类型筛选。
- 多选批量删除。
- 媒体详情编辑：alt、文件夹、描述。
- 媒体选择器供文章、图文、简历复用。

### 媒体处理

上传图片后生成：

- 原始文件。
- `thumb`：宽 320。
- `medium`：宽 960。
- `large`：宽 1600。
- `webp`：WebP 变体。
- `blurhash`：低清占位。

### 验收标准

- 上传失败有明确错误。
- 超出大小、非法类型被拒绝。
- 正在被内容引用的媒体不可直接硬删除。
- 媒体选择器可单选、多选，并返回完整元信息。

## 7. 站点设置

### 配置项

- 网站标题。
- 网站描述。
- SEO 默认标题和描述。
- Open Graph 图片。
- 主题色。
- 明暗模式默认策略。
- 社交链接。
- 备案信息。
- 后台隐藏入口策略。

### 验收标准

- 公开配置只返回 `is_public = true` 的设置。
- SEO 配置能被前台页面读取。
- 更新设置后首页缓存失效。

## 8. 数据统计

### MVP 统计

- 文章浏览量。
- 图文浏览量。
- 图文点赞量。
- 热门内容排行。
- 登录日志。

### 后续增强

- 阅读完成率。
- 来源渠道。
- 设备类型。
- 访客地理位置粗粒度统计。

### 验收标准

- 统计接口不会阻塞页面渲染。
- 同一访客短时间重复刷新不应无限增加有效阅读数。
- 后台统计有时间范围筛选。

