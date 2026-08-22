import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Code2, Download, ExternalLink, FileText, Maximize2, MessageCircle, Music2, Send, X } from 'lucide-react';
import type { ResumeVersion } from '../../entities/resume/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { SiteContext } from '../../app/providers/site-provider';

const ResumePdfViewer = lazy(() => import('./ResumePdfViewer'));

function formatResumeDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function getPrimaryResumeId(versions: ResumeVersion[]) {
  const current = versions.find((version) => version.is_current);
  if (current) return current.id;
  let latest = versions[0];
  for (const version of versions) {
    if (!latest || version.version_date > latest.version_date) latest = version;
  }
  return latest?.id;
}

function ResumeStaticPreview({ version, eager = false }: { version: ResumeVersion; eager?: boolean }) {
  return (
    <img
      src={version.image_url}
      alt={`${version.title}简历`}
      width={794}
      height={1123}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
    />
  );
}

function ResumeReaderDialog({ version, onClose }: { version: ResumeVersion; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="resume-reader-dialog"
      aria-labelledby="resume-reader-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="resume-reader-shell">
        <header className="resume-reader-head">
          <div className="resume-reader-identity">
            <span>{version.label}</span>
            <div>
              <small>{version.is_current ? 'CURRENT / 当前版本' : 'ARCHIVE / 历史版本'} · {formatResumeDate(version.version_date)}</small>
              <h2 id="resume-reader-title">{version.title}</h2>
            </div>
          </div>
          <div className="resume-reader-actions">
            {version.pdf_url ? <a className="resume-download" href={contentApi.resumeDownloadUrl(version.id)} download><Download aria-hidden="true" />下载 PDF</a> : null}
            <button className="resume-reader-close" type="button" onClick={onClose} aria-label="关闭高清阅读"><X aria-hidden="true" /></button>
          </div>
        </header>
        <div className="resume-reader-content">
          <Suspense fallback={<div className="resume-reader-loading"><ResumeStaticPreview version={version} eager /><span>正在准备高清阅读器…</span></div>}>
            <ResumePdfViewer
              documentUrl={version.pdf_url ? contentApi.resumeDownloadUrl(version.id) : null}
              fallbackImageUrl={version.image_url}
              title={version.title}
              variant="reader"
              eager
            />
          </Suspense>
        </div>
      </div>
    </dialog>
  );
}

export default function AboutPage() {
  const { settings } = useContext(SiteContext);
  const cached = contentApi.getCachedResumeVersions();
  const [versions, setVersions] = useState<ResumeVersion[]>(cached ?? []);
  const [activeId, setActiveId] = useState<number | undefined>(() => getPrimaryResumeId(cached ?? []));
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const [readerVersion, setReaderVersion] = useState<ResumeVersion | null>(null);
  const featuredRef = useRef<HTMLElement>(null);
  const platforms = [
    { name: '微信公众号', handle: settings?.wechat_handle || '小潘的数字花园', href: settings?.wechat_url || 'https://weixin.qq.com/', icon: MessageCircle, tone: 'wechat' },
    { name: '抖音', handle: settings?.douyin_handle || '@小潘', href: settings?.douyin_url || 'https://www.douyin.com/', icon: Music2, tone: 'douyin' },
    { name: '小红书', handle: settings?.xiaohongshu_handle || '@小潘', href: settings?.xiaohongshu_url || 'https://www.xiaohongshu.com/', icon: Send, tone: 'xiaohongshu' },
    { name: 'GitHub', handle: settings?.github_handle || '@xiaopan', href: settings?.github_url || 'https://github.com/', icon: Code2, tone: 'github' },
  ];

  useEffect(() => {
    contentApi.listResumeVersions()
      .then((items) => {
        setVersions(items);
        setActiveId((currentId) => items.some((version) => version.id === currentId) ? currentId : getPrimaryResumeId(items));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '简历版本加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const activeIndex = Math.max(0, versions.findIndex((version) => version.id === activeId));
  const activeVersion = versions[activeIndex];

  function selectVersion(id: number, reveal = false) {
    setActiveId(id);
    if (reveal) window.requestAnimationFrame(() => featuredRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function goToVersion(index: number) {
    const next = Math.max(0, Math.min(versions.length - 1, index));
    const version = versions[next];
    if (version) selectVersion(version.id, true);
  }

  return (
    <main className="about-page resume-about-page">
      <section className="resume-archive" aria-labelledby="resume-heading">
        <header className="resume-archive-head">
          <div>
            <p>RESUME ARCHIVE / 个人简历</p>
            <h1 id="resume-heading">简历与版本记录</h1>
            <span>当前版本居中展示，从左侧版本栏选择过往简历。</span>
          </div>
          {versions.length > 1 ? (
            <div className="resume-controls" aria-label="切换简历版本">
              <span>{String(activeIndex + 1).padStart(2, '0')} / {String(versions.length).padStart(2, '0')}</span>
              <button type="button" onClick={() => goToVersion(activeIndex - 1)} disabled={activeIndex === 0} aria-label="上一份简历"><ArrowLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => goToVersion(activeIndex + 1)} disabled={activeIndex === versions.length - 1} aria-label="下一份简历"><ArrowRight aria-hidden="true" /></button>
            </div>
          ) : null}
        </header>

        {loading ? <div className="resume-empty"><FileText aria-hidden="true" /><span>正在读取简历档案…</span></div> : null}
        {error ? <div className="form-error">{error}</div> : null}
        {!loading && !error && !versions.length ? <div className="resume-empty"><FileText aria-hidden="true" /><strong>简历档案正在整理</strong><span>最新版本发布后会显示在这里。</span></div> : null}

        {activeVersion ? (
          <div className={`resume-showcase ${versions.length === 1 ? 'single' : ''}`}>
            {versions.length > 1 ? (
              <aside className="resume-version-rail" aria-labelledby="resume-version-rail-title">
                <div className="resume-version-rail-head">
                  <strong id="resume-version-rail-title">其他版本</strong>
                  <span>{versions.length - 1}</span>
                </div>
                <nav className="resume-version-tabs" aria-label="选择其他简历版本">
                  {versions.map((version, index) => version.id === activeVersion.id ? null : (
                    <button
                      className="resume-version-tab"
                      type="button"
                      key={version.id}
                      onClick={() => selectVersion(version.id, true)}
                      aria-label={`在中央展示${version.title}`}
                    >
                      <span className="resume-version-thumb">
                        <img src={version.image_url} alt="" width={64} height={90} loading={index < 3 ? 'eager' : 'lazy'} />
                        <span>{version.is_current ? '最新' : String(index + 1).padStart(2, '0')}</span>
                      </span>
                      <span className="resume-version-tab-copy">
                        <small>{version.label}</small>
                        <strong>{version.title}</strong>
                        <time dateTime={version.version_date}>{formatResumeDate(version.version_date)}</time>
                      </span>
                    </button>
                  ))}
                </nav>
              </aside>
            ) : null}

            <article ref={featuredRef} id="resume-featured-version" className="resume-featured" key={activeVersion.id} role="tabpanel" aria-label={`${activeVersion.title}，当前展示简历`}>
              <div className="resume-document">
                <button className="resume-image-link resume-document-open" type="button" onClick={() => setReaderVersion(activeVersion)} aria-label={`高清阅读${activeVersion.title}`}>
                  {activeVersion.pdf_url ? (
                    <Suspense fallback={<ResumeStaticPreview version={activeVersion} eager />}>
                      <ResumePdfViewer
                        documentUrl={contentApi.resumeDownloadUrl(activeVersion.id)}
                        fallbackImageUrl={activeVersion.image_url}
                        title={activeVersion.title}
                        variant="preview"
                        eager
                      />
                    </Suspense>
                  ) : <ResumeStaticPreview version={activeVersion} eager />}
                  <span className="resume-open-hint"><Maximize2 aria-hidden="true" />高清阅读</span>
                </button>
                <span className="resume-label">{activeVersion.label}</span>
              </div>
              <footer className="resume-version-meta">
                <div>
                  <small>{activeVersion.is_current ? 'CURRENT / 当前版本' : 'ARCHIVE / 历史版本'} · {formatResumeDate(activeVersion.version_date)}</small>
                  <h2>{activeVersion.title}</h2>
                  {activeVersion.description ? <p>{activeVersion.description}</p> : null}
                </div>
                <div className="resume-version-actions">
                  <button className="resume-open-reader" type="button" onClick={() => setReaderVersion(activeVersion)}><Maximize2 aria-hidden="true" />高清阅读</button>
                  {activeVersion.pdf_url ? <a className="resume-download" href={contentApi.resumeDownloadUrl(activeVersion.id)} download><Download aria-hidden="true" />下载 PDF</a> : null}
                </div>
              </footer>
            </article>
          </div>
        ) : null}
      </section>

      <section className="about-platforms" aria-labelledby="platform-heading">
        <header><p>ELSEWHERE / 其他平台</p><h2 id="platform-heading">在其他地方找到我</h2></header>
        <div className="platform-grid">
          {platforms.map(({ name, handle, href, icon: Icon, tone }) => (
            <article key={name} className={`platform-card ${tone}`}>
              <Icon aria-hidden="true" />
              <div><small>{name}</small><h3>{handle}</h3></div>
              <a href={href} target="_blank" rel="noreferrer" aria-label={`打开${name}`}><ExternalLink aria-hidden="true" /></a>
            </article>
          ))}
        </div>
      </section>
      {readerVersion ? <ResumeReaderDialog version={readerVersion} onClose={() => setReaderVersion(null)} /> : null}
    </main>
  );
}
