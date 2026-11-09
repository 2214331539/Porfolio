import { flattenRepositories } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';

type RepositorySelectProps = {
  id?: string;
  repositories: ContentRepository[];
  value: number | null;
  onChange: (value: number | null) => void;
  noneLabel?: string;
};

/** Native select listing the whole repository tree with indentation. */
export function RepositorySelect({ id, repositories, value, onChange, noneLabel = '未归档' }: RepositorySelectProps) {
  return (
    <select id={id} className="select" value={value ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
      <option value="">{noneLabel}</option>
      {flattenRepositories(repositories).map((repository) => (
        <option value={repository.id} key={repository.id}>
          {'　'.repeat(repository.depth)}{repository.depth ? '└ ' : ''}{repository.name}
        </option>
      ))}
    </select>
  );
}
