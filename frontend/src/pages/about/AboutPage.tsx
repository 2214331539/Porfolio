import { useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Code2, Download, ExternalLink, FileText, MessageCircle, Music2, Send } from 'lucide-react';
import type { ResumeVersion } from '../../entities/resume/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { SiteContext } from '../../app/providers/site-provider';

export default function AboutPage() {
  const { settings } = useContext(SiteContext);
  const cached = contentApi.getCachedResumeVersions();
  const [versions, setVersions] = useState<ResumeVersion[]>(cached ?? []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef(0);
  const platforms = [
    { name: '微信公众号', handle: settings?.wechat_handle || '小潘的数字花园', href: settings?.wechat_url || 'https://weixin.qq.com/', icon: MessageCircle, tone: 'wechat' },
    { name: '抖音', handle: settings?.douyin_handle || '@小潘', href: settings?.douyin_url || 'https://www.douyin.com/', icon: Music2, tone: 'douyin' },
    { name: '小红书', handle: settings?.xiaohongshu_handle || '@小潘', href: settings?.xiaohongshu_url || 'https://www.xiaohongshu.com/', icon: Send, tone: 'xiaohongshu' },
    { name: 'GitHub', handle: settings?.github_handle || '@xiaopan', href: settings?.github_url || 'https://github.com/', icon: Code2, tone: 'github' },
  ];

  useEffect(() => {
    contentApi.listResumeVersions()
      .then(setVersions)
      .catch((err) => setError(err instanceof Error ? err.message : '简历版本加载失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => cancelAnimationFrame(scrollFrameRef.current), []);

  function goToVersion(index: number) {
    const next = Math.max(0, Math.min(versions.length - 1, index));
    const track = trackRef.current;
    const card = track?.children[next] as HTMLElement | undefined;
    if (!track || !card) return;
    const paddingLeft = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
    track.scrollTo({ left: card.offsetLeft - paddingLeft, behavior: 'smooth' });
    setActiveIndex(next);
  }

  function updateActiveVersion() {
    cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const cards = Array.from(track.children) as HTMLElement[];
      const paddingLeft = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const nextDistance = Math.abs(card.offsetLeft - paddingLeft - track.scrollLeft);
        if (nextDistance < distance) {
          distance = nextDistance;
          closest = index;
        }
      });
      setActiveIndex(closest);
    });
  }

  return (
    <main className="about-page resume-about-page">
      <section className="resume-archive" aria-labelledby="resume-heading">
        <header className="resume-archive-head">
          <div>
            <p>RESUME ARCHIVE / 个人简历</p>
            <h1 id="resume-heading">简历与版本记录</h1>
            <span>当前版本优先展示，向左滑动查看过往简历。</span>
          </div>
          {versions.length > 1 ? (
            <div className="resume-controls" aria-label="切换简历版本">
              <span>{String(activeIndex + 1).padStart(2, '0')} / {String(versions.length).padStart(2, '0')}</span>
              <button type="button" onClick={() => goToVersion(activeIndex - 1)} disabled={activeIndex === 0} aria-label="上一份简历"><ArrowLeft /></button>
              <button type="button" onClick={() => goToVersion(activeIndex + 1)} disabled={activeIndex === versions.length - 1} aria-label="下一份简历"><ArrowRight /></button>
            </div>
          ) : null}
        </header>

        {loading ? <div className="resume-empty"><FileText /><span>正在读取简历档案…</span></div> : null}
        {error ? <div className="form-error">{error}</div> : null}
        {!loading && !error && !versions.length ? <div className="resume-empty"><FileText /><strong>简历档案正在整理</strong><span>最新版本发布后会显示在这里。</span></div> : null}

        {versions.length ? (
          <div ref={trackRef} className="resume-track" onScroll={updateActiveVersion}>
            {versions.map((version, index) => (
              <article className="resume-version" key={version.id} aria-label={`${version.title}，${index + 1}/${versions.length}`}>
                <div className="resume-document">
                  <a className="resume-image-link" href={version.image_url} target="_blank" rel="noreferrer" aria-label={`查看${version.title}原图`}>
                    <img src={version.image_url} alt={`${version.title}简历`} loading={index === 0 ? 'eager' : 'lazy'} />
                  </a>
                  <span className="resume-label">{version.label}</span>
                </div>
                <footer className="resume-version-meta">
                  <div>
                    <small>{version.is_current ? 'CURRENT / 当前版本' : 'ARCHIVE / 历史版本'} · {new Date(`${version.version_date}T00:00:00`).toLocaleDateString('zh-CN')}</small>
                    <h2>{version.title}</h2>
                    {version.description ? <p>{version.description}</p> : null}
                  </div>
                  {version.pdf_url ? <a className="resume-download" href={contentApi.resumeDownloadUrl(version.id)} download><Download />下载 PDF</a> : null}
                </footer>
              </article>
            ))}
          </div>
        ) : null}

        {versions.length > 1 ? (
          <div className="resume-pagination" aria-label="简历版本分页">
            {versions.map((version, index) => <button type="button" key={version.id} className={index === activeIndex ? 'active' : ''} onClick={() => goToVersion(index)} aria-label={`查看第${index + 1}份简历`} />)}
          </div>
        ) : null}
      </section>

      <section className="about-platforms" aria-labelledby="platform-heading">
        <header><p>ELSEWHERE / 其他平台</p><h2 id="platform-heading">在其他地方找到我</h2></header>
        <div className="platform-grid">
          {platforms.map(({ name, handle, href, icon: Icon, tone }) => (
            <article key={name} className={`platform-card ${tone}`}>
              <Icon />
              <div><small>{name}</small><h3>{handle}</h3></div>
              <a href={href} target="_blank" rel="noreferrer" aria-label={`打开${name}`}><ExternalLink /></a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
