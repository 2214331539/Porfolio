import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { repositoryBreadcrumbs } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';

type RepositoryBrowserProps = {
  repositories: ContentRepository[];
  currentId: number | null;
  contentLabel: string;
  onSelect: (id: number | null) => void;
};

export function RepositoryBrowser({ repositories, currentId, contentLabel, onSelect }: RepositoryBrowserProps) {
  const current = repositories.find((repository) => repository.id === currentId);
  const breadcrumbs = repositoryBreadcrumbs(repositories, currentId);
  const children = repositories
    .filter((repository) => repository.parent_id === currentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-CN'));

  return (
    <section className="repository-browser" aria-label={`${contentLabel}仓库`}>
      <header className="repository-toolbar">
        <nav className="repository-breadcrumbs" aria-label="仓库路径">
          <button type="button" onClick={() => onSelect(null)} className={currentId === null ? 'active' : ''}>
            <FolderOpen /> 全部仓库
          </button>
          {breadcrumbs.map((repository) => (
            <span key={repository.id}>
              <ChevronRight />
              <button type="button" onClick={() => onSelect(repository.id)} className={repository.id === currentId ? 'active' : ''}>
                {repository.name}
              </button>
            </span>
          ))}
        </nav>
        <span>{current ? current.description || `${current.name}中的${contentLabel}` : `按仓库浏览${contentLabel}`}</span>
      </header>
      {children.length ? (
        <div className="repository-grid">
          {children.map((repository) => (
            <button className="repository-card" type="button" key={repository.id} onClick={() => onSelect(repository.id)}>
              <span className="repository-folder"><Folder /></span>
              <span className="repository-card-copy">
                <strong>{repository.name}</strong>
                <small>{repository.description || '打开这个仓库'}</small>
              </span>
              <span className="repository-count">
                {repository.child_count ? `${repository.child_count} 个子仓库 · ` : ''}{repository.item_count} 篇
              </span>
              <ChevronRight />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
