"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchZone,
  fetchSavingsPlan,
  fetchExpenses,
  fetchBanks,
  fetchSettings,
  refreshInsights,
  type ZoneResponse,
  type SavingsPlan as SavingsPlanType,
  type Expense,
  type Bank,
} from "./lib/api";
import ZoneBanner from "./components/ZoneBanner";
import StatsCards, { type CardType } from "./components/StatsCards";
import SpendInsight from "./components/SpendInsight";
import AiInsights from "./components/AiInsights";
import RecentEntries from "./components/RecentEntries";
import LogBar from "./components/LogBar";
import CardModal from "./components/CardModal";
import MonthlySpendLine from "./components/MonthlySpendLine";
import SavingsPanel from "./components/SavingsPanel";
import TransactionFilters from "./components/TransactionFilters";

import { useAuth } from "./context/AuthContext";
import { AuthModal } from "./components/AuthModal";

function daysInMonth(month: number, year: number) {
  return new Date(year, month - 1, 0).getDate();
}
function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const daysElapsed = now.getDate();
  const totalDays = daysInMonth(month, year);


  const [zoneData, setZoneData] = useState<ZoneResponse | null>(null);
  const [planData, setPlanData] = useState<SavingsPlanType | null>(null);
  const [expenseData, setExpenseData] = useState<Expense[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<CardType | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Transaction list filters
  const [bankFilter, setBankFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filterDate = dateFrom ? new Date(dateFrom) : dateTo ? new Date(dateTo) : now;
  const activeMonth = dateFrom || dateTo ? filterDate.getMonth() + 1 : month;
  const activeYear = dateFrom || dateTo ? filterDate.getFullYear() : year;
  const isCurrentMonth = activeMonth === month && activeYear === year;
  const activeDaysInMonth = daysInMonth(activeMonth, activeYear);
  const activeDaysElapsed = isCurrentMonth ? daysElapsed : activeDaysInMonth;

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setError(null);
    try {
      const targetMonth = dateFrom || dateTo ? (dateFrom ? new Date(dateFrom).getMonth() + 1 : new Date(dateTo).getMonth() + 1) : month;
      const targetYear = dateFrom || dateTo ? (dateFrom ? new Date(dateFrom).getFullYear() : new Date(dateTo).getFullYear()) : year;

      const [zone, plan, expenses, bankList, settingsResult] = await Promise.allSettled([
        fetchZone(),
        fetchSavingsPlan(targetMonth, targetYear),
        dateFrom || dateTo
          ? fetchExpenses(undefined, undefined, dateFrom, dateTo)
          : fetchExpenses(month, year),
        fetchBanks(),
        fetchSettings(targetMonth, targetYear),
      ]);
      if (zone.status === "fulfilled") setZoneData(zone.value);
      if (expenses.status === "fulfilled") setExpenseData(expenses.value);
      if (bankList.status === "fulfilled") setBanks(bankList.value);

      // Set planData from SavingsPlan or fallback to MonthSettings salary
      if (plan.status === "fulfilled" && plan.value) {
        setPlanData(plan.value);
      } else if (settingsResult.status === "fulfilled" && settingsResult.value?.salary) {
        const s = settingsResult.value;
        const sal = s.salary ?? 0;
        const pct = s.save_pct ?? 30;
        setPlanData({
          id: "settings-fallback",
          month: targetMonth,
          year: targetYear,
          salary_amount: sal,
          target_save_pct: pct,
          allocations: [],
          total_to_save: (sal * pct) / 100,
          gemini_narrative: null,
          created_at: new Date().toISOString(),
        });
      } else {
        setPlanData(null);
      }

      if (zone.status === "rejected") setError("Could not connect to API. Is the server running?");
      setLastSynced(new Date());
    } catch {
      setError("Could not connect to API.");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [month, year, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  // Re-fetch expenses & savings plan when date range filter changes
  useEffect(() => {
    if (dateFrom || dateTo) {
      const targetMonth = dateFrom ? new Date(dateFrom).getMonth() + 1 : new Date(dateTo).getMonth() + 1;
      const targetYear = dateFrom ? new Date(dateFrom).getFullYear() : new Date(dateTo).getFullYear();

      Promise.allSettled([
        fetchExpenses(undefined, undefined, dateFrom, dateTo),
        fetchSavingsPlan(targetMonth, targetYear),
        fetchSettings(targetMonth, targetYear),
      ]).then(([expRes, planRes, setRes]) => {
        if (expRes.status === "fulfilled") setExpenseData(expRes.value);
        if (planRes.status === "fulfilled" && planRes.value) {
          setPlanData(planRes.value);
        } else if (setRes.status === "fulfilled" && setRes.value?.salary) {
          const s = setRes.value;
          const sal = s.salary ?? 0;
          const pct = s.save_pct ?? 30;
          setPlanData({
            id: "settings-fallback",
            month: targetMonth,
            year: targetYear,
            salary_amount: sal,
            target_save_pct: pct,
            allocations: [],
            total_to_save: (sal * pct) / 100,
            gemini_narrative: null,
            created_at: new Date().toISOString(),
          });
        }
      });
    }
  }, [dateFrom, dateTo]);

  // Auto-refresh every 30 seconds so the graph stays current
  useEffect(() => {
    const id = setInterval(() => loadData(true), 30_000);
    return () => clearInterval(id);
  }, [loadData]);

  async function handleAiInsights() {
    setAiLoading(true);
    setAiError(null);
    try {
      const fresh = await refreshInsights();
      setZoneData(fresh);
      setShowAi(true);
    } catch {
      setAiError("AI insights unavailable right now. Try again later.");
    } finally {
      setAiLoading(false);
    }
  }

  const totalSpent = expenseData.reduce((sum, e) => sum + e.amount, 0);
  const salary = planData?.salary_amount ?? 0;

  const filteredExpenses = expenseData.filter((e) => {
    if (bankFilter && e.bank_id !== bankFilter) return false;
    if (dateFrom && e.expense_date < dateFrom) return false;
    if (dateTo && e.expense_date > dateTo) return false;
    return true;
  });
  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Write zone to localStorage so NavBar badge can read it
  useEffect(() => {
    if (zoneData?.zone) {
      localStorage.setItem("spendly_zone", zoneData.zone);
    }
  }, [zoneData?.zone]);

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

  return (

    <>
      {/* Subtle top refresh bar */}
      {refreshing && (
        <div className="fixed top-14 left-0 right-0 z-40 h-0.5 bg-indigo-500 animate-pulse" />
      )}

      <main className="w-full px-3 sm:px-4 lg:px-6 pt-20 pb-28 space-y-5">
        {/* Page title row */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {monthLabel(activeMonth, activeYear)}
              {(dateFrom || dateTo || bankFilter) && (
                <span className="ml-2 font-semibold text-indigo-600 dark:text-indigo-400">
                  (Filtered View)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"
              title="Refresh data"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 ${refreshing ? "animate-spin text-indigo-500" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "Updating…" : "Refresh"}
            </button>
            {lastSynced && (
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                Synced {lastSynced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Initial load spinner */}
        {initialLoading && (
          <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500 font-medium">
            <svg className="animate-spin h-6 w-6 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading dashboard…
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="truncate">{error}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => loadData(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-200 p-1"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* First-time onboarding CTA */}
        {!initialLoading && salary === 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="font-semibold text-indigo-800 dark:text-indigo-200">Welcome to Spendly 👋</p>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">Set your monthly salary to unlock zone tracking, savings plans, and AI insights.</p>
            </div>
            <a href="/settings" className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
              Set Salary →
            </a>
          </div>
        )}

        {!initialLoading && (
          <div className="space-y-5">
            {/* Savings Summary Card - Full Width */}
            <div style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '0ms' }}>
              <SavingsPanel
                salary={salary}
                totalSpent={filteredTotal}
                plan={planData}
                expenses={filteredExpenses}
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">

              {/* ─── Left main column (7 cols) ─── */}
              <div
                className="lg:col-span-7 space-y-5"
                style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '80ms' }}
              >
                {zoneData && (
                  <ZoneBanner
                    zone={zoneData.zone}
                    daysElapsed={activeDaysElapsed}
                    daysInMonth={activeDaysInMonth}
                    month={monthLabel(activeMonth, activeYear)}
                    savingScore={zoneData.saving_score}
                    spendScore={zoneData.spend_score}
                    narrative={zoneData.narrative}
                  />
                )}

                <MonthlySpendLine
                  expenses={filteredExpenses}
                  daysElapsed={activeDaysElapsed}
                  daysInMonth={activeDaysInMonth}
                  salary={salary}
                />

                <StatsCards
                  zone={zoneData}
                  plan={planData}
                  totalSpent={filteredTotal}
                  expenses={filteredExpenses}
                  onCardClick={setModalCard}
                />
              </div>

              {/* ─── Right column (5 cols) ─── */}
              <div
                className="lg:col-span-5 space-y-5"
                style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '160ms' }}
              >
                <TransactionFilters
                  banks={banks}
                  bankFilter={bankFilter}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  total={filteredTotal}
                  onBankChange={setBankFilter}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onClear={() => { setBankFilter(""); setDateFrom(""); setDateTo(""); }}
                />

                <SpendInsight
                  expenses={filteredExpenses}
                  banks={banks}
                  onExpenseDeleted={() => loadData(true)}
                />

                {/* AI Insights */}
                <div className="space-y-3">
                  <button
                    onClick={handleAiInsights}
                    disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-2 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-60 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Analysing your spends…
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {showAi ? "Refresh AI Insights" : "Get AI Insights"}
                      </>
                    )}
                  </button>
                  {aiError && <p className="text-xs text-red-500 dark:text-red-400 text-center">{aiError}</p>}
                  {showAi && zoneData && <AiInsights zone={zoneData} plan={planData} />}
                </div>

                <RecentEntries expenses={filteredExpenses} />
              </div>
            </div>
          </div>
        )}
      </main>

      <LogBar onExpenseLogged={() => loadData(true)} />

      {modalCard && (
        <CardModal
          type={modalCard}
          onClose={() => setModalCard(null)}
          zone={zoneData}
          plan={planData}
          expenses={expenseData}
          month={month}
          year={year}
        />
      )}
    </>
  );
}
