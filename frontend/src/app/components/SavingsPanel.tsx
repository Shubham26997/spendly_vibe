"use client";

import { useEffect, useRef, useState } from "react";
import type { SavingsPlan, Expense } from "../lib/api";

interface SavingsPanelProps {
  salary: number;
  totalSpent: number;
  plan: SavingsPlan | null;
  expenses: Expense[];
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) {
      setDisplay(target);
      return;
    }

    let rafId: number;
    const startTime = performance.now();
    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(start + diff * eased);
      setDisplay(nextVal);

      if (progress < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        prev.current = target;
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      prev.current = target;
    };
  }, [target, duration]);

  return display;
}

export default function SavingsPanel({ salary, totalSpent, plan, expenses }: SavingsPanelProps) {
  const savingTotal = expenses.filter(e => e.category === "Saving").reduce((s, e) => s + e.amount, 0);
  const nonSavingSpent = Math.max(0, totalSpent - savingTotal);
  const walletLeft = Math.max(0, salary - totalSpent);
  const targetSave = plan?.total_to_save ?? salary * 0.30;

  // Percentages of salary for the stacked bar
  const investedPct = salary > 0 ? Math.min(100, (savingTotal / salary) * 100) : 0;
  const spentPct    = salary > 0 ? Math.min(100 - investedPct, (nonSavingSpent / salary) * 100) : 0;
  const leftPct     = salary > 0 ? Math.max(0, (walletLeft / salary) * 100) : 100;

  const savePct = targetSave > 0 ? Math.min(100, Math.round((savingTotal / targetSave) * 100)) : 0;

  // Count-up animations for the three main values
  const displayLeft = useCountUp(walletLeft);
  const displayInvested = useCountUp(savingTotal);
  const displaySpent = useCountUp(nonSavingSpent);

  // Mount animation for segmented bar
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/30 p-5 shadow-[0_8px_24px_rgba(99,102,241,0.08)] backdrop-blur-sm dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-gray-900 dark:to-indigo-950/20">
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-200/10 blur-3xl dark:bg-indigo-600/10 pointer-events-none" />
      <div className="relative z-10 space-y-4">
        {/* Header with Wallet Overview */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Wallet Overview
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{fmt(displayLeft)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/80 px-4 py-2 text-center shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Savings Goal</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{savePct}%</p>
            </div>
          </div>
        </div>

        {/* Main Segmented Progress Bar */}
        <div className="flex gap-1.5 h-10 w-full rounded-full overflow-hidden bg-gray-100/70 dark:bg-gray-800/70 p-1.5 shadow-inner">
          {investedPct > 0 && (
            <div
              className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{
                width: mounted ? `${investedPct}%` : '0%',
                background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
                transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              title={`Invested: ${fmt(savingTotal)} (${investedPct.toFixed(1)}%)`}
            >
              {investedPct >= 15 ? `📈 ${investedPct.toFixed(0)}%` : investedPct >= 8 ? "📈" : ""}
            </div>
          )}
          {spentPct > 0 && (
            <div
              className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{
                width: mounted ? `${spentPct}%` : '0%',
                background: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
                transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              title={`Spent: ${fmt(nonSavingSpent)} (${spentPct.toFixed(1)}%)`}
            >
              {spentPct >= 15 ? `💸 ${spentPct.toFixed(0)}%` : spentPct >= 8 ? "💸" : ""}
            </div>
          )}
          {leftPct > 0 && (
            <div
              className="flex-1 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)" }}
              title={`Wallet Left: ${fmt(walletLeft)} (${leftPct.toFixed(1)}%)`}
            >
              {leftPct >= 15 ? `✓ ${leftPct.toFixed(0)}%` : leftPct >= 8 ? "✓" : ""}
            </div>
          )}
        </div>

        {/* Aligned Stats Row */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Invest Card */}
          <div className="rounded-xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 to-indigo-50/20 p-3 transition-all hover:shadow-md dark:border-indigo-900/40 dark:from-indigo-950/40 dark:to-indigo-950/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)" }} />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Invested</p>
            </div>
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{fmt(displayInvested)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{investedPct.toFixed(1)}% of salary</p>
          </div>

          {/* Spent Card */}
          <div className="rounded-xl border border-orange-200/50 bg-gradient-to-br from-orange-50/60 to-orange-50/20 p-3 transition-all hover:shadow-md dark:border-orange-900/40 dark:from-orange-950/40 dark:to-orange-950/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)" }} />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Spent</p>
            </div>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{fmt(displaySpent)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{spentPct.toFixed(1)}% of salary</p>
          </div>

          {/* Save Goal Card */}
          <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/60 to-emerald-50/20 p-3 transition-all hover:shadow-md dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-emerald-950/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)" }} />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Save Goal</p>
            </div>
            {targetSave > 0 ? (
              <>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{savePct}%</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                  {savingTotal >= targetSave ? "Target met 🎉" : `${fmt(Math.max(0, targetSave - savingTotal))} needed`}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmt(displayLeft)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{leftPct.toFixed(1)}% left</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
