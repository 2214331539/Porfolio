import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Blocks, ChevronDown, CookingPot, MapPin, Nfc, UserRound } from 'lucide-react';
import { projects, type Project } from '../../entities/project/model/projects';
import './portfolio.css';

const icons = { couploc: MapPin, soundtag: Nfc, cooking: CookingPot, impromptu: AudioLines, shopify: Blocks };

function ProjectIcon({ id }: { id: string }) {
  const Icon = icons[id as keyof typeof icons] ?? Blocks;
  return <span className={`work-icon work-tone-${id}`}><Icon aria-hidden="true" strokeWidth={1.5} /></span>;
}

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="work-card" id={project.id} aria-labelledby={`${project.id}-title`} tabIndex={-1}>
      <header className="work-card-head">
        <ProjectIcon id={project.id}/>
        <div className="work-identity"><h2 id={`${project.id}-title`}>{project.name}</h2><p>{project.summary}</p><span>{project.category}</span></div>
        {project.url ? <a className="work-visit" href={project.url} target="_blank" rel="noreferrer">访问作品 <ArrowUpRight size={15}/></a> : null}
      </header>
      {project.screenshots?.length ? <div className="work-screenshots" tabIndex={0} role="region" aria-label={`${project.name} 截图，可横向滚动`}>{project.screenshots.map((shot) => <img key={shot.src} src={shot.src} alt={shot.alt} loading="lazy" decoding="async"/>)}</div> : null}
      <footer className="work-card-foot">
        <ul className="work-keywords" aria-label="作品主题">{project.keywords.map((word) => <li key={word}>{word}</li>)}</ul>
        <button type="button" className="work-more" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={`${project.id}-story`}>{expanded ? '收起介绍' : '了解作品'}<ChevronDown size={15}/></button>
      </footer>
      <div className={`work-story ${expanded ? 'is-open' : ''}`} id={`${project.id}-story`} aria-hidden={!expanded}><div><p>{project.description}</p></div></div>
    </article>
  );
}

export default function PortfolioPage() {
  const [active, setActive] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);

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
    document.title = '作品集 · 小潘同学';
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
        setActive(current);
      });
    };
    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="portfolio-page" ref={pageRef}>
      <nav className="work-dock" aria-label="作品快捷导航">
        <a href="#work-intro" className={`work-dock-intro ${active === '' ? 'is-active' : ''}`} aria-label="小潘同学 · 个人介绍" aria-current={active === '' ? 'location' : undefined} title="个人介绍" onClick={(event) => selectWork(event, 'work-intro')}><UserRound size={18} aria-hidden="true"/><span className="work-nav-name">小潘同学</span></a>
        <span className="work-dock-label">作品</span>
        {projects.map((project) => <a key={project.id} href={`#${project.id}`} title={project.name} aria-label={project.name} className={active === project.id ? 'is-active' : ''} aria-current={active === project.id ? 'location' : undefined} onClick={(event) => selectWork(event, project.id)}><ProjectIcon id={project.id}/><span className="work-nav-name">{project.name === 'Shopify 独立站插件' ? 'Shopify 插件' : project.name}</span></a>)}
      </nav>
      <div className="portfolio-content">
      <section className="work-hero" id="work-intro" aria-labelledby="work-heading" tabIndex={-1}>
        <h1 id="work-heading">小潘同学</h1>
        <div className="work-introduction"><p>积极乐观、自信果决，对未知保持好奇，充满向上的能量。热爱足球、音乐与社交，生活的众多支点，让我能从容应对挑战与压力。做事客观明确，也重视高效的沟通。</p><p>很幸运生在 AI 时代，借助 AI 工具做了这些有意思的小项目。它们还没有成长为商业化或高访问量的产品，却在我的个人生活中，提供了莫大的帮助与宽慰。</p></div>
      </section>
      <section className="work-collection" id="work-collection" aria-label="个人作品列表">
        <div className="work-collection-label"><h2>作品</h2><span>{projects.length} 个项目</span></div>
        {projects.map((project) => <ProjectCard key={project.id} project={project}/>)}
      </section>
      </div>
    </div>
  );
}
