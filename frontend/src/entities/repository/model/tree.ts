import type { ContentRepository } from './types';

export type RepositoryTreeRow = ContentRepository & { depth: number };

const byOrder = (a: ContentRepository, b: ContentRepository) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-CN');

export function childrenOf(repositories: ContentRepository[], parentId: number | null) {
  return repositories.filter((repository) => repository.parent_id === parentId).sort(byOrder);
}

/** Depth-first rows; rows whose parent is missing (or that form a cycle) are appended at depth 0. */
export function flattenRepositories(repositories: ContentRepository[]): RepositoryTreeRow[] {
  const byParent = new Map<number | null, ContentRepository[]>();
  repositories.forEach((repository) => {
    const siblings = byParent.get(repository.parent_id) ?? [];
    siblings.push(repository);
    byParent.set(repository.parent_id, siblings);
  });
  byParent.forEach((items) => items.sort(byOrder));

  const rows: RepositoryTreeRow[] = [];
  const visited = new Set<number>();
  function append(parentId: number | null, depth: number) {
    (byParent.get(parentId) ?? []).forEach((repository) => {
      if (visited.has(repository.id)) return;
      visited.add(repository.id);
      rows.push({ ...repository, depth });
      append(repository.id, depth + 1);
    });
  }
  append(null, 0);
  repositories.forEach((repository) => {
    if (!visited.has(repository.id)) rows.push({ ...repository, depth: 0 });
  });
  return rows;
}

export function repositoryBreadcrumbs(repositories: ContentRepository[], currentId: number | null) {
  const byId = new Map(repositories.map((repository) => [repository.id, repository]));
  const path: ContentRepository[] = [];
  const visited = new Set<number>();
  let current = currentId ? byId.get(currentId) : undefined;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

/** The repository itself plus every repository nested below it. */
export function descendantIds(repositories: ContentRepository[], rootId: number) {
  const ids = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    repositories.forEach((repository) => {
      if (repository.parent_id !== null && ids.has(repository.parent_id) && !ids.has(repository.id)) {
        ids.add(repository.id);
        changed = true;
      }
    });
  }
  return ids;
}

/** Item counts per repository, including everything in nested repositories. */
export function totalCounts(repositories: ContentRepository[], itemRepositoryIds: Array<number | null | undefined>) {
  const direct = new Map<number, number>();
  itemRepositoryIds.forEach((id) => { if (id != null) direct.set(id, (direct.get(id) ?? 0) + 1); });
  const totals = new Map<number, number>();
  repositories.forEach((repository) => {
    let sum = 0;
    descendantIds(repositories, repository.id).forEach((id) => { sum += direct.get(id) ?? 0; });
    totals.set(repository.id, sum);
  });
  return totals;
}

export function repositoryPathLabel(repositories: ContentRepository[], id: number | null | undefined) {
  return id ? repositoryBreadcrumbs(repositories, id).map((repository) => repository.name).join(' / ') : '';
}
