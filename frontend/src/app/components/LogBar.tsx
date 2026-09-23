"use client";

import { useRef, useState } from "react";
import { postExpense, confirmExpense } from "../lib/api";
import { ToastContainer } from "./Toast";
import type { ToastType } from "./Toast";

interface LogBarProps {
  onExpenseLogged?: () => void;
}

const SUGGESTIONS = [
  "480 Swiggy",
  "1042 Petrol",
  "500 Grocery",
  "150 Coffee",
];

export default function LogBar({ onExpenseLogged }: LogBarProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType; duration?: number }>>([]);
  const loadingToastId = useRef<string | null>(null);

  function addToast(message: string, type: ToastType, duration = 3000) {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, message, type, duration }]);
    return id;
  }

  function dismissToast(id: string) {
    setToasts((p) => p.filter((t) => t.id !== id));
  }

  function dismissLoadingToast() {
    if (loadingToastId.current) {
      dismissToast(loadingToastId.current);
      loadingToastId.current = null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    loadingToastId.current = addToast("Parsing\u2026", "loading", 0);

    // ── Step 1: parse + create expense(s) ───────────────────────
    let result: {
      status?: string;
      message?: string;
      expense_id?: string;
      category?: string;
      parsed?: { amount?: number; description?: string };
      count?: number;
      items?: Array<{ amount: number; description: string; category: string }>;
    };

    try {
      result = (await postExpense(text.trim())) as typeof result;
    } catch {
      dismissLoadingToast();
      setIsSubmitting(false);
      addToast("Server error. Is the API running?", "error", 4000);
      return;
    }

    if (result.status === "parse_failed") {
      dismissLoadingToast();
      setIsSubmitting(false);
      addToast(result.message ?? "Couldn't parse that. Try: '500 food, 200 auto'", "error", 4000);
      return;
    }

    // ── Multi-expense: already confirmed server-side ─────────────
    if (result.status === "multi_confirmed" && result.items) {
      const summary = result.items
        .map((i) => `\u20B9${i.amount} ${i.description}`)
        .join(" \u00B7 ");
      dismissLoadingToast();
      setIsSubmitting(false);
      addToast(`\u2713 ${result.count} entries: ${summary}`, "success", 3000);
      setText("");
      onExpenseLogged?.();
      return;
    }

    // ── Step 2: confirm single expense (web auto-confirms) ───────
    if (result.expense_id) {
      try {
        await confirmExpense(result.expense_id);
      } catch {
        dismissLoadingToast();
        setIsSubmitting(false);
        addToast("Saved, but confirmation failed. Tap refresh.", "error", 4000);
        onExpenseLogged?.();
        return;
      }
    }

    // ── Step 3: success ──────────────────────────────────────────
    const parsed = result.parsed;
    const successMsg = parsed
      ? `\u2713 \u20B9${parsed.amount ?? "?"} \u00B7 ${result.category ?? ""} \u00B7 ${parsed.description ?? ""}`
      : "\u2713 Logged!";

    dismissLoadingToast();
    setIsSubmitting(false);
    addToast(successMsg, "success", 3000);
    setText("");
    onExpenseLogged?.();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200/80 dark:border-gray-800 px-3 py-2.5 sm:px-4 sm:py-3 shadow-lg z-30 space-y-2">
      {/* Quick suggestions */}
      {!text && (
        <div className="flex items-center gap-1.5 overflow-x-auto w-full px-3 sm:px-4 lg:px-6 text-xs">
          <span className="text-gray-400 dark:text-gray-500 font-medium text-[11px] flex-shrink-0">Quick log:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex-shrink-0 text-[11px]"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full px-3 sm:px-4 lg:px-6 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. 480 swiggy · 1042 petrol on 10 June · 500 food, 200 auto"
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-inner"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting || !text.trim()}
          className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors flex-shrink-0 shadow-sm"
        >
          {isSubmitting ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            "Log"
          )}
        </button>
      </form>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
