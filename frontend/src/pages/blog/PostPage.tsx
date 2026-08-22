import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { marked } from 'marked';
import { contentApi } from '../../features/content/api/content-api';
import type { Post } from '../../entities/post/model/types';
import { Metadata } from '../../shared/ui';

export default function PostPage() {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<Post>();
  const [all, setAll] = useState<Post[]>([]);
  const [fontSize, setFontSize] = useState(17);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([contentApi.getPost(slug), contentApi.listPosts()])
      .then(([current, posts]) => {
        setPost(current);
        setAll(posts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '文章加载失败'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (progressRef.current) progressRef.current.style.width = `${max ? (window.scrollY / max) * 100 : 0}%`;
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
    };
  }, []);

  const html = useMemo(() => marked.parse(post?.content || '') as string, [post?.content]);
  const neighbors = useMemo(() => {
    if (!post) return {};
    const repositoryId = post.repository?.id ?? post.repository_id ?? null;
    const siblings = all.filter((item) => (item.repository?.id ?? item.repository_id ?? null) === repositoryId);
    const index = siblings.findIndex((item) => item.slug === slug);
    return {
      prev: index > 0 ? siblings[index - 1] : undefined,
      next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined,
    };
  }, [all, post, slug]);

  if (loading) return <div className="page-loading">正在加载文章…</div>;
  if (error || !post) return <div className="page-loading"><div className="form-error">{error || '文章不存在'}</div><Link className="text-link" to="/blog">返回文章仓库</Link></div>;

  const repositoryId = post.repository?.id ?? post.repository_id;
  const backTo = repositoryId ? `/blog?repository=${repositoryId}` : '/blog';
  return (
    <>
      <div ref={progressRef} className="reading-progress" />
      <article className="article-page refined-article">
        <Link to={backTo} className="back-link"><ArrowLeft />返回{post.repository?.name || '文章仓库'}</Link>
        <header className="article-header">
          <div className="article-label">
            <span>{post.repository?.name || post.category?.name || '未归档'}</span>
            <span>{new Date(post.published_at).toLocaleDateString('zh-CN')}</span>
          </div>
          <h1>{post.title}</h1>
          {post.excerpt ? <p>{post.excerpt}</p> : null}
          <Metadata post={post} />
        </header>
        {post.cover_url ? <figure className="article-cover"><img src={post.cover_url} alt={`${post.title}封面`} /></figure> : null}
        <div className="article-reading-tools" aria-label="阅读字号">
          <span>正文 {fontSize}px</span>
          <button type="button" onClick={() => setFontSize((size) => Math.max(15, size - 1))} aria-label="减小字号"><Minus /></button>
          <button type="button" onClick={() => setFontSize((size) => Math.min(21, size + 1))} aria-label="增大字号"><Plus /></button>
        </div>
        <div id="top" className="markdown-body article-prose" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: html }} />
        <footer className="article-nav">
          {neighbors.prev ? <Link to={`/blog/${neighbors.prev.slug}`}><small>上一篇</small><span><ArrowLeft />{neighbors.prev.title}</span></Link> : <div />}
          {neighbors.next ? <Link to={`/blog/${neighbors.next.slug}`}><small>下一篇</small><span>{neighbors.next.title}<ArrowRight /></span></Link> : null}
        </footer>
      </article>
    </>
  );
}
