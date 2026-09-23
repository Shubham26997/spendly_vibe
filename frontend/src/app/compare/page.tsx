"use client";

import { useEffect, useState, useRef } from "react";
import {
  fetchExpenses,
  fetchMonthlyHistory,
  sendChatMessage,
  type Expense,
  type MonthlySummary,
} from "../lib/api";

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function parseBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-extrabold text-gray-900 dark:text-gray-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-xs leading-6 text-gray-700 dark:text-gray-200 font-medium">
      {lines.map((line, idx) => {
        // Headings: ### Title or ## Title or # Title
        if (line.startsWith("#")) {
          const level = line.match(/^#+/)?.[0].length ?? 1;
          const content = line.replace(/^#+\s*/, "");
          const textClass =
            level === 1
              ? "text-base font-extrabold mt-4 text-gray-900 dark:text-gray-100"
              : level === 2
              ? "text-sm font-extrabold mt-3 text-gray-950 dark:text-gray-50"
              : "text-xs font-extrabold mt-2 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide";
          return (
            <div key={idx} className={textClass}>
              {content}
            </div>
          );
        }

        // Bullet point: - Item or * Item
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.substring(2);
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <span className="text-indigo-500">•</span>
              <span>{parseBoldText(content)}</span>
            </div>
          );
        }

        // Empty line
        if (line.trim() === "") {
          return <div key={idx} className="h-1.5" />;
        }

        // Normal line (parse **bold**)
        return <p key={idx}>{parseBoldText(line)}</p>;
      })}
    </div>
  );
}

const ZONE_BADGE: Record<string, string> = {
  SAFE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  DANGER: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

import { useAuth } from "../context/AuthContext";
import { AuthModal } from "../components/AuthModal";

export default function ComparePage() {
  const { user, loading: authLoading } = useAuth();
  const [allData, setAllData] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [compareKeys, setCompareKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const history = await fetchMonthlyHistory();
        setAllData(history);
        if (history.length > 0) {
          const latestKey = `${history[history.length - 1].month}-${history[history.length - 1].year}`;
          setSelectedMonthKey(latestKey);
        }
      } catch {
        setError("Could not load monthly history.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }


  function toggleCompare(key: string) {
    setCompareKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const focusedData = allData.find((d) => `${d.month}-${d.year}` === selectedMonthKey) ?? allData[allData.length - 1] ?? null;
  const compareData = allData.filter((d) => compareKeys.has(`${d.month}-${d.year}`));

  return (
    <main className="w-full px-3 sm:px-4 lg:px-6 py-8 space-y-8 animate-fade-scale">
      {/* Title section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Monthly Comparison</h1>
        <p className="text-sm text-gray-500 dark:text-gray-450">
          Pick months to view details and select multiple months to perform side-by-side analysis with AI insights.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500">
          <svg className="animate-spin h-6 w-6 mr-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="font-medium">Loading history...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-2xl p-4 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {!loading && allData.length === 0 && !error && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-16 text-center space-y-3 shadow-sm">
          <p className="text-5xl">📊</p>
          <p className="font-bold text-gray-800 dark:text-gray-200 text-lg">No history yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
            Log expenses across multiple months, and they will appear here for robust analysis and comparison.
          </p>
        </div>
      )}

      {!loading && allData.length > 0 && (
        <>
          {/* Months selection grid */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Available Months
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allData.map((d) => {
                const key = `${d.month}-${d.year}`;
                const isSelected = selectedMonthKey === key;
                const isCompared = compareKeys.has(key);

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedMonthKey(key)}
                    className={`cursor-pointer rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all select-none hover:shadow-sm ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20"
                        : "border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/60 hover:border-gray-200 dark:hover:border-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                        {d.month_label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare(key);
                        }}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                          isCompared
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-750"
                        }`}
                      >
                        {isCompared ? "✓ Comparing" : "+ Compare"}
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <div className="text-gray-555 dark:text-gray-450">
                        Spent: <span className="font-bold text-gray-700 dark:text-gray-300">{fmt(d.total_spent)}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Viewing
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Help Banner if less than 2 months are being compared */}
          {compareKeys.size < 2 && (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50/40 dark:bg-slate-900/20 p-5 text-center transition-all animate-fade-scale">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 <strong>Tip:</strong> Click the <strong className="text-indigo-600 dark:text-indigo-400">+ Compare</strong> button on 2 or more months above to display side-by-side trends and generate AI-powered comparison insights.
              </p>
            </div>
          )}

          {/* Global AI comparison report panel */}
          {compareData.length >= 2 && (
            <div className="space-y-3 transition-all animate-fade-scale">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Global Comparison Analyzer
              </p>
              <ComparisonInsightsPanel chartData={compareData} />
            </div>
          )}

          {/* Focused Month View */}
          {focusedData && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Selected Month Report
              </p>
              <MonthlyDetailReport summary={focusedData} />
            </div>
          )}

          {/* Side-by-side comparison panels */}
          {compareData.length >= 2 && (
            <div className="space-y-4 pt-4 transition-all animate-fade-scale">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Side-by-Side Detailed Breakdown
              </p>
              <div className="grid gap-6 xl:grid-cols-2">
                {compareData.map((d) => (
                  <MonthlyDetailReport key={`${d.month}-${d.year}`} summary={d} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function MonthlyDetailReport({ summary }: { summary: MonthlySummary }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const insightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoadingExpenses(true);
      const items = await fetchExpenses(summary.month, summary.year);
      setExpenses(items);
      setLoadingExpenses(false);
    }
    load();
  }, [summary.month, summary.year]);

  useEffect(() => {
    if (insight && insightRef.current) {
      insightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [insight]);

  const byCategory = getCategoryBreakdown(expenses);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    setSelectedCategory("All");
  }, [summary.month, summary.year]);

  const filteredExpenses = selectedCategory === "All"
    ? expenses
    : expenses.filter((exp) => exp.category === selectedCategory);

  const totalSpent = expenses.filter((exp) => exp.category !== "Saving").reduce((sum, exp) => sum + Number(exp.amount), 0);
  const totalSavings = expenses.filter((exp) => exp.category === "Saving").reduce((sum, exp) => sum + Number(exp.amount), 0);

  async function askAiForReport() {
    if (summary.salary === 0) {
      setInsight("Since no salary has been set yet for the month, please add your monthly salary in the Settings page. Once configured, a suggested saving target of 30% is recommended.");
      return;
    }
    setLoading(true);
    try {
      const categorySummary = byCategory.map((row) => `${row.name}: ₹${row.value.toFixed(0)} (${row.percent}%)`).join(" | ");
      const expenseLines = expenses.slice(0, 12).map((exp) => `${exp.expense_date} | ${exp.category} | ${exp.description} | ₹${Number(exp.amount).toFixed(0)}`).join("\n");
      const prompt = `Generate a detailed financial report for ${summary.month_label}. Focus on what went well, what went wrong, and what should improve. Treat House, Family, and Grocery as mandatory essentials and only flag them when they rise sharply versus the previous month. Summary: salary ₹${summary.salary}, total spent ₹${totalSpent}, saving category ₹${totalSavings}, total report spend ₹${totalSpent + totalSavings}. Category breakdown: ${categorySummary}. Expense list:\n${expenseLines || "No expenses recorded."}`;
      const reply = await sendChatMessage(prompt, [], summary.month, summary.year);
      setInsight(reply);
    } catch {
      setInsight("I could not generate the month insight right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-5">
      {/* Month Card Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-gray-800 pb-3">
        <div>
          <p className="font-extrabold text-gray-900 dark:text-gray-100 text-lg leading-tight">{summary.month_label}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              summary.zone ? (ZONE_BADGE[summary.zone] ?? ZONE_BADGE.SAFE) : ZONE_BADGE.SAFE
            }`}>
              Zone {summary.zone ?? "SAFE"}
            </span>
          </div>
        </div>
        <button
          onClick={askAiForReport}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 animate-fade-scale"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>✨ AI report</>
          )}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        {[
          { label: "Salary", value: formatCurrency(summary.salary), color: "text-indigo-600 dark:text-indigo-400" },
          { label: "Spent", value: formatCurrency(totalSpent), color: "text-red-500 dark:text-red-400" },
          { label: "Saved", value: formatCurrency(totalSavings), color: "text-emerald-600 dark:text-emerald-450" },
          { label: "Saving Score", value: summary.saving_score !== null ? `${summary.saving_score}%` : "—", color: "text-amber-600 dark:text-amber-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl bg-gray-50/50 dark:bg-gray-900/60 border border-gray-100/50 dark:border-gray-800 p-2.5">
            <p className="text-[9px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
            <p className={`mt-1 text-sm font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Category Mix Block */}
      <div className="space-y-4">
        <div className="rounded-3xl bg-slate-50/60 dark:bg-slate-900/40 p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Category Mix</p>
            <span className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
              {selectedCategory === "All"
                ? "All categories"
                : `${selectedCategory} selected (${byCategory.find((c) => c.name === selectedCategory)?.percent ?? 0}%)`}
            </span>
          </div>
          <div className="flex justify-center">
            <PieChart3D data={byCategory} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
          </div>
        </div>

        {/* AI Report Card (Placed above transactions list for prime visibility) */}
        {loading && (
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/10 dark:bg-indigo-950/5 p-4 space-y-3 animate-pulse">
            <div className="h-2.5 bg-indigo-200 dark:bg-indigo-900/60 rounded-full w-24"></div>
            <div className="space-y-2">
              <div className="h-2 bg-indigo-150 dark:bg-indigo-950/60 rounded-full w-full"></div>
              <div className="h-2 bg-indigo-150 dark:bg-indigo-950/60 rounded-full w-5/6"></div>
              <div className="h-2 bg-indigo-150 dark:bg-indigo-950/60 rounded-full w-4/5"></div>
            </div>
          </div>
        )}

        {insight && !loading && (
          <div ref={insightRef} className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/35 dark:bg-indigo-950/15 p-5 space-y-2.5 animate-fade-scale shadow-xs">
            <div className="flex items-center gap-2 border-b border-indigo-100 dark:border-indigo-900 pb-1.5">
              <span className="text-base leading-none">✨</span>
              <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Month AI Insight Report</p>
            </div>
            <MarkdownRenderer text={insight} />
          </div>
        )}

        {/* Unified Transactions List */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Transactions List {selectedCategory !== "All" && `(${selectedCategory})`}
            </p>
            <span className="text-[10px] text-gray-400 font-medium">
              {loadingExpenses ? "..." : `${filteredExpenses.length} item(s)`}
            </span>
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm chat-scroll">
            {loadingExpenses ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Loading transactions...</span>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-450 dark:text-gray-500 font-medium">
                No expenses for this category in the selected month.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-450 dark:text-gray-500 font-bold uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredExpenses.map((item) => {
                    const categoryColor = getCategoryColor(item.category);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(item.expense_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${categoryColor}1A`,
                              borderColor: `${categoryColor}55`,
                              color: categoryColor,
                            }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200 font-medium">{item.description}</td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-gray-900 dark:text-gray-100">{formatCurrency(Number(item.amount))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonInsightsPanel({ chartData }: { chartData: MonthlySummary[] }) {
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const globalInsightRef = useRef<HTMLDivElement>(null);

  async function onGenerate() {
    setLoading(true);
    try {
      const comparisons = await Promise.all(
        chartData.map(async (item) => {
          const monthExpenses = await fetchExpenses(item.month, item.year);
          const totals = getCategoryBreakdown(monthExpenses);
          return `${item.month_label}: salary ${formatCurrency(item.salary)}; spent ${formatCurrency(item.total_spent)}; saved ${formatCurrency(item.total_saved)}; category mix ${totals.map((cat) => `${cat.name} ${formatCurrency(cat.value)}`).join(", ")}`;
        })
      );

      const prompt = `Compare these months and tell me what went wrong, what went well, and what should improve. Keep House, Family, and Grocery as mandatory essentials; only raise an alert if they jumped sharply versus the previous month. Here are the month snapshots: ${comparisons.join("; ")}`;
      const reply = await sendChatMessage(prompt, [], chartData[0]?.month, chartData[0]?.year);
      setInsight(reply);
    } catch {
      setInsight("The comparison insight could not be generated right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (insight && globalInsightRef.current) {
      globalInsightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [insight]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5 transition-all">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-850 pb-3">
        <p className="font-extrabold text-gray-800 dark:text-gray-200 text-sm">Cross-Month Intelligence Analysis</p>
        <button
          onClick={onGenerate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analyzing Comparisons...
            </>
          ) : (
            <>📊 Generate Global Insight</>
          )}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {chartData.map((d) => (
          <div key={`${d.month}-${d.year}`} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/60 p-4 space-y-2">
            <p className="font-bold text-gray-800 dark:text-gray-200 text-xs">{d.month_label}</p>
            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <p>Salary: <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(d.salary)}</span></p>
              <p>Spent: <span className="font-bold text-red-500">{formatCurrency(d.total_spent)}</span></p>
              <p>Saved: <span className="font-bold text-emerald-500">{formatCurrency(d.total_saved)}</span></p>
              <p>Zone: <span className="font-semibold text-gray-700 dark:text-gray-300">{d.zone ?? "SAFE"}</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Global AI Loading Skeleton */}
      {loading && (
        <div className="rounded-2xl border border-indigo-150 dark:border-indigo-900 bg-indigo-50/10 dark:bg-indigo-950/5 p-5 space-y-3 animate-pulse">
          <div className="h-2.5 bg-indigo-200 dark:bg-indigo-900/60 rounded-full w-32"></div>
          <div className="space-y-2">
            <div className="h-2 bg-indigo-150 dark:bg-indigo-950/60 rounded-full w-full"></div>
            <div className="h-2 bg-indigo-150 dark:bg-indigo-950/60 rounded-full w-11/12"></div>
            <div className="h-2 bg-indigo-150 dark:bg-indigo-950/60 rounded-full w-4/5"></div>
          </div>
        </div>
      )}

      {insight && !loading && (
        <div ref={globalInsightRef} className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/35 dark:bg-indigo-950/15 p-5 space-y-2.5 animate-fade-scale shadow-xs">
          <div className="flex items-center gap-2 border-b border-indigo-100 dark:border-indigo-900 pb-1.5">
            <span className="text-base leading-none">📊</span>
            <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Global AI Comparison Insight Report</p>
          </div>
          <MarkdownRenderer text={insight} />
        </div>
      )}
    </div>
  );
}

function PieChart3D({
  data,
  selectedCategory,
  onSelectCategory,
}: {
  data: Array<{ name: string; value: number; percent: number; color: string }>;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}) {
  const [spin, setSpin] = useState<number>(0);
  const [tilt, setTilt] = useState<number>(40);
  const [depth, setDepth] = useState<number>(30);
  const [explode, setExplode] = useState<number>(8);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.length || total === 0) {
    return <div className="w-36 h-36 rounded-full border border-dashed border-gray-300 dark:border-gray-700 bg-gray-150 dark:bg-gray-800 animate-pulse flex items-center justify-center text-[10px] text-gray-400">No Data</div>;
  }

  const cx = 150;
  const cy = 110;
  const rx = 90;
  const radTilt = (tilt * Math.PI) / 180;
  const ry = rx * Math.sin(radTilt);

  // Filter out slices with value <= 0 to prevent geometry/hover breakouts on zero slices
  const ordered = [...data].filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

  // Set start angle rotated by the user's spin parameter
  const phi = (spin * Math.PI) / 180;
  let currentAngle = -Math.PI / 2 + phi;

  // Build the geometric data for each slice
  const slices = ordered.map((item) => {
    const angleSpan = (item.value / total) * Math.PI * 2;
    const start = currentAngle;
    const end = currentAngle + angleSpan;
    currentAngle = end;
    const mid = (start + end) / 2;

    const isActive = selectedCategory === item.name;
    const isHovered = hoveredSlice === item.name;

    // Explode calculation shifted along the mid angle (scaled vertically by sin(tilt) for perspective)
    const currentExplode = explode + (isActive ? 12 : 0) + (isHovered ? 8 : 0);
    const explodeX = Math.cos(mid) * currentExplode;
    const explodeY = Math.sin(mid) * currentExplode * Math.sin(radTilt);

    // Coordinate translation functions
    const polarToCartesian = (angle: number, radiusX: number, radiusY: number) => ({
      x: cx + explodeX + Math.cos(angle) * radiusX,
      y: cy + explodeY + Math.sin(angle) * radiusY,
    });

    const centerT = { x: cx + explodeX, y: cy + explodeY };
    const centerB = { x: cx + explodeX, y: cy + explodeY + depth };
    const startT = polarToCartesian(start, rx, ry);
    const startB = { x: startT.x, y: startT.y + depth };
    const endT = polarToCartesian(end, rx, ry);
    const endB = { x: endT.x, y: endT.y + depth };

    const largeArcFlag = angleSpan > Math.PI ? 1 : 0;

    return {
      item,
      start,
      end,
      mid,
      largeArcFlag,
      centerT,
      centerB,
      startT,
      startB,
      endT,
      endB,
      color: item.color,
      isActive,
      isHovered,
    };
  });

  // Sort slices back-to-front based on sin(mid) for correct 3D overlapping
  const sortedSlices = [...slices].sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));

  // Determine if it's a single slice covering 100%
  const singleSlice = ordered.length === 1;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6 justify-center w-full max-w-4xl">
      {/* 3D SVG Render Area */}
      <div className="relative select-none flex-1 flex justify-center animate-fade-scale">
        <svg viewBox="0 0 320 250" className="w-[18rem] sm:w-[22rem] h-[250px] drop-shadow-2xl">
          {/* Drop shadow projected on ground */}
          <ellipse
            cx={cx}
            cy={cy + depth + 5}
            rx={rx + 10}
            ry={ry + 5}
            fill="rgba(15,23,42,0.18)"
            filter="blur(5px)"
          />

          {singleSlice ? (
            // Special render mode for exactly 1 slice
            <g
              onClick={() => onSelectCategory(ordered[0].name)}
              onMouseEnter={() => setHoveredSlice(ordered[0].name)}
              onMouseLeave={() => setHoveredSlice(null)}
              className="cursor-pointer group"
            >
              {/* Outer Cylinder Wall (front half) */}
              <path
                d={`M ${cx + rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy} L ${cx - rx} ${cy + depth} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy + depth} Z`}
                fill={darkenColor(ordered[0].color, -30)}
              />
              {/* Flat Top Cap */}
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={ordered[0].color}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={hoveredSlice ? 2 : 1}
              />
              {/* Label */}
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fill="white"
                fontWeight={800}
                fontSize={15}
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
              >
                100%
              </text>
            </g>
          ) : (
            // Render multiple sorted 3D slices
            sortedSlices.map((slice) => {
              const baseColor = slice.color;
              const sideOuterColor = darkenColor(baseColor, -30);
              const sideStartColor = darkenColor(baseColor, -15);
              const sideEndColor = darkenColor(baseColor, -22);

              // SVG Path commands
              const topFacePath = `M ${slice.centerT.x} ${slice.centerT.y} L ${slice.startT.x} ${slice.startT.y} A ${rx} ${ry} 0 ${slice.largeArcFlag} 1 ${slice.endT.x} ${slice.endT.y} Z`;
              const startRadialPath = `M ${slice.centerT.x} ${slice.centerT.y} L ${slice.startT.x} ${slice.startT.y} L ${slice.startB.x} ${slice.startB.y} L ${slice.centerB.x} ${slice.centerB.y} Z`;
              const endRadialPath = `M ${slice.centerT.x} ${slice.centerT.y} L ${slice.endT.x} ${slice.endT.y} L ${slice.endB.x} ${slice.endB.y} L ${slice.centerB.x} ${slice.centerB.y} Z`;
              const outerCylinderPath = `M ${slice.startT.x} ${slice.startT.y} A ${rx} ${ry} 0 ${slice.largeArcFlag} 1 ${slice.endT.x} ${slice.endT.y} L ${slice.endB.x} ${slice.endB.y} A ${rx} ${ry} 0 ${slice.largeArcFlag} 0 ${slice.startB.x} ${slice.startB.y} Z`;

              // Label placement coordinates floating on top face center
              const labelX = slice.centerT.x + Math.cos(slice.mid) * rx * 0.6;
              const labelY = slice.centerT.y + Math.sin(slice.mid) * ry * 0.6;
              const showLabel = slice.item.percent >= 6 || slice.isHovered || slice.isActive;

              return (
                <g
                  key={slice.item.name}
                  onClick={() => onSelectCategory(slice.item.name)}
                  onMouseEnter={() => setHoveredSlice(slice.item.name)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  className="cursor-pointer transition-all duration-100"
                >
                  {/* Outer curved wall */}
                  <path d={outerCylinderPath} fill={sideOuterColor} />
                  {/* Radial flat cuts */}
                  <path d={startRadialPath} fill={sideStartColor} />
                  <path d={endRadialPath} fill={sideEndColor} />
                  {/* Top slice cap */}
                  <path
                    d={topFacePath}
                    fill={baseColor}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={slice.isActive ? 2 : slice.isHovered ? 1.5 : 1}
                  />

                  {/* Percentage float labels */}
                  {showLabel && (
                    <text
                      x={labelX}
                      y={labelY + 4}
                      textAnchor="middle"
                      fill="white"
                      fontWeight={750}
                      fontSize={slice.item.percent >= 15 ? 14 : 11}
                      style={{ textShadow: "0 2px 4px rgba(15,23,42,0.6)" }}
                    >
                      {slice.item.percent}%
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Control panel adapted to light and dark themes */}
      <div className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-3xl p-4 shadow-sm dark:shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 w-full sm:w-64 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">3D Customize</span>
          <button
            onClick={() => {
              setSpin(0);
              setTilt(40);
              setDepth(30);
              setExplode(8);
            }}
            className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider"
          >
            Reset
          </button>
        </div>

        <div className="space-y-3.5">
          {/* Spin */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Rotation (Spin)</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{spin}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={spin}
              onChange={(e) => setSpin(Number(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>

          {/* Tilt */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Tilt Perspective</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{tilt}°</span>
            </div>
            <input
              type="range"
              min="20"
              max="75"
              value={tilt}
              onChange={(e) => setTilt(Number(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>

          {/* Depth */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Thickness (Depth)</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{depth}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="65"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>

          {/* Explode */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Explode Gap</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{explode}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              value={explode}
              onChange={(e) => setExplode(Number(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Legend list right-aligned for desktop, below for mobile */}
      <div className="flex flex-wrap lg:flex-col gap-2 max-w-xl lg:max-w-[12rem] justify-center lg:justify-start">
        <button
          type="button"
          onClick={() => onSelectCategory("All")}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-[1.03] ${
            selectedCategory === "All"
              ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-350 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          All Slices
        </button>

        {/* Legend buttons for all categories */}
        {data.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectCategory(item.name)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-[1.03] ${
              selectedCategory === item.name
                ? "shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-350 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
            style={
              selectedCategory === item.name
                ? { backgroundColor: `${item.color}1A`, borderColor: `${item.color}66`, color: item.color }
                : undefined
            }
          >
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: item.color }} />
            {item.name} ({item.percent}%)
          </button>
        ))}
      </div>
    </div>
  );
}

function darkenColor(color: string, amount: number) {
  const hex = color.replace("#", "");
  const num = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function getCategoryBreakdown(expenses: Expense[]) {
  const totals: Record<string, number> = {};
  for (const item of expenses) {
    const category = item.category || "Other";
    totals[category] = (totals[category] ?? 0) + Number(item.amount);
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(totals)
    .map(([name, value]) => ({
      name,
      value,
      percent: Math.round((value / total) * 100),
      color: getCategoryColor(name),
    }))
    .sort((a, b) => b.value - a.value);
}

function getCategoryColor(category: string) {
  const palette: Record<string, string> = {
    Food: "#6366f1",
    Grocery: "#10b981",
    Travel: "#f59e0b",
    Family: "#ec4899",
    EMI: "#8b5cf6",
    Saving: "#14b8a6",
    Luxury: "#ef4444",
    Health: "#22c55e",
    House: "#f97316",
    Other: "#94a3b8",
  };

  return palette[category] ?? "#94a3b8";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}
