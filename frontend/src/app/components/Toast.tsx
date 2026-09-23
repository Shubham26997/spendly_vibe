"use client";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "loading";

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  duration?: number; // ms, 0 = no auto dismiss
}

export default function Toast({ message, type, onDismiss, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss
    if (duration > 0) {
      const t2 = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // wait for exit animation
      }, duration);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    return () => clearTimeout(t1);
  }, [duration, onDismiss]);

  const icons = {
    success: (
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    loading: (
      <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    ),
  };

  const borders = {
    success: "border-emerald-200 dark:border-emerald-800",
    error: "border-red-200 dark:border-red-800",
    loading: "border-indigo-200 dark:border-indigo-800",
  };

  return (
    <div
      className={`flex items-center gap-3 bg-white dark:bg-gray-900 border ${borders[type]} rounded-2xl shadow-xl px-4 py-3 min-w-[260px] max-w-[380px] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <span className="flex-shrink-0">{icons[type]}</span>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Toast container — place this at root layout level or page level ──
interface ToastItem { id: string; message: string; type: ToastType; duration?: number; }

interface ToastContainerProps { toasts: ToastItem[]; onDismiss: (id: string) => void; }

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} duration={t.duration} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
