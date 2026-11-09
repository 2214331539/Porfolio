import { useEffect, useState, type ReactNode } from 'react';
import { Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Note } from '../entities/note/model/types';
import type { Post } from '../entities/post/model/types';
import type { Project } from '../entities/project/model/projects';
import { portfolioAssetUrl } from '../features/content/api/portfolio-api';
import { ProjectIcon } from '../features/content/ui/ProjectIcon';
import { excerptOf, formatDate } from './format';
import { paletteStyle } from './tone';

/**
 * Article entry led by its text. A cover, when the article has one, sits beside it (above it for `lead`);
 * nothing is drawn in place of a missing cover. `stamp` moves the date into a left column for archives.
 */
export function PostRow({ post, lead = false, stamp = false }: { post: Post; lead?: boolean; stamp?: boolean }) {
  const excerpt = excerptOf(post, lead ? 150 : 90);
  return (
    <Link to={`/blog/${post.slug}`} className={`post-row ${lead ? 'lead' : ''} ${post.cover_url ? 'has-cover' : ''}`}>
      {stamp ? <time className="post-row-stamp" dateTime={post.published_at}>{formatDate(post.published_at, 'short')}</time> : null}
      <div className="post-row-text">
        <div className="card-meta">
          {post.repository?.name ? <span>{post.repository.name}</span> : null}
          {stamp ? null : <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>}
        </div>
        <h3>{post.is_pinned ? <Pin className="card-pin" aria-label="置顶" /> : null}{post.title}</h3>
        {excerpt ? <p>{excerpt}</p> : null}
      </div>
      {post.cover_url ? <div className="post-row-cover"><img src={post.cover_url} alt="" loading="lazy" /></div> : null}
    </Link>
  );
}

/** Photo card that flips through the set while hovered. */
export function NoteCard({ note, kind, tall = false }: { note: Note; kind?: string; tall?: boolean }) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!hover || note.images.length < 2) { setIndex(0); return undefined; }
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % note.images.length), 900);
    return () => window.clearInterval(timer);
  }, [hover, note.images.length]);
  return (
    <Link to={`/notes/${note.id}`} className={`card-item ${tall ? 'tall' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {note.images.length ? (
        <div className="card-media">
          {note.images.map((src, position) => <img key={`${src}-${position}`} src={src} alt={position === 0 ? note.title : ''} loading="lazy" className={position === index ? 'shown' : ''} />)}
          {note.images.length > 1 ? <span className="card-count">{index + 1}/{note.images.length}</span> : null}
        </div>
      ) : null}
      <div className="card-body">
        <div className="card-meta">
          {kind ? <span className="card-kind">{kind}</span> : null}
          {note.topics[0] ? <span>{note.topics[0]}</span> : null}
          <time dateTime={note.published_at}>{formatDate(note.published_at)}</time>
        </div>
        <h3>{note.title}</h3>
        {note.images.length ? null : <p>{note.content.slice(0, 90)}</p>}
      </div>
    </Link>
  );
}

/** Project card on a tinted backdrop with its icon. */
export function WorkCard({ project, kind }: { project: Project; kind?: string }) {
  return (
    <Link to={`/portfolio#project-${project.slug}`} className="card-item">
      <div className="card-media work-media tone" style={paletteStyle(project.slug)}>
        {project.screenshots[0] ? <img src={portfolioAssetUrl(project.screenshots[0].src)} alt="" loading="lazy" /> : <ProjectIcon project={project} />}
      </div>
      <div className="card-body">
        <div className="card-meta">
          {kind ? <span className="card-kind">{kind}</span> : null}
          {project.category ? <span>{project.category}</span> : null}
        </div>
        <h3>{project.name}</h3>
      </div>
    </Link>
  );
}

export function PageState({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return <div className={`page-state ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      {children ? <div>{children}</div> : null}
    </div>
  );
}
