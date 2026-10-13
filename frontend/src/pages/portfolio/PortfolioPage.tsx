import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, UserRound } from 'lucide-react';
import type { Portfolio, Project } from '../../entities/project/model/projects';
import { portfolioApi } from '../../features/content/api/portfolio-api';
import { ProjectIcon } from '../../features/content/ui/ProjectIcon';
import { ProjectGallery } from './ProjectGallery';
import './portfolio.css';

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="work-card" id={`project-${project.slug}`} aria-labelledby={`project-${project.id}-title`} tabIndex={-1}>
      <header className="work-card-head">
        <ProjectIcon project={project}/>
        <div className="work-identity"><h2 id={`project-${project.id}-title`}>{project.name}</h2><p>{project.summary}</p><span>{project.category}</span></div>
        {project.url ? <a className="work-visit" href={project.url} target="_blank" rel="noreferrer">{project.link_label} <ArrowUpRight size={15}/></a> : null}
      </header>
      {project.screenshots.length ? <ProjectGallery shots={project.screenshots} name={project.name}/> : null}
      <footer className="work-card-foot">
        <ul className="work-keywords" aria-label="作品主题">{project.keywords.map((word) => <li key={word}>{word}</li>)}</ul>
        {project.description ? <button type="button" className="work-more" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={`${project.id}-story`}>{expanded ? '收起介绍' : '了解作品'}<ChevronDown size={15}/></button> : null}
      </footer>
      <div className={`work-story ${expanded ? 'is-open' : ''}`} id={`${project.id}-story`} aria-hidden={!expanded}><div><p>{project.description}</p></div></div>
    </article>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const hashHandled = useRef(false);
  const projects = data?.projects ?? [];

  useEffect(() => {
    let alive = true, sequence = 0;
    async function refresh() {
      if (document.visibilityState === 'hidden') return;
      const request = ++sequence;
      try {
        const result = await portfolioApi.get();
        if (alive && request === sequence) { setData(result); setError(''); }
      } catch (err) {
        if (alive && request === sequence) setError(err instanceof Error ? err.message : '作品集加载失败');
      }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [retry]);

  function selectWork(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    setActive(id === 'work-intro' ? '' : id);
  }

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `作品集 · ${data?.profile.title || '小潘同学'}`;
    const cards = Array.from(pageRef.current?.querySelectorAll<HTMLElement>('.work-card') ?? []);
    let frame = 0;
    const updateActive = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const readingLine = window.innerWidth <= 680 ? 100 : 140;
        let current = '';
        for (const card of cards) {
          if (card.getBoundingClientRect().top <= readingLine) current = card.id;
        }
        if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
          current = cards.at(-1)?.id ?? '';
        }
        setActive(current);
      });
    };
    updateActive();
    if (data && !hashHandled.current) {
      hashHandled.current = true;
      try {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } catch { /* Invalid URL fragments must not prevent the page from rendering. */ }
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
      document.title = previousTitle;
    };
  }, [data]);

  if (!data) return <div className="page-loading" role="status">{error ? <><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></> : '正在读取作品集…'}</div>;

  return (
    <div className="portfolio-page" ref={pageRef}>
      <nav className="work-dock" aria-label="作品快捷导航">
        <a href="#work-intro" className={`work-dock-intro ${active === '' ? 'is-active' : ''}`} aria-label={`${data.profile.title} · 个人介绍`} aria-current={active === '' ? 'location' : undefined} title="个人介绍" onClick={(event) => selectWork(event, 'work-intro')}><UserRound size={18} aria-hidden="true"/><span className="work-nav-name">{data.profile.title}</span></a>
        <span className="work-dock-label">作品</span>
        {projects.map((project) => <a key={project.id} href={`#project-${project.slug}`} title={project.name} aria-label={project.name} className={active === `project-${project.slug}` ? 'is-active' : ''} aria-current={active === `project-${project.slug}` ? 'location' : undefined} onClick={(event) => selectWork(event, `project-${project.slug}`)}><ProjectIcon project={project}/><span className="work-nav-name">{project.name === 'Shopify 独立站插件' ? 'Shopify 插件' : project.name}</span></a>)}
      </nav>
      <div className="portfolio-content">
      <section className="work-hero" id="work-intro" aria-labelledby="work-heading" tabIndex={-1}>
        <h1 id="work-heading">{data.profile.title}</h1>
        <div className="work-introduction">{data.profile.introduction.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </section>
      <section className="work-collection" id="work-collection" aria-label="个人作品列表">
        <div className="work-collection-label"><h2>作品</h2><span>{projects.length} 个项目</span></div>
        {error ? <p role="alert">暂时无法更新作品集：{error}</p> : null}
        {!projects.length ? <p className="work-empty">作品正在整理中。</p> : null}
        {projects.map((project) => <ProjectCard key={project.id} project={project}/>)}
      </section>
      </div>
    </div>
  );
}
