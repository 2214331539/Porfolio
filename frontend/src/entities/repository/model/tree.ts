import type { ContentRepository } from './types';

export type RepositoryTreeRow = ContentRepository & { depth: number };

export function flattenRepositories(repositories: ContentRepository[]): RepositoryTreeRow[] {
  const byParent = new Map<number | null, ContentRepository[]>();
  repositories.forEach((repository) => {
    const siblings = byParent.get(repository.parent_id) ?? [];
    siblings.push(repository);
    byParent.set(repository.parent_id, siblings);
  });
  byParent.forEach((items) => items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-CN')));

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
