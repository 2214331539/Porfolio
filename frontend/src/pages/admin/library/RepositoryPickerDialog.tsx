import { useMemo, useState } from 'react';
import { Check, Folder, Inbox, Search } from 'lucide-react';
import { flattenRepositories } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';
import { Dialog } from '../AdminUi';

type RepositoryPickerDialogProps = {
  title: string;
  description?: string;
  repositories: ContentRepository[];
  value?: number | null;
  disabledIds?: Set<number>;
  noneLabel: string;
  confirmLabel?: string;
  onPick: (repositoryId: number | null) => void;
  onClose: () => void;
};

/** Pick a destination repository from the whole tree (used for "移动到…" on items and repositories). */
export function RepositoryPickerDialog({ title, description, repositories, value, disabledIds, noneLabel, confirmLabel = '移动到这里', onPick, onClose }: RepositoryPickerDialogProps) {
  const [selected, setSelected] = useState<number | null | undefined>(value);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const all = flattenRepositories(repositories);
    const term = query.trim().toLocaleLowerCase();
    return term ? all.filter((row) => row.name.toLocaleLowerCase().includes(term)).map((row) => ({ ...row, depth: 0 })) : all;
  }, [query, repositories]);

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      size="medium"
      footer={<>
        <button type="button" className="button" onClick={onClose}>取消</button>
        <button type="button" className="button primary" disabled={selected === undefined} onClick={() => selected !== undefined && onPick(selected)}>{confirmLabel}</button>
      </>}
    >
      {repositories.length > 8 ? (
        <label className="picker-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选仓库" /></label>
      ) : null}
      <div className="picker-list" role="listbox" aria-label="目标仓库">
        {!query ? (
          <button type="button" role="option" aria-selected={selected === null} className={selected === null ? 'selected' : ''} onClick={() => setSelected(null)} onDoubleClick={() => onPick(null)}>
            <Inbox aria-hidden="true" /><span>{noneLabel}</span>{selected === null ? <Check aria-hidden="true" /> : null}
          </button>
        ) : null}
        {rows.map((row) => {
          const disabled = disabledIds?.has(row.id);
          return (
            <button type="button" role="option" key={row.id} disabled={disabled} aria-selected={selected === row.id} className={selected === row.id ? 'selected' : ''} style={{ paddingLeft: 12 + row.depth * 18 }} onClick={() => setSelected(row.id)} onDoubleClick={() => !disabled && onPick(row.id)}>
              <Folder aria-hidden="true" /><span>{row.name}</span>{row.id === value ? <small>当前位置</small> : null}{selected === row.id ? <Check aria-hidden="true" /> : null}
            </button>
          );
        })}
        {query && !rows.length ? <p className="picker-empty">没有匹配的仓库</p> : null}
      </div>
    </Dialog>
  );
}
