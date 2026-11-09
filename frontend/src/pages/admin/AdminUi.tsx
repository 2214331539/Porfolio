import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'error';
type ToastItem = { id: number; message: string; tone: ToastTone };

type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
};
type ConfirmState = ConfirmOptions & { resolve: (accepted: boolean) => void };

export type PromptField = { name: string; label: string; value?: string; placeholder?: string; multiline?: boolean; required?: boolean; maxLength?: number };
type PromptOptions = { title: string; description?: string; fields: PromptField[]; confirmLabel?: string };
type PromptState = PromptOptions & { resolve: (values: Record<string, string> | null) => void };

export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; tone?: 'danger'; disabled?: boolean } | 'separator';
type MenuState = { x: number; y: number; alignRight: boolean; items: MenuItem[] };

type AdminUiContextValue = {
  hasUnsavedChanges: boolean;
  setEditorDirty: (dirty: boolean) => void;
  notify: (message: string, tone?: ToastTone) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  promptForm: (options: PromptOptions) => Promise<Record<string, string> | null>;
  openMenu: (anchor: HTMLElement | { x: number; y: number }, items: MenuItem[]) => void;
  runAfterDiscardCheck: (action: () => void) => void;
};

const AdminUiContext = createContext<AdminUiContextValue | null>(null);

/** Modal shell shared by confirmations, forms and pickers: backdrop click and Escape close it. */
export function Dialog({ title, description, onClose, children, footer, size = 'small', tone }: { title: string; description?: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode; size?: 'small' | 'medium'; tone?: 'danger' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, [data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('button.primary, button.danger');
    first?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className={`dialog ${size}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="dialog-head">
          {tone === 'danger' ? <span className="dialog-icon danger"><AlertTriangle aria-hidden="true" /></span> : null}
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description ? <div className="dialog-description">{description}</div> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X aria-hidden="true" /></button>
        </header>
        {children ? <div className="dialog-body">{children}</div> : null}
        {footer ? <footer className="dialog-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}

function PromptDialog({ state, onSettle }: { state: PromptState; onSettle: (values: Record<string, string> | null) => void }) {
  const [values, setValues] = useState(() => Object.fromEntries(state.fields.map((field) => [field.name, field.value ?? ''])));
  const invalid = state.fields.some((field) => field.required && !values[field.name]?.trim());
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!invalid) onSettle(values);
  }
  return (
    <Dialog title={state.title} description={state.description} onClose={() => onSettle(null)}>
      <form className="form-stack" onSubmit={submit}>
        {state.fields.map((field) => (
          <label className="field" key={field.name}>
            <span>{field.label}</span>
            {field.multiline
              ? <textarea rows={3} value={values[field.name]} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
              : <input value={values[field.name]} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}
          </label>
        ))}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={() => onSettle(null)}>取消</button>
          <button type="submit" className="button primary" disabled={invalid}>{state.confirmLabel ?? '保存'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: state.x, top: state.y });
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(state.alignRight ? state.x - width : state.x, window.innerWidth - width - 8));
    const top = state.y + height > window.innerHeight - 8 ? Math.max(8, state.y - height - 36) : state.y;
    setPosition({ left, top });
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [state]);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="menu" role="menu" style={position}>
      {state.items.map((item, index) => item === 'separator' ? <hr key={`sep-${index}`} /> : (
        <button key={`${index}-${item.label}`} type="button" role="menuitem" className={item.tone === 'danger' ? 'danger' : ''} disabled={item.disabled} onClick={() => { onClose(); item.onSelect(); }}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function AdminUiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [hasUnsavedChanges, setEditorDirty] = useState(false);
  const toastId = useRef(0);
  const timers = useRef<number[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++toastId.current;
    setToasts((items) => [...items.slice(-3), { id, message, tone }]);
    timers.current.push(window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), tone === 'error' ? 5200 : 2800));
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })), []);
  const settleConfirm = useCallback((accepted: boolean) => setConfirmState((current) => { current?.resolve(accepted); return null; }), []);
  const promptForm = useCallback((options: PromptOptions) => new Promise<Record<string, string> | null>((resolve) => setPromptState({ ...options, resolve })), []);
  const settlePrompt = useCallback((values: Record<string, string> | null) => setPromptState((current) => { current?.resolve(values); return null; }), []);
  const closeMenu = useCallback(() => setMenuState(null), []);
  const openMenu = useCallback((anchor: HTMLElement | { x: number; y: number }, items: MenuItem[]) => {
    if (anchor instanceof HTMLElement) {
      const rect = anchor.getBoundingClientRect();
      setMenuState({ x: rect.right, y: rect.bottom + 4, alignRight: true, items });
    } else setMenuState({ ...anchor, alignRight: false, items });
  }, []);

  const runAfterDiscardCheck = useCallback((action: () => void) => {
    if (!hasUnsavedChanges) { action(); return; }
    void confirmAction({ title: '放弃未保存的更改？', description: '当前页面还有未保存的内容，离开后这些更改将无法恢复。', confirmLabel: '放弃更改', tone: 'danger' })
      .then((accepted) => { if (accepted) { setEditorDirty(false); action(); } });
  }, [confirmAction, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  return (
    <AdminUiContext.Provider value={{ hasUnsavedChanges, setEditorDirty, notify, confirmAction, promptForm, openMenu, runAfterDiscardCheck }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} key={toast.id} role="status">
            {toast.tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : toast.tone === 'error' ? <AlertTriangle aria-hidden="true" /> : <Info aria-hidden="true" />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} aria-label="关闭提示"><X aria-hidden="true" /></button>
          </div>
        ))}
      </div>
      {confirmState ? (
        <Dialog
          title={confirmState.title}
          description={confirmState.description}
          tone={confirmState.tone === 'danger' ? 'danger' : undefined}
          onClose={() => settleConfirm(false)}
          footer={<>
            <button type="button" className="button" onClick={() => settleConfirm(false)}>取消</button>
            <button type="button" className={`button ${confirmState.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => settleConfirm(true)}>{confirmState.confirmLabel ?? '确认'}</button>
          </>}
        />
      ) : null}
      {promptState ? <PromptDialog state={promptState} onSettle={settlePrompt} /> : null}
      {menuState ? <ContextMenu state={menuState} onClose={closeMenu} /> : null}
    </AdminUiContext.Provider>
  );
}

export function useAdminUi() {
  const context = useContext(AdminUiContext);
  if (!context) throw new Error('useAdminUi must be used within AdminUiProvider');
  return context;
}

export function useAdminDirtyState(dirty: boolean) {
  const { setEditorDirty } = useAdminUi();
  useEffect(() => {
    setEditorDirty(dirty);
    return () => setEditorDirty(false);
  }, [dirty, setEditorDirty]);
}
