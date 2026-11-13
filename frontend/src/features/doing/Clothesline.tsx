import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Doing, DoingKind } from '../../entities/doing/model/types';
import { dayNumber, paperStyle } from './doing-api';

const SIZE = {
  main: { slot: 262, width: 228, height: 148, sag: 7, rope: 40 },
  side: { slot: 200, width: 168, height: 110, sag: 6, rope: 36 },
};
const PAD = 30;
const NARROW_PAD = 8;
const TILTS = [-2.2, 1.6, -1.1, 2.4, -1.8, 1.2, -2.6, 0.9];

/** The note being dragged, shared by both ropes so a note can be carried from one to the other. */
let draggingId: number | null = null;

export type MoveHandler = (id: number, kind: DoingKind, beforeId: number | null) => void;

function Peg() {
  return (
    <svg className="doing-peg" viewBox="0 0 15 30" aria-hidden="true">
      <rect x="1" y="0" width="5.6" height="30" rx="2.2" fill="#d9bd92" />
      <rect x="8.4" y="0" width="5.6" height="30" rx="2.2" fill="#caa979" />
      <rect x="0" y="10" width="15" height="2.6" rx="1.3" fill="rgb(90 70 45 / .3)" />
    </svg>
  );
}

/**
 * One clothesline with sticky notes pegged along it. It scrolls sideways when the notes outgrow the page
 * (swipe, trackpad, mouse drag or the arrows). With `editable`, notes can be dragged to reorder or onto the
 * other rope, and the first slot is a blank note for adding.
 */
export function Clothesline({ kind, label, items, onOpen, editable = false, onAdd, onMove }: {
  kind: DoingKind;
  label: string;
  items: Doing[];
  onOpen: (item: Doing) => void;
  editable?: boolean;
  onAdd?: () => void;
  onMove?: MoveHandler;
}) {
  const size = SIZE[kind];
  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [grabbing, setGrabbing] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 680px)').matches);
  useEffect(() => {
    const query = matchMedia('(max-width: 680px)');
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const pad = narrow ? NARROW_PAD : PAD;

  const lead = editable ? 1 : 0;
  const slots = items.length + lead;
  const width = Math.max(pad * 2 + slots * size.slot, viewport);
  const centerOf = (slot: number) => pad + size.slot * (slot + 0.5);
  const noteTop = size.rope + 6;
  const height = noteTop + size.height + 34;

  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setViewport(element.clientWidth);
    setEdges({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    measure();
    const element = scroller.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, slots]);

  const anchors = [8, ...Array.from({ length: slots }, (_, slot) => centerOf(slot)), width - 8];
  const rope = anchors.slice(1).reduce((path, x, index) => `${path} Q ${(anchors[index] + x) / 2} ${size.rope + size.sag * 2} ${x} ${size.rope}`, `M ${anchors[0]} ${size.rope}`);

  function scrollBy(direction: 1 | -1) {
    const element = scroller.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }

  /** Mouse users can grab the line and pull it; touch and trackpads already scroll natively. */
  function startPull(event: ReactPointerEvent<HTMLDivElement>) {
    const element = scroller.current;
    if (editable || !element || event.pointerType !== 'mouse' || event.button !== 0) return;
    const startX = event.clientX;
    const startLeft = element.scrollLeft;
    let moved = false;
    const move = (next: PointerEvent) => {
      const delta = next.clientX - startX;
      if (!moved && Math.abs(delta) > 6) { moved = true; setGrabbing(true); }
      if (moved) element.scrollLeft = startLeft - delta;
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setGrabbing(false);
      if (moved) { suppressClick.current = true; window.setTimeout(() => { suppressClick.current = false; }, 0); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function dragOverNote(event: DragEvent<HTMLElement>, index: number) {
    if (draggingId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const box = event.currentTarget.getBoundingClientRect();
    setDropAt(event.clientX < box.left + box.width / 2 ? index : index + 1);
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const id = draggingId;
    draggingId = null;
    if (id !== null && dropAt !== null) onMove?.(id, kind, items[dropAt]?.id ?? null);
    setDropAt(null);
    setDragged(null);
  }

  const className = ['doing-scroll', !edges.start && 'fade-start', !edges.end && 'fade-end', grabbing && 'grabbing'].filter(Boolean).join(' ');
  return (
    <section className={`doing-line ${kind}`} aria-label={label}>
      <h2 className="doing-label">{label}</h2>
      <div className="doing-frame">
        {!edges.start ? <button type="button" className="doing-arrow start" onClick={() => scrollBy(-1)} aria-label="向左"><ChevronLeft aria-hidden="true" /></button> : null}
        {!edges.end ? <button type="button" className="doing-arrow end" onClick={() => scrollBy(1)} aria-label="向右"><ChevronRight aria-hidden="true" /></button> : null}
        <div ref={scroller} className={className} onScroll={measure} onPointerDown={startPull} onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
          <div
            className="doing-track"
            style={{ width, height }}
            onDragOver={(event) => { if (draggingId !== null && event.target === event.currentTarget) { event.preventDefault(); setDropAt(items.length); } }}
            onDrop={drop}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null); }}
          >
            <svg className="doing-rope" width={width} height={height} aria-hidden="true">
              <path d={rope} fill="none" strokeWidth="2" />
              <circle cx={anchors[0]} cy={size.rope} r="4" />
              <circle cx={width - 8} cy={size.rope} r="4" />
            </svg>
            {editable ? (
              <button type="button" className="doing-note ghost" style={{ left: centerOf(0) - size.width / 2, top: noteTop, width: size.width, height: size.height, '--tilt': '0deg' } as CSSProperties} onClick={onAdd} aria-label={`在${label}上新增`}>
                <Peg /><Plus aria-hidden="true" />
              </button>
            ) : null}
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`doing-note ${dragged === item.id ? 'lifted' : ''}`}
                style={{ left: centerOf(index + lead) - size.width / 2, top: noteTop, width: size.width, height: size.height, ...paperStyle(item.id), '--tilt': `${TILTS[item.id % TILTS.length]}deg` } as CSSProperties}
                onClick={() => onOpen(item)}
                draggable={editable}
                onDragStart={editable ? (event) => { draggingId = item.id; setDragged(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(item.id)); } : undefined}
                onDragEnd={editable ? () => { draggingId = null; setDragged(null); setDropAt(null); } : undefined}
                onDragOver={editable ? (event) => dragOverNote(event, index) : undefined}
              >
                <Peg />
                <h3>{item.title}</h3>
                <span className="doing-day">第 {dayNumber(item.started_on)} 天</span>
              </button>
            ))}
            {dropAt !== null ? <span className="doing-drop" style={{ left: pad + size.slot * (dropAt + lead), top: size.rope - 4, height: size.height + 20 }} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
