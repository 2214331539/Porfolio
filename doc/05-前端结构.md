# 前端工程结构

## 1. 前端职责

前端负责：

- 前台页面展示：Landing Page、博客、图文笔记、简历。
- 后台管理界面：登录、控制台、内容管理、媒体库、设置。
- 视觉系统：主题、响应式、暗色模式、动效、3D Hero。
- 数据消费：通过 API client 调用后端，不直接访问数据库或对象存储。

## 2. 技术栈

- Next.js App Router
- React + TypeScript
- Tailwind CSS + CSS Variables
- TanStack Query
- Zustand
- React Hook Form + Zod
- Three.js + React Three Fiber + Drei
- Framer Motion
- MDX/Markdown render pipeline

## 3. 目录结构

```text
apps/web/
├── public/
│   ├── favicon.ico
│   ├── models/                  # 3D 模型、贴图
│   └── images/                  # 静态占位图
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── providers.tsx
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   ├── (site)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [slug]/page.tsx
│   │   │   │   ├── category/[slug]/page.tsx
│   │   │   │   ├── tag/[slug]/page.tsx
│   │   │   │   └── archive/page.tsx
│   │   │   ├── notes/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [slug]/page.tsx
│   │   │   │   └── topic/[slug]/page.tsx
│   │   │   └── resume/page.tsx
│   │   ├── (admin)/
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── blog/
│   │   │   │   ├── notes/
│   │   │   │   ├── resume/
│   │   │   │   ├── media/
│   │   │   │   ├── settings/
│   │   │   │   └── security/
│   │   └── api/health/route.ts   # 仅用于前端部署健康检查
│   ├── components/
│   │   ├── ui/                   # Button、Input、Dialog 等基础组件
│   │   ├── layout/               # Header、Footer、AdminShell
│   │   ├── feedback/             # EmptyState、ErrorState、Skeleton
│   │   └── icons/
│   ├── features/
│   │   ├── landing/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types.ts
│   │   ├── blog/
│   │   │   ├── components/
│   │   │   ├── admin/
│   │   │   ├── hooks/
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   ├── notes/
│   │   ├── resume/
│   │   ├── media/
│   │   ├── settings/
│   │   └── auth/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── public-client.ts
│   │   │   └── admin-client.ts
│   │   ├── auth/
│   │   │   ├── token-store.ts
│   │   │   └── require-admin.ts
│   │   ├── markdown/
│   │   │   ├── render.tsx
│   │   │   └── toc.ts
│   │   ├── seo/
│   │   ├── theme/
│   │   └── utils/
│   ├── stores/
│   │   ├── admin-shell-store.ts
│   │   ├── theme-store.ts
│   │   └── editor-draft-store.ts
│   └── styles/
│       ├── tokens.css
│       ├── markdown.css
│       └── print.css
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## 4. 路由分组

### `(site)`

公开前台页面，优先使用服务端组件获取公开数据，保证 SEO 和首屏性能。复杂交互如 3D Hero、瀑布流、轮播使用客户端组件。

### `(admin)`

后台管理页面，整体采用客户端交互为主。布局层统一做登录态校验、侧栏、顶部栏、面包屑和快捷操作。

## 5. 功能模块分层

每个 `features/*` 模块保持同样结构：

```text
features/blog/
├── api.ts              # 调用 API client 的模块级方法
├── types.ts            # 模块本地类型，优先复用 contracts
├── hooks/              # useBlogPosts、usePostEditor
├── components/         # 前台展示组件
├── admin/              # 后台管理组件
└── utils.ts            # 模块内部纯函数
```

原则：

- 页面文件只做路由、数据装配和布局，不写复杂业务逻辑。
- 表单 schema 靠近表单组件，但共享类型放入 `packages/contracts`。
- `components/ui` 不依赖业务模块。
- `features/*` 之间不相互直接引用，跨模块数据通过 API 或共享 contracts。

## 6. 前台页面设计

### Landing Page

组件拆分：

```text
features/landing/components/
├── SiteNav.tsx
├── HeroScene.tsx
├── CloudLayers.tsx
├── FloatingContentRail.tsx
├── ResumePreview.tsx
├── BlogMasonryPreview.tsx
├── NotesPreview.tsx
└── SiteFooter.tsx
```

`HeroScene` 使用 React Three Fiber。3D 场景只接受配置和资源 URL，不直接请求接口。

### 博客

组件拆分：

```text
features/blog/components/
├── PostCard.tsx
├── PostList.tsx
├── PostFilters.tsx
├── PostMarkdown.tsx
├── PostToc.tsx
├── ReadingProgress.tsx
├── RelatedPosts.tsx
└── ArchiveTimeline.tsx
```

Markdown 渲染必须包含：

- 代码高亮。
- 图片懒加载。
- 表格响应式。
- 标题锚点。
- XSS 安全清洗。

### 图文笔记

组件拆分：

```text
features/notes/components/
├── NoteMasonryGrid.tsx
├── NoteCard.tsx
├── NoteImageCarousel.tsx
├── NoteLightbox.tsx
├── TopicFilter.tsx
└── NoteActions.tsx
```

移动端优先保证滑动、图片比例和触控区域。

### 简历

组件拆分：

```text
features/resume/components/
├── ResumeHeader.tsx
├── ResumeTimeline.tsx
├── SkillMatrix.tsx
├── ProjectList.tsx
├── CertificateList.tsx
├── ResumeExportButton.tsx
└── ResumePrintView.tsx
```

打印样式放在 `styles/print.css`，隐藏导航、按钮和后台入口。

## 7. 后台页面设计

后台统一使用工作台式布局：

```text
AdminShell
├── AdminSidebar
├── AdminTopbar
├── Breadcrumbs
└── PageContent
```

后台通用组件：

```text
components/admin/
├── DataTable.tsx
├── StatusBadge.tsx
├── BulkActionBar.tsx
├── ConfirmDialog.tsx
├── MediaPicker.tsx
├── SlugInput.tsx
├── MarkdownEditor.tsx
├── SeoFields.tsx
└── SortableList.tsx
```

## 8. 状态管理

| 数据类型 | 方案 |
| --- | --- |
| 服务端数据 | TanStack Query |
| 登录 Token | HttpOnly Cookie 优先，必要时内存态 + refresh |
| 主题 | Zustand + localStorage |
| 后台侧栏折叠 | Zustand + localStorage |
| 编辑器临时草稿 | Zustand + IndexedDB/localStorage |
| 表单状态 | React Hook Form |

## 9. API Client 约定

```text
lib/api/client.ts         # fetch 封装、错误处理、requestId
lib/api/public-client.ts  # 公开 API
lib/api/admin-client.ts   # 管理 API，自动携带 Token
```

前端不在组件里直接写 `fetch('/api/...')`。每个模块在 `features/*/api.ts` 中导出语义化方法。

## 10. 样式与设计系统

需要定义 CSS 变量：

```css
:root {
  --color-bg: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-muted: ...;
  --color-primary: ...;
  --radius-sm: 6px;
  --radius-md: 8px;
  --shadow-soft: ...;
}
```

设计原则：

- 后台界面密度适中，优先可扫读和高效操作。
- 前台界面强调个人品牌、治愈感、沉浸式互动。
- 卡片圆角控制在 8px 左右，除头像、图文图片外不做过度圆角。
- 暗色模式必须覆盖前台和后台。
- 所有按钮、输入框、弹层、表格都要有 loading、disabled、error 状态。

## 11. 性能要求

- 首页 3D 资源懒加载，低性能设备提供静态 fallback。
- 图片使用后端生成的 `thumb`、`medium`、`webp` 变体。
- 博客详情优先 SSR/ISR，后台页面不做 SEO。
- Masonry 列表支持分页或无限滚动，避免一次性渲染全部图片。
- 前台首屏 JS 控制在合理范围，Three.js 模块按需加载。

## 12. 可访问性

- 所有图标按钮必须有 `aria-label`。
- 后台表单错误必须和字段绑定。
- 对话框、菜单、下拉选择必须可键盘操作。
- 图片必须支持 `alt_text`。
- 主题色对比度满足常规可读性要求。

