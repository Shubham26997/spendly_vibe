interface KpiRowProps {
  salary: number;
  saved: number;
  spent: number;
  budgetLeft: number;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm flex flex-col gap-1 border border-gray-100 dark:border-gray-800">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{value}</span>
      {sub && <span className="text-xs text-red-400">{sub}</span>}
    </div>
  );
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function KpiRow({ salary, saved, spent, budgetLeft }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label="Salary" value={fmt(salary)} />
      <KpiCard label="Saved MTD" value={fmt(saved)} />
      <KpiCard label="Spent MTD" value={fmt(spent)} />
      <KpiCard
        label="Budget Left"
        value={fmt(Math.max(0, budgetLeft))}
        sub={budgetLeft < 0 ? "Over budget" : undefined}
      />
    </div>
  );
}
