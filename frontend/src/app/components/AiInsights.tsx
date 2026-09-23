import type { ZoneResponse, SavingsPlan } from "../lib/api";

interface AiInsightsProps {
  zone: ZoneResponse;
  plan: SavingsPlan | null;
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

const ZONE_ACCENT: Record<string, { pill: string; border: string; heading: string }> = {
  SAFE:    { pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", heading: "text-emerald-700 dark:text-emerald-400" },
  WARNING: { pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",       border: "border-amber-200 dark:border-amber-800",   heading: "text-amber-700 dark:text-amber-400" },
  DANGER:  { pill: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",               border: "border-red-200 dark:border-red-800",       heading: "text-red-700 dark:text-red-400" },
};

export default function AiInsights({ zone, plan }: AiInsightsProps) {
  const accent = ZONE_ACCENT[zone.zone] ?? ZONE_ACCENT.SAFE;
  const hasContent = zone.narrative || (zone.action_pills && zone.action_pills.length > 0);
  const allocations = plan?.allocations ?? [];

  if (!hasContent && allocations.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-2xl border ${accent.border} p-4 shadow-sm`}>
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
          No AI insights yet. Click "Get AI Insights" to generate analysis.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border ${accent.border} p-4 shadow-sm space-y-4`}>
      {/* Narrative */}
      {zone.narrative && (
        <div className="space-y-1.5">
          <p className={`text-xs font-semibold uppercase tracking-wide ${accent.heading}`}>
            AI Analysis
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {zone.narrative}
          </p>
        </div>
      )}

      {/* Action pills */}
      {zone.action_pills && zone.action_pills.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Suggested Actions
          </p>
          <div className="flex flex-wrap gap-2">
            {zone.action_pills.map((pill, i) => (
              <span
                key={i}
                className={`text-xs font-medium px-3 py-1.5 rounded-full shadow-sm transition-all hover:scale-105 ${accent.pill}`}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Investment allocations from savings plan */}
      {allocations.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Investment Plan — {plan?.target_save_pct ?? 30}% of salary
          </p>
          <div className="space-y-2">
            {allocations.map((alloc, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {alloc.instrument}
                  </span>
                  {(alloc.rationale ?? alloc.reason) && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate hidden sm:block">
                      — {alloc.rationale ?? alloc.reason}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-2">
                  {fmt(alloc.amount)}
                </span>
              </div>
            ))}
            {plan && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total to invest</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(plan.total_to_save)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
