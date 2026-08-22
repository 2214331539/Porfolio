import { useEffect, useState } from 'react';
import { Download, FileText, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import type { ResumeStatus, ResumeVersion } from '../../entities/resume/model/types';
import { contentApi } from '../../features/content/api/content-api';

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

export function ResumeVersionsAdmin() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [draft, setDraft] = useState<ResumeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setVersions(await contentApi.listResumeVersions(true));
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : '简历版本加载失败'))
      .finally(() => setLoading(false));
  }, []);

  function edit(version?: ResumeVersion) {
    setEditingId(version?.id);
    setDraft(version ? draftFromVersion(version) : emptyDraft());
    setError('');
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setUploadingImage(true);
    setError('');
    try {
      const uploaded = await contentApi.uploadImage(file);
      setDraft((value) => ({ ...value, image_url: uploaded.url }));
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
      await contentApi.saveResumeVersion({
        id: editingId,
        ...draft,
        title: draft.title.trim(),
        label: draft.label.trim(),
        description: draft.description.trim(),
        image_url: draft.image_url.trim(),
        pdf_url: draft.pdf_url.trim() || null,
      });
      await refresh();
      edit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历版本保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove(version: ResumeVersion) {
    if (!window.confirm(`确定删除简历版本“${version.title}”吗？`)) return;
    setError('');
    try {
      await contentApi.deleteResumeVersion(version.id);
      await refresh();
      if (editingId === version.id) edit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历版本删除失败');
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
            <article className="resume-admin-row" key={version.id}>
              <img src={version.image_url} alt="" loading="lazy" />
              <div>
                <span>{version.is_current ? '当前版本' : version.status === 'published' ? '已发布' : '草稿'} · {version.label}</span>
                <strong>{version.title}</strong>
                <small>{new Date(`${version.version_date}T00:00:00`).toLocaleDateString('zh-CN')}</small>
              </div>
              <div className="resume-admin-row-actions">
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
          <label>版本标题<input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="例如：2026 产品设计简历" /></label>
          <label>右上角分类标签<input value={draft.label} onChange={(event) => setDraft((value) => ({ ...value, label: event.target.value }))} placeholder="例如：产品设计" maxLength={40} /></label>
          <label>版本日期<input type="date" value={draft.version_date} onChange={(event) => setDraft((value) => ({ ...value, version_date: event.target.value }))} /></label>
          <label>版本说明<textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="简要说明这一版本的侧重点或更新内容" /></label>

          <div className="resume-upload-field">
            <div><strong>简历图片</strong><small>推荐上传清晰的长图或 A4 页面截图</small></div>
            {draft.image_url ? <img src={draft.image_url} alt="简历预览" /> : null}
            <label className="cover-file-input"><Upload /><span>{uploadingImage ? '上传中…' : draft.image_url ? '更换图片' : '上传简历图片'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} disabled={uploadingImage} /></label>
          </div>

          <div className="resume-upload-field">
            <div><strong>PDF 文件（可选）</strong><small>最大 15MB，上传后前台将显示下载按钮</small></div>
            {draft.pdf_url ? <div className="resume-pdf-ready"><Download /><span>PDF 已就绪</span><button type="button" onClick={() => setDraft((value) => ({ ...value, pdf_url: '' }))}>移除</button></div> : null}
            <label className="cover-file-input"><Upload /><span>{uploadingPdf ? '上传中…' : draft.pdf_url ? '更换 PDF' : '上传 PDF'}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => uploadPdf(event.target.files?.[0])} disabled={uploadingPdf} /></label>
          </div>

          <div className="resume-editor-options">
            <label>排序值<input type="number" value={draft.sort_order} onChange={(event) => setDraft((value) => ({ ...value, sort_order: Number(event.target.value) || 0 }))} /></label>
            <label>发布状态<select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as ResumeStatus, is_current: event.target.value === 'draft' ? false : value.is_current }))}><option value="draft">草稿</option><option value="published">已发布</option></select></label>
          </div>
          <label className="admin-checkbox"><input type="checkbox" checked={draft.is_current} onChange={(event) => setDraft((value) => ({ ...value, is_current: event.target.checked, status: event.target.checked ? 'published' : value.status }))} />设为当前最新版</label>
          <button className="primary-button resume-version-save" type="button" onClick={save} disabled={saving || uploadingImage || uploadingPdf}><Save />{saving ? '保存中…' : '保存版本'}</button>
        </section>
      </div>
    </div>
  );
}
