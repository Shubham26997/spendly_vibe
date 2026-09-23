interface ZoneBannerProps {
  zone: "SAFE" | "WARNING" | "DANGER";
  daysElapsed: number;
  daysInMonth: number;
  month: string;
  savingScore?: number | null;
  spendScore?: number | null;
  narrative?: string | null;
}

const cfg = {
  SAFE: {
    badge: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
    gradient: "from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-gray-900 dark:to-emerald-950/10",
    border: "border-emerald-200/80 dark:border-emerald-800/50",
    label: "Safe Zone",
    text: "text-emerald-800 dark:text-emerald-300",
    subtext: "text-emerald-700/80 dark:text-emerald-400/80",
    bar: "bg-gradient-to-r from-emerald-400 to-emerald-500",
    accent: "bg-emerald-500",
  },
  WARNING: {
    badge: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
    gradient: "from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-gray-900 dark:to-amber-950/10",
    border: "border-amber-200/80 dark:border-amber-800/50",
    label: "Warning Zone",
    text: "text-amber-800 dark:text-amber-300",
    subtext: "text-amber-700/80 dark:text-amber-400/80",
    bar: "bg-gradient-to-r from-amber-400 to-amber-500",
    accent: "bg-amber-500",
  },
  DANGER: {
    badge: "bg-red-500 text-white shadow-sm shadow-red-500/30",
    gradient: "from-red-50/70 via-white to-red-50/30 dark:from-red-950/30 dark:via-gray-900 dark:to-red-950/10",
    border: "border-red-200/80 dark:border-red-800/50",
    label: "Danger Zone",
    text: "text-red-800 dark:text-red-300",
    subtext: "text-red-700/80 dark:text-red-400/80",
    bar: "bg-gradient-to-r from-red-400 to-red-500",
    accent: "bg-red-500",
  },
};

export default function ZoneBanner({
  zone,
  daysElapsed,
  daysInMonth,
  month,
  savingScore,
  spendScore,
  narrative,
}: ZoneBannerProps) {
  const c = cfg[zone];
  const pct = Math.round((daysElapsed / daysInMonth) * 100);
  const save = savingScore ?? null;
  const spend = spendScore ?? null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.gradient} p-4 shadow-sm backdrop-blur-sm space-y-3.5 transition-all ${
        zone === "DANGER" ? "animate-danger-pulse" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`${c.badge} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>
            {c.label}
          </span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Status
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{month}</p>
          <p className={`text-xs font-semibold ${c.text}`}>
            Day {daysElapsed} of {daysInMonth} · {pct}% elapsed
          </p>
        </div>
      </div>

      {/* Score pills */}
      {(save !== null || spend !== null) && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          {save !== null && (
            <div className="space-y-1.5 bg-white/60 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100/50 dark:border-gray-800/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Save Score</span>
                <span className={`font-bold ${c.text}`}>{save}/100</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.bar} transition-all duration-700`}
                  style={{ width: `${Math.min(100, Math.max(0, save))}%` }}
                />
              </div>
            </div>
          )}
          {spend !== null && (
            <div className="space-y-1.5 bg-white/60 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100/50 dark:border-gray-800/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Spend Health</span>
                <span className={`font-bold ${c.text}`}>{spend}/100</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.bar} transition-all duration-700`}
                  style={{ width: `${Math.min(100, Math.max(0, spend))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Narrative */}
      {narrative && (
        <div className={`flex items-start gap-2 text-xs leading-relaxed ${c.subtext} border-t ${c.border} pt-3`}>
          <span className="text-sm leading-none mt-0.5 flex-shrink-0">✨</span>
          <p>{narrative}</p>
        </div>
      )}
    </div>
  );
}
