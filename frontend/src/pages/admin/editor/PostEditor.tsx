import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, ArrowUpRight, Check, Code2, Copy, Folder, FolderOpen, Hash, ImagePlus, Inbox, MoreHorizontal, RotateCcw, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Post, PostInput, PostStatus } from '../../../entities/post/model/types';
import { flattenRepositories, repositoryBreadcrumbs } from '../../../entities/repository/model/tree';
import type { ContentRepository } from '../../../entities/repository/model/types';
import { assetUrl, contentApi, storedAssetUrl } from '../../../features/content/api/content-api';
import { clockTime, countWords, errorMessage, formatDate, readingMinutes, toLocalInput } from '../../../shared/format';
import { useAdminDirtyState, useAdminUi, type MenuItem } from '../AdminUi';
import { AutoTextarea, EditorTopBar, Popover, Property, SaveIndicator, Switch, TagInput, type SaveState } from './EditorChrome';
import { LiveEditor, type LiveEditorHandle } from './live/LiveEditor';

type Draft = {
  title: string;
  content: string;
  excerpt: string;
  cover_url: string;
  tags: string[];
  repository_id: number | null;
  is_pinned: boolean;
  is_private: boolean;
  slug: string;
  published_at: string;
};
type Backup = { draft: Draft; savedAt: number };

const emptyDraft = (repositoryId: number | null): Draft => ({ title: '', content: '', excerpt: '', cover_url: '', tags: [], repository_id: repositoryId, is_pinned: false, is_private: false, slug: '', published_at: '' });
// A draft's publish time is decided when it is published, so the field stays empty until then.
const shownPublishedAt = (post: Post) => post.status === 'published' ? toLocalInput(post.published_at) : '';
const draftFrom = (post: Post): Draft => ({
  title: post.title, content: post.content, excerpt: post.excerpt, cover_url: post.cover_url ? storedAssetUrl(post.cover_url) : '', tags: post.tags.map((tag) => tag.name),
  repository_id: post.repository?.id ?? post.repository_id ?? null, is_pinned: post.is_pinned, is_private: post.is_private, slug: post.slug, published_at: shownPublishedAt(post),
});
const snapshot = (draft: Draft) => JSON.stringify(draft);
const resolveAsset = (url: string) => assetUrl(url) ?? url;

export function PostEditor() {
  const { id = 'new' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify, confirmAction, openMenu, runAfterDiscardCheck } = useAdminUi();
  const editingId = id === 'new' ? null : Number(id);
  const initialDraft = useMemo(() => emptyDraft(Number(searchParams.get('repo')) || null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [server, setServer] = useState<Post | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [baseline, setBaseline] = useState(() => snapshot(initialDraft));
  const [loading, setLoading] = useState(editingId !== null);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [repositories, setRepositories] = useState<ContentRepository[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [sourceMode, setSourceMode] = useState(() => localStorage.getItem('studio:editor:source') === '1');
  const editorRef = useRef<LiveEditorHandle>(null);
  const savingRef = useRef(false);
  const failedSnapshot = useRef<string | null>(null);
  const createdId = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const serverRef = useRef(server);
  const slugTouchedRef = useRef(slugTouched);
  draftRef.current = draft;
  serverRef.current = server;
  slugTouchedRef.current = slugTouched;

  const currentSnapshot = snapshot(draft);
  const dirty = currentSnapshot !== baseline;
  const isPublished = server?.status === 'published';
  const autosave = !isPublished;
  const backupKey = `studio:post:${editingId ?? 'new'}`;
  useAdminDirtyState(dirty);

  useEffect(() => { localStorage.setItem('studio:editor:source', sourceMode ? '1' : '0'); }, [sourceMode]);

  useEffect(() => {
    contentApi.listRepositories('post', true).then(setRepositories).catch(() => undefined);
    contentApi.listPosts(true).then((posts) => setTagSuggestions([...new Set(posts.flatMap((post) => post.tags.map((tag) => tag.name)))])).catch(() => undefined);
  }, []);

  const readBackup = useCallback((key: string, loaded: Draft, serverUpdatedAt?: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as Backup | null;
      if (stored && snapshot(stored.draft) !== snapshot(loaded) && (!serverUpdatedAt || stored.savedAt > Date.parse(serverUpdatedAt))) setBackup(stored);
      else localStorage.removeItem(key);
    } catch { localStorage.removeItem(key); }
  }, []);

  useEffect(() => {
    if (editingId === null) { readBackup('studio:post:new', initialDraft); return; }
    if (editingId === createdId.current) return;
    setLoading(true);
    contentApi.getAdminPost(editingId)
      .then((post) => {
        const loaded = draftFrom(post);
        setServer(post);
        setDraft(loaded);
        setBaseline(snapshot(loaded));
        readBackup(`studio:post:${post.id}`, loaded, post.updated_at);
      })
      .catch((err) => setLoadError(errorMessage(err, '文章加载失败')))
      .finally(() => setLoading(false));
  }, [editingId, initialDraft, readBackup]);

  // Crash protection: keep the latest unsaved draft in this browser.
  useEffect(() => {
    if (!dirty || loading) return undefined;
    const timer = window.setTimeout(() => localStorage.setItem(backupKey, JSON.stringify({ draft, savedAt: Date.now() })), 600);
    return () => window.clearTimeout(timer);
  }, [backupKey, dirty, draft, loading]);

  const save = useCallback(async (nextStatus?: PostStatus, options: { auto?: boolean } = {}) => {
    if (savingRef.current) return false;
    const current = draftRef.current;
    const previous = serverRef.current;
    const status = nextStatus ?? previous?.status ?? 'draft';
    if (status === 'published' && !current.title.trim()) { notify('发布前请先写个标题', 'error'); return false; }
    if (!current.title.trim() && !current.content.trim()) return false;
    savingRef.current = true;
    setSaveState({ kind: 'saving' });
    const payload: PostInput = {
      id: previous?.id, title: current.title.trim() || '无标题', content: current.content, excerpt: current.excerpt.trim(),
      cover_url: current.cover_url || null, tag_names: current.tags, repository_id: current.repository_id,
      is_pinned: current.is_pinned, is_private: current.is_private, status,
    };
    // Until a post is first published its link follows the title; afterwards it only changes by hand.
    if (previous && current.slug !== previous.slug) payload.slug = current.slug;
    else if (previous && previous.status === 'draft' && !slugTouchedRef.current && current.title.trim() !== previous.title) payload.slug = '';
    else if (!previous && current.slug.trim()) payload.slug = current.slug;
    if (current.published_at && current.published_at !== (previous ? shownPublishedAt(previous) : '')) payload.published_at = new Date(current.published_at).toISOString();
    try {
      const saved = await contentApi.savePost(payload);
      const savedDraft = { ...current, slug: saved.slug, published_at: saved.status === 'published' ? toLocalInput(saved.published_at) : current.published_at };
      setServer(saved);
      setBaseline(snapshot(savedDraft));
      setDraft((latest) => ({
        ...latest,
        slug: latest.slug === current.slug ? saved.slug : latest.slug,
        published_at: latest.published_at === current.published_at ? savedDraft.published_at : latest.published_at,
      }));
      setSaveState({ kind: 'saved', at: new Date() });
      failedSnapshot.current = null;
      localStorage.removeItem('studio:post:new');
      localStorage.removeItem(`studio:post:${saved.id}`);
      if (!previous) {
        createdId.current = saved.id;
        navigate(`/admin/posts/${saved.id}`, { replace: true, state: location.state });
      }
      if (!options.auto) notify(status === 'published' ? previous?.status === 'published' ? '更新已发布' : '文章已发布' : nextStatus === 'draft' && previous?.status === 'published' ? '已撤回为草稿' : '草稿已保存');
      return true;
    } catch (err) {
      failedSnapshot.current = snapshot(current);
      setSaveState({ kind: 'error', message: errorMessage(err) });
      if (!options.auto) notify(errorMessage(err, '保存失败'), 'error');
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [location.state, navigate, notify]);

  // Drafts save themselves shortly after typing stops; published posts wait for an explicit update.
  useEffect(() => {
    if (!dirty || loading || !autosave || saveState.kind === 'saving' || failedSnapshot.current === currentSnapshot) return undefined;
    const timer = window.setTimeout(() => void save(undefined, { auto: true }), 2000);
    return () => window.clearTimeout(timer);
  }, [autosave, currentSnapshot, dirty, loading, save, saveState.kind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const backTarget = (location.state as { from?: string } | null)?.from ?? `/admin/posts${draft.repository_id ? `?repo=${draft.repository_id}` : ''}`;
  async function leave() {
    if (dirty && autosave && (draft.title.trim() || draft.content.trim()) && await save(undefined, { auto: true })) { navigate(backTarget); return; }
    runAfterDiscardCheck(() => navigate(backTarget));
  }

  async function unpublish() {
    if (await confirmAction({ title: '撤回为草稿？', description: '文章会立即从前台消失，内容会保留在后台。', confirmLabel: '撤回' })) await save('draft');
  }

  async function remove() {
    if (!server) { setBaseline(currentSnapshot); localStorage.removeItem(backupKey); navigate(backTarget); return; }
    if (!await confirmAction({ title: `删除“${server.title}”？`, description: '删除后无法恢复，公开链接会立即失效。', confirmLabel: '删除文章', tone: 'danger' })) return;
    try {
      await contentApi.deletePost(server.id);
      localStorage.removeItem(backupKey);
      setBaseline(currentSnapshot);
      notify('文章已删除');
      navigate(backTarget);
    } catch (err) {
      notify(errorMessage(err, '删除失败'), 'error');
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const uploaded = await contentApi.uploadImage(file);
      setDraft((value) => ({ ...value, cover_url: uploaded.path }));
    } catch (err) {
      notify(errorMessage(err, '封面上传失败'), 'error');
    } finally {
      setUploadingCover(false);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const words = useMemo(() => countWords(draft.content), [draft.content]);
  const repositoryPath = repositoryBreadcrumbs(repositories, draft.repository_id).map((item) => item.name);
  const crumbs = ['文章', ...(repositoryPath.length ? repositoryPath : ['未归档'])];
  const indicatorState: SaveState = saveState.kind === 'saving' || saveState.kind === 'error' ? saveState : dirty ? { kind: 'dirty' } : saveState;
  const publicUrl = server && isPublished && !server.is_private ? `/blog/${server.slug}` : null;
  const autoSlug = !server || (server.status === 'draft' && !slugTouched);

  function chooseRepository(anchor: HTMLElement) {
    const items: MenuItem[] = [
      { label: '未归档', icon: draft.repository_id === null ? <Check aria-hidden="true" /> : <Inbox aria-hidden="true" />, onSelect: () => set('repository_id', null) },
      ...flattenRepositories(repositories).map((repository) => ({
        label: `${'　'.repeat(repository.depth)}${repository.name}`,
        icon: repository.id === draft.repository_id ? <Check aria-hidden="true" /> : <Folder aria-hidden="true" />,
        onSelect: () => set('repository_id', repository.id),
      })),
    ];
    openMenu(anchor, items);
  }

  if (loadError) return <div className="editor-page"><div className="notice error">{loadError}<button type="button" className="button small" onClick={() => navigate('/admin/posts')}>返回文章库</button></div></div>;

  return (
    <div className="editor-page">
      <EditorTopBar backLabel="文章库" onBack={() => void leave()} crumbs={crumbs} status={<SaveIndicator state={indicatorState} autosave={autosave} />}>
        <button type="button" className={`icon-button ${sourceMode ? 'active' : ''}`} onClick={() => setSourceMode((value) => !value)} aria-pressed={sourceMode} aria-label="源码模式" title="源码模式 Ctrl+/"><Code2 aria-hidden="true" /></button>
        <Popover label="发布设置" icon={<SlidersHorizontal aria-hidden="true" />}>
          <p className="popover-title">发布设置</p>
          <label className="pop-field">
            <span>链接</span>
            <span className="slug-field"><span>/blog/</span><input value={draft.slug} placeholder={autoSlug ? '跟随标题' : ''} onChange={(event) => { setSlugTouched(true); set('slug', event.target.value); }} aria-label="文章链接" /></span>
            <small>{autoSlug ? '首次发布前跟随标题生成，发布后保持不变。' : '修改链接会让旧地址失效。'}</small>
          </label>
          <label className="pop-field">
            <span>发布时间</span>
            <input type="datetime-local" className="input" value={draft.published_at} onChange={(event) => set('published_at', event.target.value)} aria-label="发布时间" />
            {!isPublished ? <small>留空则记为发布的那一刻。</small> : null}
          </label>
          <Switch label="置顶" description="排在文章列表最前" checked={draft.is_pinned} onChange={(value) => set('is_pinned', value)} />
          <Switch label="私密" description="发布后也只有你能看到" checked={draft.is_private} onChange={(value) => set('is_private', value)} />
          {server ? <p className="pop-meta">创建于 {formatDate(server.created_at)} · {server.views} 次阅读</p> : null}
        </Popover>
        <button type="button" className="icon-button" aria-label="更多操作" onClick={(event) => openMenu(event.currentTarget, [
          { label: '查看页面', icon: <ArrowUpRight aria-hidden="true" />, disabled: !publicUrl, onSelect: () => publicUrl && window.open(publicUrl, '_blank', 'noopener') },
          { label: '复制链接', icon: <Copy aria-hidden="true" />, disabled: !publicUrl, onSelect: () => { if (publicUrl) void navigator.clipboard?.writeText(new URL(publicUrl, window.location.origin).href).then(() => notify('链接已复制')); } },
          { label: '撤回为草稿', icon: <Undo2 aria-hidden="true" />, disabled: !isPublished, onSelect: () => void unpublish() },
          'separator',
          { label: server ? '删除文章' : '放弃这篇', icon: <Trash2 aria-hidden="true" />, tone: 'danger', onSelect: () => void remove() },
        ])}><MoreHorizontal aria-hidden="true" /></button>
        {isPublished ? (
          <button type="button" className="button primary" onClick={() => void save()} disabled={!dirty || saveState.kind === 'saving'} title="Ctrl+S">更新</button>
        ) : (
          <>
            <button type="button" className="button ghost" onClick={() => void save('draft')} disabled={saveState.kind === 'saving'} title="Ctrl+S">保存</button>
            <button type="button" className="button primary" onClick={() => void save('published')} disabled={saveState.kind === 'saving'}>发布</button>
          </>
        )}
      </EditorTopBar>

      {backup ? (
        <div className="notice info editor-notice">
          <RotateCcw aria-hidden="true" />
          <span>这台设备上有一份 {clockTime(new Date(backup.savedAt))} 未保存的内容。</span>
          <button type="button" className="button small" onClick={() => { setDraft(backup.draft); setBackup(null); }}>恢复</button>
          <button type="button" className="button small ghost" onClick={() => { localStorage.removeItem(backupKey); setBackup(null); }}>丢弃</button>
        </div>
      ) : null}

      <div className="editor-scroll">
        <article className="editor-doc" aria-busy={loading}>
          {draft.cover_url ? (
            <figure className="doc-cover">
              <img src={resolveAsset(draft.cover_url)} alt="封面" />
              <div className="doc-cover-actions">
                <label className="button small">{uploadingCover ? '上传中…' : '更换'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadCover(file); }} /></label>
                <button type="button" className="button small" onClick={() => set('cover_url', '')}>移除</button>
              </div>
            </figure>
          ) : (
            <div className="doc-head-tools">
              <label className="ghost-action"><ImagePlus aria-hidden="true" />{uploadingCover ? '上传中…' : '添加封面'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadCover(file); }} /></label>
            </div>
          )}
          <AutoTextarea className="doc-title" value={draft.title} onChange={(value) => set('title', value)} placeholder="无标题" ariaLabel="文章标题" onEnter={() => editorRef.current?.focus()} autoFocus={editingId === null} />
          <div className="doc-props">
            <Property icon={<FolderOpen aria-hidden="true" />} label="仓库">
              <button type="button" className="doc-prop-button" onClick={(event) => chooseRepository(event.currentTarget)}>{repositoryPath.length ? repositoryPath.join(' / ') : <span className="muted">未归档</span>}</button>
            </Property>
            <Property icon={<Hash aria-hidden="true" />} label="标签">
              <TagInput id="post-tags" value={draft.tags} onChange={(tags) => set('tags', tags)} placeholder="添加标签" suggestions={tagSuggestions} />
            </Property>
            <Property icon={<AlignLeft aria-hidden="true" />} label="摘要">
              <AutoTextarea className="doc-prop-input" value={draft.excerpt} onChange={(value) => set('excerpt', value)} placeholder="一句话介绍，留空时自动截取正文开头" maxLength={300} ariaLabel="摘要" />
            </Property>
          </div>
          <LiveEditor
            ref={editorRef}
            value={draft.content}
            onChange={(value) => set('content', value)}
            onUpload={(file) => contentApi.uploadImage(file).then((result) => result.path)}
            onUploadError={(message) => notify(message, 'error')}
            resolveAsset={resolveAsset}
            sourceMode={sourceMode}
            onToggleSource={() => setSourceMode((value) => !value)}
            placeholder="开始写作…  输入 / 插入标题、列表、代码块、表格或图片"
          />
        </article>
      </div>
      <div className="doc-count" aria-live="off">{words.toLocaleString()} 字 · 约 {readingMinutes(draft.content)} 分钟{sourceMode ? ' · 源码模式' : ''}</div>
    </div>
  );
}
