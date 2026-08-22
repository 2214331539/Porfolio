import { FormEvent, useEffect, useRef, useState } from "react";
import {
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
  Save,
  Settings,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { authApi } from "../../features/auth/api/auth-api";
import { contentApi } from "../../features/content/api/content-api";
import type { Note } from "../../entities/note/model/types";
import type { Post } from "../../entities/post/model/types";
import type { ContentRepository } from "../../entities/repository/model/types";
import type { Dashboard, SiteSettings } from "../../entities/site/model/types";
import { Stat } from "../../shared/ui";
import { RepositorySelect } from "../../features/content/ui/RepositorySelect";
import { RepositoriesAdmin } from "./RepositoriesAdmin";
import { ResumeVersionsAdmin } from "./ResumeVersionsAdmin";

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
    <button className="admin-theme-toggle" type="button" onClick={onToggle} aria-pressed={theme === "dark"}>
      {theme === "light" ? <Moon /> : <Sun />}
      <span>{theme === "light" ? "深色模式" : "浅色模式"}</span>
    </button>
  );
}

function Login({ done, theme, onToggleTheme }: { done: () => void; theme: AdminTheme; onToggleTheme: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
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
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

function Sidebar({ logout, theme, onToggleTheme }: { logout: () => void; theme: AdminTheme; onToggleTheme: () => void }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">
        <strong>小潘同学</strong>
      </div>
      <nav>
        <small>工作区</small>
        <NavLink to="/admin" end>
          <LayoutDashboard />
          总览
        </NavLink>
        <NavLink to="/admin/posts">
          <FileText />
          文章管理
        </NavLink>
        <NavLink to="/admin/notes">
          <Image />
          图文笔记
        </NavLink>
        <NavLink to="/admin/repositories">
          <FolderTree />
          仓库管理
        </NavLink>
        <NavLink to="/admin/resumes">
          <Files />
          简历版本
        </NavLink>
        <small>站点</small>
        <NavLink to="/admin/settings">
          <Settings />
          全局设置
        </NavLink>
      </nav>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button onClick={logout}>
        <LogOut />
        退出登录
      </button>
    </aside>
  );
}

function DashboardView() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState("");
  useEffect(() => {
    contentApi
      .getDashboard()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "仪表盘加载失败"),
      );
  }, []);
  if (error) return <div className="form-error">{error}</div>;
  if (!data) return <div className="page-loading">正在加载工作台…</div>;
  return (
    <div>
      <div className="admin-title">
        <div>
          <p>CONTENT / DASHBOARD</p>
          <h1>下午好，今天写点什么？</h1>
        </div>
        <Link to="/admin/posts/new" className="primary-button">
          <Plus />
          新建文章
        </Link>
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
        {data.recent_posts.map((post) => (
          <div className="recent-row" key={post.id}>
            <div className="row-icon">
              <FileText />
            </div>
            <div>
              <strong>{post.title}</strong>
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
            <b>{post.views} 阅读</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostsView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    contentApi
      .listPosts(true)
      .then(setPosts)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "文章加载失败"),
      );
  }, []);
  async function remove(id: number) {
    if (!confirm("删除后将永久移除这篇文章，且无法恢复。继续吗？")) return;
    try {
      await contentApi.deletePost(id);
      setPosts((items) => items.filter((item) => item.id !== id));
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
        <div className="table-head">
          <span>文章</span>
          <span>状态</span>
          <span>阅读</span>
          <span>操作</span>
        </div>
        {posts.map((post) => (
          <div className="content-row" key={post.id}>
            <div>
              <strong>{post.title}</strong>
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
                onClick={() => remove(post.id)}
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
  const [content, setContent] = useState("# 开始写作\n\n在这里写下正文……");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "文章加载失败"),
      );
  }, [editingId]);
  async function uploadCover(file: File | undefined) {
    if (!file) return;
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
      await contentApi.savePost({
        id: editingId,
        title: title.trim(),
        slug: title.trim().toLowerCase().replace(/\s+/g, "-"),
        excerpt,
        content,
        cover_url: coverUrl.trim() || null,
        tag_names: tagNames.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
        repository_id: repositoryId,
        is_pinned: isPinned,
        is_private: isPrivate,
        status,
      });
      navigate("/admin/posts");
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
          onClick={() => navigate("/admin/posts")}
          aria-label="关闭编辑器"
        >
          <X />
        </button>
        <div>
          <span className="save-state">
            {saving ? "正在保存…" : editingId ? "编辑文章" : "新建文章"}
          </span>
          <button onClick={() => submit("draft")} disabled={saving}>
            保存草稿
          </button>
          <button
            className="primary-button"
            onClick={() => submit("published")}
            disabled={saving}
          >
            发布文章
          </button>
        </div>
      </div>
      <div className="editor-sheet">
        {error ? <div className="form-error">{error}</div> : null}
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="无标题文章"
        />
        <input
          className="excerpt-input"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="写一句摘要，让读者知道这篇文章关于什么…"
        />
        <section className="post-editor-meta" aria-label="文章属性">
          <div className="cover-upload-box">
            <div className="cover-upload-heading">
              <div>
                <strong>文章封面</strong>
                <small>图片会上传到后端 uploads 目录，不使用前端 public 静态资源。</small>
              </div>
              {coverUrl ? (
                <button type="button" onClick={() => setCoverUrl("")}>移除封面</button>
              ) : null}
            </div>
            {coverUrl ? <img className="cover-preview" src={coverUrl} alt="文章封面预览" /> : null}
            <label className="cover-file-input">
              <Upload />
              <span>{uploadingCover ? "正在上传…" : coverUrl ? "更换封面" : "上传封面"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => uploadCover(event.target.files?.[0])}
                disabled={uploadingCover}
              />
            </label>
          </div>
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
        <div
          className="editor-toolbar"
          role="toolbar"
          aria-label="Markdown 工具栏"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("# ", "", "标题");
            }}
          >
            H1
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("## ", "", "标题");
            }}
          >
            H2
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("**", "**");
            }}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("*", "*");
            }}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("`", "`");
            }}
          >
            code
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("[", "](https://)", "链接文本");
            }}
          >
            链接
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
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
        />
      </div>
    </div>
  );
}

type NoteDraft = {
  title: string;
  content: string;
  images: string;
  topics: string;
  repository_id: number | null;
  status: "draft" | "published";
  is_pinned: boolean;
};
const emptyNote: NoteDraft = {
  title: "",
  content: "",
  images: "",
  topics: "",
  repository_id: null,
  status: "draft",
  is_pinned: false,
};
function draftFromNote(note: Note): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    images: note.images.join("\n"),
    topics: note.topics.join("\n"),
    repository_id: note.repository?.id ?? note.repository_id ?? null,
    status: note.status,
    is_pinned: note.is_pinned,
  };
}
function NotesAdmin() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [draft, setDraft] = useState<NoteDraft>(emptyNote);
  const [editingId, setEditingId] = useState<number>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    Promise.all([contentApi.listNotes(true), contentApi.listRepositories("note", true)])
      .then(([noteItems, repositoryItems]) => {
        setNotes(noteItems);
        setRepositories(repositoryItems);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "图文加载失败"),
      );
  }, []);
  function edit(note?: Note) {
    setEditingId(note?.id);
    setDraft(note ? draftFromNote(note) : emptyNote);
    setError("");
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file) => contentApi.uploadImage(file)),
      );
      setDraft((value) => ({
        ...value,
        images: [value.images, ...uploaded.map((item) => item.url)]
          .filter(Boolean)
          .join("\n"),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }
  async function save() {
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
        images: draft.images
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        topics: draft.topics
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean),
        repository_id: draft.repository_id,
        status: draft.status,
        is_pinned: draft.is_pinned,
      });
      setNotes((items) =>
        editingId
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      edit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "图文保存失败");
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: number) {
    if (!confirm("删除后将永久移除这条图文笔记，且无法恢复。继续吗？")) return;
    try {
      await contentApi.deleteNote(id);
      setNotes((items) => items.filter((item) => item.id !== id));
      if (editingId === id) edit();
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
        <button className="primary-button" onClick={() => edit()}>
          <Plus />
          发布图文
        </button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="notes-admin-layout">
        <div className="admin-panel table-panel">
          <div className="table-head">
            <span>标题</span>
            <span>状态</span>
            <span>点赞</span>
            <span>操作</span>
          </div>
          {notes.map((note) => (
            <div className="content-row note-admin-row" key={note.id}>
              <div>
                <strong>{note.title}</strong>
                <small>
                  {note.repository?.name || "未归档"} · {note.topics.map((topic) => `#${topic}`).join(" ")}
                </small>
              </div>
              <span className={`status ${note.status}`}>
                {note.status === "published" ? "已发布" : "草稿"}
              </span>
              <span>{note.likes}</span>
              <div>
                <button onClick={() => edit(note)}>编辑</button>
                <button
                  onClick={() => remove(note.id)}
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
            <h2>{editingId ? "编辑图文" : "新建图文"}</h2>
            {editingId ? (
              <button onClick={() => edit()}>
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
          <label>
            图片地址 <small>每行一张 URL</small>
            <textarea
              value={draft.images}
              onChange={(e) =>
                setDraft((value) => ({ ...value, images: e.target.value }))
              }
            />
          </label>
          <label className="upload-field">
            上传图片
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => upload(e.target.files)}
              disabled={uploading}
            />
            <small>
              {uploading
                ? "正在上传…"
                : "支持 JPG、PNG、WebP；上传后会自动加入图片地址"}
            </small>
          </label>
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
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft((value) => ({
                  ...value,
                  status: e.target.value as NoteDraft["status"],
                }))
              }
            >
              <option value="draft">保存草稿</option>
              <option value="published">直接发布</option>
            </select>
            <button className="primary-button" onClick={save} disabled={saving}>
              {saving ? "保存中…" : "保存图文"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsView() {
  const [settings, setState] = useState<SiteSettings>();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    contentApi
      .getSettings()
      .then(setState)
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
    setError("");
    try {
      await contentApi.saveSettings(current);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "设置保存失败");
    }
  }
  return (
    <div>
      <div className="admin-title">
        <div>
          <p>SITE / SETTINGS</p>
          <h1>全局设置</h1>
        </div>
        <button className="primary-button" onClick={save}>
          <Save />
          {saved ? "已保存" : "保存设置"}
        </button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="settings-grid">
        <section className="admin-panel">
          <h2>基础信息</h2>
          <label>
            站点名称
            <input
              value={settings.site_title}
              onChange={(e) => field("site_title", e.target.value)}
            />
          </label>
          <label>
            站点描述
            <textarea
              value={settings.site_description}
              onChange={(e) => field("site_description", e.target.value)}
            />
          </label>
          <label>
            页脚文字
            <input
              value={settings.footer_text}
              onChange={(e) => field("footer_text", e.target.value)}
            />
          </label>
          <label>
            备案号
            <input
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
                  value={motto}
                  placeholder={`第 ${index + 1} 条座右铭`}
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
            GitHub
            <input
              value={settings.github_url}
              onChange={(e) => field("github_url", e.target.value)}
            />
          </label>
          <label>
            邮箱
            <input
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
    <div className="admin-shell" data-admin-theme={theme}>
      <div className={mobile ? "sidebar-wrap open" : "sidebar-wrap"}>
        <Sidebar logout={logout} theme={theme} onToggleTheme={toggleTheme} />
      </div>
      <header className="admin-mobile-head">
        <button onClick={() => setMobile((value) => !value)}>
          {mobile ? <X /> : <Menu />}
        </button>
        <strong>小潘同学</strong>
      </header>
      <main className="admin-main">
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
  );
}
