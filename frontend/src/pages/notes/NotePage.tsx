import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Link2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Note } from '../../entities/note/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { formatDate } from '../../shared/format';
import { PageState } from '../../shared/ui';

export default function NotePage() {
  const { id = '0' } = useParams();
  const [note, setNote] = useState<Note>();
  const [image, setImage] = useState(0);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setImage(0);
    contentApi.getNote(Number(id))
      .then((item) => { setNote(item); document.title = `${item.title} · 小潘同学`; })
      .catch((err) => setError(err instanceof Error ? err.message : '图文加载失败'))
      .finally(() => setLoading(false));
    return () => { document.title = '小潘同学'; };
  }, [id]);

  const count = note?.images.length ?? 0;
  useEffect(() => {
    if (count < 2) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setImage((value) => (value - 1 + count) % count);
      if (event.key === 'ArrowRight') setImage((value) => (value + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  async function like() {
    if (!note || liked) return;
    setLiked(true);
    try { setNote(await contentApi.likeNote(note.id)); } catch { setLiked(false); }
  }

  function share() {
    void navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); });
  }

  if (loading) return <PageState>正在加载图文…</PageState>;
  if (error || !note) return <PageState tone="error">{error || '图文不存在'} <Link to="/notes">返回图文</Link></PageState>;

  const repositoryId = note.repository?.id ?? note.repository_id;
  return (
    <div className="note-detail container">
      <Link to={repositoryId ? `/notes?repository=${repositoryId}` : '/notes'} className="back-link"><ArrowLeft aria-hidden="true" />{note.repository?.name ?? '图文'}</Link>
      <div className="note-detail-grid">
        <div className="gallery">
          <div className="gallery-stage">
            {count ? <img src={note.images[image]} alt={`${note.title}（${image + 1}/${count}）`} /> : <p>没有图片</p>}
            {count > 1 ? (
              <>
                <button className="gallery-nav prev" type="button" onClick={() => setImage((value) => (value - 1 + count) % count)} aria-label="上一张"><ChevronLeft aria-hidden="true" /></button>
                <button className="gallery-nav next" type="button" onClick={() => setImage((value) => (value + 1) % count)} aria-label="下一张"><ChevronRight aria-hidden="true" /></button>
                <span className="gallery-count">{image + 1} / {count}</span>
              </>
            ) : null}
          </div>
          {count > 1 ? (
            <div className="gallery-thumbs" role="tablist" aria-label="选择图片">
              {note.images.map((src, index) => (
                <button key={`${src}-${index}`} type="button" role="tab" aria-selected={index === image} className={index === image ? 'active' : ''} onClick={() => setImage(index)}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <article className="note-text">
          <time dateTime={note.published_at}>{formatDate(note.published_at)}</time>
          <h1>{note.title}</h1>
          {note.content ? <p>{note.content}</p> : null}
          {note.topics.length ? <div className="chip-row">{note.topics.map((topic) => <span className="chip" key={topic}>#{topic}</span>)}</div> : null}
          <div className="note-actions">
            <button type="button" className={`button small ${liked ? 'liked' : ''}`} onClick={like} disabled={liked}><Heart fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />{note.likes}</button>
            <button type="button" className="button small" onClick={share}><Link2 aria-hidden="true" />{copied ? '链接已复制' : '复制链接'}</button>
          </div>
        </article>
      </div>
    </div>
  );
}
