import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';

export type SaveState = { kind: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'; at?: Date; message?: string };

export function SaveIndicator({ state, autosave }: { state: SaveState; autosave: boolean }) {
  const text = state.kind === 'saving' ? '保存中…'
    : state.kind === 'error' ? `保存失败：${state.message ?? '请重试'}`
    : state.kind === 'dirty' ? autosave ? '编辑中' : '有未发布的改动'
    : state.kind === 'saved' && state.at ? `已保存 ${String(state.at.getHours()).padStart(2, '0')}:${String(state.at.getMinutes()).padStart(2, '0')}`
    : '已保存';
  return <span className={`save-indicator ${state.kind}`} role="status" aria-live="polite"><i aria-hidden="true" />{text}</span>;
}

/** Slim editor top bar: back, location, save state and actions. */
export function EditorTopBar({ backLabel, onBack, crumbs, status, children }: { backLabel: string; onBack: () => void; crumbs: string[]; status: ReactNode; children: ReactNode }) {
  return (
    <header className="editor-topbar">
      <button type="button" className="button ghost small" onClick={onBack}><ArrowLeft aria-hidden="true" />{backLabel}</button>
      <nav className="editor-crumbs" aria-label="所在仓库">
        {crumbs.map((crumb, index) => <span key={`${crumb}-${index}`}>{index ? <ChevronRight aria-hidden="true" /> : null}{crumb}</span>)}
      </nav>
      {status}
      <div className="editor-actions">{children}</div>
    </header>
  );
}

/** Icon button that opens a small floating panel; closes on outside click or Escape. */
export function Popover({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!ref.current?.contains(target) && !target.closest('.menu')) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer, true); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className={`icon-button ${open ? 'active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={label} title={label}>{icon}</button>
      {open ? <div className="popover" role="dialog" aria-label={label}>{children}</div> : null}
    </div>
  );
}

/** One Notion-style property line under the title: a quiet label and an unboxed value. */
export function Property({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="doc-prop">
      <span className="doc-prop-key">{icon}{label}</span>
      <div className="doc-prop-value">{children}</div>
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return (
    <label className="switch-row">
      <span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

/** Inline tags: Enter, comma or Tab adds one; Backspace on an empty input removes the last. */
export function TagInput({ value, onChange, placeholder, suggestions = [], max = 12, id }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string; suggestions?: string[]; max?: number; id?: string }) {
  const [draft, setDraft] = useState('');
  const listId = `${id ?? 'tags'}-suggestions`;
  function commit(raw: string) {
    const names = raw.split(/[,，\n]/).map((item) => item.trim().replace(/^#/, '')).filter(Boolean);
    if (!names.length) return;
    onChange([...new Set([...value, ...names])].slice(0, max));
    setDraft('');
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',' || event.key === '，' || (event.key === 'Tab' && draft.trim())) { event.preventDefault(); commit(draft); }
    if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  }
  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span className="tag-chip" key={tag}>{tag}<button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} aria-label={`移除${tag}`}><X aria-hidden="true" /></button></span>
      ))}
      {value.length < max ? (
        <input id={id} value={draft} list={suggestions.length ? listId : undefined} onChange={(event) => { if (/[,，]/.test(event.target.value)) commit(event.target.value); else setDraft(event.target.value); }} onKeyDown={onKeyDown} onBlur={() => commit(draft)} placeholder={value.length ? '' : placeholder} aria-label="添加标签" />
      ) : null}
      {suggestions.length ? <datalist id={listId}>{suggestions.filter((item) => !value.includes(item)).map((item) => <option key={item} value={item} />)}</datalist> : null}
    </div>
  );
}

/** Borderless textarea that grows with its content. */
export function AutoTextarea({ value, onChange, className, placeholder, maxLength, ariaLabel, onEnter, autoFocus }: { value: string; onChange: (value: string) => void; className?: string; placeholder?: string; maxLength?: number; ariaLabel: string; onEnter?: () => void; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element) { element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`; }
  }, [value]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel}
      onChange={(event) => onChange(onEnter ? event.target.value.replace(/\n/g, '') : event.target.value)}
      onKeyDown={(event) => { if (onEnter && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onEnter(); } }}
    />
  );
}
