import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Download, FileText, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import type { ResumeStatus, ResumeVersion } from '../../entities/resume/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { useAdminDirtyState, useAdminUi } from './AdminUi';

type ResumeDraft = {
  title: string;
  label: string;
  description: string;
  image_url: string;
  pdf_url: string;
  version_date: string;
  status: ResumeStatus;
  is_current: boolean;
  sort_order: number;
};

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

const emptyDraft = (): ResumeDraft => ({
  title: '',
  label: '个人简历',
  description: '',
  image_url: '',
  pdf_url: '',
  version_date: localToday(),
  status: 'draft',
  is_current: false,
  sort_order: 0,
});

function draftFromVersion(version: ResumeVersion): ResumeDraft {
  return {
    title: version.title,
    label: version.label,
    description: version.description,
    image_url: version.image_url,
    pdf_url: version.pdf_url ?? '',
    version_date: version.version_date,
    status: version.status,
    is_current: version.is_current,
    sort_order: version.sort_order,
  };
}

type ResumeDropzoneProps = {
  kind: 'image' | 'pdf';
  title: string;
  hint: string;
  accept: string;
  buttonLabel: string;
  uploading: boolean;
  onFile: (file: File) => Promise<void>;
  onInvalid: (message: string) => void;
  children?: ReactNode;
};

function ResumeDropzone({ kind, title, hint, accept, buttonLabel, uploading, onFile, onInvalid, children }: ResumeDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function validate(file: File) {
    if (kind === 'image') {
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      return isImage ? '' : '请拖入 JPG、PNG 或 WebP 图片';
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) return '请拖入 PDF 文件';
    if (file.size > 15 * 1024 * 1024) return 'PDF 文件不能超过 15MB';
    return '';
  }

  function chooseFile(file: File | undefined) {
    if (!file || uploading) return;
    const validationError = validate(file);
    if (validationError) {
      onInvalid(validationError);
      return;
    }
    void onFile(file);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploading || !event.dataTransfer.types.includes('Files')) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? 'none' : 'copy';
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  return (
    <div
      className={`resume-upload-field resume-dropzone ${kind} ${dragging ? 'is-dragging' : ''} ${uploading ? 'is-uploading' : ''}`}
      role="group"
      aria-label={`${title}上传区域`}
      aria-busy={uploading}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="resume-dropzone-intro">
        <span className="resume-dropzone-icon"><Upload aria-hidden="true" /></span>
        <div><strong>{dragging ? '松开鼠标开始上传' : title}</strong><small>{dragging ? `已识别文件，松开即可上传${kind === 'pdf' ? ' PDF' : '图片'}` : hint}</small></div>
      </div>
      {children}
      <div className="resume-dropzone-actions">
        <label className="cover-file-input resume-dropzone-picker">
          <Upload aria-hidden="true" />
          <span>{uploading ? '上传中…' : buttonLabel}</span>
          <input
            type="file"
            accept={accept}
            onChange={(event) => {
              const input = event.currentTarget;
              chooseFile(input.files?.[0]);
              input.value = '';
            }}
            disabled={uploading}
          />
        </label>
        <span>或将文件拖入此区域</span>
      </div>
    </div>
  );
}

export function ResumeVersionsAdmin() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [draft, setDraft] = useState<ResumeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [error, setError] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(emptyDraft()));
  const { confirmAction, notify, runAfterDiscardCheck } = useAdminUi();
  const draftSnapshot = JSON.stringify(draft);
  const isDirty = draftSnapshot !== savedSnapshot;
  useAdminDirtyState(isDirty);

  function showUploadError(message: string) {
    setError(message);
    notify(message, 'error');
  }

  async function refresh() {
    const items = await contentApi.listResumeVersions(true);
    setVersions(items);
    return items;
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : '简历版本加载失败'))
      .finally(() => setLoading(false));
  }, []);

  function setCleanDraft(nextDraft: ResumeDraft, nextEditingId?: number) {
    setEditingId(nextEditingId);
    setDraft(nextDraft);
    setSavedSnapshot(JSON.stringify(nextDraft));
    setError('');
  }

  function edit(version?: ResumeVersion) {
    runAfterDiscardCheck(() => setCleanDraft(version ? draftFromVersion(version) : emptyDraft(), version?.id));
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setUploadingImage(true);
    setError('');
    try {
      const uploaded = await contentApi.uploadImage(file);
      setDraft((value) => ({ ...value, image_url: uploaded.url }));
      notify('简历图片已上传');
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  }

  async function uploadPdf(file: File | undefined) {
    if (!file) return;
    setUploadingPdf(true);
    setError('');
    try {
      const uploaded = await contentApi.uploadDocument(file);
      setDraft((value) => ({ ...value, pdf_url: uploaded.url }));
      notify('PDF 已上传');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 上传失败');
    } finally {
      setUploadingPdf(false);
    }
  }

  async function save() {
    if (!draft.title.trim() || !draft.label.trim() || !draft.image_url.trim()) {
      setError('请填写标题、分类标签并上传简历图片');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await contentApi.saveResumeVersion({
        id: editingId,
        ...draft,
        title: draft.title.trim(),
        label: draft.label.trim(),
        description: draft.description.trim(),
        image_url: draft.image_url.trim(),
        pdf_url: draft.pdf_url.trim() || null,
      });
      const items = await refresh();
      const refreshed = items.find((version) => version.id === saved.id) ?? saved;
      setCleanDraft(draftFromVersion(refreshed), refreshed.id);
      notify(saved.status === 'published' ? '简历版本已发布' : '简历草稿已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历版本保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove(version: ResumeVersion) {
    const accepted = await confirmAction({ title: `删除“${version.title}”？`, description: version.is_current ? '这是当前展示版本。删除后，系统会自动选择最近的已发布版本。' : '该简历版本及其公开下载入口将被移除。', confirmLabel: '删除版本', tone: 'danger' });
    if (!accepted) return;
    setError('');
    try {
      await contentApi.deleteResumeVersion(version.id);
      await refresh();
      if (editingId === version.id) setCleanDraft(emptyDraft());
      notify('简历版本已删除');
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历版本删除失败');
    }
  }

  async function makeCurrent(version: ResumeVersion) {
    setError('');
    try {
      await contentApi.saveResumeVersion({ id: version.id, status: 'published', is_current: true });
      const items = await refresh();
      if (editingId) {
        const currentEditor = items.find((item) => item.id === editingId);
        if (currentEditor && !isDirty) setCleanDraft(draftFromVersion(currentEditor), currentEditor.id);
      }
      notify(`“${version.title}”已设为当前版本`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '当前版本设置失败');
    }
  }

  return (
    <div>
      <div className="admin-title">
        <div><p>PROFILE / RESUME ARCHIVE</p><h1>简历版本</h1></div>
        <button className="primary-button" type="button" onClick={() => edit()}><Plus />新增版本</button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="resume-admin-layout">
        <section className="admin-panel resume-version-list">
          <div className="panel-title"><h2>全部版本</h2><small>{versions.length} 个版本</small></div>
          {loading ? <div className="resume-admin-empty">正在加载版本…</div> : null}
          {!loading && !versions.length ? <div className="resume-admin-empty"><FileText /><span>还没有简历版本。</span></div> : null}
          {versions.map((version) => (
            <article className={`resume-admin-row ${version.is_current ? 'current' : ''}`} key={version.id}>
              <img src={version.image_url} alt="" loading="lazy" />
              <div>
                <span>{version.is_current ? '当前版本' : version.status === 'published' ? '已发布' : '草稿'} · {version.label}</span>
                <strong>{version.title}</strong>
                <small>{new Date(`${version.version_date}T00:00:00`).toLocaleDateString('zh-CN')}</small>
              </div>
              <div className="resume-admin-row-actions">
                {!version.is_current && version.status === 'published' ? <button type="button" onClick={() => makeCurrent(version)} disabled={isDirty} title={isDirty ? '请先保存当前编辑内容' : undefined}>设为当前</button> : null}
                <button type="button" onClick={() => edit(version)}>编辑</button>
                <button type="button" onClick={() => remove(version)} aria-label={`删除${version.title}`}><Trash2 /></button>
              </div>
            </article>
          ))}
        </section>

        <section className="admin-panel resume-version-editor">
          <div className="panel-title">
            <h2>{editingId ? '编辑简历版本' : '新增简历版本'}</h2>
            {editingId ? <button type="button" onClick={() => edit()} aria-label="关闭编辑"><X /></button> : null}
          </div>
          <label>版本标题<input name="resume-title" autoComplete="off" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="例如：2026 产品设计简历…" /></label>
          <label>分类标签<input name="resume-label" autoComplete="off" value={draft.label} onChange={(event) => setDraft((value) => ({ ...value, label: event.target.value }))} placeholder="例如：产品设计…" maxLength={40} /></label>
          <label>版本日期<input type="date" value={draft.version_date} onChange={(event) => setDraft((value) => ({ ...value, version_date: event.target.value }))} /></label>
          <label>版本说明<textarea name="resume-description" autoComplete="off" value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="简要说明这一版本的侧重点或更新内容…" /></label>

          <ResumeDropzone
            kind="image"
            title="简历图片"
            hint="推荐上传清晰的长图或 A4 页面截图"
            accept="image/jpeg,image/png,image/webp"
            buttonLabel={draft.image_url ? '更换图片' : '选择简历图片'}
            uploading={uploadingImage}
            onFile={uploadImage}
            onInvalid={showUploadError}
          >
            {draft.image_url ? <img src={draft.image_url} alt="简历预览" /> : null}
          </ResumeDropzone>

          <ResumeDropzone
            kind="pdf"
            title="PDF 文件（可选）"
            hint="最大 15MB，上传后支持前台高清阅读与下载"
            accept="application/pdf,.pdf"
            buttonLabel={draft.pdf_url ? '更换 PDF' : '选择 PDF'}
            uploading={uploadingPdf}
            onFile={uploadPdf}
            onInvalid={showUploadError}
          >
            {draft.pdf_url ? <div className="resume-pdf-ready"><Download /><span>PDF 已就绪</span><a href={draft.pdf_url} target="_blank" rel="noreferrer">查看</a><button type="button" onClick={() => setDraft((value) => ({ ...value, pdf_url: '' }))}>移除</button></div> : null}
          </ResumeDropzone>

          <label>发布状态<select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as ResumeStatus, is_current: event.target.value === 'draft' ? false : value.is_current }))}><option value="draft">草稿</option><option value="published">已发布</option></select></label>
          <label className="admin-checkbox"><input type="checkbox" checked={draft.is_current} onChange={(event) => setDraft((value) => ({ ...value, is_current: event.target.checked, status: event.target.checked ? 'published' : value.status }))} />设为当前最新版</label>
          <details className="admin-advanced-fields"><summary>高级排序</summary><label>排序值<input type="number" value={draft.sort_order} onChange={(event) => setDraft((value) => ({ ...value, sort_order: Number(event.target.value) || 0 }))} /><small>通常无需修改，历史版本默认按日期排列。</small></label></details>
          <div className="admin-editor-save"><span className={`save-state ${isDirty ? 'dirty' : ''}`}>{saving ? '正在保存…' : isDirty ? '有未保存更改' : '所有更改已保存'}</span><button className="primary-button resume-version-save" type="button" onClick={save} disabled={saving || uploadingImage || uploadingPdf || !isDirty}><Save />{saving ? '保存中…' : '保存版本'}</button></div>
        </section>
      </div>
    </div>
  );
}
