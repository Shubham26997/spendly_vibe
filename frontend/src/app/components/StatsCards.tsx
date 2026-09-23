import { useEffect, useRef } from "react";
import type { ZoneResponse, SavingsPlan, Expense } from "../lib/api";

export type CardType = "expense" | "invest";

interface StatsCardsProps {
  zone: ZoneResponse | null;
  plan: SavingsPlan | null;
  totalSpent: number;
  expenses: Expense[];
  onCardClick?: (type: CardType) => void;
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function DonutRing({
  pct,
  stroke,
  size = 80,
  thickness = 9,
}: {
  pct: number;
  stroke: string;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circ * (1 - clamped / 100);
  const cx = size / 2;
  const cy = size / 2;

  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    // Start at full offset (empty), animate to target offset
    el.style.transition = "none";
    el.style.strokeDashoffset = `${circ}`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)";
        el.style.strokeDashoffset = `${offset}`;
      });
    });
  }, [pct]); // re-animate when pct changes

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor"
        strokeWidth={thickness} className="text-gray-100 dark:text-gray-800" />
      <circle ref={circleRef} cx={cx} cy={cy} r={r} fill="none" stroke={stroke}
        strokeWidth={thickness} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" />
    </svg>
  );
}

function Card({
  title,
  icon,
  pct,
  stroke,
  center,
  primary,
  secondary,
  tag,
  tagColor,
  onClick,
}: {
  title: string;
  icon: string;
  pct: number;
  stroke: string;
  center: string;
  primary: string;
  secondary: string;
  tag?: string;
  tagColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-3 shadow-sm text-left w-full transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
          {title}
        </span>
        <div className="flex items-center gap-1 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-xs font-medium">
          <span className="text-base">{icon}</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">Details →</span>
        </div>
      </div>

      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
        <div className="relative flex-shrink-0">
          <DonutRing pct={pct} stroke={stroke} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100">
              {center}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate tracking-tight">{primary}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{secondary}</p>
          {tag && (
            <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit mt-0.5 ${tagColor}`}>
              {tag}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function StatsCards({ zone, plan, totalSpent, expenses, onCardClick }: StatsCardsProps) {
  // ── Derived amounts ────────────────────────────────────────────
  const savingTotal = expenses.filter(e => e.category === "Saving").reduce((s, e) => s + e.amount, 0);
  const nonSavingSpent = Math.max(0, totalSpent - savingTotal);

  // ── Expense card ───────────────────────────────────────────────
  const spendScore = zone?.spend_score ?? 100;
  const spendUsedPct = Math.max(0, 100 - spendScore);
  const topOverspent = zone?.category_data
    ? Object.entries(zone.category_data)
        .filter(([cat, d]) => cat !== "Saving" && d.spent > d.budget && d.budget > 0)
        .sort(([, a], [, b]) => (b.spent - b.budget) - (a.spent - a.budget))[0]
    : null;

  const expenseStroke = spendUsedPct > 60 ? "#ef4444" : spendUsedPct > 35 ? "#f59e0b" : "#10b981";
  const expenseTag = spendUsedPct > 60 ? { label: "Overspending", cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" }
    : spendUsedPct > 35 ? { label: "Watch Out", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" }
    : { label: "In Budget", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" };

  // ── Investment card ────────────────────────────────────────────
  const targetSavePct = plan?.target_save_pct ?? 30;
  const investTotal = plan?.total_to_save ?? 0;
  const topAlloc = plan?.allocations?.[0];
  const investStroke = "#6366f1";
  const investDonePct = investTotal > 0
    ? Math.min(100, Math.round((savingTotal / investTotal) * 100))
    : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card
        title="Expense"
        icon="💸"
        pct={spendUsedPct}
        stroke={expenseStroke}
        center={`${Math.round(spendUsedPct)}%`}
        primary={fmt(nonSavingSpent)}
        secondary={topOverspent ? `⚠ ${topOverspent[0]} over` : `excl. investments`}
        tag={expenseTag.label}
        tagColor={expenseTag.cls}
        onClick={() => onCardClick?.("expense")}
      />

      <Card
        title="Invest"
        icon="📈"
        pct={investTotal > 0 ? investDonePct : targetSavePct}
        stroke={investStroke}
        center={investTotal > 0 ? `${investDonePct}%` : `${targetSavePct}%`}
        primary={investTotal > 0 ? `${fmt(savingTotal)} / ${fmt(investTotal)}` : `${targetSavePct}% goal`}
        secondary={investTotal > 0 ? "invested vs target" : topAlloc ? `→ ${topAlloc.instrument}` : "of monthly salary"}
        tag={investTotal > 0
          ? investDonePct >= 100 ? "Target Met" : investDonePct >= 70 ? "On Track" : "Behind"
          : "Set salary"}
        tagColor={investTotal > 0
          ? investDonePct >= 100
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
            : investDonePct >= 70
            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}
        onClick={() => onCardClick?.("invest")}
      />
    </div>
  );
}
