import { useEffect, useMemo, useState } from 'react';
import { Folder, FolderPlus, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { flattenRepositories } from '../../entities/repository/model/tree';
import type { ContentRepository, RepositoryContentType, RepositoryInput } from '../../entities/repository/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { useAdminDirtyState, useAdminUi } from './AdminUi';

type RepositoryDraft = Pick<RepositoryInput, 'name' | 'description' | 'parent_id' | 'sort_order'>;
const emptyDraft: RepositoryDraft = { name: '', description: '', parent_id: null, sort_order: 0 };

export function RepositoriesAdmin() {
  const [contentType, setContentType] = useState<RepositoryContentType>('post');
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [draft, setDraft] = useState<RepositoryDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(emptyDraft));
  const { confirmAction, notify, runAfterDiscardCheck } = useAdminUi();
  const rows = useMemo(() => flattenRepositories(repositories), [repositories]);
  const draftSnapshot = useMemo(() => JSON.stringify(draft), [draft]);
  const isDirty = draftSnapshot !== savedSnapshot;
  useAdminDirtyState(isDirty);
  const unavailableParentIds = useMemo(() => {
    const blocked = new Set<number>();
    if (!editingId) return blocked;
    blocked.add(editingId);
    let changed = true;
    while (changed) {
      changed = false;
      repositories.forEach((repository) => {
        if (repository.parent_id !== null && blocked.has(repository.parent_id) && !blocked.has(repository.id)) {
          blocked.add(repository.id);
          changed = true;
        }
      });
    }
    return blocked;
  }, [editingId, repositories]);

  useEffect(() => {
    setLoading(true);
    setError('');
    contentApi.listRepositories(contentType, true)
      .then(setRepositories)
      .catch((err) => setError(err instanceof Error ? err.message : '仓库加载失败'))
      .finally(() => setLoading(false));
  }, [contentType]);

  function setCleanDraft(nextDraft: RepositoryDraft, nextEditingId?: number) {
    setEditingId(nextEditingId);
    setDraft(nextDraft);
    setSavedSnapshot(JSON.stringify(nextDraft));
    setError('');
  }

  function reset(parentId: number | null = null) {
    runAfterDiscardCheck(() => setCleanDraft({ ...emptyDraft, parent_id: parentId }));
  }

  function edit(repository: ContentRepository) {
    runAfterDiscardCheck(() => setCleanDraft({ name: repository.name, description: repository.description, parent_id: repository.parent_id, sort_order: repository.sort_order }, repository.id));
  }

  function switchContentType(nextType: RepositoryContentType) {
    if (nextType === contentType) return;
    runAfterDiscardCheck(() => {
      setContentType(nextType);
      setCleanDraft(emptyDraft);
    });
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('请填写仓库名称');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await contentApi.saveRepository({
        id: editingId,
        name: draft.name.trim(),
        description: draft.description.trim(),
        parent_id: draft.parent_id,
        sort_order: draft.sort_order,
        content_type: contentType,
      });
      setRepositories((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved]);
      setCleanDraft({ ...emptyDraft, parent_id: saved.parent_id });
      notify(editingId ? '仓库已更新' : '仓库已创建');
    } catch (err) {
      setError(err instanceof Error ? err.message : '仓库保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove(repository: ContentRepository) {
    const accepted = await confirmAction({ title: `删除“${repository.name}”？`, description: '只有不包含内容和子仓库的空仓库可以删除。', confirmLabel: '删除仓库', tone: 'danger' });
    if (!accepted) return;
    setError('');
    try {
      await contentApi.deleteRepository(repository.id);
      setRepositories((items) => items.filter((item) => item.id !== repository.id));
      if (editingId === repository.id) setCleanDraft(emptyDraft);
      notify('仓库已删除');
    } catch (err) {
      setError(err instanceof Error ? err.message : '仓库删除失败');
    }
  }

  return (
    <div>
      <div className="admin-title repository-admin-title">
        <div><p>CONTENT / REPOSITORIES</p><h1>仓库管理</h1></div>
        <button className="primary-button" type="button" onClick={() => reset()}><Plus />新建仓库</button>
      </div>
      <div className="repository-type-tabs" role="tablist" aria-label="内容类型">
        <button type="button" role="tab" aria-selected={contentType === 'post'} className={contentType === 'post' ? 'active' : ''} onClick={() => switchContentType('post')}>文章仓库</button>
        <button type="button" role="tab" aria-selected={contentType === 'note'} className={contentType === 'note' ? 'active' : ''} onClick={() => switchContentType('note')}>图文仓库</button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="repository-admin-layout">
        <section className="admin-panel repository-tree-panel">
          <div className="panel-title"><h2>{contentType === 'post' ? '文章' : '图文'}仓库结构</h2><small>{repositories.length} 个仓库</small></div>
          {loading ? <div className="repository-admin-empty">正在读取仓库…</div> : null}
          {!loading && !rows.length ? <div className="admin-empty-state"><Folder /><strong>还没有仓库</strong><p>在右侧填写名称，创建第一个内容仓库。</p></div> : null}
          {rows.map((repository) => (
            <div className="repository-admin-row" key={repository.id} style={{ '--repository-depth': repository.depth } as React.CSSProperties}>
              <span className="repository-admin-folder"><Folder /></span>
              <div>
                <strong>{repository.name}</strong>
                <small>{repository.description || '暂无说明'} · {repository.child_count} 个子仓库 · {repository.item_count} 条内容</small>
              </div>
              <div className="repository-admin-actions">
                <button type="button" onClick={() => reset(repository.id)} aria-label={`在${repository.name}中新建子仓库`}><FolderPlus /></button>
                <button type="button" onClick={() => edit(repository)} aria-label={`编辑${repository.name}`}><Pencil /></button>
                <button type="button" onClick={() => remove(repository)} aria-label={`删除${repository.name}`}><Trash2 /></button>
              </div>
            </div>
          ))}
        </section>
        <section className="admin-panel repository-editor-panel">
          <div className="panel-title">
            <h2>{editingId ? '编辑仓库' : draft.parent_id ? '新建子仓库' : '新建仓库'}</h2>
            {editingId || draft.name || draft.parent_id ? <button type="button" onClick={() => reset()} aria-label="重置仓库表单"><X /></button> : null}
          </div>
          <label>仓库名称<input name="repository-name" autoComplete="off" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="例如：设计观察…" /></label>
          <label>仓库说明<textarea name="repository-description" autoComplete="off" value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="用一句话说明这里收纳什么内容…" /></label>
          <label>上级仓库<select value={draft.parent_id ?? ''} onChange={(event) => setDraft((value) => ({ ...value, parent_id: event.target.value ? Number(event.target.value) : null }))}><option value="">顶层仓库</option>{rows.filter((repository) => !unavailableParentIds.has(repository.id)).map((repository) => <option value={repository.id} key={repository.id}>{'　'.repeat(repository.depth)}{repository.depth ? '└ ' : ''}{repository.name}</option>)}</select></label>
          <details className="admin-advanced-fields"><summary>高级排序</summary><label>排序值<input type="number" value={draft.sort_order} onChange={(event) => setDraft((value) => ({ ...value, sort_order: Number(event.target.value) || 0 }))} /><small>数字越小越靠前</small></label></details>
          <button className="primary-button repository-save-button" type="button" onClick={save} disabled={saving}><Save />{saving ? '保存中…' : '保存仓库'}</button>
        </section>
      </div>
    </div>
  );
}
