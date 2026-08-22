import { ArrowUpRight, Clock, Eye, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Note } from '../entities/note/model/types';
import type { Post } from '../entities/post/model/types';

export function SectionHead({ index, title, description, to, link }: { index: string; title: string; description: string; to?: string; link?: string }) {
  return <div className="section-head"><div><p className="eyebrow">{index}</p><h2>{title}</h2><p>{description}</p></div>{to ? <Link className="text-link" to={to}>{link}<ArrowUpRight/></Link> : null}</div>;
}
export function PostCard({ post, variant = '' }: { post: Post; variant?: string }) {
  return <Link to={`/blog/${post.slug}`} className={`post-card ${variant}`}>
    <div className="post-card-top"><span>{post.repository?.name || post.category?.name || '未归档'}</span><span>{new Date(post.published_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span></div>
    {variant.includes('visual') ? <div className="post-visual"><span>{String(post.id).padStart(2, '0')}</span>{post.cover_url ? <img src={post.cover_url} alt={`${post.title} 封面`} loading="lazy"/> : null}</div> : null}
    <div className="post-card-copy"><h3>{post.title}</h3><p>{post.excerpt}</p></div>
    <div className="post-card-foot"><span><Clock/> {post.reading_time} 分钟</span><ArrowUpRight/></div>
  </Link>;
}
export function NoteCard({ note }: { note: Note }) {
  return <Link to={`/notes/${note.id}`} className="note-card"><div className={`note-image ${note.images.length ? '' : 'note-image-empty'}`}>{note.images.length ? <img src={note.images[0]} alt={note.title} loading="lazy"/> : <span>无图笔记</span>}<div className="note-overlay"><span>查看图文</span><ArrowUpRight/></div></div><div className="note-copy"><h3>{note.title}</h3><span><Heart size={15}/> {note.likes}</span></div><div className="note-topics">{note.topics.map(t => <span key={t}>#{t}</span>)}</div></Link>;
}
export function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) { return <div className="stat"><div className="stat-icon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>; }
export function Metadata({ post }: { post: Post }) { return <div className="metadata"><span><Clock/> {post.reading_time} 分钟阅读</span><span><Eye/> {post.views.toLocaleString()} 次浏览</span></div>; }
