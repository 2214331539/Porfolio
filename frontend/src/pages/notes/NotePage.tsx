import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../../features/content/api/content-api';
import type { Note } from '../../entities/note/model/types';

export default function NotePage() {
  const { id = '0' } = useParams();
  const [note, setNote] = useState<Note>();
  const [image, setImage] = useState(0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setImage(0);
    contentApi.getNote(Number(id))
      .then(setNote)
      .catch((err) => setError(err instanceof Error ? err.message : '图文加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  async function like() {
    if (!note || liked || liking) return;
    setLiking(true);
    setActionError('');
    try {
      setNote(await contentApi.likeNote(note.id));
      setLiked(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '点赞失败');
    } finally {
      setLiking(false);
    }
  }

  if (loading) return <div className="page-loading">正在加载图文…</div>;
  if (error || !note) return <div className="page-loading"><div className="form-error">{error || '图文不存在'}</div><Link className="text-link" to="/notes">返回图文仓库</Link></div>;
  const count = note.images.length;
  const repositoryId = note.repository?.id ?? note.repository_id;
  const backTo = repositoryId ? `/notes?repository=${repositoryId}` : '/notes';
  return (
    <main className="note-detail refined-note">
      <Link to={backTo} className="back-link"><ArrowLeft />返回{note.repository?.name || '图文仓库'}</Link>
      <div className="note-detail-grid">
        <div className="gallery">
          {count ? <img src={note.images[image]} alt={`${note.title} · ${image + 1}`} /> : <p className="empty-state">暂无图片</p>}
          {count > 1 ? <><button className="gallery-prev" type="button" onClick={() => setImage((value) => (value - 1 + count) % count)} aria-label="上一张"><ChevronLeft /></button><button className="gallery-next" type="button" onClick={() => setImage((value) => (value + 1) % count)} aria-label="下一张"><ChevronRight /></button></> : null}
          {count ? <div className="gallery-count">{image + 1} / {count}</div> : null}
        </div>
        <article className="note-body">
          <p className="eyebrow">{note.repository?.name || '未归档'} · {new Date(note.published_at).toLocaleDateString('zh-CN')}</p>
          <h1>{note.title}</h1>
          <p>{note.content}</p>
          <div className="note-tags">{note.topics.map((topic) => <span key={topic}>#{topic}</span>)}</div>
          {actionError ? <div className="form-error">{actionError}</div> : null}
          <div className="note-actions">
            <button type="button" onClick={like} disabled={liked || liking} className={liked ? 'liked' : ''}><Heart fill={liked ? 'currentColor' : 'none'} /> {note.likes}</button>
            <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2 />分享</button>
          </div>
        </article>
      </div>
    </main>
  );
}
