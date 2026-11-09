import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronRight, Folder, FolderInput, FolderOpen, FolderPlus, Inbox, Layers, MoreHorizontal, Pencil, Plus, Trash2, TextCursorInput } from 'lucide-react';
import { childrenOf, descendantIds, repositoryBreadcrumbs } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';
import { useAdminUi } from '../AdminUi';

export type LibrarySelection = 'all' | 'unfiled' | number;
export type DragPayload = { kind: 'items'; ids: number[] } | { kind: 'repo'; id: number } | null;
type DropZone = 'before' | 'inside' | 'after';

type RepositoryTreeProps = {
  storageKey: string;
  itemLabel: string;
  repositories: ContentRepository[];
  totals: Map<number, number>;
  allCount: number;
  unfiledCount: number;
  selection: LibrarySelection;
  drag: DragPayload;
  onDragChange: (drag: DragPayload) => void;
  onSelect: (selection: LibrarySelection) => void;
  onCreate: (parentId: number | null, name: string) => Promise<ContentRepository | null>;
  onRename: (repository: ContentRepository, name: string) => Promise<void>;
  onEdit: (repository: ContentRepository) => void;
  onDelete: (repository: ContentRepository) => void;
  onMovePicker: (repository: ContentRepository) => void;
  onMoveRepository: (repository: ContentRepository, parentId: number | null, position: number) => void;
  onDropItems: (ids: number[], repositoryId: number | null) => void;
};

function InlineName({ initial, placeholder, onCommit, onCancel }: { initial: string; placeholder: string; onCommit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  function finish(commit: boolean) {
    if (settled.current) return;
    settled.current = true;
    if (commit && value.trim() && value.trim() !== initial) onCommit(value.trim()); else onCancel();
  }
  return (
    <input
      ref={ref}
      className="tree-input"
      value={value}
      maxLength={80}
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function RepositoryTree(props: RepositoryTreeProps) {
  const { repositories, totals, selection, drag, onDragChange, onSelect } = props;
  const { openMenu } = useAdminUi();
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(props.storageKey) ?? '[]') as number[]); } catch { return new Set(); }
  });
  const [creating, setCreating] = useState<{ parentId: number | null } | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: number | 'unfiled'; zone: DropZone } | null>(null);
  const selectedPath = useMemo(() => new Set(typeof selection === 'number' ? repositoryBreadcrumbs(repositories, selection).map((item) => item.id) : []), [repositories, selection]);
  const blocked = useMemo(() => drag?.kind === 'repo' ? descendantIds(repositories, drag.id) : new Set<number>(), [drag, repositories]);

  useEffect(() => { localStorage.setItem(props.storageKey, JSON.stringify([...collapsed])); }, [collapsed, props.storageKey]);

  function setOpen(id: number, open: boolean) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (open) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startCreate(parentId: number | null) {
    if (parentId !== null) setOpen(parentId, true);
    setCreating({ parentId });
  }

  function menuFor(repository: ContentRepository) {
    return [
      { label: '新建子仓库', icon: <FolderPlus aria-hidden="true" />, onSelect: () => startCreate(repository.id) },
      { label: '重命名', icon: <TextCursorInput aria-hidden="true" />, onSelect: () => setRenamingId(repository.id) },
      { label: '编辑名称与说明', icon: <Pencil aria-hidden="true" />, onSelect: () => props.onEdit(repository) },
      { label: '移动到…', icon: <FolderInput aria-hidden="true" />, onSelect: () => props.onMovePicker(repository) },
      'separator' as const,
      { label: '删除仓库', icon: <Trash2 aria-hidden="true" />, tone: 'danger' as const, onSelect: () => props.onDelete(repository) },
    ];
  }

  function zoneFor(event: DragEvent<HTMLElement>, repository: ContentRepository): DropZone | null {
    if (!drag) return null;
    if (drag.kind === 'items') return 'inside';
    if (blocked.has(repository.id)) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const zone: DropZone = offset < rect.height * 0.28 ? 'before' : offset > rect.height * 0.72 ? 'after' : 'inside';
    if (zone !== 'inside' && repository.parent_id !== null && blocked.has(repository.parent_id)) return null;
    return zone;
  }

  function handleDragOver(event: DragEvent<HTMLElement>, repository: ContentRepository) {
    const zone = zoneFor(event, repository);
    if (!zone) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropTarget?.id !== repository.id || dropTarget.zone !== zone) setDropTarget({ id: repository.id, zone });
  }

  function handleDrop(event: DragEvent<HTMLElement>, repository: ContentRepository) {
    event.preventDefault();
    const zone = zoneFor(event, repository);
    setDropTarget(null);
    const current = drag;
    onDragChange(null);
    if (!current || !zone) return;
    if (current.kind === 'items') { props.onDropItems(current.ids, repository.id); return; }
    const moving = repositories.find((item) => item.id === current.id);
    if (!moving || moving.id === repository.id) return;
    if (zone === 'inside') {
      setOpen(repository.id, true);
      props.onMoveRepository(moving, repository.id, childrenOf(repositories, repository.id).filter((item) => item.id !== moving.id).length);
      return;
    }
    const siblings = childrenOf(repositories, repository.parent_id).filter((item) => item.id !== moving.id);
    const index = siblings.findIndex((item) => item.id === repository.id);
    props.onMoveRepository(moving, repository.parent_id, zone === 'before' ? index : index + 1);
  }

  function renderNodes(parentId: number | null, depth: number) {
    const nodes = childrenOf(repositories, parentId).map((repository) => {
      const children = childrenOf(repositories, repository.id);
      const open = !collapsed.has(repository.id) || (selectedPath.has(repository.id) && repository.id !== selection);
      const isSelected = selection === repository.id;
      const zone = dropTarget?.id === repository.id ? dropTarget.zone : null;
      return (
        <li key={repository.id} role="none">
          <div
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={isSelected}
            aria-expanded={children.length ? open : undefined}
            className={`tree-node ${isSelected ? 'selected' : ''} ${zone ? `drop-${zone}` : ''} ${drag?.kind === 'repo' && drag.id === repository.id ? 'dragging' : ''}`}
            style={{ paddingLeft: 6 + depth * 16 }}
            draggable={renamingId !== repository.id}
            onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', repository.name); onDragChange({ kind: 'repo', id: repository.id }); }}
            onDragEnd={() => { onDragChange(null); setDropTarget(null); }}
            onDragOver={(event) => handleDragOver(event, repository)}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget((current) => current?.id === repository.id ? null : current); }}
            onDrop={(event) => handleDrop(event, repository)}
            onClick={() => onSelect(repository.id)}
            onDoubleClick={() => setRenamingId(repository.id)}
            onContextMenu={(event: MouseEvent) => { event.preventDefault(); openMenu({ x: event.clientX, y: event.clientY }, menuFor(repository)); }}
          >
            {children.length ? (
              <button type="button" className={`tree-caret ${open ? 'open' : ''}`} onClick={(event) => { event.stopPropagation(); setOpen(repository.id, !open); }} aria-label={open ? '收起' : '展开'}>
                <ChevronRight aria-hidden="true" />
              </button>
            ) : <span className="tree-caret" />}
            {isSelected || (open && children.length) ? <FolderOpen className="tree-icon" aria-hidden="true" /> : <Folder className="tree-icon" aria-hidden="true" />}
            {renamingId === repository.id ? (
              <InlineName initial={repository.name} placeholder="仓库名称" onCommit={(name) => { setRenamingId(null); void props.onRename(repository, name); }} onCancel={() => setRenamingId(null)} />
            ) : (
              <button type="button" className="tree-label" title={repository.description || repository.name}>{repository.name}</button>
            )}
            <small className="tree-count">{totals.get(repository.id) ?? 0}</small>
            <span className="tree-actions">
              <button type="button" onClick={(event) => { event.stopPropagation(); startCreate(repository.id); }} aria-label={`在${repository.name}中新建子仓库`} title="新建子仓库"><Plus aria-hidden="true" /></button>
              <button type="button" onClick={(event) => { event.stopPropagation(); openMenu(event.currentTarget, menuFor(repository)); }} aria-label={`${repository.name}的更多操作`} title="更多操作"><MoreHorizontal aria-hidden="true" /></button>
            </span>
          </div>
          {open || creating?.parentId === repository.id ? <ul role="group">{renderNodes(repository.id, depth + 1)}</ul> : null}
        </li>
      );
    });
    if (creating?.parentId === parentId) {
      nodes.push(
        <li key="creating" role="none">
          <div className="tree-node creating" style={{ paddingLeft: 6 + depth * 16 }}>
            <span className="tree-caret" />
            <Folder className="tree-icon" aria-hidden="true" />
            <InlineName
              initial=""
              placeholder="新仓库名称，回车创建"
              onCommit={(name) => { setCreating(null); void props.onCreate(parentId, name).then((created) => { if (created) onSelect(created.id); }); }}
              onCancel={() => setCreating(null)}
            />
          </div>
        </li>,
      );
    }
    return nodes;
  }

  const unfiledDrop = dropTarget?.id === 'unfiled';
  return (
    <div className="tree" role="tree" aria-label={`${props.itemLabel}仓库`}>
      <div className="tree-head">
        <span>仓库</span>
        <button type="button" className="icon-button small" onClick={() => startCreate(null)} aria-label="新建仓库" title="新建顶层仓库"><FolderPlus aria-hidden="true" /></button>
      </div>
      <div role="group" className="tree-smart">
        <button type="button" className={`tree-node smart ${selection === 'all' ? 'selected' : ''}`} onClick={() => onSelect('all')}>
          <Layers className="tree-icon" aria-hidden="true" /><span className="tree-label">全部{props.itemLabel}</span><small className="tree-count">{props.allCount}</small>
        </button>
        <button
          type="button"
          className={`tree-node smart ${selection === 'unfiled' ? 'selected' : ''} ${unfiledDrop ? 'drop-inside' : ''}`}
          onClick={() => onSelect('unfiled')}
          onDragOver={(event) => { if (drag?.kind !== 'items') return; event.preventDefault(); setDropTarget({ id: 'unfiled', zone: 'inside' }); }}
          onDragLeave={() => setDropTarget((current) => current?.id === 'unfiled' ? null : current)}
          onDrop={(event) => { event.preventDefault(); setDropTarget(null); const current = drag; onDragChange(null); if (current?.kind === 'items') props.onDropItems(current.ids, null); }}
        >
          <Inbox className="tree-icon" aria-hidden="true" /><span className="tree-label">未归档</span><small className="tree-count">{props.unfiledCount}</small>
        </button>
      </div>
      <ul className="tree-root" role="group">{renderNodes(null, 0)}</ul>
      {!repositories.length && !creating ? (
        <button type="button" className="tree-empty" onClick={() => startCreate(null)}><FolderPlus aria-hidden="true" />新建第一个仓库</button>
      ) : null}
      <p className="tree-hint">拖动仓库可调整顺序或层级，把{props.itemLabel}拖到仓库上即可归档。</p>
    </div>
  );
}
