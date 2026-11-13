import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import type { Doing } from '../../entities/doing/model/types';
import { renderArticle } from '../../shared/markdown';
import { dayNumber, paperStyle } from './doing-api';

/** An opened note: the same paper, enlarged, with the Markdown description. */
export function DoingSheet({ item, onClose }: { item: Doing; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const html = useMemo(() => (item.body.trim() ? renderArticle(item.body).html : ''), [item.body]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="doing-sheet-back" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <article className="doing-sheet" role="dialog" aria-modal="true" aria-labelledby="doing-sheet-title" style={paperStyle(item.id)}>
        <button ref={closeRef} type="button" className="doing-sheet-close" onClick={onClose} aria-label="关闭"><X aria-hidden="true" /></button>
        <h2 id="doing-sheet-title">{item.title}</h2>
        <p className="doing-sheet-meta">{item.started_on} 开始 · 第 {dayNumber(item.started_on)} 天</p>
        {html ? <div className="prose" dangerouslySetInnerHTML={{ __html: html }} /> : null}
      </article>
    </div>
  );
}
