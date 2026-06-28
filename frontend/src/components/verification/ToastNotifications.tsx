import { useState, useEffect } from 'react';
import { X, CheckCircle, Info, AlertTriangle, Bell } from 'lucide-react';

import type { Toast } from '../../utils/toast';

export function ToastNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: Toast['type'] }>;
      const { message, type } = customEvent.detail;
      const newToast: Toast = {
        id: Math.random().toString(36).substring(2, 9),
        message,
        type
      };
      setToasts((prev) => [...prev, newToast]);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bgStyle = 'bg-slate-900/95 border-slate-800 text-slate-100';
        let Icon = Bell;
        if (toast.type === 'success') {
          bgStyle = 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400';
          Icon = CheckCircle;
        } else if (toast.type === 'warning') {
          bgStyle = 'bg-amber-950/90 border-amber-500/30 text-amber-400';
          Icon = AlertTriangle;
        } else if (toast.type === 'error') {
          bgStyle = 'bg-rose-950/90 border-rose-500/30 text-rose-450';
          Icon = AlertTriangle;
        } else if (toast.type === 'info') {
          bgStyle = 'bg-slate-900/95 border-slate-800 text-teal-400';
          Icon = Info;
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md pointer-events-auto animate-slideIn ${bgStyle}`}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] font-bold leading-snug">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
