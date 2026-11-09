import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import Matter from 'matter-js';
import { ArrowUpRight, X } from 'lucide-react';
import type { InfoSource } from '../../entities/source/model/types';
import { hostOf } from './sources-api';

export type BubbleFieldHandle = { shake: () => void };
type BubbleFieldProps = { sources: InfoSource[]; height: number; highlight?: string | null; compact?: boolean };

const PALETTE = ['#1d6bff', '#ff6b3d', '#c6f24e', '#ff8fd0', '#ffd23f', '#7c5cff', '#20c997'];
const hash = (text: string) => [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
export const bubbleColor = (source: InfoSource) => source.color || PALETTE[hash(source.category || source.name) % PALETTE.length];

type Rgb = [number, number, number];
const PAPER: Rgb = [222, 216, 205];
function toRgb(hex: string): Rgb {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(full, 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
const toHex = (rgb: Rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
const mix = (from: Rgb, to: Rgb, amount: number) => from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)) as Rgb;
export function inkOn(hex: string) {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.68 ? '#2a2723' : '#fffdf8';
}

/** A site's brand colour pulled toward warm paper grey, plus the light and dark ends of its matte shading. */
export function bubbleTone(source: InfoSource) {
  const base = mix(toRgb(bubbleColor(source)), PAPER, 0.44);
  return { base: toHex(base), light: toHex(mix(base, [255, 255, 255], 0.3)), dark: toHex(mix(base, [0, 0, 0], 0.16)), ink: inkOn(toHex(base)) };
}

/** Ball radii scaled so all balls together cover roughly 40% of the stage. */
function radiiFor(sources: InfoSource[], width: number, height: number) {
  const weights = sources.map((source) => 0.55 + source.weight * 0.25);
  const unit = Math.sqrt((width * height * 0.4) / (Math.PI * weights.reduce((sum, weight) => sum + weight * weight, 0)));
  return weights.map((weight) => Math.round(Math.max(30, Math.min(width / 4.2, weight * unit))));
}

/**
 * Sites as balls that fall, pile up and can be dragged or flung (matter-js physics, DOM rendering).
 * Hover shows details; a click opens the site. On touch screens a tap shows details first.
 */
export const BubbleField = forwardRef<BubbleFieldHandle, BubbleFieldProps>(function BubbleField({ sources, height, highlight, compact }, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<number, HTMLAnchorElement>());
  const bodiesRef = useRef<Matter.Body[]>([]);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<{ source: InfoSource; x: number; y: number; pinned: boolean } | null>(null);
  const canHover = useMemo(() => matchMedia('(hover: hover) and (pointer: fine)').matches, []);
  const radii = useMemo(() => (width ? radiiFor(sources, width, height) : []), [height, sources, width]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !width || !sources.length) return undefined;
    const { Engine, Bodies, Composite, Mouse, MouseConstraint, Events } = Matter;
    const engine = Engine.create({ enableSleeping: true });
    const wall = { isStatic: true };
    Composite.add(engine.world, [
      Bodies.rectangle(width / 2, height + 60, width * 3, 120, wall),
      Bodies.rectangle(-60, 0, 120, height * 6, wall),
      Bodies.rectangle(width + 60, 0, 120, height * 6, wall),
    ]);
    const bodies = sources.map((source, index) => {
      const radius = radii[index];
      const x = radius + Math.random() * Math.max(1, width - radius * 2);
      const y = -radius - index * (height / Math.max(4, sources.length)) * 0.8 - Math.random() * 60;
      return Bodies.circle(x, y, radius, { restitution: 0.42, friction: 0.06, frictionAir: 0.014, density: 0.0012, label: String(source.id) });
    });
    bodiesRef.current = bodies;
    Composite.add(engine.world, bodies);

    const mouse = Mouse.create(stage);
    const handlers = mouse as unknown as Record<'mousewheel' | 'mousedown' | 'mousemove' | 'mouseup', EventListener>;
    // Keep page scrolling working: matter-js would otherwise swallow wheel and touch gestures over the stage.
    stage.removeEventListener('wheel', handlers.mousewheel);
    stage.removeEventListener('DOMMouseScroll', handlers.mousewheel);
    stage.removeEventListener('touchstart', handlers.mousedown);
    stage.removeEventListener('touchmove', handlers.mousemove);
    stage.removeEventListener('touchend', handlers.mouseup);
    const dragger = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.16, damping: 0.08, render: { visible: false } } as Matter.IConstraintDefinition });
    Composite.add(engine.world, dragger);
    Events.on(dragger, 'startdrag', () => { stage.classList.add('is-dragging'); setFocus((current) => current?.pinned ? current : null); });
    Events.on(dragger, 'enddrag', () => stage.classList.remove('is-dragging'));

    const render = () => {
      bodies.forEach((body, index) => {
        const node = nodes.current.get(sources[index].id);
        if (node) node.style.transform = `translate3d(${body.position.x - radii[index]}px, ${body.position.y - radii[index]}px, 0)`;
      });
    };
    let frame = 0;
    let running = false;
    const tick = () => { Engine.update(engine, 1000 / 60); render(); if (running) frame = requestAnimationFrame(tick); };
    const start = () => { if (!running) { running = true; frame = requestAnimationFrame(tick); } };
    const stop = () => { running = false; cancelAnimationFrame(frame); };

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let step = 0; step < 600; step++) Engine.update(engine, 1000 / 60);
      render();
    } else {
      const visibility = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
      visibility.observe(stage);
      const onHidden = () => (document.hidden ? stop() : start());
      document.addEventListener('visibilitychange', onHidden);
      return () => {
        stop();
        visibility.disconnect();
        document.removeEventListener('visibilitychange', onHidden);
        Mouse.clearSourceEvents(mouse);
        stage.removeEventListener('mousemove', handlers.mousemove);
        stage.removeEventListener('mousedown', handlers.mousedown);
        stage.removeEventListener('mouseup', handlers.mouseup);
        Engine.clear(engine);
      };
    }
    return () => { Engine.clear(engine); };
  }, [height, radii, sources, width]);

  useImperativeHandle(ref, () => ({
    shake: () => bodiesRef.current.forEach((body) => {
      Matter.Sleeping.set(body, false);
      Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 18, y: -10 - Math.random() * 14 });
    }),
  }));

  function show(source: InfoSource, node: HTMLElement, pinned: boolean) {
    const stage = stageRef.current?.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    if (!stage) return;
    setFocus({ source, x: rect.left - stage.left + rect.width / 2, y: rect.top - stage.top, pinned });
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>, source: InfoSource) {
    const start = pointerStart.current;
    const moved = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6 : false;
    if (moved) { event.preventDefault(); return; }
    if (!canHover && focus?.source.id !== source.id) { event.preventDefault(); show(source, event.currentTarget, true); }
  }

  return (
    <div
      ref={stageRef}
      className={`bubble-stage ${compact ? 'compact' : ''}`}
      style={{ height }}
      onMouseDownCapture={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
      onTouchStartCapture={(event) => { pointerStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onMouseLeave={() => setFocus((current) => current?.pinned ? current : null)}
    >
      {width ? sources.map((source, index) => {
        const tone = bubbleTone(source);
        const radius = radii[index];
        return (
          <a
            key={source.id}
            ref={(node) => { if (node) nodes.current.set(source.id, node); else nodes.current.delete(source.id); }}
            className={`bubble w${source.weight} ${highlight && source.category !== highlight ? 'dim' : ''}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            style={{ width: radius * 2, height: radius * 2, '--bubble-color': tone.base, '--bubble-light': tone.light, '--bubble-dark': tone.dark, '--bubble-ink': tone.ink, fontSize: Math.max(12, Math.min(22, radius * 0.3)) } as CSSProperties}
            onMouseEnter={(event) => { if (canHover) show(source, event.currentTarget, false); }}
            onFocus={(event) => show(source, event.currentTarget, false)}
            onBlur={() => setFocus((current) => current?.pinned ? current : null)}
            onClick={(event) => onClick(event, source)}
            aria-label={`${source.name}：${source.description || hostOf(source.url)}`}
          >
            {source.icon_url ? <img src={source.icon_url} alt="" draggable={false} /> : null}
            <span>{source.name}</span>
          </a>
        );
      }) : null}
      {focus ? (
        <div className={`bubble-card ${focus.pinned ? 'pinned' : ''}`} style={{ left: Math.min(Math.max(focus.x, 130), (width || 260) - 130), top: Math.max(focus.y, 8) }} role="status">
          <div>
            <strong>{focus.source.name}</strong>
            {focus.source.category ? <small>{focus.source.category}</small> : null}
          </div>
          {focus.source.description ? <p>{focus.source.description}</p> : null}
          <span className="bubble-host">{hostOf(focus.source.url)}</span>
          {focus.pinned ? (
            <div className="bubble-card-actions">
              <a className="button primary small" href={focus.source.url} target="_blank" rel="noopener noreferrer">打开<ArrowUpRight aria-hidden="true" /></a>
              <button type="button" className="icon-button small" onClick={() => setFocus(null)} aria-label="关闭"><X aria-hidden="true" /></button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!sources.length ? <p className="bubble-empty">还没有收录网站。</p> : null}
    </div>
  );
});
