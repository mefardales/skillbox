import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const DURATIONS = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

// ── Single Toast Item ──
function ToastItem({ toast: t, onDismiss }) {
  const [state, setState] = useState('entering'); // entering | visible | exiting
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const remainingRef = useRef(t.duration);
  const frameRef = useRef(null);

  const Icon = ICONS[t.type] || ICONS.info;

  // Enter animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setState('visible'));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Progress bar + auto-dismiss
  useEffect(() => {
    if (paused || state === 'exiting') return;

    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const newRemaining = remainingRef.current - elapsed;
      const pct = Math.max(0, (newRemaining / t.duration) * 100);
      setProgress(pct);

      if (newRemaining <= 0) {
        handleDismiss();
      } else {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      // Save remaining time when pausing
      const elapsed = Date.now() - (startRef.current || Date.now());
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [paused, state]);

  const handleDismiss = useCallback(() => {
    if (state === 'exiting') return;
    setState('exiting');
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => onDismiss(t.id), 200);
  }, [state, onDismiss, t.id]);

  const accentColor = t.type === 'error' ? 'var(--destructive)'
    : t.type === 'success' ? 'var(--success)'
    : t.type === 'warning' ? 'var(--warning)'
    : 'var(--primary)';

  return (
    <div
      className={`
        group relative flex items-start gap-2.5 w-[340px] px-3 py-2.5
        bg-[var(--popover)] border border-[var(--border)]
        rounded-lg shadow-xl shadow-black/20
        transition-all duration-200 ease-out cursor-default
        ${state === 'entering' ? 'opacity-0 translate-x-[100%]' : ''}
        ${state === 'visible' ? 'opacity-100 translate-x-0' : ''}
        ${state === 'exiting' ? 'opacity-0 translate-x-[40px] scale-95' : ''}
      `}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="alert"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ background: accentColor }}
      />

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5" style={{ color: accentColor }}>
        <Icon size={16} strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-5">
        <p className="text-[13px] leading-snug text-[var(--foreground)]">
          {t.message}
        </p>
        {t.detail && (
          <p className="text-[12px] leading-snug text-[var(--muted-foreground)] mt-0.5 truncate">
            {t.detail}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        className="
          absolute top-2 right-2 p-0.5 rounded
          text-[var(--muted-foreground)] hover:text-[var(--foreground)]
          hover:bg-[var(--muted)] opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        "
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-[3px] right-0 h-[2px] rounded-b-lg overflow-hidden bg-transparent">
        <div
          className="h-full transition-none"
          style={{
            width: `${progress}%`,
            background: accentColor,
            opacity: 0.4,
          }}
        />
      </div>
    </div>
  );
}

// ── Toast Provider ──
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { addLog } = useStore();

  const toast = useCallback((message, type = 'info') => {
    let detail = null;

    // Support shadcn-style object: toast({ title, description, variant })
    if (message && typeof message === 'object') {
      type = message.variant === 'destructive' ? 'error' : (message.type || type);
      detail = message.description || null;
      message = message.title || message.description || JSON.stringify(message);
    }

    const id = ++toastId;
    const duration = DURATIONS[type] || 3000;

    setToasts(prev => {
      // Limit max visible toasts to 5
      const next = [...prev, { id, message: String(message), type, detail, duration }];
      return next.length > 5 ? next.slice(-5) : next;
    });

    // Auto-log every toast to platform logs
    const level = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
    addLog(level, 'system', String(message), detail);

    return id;
  }, [addLog]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Toast container — bottom-right stack */}
      <div className="fixed bottom-3 right-3 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
