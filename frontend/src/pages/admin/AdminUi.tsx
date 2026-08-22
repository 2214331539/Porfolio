import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'error';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ConfirmState = ConfirmOptions & {
  resolve: (accepted: boolean) => void;
};

type AdminUiContextValue = {
  hasUnsavedChanges: boolean;
  setEditorDirty: (dirty: boolean) => void;
  notify: (message: string, tone?: ToastTone) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  runAfterDiscardCheck: (action: () => void) => void;
};

const AdminUiContext = createContext<AdminUiContextValue | null>(null);

export function AdminUiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [hasUnsavedChanges, setEditorDirty] = useState(false);
  const toastId = useRef(0);
  const timers = useRef<number[]>([]);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++toastId.current;
    setToasts((items) => [...items, { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3200);
    timers.current.push(timer);
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmState({ ...options, resolve });
  }), []);

  const settleConfirm = useCallback((accepted: boolean) => {
    setConfirmState((current) => {
      current?.resolve(accepted);
      return null;
    });
  }, []);

  const runAfterDiscardCheck = useCallback((action: () => void) => {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    void confirmAction({
      title: '放弃未保存的更改？',
      description: '当前页面还有未保存的内容。离开后，这些更改将无法恢复。',
      confirmLabel: '放弃更改',
      tone: 'danger',
    }).then((accepted) => {
      if (!accepted) return;
      setEditorDirty(false);
      action();
    });
  }, [confirmAction, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!confirmState) return;
    confirmButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settleConfirm(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [confirmState, settleConfirm]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  return (
    <AdminUiContext.Provider value={{ hasUnsavedChanges, setEditorDirty, notify, confirmAction, runAfterDiscardCheck }}>
      <div className="admin-ui-root">
        {children}
        <div className="admin-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`admin-toast ${toast.tone}`} key={toast.id} role="status">
            {toast.tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : toast.tone === 'error' ? <AlertTriangle aria-hidden="true" /> : <Info aria-hidden="true" />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} aria-label="关闭提示"><X /></button>
          </div>
        ))}
        </div>
        {confirmState ? (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) settleConfirm(false);
        }}>
          <section className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title" aria-describedby="admin-dialog-description">
            <div className={`admin-dialog-icon ${confirmState.tone === 'danger' ? 'danger' : ''}`}><AlertTriangle aria-hidden="true" /></div>
            <div>
              <h2 id="admin-dialog-title">{confirmState.title}</h2>
              <p id="admin-dialog-description">{confirmState.description}</p>
            </div>
            <div className="admin-dialog-actions">
              <button type="button" className="admin-button secondary" onClick={() => settleConfirm(false)}>取消</button>
              <button ref={confirmButtonRef} type="button" className={`admin-button ${confirmState.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => settleConfirm(true)}>{confirmState.confirmLabel ?? '确认'}</button>
            </div>
          </section>
        </div>
        ) : null}
      </div>
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
