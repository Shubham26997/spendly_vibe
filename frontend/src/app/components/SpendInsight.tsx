"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Expense, Bank } from "../lib/api";
import { deleteExpense, updateExpense } from "../lib/api";

interface SpendInsightProps {
  expenses: Expense[];
  banks: Bank[];
  onExpenseDeleted?: () => void;
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const CATEGORIES = ["Food", "Grocery", "Travel", "Family", "EMI", "Saving", "Luxury", "Health", "House", "Other"];

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔", Grocery: "🛒", Travel: "🚌", Family: "👨‍👩‍👧",
  EMI: "🏦", Saving: "💰", Luxury: "✨", Health: "💊", House: "🏠", Other: "📦",
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f97316", Grocery: "#22c55e", Travel: "#3b82f6", Family: "#a855f7",
  EMI: "#ef4444", Saving: "#10b981", Luxury: "#ec4899", Health: "#06b6d4", House: "#f59e0b", Other: "#94a3b8",
};

interface EditState {
  id: string;
  amount: number;
  description: string;
  category: string;
  bank_id: string | null;
}

interface EditExpenseModalProps {
  editState: EditState;
  banks: Bank[];
  saving: boolean;
  onChange: (next: EditState) => void;
  onSave: () => void;
  onClose: () => void;
}

function EditExpenseModal({ editState, banks, saving, onChange, onSave, onClose }: EditExpenseModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <div className={`relative w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transition-all duration-300 ease-out ${mounted ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Edit Expense</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
            <input
              type="number"
              min="1"
              step="any"
              value={editState.amount || ""}
              onChange={(ev) => onChange({ ...editState, amount: parseFloat(ev.target.value) || 0 })}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <input
              type="text"
              value={editState.description}
              onChange={(ev) => onChange({ ...editState, description: ev.target.value })}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Category selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onChange({ ...editState, category: cat })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    editState.category === cat
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400"
                  }`}
                >
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Bank selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bank</label>
            <select
              value={editState.bank_id ?? ""}
              onChange={(ev) => onChange({ ...editState, bank_id: ev.target.value || null })}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Unassigned</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !editState.description.trim() || editState.amount <= 0}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SpendInsight({ expenses, banks, onExpenseDeleted }: SpendInsightProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const catTotals: Record<string, number> = {};
  for (const e of expenses) {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  }

  const entries = Object.entries(catTotals)
    .filter(([, spent]) => spent > 0)
    .sort(([, a], [, b]) => b - a);

  const maxSpent = entries.length > 0 ? entries[0][1] : 1;
  const totalSpent = entries.reduce((s, [, spent]) => s + spent, 0);

  const expensesByCategory: Record<string, Expense[]> = {};
  for (const e of expenses) {
    if (!expensesByCategory[e.category]) expensesByCategory[e.category] = [];
    expensesByCategory[e.category].push(e);
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteExpense(id);
      onExpenseDeleted?.();
    } catch { /* parent refresh corrects state */ }
    finally { setDeletingId(null); }
  }

  function startEdit(e: Expense) {
    setConfirmDeleteId(null);
    setEditState({ id: e.id, amount: e.amount, description: e.description, category: e.category, bank_id: e.bank_id });
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    try {
      await updateExpense(editState.id, {
        amount: editState.amount,
        description: editState.description.trim(),
        category: editState.category,
        bank_id: editState.bank_id,
      });
      setEditState(null);
      onExpenseDeleted?.();
    } catch { /* silent — parent will stay in sync */ }
    finally { setSaving(false); }
  }

  return (
    <>
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Spend by Category
        </h2>
        {totalSpent > 0 && (
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            {fmt(totalSpent)} total
          </span>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map(([cat, spent]) => {
            const barPct = (spent / maxSpent) * 100;
            const sharePct = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
            const color = CATEGORY_COLORS[cat] ?? "#94a3b8";
            const isOpen = expanded === cat;
            const catExpenses = expensesByCategory[cat] ?? [];

            return (
              <div
                key={cat}
                className="rounded-xl overflow-hidden border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-colors"
                style={isOpen ? { borderLeft: `3px solid ${color}` } : { borderLeft: "3px solid transparent" }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : cat)}
                  className="w-full text-left px-2 py-2 space-y-1.5 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-xl cursor-pointer transition-colors duration-150"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{CATEGORY_ICONS[cat] ?? "📦"}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{cat}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{sharePct}%</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{fmt(spent)}</span>
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barPct}%`, backgroundColor: color }} />
                  </div>
                </button>

                {/* Accordion */}
                <div style={{ maxHeight: isOpen ? "600px" : "0px", overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
                  {catExpenses.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {catExpenses.map((e) => {
                          const isConfirming = confirmDeleteId === e.id;
                          const isDeleting = deletingId === e.id;

                          return (
                            <li key={e.id} className={`flex items-center justify-between px-3 py-2 gap-2 transition-opacity ${isDeleting ? "opacity-40" : ""}`}>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize truncate">{e.description}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatDate(e.expense_date)}{e.bank_name ? ` · ${e.bank_name}` : ""}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{fmt(e.amount)}</span>

                                {isConfirming ? (
                                  <div className="flex gap-1.5 animate-fade-scale">
                                    <button onClick={() => handleDelete(e.id)} disabled={isDeleting}
                                      className="text-xs font-bold px-3 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">
                                      Delete
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs font-bold px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition-colors">
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {/* Edit button */}
                                    <button
                                      onClick={() => startEdit(e)}
                                      title="Edit entry"
                                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {/* Delete button */}
                                    <button
                                      onClick={() => handleDelete(e.id)}
                                      disabled={isDeleting}
                                      title="Delete entry"
                                      className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800">
                        {catExpenses.length} {catExpenses.length === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
          No expenses logged this month yet.
        </p>
      )}
    </div>

    {editState && (
      <EditExpenseModal
        editState={editState}
        banks={banks}
        saving={saving}
        onChange={setEditState}
        onSave={saveEdit}
        onClose={() => setEditState(null)}
      />
    )}
    </>
  );
}
