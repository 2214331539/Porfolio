import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { ArrowUpRight, ChevronRight, Copy, Eye, EyeOff, FileText, FolderInput, Image, ListTree, Lock, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Send, Trash2, Undo2, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Note } from '../../../entities/note/model/types';
import type { Post } from '../../../entities/post/model/types';
import { childrenOf, descendantIds, repositoryBreadcrumbs, repositoryPathLabel, totalCounts } from '../../../entities/repository/model/tree';
import type { ContentRepository, RepositoryContentType } from '../../../entities/repository/model/types';
import { contentApi, type BulkAction } from '../../../features/content/api/content-api';
import { errorMessage, relativeTime } from '../../../shared/format';
import { useAdminUi, type MenuItem } from '../AdminUi';
import { RepositoryPickerDialog } from './RepositoryPickerDialog';
import { RepositoryTree, type DragPayload, type LibrarySelection } from './RepositoryTree';

type LibraryItem = {
  id: number;
  title: string;
  status: 'draft' | 'published';
  repositoryId: number | null;
  updatedAt: string;
  pinned: boolean;
  isPrivate: boolean;
  views: number;
  likes?: number;
  thumb?: string;
  publicHref: string;
  search: string;
};

const CONFIG = {
  post: { label: '文章', unit: '篇', base: '/admin/posts', create: '写文章', icon: FileText },
  note: { label: '图文', unit: '条', base: '/admin/notes', create: '发图文', icon: Image },
} as const;

const fromPost = (post: Post): LibraryItem => ({
  id: post.id, title: post.title, status: post.status, repositoryId: post.repository?.id ?? post.repository_id ?? null,
  updatedAt: post.updated_at ?? post.created_at, pinned: post.is_pinned, isPrivate: post.is_private, views: post.views,
  publicHref: `/blog/${post.slug}`, search: `${post.title} ${post.excerpt} ${post.slug} ${post.tags.map((tag) => tag.name).join(' ')}`.toLocaleLowerCase(),
});
const fromNote = (note: Note): LibraryItem => ({
  id: note.id, title: note.title, status: note.status, repositoryId: note.repository?.id ?? note.repository_id ?? null,
  updatedAt: note.updated_at ?? note.published_at, pinned: note.is_pinned, isPrivate: false, views: note.views, likes: note.likes,
  thumb: note.images[0], publicHref: `/notes/${note.id}`, search: `${note.title} ${note.content} ${note.topics.join(' ')}`.toLocaleLowerCase(),
});

type Picker = { kind: 'items'; ids: number[]; value: number | null } | { kind: 'repo'; repository: ContentRepository };

export function LibraryPage({ type }: { type: RepositoryContentType }) {
  const config = CONFIG[type];
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { notify, confirmAction, promptForm, openMenu } = useAdminUi();
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<DragPayload>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const lastChecked = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const repoParam = params.get('repo');
  const selection: LibrarySelection = repoParam === 'unfiled' ? 'unfiled' : repoParam && repositories.some((item) => item.id === Number(repoParam)) ? Number(repoParam) : 'all';
  const status = (['draft', 'published'].includes(params.get('status') ?? '') ? params.get('status') : 'all') as 'all' | 'draft' | 'published';
  const query = params.get('q') ?? '';
  const sort = (params.get('sort') ?? 'updated') as 'updated' | 'title' | 'views';
  const deep = params.get('deep') !== '0';
  const current = typeof selection === 'number' ? repositories.find((item) => item.id === selection) ?? null : null;
  const returnState = { from: `${location.pathname}${location.search}` };

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(patch).forEach(([key, value]) => { if (value === null || value === '') next.delete(key); else next.set(key, value); });
      return next;
    }, { replace: true });
  }, [setParams]);

  const load = useCallback(async () => {
    const [repositoryItems, rawItems] = await Promise.all([
      contentApi.listRepositories(type, true),
      type === 'post' ? contentApi.listPosts(true).then((posts) => posts.map(fromPost)) : contentApi.listNotes(true).then((notes) => notes.map(fromNote)),
    ]);
    setRepositories(repositoryItems);
    setItems(rawItems);
  }, [type]);

  useEffect(() => {
    setLoading(true);
    load().then(() => setError('')).catch((err) => setError(errorMessage(err, `${config.label}加载失败`))).finally(() => setLoading(false));
  }, [config.label, load]);

  useEffect(() => { setChecked(new Set()); lastChecked.current = null; }, [selection]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === 'Escape' && target === searchRef.current) updateParams({ q: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [updateParams]);

  const totals = useMemo(() => totalCounts(repositories, items.map((item) => item.repositoryId)), [items, repositories]);
  const inLocation = useMemo(() => {
    if (selection === 'all') return items;
    if (selection === 'unfiled') return items.filter((item) => item.repositoryId === null);
    const scope = deep ? descendantIds(repositories, selection) : new Set([selection]);
    return items.filter((item) => item.repositoryId !== null && scope.has(item.repositoryId));
  }, [deep, items, repositories, selection]);
  const counts = useMemo(() => ({
    all: inLocation.length,
    draft: inLocation.filter((item) => item.status === 'draft').length,
    published: inLocation.filter((item) => item.status === 'published').length,
  }), [inLocation]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const filtered = inLocation.filter((item) => (status === 'all' || item.status === status) && (!term || item.search.includes(term)));
    return filtered.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'views' ? b.views - a.views : b.updatedAt.localeCompare(a.updatedAt));
  }, [inLocation, query, sort, status]);

  const select = (next: LibrarySelection) => {
    updateParams({ repo: next === 'all' ? null : String(next) });
    setTreeOpen(false);
  };
  const editHref = (id: number) => `${config.base}/${id}`;
  const createHref = `${config.base}/new${typeof selection === 'number' ? `?repo=${selection}` : ''}`;
  const repositoryName = (id: number | null) => id === null ? '未归档' : `「${repositories.find((item) => item.id === id)?.name ?? '仓库'}」`;

  async function runBulk(ids: number[], action: BulkAction, repositoryId: number | null = null) {
    if (!ids.length) return;
    try {
      await contentApi.bulk(type, ids, action, repositoryId);
      await load();
      setChecked(new Set());
      const amount = `${ids.length} ${config.unit}${config.label}`;
      notify(action === 'move' ? `已将 ${amount}移到${repositoryName(repositoryId)}` : action === 'publish' ? `已发布 ${amount}` : action === 'draft' ? `已将 ${amount}转为草稿` : `已删除 ${amount}`);
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }

  async function removeItems(ids: number[]) {
    const single = ids.length === 1 ? items.find((item) => item.id === ids[0]) : undefined;
    const accepted = await confirmAction({
      title: single ? `删除“${single.title}”？` : `删除 ${ids.length} ${config.unit}${config.label}？`,
      description: '删除后无法恢复，公开链接会立即失效。只想暂时隐藏的话，可以改为“撤回为草稿”。',
      confirmLabel: '删除',
      tone: 'danger',
    });
    if (accepted) await runBulk(ids, 'delete');
  }

  async function patchItem(item: LibraryItem, patch: { is_pinned?: boolean; is_private?: boolean }, message: string) {
    try {
      if (type === 'post') await contentApi.savePost({ id: item.id, ...patch });
      else await contentApi.saveNote({ id: item.id, is_pinned: patch.is_pinned });
      await load();
      notify(message);
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }

  function itemMenu(item: LibraryItem): MenuItem[] {
    const published = item.status === 'published';
    return [
      { label: '编辑', icon: <Pencil aria-hidden="true" />, onSelect: () => navigate(editHref(item.id), { state: returnState }) },
      { label: '查看页面', icon: <ArrowUpRight aria-hidden="true" />, disabled: !published || item.isPrivate, onSelect: () => window.open(item.publicHref, '_blank', 'noopener') },
      { label: '复制链接', icon: <Copy aria-hidden="true" />, disabled: !published || item.isPrivate, onSelect: () => { void navigator.clipboard?.writeText(new URL(item.publicHref, window.location.origin).href).then(() => notify('链接已复制')); } },
      'separator',
      { label: '移动到…', icon: <FolderInput aria-hidden="true" />, onSelect: () => setPicker({ kind: 'items', ids: [item.id], value: item.repositoryId }) },
      published
        ? { label: '撤回为草稿', icon: <Undo2 aria-hidden="true" />, onSelect: () => void runBulk([item.id], 'draft') }
        : { label: '发布', icon: <Send aria-hidden="true" />, onSelect: () => void runBulk([item.id], 'publish') },
      { label: item.pinned ? '取消置顶' : '置顶', icon: item.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />, onSelect: () => void patchItem(item, { is_pinned: !item.pinned }, item.pinned ? '已取消置顶' : '已置顶') },
      ...(type === 'post' ? [{ label: item.isPrivate ? '设为公开' : '设为私密', icon: item.isPrivate ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />, onSelect: () => void patchItem(item, { is_private: !item.isPrivate }, item.isPrivate ? '文章已公开' : '文章已设为私密，仅后台可见') }] : []),
      'separator',
      { label: '删除', icon: <Trash2 aria-hidden="true" />, tone: 'danger', onSelect: () => void removeItems([item.id]) },
    ];
  }

  function toggleChecked(id: number, event: MouseEvent) {
    setChecked((previous) => {
      const next = new Set(previous);
      if (event.shiftKey && lastChecked.current !== null) {
        const ids = visible.map((item) => item.id);
        const [from, to] = [ids.indexOf(lastChecked.current), ids.indexOf(id)].sort((a, b) => a - b);
        if (from >= 0) { ids.slice(from, to + 1).forEach((value) => next.add(value)); return next; }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastChecked.current = id;
  }

  function startItemDrag(event: DragEvent<HTMLElement>, item: LibraryItem) {
    const ids = checked.has(item.id) ? [...checked] : [item.id];
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.title);
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = ids.length > 1 ? `${ids.length} ${config.unit}${config.label}` : item.title;
    document.body.append(ghost);
    event.dataTransfer.setDragImage(ghost, 14, 14);
    window.setTimeout(() => ghost.remove());
    setDrag({ kind: 'items', ids });
  }

  async function createRepository(parentId: number | null, name: string) {
    try {
      const created = await contentApi.saveRepository({ name, content_type: type, parent_id: parentId });
      await load();
      notify(`已创建仓库「${name}」`);
      return created;
    } catch (err) {
      notify(errorMessage(err, '仓库创建失败'), 'error');
      return null;
    }
  }

  async function saveRepository(repository: ContentRepository, values: { name: string; description?: string }) {
    try {
      await contentApi.saveRepository({ id: repository.id, content_type: type, ...values });
      await load();
      notify('仓库已更新');
    } catch (err) {
      notify(errorMessage(err, '仓库保存失败'), 'error');
    }
  }

  async function editRepository(repository: ContentRepository) {
    const values = await promptForm({
      title: '编辑仓库',
      fields: [
        { name: 'name', label: '名称', value: repository.name, required: true, maxLength: 80 },
        { name: 'description', label: '说明', value: repository.description, multiline: true, placeholder: '一句话说明这里收纳什么，会显示在前台的仓库页' },
      ],
    });
    if (values) await saveRepository(repository, { name: values.name.trim(), description: values.description.trim() });
  }

  async function deleteRepository(repository: ContentRepository) {
    const childCount = repositories.filter((item) => item.parent_id === repository.id).length;
    const itemCount = items.filter((item) => item.repositoryId === repository.id).length;
    const parent = repositories.find((item) => item.id === repository.parent_id);
    const empty = !childCount && !itemCount;
    const parts = [itemCount ? `${itemCount} ${config.unit}${config.label}` : '', childCount ? `${childCount} 个子仓库` : ''].filter(Boolean).join('和');
    const accepted = await confirmAction({
      title: `删除仓库「${repository.name}」？`,
      description: empty ? '这是一个空仓库，删除后不可恢复。' : `其中的 ${parts}不会被删除，会移到${parent ? `「${parent.name}」` : '顶层（内容变为未归档）'}。`,
      confirmLabel: empty ? '删除仓库' : '删除并保留内容',
      tone: 'danger',
    });
    if (!accepted) return;
    try {
      await contentApi.deleteRepository(repository.id, type, !empty);
      if (typeof selection === 'number' && descendantIds(repositories, repository.id).has(selection)) select(repository.parent_id ?? 'all');
      await load();
      notify(`仓库「${repository.name}」已删除`);
    } catch (err) {
      notify(errorMessage(err, '仓库删除失败'), 'error');
    }
  }

  async function moveRepository(repository: ContentRepository, parentId: number | null, position: number) {
    try {
      setRepositories(await contentApi.moveRepository(repository.id, type, parentId, position));
      notify(`已移动「${repository.name}」`);
    } catch (err) {
      notify(errorMessage(err, '仓库移动失败'), 'error');
    }
  }

  function repositoryMenu(repository: ContentRepository): MenuItem[] {
    return [
      { label: '编辑名称与说明', icon: <Pencil aria-hidden="true" />, onSelect: () => void editRepository(repository) },
      { label: '移动到…', icon: <FolderInput aria-hidden="true" />, onSelect: () => setPicker({ kind: 'repo', repository }) },
      'separator',
      { label: '删除仓库', icon: <Trash2 aria-hidden="true" />, tone: 'danger', onSelect: () => void deleteRepository(repository) },
    ];
  }

  const breadcrumbs = repositoryBreadcrumbs(repositories, current?.id ?? null);
  const allChecked = visible.length > 0 && visible.every((item) => checked.has(item.id));
  const Icon = config.icon;
  const title = selection === 'all' ? `全部${config.label}` : selection === 'unfiled' ? '未归档' : current?.name ?? '';
  const subRepositories = current ? childrenOf(repositories, current.id) : [];

  return (
    <div className="library-page">
      <aside className={`library-tree ${treeOpen ? 'open' : ''}`}>
        <RepositoryTree
          storageKey={`studio:tree:${type}`}
          itemLabel={config.label}
          repositories={repositories}
          totals={totals}
          allCount={items.length}
          unfiledCount={items.filter((item) => item.repositoryId === null).length}
          selection={selection}
          drag={drag}
          onDragChange={setDrag}
          onSelect={select}
          onCreate={createRepository}
          onRename={(repository, name) => saveRepository(repository, { name })}
          onEdit={(repository) => void editRepository(repository)}
          onDelete={(repository) => void deleteRepository(repository)}
          onMovePicker={(repository) => setPicker({ kind: 'repo', repository })}
          onMoveRepository={(repository, parentId, position) => void moveRepository(repository, parentId, position)}
          onDropItems={(ids, repositoryId) => void runBulk(ids, 'move', repositoryId)}
        />
      </aside>
      {treeOpen ? <button type="button" className="library-scrim" onClick={() => setTreeOpen(false)} aria-label="关闭仓库面板" /> : null}

      <section className="library-content">
        <header className="library-header">
          <div className="library-heading">
            <button type="button" className="button small library-tree-button" onClick={() => setTreeOpen(true)}><ListTree aria-hidden="true" />仓库</button>
            {current ? (
              <nav className="crumbs" aria-label="仓库路径">
                <button type="button" onClick={() => select('all')}>全部{config.label}</button>
                {breadcrumbs.slice(0, -1).map((item) => <span key={item.id}><ChevronRight aria-hidden="true" /><button type="button" onClick={() => select(item.id)}>{item.name}</button></span>)}
              </nav>
            ) : null}
            <div className="library-title-row">
              <h1>{title}</h1>
              {current ? <button type="button" className="icon-button" onClick={(event) => openMenu(event.currentTarget, repositoryMenu(current))} aria-label="仓库操作"><MoreHorizontal aria-hidden="true" /></button> : null}
            </div>
            {current ? (
              current.description
                ? <button type="button" className="library-description" onClick={() => void editRepository(current)} title="编辑说明">{current.description}</button>
                : <button type="button" className="library-description empty" onClick={() => void editRepository(current)}>添加说明…</button>
            ) : (
              <p className="library-description static">{selection === 'unfiled' ? `还没放进任何仓库的${config.label}，拖到左侧仓库即可归档。` : `包括草稿与私密内容。共 ${items.length} ${config.unit}，${items.filter((item) => item.status === 'draft').length} 篇草稿。`}</p>
            )}
          </div>
          <Link className="button primary" to={createHref} state={returnState}><Plus aria-hidden="true" />{config.create}</Link>
        </header>

        {checked.size ? (
          <div className="bulk-bar" role="toolbar" aria-label="批量操作">
            <strong>已选 {checked.size} 项</strong>
            <button type="button" className="button small" onClick={() => setPicker({ kind: 'items', ids: [...checked], value: null })}><FolderInput aria-hidden="true" />移动到…</button>
            <button type="button" className="button small" onClick={() => void runBulk([...checked], 'publish')}><Send aria-hidden="true" />发布</button>
            <button type="button" className="button small" onClick={() => void runBulk([...checked], 'draft')}><Undo2 aria-hidden="true" />转为草稿</button>
            <button type="button" className="button small danger-text" onClick={() => void removeItems([...checked])}><Trash2 aria-hidden="true" />删除</button>
            <button type="button" className="icon-button small bulk-close" onClick={() => setChecked(new Set())} aria-label="取消选择"><X aria-hidden="true" /></button>
          </div>
        ) : (
          <div className="list-toolbar">
            <label className="search-field">
              <Search aria-hidden="true" />
              <input ref={searchRef} value={query} onChange={(event) => updateParams({ q: event.target.value })} placeholder={`搜索${config.label}标题、标签…`} aria-label={`搜索${config.label}`} />
              {query ? <button type="button" onClick={() => updateParams({ q: null })} aria-label="清除搜索"><X aria-hidden="true" /></button> : <kbd>/</kbd>}
            </label>
            <div className="segmented" role="tablist" aria-label="发布状态">
              {([['all', '全部'], ['published', '已发布'], ['draft', '草稿']] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={status === value} className={status === value ? 'active' : ''} onClick={() => updateParams({ status: value === 'all' ? null : value })}>
                  {label}<small>{counts[value]}</small>
                </button>
              ))}
            </div>
            <select className="select small" value={sort} onChange={(event) => updateParams({ sort: event.target.value === 'updated' ? null : event.target.value })} aria-label="排序">
              <option value="updated">最近更新</option>
              <option value="views">浏览最多</option>
              <option value="title">按标题</option>
            </select>
            {current && subRepositories.length ? (
              <label className="toggle">
                <input type="checkbox" checked={deep} onChange={(event) => updateParams({ deep: event.target.checked ? null : '0' })} />
                <span>含子仓库</span>
              </label>
            ) : null}
          </div>
        )}

        {error ? <div className="notice error">{error}<button type="button" className="button small" onClick={() => void load().then(() => setError(''))}>重试</button></div> : null}

        <div className={`item-list ${type}`} role="table" aria-label={`${config.label}列表`}>
          <div className="item-row head" role="row">
            <span role="columnheader"><input type="checkbox" checked={allChecked} disabled={!visible.length} onChange={() => setChecked(allChecked ? new Set() : new Set(visible.map((item) => item.id)))} aria-label="全选" /></span>
            <span role="columnheader">标题</span>
            <span role="columnheader" className="col-location">位置</span>
            <span role="columnheader" className="col-updated">更新</span>
            <span role="columnheader" className="col-stat">{type === 'post' ? '阅读' : '点赞'}</span>
            <span role="columnheader" aria-label="操作" />
          </div>
          {loading ? Array.from({ length: 5 }, (_, index) => <div className="item-row skeleton" key={index}><span /><span /><span /><span /><span /><span /></div>) : null}
          {!loading && visible.map((item) => (
            <div
              key={item.id}
              role="row"
              className={`item-row ${checked.has(item.id) ? 'checked' : ''} ${drag?.kind === 'items' && drag.ids.includes(item.id) ? 'dragging' : ''}`}
              draggable
              onDragStart={(event) => startItemDrag(event, item)}
              onDragEnd={() => setDrag(null)}
              onContextMenu={(event) => { event.preventDefault(); openMenu({ x: event.clientX, y: event.clientY }, itemMenu(item)); }}
            >
              <span role="cell"><input type="checkbox" checked={checked.has(item.id)} onClick={(event) => toggleChecked(item.id, event)} onChange={() => undefined} aria-label={`选择${item.title}`} /></span>
              <span role="cell" className="item-title">
                {item.thumb ? <img src={item.thumb} alt="" loading="lazy" /> : type === 'note' ? <span className="item-thumb-empty"><Image aria-hidden="true" /></span> : null}
                <Link to={editHref(item.id)} state={returnState} title={item.title}>{item.title}</Link>
                {item.status === 'draft' ? <span className="badge draft">草稿</span> : null}
                {item.pinned ? <span className="badge" title="置顶"><Pin aria-hidden="true" />置顶</span> : null}
                {item.isPrivate ? <span className="badge" title="仅后台可见"><Lock aria-hidden="true" />私密</span> : null}
              </span>
              <span role="cell" className="col-location">
                {item.repositoryId === null
                  ? <button type="button" className="location-chip muted" onClick={() => setPicker({ kind: 'items', ids: [item.id], value: null })}>未归档</button>
                  : <button type="button" className="location-chip" onClick={() => select(item.repositoryId!)} title={repositoryPathLabel(repositories, item.repositoryId)}>{repositoryPathLabel(repositories, item.repositoryId)}</button>}
              </span>
              <span role="cell" className="col-updated" title={new Date(item.updatedAt).toLocaleString('zh-CN')}>{relativeTime(item.updatedAt)}</span>
              <span role="cell" className="col-stat">{type === 'post' ? item.views : item.likes}</span>
              <span role="cell" className="item-actions">
                <button type="button" className="icon-button small" onClick={(event) => openMenu(event.currentTarget, itemMenu(item))} aria-label={`${item.title}的更多操作`}><MoreHorizontal aria-hidden="true" /></button>
              </span>
            </div>
          ))}
          {!loading && !visible.length ? (
            <div className="list-empty">
              <Icon aria-hidden="true" />
              {query || status !== 'all' ? (
                <><strong>没有符合条件的{config.label}</strong><button type="button" className="button small" onClick={() => updateParams({ q: null, status: null })}>清除筛选</button></>
              ) : current ? (
                <><strong>「{current.name}」里还没有{config.label}</strong><span>在这里新建，或把其他{config.label}拖到左侧的这个仓库。</span><Link className="button small primary" to={createHref} state={returnState}><Plus aria-hidden="true" />{config.create}</Link></>
              ) : selection === 'unfiled' ? (
                <><strong>所有{config.label}都已归档</strong><span>干净利落。</span></>
              ) : (
                <><strong>还没有{config.label}</strong><Link className="button small primary" to={createHref} state={returnState}><Plus aria-hidden="true" />{config.create}</Link></>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {picker?.kind === 'items' ? (
        <RepositoryPickerDialog
          title={`移动 ${picker.ids.length} ${config.unit}${config.label}`}
          repositories={repositories}
          value={picker.ids.length === 1 ? picker.value : undefined}
          noneLabel="未归档"
          onClose={() => setPicker(null)}
          onPick={(repositoryId) => { setPicker(null); void runBulk(picker.ids, 'move', repositoryId); }}
        />
      ) : null}
      {picker?.kind === 'repo' ? (
        <RepositoryPickerDialog
          title={`移动仓库「${picker.repository.name}」`}
          description="选择新的上级仓库，它会排在目标仓库的最后。"
          repositories={repositories}
          value={picker.repository.parent_id}
          disabledIds={descendantIds(repositories, picker.repository.id)}
          noneLabel="顶层"
          onClose={() => setPicker(null)}
          onPick={(parentId) => {
            const repository = picker.repository;
            setPicker(null);
            void moveRepository(repository, parentId, childrenOf(repositories, parentId).filter((item) => item.id !== repository.id).length);
          }}
        />
      ) : null}
    </div>
  );
}
