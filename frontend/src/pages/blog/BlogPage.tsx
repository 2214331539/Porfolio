import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileText, ListTree } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Post } from '../../entities/post/model/types';
import type { ContentRepository } from '../../entities/repository/model/types';
import { childrenOf, descendantIds, repositoryBreadcrumbs, totalCounts } from '../../entities/repository/model/tree';
import { contentApi } from '../../features/content/api/content-api';
import { RepositoryNav } from '../../features/content/ui/RepositoryNav';
import { EmptyState, PageState, PostRow } from '../../shared/ui';

const repositoryOf = (post: Post) => post.repository?.id ?? post.repository_id ?? null;

export default function BlogPage() {
  const cachedPosts = contentApi.getCachedPosts();
  const cachedRepositories = contentApi.getCachedRepositories('post');
  const [posts, setPosts] = useState<Post[]>(cachedPosts ?? []);
  const [repositories, setRepositories] = useState<ContentRepository[]>(cachedRepositories ?? []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(!cachedPosts || !cachedRepositories);
  const [error, setError] = useState('');
  const [treeOpen, setTreeOpen] = useState(false);

  useEffect(() => {
    Promise.all([contentApi.listPosts(), contentApi.listRepositories('post')])
      .then(([postItems, repositoryItems]) => { setPosts(postItems); setRepositories(repositoryItems); })
      .catch((err) => setError(err instanceof Error ? err.message : '文章加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const requestedId = Number(searchParams.get('repository')) || null;
  const current = repositories.find((repository) => repository.id === requestedId) ?? null;
  const currentId = current?.id ?? null;
  const totals = useMemo(() => totalCounts(repositories, posts.map(repositoryOf)), [posts, repositories]);
  const breadcrumbs = repositoryBreadcrumbs(repositories, currentId);

  const groups = useMemo(() => {
    const scope = currentId ? descendantIds(repositories, currentId) : null;
    const shown = posts
      .filter((post) => !scope || scope.has(repositoryOf(post) ?? -1))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.published_at.localeCompare(a.published_at) || b.id - a.id);
    const byYear = new Map<string, Post[]>();
    shown.forEach((post) => {
      const key = post.is_pinned ? '置顶' : String(new Date(post.published_at).getFullYear());
      byYear.set(key, [...(byYear.get(key) ?? []), post]);
    });
    return { count: shown.length, entries: [...byYear.entries()] };
  }, [currentId, posts, repositories]);

  useEffect(() => {
    document.title = `${current ? current.name : '文章'} · 小潘同学`;
    return () => { document.title = '小潘同学'; };
  }, [current]);

  function select(id: number | null) {
    setSearchParams(id ? { repository: String(id) } : {});
    setTreeOpen(false);
    window.scrollTo({ top: 0 });
  }

  if (loading) return <PageState>正在整理文章…</PageState>;
  if (error) return <PageState tone="error">{error}</PageState>;

  const subRepositories = childrenOf(repositories, currentId);
  return (
    <div className="library container">
      <aside className={`library-aside ${treeOpen ? 'open' : ''}`}>
        <RepositoryNav repositories={repositories} totals={totals} total={posts.length} currentId={currentId} allLabel="全部文章" onSelect={select} />
      </aside>
      <section className="library-main">
        <header className="library-head">
          <nav className="breadcrumbs" aria-label="当前位置">
            <button type="button" onClick={() => select(null)}>文章</button>
            {breadcrumbs.map((item) => (
              <span key={item.id}><ChevronRight aria-hidden="true" /><button type="button" onClick={() => select(item.id)} aria-current={item.id === currentId ? 'page' : undefined}>{item.name}</button></span>
            ))}
          </nav>
          <div className="library-title">
            <h1>{current?.name ?? '全部文章'}</h1>
            <span>{groups.count} 篇</span>
            <button className="button small library-tree-toggle" type="button" onClick={() => setTreeOpen((value) => !value)} aria-expanded={treeOpen}>
              <ListTree aria-hidden="true" />仓库
            </button>
          </div>
          {current?.description ? <p>{current.description}</p> : null}
          {subRepositories.length ? (
            <div className="chip-row" aria-label="子仓库">
              {subRepositories.map((repository) => (
                <button className="chip" type="button" key={repository.id} onClick={() => select(repository.id)}>
                  {repository.name}<small>{totals.get(repository.id) ?? 0}</small>
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {groups.count ? groups.entries.map(([year, items]) => (
          <section className="post-group" key={year} aria-label={year}>
            <h2>{year}</h2>
            <div className="post-list stamped">
              {items.map((post) => <PostRow key={post.id} post={post} stamp />)}
            </div>
          </section>
        )) : (
          <EmptyState icon={<FileText aria-hidden="true" />} title="这里还没有文章">
            <button className="button small" type="button" onClick={() => select(current?.parent_id ?? null)}>返回上一级</button>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
