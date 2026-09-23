"use client";

import { useEffect, useRef, useState } from "react";
import type { Expense } from "../lib/api";

interface RecentEntriesProps {
  expenses: Expense[];
}

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔",
  Grocery: "🛒",
  Travel: "🚌",
  Family: "👨‍👩‍👧",
  EMI: "🏦",
  Saving: "💰",
  Luxury: "✨",
  Health: "💊",
  House: "🏠",
  Other: "📦",
};

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function RecentEntries({ expenses }: RecentEntriesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);
  const [isManualPaused, setIsManualPaused] = useState<boolean>(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) return;

    let lastTs: number | null = null;
    const SPEED = 25;

    function onVisibility() {
      pausedRef.current = document.hidden;
    }
    document.addEventListener("visibilitychange", onVisibility);

    function step(ts: number) {
      if (!el) return;
      if (pausedRef.current || isManualPaused) {
        lastTs = null;
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (lastTs !== null) {
        el.scrollTop += (SPEED * (ts - lastTs)) / 1000;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          el.scrollTop = 0;
        }
      }
      lastTs = ts;
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expenses, isManualPaused]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Recent Entries
        </h2>
        {expenses.length > 0 && (
          <button
            onClick={() => setIsManualPaused((p) => !p)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2 py-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            title={isManualPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
            aria-label={isManualPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            <span>{isManualPaused ? "▶ Play" : "⏸ Pause"}</span>
          </button>
        )}
      </div>

      {expenses.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">No expenses logged yet.</p>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-y-auto recent-entries-scroll"
          style={{ maxHeight: "260px" }}
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = document.hidden;
          }}
        >
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/40 px-1 rounded-lg transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[e.category] ?? "📦"}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize truncate">{e.description}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                      {e.category} · {e.bank_name ? `${e.bank_name} · ` : ""}{formatDateTime(e.created_at)}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 flex-shrink-0">{fmt(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
