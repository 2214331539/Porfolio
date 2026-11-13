import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import type { Doing, DoingInput, DoingKind } from '../../entities/doing/model/types';
import { Clothesline, type MoveHandler } from '../../features/doing/Clothesline';
import { doingApi, todayIso } from '../../features/doing/doing-api';
import { errorMessage } from '../../shared/format';
import { Dialog, useAdminUi } from './AdminUi';

const LINES: Array<{ kind: DoingKind; label: string }> = [{ kind: 'main', label: '主线' }, { kind: 'side', label: '临时线' }];
const blank = (kind: DoingKind): DoingInput => ({ title: '', body: '', started_on: todayIso(), kind });

function DoingForm({ initial, existing, onCancel, onSave, onDelete }: {
  initial: DoingInput;
  existing: boolean;
  onCancel: () => void;
  onSave: (input: DoingInput) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof DoingInput>(key: K, value: DoingInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const valid = draft.title.trim() && draft.started_on;
  return (
    <form
      className="form-stack"
      onSubmit={(event) => { event.preventDefault(); if (!valid) return; setSaving(true); void onSave({ ...draft, title: draft.title.trim() }).finally(() => setSaving(false)); }}
    >
      <label className="field"><span>标题</span><input value={draft.title} maxLength={60} onChange={(event) => set('title', event.target.value)} placeholder="在做什么" autoFocus /></label>
      <label className="field"><span>描述（支持 Markdown）</span><textarea rows={9} value={draft.body} maxLength={5000} onChange={(event) => set('body', event.target.value)} /></label>
      <div className="doing-form-row">
        <label className="field"><span>开始日期</span><input type="date" value={draft.started_on} max="2100-12-31" onChange={(event) => set('started_on', event.target.value)} /></label>
        <div className="field"><span>放在哪根绳子</span>
          <div className="segmented">{LINES.map((line) => <button key={line.kind} type="button" className={draft.kind === line.kind ? 'active' : ''} onClick={() => set('kind', line.kind)}>{line.label}</button>)}</div>
        </div>
      </div>
      <div className="dialog-actions doing-form-actions">
        {existing ? <button type="button" className="button danger-text" onClick={onDelete}><Trash2 aria-hidden="true" />做完了，删除</button> : <span />}
        <span className="doing-form-buttons">
          <button type="button" className="button" onClick={onCancel}>取消</button>
          <button type="submit" className="button primary" disabled={!valid || saving}>{saving ? '保存中…' : '保存'}</button>
        </span>
      </div>
    </form>
  );
}

export function DoingAdmin() {
  const [items, setItems] = useState<Doing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: number; input: DoingInput } | null>(null);
  const { notify, confirmAction } = useAdminUi();

  const load = () => doingApi.listAdmin().then(setItems).catch((err) => notify(errorMessage(err, '加载失败'), 'error')).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byKind = useMemo(() => ({ main: items.filter((item) => item.kind === 'main'), side: items.filter((item) => item.kind === 'side') }), [items]);

  async function save(input: DoingInput, id?: number) {
    try {
      await doingApi.save(input, id);
      await load();
      setEditing(null);
      notify(id ? '已更新' : '已挂上');
    } catch (err) {
      notify(errorMessage(err, '保存失败'), 'error');
    }
  }

  async function remove(id: number, title: string) {
    if (!await confirmAction({ title: `删除「${title}」？`, description: '纸条会直接取下，不会留底。', confirmLabel: '删除', tone: 'danger' })) return;
    try { await doingApi.remove(id); await load(); setEditing(null); notify('已取下'); } catch (err) { notify(errorMessage(err, '删除失败'), 'error'); }
  }

  /** Takes a note off its place and hangs it before `beforeId` on the chosen rope (the end if null). */
  const move: MoveHandler = async (id, kind, beforeId) => {
    if (beforeId === id) return;
    const rest = items.filter((item) => item.id !== id);
    const main = rest.filter((item) => item.kind === 'main').map((item) => item.id);
    const side = rest.filter((item) => item.kind === 'side').map((item) => item.id);
    const target = kind === 'main' ? main : side;
    const at = beforeId === null ? -1 : target.indexOf(beforeId);
    target.splice(at < 0 ? target.length : at, 0, id);
    const lookup = new Map(items.map((item) => [item.id, item]));
    setItems([...main.map((itemId, index) => ({ ...lookup.get(itemId)!, kind: 'main' as const, sort_order: index })), ...side.map((itemId, index) => ({ ...lookup.get(itemId)!, kind: 'side' as const, sort_order: index }))]);
    try { setItems(await doingApi.arrange(main, side)); } catch (err) { notify(errorMessage(err, '排序没有保存'), 'error'); await load(); }
  };

  return (
    <div className="admin-page doing-admin">
      <header className="page-header">
        <div><h1>Doing</h1><p>点纸条编辑，拖动可以排序，也可以拖到另一根绳子上。</p></div>
        <div className="page-header-actions">
          <a className="button" href="/doing" target="_blank" rel="noreferrer">查看页面<ArrowUpRight aria-hidden="true" /></a>
          <button type="button" className="button primary" onClick={() => setEditing({ input: blank('main') })}><Plus aria-hidden="true" />新增</button>
        </div>
      </header>
      {loading ? <p className="panel-empty">加载中…</p> : LINES.map((line) => (
        <Clothesline
          key={line.kind}
          kind={line.kind}
          label={line.label}
          items={byKind[line.kind]}
          editable
          onOpen={(item) => setEditing({ id: item.id, input: { title: item.title, body: item.body, started_on: item.started_on, kind: item.kind } })}
          onAdd={() => setEditing({ input: blank(line.kind) })}
          onMove={move}
        />
      ))}
      {editing ? (
        <Dialog title={editing.id ? '编辑纸条' : '新纸条'} onClose={() => setEditing(null)} size="medium">
          <DoingForm
            initial={editing.input}
            existing={editing.id !== undefined}
            onCancel={() => setEditing(null)}
            onSave={(input) => save(input, editing.id)}
            onDelete={() => { if (editing.id !== undefined) void remove(editing.id, editing.input.title); }}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
