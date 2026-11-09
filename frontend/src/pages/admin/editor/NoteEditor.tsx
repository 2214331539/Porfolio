import { forwardRef, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { ArrowUpRight, Check, Folder, FolderOpen, Hash, ImagePlus, Inbox, Link2, MoreHorizontal, SlidersHorizontal, Trash2, Undo2, X } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Note, NoteInput } from '../../../entities/note/model/types';
import { flattenRepositories, repositoryBreadcrumbs } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';
import { assetUrl, contentApi, storedAssetUrl } from '../../../features/content/api/content-api';
import { errorMessage, formatDate } from '../../../shared/format';
import { useAdminDirtyState, useAdminUi, type MenuItem } from '../AdminUi';
import { AutoTextarea, EditorTopBar, Popover, Property, SaveIndicator, Switch, TagInput, type SaveState } from './EditorChrome';

type Draft = { title: string; content: string; images: string[]; topics: string[]; repository_id: number | null; is_pinned: boolean };
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const draftFrom = (note: Note): Draft => ({ title: note.title, content: note.content, images: note.images.map((image) => storedAssetUrl(image)), topics: note.topics, repository_id: note.repository?.id ?? note.repository_id ?? null, is_pinned: note.is_pinned });

export function NoteEditor() {
  const { id = 'new' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify, confirmAction, openMenu, runAfterDiscardCheck } = useAdminUi();
  const editingId = id === 'new' ? null : Number(id);
  const [server, setServer] = useState<Note | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({ title: '', content: '', images: [], topics: [], repository_id: Number(searchParams.get('repo')) || null, is_pinned: false }));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [loading, setLoading] = useState(editingId !== null);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const createdId = useRef<number | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirty = JSON.stringify(draft) !== baseline;
  const isPublished = server?.status === 'published';
  useAdminDirtyState(dirty || uploading > 0);

  useEffect(() => {
    contentApi.listRepositories('note', true).then(setRepositories).catch(() => undefined);
    contentApi.listNotes(true).then((notes) => setTopicSuggestions([...new Set(notes.flatMap((note) => note.topics))])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (editingId === null || editingId === createdId.current) return;
    setLoading(true);
    contentApi.getAdminNote(editingId)
      .then((note) => { const loaded = draftFrom(note); setServer(note); setDraft(loaded); setBaseline(JSON.stringify(loaded)); })
      .catch((err) => setLoadError(errorMessage(err, '图文加载失败')))
      .finally(() => setLoading(false));
  }, [editingId]);

  async function save(nextStatus?: 'draft' | 'published') {
    const current = draftRef.current;
    if (!current.title.trim()) { notify('请先填写标题', 'error'); return false; }
    setSaveState({ kind: 'saving' });
    const payload: NoteInput = { id: server?.id, title: current.title.trim(), content: current.content, images: current.images, topics: current.topics, repository_id: current.repository_id, is_pinned: current.is_pinned, status: nextStatus ?? server?.status ?? 'draft' };
    try {
      const saved = await contentApi.saveNote(payload);
      setServer(saved);
      setBaseline(JSON.stringify(current));
      setSaveState({ kind: 'saved', at: new Date() });
      if (!server) { createdId.current = saved.id; navigate(`/admin/notes/${saved.id}`, { replace: true, state: location.state }); }
      notify(saved.status === 'published' ? server?.status === 'published' ? '更新已发布' : '图文已发布' : server?.status === 'published' ? '已撤回为草稿' : '草稿已保存');
      return true;
    } catch (err) {
      setSaveState({ kind: 'error', message: errorMessage(err) });
      notify(errorMessage(err, '保存失败'), 'error');
      return false;
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function upload(files: File[]) {
    const images = files.filter((file) => IMAGE_TYPES.has(file.type));
    if (images.length < files.length) notify('仅支持 JPG、PNG 或 WebP 图片', 'error');
    if (!images.length) return;
    setUploading((value) => value + images.length);
    const results = await Promise.allSettled(images.map((file) => contentApi.uploadImage(file)));
    const paths = results.flatMap((result) => result.status === 'fulfilled' ? [result.value.path] : []);
    setDraft((value) => ({ ...value, images: [...value.images, ...paths] }));
    setUploading((value) => value - images.length);
    if (paths.length < images.length) notify(`${images.length - paths.length} 张图片上传失败`, 'error');
  }

  function reorder(from: number, to: number) {
    setDraft((value) => {
      const images = [...value.images];
      const [moved] = images.splice(from, 1);
      images.splice(to > from ? to - 1 : to, 0, moved);
      return { ...value, images };
    });
  }

  function onPaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData.files);
    if (files.length) { event.preventDefault(); void upload(files); }
  }

  const backTarget = (location.state as { from?: string } | null)?.from ?? `/admin/notes${draft.repository_id ? `?repo=${draft.repository_id}` : ''}`;
  async function remove() {
    if (!server) { setBaseline(JSON.stringify(draft)); navigate(backTarget); return; }
    if (!await confirmAction({ title: `删除“${server.title}”？`, description: '删除后无法恢复，已上传的图片文件会保留。', confirmLabel: '删除图文', tone: 'danger' })) return;
    try { await contentApi.deleteNote(server.id); setBaseline(JSON.stringify(draft)); notify('图文已删除'); navigate(backTarget); } catch (err) { notify(errorMessage(err, '删除失败'), 'error'); }
  }

  const repositoryPath = repositoryBreadcrumbs(repositories, draft.repository_id).map((item) => item.name);
  const crumbs = ['图文', ...(repositoryPath.length ? repositoryPath : ['未归档'])];
  const indicator: SaveState = saveState.kind === 'saving' || saveState.kind === 'error' ? saveState : dirty ? { kind: 'dirty' } : saveState;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const characters = useMemo(() => draft.content.replace(/\s/g, '').length, [draft.content]);
  function chooseRepository(anchor: HTMLElement) {
    const items: MenuItem[] = [
      { label: '未归档', icon: draft.repository_id === null ? <Check aria-hidden="true" /> : <Inbox aria-hidden="true" />, onSelect: () => set('repository_id', null) },
      ...flattenRepositories(repositories).map((repository) => ({
        label: `${'\u3000'.repeat(repository.depth)}${repository.name}`,
        icon: repository.id === draft.repository_id ? <Check aria-hidden="true" /> : <Folder aria-hidden="true" />,
        onSelect: () => set('repository_id', repository.id),
      })),
    ];
    openMenu(anchor, items);
  }

  if (loadError) return <div className="editor-page"><div className="notice error">{loadError}<button type="button" className="button small" onClick={() => navigate('/admin/notes')}>返回图文库</button></div></div>;

  return (
    <div className="editor-page note-editor" onPaste={onPaste}>
      <EditorTopBar backLabel="图文库" onBack={() => runAfterDiscardCheck(() => navigate(backTarget))} crumbs={crumbs} status={<SaveIndicator state={indicator} autosave={false} />}>
        <Popover label="图文设置" icon={<SlidersHorizontal aria-hidden="true" />}>
          <p className="popover-title">图文设置</p>
          <Switch label="置顶" description="排在图文列表最前" checked={draft.is_pinned} onChange={(value) => set('is_pinned', value)} />
          <label className="pop-field">
            <span>通过链接添加图片</span>
            <span className="inline-form">
              <input className="input" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" onKeyDown={(event) => { if (event.key === 'Enter' && imageUrl.trim()) { event.preventDefault(); set('images', [...draft.images, imageUrl.trim()]); setImageUrl(''); } }} />
              <button type="button" className="button small" disabled={!imageUrl.trim()} onClick={() => { set('images', [...draft.images, imageUrl.trim()]); setImageUrl(''); }}><Link2 aria-hidden="true" />添加</button>
            </span>
          </label>
          {server ? <p className="pop-meta">{server.views} 次浏览 · {server.likes} 个赞 · 创建于 {formatDate(server.created_at)}</p> : null}
        </Popover>
        <button type="button" className="icon-button" aria-label="更多操作" onClick={(event) => openMenu(event.currentTarget, [
          { label: '查看页面', icon: <ArrowUpRight aria-hidden="true" />, disabled: !isPublished, onSelect: () => server && window.open(`/notes/${server.id}`, '_blank', 'noopener') },
          { label: '撤回为草稿', icon: <Undo2 aria-hidden="true" />, disabled: !isPublished, onSelect: () => void save('draft') },
          'separator',
          { label: server ? '删除图文' : '放弃', icon: <Trash2 aria-hidden="true" />, tone: 'danger', onSelect: () => void remove() },
        ])}><MoreHorizontal aria-hidden="true" /></button>
        {isPublished ? (
          <button type="button" className="button primary" onClick={() => void save()} disabled={!dirty || saveState.kind === 'saving' || uploading > 0}>更新</button>
        ) : (
          <>
            <button type="button" className="button ghost" onClick={() => void save('draft')} disabled={saveState.kind === 'saving' || uploading > 0}>保存</button>
            <button type="button" className="button primary" onClick={() => void save('published')} disabled={saveState.kind === 'saving' || uploading > 0}>发布</button>
          </>
        )}
      </EditorTopBar>

      <div className="editor-scroll">
        <article className="editor-doc" aria-busy={loading}>
          <AutoTextarea className="doc-title" value={draft.title} onChange={(value) => set('title', value)} placeholder="给这组照片起个名字" maxLength={120} ariaLabel="图文标题" onEnter={() => bodyRef.current?.focus()} autoFocus={editingId === null} />
          <div className="doc-props">
            <Property icon={<FolderOpen aria-hidden="true" />} label="仓库">
              <button type="button" className="doc-prop-button" onClick={(event) => chooseRepository(event.currentTarget)}>{repositoryPath.length ? repositoryPath.join(' / ') : <span className="muted">未归档</span>}</button>
            </Property>
            <Property icon={<Hash aria-hidden="true" />} label="话题">
              <TagInput id="note-topics" value={draft.topics} onChange={(topics) => set('topics', topics)} placeholder="例如：旅行、日常" suggestions={topicSuggestions} />
            </Property>
          </div>
          <section
            className={`image-board ${dropIndex !== null && dragIndex === null ? 'file-over' : ''}`}
            aria-label="图片"
            onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDropIndex(draft.images.length); } }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node) && dragIndex === null) setDropIndex(null); }}
            onDrop={(event: DragEvent) => { if (event.dataTransfer.files.length) { event.preventDefault(); setDropIndex(null); void upload(Array.from(event.dataTransfer.files)); } }}
          >
            {draft.images.map((image, index) => (
              <figure
                key={`${image}-${index}`}
                className={`image-tile ${dragIndex === index ? 'dragging' : ''} ${dropIndex === index && dragIndex !== null ? 'drop-before' : ''}`}
                draggable
                onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); setDragIndex(index); }}
                onDragOver={(event) => { if (dragIndex === null) return; event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setDropIndex(event.clientX > rect.left + rect.width / 2 ? index + 1 : index); }}
                onDrop={(event) => { if (dragIndex === null) return; event.preventDefault(); event.stopPropagation(); if (dropIndex !== null) reorder(dragIndex, dropIndex); setDragIndex(null); setDropIndex(null); }}
                onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
              >
                <img src={assetUrl(image) ?? image} alt={`图片 ${index + 1}`} loading="lazy" />
                {index === 0 ? <span className="image-cover">封面</span> : <span className="image-index">{index + 1}</span>}
                <button type="button" onClick={() => set('images', draft.images.filter((_, position) => position !== index))} aria-label={`移除第 ${index + 1} 张图片`}><X aria-hidden="true" /></button>
              </figure>
            ))}
            {Array.from({ length: uploading }, (_, index) => <div className="image-tile uploading" key={`uploading-${index}`}><span>上传中…</span></div>)}
            <label className="image-add">
              <ImagePlus aria-hidden="true" />
              <span>添加图片</span>
              <small>拖入、粘贴或点击</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void upload(files); }} />
            </label>
          </section>
          <p className="field-hint image-hint">第一张是封面，拖动可以调整顺序。</p>
          <GrowingTextarea ref={bodyRef} className="note-body-input" value={draft.content} onChange={(value) => set('content', value)} placeholder="写点什么…" />
        </article>
      </div>
      <div className="doc-count" aria-live="off">{characters} 字 · {draft.images.length} 张图片</div>
    </div>
  );
}

/** Body textarea that grows with its content, so the page scrolls instead of the field. */
const GrowingTextarea = forwardRef<HTMLTextAreaElement, { value: string; onChange: (value: string) => void; className: string; placeholder: string }>(function GrowingTextarea({ value, onChange, className, placeholder }, ref) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const element = inner.current;
    if (element) { element.style.height = 'auto'; element.style.height = `${Math.max(160, element.scrollHeight)}px`; }
  }, [value]);
  return (
    <textarea
      ref={(node) => { inner.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }}
      className={className}
      value={value}
      placeholder={placeholder}
      aria-label="正文"
      onChange={(event) => onChange(event.target.value)}
    />
  );
});
