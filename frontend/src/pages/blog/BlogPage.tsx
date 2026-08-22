import { useEffect, useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Post } from '../../entities/post/model/types';
import type { ContentRepository } from '../../entities/repository/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { RepositoryBrowser } from '../../features/content/ui/RepositoryBrowser';
import { PostCard } from '../../shared/ui';

export default function BlogPage() {
  const cachedPosts = contentApi.getCachedPosts();
  const cachedRepositories = contentApi.getCachedRepositories('post');
  const [posts, setPosts] = useState<Post[]>(cachedPosts ?? []);
  const [repositories, setRepositories] = useState<ContentRepository[]>(cachedRepositories ?? []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(!cachedPosts || !cachedRepositories);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([contentApi.listPosts(), contentApi.listRepositories('post')])
      .then(([postItems, repositoryItems]) => {
        setPosts(postItems);
        setRepositories(repositoryItems);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '文章加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const requestedId = Number(searchParams.get('repository')) || null;
  const currentId = requestedId && repositories.some((repository) => repository.id === requestedId) ? requestedId : null;
  const shown = useMemo(
    () => posts.filter((post) => (post.repository?.id ?? post.repository_id ?? null) === currentId),
    [currentId, posts],
  );
  const hasChildren = repositories.some((repository) => repository.parent_id === currentId);
  function selectRepository(id: number | null) {
    setSearchParams(id ? { repository: String(id) } : {}, { replace: true });
  }

  if (loading) return <div className="page-loading">正在整理文章仓库…</div>;
  if (error) return <div className="page-loading"><div className="form-error">{error}</div></div>;
  return (
    <main className="content-library blog-library">
      <RepositoryBrowser repositories={repositories} currentId={currentId} contentLabel="文章" onSelect={selectRepository} />
      {shown.length ? (
        <div className="repository-content-grid post-repository-grid">
          {shown.map((post) => <PostCard key={post.id} post={post} variant={post.cover_url ? 'visual repository-item' : 'repository-item'} />)}
        </div>
      ) : hasChildren ? null : (
        <div className="repository-empty"><Archive /><strong>这里还没有文章</strong><span>可以返回上一级仓库继续浏览。</span></div>
      )}
    </main>
  );
}
