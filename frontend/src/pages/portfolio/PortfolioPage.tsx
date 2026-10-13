import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, AudioLines, Blocks, ChevronDown, CookingPot, MapPin, Nfc } from 'lucide-react';
import { projects, type Project } from '../../entities/project/model/projects';
import './portfolio.css';

const icons = { couploc: MapPin, soundtag: Nfc, cooking: CookingPot, impromptu: AudioLines, shopify: Blocks };

function ProjectIcon({ id }: { id: string }) {
  const Icon = icons[id as keyof typeof icons] ?? Blocks;
  return <span className={`work-icon work-tone-${id}`}><Icon aria-hidden="true" strokeWidth={1.5} /></span>;
}

function ProjectArtwork({ project }: { project: Project }) {
  return (
    <div className={`work-artwork work-tone-${project.id}`} role="img" aria-label={`${project.name} 概念插画，非应用截图`}>
      <div className="work-art-copy" aria-hidden="true"><span>{project.name}</span><strong>{project.statement}</strong><small>概念插画</small></div>
      <div className={`work-art-shape art-${project.id}`} aria-hidden="true">
        {project.id === 'couploc' ? <><span className="work-orbit orbit-one"/><span className="work-orbit orbit-two"/><span className="work-connection"/><span className="work-location location-one"><MapPin/></span><span className="work-location location-two"><MapPin/></span></> : null}
        {project.id === 'soundtag' ? <><span className="work-nfc-card"><Nfc/><small>SoundTag</small></span><div className="work-wave">{[24, 40, 65, 90, 56, 110, 78, 44, 72, 32, 18].map((height, index) => <i key={index} style={{ height }}/>)}</div></> : null}
        {project.id === 'cooking' ? <><span className="work-plate"><CookingPot strokeWidth={1}/></span><i className="work-leaf leaf-one"/><i className="work-leaf leaf-two"/></> : null}
        {project.id === 'impromptu' ? <><span className="work-speech speech-one">Hello.</span><span className="work-speech speech-two"><AudioLines strokeWidth={1.5}/></span></> : null}
        {project.id === 'shopify' ? <><span className="work-block block-one"/><span className="work-block block-two"/><span className="work-block block-three"><Blocks strokeWidth={1}/></span></> : null}
      </div>
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="work-card" id={project.id} aria-labelledby={`${project.id}-title`} tabIndex={-1}>
      <header className="work-card-head">
        <ProjectIcon id={project.id}/>
        <div className="work-identity"><h2 id={`${project.id}-title`}>{project.name}</h2><p>{project.summary}</p><span>{project.category}</span></div>
        {project.url ? <a className="work-visit" href={project.url} target="_blank" rel="noreferrer">访问作品 <ArrowUpRight size={15}/></a> : <span className="work-number" aria-label={`第 ${index + 1} 个作品`}>{String(index + 1).padStart(2, '0')}</span>}
      </header>
      {project.screenshots?.length ? <div className="work-screenshots" tabIndex={0} role="region" aria-label={`${project.name} 截图，可横向滚动`}>{project.screenshots.map((shot) => <img key={shot.src} src={shot.src} alt={shot.alt} loading="lazy" decoding="async"/>)}</div> : <ProjectArtwork project={project}/>}
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

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '作品集 · 小潘同学';
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id === 'work-intro' ? '' : entry.target.id);
      }
    }, { rootMargin: '-20% 0px -45% 0px', threshold: 0 });
    pageRef.current?.querySelectorAll('.work-card, .work-hero').forEach((card) => observer.observe(card));
    return () => { observer.disconnect(); document.title = previousTitle; };
  }, []);

  return (
    <div className="portfolio-page" ref={pageRef}>
      <nav className="work-dock" aria-label="作品快捷导航">
        {projects.map((project) => <a key={project.id} href={`#${project.id}`} className={active === project.id ? 'is-active' : ''} aria-current={active === project.id ? 'location' : undefined} onClick={(event) => {
          event.preventDefault();
          const card = document.getElementById(project.id);
          card?.focus({ preventScroll: true });
          card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
          setActive(project.id);
        }}><ProjectIcon id={project.id}/><span>{project.name === 'Shopify 独立站插件' ? 'Shopify 插件' : project.name}</span></a>)}
      </nav>
      <section className="work-hero" id="work-intro" aria-labelledby="work-heading">
        <p className="work-eyebrow">PERSONAL COLLECTION <span> / {String(projects.length).padStart(2, '0')} WORKS</span></p>
        <h1 id="work-heading">把好奇，<br/>做成<span>作品。</span></h1>
        <div className="work-introduction"><p>积极乐观、自信果决，对未知保持好奇，充满向上的能量。热爱足球、音乐与社交，生活的众多支点，让我能从容应对挑战与压力。做事客观明确，也重视高效的沟通。</p><p>很幸运生在 AI 时代，借助 AI 工具做了这些有意思的小项目。它们还没有成长为商业化或高访问量的产品，却在我的个人生活中，提供了莫大的帮助与宽慰。</p></div>
        <a className="work-start" href="#work-collection">看看我的作品 <ArrowDown size={16}/></a>
        <span className="work-hero-note">为好奇而探索，<br/>为生活而创造。</span>
      </section>
      <section className="work-collection" id="work-collection" aria-label="个人作品列表">
        <div className="work-collection-label"><span>我的作品</span><span>{projects.length} 个生活里的小尝试</span></div>
        {projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index}/>)}
      </section>
      <div className="work-ending"><span>TO BE CONTINUED</span><p>下一个想法，正在路上。</p><a href="#work-heading">回到介绍 ↑</a></div>
    </div>
  );
}
