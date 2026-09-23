import type { SavingsPlan as SavingsPlanType } from "../lib/api";

interface SavingsPlanProps {
  plan: SavingsPlanType;
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function SavingsPlan({ plan }: SavingsPlanProps) {
  const maxAmount = Math.max(...plan.allocations.map((a) => a.amount), 1);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Savings Plan</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Target: {fmt(plan.total_to_save)} ({plan.target_save_pct}%)
        </span>
      </div>

      {plan.gemini_narrative && (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{plan.gemini_narrative}</p>
      )}

      <div className="space-y-3">
        {plan.allocations.map((alloc, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{alloc.instrument}</span>
              <span className="text-gray-500 dark:text-gray-400">{fmt(alloc.amount)}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(alloc.amount / maxAmount) * 100}%` }}
              />
            </div>
            {(alloc.rationale || alloc.reason) && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{alloc.rationale ?? alloc.reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
