import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'error' | 'success' | 'info';
interface Toast { id: number; kind: ToastKind; message: string }
interface ConfirmState { message: string; resolve: (ok: boolean) => void }

interface UiContextType {
  notify: (message: string, kind?: ToastKind) => void;
  confirm: (message: string) => Promise<boolean>;
}

const UiContext = createContext<UiContextType | undefined>(undefined);

const toastStyle: Record<ToastKind, string> = {
  error: 'bg-brand-primary text-white',
  success: 'bg-green-600 text-white',
  info: 'bg-brand-secondary text-white'
};
const toastIcon: Record<ToastKind, React.ReactNode> = {
  error: <AlertCircle size={16} />,
  success: <CheckCircle2 size={16} />,
  info: <Info size={16} />
};

// Замена alert()/confirm(): уведомления и модальное подтверждение в стиле приложения
export const UiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const notify = useCallback((message: string, kind: ToastKind = 'error') => {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, kind, message }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const confirm = useCallback((message: string) => new Promise<boolean>(resolve => {
    setConfirmState({ message, resolve });
  }), []);

  const answer = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <UiContext.Provider value={{ notify, confirm }}>
      {children}

      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[200] space-y-2 pointer-events-none" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl animate-fade-in ${toastStyle[t.kind]}`}>
            <span className="mt-0.5 shrink-0">{toastIcon[t.kind]}</span>
            <p className="text-xs font-bold leading-snug flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Закрыть" className="opacity-70 hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl">
            <p className="text-sm font-black text-brand-secondary mb-6">{confirmState.message}</p>
            <div className="flex gap-3">
              <button onClick={() => answer(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200">Отмена</button>
              <button autoFocus onClick={() => answer(true)} className="flex-1 py-3 rounded-xl bg-brand-primary text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand-secondary">Да</button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
};

export const useUi = () => {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used within a UiProvider');
  return context;
};
