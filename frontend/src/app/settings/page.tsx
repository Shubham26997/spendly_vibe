"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchSettings,
  saveSettings,
  updateSettings,
  restartMonth,
  fetchSavingsPlan,
  fetchBanks,
  createBank,
  deleteBank,
  type MonthSettingsOut,
  type SavingsPlan,
  type Bank,
} from "../lib/api";
import { fmtFull } from "../lib/utils";
import BankIcon from "../components/BankIcon";



function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

import { useAuth } from "../context/AuthContext";
import { AuthModal } from "../components/AuthModal";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [settings, setSettings] = useState<MonthSettingsOut | null>(null);
  const [plan, setPlan] = useState<SavingsPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [salary, setSalary] = useState("");
  const [savePct, setSavePct] = useState("30");
  const [isEditing, setIsEditing] = useState(false);

  // Success redirect countdown state
  const [countdown, setCountdown] = useState<number | null>(null);

  // Bank management state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [newBankName, setNewBankName] = useState("");
  const [addingBank, setAddingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [confirmDeleteBankId, setConfirmDeleteBankId] = useState<string | null>(null);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const [s, p, b] = await Promise.allSettled([
          fetchSettings(month, year),
          fetchSavingsPlan(month, year),
          fetchBanks(),
        ]);
        if (s.status === "fulfilled") {
          setSettings(s.value);
          if (s.value.locked) {
            setSalary(String(s.value.salary ?? ""));
            setSavePct(String(s.value.save_pct ?? 30));
          }
        }
        if (p.status === "fulfilled") setPlan(p.value);
        if (b.status === "fulfilled") setBanks(b.value);
      } catch {
        setError("Could not load settings.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, month, year]);

  // Handle countdown redirection timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push("/");
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

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

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault();
    const name = newBankName.trim();
    if (!name) return;
    setAddingBank(true);
    setBankError(null);
    try {
      const bank = await createBank(name);
      setBanks((prev) => [...prev, bank].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBankName("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add bank.";
      setBankError(msg.includes("409") ? "That bank already exists." : msg);
    } finally {
      setAddingBank(false);
    }
  }



  async function handleDeleteBank(id: string) {
    if (confirmDeleteBankId !== id) {
      setConfirmDeleteBankId(id);
      return;
    }
    setConfirmDeleteBankId(null);
    setDeletingBankId(id);
    try {
      await deleteBank(id);
      setBanks((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setBankError("Failed to delete bank. Try again.");
    } finally {
      setDeletingBankId(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const s = parseFloat(salary);
    const p = parseInt(savePct, 10);
    if (!s || s <= 0 || !p || p < 1 || p > 100) {
      setError("Enter a valid salary and save % (1-100).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let result;
      if (settings?.locked && isEditing) {
        result = await updateSettings(s, p, month, year);
      } else {
        result = await saveSettings(s, p, month, year);
      }
      setSettings(result);
      setSuccess(true);
      // Re-fetch plan to display visual breakdown
      const p2 = await fetchSavingsPlan(month, year);
      setPlan(p2);
      setIsEditing(false);
      setCountdown(10); // Start 10 second redirect countdown
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings.";
      setError(msg.includes("409") ? "Settings already locked for this month." : msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    setError(null);
    try {
      await restartMonth(month, year);
      const fresh = await fetchSettings(month, year);
      setSettings(fresh);
      setPlan(null);
      setSalary("");
      setSavePct("30");
      setSuccess(false);
      setShowRestartConfirm(false);
      setCountdown(null);
    } catch {
      setError("Failed to restart month. Try again.");
    } finally {
      setRestarting(false);
    }
  }

  const label = monthLabel(month, year);
  const locked = settings?.locked ?? false;
  const showSetupForm = !locked || isEditing;
  const totalToSave = settings?.salary && settings?.save_pct
    ? (settings.salary * settings.save_pct) / 100
    : 0;

  return (
    <main className="w-full px-3 sm:px-4 lg:px-6 py-8 space-y-6">
      {/* Header with back link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all mb-2.5"
        >
          <span>←</span> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Settings</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {label} · Monthly financial setup and controls
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
          <svg className="animate-spin h-7 w-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-xs font-medium">Fetching settings…</span>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form/Locked view, Allocations breakdown & Danger Zone */}
          <div className="lg:col-span-7 space-y-6">
            {/* Success timer redirect message */}
            {success && countdown !== null && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-scale shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">🎉</span>
                  <div>
                    <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                      Settings successfully locked for {label}!
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Redirecting to dashboard in{" "}
                      <span className="font-bold text-sm text-emerald-700 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded ml-1">
                        {countdown}s
                      </span>
                      ...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCountdown(null)}
                    className="px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Cancel Redirect
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Success visual without countdown active */}
            {success && countdown === null && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between shadow-xs">
                <span>Settings successfully saved and locked for {label}.</span>
                <button
                  onClick={() => setSuccess(false)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Setup / Edit Form */}
            {showSetupForm && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-150/80 dark:border-gray-800/80 shadow-sm p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-base">
                    📋
                  </span>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                      {isEditing ? `Edit ${label} Settings` : `${label} Setup`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Set your monthly financial targets below
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Monthly Salary (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                      <input
                        type="number"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        placeholder="95000"
                        min="1"
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Save Target (%)
                      </label>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        {savePct}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="10"
                      max="80"
                      step="5"
                      value={savePct}
                      onChange={(e) => setSavePct(e.target.value)}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
                    />

                    <div className="flex gap-2">
                      {[
                        { label: "20% Conservative", val: "20" },
                        { label: "30% Balanced", val: "30" },
                        { label: "50% Aggressive", val: "50" },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setSavePct(preset.val)}
                          className={`flex-1 text-xs py-2 px-2.5 rounded-xl border transition-all ${
                            savePct === preset.val
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800/80 dark:text-indigo-300 font-bold"
                              : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time split preview card */}
                  {salary && (
                    <div className="bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl p-4 border border-indigo-100/50 dark:border-indigo-900/20 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80">
                        Live Budget Split
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white dark:bg-gray-800/60 rounded-lg p-2 shadow-2xs border border-gray-100/50 dark:border-gray-700/50">
                          <p className="text-[9px] font-semibold text-gray-400 uppercase">Salary</p>
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                            {fmtFull(parseFloat(salary || "0"))}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800/60 rounded-lg p-2 shadow-2xs border border-emerald-100 dark:border-emerald-900/50 border-l-3 border-l-emerald-500">
                          <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Save ({savePct}%)</p>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {fmtFull((parseFloat(salary || "0") * parseInt(savePct || "0", 10)) / 100)}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800/60 rounded-lg p-2 shadow-2xs border border-indigo-100 dark:border-indigo-900/50 border-l-3 border-l-indigo-500">
                          <p className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Spend ({100 - parseInt(savePct || "0", 10)}%)</p>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {fmtFull((parseFloat(salary || "0") * (100 - parseInt(savePct || "0", 10))) / 100)}
                          </p>
                        </div>
                      </div>
                      {/* Visual Segmented Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 flex overflow-hidden">
                        <div
                          style={{ width: `${savePct}%` }}
                          className="h-full bg-emerald-500 transition-all duration-300"
                        />
                        <div
                          style={{ width: `${100 - parseInt(savePct || "0", 10)}%` }}
                          className="h-full bg-indigo-500 transition-all duration-300"
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl px-3.5 py-2.5 border border-red-100 dark:border-red-900/30">
                      {error}
                    </p>
                  )}

                  {isEditing ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setError(null);
                          if (settings) {
                            setSalary(String(settings.salary ?? ""));
                            setSavePct(String(settings.save_pct ?? 30));
                          }
                        }}
                        className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 py-2.5 rounded-xl font-bold text-sm transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-bold text-sm transition-all"
                      >
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs"
                  >
                    {saving ? "Saving…" : `🔒 Lock Settings for ${label}`}
                  </button>
                  )}
                </form>
              </div>
            )}

            {/* Locked Read-Only State View */}
            {locked && !isEditing && (
              <>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-150/80 dark:border-gray-800/80 shadow-sm p-6 space-y-6 animate-fade-scale">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-base">
                        ✅
                      </span>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                          {label} Settings Locked
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                          Active targets for this month
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSalary(String(settings?.salary ?? ""));
                        setSavePct(String(settings?.save_pct ?? 30));
                        setIsEditing(true);
                      }}
                      className="px-3.5 py-2 bg-white border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition-all shadow-2xs"
                    >
                      ✏️ Edit Settings
                    </button>
                  </div>

                  {/* Redesigned Grid Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        label: "Monthly Salary",
                        value: fmtFull(settings?.salary ?? 0),
                        icon: "💼",
                        color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100/50 dark:border-indigo-900/30",
                      },
                      {
                        label: "Save Target",
                        value: `${settings?.save_pct ?? 30}%`,
                        icon: "📈",
                        color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-900/30",
                      },
                      {
                        label: "To Invest",
                        value: fmtFull(totalToSave),
                        icon: "🛡️",
                        color: "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border-amber-100/50 dark:border-amber-900/30",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-3.5 p-4 rounded-2xl border border-gray-150/50 dark:border-gray-800/30 bg-gray-50/10 dark:bg-gray-900/10"
                      >
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${item.color.split(" ").slice(0, 2).join(" ")}`}>
                          {item.icon}
                        </span>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                            {item.label}
                          </p>
                          <p className="text-base font-extrabold text-gray-800 dark:text-gray-100 mt-0.5">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dynamic visual allocations plan breakdown */}
                  {plan && plan.allocations && plan.allocations.length > 0 && (
                    <div className="border border-gray-100 dark:border-gray-800/80 rounded-2xl p-5 space-y-4 bg-gray-50/30 dark:bg-gray-900/10 shadow-3xs">
                      <div>
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Savings Allocation Breakdown
                        </h3>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          Smart allocations created automatically based on your locked settings
                        </p>
                      </div>

                      <div className="space-y-3.5">
                        {plan.allocations.map((alloc) => {
                          const pct = plan.total_to_save > 0 ? Math.round((alloc.amount / plan.total_to_save) * 100) : 0;
                          let colorClass = "bg-indigo-500";
                          if (alloc.instrument.includes("Liquid")) colorClass = "bg-emerald-500";
                          if (alloc.instrument.includes("PPF")) colorClass = "bg-amber-500";

                          return (
                            <div key={alloc.instrument} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  {alloc.instrument}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 font-bold">
                                  {fmtFull(alloc.amount)} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                <div style={{ width: `${pct}%` }} className={`h-full ${colorClass}`} />
                              </div>
                              {(alloc.rationale || alloc.reason) && (
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1">
                                  <span>💡</span>
                                  <span>{alloc.rationale || alloc.reason}</span>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Danger Zone Section moved directly below Savings Plan allocations inside Left Column */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-950/30 shadow-sm p-6 space-y-4 animate-fade-scale">
                  <div className="flex items-center gap-3 pb-3 border-b border-red-50 dark:border-red-950/20">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="font-bold text-red-650 dark:text-red-400 text-sm">Danger Zone</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
                        Destructive settings actions that cannot be undone
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-red-50/20 dark:bg-red-950/5 p-4 rounded-xl border border-red-100/30 dark:border-red-950/10">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-red-800 dark:text-red-400">Restart Month</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        Permanently deletes all expenses, income, investment plans, and insights for {label}.
                      </p>
                    </div>

                    {!showRestartConfirm ? (
                      <button
                        onClick={() => setShowRestartConfirm(true)}
                        className="bg-red-55/90 hover:bg-red-100 dark:bg-red-950/35 dark:hover:bg-red-900/30 text-red-650 dark:text-red-400 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 border border-red-100 dark:border-red-950/50"
                      >
                        🔄 Restart {label}
                      </button>
                    ) : (
                      <div className="w-full sm:w-auto space-y-2 border border-red-200 dark:border-red-800 rounded-xl p-3 bg-red-50 dark:bg-red-950/40">
                        <p className="text-xs font-bold text-red-700 dark:text-red-400 text-center">
                          Are you absolutely sure? This will delete all monthly data!
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            onClick={() => setShowRestartConfirm(false)}
                            className="py-1.5 px-3 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleRestart}
                            disabled={restarting}
                            className="py-1.5 px-3 rounded-lg text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors"
                          >
                            {restarting ? "Deleting…" : "Delete All Data"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl px-3.5 py-2.5 border border-red-100 dark:border-red-900/30">
                      {error}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Manage Banks */}
          <div className="lg:col-span-5 space-y-6">
            {/* Manage Banks Section (Paytm Style) */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-150/80 dark:border-gray-800/80 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/80">
                <span className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-base">
                  🏦
                </span>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Manage Banks</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
                    View and manage your registered bank accounts
                  </p>
                </div>
              </div>


              {/* Registered Accounts list */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Registered Accounts ({banks.length})
                </p>

                {banks.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-150/80 dark:border-gray-800/80 rounded-2xl bg-gray-50/20 dark:bg-gray-900/10 overflow-hidden shadow-2xs">
                    {banks.map((bank) => {
                      const isConfirming = confirmDeleteBankId === bank.id;
                      const isDeleting = deletingBankId === bank.id;

                      return (
                        <div
                          key={bank.id}
                          className={`flex items-center justify-between px-4 py-3 gap-3 transition-all hover:bg-gray-50/20 dark:hover:bg-gray-900/20 ${
                            isDeleting ? "opacity-45" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8.5 h-8.5 rounded-full bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-3xs overflow-hidden flex-shrink-0">
                              <BankIcon name={bank.name} className="w-4.5 h-4.5" size={24} />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate capitalize">
                              {bank.name}
                            </span>
                          </div>

                          {isConfirming ? (
                            <div className="flex gap-2 animate-fade-scale">
                              <button
                                onClick={() => handleDeleteBank(bank.id)}
                                disabled={isDeleting}
                                className="text-[10px] font-bold px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors shadow-2xs"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteBankId(null)}
                                className="text-[10px] font-bold px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeleteBank(bank.id)}
                              disabled={isDeleting}
                              title="Delete bank"
                              className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1 pl-1 font-medium">
                    No bank accounts registered yet.
                  </p>
                )}
              </div>

              {/* Add manually Form */}
              <form onSubmit={handleAddBank} className="space-y-2 border-t border-gray-100 dark:border-gray-800/80 pt-4">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Add Bank Account Manually
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                      type="text"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      placeholder="Enter bank name, e.g. BOB..."
                      maxLength={50}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addingBank || !newBankName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0 shadow-xs"
                  >
                    {addingBank ? "Adding…" : "Add"}
                  </button>
                </div>
              </form>

              {bankError && (
                <p className="text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl px-3.5 py-2.5 border border-red-100 dark:border-red-900/30 animate-fade-scale">
                  {bankError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
