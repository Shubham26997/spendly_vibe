"use client";

import { useEffect, useState } from "react";
import type { ZoneResponse, SavingsPlan, Expense, InvestmentInsight } from "../lib/api";
import { fetchInvestmentInsight } from "../lib/api";

type CardType = "expense" | "invest";

interface CardModalProps {
  type: CardType;
  onClose: () => void;
  zone: ZoneResponse | null;
  plan: SavingsPlan | null;
  expenses: Expense[];
  month: number;
  year: number;
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔", Grocery: "🛒", Travel: "🚌", Family: "👨‍👩‍👧",
  EMI: "🏦", Saving: "💰", Luxury: "✨", Other: "📦",
};

// ── Expense card detail ───────────────────────────────────────────────────────
function ExpenseDetail({ expenses, zone }: { expenses: Expense[]; zone: ZoneResponse | null }) {
  const nonSavingExpenses = expenses.filter((e) => e.category !== "Saving");
  const byCategory: Record<string, { entries: Expense[]; total: number }> = {};
  for (const e of nonSavingExpenses) {
    if (!byCategory[e.category]) byCategory[e.category] = { entries: [], total: 0 };
    byCategory[e.category].entries.push(e);
    byCategory[e.category].total += e.amount;
  }
  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b.total - a.total);

  return (
    <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No expenses logged this month.</p>
      )}
      {sorted.map(([cat, { entries, total }]) => {
        const budget = zone?.category_data?.[cat]?.budget ?? 0;
        const over = budget > 0 && total > budget;
        return (
          <div key={cat} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className={`flex items-center justify-between px-3 py-2 ${over ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-800"}`}>
              <span className="flex items-center gap-2 font-medium text-sm text-gray-700 dark:text-gray-300">
                <span>{CATEGORY_ICONS[cat] ?? "📦"}</span>
                {cat}
                {over && <span className="text-xs text-red-500 font-semibold">over budget</span>}
              </span>
              <span className={`text-sm font-bold ${over ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>{fmt(total)}</span>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-3 py-1.5">
                  <div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 capitalize">{e.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{e.expense_date}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{fmt(e.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ── Assessment badge colours ──────────────────────────────────────────────────
const ASSESSMENT_STYLE: Record<string, { badge: string; border: string; icon: string }> = {
  GOOD:             { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", icon: "✅" },
  MODERATE:         { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",         border: "border-amber-200 dark:border-amber-800",   icon: "⚠️" },
  NEEDS_ATTENTION:  { badge: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",                 border: "border-red-200 dark:border-red-800",        icon: "🔴" },
};

// ── Invest card detail ────────────────────────────────────────────────────────
function InvestDetail({
  plan,
  savingExpenses,
  actualSaved,
  month,
  year,
}: {
  plan: SavingsPlan | null;
  savingExpenses: Expense[];
  actualSaved: number;
  month: number;
  year: number;
}) {
  const [insight, setInsight] = useState<InvestmentInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getInsight() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInvestmentInsight(month, year);
      setInsight(result);
    } catch {
      setError("Could not generate insight. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!plan) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
        No savings plan yet. Set your salary in Settings.
      </p>
    );
  }

  const target = plan.total_to_save;
  const donePct = target > 0 ? Math.min(100, Math.round((actualSaved / target) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Progress vs target */}
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmt(actualSaved)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">saved so far this month</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{fmt(target)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">target ({plan.target_save_pct}% of salary)</p>
          </div>
        </div>
        <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${donePct >= 100 ? "bg-emerald-500" : donePct >= 70 ? "bg-indigo-500" : "bg-amber-400"}`}
            style={{ width: `${donePct}%` }}
          />
        </div>
        <p className="text-xs text-right text-gray-400 dark:text-gray-500">{donePct}% of target achieved</p>
      </div>

      {/* Saving category logs */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Saving Logs This Month
          {actualSaved > 0 && (
            <span className="ml-2 normal-case font-normal text-indigo-500 dark:text-indigo-400">
              · {fmt(actualSaved)} logged
            </span>
          )}
        </p>
        {savingExpenses.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-3">
            No saving entries yet. Log like: <span className="font-mono text-xs">&ldquo;5000 ppf deposit&rdquo;</span>
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {savingExpenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{e.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{e.expense_date}</p>
                </div>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI Insight section */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
        <button
          onClick={getInsight}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analysing allocation…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {insight ? "Refresh AI Insight" : "Get Investment Insight"}
            </>
          )}
        </button>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}

        {insight && (() => {
          const style = ASSESSMENT_STYLE[insight.assessment] ?? ASSESSMENT_STYLE.MODERATE;
          return (
            <div className={`border ${style.border} rounded-2xl p-4 space-y-3`}>
              {/* Header */}
              <div className="flex items-center gap-2">
                <span className="text-lg">{style.icon}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                  {insight.assessment.replace("_", " ")}
                </span>
              </div>

              {/* Summary */}
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{insight.summary}</p>

              {/* Allocation review */}
              {insight.allocation_review && (
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-2">
                  <span className="font-semibold">Allocation: </span>{insight.allocation_review}
                </p>
              )}

              {/* Priority action */}
              {insight.priority_action && (
                <div className={`rounded-xl px-3 py-2 ${style.badge}`}>
                  <p className="text-xs font-semibold">Priority Action</p>
                  <p className="text-sm font-bold mt-0.5">{insight.priority_action}</p>
                </div>
              )}

              {/* Action items */}
              {insight.action_items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Next Steps</p>
                  {insight.action_items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-indigo-400 font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
const TITLES: Record<CardType, string> = {
  expense: "Expense Detail",
  invest: "Investment Plan",
};

export default function CardModal({
  type, onClose, zone, plan, expenses, month, year,
}: CardModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const savingExpenses = expenses.filter((e) => e.category === "Saving");
  const actualSaved = savingExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <div className={`relative w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transition-all duration-300 ease-out ${mounted ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 id="card-modal-title" className="text-base font-bold text-gray-900 dark:text-gray-100">{TITLES[type]}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 flex-1">
          {type === "expense" && <ExpenseDetail expenses={expenses} zone={zone} />}
          {type === "invest" && (
            <InvestDetail
              plan={plan}
              savingExpenses={savingExpenses}
              actualSaved={actualSaved}
              month={month}
              year={year}
            />
          )}
        </div>
      </div>
    </div>
  );
}
