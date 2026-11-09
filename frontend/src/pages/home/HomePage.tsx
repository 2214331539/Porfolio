import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Note } from '../../entities/note/model/types';
import type { Post } from '../../entities/post/model/types';
import type { Project } from '../../entities/project/model/projects';
import type { InfoSource } from '../../entities/source/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { portfolioApi } from '../../features/content/api/portfolio-api';
import { sourcesApi } from '../../features/sources/sources-api';
import { NoteCard, PostRow, WorkCard } from '../../shared/ui';

const BubbleField = lazy(() => import('../../features/sources/BubbleField').then((module) => ({ default: module.BubbleField })));

/** A card whose media is the live, draggable 信息源泉 bubble field. */
function SourcesCard({ sources }: { sources: InfoSource[] }) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return undefined;
    const observer = new ResizeObserver(([entry]) => setHeight(Math.round(entry.contentRect.width * 0.72)));
    observer.observe(media);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="card-item sources-card">
      <div className="card-media live" ref={mediaRef} style={{ height: height || undefined }}>
        {height ? <Suspense fallback={null}><BubbleField sources={sources} height={height} compact /></Suspense> : null}
      </div>
      <Link className="card-body" to="/sources">
        <div className="card-meta"><span className="card-kind">信息源泉</span><span>{sources.length} 个网站</span></div>
        <h3>我常逛的地方<ArrowRight className="card-arrow" aria-hidden="true" /></h3>
      </Link>
    </div>
  );
}

function Shelf({ title, to, count, children }: { title: string; to: string; count: number; children: ReactNode }) {
  return (
    <section className="shelf" aria-label={title}>
      <header className="shelf-head">
        <h2>{title}</h2>
        <Link to={to}>全部 {count}<ArrowRight aria-hidden="true" /></Link>
      </header>
      {children}
    </section>
  );
}

/**
 * Home: articles read as a text column on the left, the visual things (latest photo set, the bubble field)
 * stand beside them, and shelves of photo sets and works follow below.
 */
export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>(contentApi.getCachedPosts() ?? []);
  const [notes, setNotes] = useState<Note[]>(contentApi.getCachedNotes() ?? []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sources, setSources] = useState<InfoSource[]>(sourcesApi.cached() ?? []);

  useEffect(() => {
    contentApi.listPosts().then(setPosts).catch(() => undefined);
    contentApi.listNotes().then(setNotes).catch(() => undefined);
    portfolioApi.get().then((data) => setProjects(data.projects)).catch(() => undefined);
    sourcesApi.list().then(setSources).catch(() => undefined);
  }, []);

  const sortedPosts = useMemo(() => [...posts].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.published_at.localeCompare(a.published_at) || b.id - a.id), [posts]);
  const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id - a.id), [notes]);
  const [lead, ...restPosts] = sortedPosts;
  const [firstNote, ...restNotes] = sortedNotes;

  return (
    <div className="home container">
      <section className="home-top">
        <div className="home-posts">
          {lead ? <PostRow post={lead} lead /> : null}
          {restPosts.slice(0, 5).map((post) => <PostRow key={post.id} post={post} />)}
          {posts.length ? <Link className="more-link" to="/blog">全部文章<small>{posts.length}</small><ArrowRight aria-hidden="true" /></Link> : null}
        </div>
        <aside className="home-side">
          {firstNote ? <NoteCard note={firstNote} kind="图文" tall /> : null}
          {sources.length ? <SourcesCard sources={sources} /> : null}
        </aside>
      </section>
      {restNotes.length ? (
        <Shelf title="图文" to="/notes" count={notes.length}>
          <div className="shelf-grid photos">{restNotes.slice(0, 4).map((note) => <NoteCard key={note.id} note={note} tall />)}</div>
        </Shelf>
      ) : null}
      {projects.length ? (
        <Shelf title="作品" to="/portfolio" count={projects.length}>
          <div className="shelf-grid">{projects.slice(0, 4).map((project) => <WorkCard key={project.id} project={project} />)}</div>
        </Shelf>
      ) : null}
    </div>
  );
}
