import { useContext, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, FileText, FolderInput, Image, PenLine, Plus, Sparkles, TextQuote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteContext } from '../../app/providers/site-provider';
import type { Note } from '../../entities/note/model/types';
import type { Post } from '../../entities/post/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { errorMessage, relativeTime } from '../../shared/format';

type Entry = { key: string; kind: 'post' | 'note'; id: number; title: string; status: 'draft' | 'published'; updatedAt: string; publishedAt: string; repository?: string; views: number };

function greeting() {
  const hour = new Date().getHours();
  return hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
}

export function Dashboard() {
  const { settings } = useContext(SiteContext);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([contentApi.listPosts(true), contentApi.listNotes(true)])
      .then(([postItems, noteItems]) => { setPosts(postItems); setNotes(noteItems); })
      .catch((err) => setError(errorMessage(err, '工作台加载失败')))
      .finally(() => setLoading(false));
  }, []);

  const entries = useMemo<Entry[]>(() => [
    ...posts.map((post) => ({ key: `post-${post.id}`, kind: 'post' as const, id: post.id, title: post.title, status: post.status, updatedAt: post.updated_at, publishedAt: post.published_at, repository: post.repository?.name, views: post.views })),
    ...notes.map((note) => ({ key: `note-${note.id}`, kind: 'note' as const, id: note.id, title: note.title, status: note.status, updatedAt: note.updated_at, publishedAt: note.published_at, repository: note.repository?.name, views: note.views })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes, posts]);

  const drafts = entries.filter((entry) => entry.status === 'draft').slice(0, 5);
  const recent = entries.filter((entry) => entry.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6);
  const popular = [...posts].filter((post) => post.status === 'published').sort((a, b) => b.views - a.views).slice(0, 5);
  const unfiled = posts.filter((post) => !(post.repository?.id ?? post.repository_id)).length;
  const missingExcerpt = posts.filter((post) => post.status === 'published' && !post.excerpt.trim()).length;
  const totalViews = posts.reduce((sum, post) => sum + post.views, 0) + notes.reduce((sum, note) => sum + note.views, 0);
  const editHref = (entry: Entry) => `/admin/${entry.kind === 'post' ? 'posts' : 'notes'}/${entry.id}`;

  return (
    <div className="admin-page dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          <h1>{greeting()}，{settings?.site_title?.replace(/同学$/, '') || '你好'}</h1>
        </div>
      </header>

      <div className="quick-actions">
        <Link className="quick-action primary" to="/admin/posts/new"><PenLine aria-hidden="true" /><span><strong>写文章</strong><small>Markdown，草稿自动保存</small></span></Link>
        <Link className="quick-action" to="/admin/notes/new"><Image aria-hidden="true" /><span><strong>发图文</strong><small>拖入或粘贴多张图片</small></span></Link>
        <Link className="quick-action" to="/admin/portfolio/new"><Sparkles aria-hidden="true" /><span><strong>添加作品</strong><small>截图、链接与介绍</small></span></Link>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="stat-row">
        <div className="stat"><span>文章</span><strong>{loading ? '–' : posts.length}</strong><small>{posts.filter((post) => post.status === 'draft').length} 篇草稿</small></div>
        <div className="stat"><span>图文</span><strong>{loading ? '–' : notes.length}</strong><small>{notes.filter((note) => note.status === 'draft').length} 条草稿</small></div>
        <div className="stat"><span>累计阅读</span><strong>{loading ? '–' : totalViews.toLocaleString()}</strong><small>文章与图文</small></div>
        <div className="stat"><span>已发布</span><strong>{loading ? '–' : entries.filter((entry) => entry.status === 'published').length}</strong><small>前台可见</small></div>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel-head"><h2>继续编辑</h2><Link to="/admin/posts?status=draft">全部草稿<ArrowRight aria-hidden="true" /></Link></header>
          {drafts.length ? (
            <ul className="entry-list">
              {drafts.map((entry) => (
                <li key={entry.key}>
                  <Link to={editHref(entry)}>
                    {entry.kind === 'post' ? <FileText aria-hidden="true" /> : <Image aria-hidden="true" />}
                    <span><strong>{entry.title}</strong><small>{entry.repository ?? '未归档'} · {relativeTime(entry.updatedAt)}</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="panel-empty">{loading ? '加载中…' : '没有进行中的草稿。'}<Link to="/admin/posts/new"><Plus aria-hidden="true" />开始写一篇</Link></p>}
        </section>

        <section className="panel">
          <header className="panel-head"><h2>待整理</h2></header>
          <ul className="todo-list">
            <li><FolderInput aria-hidden="true" /><span>{unfiled ? <><strong>{unfiled}</strong> 篇文章还没有归档</> : '所有文章都已归档'}</span>{unfiled ? <Link to="/admin/posts?repo=unfiled">去整理</Link> : null}</li>
            <li><TextQuote aria-hidden="true" /><span>{missingExcerpt ? <><strong>{missingExcerpt}</strong> 篇已发布文章没有摘要</> : '已发布文章都有摘要'}</span>{missingExcerpt ? <Link to="/admin/posts?status=published">查看</Link> : null}</li>
            <li><BookOpen aria-hidden="true" /><span>座右铭 <strong>{settings?.mottos.length ?? 0}</strong> 条，首页随机展示</span><Link to="/admin/settings">编辑</Link></li>
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head"><h2>最近发布</h2><Link to="/admin/posts">文章库<ArrowRight aria-hidden="true" /></Link></header>
          <ul className="entry-list">
            {recent.map((entry) => (
              <li key={entry.key}>
                <Link to={editHref(entry)}>
                  {entry.kind === 'post' ? <FileText aria-hidden="true" /> : <Image aria-hidden="true" />}
                  <span><strong>{entry.title}</strong><small>{entry.repository ?? '未归档'} · {relativeTime(entry.publishedAt)}</small></span>
                  <em>{entry.views} 阅读</em>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head"><h2>阅读最多</h2></header>
          <ol className="rank-list">
            {popular.map((post, index) => (
              <li key={post.id}><span>{index + 1}</span><Link to={`/admin/posts/${post.id}`}>{post.title}</Link><em>{post.views}</em></li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
