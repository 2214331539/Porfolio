import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Portfolio, PortfolioProfile, Project, ProjectInput } from '../../entities/project/model/projects';
import { portfolioApi, portfolioAssetUrl } from '../../features/content/api/portfolio-api';
import { useAdminDirtyState, useAdminUi } from './AdminUi';
import { AdminImageDropzone } from './AdminImageDropzone';
import './portfolio-admin.css';

const emptyProject = (): ProjectInput => ({ slug: '', name: '', summary: '', category: '', description: '', icon_key: 'default', icon_url: '', url: '', link_label: '访问作品', keywords: [], screenshots: [], status: 'draft', sort_order: 0 });
const message = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试';
function toInput(project: Project): ProjectInput { const { id: _id, ...input } = project; return input; }

export function PortfolioAdmin() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const { confirmAction, notify } = useAdminUi();
  const refresh = () => portfolioApi.get(true).then((result) => { setData(result); setError(''); }).catch((err) => setError(message(err)));
  useEffect(() => { void refresh(); }, []);
  async function remove(project: Project) {
    if (!await confirmAction({ title: `删除“${project.name}”？`, description: '作品将从列表和前台移除，已上传文件会保留。', confirmLabel: '删除作品', tone: 'danger' })) return;
    setBusy(true);
    try { await portfolioApi.deleteProject(project.id); await refresh(); notify('作品已删除'); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  const shown = data?.projects.filter((p) => (status === 'all' || p.status === status) && `${p.name} ${p.summary}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  return <div className="portfolio-admin">
    <div className="admin-title"><div><p>内容管理</p><h1>作品集</h1><span>管理作品、截图与发布状态。</span></div><Link className="admin-button primary" to="/admin/portfolio/new"><Plus size={16}/>新建作品</Link></div>
    <div className="pa-overview"><div><strong>{data?.profile.title || '个人介绍'}</strong><p>{data?.profile.introduction || '设置作品集首页的标题与个人介绍。'}</p></div><Link className="admin-button secondary" to="/admin/portfolio/profile">编辑个人介绍</Link><a className="admin-button secondary" href="/portfolio" target="_blank" rel="noreferrer">查看前台<ExternalLink size={14}/></a></div>
    {error ? <div className="form-error" role="alert">{error}<button type="button" onClick={refresh}>重试</button></div> : null}
    <div className="pa-filters"><input aria-label="搜索作品" placeholder="搜索作品名称或简介" value={query} onChange={(e) => setQuery(e.target.value)}/><select aria-label="发布状态筛选" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select></div>
    {!data && !error ? <p role="status">正在读取作品…</p> : null}
    {data && !shown.length ? <div className="admin-empty-state">{data.projects.length ? '没有匹配的作品' : '还没有作品，先创建一个吧。'}</div> : null}
    <div className="pa-list">{shown.map((project) => <div className="pa-row" key={project.id}><div className="pa-order" title="展示顺序">{project.sort_order}</div><div><Link className="pa-project-name" to={`/admin/portfolio/${project.id}`}>{project.name}</Link><p>{project.summary || '暂无简介'}</p><small>{project.screenshots.length} 张截图 · {project.category || '未填写类别'}</small></div><span className={`status ${project.status}`}>{project.status === 'published' ? '已发布' : '草稿'}</span><Link className="admin-button secondary" to={`/admin/portfolio/${project.id}`}>编辑</Link><button type="button" className="pa-icon-button" disabled={busy} aria-label={`删除${project.name}`} onClick={() => remove(project)}><Trash2 size={16}/></button></div>)}</div>
  </div>;
}

export function PortfolioProfileEditor() {
  const [draft, setDraft] = useState<PortfolioProfile | null>(null);
  const [snapshot, setSnapshot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { notify, runAfterDiscardCheck } = useAdminUi();
  useAdminDirtyState(!!draft && JSON.stringify(draft) !== snapshot);
  useEffect(() => { let active = true; portfolioApi.get(true).then(({ profile }) => { if (active) { setDraft(profile); setSnapshot(JSON.stringify(profile)); } }).catch((err) => { if (active) setError(message(err)); }); return () => { active = false; }; }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return; setBusy(true); setError('');
    try { const saved = await portfolioApi.saveProfile(draft); setDraft(saved); setSnapshot(JSON.stringify(saved)); notify('个人介绍已更新'); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <div className="portfolio-admin"><button className="pa-back" type="button" disabled={busy} onClick={() => runAfterDiscardCheck(() => navigate('/admin/portfolio'))}><ArrowLeft size={16}/>返回作品集</button><div className="admin-title"><h1>个人介绍</h1></div>{error ? <p className="form-error" role="alert">{error}</p> : null}{draft ? <form className="pa-profile-form" onSubmit={save}><fieldset disabled={busy}><label>页面标题<input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/></label><label>个人介绍<textarea rows={10} maxLength={10000} value={draft.introduction} onChange={(e) => setDraft({ ...draft, introduction: e.target.value })}/><small>段落之间空一行，前台会保留分段。</small></label><button className="admin-button primary" type="submit">{busy ? '正在保存…' : '保存介绍'}</button></fieldset></form> : !error ? <p role="status">正在加载…</p> : null}</div>;
}

export function PortfolioProjectEditor() {
  const { id } = useParams();
  const projectId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const { notify, runAfterDiscardCheck } = useAdminUi();
  const [draft, setDraft] = useState<ProjectInput>(emptyProject);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(emptyProject()));
  const [loading, setLoading] = useState(!!id);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== snapshot;
  useAdminDirtyState(dirty || uploading || saving);
  useEffect(() => {
    let active = true; setLoadFailed(false); setError('');
    if (projectId === undefined) { const blank = emptyProject(); setDraft(blank); setSnapshot(JSON.stringify(blank)); setLoading(false); return; }
    if (!Number.isSafeInteger(projectId) || projectId <= 0) { setError('作品标识无效'); setLoadFailed(true); setLoading(false); return; }
    setLoading(true);
    portfolioApi.getProject(projectId).then((project) => { if (active) { const input = toInput(project); setDraft(input); setSnapshot(JSON.stringify(input)); } }).catch((err) => { if (active) { setError(message(err)); setLoadFailed(true); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);
  function field<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function upload(files: File[], icon = false) {
    if (uploading) return;
    const available = icon ? 1 : 20 - draft.screenshots.length;
    if (files.length > available) { setError(icon ? '每次选择一个图标' : '最多上传 20 张截图'); return; }
    if (files.some((f) => f.size > 10 * 1024 * 1024)) { setError('每张图片不能超过 10MB'); return; }
    setUploading(true); setError('');
    const results: PromiseSettledResult<{ url: string }>[] = [];
    for (let offset = 0; offset < files.length; offset += 3) {
      results.push(...await Promise.allSettled(files.slice(offset, offset + 3).map((file) => portfolioApi.upload(file))));
    }
    const successful = results.flatMap((result, index) => result.status === 'fulfilled' ? [{ src: result.value.url, alt: files[index].name.replace(/\.[^.]+$/, '') }] : []);
    setDraft((current) => icon ? { ...current, icon_url: successful[0]?.src ?? current.icon_url } : { ...current, screenshots: [...current.screenshots, ...successful] });
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) setError(`${failed.length} 张图片上传失败，已保留成功上传的图片。`);
    setUploading(false);
  }
  function move(index: number, direction: number) {
    const items = [...draft.screenshots]; const other = index + direction;
    if (other < 0 || other >= items.length) return;
    [items[index], items[other]] = [items[other], items[index]]; field('screenshots', items);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const saved = await portfolioApi.saveProject({ ...draft, keywords: draft.keywords.map((word) => word.trim()).filter(Boolean) }, projectId); const input = toInput(saved);
      setDraft(input); setSnapshot(JSON.stringify(input)); notify(saved.status === 'published' ? '作品已发布' : '草稿已保存');
      if (!projectId) navigate(`/admin/portfolio/${saved.id}`, { replace: true });
    } catch (err) { setError(message(err)); } finally { setSaving(false); }
  }
  return <div className="portfolio-admin"><div className="pa-editor-head"><button className="pa-back" type="button" disabled={saving || uploading} onClick={() => runAfterDiscardCheck(() => navigate('/admin/portfolio'))}><ArrowLeft size={16}/>返回作品集</button><span>{dirty ? '有未保存更改' : '已保存'}</span></div><div className="admin-title"><h1>{projectId ? '编辑作品' : '新建作品'}</h1></div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {loading ? <p role="status">正在读取作品…</p> : loadFailed ? <p>无法加载该作品，请返回列表重试。</p> : <form onSubmit={save}><fieldset disabled={saving || uploading} className="pa-editor-grid">
      <div className="pa-editor-main"><section className="pa-panel"><h2>作品信息</h2><label>作品名称<input required maxLength={120} value={draft.name} onChange={(e) => field('name', e.target.value)}/></label><label>一句话简介<input maxLength={300} value={draft.summary} onChange={(e) => field('summary', e.target.value)}/></label><label>详细介绍<textarea rows={6} maxLength={20000} value={draft.description} onChange={(e) => field('description', e.target.value)}/><small>访客点击“了解作品”后展开。</small></label></section>
      <section className="pa-panel"><h2>作品截图 <small>{draft.screenshots.length} / 20</small></h2><p>按下方顺序在前台横向展示，访客可点击放大。</p><AdminImageDropzone title="上传截图" hint="JPG、PNG 或 WebP，每张不超过 10MB" buttonLabel="选择图片" uploading={uploading} multiple onFiles={(files) => upload(files)} onInvalid={setError}/>
        <div className="pa-shots">{draft.screenshots.map((shot, index) => <div className="pa-shot" key={`${shot.src}-${index}`}><img src={portfolioAssetUrl(shot.src)} alt={shot.alt || `截图 ${index + 1}`}/><label>截图 {index + 1} 说明<input maxLength={200} value={shot.alt} onChange={(e) => field('screenshots', draft.screenshots.map((s, i) => i === index ? { ...s, alt: e.target.value } : s))}/></label><div><button className="pa-icon-button" type="button" disabled={index === 0} aria-label={`前移截图 ${index + 1}`} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button className="pa-icon-button" type="button" disabled={index === draft.screenshots.length - 1} aria-label={`后移截图 ${index + 1}`} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button className="pa-icon-button" type="button" aria-label={`移除截图 ${index + 1}`} onClick={() => field('screenshots', draft.screenshots.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div></div>)}</div>
      </section></div>
      <aside className="pa-panel pa-editor-aside"><h2>展示设置</h2><label>发布状态<select value={draft.status} onChange={(e) => field('status', e.target.value as ProjectInput['status'])}><option value="draft">草稿 · 仅后台可见</option><option value="published">已发布 · 前台展示</option></select></label><label>展示顺序<input type="number" min={0} max={100000} required value={draft.sort_order} onChange={(e) => field('sort_order', Number(e.target.value))}/><small>数字越小，位置越靠前。</small></label><label>作品标识<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={draft.slug} onChange={(e) => field('slug', e.target.value)}/><small>例如 soundtag，用于作品定位链接。</small></label><label>类别与平台<input maxLength={100} value={draft.category} onChange={(e) => field('category', e.target.value)} placeholder="移动应用 · iOS"/></label><label>标签<input value={draft.keywords.join('，')} onChange={(e) => field('keywords', e.target.value.split(/[,，]/))}/><small>以逗号分隔，最多 12 个。</small></label><label>作品链接<input type="url" maxLength={500} value={draft.url} onChange={(e) => field('url', e.target.value)} placeholder="https://"/></label><label>链接按钮文字<input required maxLength={30} value={draft.link_label} onChange={(e) => field('link_label', e.target.value)}/></label><label>默认图标<select value={draft.icon_key} onChange={(e) => field('icon_key', e.target.value as ProjectInput['icon_key'])}><option value="default">应用</option><option value="couploc">位置</option><option value="soundtag">NFC</option><option value="cooking">烹饪</option><option value="impromptu">声音</option><option value="shopify">插件</option></select></label>
      <AdminImageDropzone title="作品图标" hint="可选，未上传时使用默认图标" buttonLabel="上传图标" uploading={uploading} onFiles={(files) => upload(files, true)} onInvalid={setError} onClear={draft.icon_url ? () => field('icon_url', '') : undefined}>{draft.icon_url ? <img className="pa-icon-preview" src={portfolioAssetUrl(draft.icon_url)} alt="图标预览"/> : null}</AdminImageDropzone>
      <button className="admin-button primary" type="submit">{saving ? '正在保存…' : uploading ? '正在上传…' : draft.status === 'published' ? '保存并发布' : '保存草稿'}</button></aside>
    </fieldset></form>}
  </div>;
}
