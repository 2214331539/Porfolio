import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Screenshot } from '../../entities/project/model/projects';
import { portfolioAssetUrl } from '../../features/content/api/portfolio-api';

function Shot({ shot, title, eager = false, onLoad }: { shot: Screenshot; title: string; eager?: boolean; onLoad?: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (failed) onLoad?.(); }, [failed, onLoad]);
  return failed ? <span className="work-image-error">图片暂时无法加载</span> : <img src={portfolioAssetUrl(shot.src)} alt={shot.alt || title} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={onLoad} onError={() => setFailed(true)}/>;
}

function GalleryDialog({ shots, name, initial, onClose }: { shots: Screenshot[]; name: string; initial: number; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedIndex, setIndex] = useState(initial);
  const index = Math.min(selectedIndex, shots.length - 1);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, []);
  const next = () => setIndex((value) => Math.min(shots.length - 1, value + 1));
  const prev = () => setIndex(Math.max(0, index - 1));
  const close = () => { dialogRef.current?.close(); onClose(); };
  return <dialog className="work-lightbox" ref={dialogRef} aria-label={`${name} 截图查看器`} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === e.currentTarget) close(); }} onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); next(); } if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); } }}>
    <header><span>{name}</span><span aria-live="polite">{index + 1} / {shots.length}</span><button type="button" onClick={close} aria-label="关闭截图"><X/></button></header>
    <div className="work-lightbox-image"><Shot key={shots[index].src} shot={shots[index]} title={`${name} 截图 ${index + 1}`} eager/></div>
    <footer><button type="button" onClick={prev} disabled={index === 0} aria-label="上一张截图"><ChevronLeft/></button><p>{shots[index].alt}</p><button type="button" onClick={next} disabled={index === shots.length - 1} aria-label="下一张截图"><ChevronRight/></button></footer>
  </dialog>;
}

export function ProjectGallery({ shots, name }: { shots: Screenshot[]; name: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [bounds, setBounds] = useState({ start: true, end: true });
  function measure() {
    const el = rail.current;
    if (!el) return;
    const start = el.scrollLeft < 2, end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setBounds((old) => old.start === start && old.end === end ? old : { start, end });
  }
  useEffect(() => {
    const el = rail.current!;
    const observer = new ResizeObserver(measure); observer.observe(el); measure();
    return () => observer.disconnect();
  }, [shots]);
  function move(direction: number) {
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <div className="work-gallery">
    <div className="work-screenshots" ref={rail} onScroll={measure} tabIndex={0} role="region" aria-label={`${name} 截图，可横向滚动`}>
      {shots.map((shot, i) => <button type="button" key={`${shot.src}-${i}`} aria-label={`放大${name}截图 ${i + 1}`} onClick={(e) => { opener.current = e.currentTarget; setSelected(i); }}><Shot shot={shot} title={`${name} 截图 ${i + 1}`} onLoad={measure}/></button>)}
    </div>
    {!bounds.start || !bounds.end ? <div className="work-gallery-controls"><button type="button" disabled={bounds.start} onClick={() => move(-1)} aria-label={`${name} 截图向左滚动`}><ChevronLeft size={16}/></button><button type="button" disabled={bounds.end} onClick={() => move(1)} aria-label={`${name} 截图向右滚动`}><ChevronRight size={16}/></button></div> : null}
    {selected !== null ? <GalleryDialog shots={shots} name={name} initial={selected} onClose={() => { setSelected(null); opener.current?.focus({ preventScroll: true }); }}/> : null}
  </div>;
}
