import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteContext } from '../../app/providers/site-provider';
import { contentApi } from '../../features/content/api/content-api';
import type { Note } from '../../entities/note/model/types';
import type { Post } from '../../entities/post/model/types';
import { NoteCard, PostCard, SectionHead } from '../../shared/ui';

function Typewriter({ mottos }: { mottos: string[] }) {
  const phrases = useMemo(() => mottos.filter(Boolean), [mottos]);
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!phrases.length) return undefined;
    const target = phrases[index % phrases.length];
    const wait = !deleting && text === target ? 2200 : deleting && !text ? 400 : deleting ? 45 : 100;
    const timer = window.setTimeout(() => {
      if (!deleting && text === target) setDeleting(true);
      else if (deleting && !text) {
        setDeleting(false);
        setIndex((value) => value + 1);
      } else {
        setText(target.slice(0, text.length + (deleting ? -1 : 1)));
      }
    }, wait);
    return () => window.clearTimeout(timer);
  }, [deleting, index, phrases, text]);

  if (!phrases.length) return null;
  const tailStart = Math.max(0, text.length - 2);
  return (
    <span className="typewriter-text">
      {text.slice(0, tailStart)}
      <span className="typewriter-tail">{text.slice(tailStart)}<i className="caret" aria-hidden="true" /></span>
    </span>
  );
}

export default function HomePage() {
  const { settings, settingsLoading, settingsError } = useContext(SiteContext); const [posts, setPosts] = useState<Post[]>([]); const [notes, setNotes] = useState<Note[]>([]); const [error, setError] = useState(''); const scrollRoot = useRef<HTMLDivElement>(null); const wheelDistance = useRef(0); const isAnimating = useRef(false);
  useEffect(() => { Promise.all([contentApi.listPosts(), contentApi.listNotes()]).then(([p, n]) => { setPosts(p.slice(0, 4)); setNotes(n.slice(0, 4)); }).catch(err => setError(err instanceof Error ? err.message : '首页内容加载失败')); }, []);
  const movePanel = (direction: 1 | -1) => { const root = scrollRoot.current; if (!root || isAnimating.current) return; const currentIndex = Math.round(root.scrollTop / root.clientHeight); const nextIndex = Math.max(0, Math.min(2, currentIndex + direction)); if (nextIndex === currentIndex) return; isAnimating.current = true; root.scrollTo({ top: nextIndex * root.clientHeight, behavior: 'smooth' }); window.setTimeout(() => { isAnimating.current = false; wheelDistance.current = 0; }, 760); };
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); if (isAnimating.current) return; wheelDistance.current += event.deltaY; if (Math.abs(wheelDistance.current) >= 42) movePanel(wheelDistance.current > 0 ? 1 : -1); };
  if (settingsLoading) return <div className="page-loading">正在加载站点内容…</div>;
  if (settingsError || error) return <div className="page-loading"><p className="form-error">{settingsError || error}</p></div>;
  if (!settings) return null;
  return <div className="landing-shell" ref={scrollRoot} onWheel={handleWheel}><section className="landing-panel hero"><div className="hero-copy reveal"><div className="hero-typewriter"><Typewriter mottos={settings.mottos}/></div></div><button className="scroll-cue" onClick={() => movePanel(1)} aria-label="向下滚动"><ArrowDown/></button></section><section id="writing" className="landing-panel landing-content"><div className="content-section"><SectionHead index="01 / WRITING" title="博客文章" description="关于技术、设计与生活的长期笔记。" to="/blog" link="查看全部文章"/><div className="masonry-posts">{posts.map((post, index) => <PostCard key={post.id} post={post} variant={index === 0 ? 'large visual' : index === 2 ? 'wide' : index === 3 ? 'visual' : ''}/>)}</div></div></section><section className="landing-panel notes-preview"><div className="content-section"><SectionHead index="02 / MOMENTS" title="图文笔记" description="一些不够长，却值得留下的瞬间。" to="/notes" link="进入图文集"/><div className="notes-grid">{notes.map(note => <NoteCard key={note.id} note={note}/>)}</div><Link className="big-link" to="/notes">继续看看 <ArrowUpRight/></Link></div><footer className="landing-footer"><img src="/assets/black_line.png" alt="站点标识"/><span>{settings.site_title}</span><small>© 2026</small></footer></section></div>;
}
