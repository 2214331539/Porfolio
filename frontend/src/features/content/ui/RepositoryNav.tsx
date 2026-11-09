import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { childrenOf, repositoryBreadcrumbs } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';

type RepositoryNavProps = {
  repositories: ContentRepository[];
  totals: Map<number, number>;
  total: number;
  currentId: number | null;
  allLabel: string;
  onSelect: (id: number | null) => void;
};

/** Public sidebar tree: every repository is reachable in one click, with counts that include nested repositories. */
export function RepositoryNav({ repositories, totals, total, currentId, allLabel, onSelect }: RepositoryNavProps) {
  const activePath = useMemo(() => new Set(repositoryBreadcrumbs(repositories, currentId).map((item) => item.id)), [currentId, repositories]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function branch(parentId: number | null, depth: number) {
    return childrenOf(repositories, parentId).map((repository) => {
      const children = childrenOf(repositories, repository.id);
      const open = children.length > 0 && (!collapsed.has(repository.id) || activePath.has(repository.id));
      return (
        <li key={repository.id}>
          <div className={`repo-nav-item ${repository.id === currentId ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
            {children.length ? (
              <button type="button" className={`repo-nav-caret ${open ? 'open' : ''}`} onClick={() => toggle(repository.id)} aria-label={open ? `收起${repository.name}` : `展开${repository.name}`} aria-expanded={open}>
                <ChevronRight aria-hidden="true" />
              </button>
            ) : <span className="repo-nav-caret" aria-hidden="true" />}
            <button type="button" className="repo-nav-label" onClick={() => onSelect(repository.id)} aria-current={repository.id === currentId ? 'page' : undefined}>
              <span>{repository.name}</span>
              <small>{totals.get(repository.id) ?? 0}</small>
            </button>
          </div>
          {open ? <ul>{branch(repository.id, depth + 1)}</ul> : null}
        </li>
      );
    });
  }

  return (
    <nav className="repo-nav" aria-label="内容仓库">
      <div className={`repo-nav-item ${currentId === null ? 'active' : ''}`}>
        <span className="repo-nav-caret" aria-hidden="true" />
        <button type="button" className="repo-nav-label" onClick={() => onSelect(null)} aria-current={currentId === null ? 'page' : undefined}>
          <span>{allLabel}</span><small>{total}</small>
        </button>
      </div>
      <ul>{branch(null, 0)}</ul>
    </nav>
  );
}
