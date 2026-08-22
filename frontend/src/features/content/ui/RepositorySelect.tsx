import { flattenRepositories } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';

type RepositorySelectProps = {
  repositories: ContentRepository[];
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
};

export function RepositorySelect({ repositories, value, onChange, label = '所属仓库' }: RepositorySelectProps) {
  return (
    <label className="repository-select-field">
      {label} <small>支持选择任意层级仓库</small>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">未归档</option>
        {flattenRepositories(repositories).map((repository) => (
          <option value={repository.id} key={repository.id}>
            {'　'.repeat(repository.depth)}{repository.depth ? '└ ' : ''}{repository.name}
          </option>
        ))}
      </select>
    </label>
  );
}
