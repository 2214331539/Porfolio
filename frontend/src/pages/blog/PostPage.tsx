import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Clock, Eye } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Post } from '../../entities/post/model/types';
import type { ContentRepository } from '../../entities/repository/model/types';
import { repositoryBreadcrumbs } from '../../entities/repository/model/tree';
import { contentApi } from '../../features/content/api/content-api';
import { formatDate } from '../../shared/format';
import { renderArticle, type TocItem } from '../../shared/markdown';
import { PageState } from '../../shared/ui';

function useReadingProgress(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [ref]);
}

function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  useEffect(() => {
    const headings = items.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => Boolean(node));
    const update = () => {
      let current = headings[0]?.id ?? '';
      for (const heading of headings) if (heading.getBoundingClientRect().top < 120) current = heading.id;
      setActive(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [items]);
  if (items.length < 2) return null;
  return (
    <nav className="toc" aria-label="文章目录">
      <p>目录</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={`level-${item.level} ${item.id === active ? 'active' : ''}`}>
            <a href={`#${item.id}`} onClick={(event) => { event.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#${item.id}`); }}>{item.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function PostPage() {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<Post>();
  const [all, setAll] = useState<Post[]>([]);
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const progressRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  useReadingProgress(progressRef);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([contentApi.getPost(slug), contentApi.listPosts(), contentApi.listRepositories('post')])
      .then(([current, posts, repositoryItems]) => { setPost(current); setAll(posts); setRepositories(repositoryItems); })
      .catch((err) => setError(err instanceof Error ? err.message : '文章加载失败'))
      .finally(() => setLoading(false));
  }, [slug]);

  const article = useMemo(() => renderArticle(post?.content || ''), [post?.content]);
  const repositoryId = post?.repository?.id ?? post?.repository_id ?? null;
  const breadcrumbs = repositoryBreadcrumbs(repositories, repositoryId);
  const neighbors = useMemo(() => {
    if (!post) return {};
    const siblings = all
      .filter((item) => (item.repository?.id ?? item.repository_id ?? null) === repositoryId)
      .sort((a, b) => a.published_at.localeCompare(b.published_at) || a.id - b.id);
    const index = siblings.findIndex((item) => item.id === post.id);
    return { prev: index > 0 ? siblings[index - 1] : undefined, next: index >= 0 ? siblings[index + 1] : undefined };
  }, [all, post, repositoryId]);

  useEffect(() => {
    if (post) document.title = `${post.title} · 小潘同学`;
    return () => { document.title = '小潘同学'; };
  }, [post]);

  // Copy buttons on code blocks, and jump to the heading in the URL once the article is rendered.
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-code')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-code';
      button.textContent = '复制';
      button.addEventListener('click', () => {
        void navigator.clipboard?.writeText(pre.querySelector('code')?.textContent ?? '').then(() => {
          button.textContent = '已复制';
          window.setTimeout(() => { button.textContent = '复制'; }, 1500);
        });
      });
      pre.append(button);
    });
    if (window.location.hash) {
      try { document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView(); } catch { /* ignore malformed hashes */ }
    }
  }, [article.html]);

  if (loading) return <PageState>正在加载文章…</PageState>;
  if (error || !post) return <PageState tone="error">{error || '文章不存在'} <Link to="/blog">返回文章列表</Link></PageState>;

  const backTo = repositoryId ? `/blog?repository=${repositoryId}` : '/blog';
  return (
    <>
      <div className="reading-progress" aria-hidden="true"><div ref={progressRef} /></div>
      <div className="article-layout container">
        <article className="article">
          <nav className="breadcrumbs" aria-label="文章位置">
            <Link to="/blog">文章</Link>
            {breadcrumbs.map((item) => <span key={item.id}><ChevronRight aria-hidden="true" /><Link to={`/blog?repository=${item.id}`}>{item.name}</Link></span>)}
          </nav>
          <header className="article-head">
            <h1>{post.title}</h1>
            {post.excerpt ? <p className="article-lead">{post.excerpt}</p> : null}
            <div className="article-meta">
              <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              <span><Clock aria-hidden="true" />{post.reading_time} 分钟</span>
              <span><Eye aria-hidden="true" />{post.views.toLocaleString()} 次阅读</span>
              {post.tags.map((tag) => <span className="tag" key={tag.id}>#{tag.name}</span>)}
            </div>
          </header>
          {post.cover_url ? <figure className="article-cover"><img src={post.cover_url} alt="" /></figure> : null}
          <div ref={proseRef} className="prose" dangerouslySetInnerHTML={{ __html: article.html }} />
          <footer className="article-foot">
            <div className="article-pager">
              {neighbors.prev ? <Link to={`/blog/${neighbors.prev.slug}`}><small><ArrowLeft aria-hidden="true" />上一篇</small><span>{neighbors.prev.title}</span></Link> : <span />}
              {neighbors.next ? <Link className="next" to={`/blog/${neighbors.next.slug}`}><small>下一篇<ArrowRight aria-hidden="true" /></small><span>{neighbors.next.title}</span></Link> : <span />}
            </div>
            <Link className="button small" to={backTo}><ArrowLeft aria-hidden="true" />返回{post.repository?.name ?? '文章列表'}</Link>
          </footer>
        </article>
        <aside className="article-aside"><TableOfContents items={article.toc} /></aside>
      </div>
    </>
  );
}
