import { FormEvent, type MouseEvent as ReactMouseEvent, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Eye,
  FileText,
  Files,
  FolderTree,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Save,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { marked } from "marked";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { authApi } from "../../features/auth/api/auth-api";
import { contentApi } from "../../features/content/api/content-api";
import type { Note } from "../../entities/note/model/types";
import type { Post } from "../../entities/post/model/types";
import type { ContentRepository } from "../../entities/repository/model/types";
import type { Dashboard, SiteSettings } from "../../entities/site/model/types";
import { SiteContext } from "../../app/providers/site-provider";
import { Stat } from "../../shared/ui";
import { RepositorySelect } from "../../features/content/ui/RepositorySelect";
import { RepositoriesAdmin } from "./RepositoriesAdmin";
import { ResumeVersionsAdmin } from "./ResumeVersionsAdmin";
import { AdminImageDropzone } from "./AdminImageDropzone";
import { AdminUiProvider, useAdminDirtyState, useAdminUi } from "./AdminUi";

type AdminTheme = "light" | "dark";
const ADMIN_THEME_KEY = "inkfold_admin_theme";

function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>(() => {
    const stored = localStorage.getItem(ADMIN_THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    localStorage.setItem(ADMIN_THEME_KEY, theme);
    return () => {
      delete document.documentElement.dataset.adminTheme;
    };
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((value) => (value === "light" ? "dark" : "light")),
  };
}

function ThemeToggle({ theme, onToggle }: { theme: AdminTheme; onToggle: () => void }) {
  return (
    <button className="admin-theme-toggle" type="button" onClick={onToggle} aria-pressed={theme === "dark"} aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}>
      {theme === "light" ? <Moon /> : <Sun />}
      <span>{theme === "light" ? "深色模式" : "浅色模式"}</span>
    </button>
  );
}

function Login({ done, theme, onToggleTheme }: { done: () => void; theme: AdminTheme; onToggleTheme: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.login(username, password);
      done();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "登录失败，请确认后端已启动",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="admin-login">
      <div className="admin-login-tools"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div>
      <div className="login-paper">
        <div className="login-brand">
          <span>Pan</span>
          <div>
            <strong>小潘同学</strong>
            <small>CONTENT STUDIO</small>
          </div>
        </div>
        <h1>欢迎回来。</h1>
        <p>登录后继续整理你的数字花园。</p>
        <form onSubmit={submit}>
          <label>
            账号
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              name="username"
              spellCheck={false}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              name="password"
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" disabled={loading}>
            {loading ? "正在验证…" : "进入工作台"} <ChevronRight />
          </button>
        </form>
        <Link to="/">← 返回前台</Link>
      </div>
      <div className="login-art">
        <img src="/assets/black_line.png" alt="" />
        <blockquote>
          “写作，是把混乱
          <br />
          慢慢整理成光。”
        </blockquote>
      </div>
    </div>
  );
}

function Sidebar({ logout, theme, onToggleTheme, onNavigate }: { logout: () => void; theme: AdminTheme; onToggleTheme: () => void; onNavigate: () => void }) {
  const navigate = useNavigate();
  const { hasUnsavedChanges, runAfterDiscardCheck } = useAdminUi();

  function handleNavigation(event: ReactMouseEvent<HTMLAnchorElement>, to: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!hasUnsavedChanges) {
      onNavigate();
      return;
    }
    event.preventDefault();
    runAfterDiscardCheck(() => {
      navigate(to);
      onNavigate();
    });
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">
        <strong>小潘同学</strong>
      </div>
      <nav>
        <small>工作区</small>
        <NavLink to="/admin" end onClick={(event) => handleNavigation(event, "/admin")}>
          <LayoutDashboard />
          总览
        </NavLink>
        <NavLink to="/admin/posts" onClick={(event) => handleNavigation(event, "/admin/posts")}>
          <FileText />
          文章
        </NavLink>
        <NavLink to="/admin/notes" onClick={(event) => handleNavigation(event, "/admin/notes")}>
          <Image />
          图文
        </NavLink>
        <NavLink to="/admin/repositories" onClick={(event) => handleNavigation(event, "/admin/repositories")}>
          <FolderTree />
          仓库
        </NavLink>
        <NavLink to="/admin/resumes" onClick={(event) => handleNavigation(event, "/admin/resumes")}>
          <Files />
          简历
        </NavLink>
        <small>站点</small>
        <NavLink to="/admin/settings" onClick={(event) => handleNavigation(event, "/admin/settings")}>
          <Settings />
          设置
        </NavLink>
      </nav>
      <a className="admin-view-site" href="/" target="_blank" rel="noreferrer"><Eye />查看网站</a>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button type="button" onClick={() => runAfterDiscardCheck(logout)}>
        <LogOut />
        退出登录
      </button>
    </aside>
  );
}

function DashboardView() {
  const [data, setData] = useState<Dashboard>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([contentApi.getDashboard(), contentApi.listPosts(true), contentApi.listNotes(true)])
      .then(([dashboard, postItems, noteItems]) => {
        setData(dashboard);
        setPosts(postItems);
        setNotes(noteItems);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "仪表盘加载失败"),
      );
  }, []);
  const recentContent = useMemo(() => [
    ...posts.map((post) => ({ id: `post-${post.id}`, title: post.title, kind: "文章", date: post.created_at, status: post.status, repository: post.repository?.name || "未归档", to: `/admin/posts/${post.id}`, views: post.views })),
    ...notes.map((note) => ({ id: `note-${note.id}`, title: note.title, kind: "图文", date: note.published_at, status: note.status, repository: note.repository?.name || "未归档", to: `/admin/notes?edit=${note.id}`, views: note.views })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6), [notes, posts]);
  const draftCount = posts.filter((post) => post.status === "draft").length + notes.filter((note) => note.status === "draft").length;
  const unfiledCount = posts.filter((post) => !post.repository && !post.repository_id).length + notes.filter((note) => !note.repository && !note.repository_id).length;
  if (error) return <div className="form-error">{error}</div>;
  if (!data) return <div className="page-loading">正在加载工作台…</div>;
  return (
    <div>
      <div className="admin-title">
        <div>
          <p>WORKSPACE</p>
          <h1>内容工作台</h1>
        </div>
        <Link to="/admin/posts/new" className="primary-button">
          <Plus />
          新建文章
        </Link>
      </div>
      <div className="admin-create-grid" aria-label="快速新建">
        <Link className="admin-create-action" to="/admin/posts/new"><FileText /><span>写文章<small>进入专注写作模式</small></span></Link>
        <Link className="admin-create-action" to="/admin/notes"><Image /><span>发图文<small>上传图片并快速发布</small></span></Link>
        <Link className="admin-create-action" to="/admin/resumes"><Files /><span>新简历版本<small>上传图片与 PDF</small></span></Link>
      </div>
      <div className="admin-focus-strip" aria-label="待处理内容">
        <strong>待处理</strong>
        <span><b>{draftCount}</b> 篇草稿</span>
        <span><b>{unfiledCount}</b> 条未归档内容</span>
        <span><b>{data.published}</b> 条内容已发布</span>
      </div>
      <div className="stats-grid">
        <Stat icon={<BookOpen />} label="文章总数" value={data.posts} />
        <Stat icon={<Image />} label="图文笔记" value={data.notes} />
        <Stat
          icon={<Eye />}
          label="累计访问"
          value={data.views.toLocaleString()}
        />
        <Stat icon={<BarChart3 />} label="已发布内容" value={data.published} />
      </div>
      <div className="admin-panel">
        <div className="panel-title">
          <h2>最近内容</h2>
          <Link to="/admin/posts">查看全部</Link>
        </div>
        {!recentContent.length ? <div className="admin-empty-state"><FileText /><strong>还没有内容</strong><p>从上方选择一种内容开始创作。</p></div> : recentContent.map((item) => (
          <Link className="recent-row admin-recent-link" to={item.to} key={item.id}>
            <div className="row-icon">
              {item.kind === "文章" ? <FileText /> : <Image />}
            </div>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.kind} · {item.repository} · {new Date(item.date).toLocaleDateString("zh-CN")}
              </small>
            </div>
            <span className={`status ${item.status}`}>
              {item.status === "published" ? "已发布" : "草稿"}
            </span>
            <b>{item.views} 阅读</b>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PostsView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const { confirmAction, notify } = useAdminUi();
  useEffect(() => {
    contentApi
      .listPosts(true)
      .then(setPosts)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "文章加载失败"),
      )
      .finally(() => setLoading(false));
  }, []);
  const visiblePosts = useMemo(() => posts.filter((post) => {
    if (status !== "all" && post.status !== status) return false;
    if (!deferredQuery) return true;
    return `${post.title} ${post.excerpt} ${post.repository?.name ?? ""} ${post.tags.map((tag) => tag.name).join(" ")}`.toLocaleLowerCase().includes(deferredQuery);
  }), [deferredQuery, posts, status]);
  async function remove(post: Post) {
    const accepted = await confirmAction({ title: `删除“${post.title}”？`, description: "文章将被永久移除，公开链接也会立即失效。", confirmLabel: "删除文章", tone: "danger" });
    if (!accepted) return;
    try {
      await contentApi.deletePost(post.id);
      setPosts((items) => items.filter((item) => item.id !== post.id));
      notify("文章已删除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "文章删除失败");
    }
  }
  return (
    <div>
      <div className="admin-title">
        <div>
          <p>CONTENT / POSTS</p>
          <h1>文章管理</h1>
        </div>
        <Link className="primary-button" to="/admin/posts/new">
          <Plus />
          新建文章
        </Link>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="admin-panel table-panel">
        <div className="admin-list-toolbar">
          <label className="admin-list-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索文章" placeholder="搜索标题、摘要或标签…" /></label>
          <div className="admin-list-filter" aria-label="文章状态筛选">
            {([['all', '全部'], ['draft', '草稿'], ['published', '已发布']] as const).map(([value, label]) => <button type="button" className={status === value ? 'active' : ''} onClick={() => setStatus(value)} key={value}>{label}</button>)}
          </div>
          <span className="admin-list-count">{visiblePosts.length} 篇</span>
        </div>
        <div className="table-head">
          <span>文章</span>
          <span>状态</span>
          <span>阅读</span>
          <span>操作</span>
        </div>
        {loading ? <div className="admin-empty-state"><span>正在读取文章…</span></div> : !visiblePosts.length ? <div className="admin-empty-state"><FileText /><strong>{posts.length ? '没有匹配的文章' : '还没有文章'}</strong><p>{posts.length ? '尝试更换关键词或状态筛选。' : '创建第一篇文章，开始搭建内容仓库。'}</p>{!posts.length ? <Link className="admin-button secondary" to="/admin/posts/new">新建文章</Link> : null}</div> : visiblePosts.map((post) => (
          <div className="content-row" key={post.id}>
            <div>
              <Link className="admin-content-title" to={`/admin/posts/${post.id}`}>{post.title}</Link>
              <small>
                {post.repository?.name || post.category?.name || "未归档"} ·{" "}
                {new Date(post.created_at).toLocaleDateString("zh-CN")}
              </small>
            </div>
            <span className={`status ${post.status}`}>
              {post.status === "published"
                ? "已发布"
                : post.status === "draft"
                  ? "草稿"
                : "草稿"}
            </span>
            <span>{post.views}</span>
            <div>
              <Link to={`/admin/posts/${post.id}`}>编辑</Link>
              <button
                  onClick={() => remove(post)}
                aria-label={`删除${post.title}`}
              >
                <Trash2 />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostEditor() {
  const navigate = useNavigate();
  const { notify, runAfterDiscardCheck } = useAdminUi();
  const { id } = useParams();
  const editingId = id ? Number(id) : undefined;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [tagNames, setTagNames] = useState("");
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [content, setContent] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const emptySnapshot = JSON.stringify(["", "", "", "", null, false, false, ""]);
  const [savedSnapshot, setSavedSnapshot] = useState(emptySnapshot);
  const draftSnapshot = useMemo(() => JSON.stringify([title, excerpt, coverUrl, tagNames, repositoryId, isPinned, isPrivate, content]), [content, coverUrl, excerpt, isPinned, isPrivate, repositoryId, tagNames, title]);
  const isDirty = draftSnapshot !== savedSnapshot;
  const previewHtml = useMemo(() => marked.parse(content || "_正文预览会显示在这里。_") as string, [content]);
  useAdminDirtyState(isDirty);
  useEffect(() => {
    contentApi
      .listRepositories("post", true)
      .then(setRepositories)
      .catch((err) => setError(err instanceof Error ? err.message : "仓库加载失败"));
  }, []);
  useEffect(() => {
    if (!editingId) return;
    contentApi
      .getAdminPost(editingId)
      .then((post) => {
        setTitle(post.title);
        setExcerpt(post.excerpt);
        setCoverUrl(post.cover_url ?? "");
        setTagNames(post.tags.map((tag) => tag.name).join(", "));
        setRepositoryId(post.repository?.id ?? post.repository_id ?? null);
        setIsPinned(post.is_pinned);
        setIsPrivate(post.is_private);
        setContent(post.content);
        setPostSlug(post.slug);
        setSavedSnapshot(JSON.stringify([post.title, post.excerpt, post.cover_url ?? "", post.tags.map((tag) => tag.name).join(", "), post.repository?.id ?? post.repository_id ?? null, post.is_pinned, post.is_private, post.content]));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "文章加载失败"),
      );
  }, [editingId]);
  async function uploadCover(file: File | undefined) {
    if (!file || uploadingCover) return;
    setUploadingCover(true);
    setError("");
    try {
      const uploaded = await contentApi.uploadImage(file);
      setCoverUrl(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "封面上传失败");
    } finally {
      setUploadingCover(false);
    }
  }
  function insertMarkdown(before: string, after = "", placeholder = "文本") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    setContent(
      content.slice(0, start) + before + selected + after + content.slice(end),
    );
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }
  async function submit(status: "draft" | "published") {
    if (!title.trim()) {
      setError("请先填写文章标题");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: Partial<Post> = {
        id: editingId,
        title: title.trim(),
        excerpt,
        content,
        cover_url: coverUrl.trim() || null,
        tag_names: tagNames.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
        repository_id: repositoryId,
        is_pinned: isPinned,
        is_private: isPrivate,
        status,
      };
      if (!editingId) {
        payload.slug = title.trim().toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || `post-${Date.now()}`;
      }
      const saved = await contentApi.savePost(payload);
      setPostSlug(saved.slug);
      setSavedSnapshot(draftSnapshot);
      notify(status === "published" ? "文章已发布" : "草稿已保存");
      if (!editingId) navigate(`/admin/posts/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "文章保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <div className="editor-top">
        <button
          type="button"
          onClick={() => runAfterDiscardCheck(() => navigate("/admin/posts"))}
          aria-label="关闭编辑器"
        >
          <X />
        </button>
        <div>
          <span className={`save-state ${isDirty ? "dirty" : ""}`}>
            {saving ? "正在保存…" : isDirty ? "有未保存更改" : editingId ? "所有更改已保存" : "新文章"}
          </span>
          <button type="button" className="admin-button secondary" onClick={() => setPreviewOpen((value) => !value)} aria-pressed={previewOpen}>
            {previewOpen ? "关闭预览" : "预览"}
          </button>
          {postSlug ? <a className="admin-button secondary" href={`/blog/${postSlug}`} target="_blank" rel="noreferrer">查看页面</a> : null}
          <button type="button" className="admin-button secondary" onClick={() => submit("draft")} disabled={saving}>
            保存草稿
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => submit("published")}
            disabled={saving}
          >
            发布文章
          </button>
        </div>
      </div>
      <div className="editor-sheet">
        {error ? <div className="form-error">{error}</div> : null}
        <label className="editor-title-field">
          <span>文章标题</span>
          <input
            className="title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题…"
            name="post-title"
            autoComplete="off"
          />
        </label>
        <label className="editor-excerpt-field">
          <span>摘要</span>
          <input
            className="excerpt-input"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="用一句话告诉读者这篇文章关于什么…"
            name="post-excerpt"
            autoComplete="off"
          />
        </label>
        <section className="post-editor-meta" aria-label="文章属性">
          <AdminImageDropzone
            className="cover-upload-box"
            title="文章封面"
            hint="支持 JPG、PNG、WebP；也可以直接把图片拖到这里"
            buttonLabel={coverUrl ? "更换封面" : "选择封面"}
            uploading={uploadingCover}
            onFiles={(files) => uploadCover(files[0])}
            onInvalid={(message) => { setError(message); notify(message, "error"); }}
            onClear={coverUrl ? () => setCoverUrl("") : undefined}
            clearLabel="移除封面"
          >
            {coverUrl ? <img className="cover-preview" src={coverUrl} alt="文章封面预览" /> : null}
          </AdminImageDropzone>
          <label>
            标签 <small>多个标签用逗号分隔</small>
            <input value={tagNames} onChange={(event) => setTagNames(event.target.value)} placeholder="React, 设计" />
          </label>
          <RepositorySelect repositories={repositories} value={repositoryId} onChange={setRepositoryId} />
          <div className="post-flags">
            <label className="admin-checkbox"><input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />置顶文章</label>
            <label className="admin-checkbox"><input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />仅后台可见</label>
          </div>
        </section>
        <div className={`editor-writing-layout ${previewOpen ? "with-preview" : ""}`}>
          <div className="editor-writing-pane">
          <div
            className="editor-toolbar"
            role="toolbar"
            aria-label="Markdown 工具栏"
          >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("# ", "", "标题");
            }}
          >
            H1
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("## ", "", "标题");
            }}
          >
            H2
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("**", "**");
            }}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("*", "*");
            }}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("`", "`");
            }}
          >
            code
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("[", "](https://)", "链接文本");
            }}
          >
            链接
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              insertMarkdown("![", "](https://)", "图片描述");
            }}
          >
            图片
          </button>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-label="Markdown 正文"
            placeholder="开始写作…"
            spellCheck
          />
          </div>
          {previewOpen ? <article className="admin-markdown-preview markdown-body" aria-label="文章预览" dangerouslySetInnerHTML={{ __html: previewHtml }} /> : null}
        </div>
      </div>
    </div>
  );
}

type NoteDraft = {
  title: string;
  content: string;
  images: string[];
  topics: string;
  repository_id: number | null;
  status: "draft" | "published";
  is_pinned: boolean;
};
const emptyNote: NoteDraft = {
  title: "",
  content: "",
  images: [],
  topics: "",
  repository_id: null,
  status: "draft",
  is_pinned: false,
};
function draftFromNote(note: Note): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    images: note.images,
    topics: note.topics.join("\n"),
    repository_id: note.repository?.id ?? note.repository_id ?? null,
    status: note.status,
    is_pinned: note.is_pinned,
  };
}
function NotesAdmin() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [draft, setDraft] = useState<NoteDraft>({ ...emptyNote, images: [] });
  const [editingId, setEditingId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [imageUrl, setImageUrl] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const { confirmAction, notify, runAfterDiscardCheck } = useAdminUi();
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ ...emptyNote, images: [] }));
  const draftSnapshot = useMemo(() => JSON.stringify(draft), [draft]);
  const isDirty = draftSnapshot !== savedSnapshot;
  useAdminDirtyState(isDirty);
  useEffect(() => {
    Promise.all([contentApi.listNotes(true), contentApi.listRepositories("note", true)])
      .then(([noteItems, repositoryItems]) => {
        setNotes(noteItems);
        setRepositories(repositoryItems);
        const requestedId = Number(searchParams.get("edit"));
        const requestedNote = requestedId ? noteItems.find((note) => note.id === requestedId) : undefined;
        if (requestedNote) {
          const requestedDraft = draftFromNote(requestedNote);
          setEditingId(requestedNote.id);
          setDraft(requestedDraft);
          setSavedSnapshot(JSON.stringify(requestedDraft));
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "图文加载失败"),
      )
      .finally(() => setLoading(false));
  }, []);
  const visibleNotes = useMemo(() => notes.filter((note) => {
    if (statusFilter !== "all" && note.status !== statusFilter) return false;
    if (!deferredQuery) return true;
    return `${note.title} ${note.content} ${note.repository?.name ?? ""} ${note.topics.join(" ")}`.toLocaleLowerCase().includes(deferredQuery);
  }), [deferredQuery, notes, statusFilter]);
  function openEditor(note?: Note) {
    runAfterDiscardCheck(() => {
      const nextDraft = note ? draftFromNote(note) : { ...emptyNote, images: [] };
      setEditingId(note?.id);
      setDraft(nextDraft);
      setSavedSnapshot(JSON.stringify(nextDraft));
      setImageUrl("");
      setError("");
      setSearchParams(note ? { edit: String(note.id) } : {}, { replace: true });
    });
  }
  async function upload(files: readonly File[]) {
    if (!files.length || uploading) return;
    setUploading(true);
    setError("");
    try {
      const results = await Promise.allSettled(files.map((file) => contentApi.uploadImage(file)));
      const uploaded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setDraft((value) => ({
        ...value,
        images: [...value.images, ...uploaded.map((item) => item.url)],
      }));
      if (uploaded.length) notify(`${uploaded.length} 张图片已上传`);
      if (uploaded.length !== results.length) setError(`${results.length - uploaded.length} 张图片上传失败，请重试。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }
  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    setDraft((value) => ({ ...value, images: [...value.images, url] }));
    setImageUrl("");
  }
  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.images.length) return;
    setDraft((value) => {
      const images = [...value.images];
      [images[index], images[target]] = [images[target], images[index]];
      return { ...value, images };
    });
  }
  async function save(status: NoteDraft["status"]) {
    if (!draft.title.trim()) {
      setError("请先填写图文标题");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await contentApi.saveNote({
        id: editingId,
        title: draft.title.trim(),
        content: draft.content,
        images: draft.images,
        topics: draft.topics
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean),
        repository_id: draft.repository_id,
        status,
        is_pinned: draft.is_pinned,
      });
      setNotes((items) =>
        editingId
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      const nextDraft = draftFromNote(saved);
      setEditingId(saved.id);
      setDraft(nextDraft);
      setSavedSnapshot(JSON.stringify(nextDraft));
      setSearchParams({ edit: String(saved.id) }, { replace: true });
      notify(status === "published" ? "图文已发布" : "图文草稿已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "图文保存失败");
    } finally {
      setSaving(false);
    }
  }
  async function remove(note: Note) {
    const accepted = await confirmAction({ title: `删除“${note.title}”？`, description: "图文及其公开页面将被永久移除。已经上传的图片不会自动恢复。", confirmLabel: "删除图文", tone: "danger" });
    if (!accepted) return;
    try {
      await contentApi.deleteNote(note.id);
      setNotes((items) => items.filter((item) => item.id !== note.id));
      if (editingId === note.id) {
        const nextDraft = { ...emptyNote, images: [] };
        setEditingId(undefined);
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setSearchParams({}, { replace: true });
      }
      notify("图文已删除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "图文删除失败");
    }
  }
  return (
    <div>
      <div className="admin-title">
        <div>
          <p>CONTENT / NOTES</p>
          <h1>图文笔记</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => openEditor()}>
          <Plus />
          发布图文
        </button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="notes-admin-layout">
        <div className="admin-panel table-panel">
          <div className="admin-list-toolbar">
            <label className="admin-list-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索图文" placeholder="搜索标题、正文或主题…" /></label>
            <div className="admin-list-filter" aria-label="图文状态筛选">
              {([['all', '全部'], ['draft', '草稿'], ['published', '已发布']] as const).map(([value, label]) => <button type="button" className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)} key={value}>{label}</button>)}
            </div>
            <span className="admin-list-count">{visibleNotes.length} 条</span>
          </div>
          <div className="table-head">
            <span>标题</span>
            <span>状态</span>
            <span>点赞</span>
            <span>操作</span>
          </div>
          {loading ? <div className="admin-empty-state"><span>正在读取图文…</span></div> : !visibleNotes.length ? <div className="admin-empty-state"><Image /><strong>{notes.length ? '没有匹配的图文' : '还没有图文'}</strong><p>{notes.length ? '尝试更换关键词或状态筛选。' : '上传一组图片，记录第一条生活切片。'}</p></div> : visibleNotes.map((note) => (
            <div className="content-row note-admin-row" key={note.id}>
              <div>
                <button type="button" className="admin-content-title" onClick={() => openEditor(note)}>{note.title}</button>
                <small>
                  {note.repository?.name || "未归档"} · {note.topics.map((topic) => `#${topic}`).join(" ")}
                </small>
              </div>
              <span className={`status ${note.status}`}>
                {note.status === "published" ? "已发布" : "草稿"}
              </span>
              <span>{note.likes}</span>
              <div>
                <button type="button" onClick={() => openEditor(note)}>编辑</button>
                <button
                  type="button"
                  onClick={() => remove(note)}
                  aria-label={`删除${note.title}`}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
        <section className="admin-panel note-editor-panel">
          <div className="panel-title">
            <div><h2>{editingId ? "编辑图文" : "新建图文"}</h2>{editingId ? <span className={`status ${draft.status}`}>{draft.status === 'published' ? '已发布' : '草稿'}</span> : null}</div>
            {editingId ? (
              <button type="button" onClick={() => openEditor()} aria-label="关闭图文编辑">
                <X />
              </button>
            ) : null}
          </div>
          <label>
            标题
            <input
              value={draft.title}
              onChange={(e) =>
                setDraft((value) => ({ ...value, title: e.target.value }))
              }
            />
          </label>
          <label>
            正文
            <textarea
              value={draft.content}
              onChange={(e) =>
                setDraft((value) => ({ ...value, content: e.target.value }))
              }
            />
          </label>
          <section className="note-media-manager" aria-label="图文图片管理">
            <AdminImageDropzone
              className="note-image-dropzone"
              title="图文图片"
              hint="首张图片作为列表封面；支持多选或一次拖入多张"
              buttonLabel="选择图片"
              uploading={uploading}
              multiple
              onFiles={upload}
              onInvalid={(message) => { setError(message); notify(message, "error"); }}
            />
            {draft.images.length ? <div className="note-media-grid">{draft.images.map((url, index) => (
              <figure key={`${url}-${index}`}><img src={url} alt={`图文图片 ${index + 1}`} loading="lazy" /><figcaption><span>{index === 0 ? '首图' : String(index + 1).padStart(2, '0')}</span><div><button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={`将第 ${index + 1} 张图片前移`}><ArrowLeft /></button><button type="button" onClick={() => moveImage(index, 1)} disabled={index === draft.images.length - 1} aria-label={`将第 ${index + 1} 张图片后移`}><ArrowRight /></button><button type="button" onClick={() => setDraft((value) => ({ ...value, images: value.images.filter((_, imageIndex) => imageIndex !== index) }))} aria-label={`移除第 ${index + 1} 张图片`}><X /></button></div></figcaption></figure>
            ))}</div> : <div className="note-media-empty"><Image /><span>还没有图片</span></div>}
            <details className="note-image-url"><summary>通过图片链接添加</summary><div><input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.webp" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addImageUrl(); } }} /><button type="button" className="admin-button secondary" onClick={addImageUrl}>添加</button></div></details>
          </section>
          <label>
            主题 <small>每行一个，也支持逗号分隔</small>
            <input
              value={draft.topics}
              onChange={(e) =>
                setDraft((value) => ({ ...value, topics: e.target.value }))
              }
            />
          </label>
          <RepositorySelect repositories={repositories} value={draft.repository_id} onChange={(repository_id) => setDraft((value) => ({ ...value, repository_id }))} />
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={draft.is_pinned}
              onChange={(e) =>
                setDraft((value) => ({ ...value, is_pinned: e.target.checked }))
              }
            />
            置顶
          </label>
          <div className="note-editor-actions">
            <span className={`save-state ${isDirty ? 'dirty' : ''}`}>{saving ? '正在保存…' : isDirty ? '有未保存更改' : '所有更改已保存'}</span>
            <div><button className="admin-button secondary" type="button" onClick={() => save('draft')} disabled={saving}>保存草稿</button><button className="primary-button" type="button" onClick={() => save('published')} disabled={saving}>{saving ? "保存中…" : "发布图文"}</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsView() {
  const [settings, setState] = useState<SiteSettings>();
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const { notify } = useAdminUi();
  const { applySettings } = useContext(SiteContext);
  const settingsSnapshot = settings ? JSON.stringify(settings) : "";
  const isDirty = Boolean(settings) && settingsSnapshot !== savedSnapshot;
  useAdminDirtyState(isDirty);
  useEffect(() => {
    contentApi
      .getSettings()
      .then((value) => {
        setState(value);
        setSavedSnapshot(JSON.stringify(value));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "设置加载失败"),
      );
  }, []);
  if (error && !settings) return <div className="form-error">{error}</div>;
  if (!settings) return <div className="page-loading">正在加载设置…</div>;
  const field = (key: keyof SiteSettings, value: string | string[]) =>
    setState((current) => (current ? { ...current, [key]: value } : current));
  async function save() {
    const current = settings;
    if (!current) return;
    setSaving(true);
    setError("");
    try {
      await contentApi.saveSettings(current);
      setSavedSnapshot(JSON.stringify(current));
      applySettings(current);
      notify("站点设置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "设置保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <div className="admin-title">
        <div>
          <p>SITE / SETTINGS</p>
          <h1>全局设置</h1>
        </div>
        <button className="primary-button" type="button" onClick={save} disabled={saving || !isDirty}>
          <Save />
          {saving ? "保存中…" : isDirty ? "保存设置" : "已保存"}
        </button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="settings-grid">
        <section className="admin-panel">
          <h2>基础信息</h2>
          <label>
            站点名称
            <input
              name="site-title"
              autoComplete="off"
              value={settings.site_title}
              onChange={(e) => field("site_title", e.target.value)}
            />
          </label>
          <label>
            站点描述
            <textarea
              name="site-description"
              autoComplete="off"
              value={settings.site_description}
              onChange={(e) => field("site_description", e.target.value)}
            />
          </label>
          <label>
            页脚文字
            <input
              name="footer-text"
              autoComplete="off"
              value={settings.footer_text}
              onChange={(e) => field("footer_text", e.target.value)}
            />
          </label>
          <label>
            备案号
            <input
              name="icp-number"
              autoComplete="off"
              value={settings.icp_number}
              onChange={(e) => field("icp_number", e.target.value)}
            />
          </label>
        </section>
        <section className="admin-panel">
          <h2>首屏座右铭</h2>
          <p>首页将随机轮播这些句子，每行一条。</p>
          <div className="motto-list">
            {settings.mottos.map((motto, index) => (
              <div className="motto-row" key={`motto-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <input
                  name={`motto-${index + 1}`}
                  autoComplete="off"
                  value={motto}
                  placeholder={`第 ${index + 1} 条座右铭…`}
                  onChange={(e) =>
                    field(
                      "mottos",
                      settings.mottos.map((item, i) =>
                        i === index ? e.target.value : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    field(
                      "mottos",
                      settings.mottos.filter((_, i) => i !== index),
                    )
                  }
                  aria-label={`删除第 ${index + 1} 条座右铭`}
                >
                  <X />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="add-motto"
              onClick={() => field("mottos", [...settings.mottos, ""])}
            >
              <Plus /> 添加一条座右铭
            </button>
          </div>
          <h2>联系方式</h2>
          <label>
            GitHub 昵称
            <input
              name="github-handle"
              autoComplete="off"
              value={settings.github_handle}
              onChange={(e) => field("github_handle", e.target.value)}
            />
          </label>
          <label>
            GitHub 链接
            <input
              type="url"
              name="github-url"
              autoComplete="url"
              value={settings.github_url}
              onChange={(e) => field("github_url", e.target.value)}
            />
          </label>
          <div className="settings-platform-row">
            <label>公众号名称<input name="wechat-handle" autoComplete="off" value={settings.wechat_handle} onChange={(e) => field("wechat_handle", e.target.value)} /></label>
            <label>公众号链接<input type="url" name="wechat-url" autoComplete="url" value={settings.wechat_url} onChange={(e) => field("wechat_url", e.target.value)} /></label>
          </div>
          <div className="settings-platform-row">
            <label>抖音昵称<input name="douyin-handle" autoComplete="off" value={settings.douyin_handle} onChange={(e) => field("douyin_handle", e.target.value)} /></label>
            <label>抖音链接<input type="url" name="douyin-url" autoComplete="url" value={settings.douyin_url} onChange={(e) => field("douyin_url", e.target.value)} /></label>
          </div>
          <div className="settings-platform-row">
            <label>小红书昵称<input name="xiaohongshu-handle" autoComplete="off" value={settings.xiaohongshu_handle} onChange={(e) => field("xiaohongshu_handle", e.target.value)} /></label>
            <label>小红书链接<input type="url" name="xiaohongshu-url" autoComplete="url" value={settings.xiaohongshu_url} onChange={(e) => field("xiaohongshu_url", e.target.value)} /></label>
          </div>
          <label>
            邮箱
            <input
              type="email"
              name="contact-email"
              autoComplete="email"
              spellCheck={false}
              value={settings.email}
              onChange={(e) => field("email", e.target.value)}
            />
          </label>
        </section>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(authApi.isAuthenticated());
  const [mobile, setMobile] = useState(false);
  const { theme, toggleTheme } = useAdminTheme();
  if (!authed) return <Login done={() => setAuthed(true)} theme={theme} onToggleTheme={toggleTheme} />;
  const logout = () => {
    authApi.logout();
    setAuthed(false);
  };
  return (
    <AdminUiProvider>
      <div className="admin-shell" data-admin-theme={theme}>
        <a className="admin-skip-link" href="#admin-main">跳到主要内容</a>
        <div className={mobile ? "sidebar-wrap open" : "sidebar-wrap"}>
          {mobile ? <button type="button" className="admin-sidebar-scrim" onClick={() => setMobile(false)} aria-label="关闭导航" /> : null}
          <Sidebar logout={logout} theme={theme} onToggleTheme={toggleTheme} onNavigate={() => setMobile(false)} />
        </div>
        <header className="admin-mobile-head">
          <button type="button" onClick={() => setMobile((value) => !value)} aria-label={mobile ? "关闭导航" : "打开导航"} aria-expanded={mobile}>
            {mobile ? <X /> : <Menu />}
          </button>
          <strong>小潘同学</strong>
        </header>
        <main className="admin-main" id="admin-main">
          <Routes>
            <Route index element={<DashboardView />} />
            <Route path="posts" element={<PostsView />} />
            <Route path="posts/new" element={<PostEditor />} />
            <Route path="posts/:id" element={<PostEditor />} />
            <Route path="notes" element={<NotesAdmin />} />
            <Route path="repositories" element={<RepositoriesAdmin />} />
            <Route path="resumes" element={<ResumeVersionsAdmin />} />
            <Route path="settings" element={<SettingsView />} />
          </Routes>
        </main>
      </div>
    </AdminUiProvider>
  );
}
