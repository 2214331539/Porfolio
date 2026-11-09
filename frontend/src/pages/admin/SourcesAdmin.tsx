import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import type { InfoSource, InfoSourceInput } from '../../entities/source/model/types';
import { bubbleTone } from '../../features/sources/BubbleField';
import { hostOf, sourcesApi } from '../../features/sources/sources-api';
import { errorMessage } from '../../shared/format';
import { Dialog, useAdminUi } from './AdminUi';

const BubbleField = lazy(() => import('../../features/sources/BubbleField').then((module) => ({ default: module.BubbleField })));
const SWATCHES = ['#1d6bff', '#ff6b3d', '#c6f24e', '#ff8fd0', '#ffd23f', '#7c5cff', '#20c997', '#1a1a1a'];
const SIZES = [{ value: 1, label: '偶尔' }, { value: 2, label: '有时' }, { value: 3, label: '常看' }, { value: 4, label: '很常' }, { value: 5, label: '每天' }];
const empty = (): InfoSourceInput => ({ name: '', url: 'https://', description: '', category: '', color: '', icon_url: '', weight: 3, sort_order: 0, is_visible: true });
const toInput = ({ id: _id, ...rest }: InfoSource): InfoSourceInput => rest;

function SourceForm({ initial, categories, onCancel, onSave }: { initial: InfoSourceInput; categories: string[]; onCancel: () => void; onSave: (input: InfoSourceInput) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof InfoSourceInput>(key: K, value: InfoSourceInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const preview = bubbleTone({ ...draft, id: 0 });
  const valid = draft.name.trim() && /^https?:\/\/[^\s/]+\.[^\s]+/.test(draft.url.trim());
  return (
    <form className="form-stack source-form" onSubmit={(event) => { event.preventDefault(); if (!valid) return; setSaving(true); void onSave({ ...draft, name: draft.name.trim(), url: draft.url.trim() }).finally(() => setSaving(false)); }}>
      <div className="source-form-head">
        <span className="source-form-ball" style={{ background: preview.base, color: preview.ink, width: 44 + draft.weight * 10, height: 44 + draft.weight * 10 }}>{draft.name.slice(0, 4) || '名称'}</span>
        <div className="form-stack">
          <label className="field"><span>名称</span><input value={draft.name} maxLength={60} onChange={(event) => set('name', event.target.value)} placeholder="例如：LinuxDo" autoFocus /></label>
          <label className="field"><span>网址</span><input value={draft.url} maxLength={500} onChange={(event) => set('url', event.target.value)} placeholder="https://" /></label>
        </div>
      </div>
      <label className="field"><span>一句话介绍</span><textarea rows={2} value={draft.description} maxLength={500} onChange={(event) => set('description', event.target.value)} placeholder="鼠标停在圆球上时显示" /></label>
      <label className="field"><span>分类</span><input value={draft.category} maxLength={40} list="source-categories" onChange={(event) => set('category', event.target.value)} placeholder="社区 / 资讯 / 视频 / 社交…" /><datalist id="source-categories">{categories.map((name) => <option key={name} value={name} />)}</datalist></label>
      <div className="field"><span>多常去（决定圆球大小）</span>
        <div className="segmented">{SIZES.map((size) => <button key={size.value} type="button" className={draft.weight === size.value ? 'active' : ''} onClick={() => set('weight', size.value)}>{size.label}</button>)}</div>
      </div>
      <div className="field"><span>颜色</span>
        <div className="swatches">
          <button type="button" className={`swatch auto ${!draft.color ? 'active' : ''}`} onClick={() => set('color', '')} title="按分类自动配色">自动</button>
          {SWATCHES.map((color) => <button key={color} type="button" className={`swatch ${draft.color === color ? 'active' : ''}`} style={{ background: color }} onClick={() => set('color', color)} aria-label={color} />)}
          <label className="swatch custom" title="自定义颜色"><input type="color" value={draft.color || '#1d6bff'} onChange={(event) => set('color', event.target.value)} /></label>
        </div>
      </div>
      <details className="source-more"><summary>更多</summary>
        <label className="field"><span>图标链接（可选）</span><input value={draft.icon_url} maxLength={500} onChange={(event) => set('icon_url', event.target.value)} placeholder="https://…/favicon.png" /></label>
        <label className="toggle"><input type="checkbox" checked={draft.is_visible} onChange={(event) => set('is_visible', event.target.checked)} /><span>在前台显示</span></label>
      </details>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel}>取消</button>
        <button type="submit" className="button primary" disabled={!valid || saving}>{saving ? '保存中…' : '保存'}</button>
      </div>
    </form>
  );
}

export function SourcesAdmin() {
  const [items, setItems] = useState<InfoSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: number; input: InfoSourceInput } | null>(null);
  const { notify, confirmAction } = useAdminUi();
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))], [items]);
  const visible = useMemo(() => items.filter((item) => item.is_visible), [items]);

  const load = () => sourcesApi.listAdmin().then(setItems).catch((err) => notify(errorMessage(err, '加载失败'), 'error')).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(input: InfoSourceInput, id?: number) {
    try {
      await sourcesApi.save(input, id);
      await load();
      setEditing(null);
      notify(id ? '已更新' : `已添加「${input.name}」`);
    } catch (err) {
      notify(errorMessage(err, '保存失败'), 'error');
    }
  }

  async function remove(item: InfoSource) {
    if (!await confirmAction({ title: `删除「${item.name}」？`, description: '只是从信息源泉里移除，不影响那个网站本身。', confirmLabel: '删除', tone: 'danger' })) return;
    try { await sourcesApi.remove(item.id); await load(); notify('已删除'); } catch (err) { notify(errorMessage(err, '删除失败'), 'error'); }
  }

  return (
    <div className="admin-page sources-admin">
      <header className="page-header">
        <div><h1>信息源泉</h1><p>前台用会掉落、可拖拽的圆球展示，越常去的网站圆越大。</p></div>
        <div className="page-header-actions">
          <a className="button" href="/sources" target="_blank" rel="noreferrer">查看页面<ArrowUpRight aria-hidden="true" /></a>
          <button type="button" className="button primary" onClick={() => setEditing({ input: empty() })}><Plus aria-hidden="true" />添加网站</button>
        </div>
      </header>

      <section className="panel source-preview" aria-label="效果预览">
        {visible.length ? <Suspense fallback={<div style={{ height: 240 }} />}><BubbleField key={visible.map((item) => `${item.id}-${item.weight}-${item.color}`).join()} sources={visible} height={240} compact /></Suspense> : <p className="panel-empty">还没有在前台显示的网站。</p>}
      </section>

      <div className="source-table" role="table" aria-label="网站列表">
        {loading ? <p className="panel-empty">加载中…</p> : null}
        {items.map((item) => {
          const tone = bubbleTone(item);
          return (
            <div className={`source-row ${item.is_visible ? '' : 'hidden'}`} role="row" key={item.id}>
              <span className="source-ball" style={{ background: tone.base, color: tone.ink }} aria-hidden="true">{item.name.slice(0, 1)}</span>
              <span className="source-name" role="cell"><strong>{item.name}</strong><a href={item.url} target="_blank" rel="noreferrer">{hostOf(item.url)}</a></span>
              <span className="source-desc" role="cell">{item.description || <em>没有介绍</em>}</span>
              <span role="cell">{item.category ? <span className="badge">{item.category}</span> : null}</span>
              <span className="source-weight" role="cell" title={SIZES[item.weight - 1]?.label}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < item.weight ? 'on' : ''} />)}</span>
              <span className="source-actions" role="cell">
                <button type="button" className="icon-button small" onClick={() => void save({ ...toInput(item), is_visible: !item.is_visible }, item.id)} aria-label={item.is_visible ? '在前台隐藏' : '在前台显示'} title={item.is_visible ? '在前台隐藏' : '在前台显示'}>{item.is_visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
                <button type="button" className="icon-button small" onClick={() => setEditing({ id: item.id, input: toInput(item) })} aria-label={`编辑${item.name}`}><Pencil aria-hidden="true" /></button>
                <button type="button" className="icon-button small" onClick={() => void remove(item)} aria-label={`删除${item.name}`}><Trash2 aria-hidden="true" /></button>
              </span>
            </div>
          );
        })}
      </div>

      {editing ? (
        <Dialog title={editing.id ? '编辑网站' : '添加网站'} onClose={() => setEditing(null)} size="medium">
          <SourceForm initial={editing.input} categories={categories} onCancel={() => setEditing(null)} onSave={(input) => save(input, editing.id)} />
        </Dialog>
      ) : null}
    </div>
  );
}
