"use client";

import type { Bank } from "../lib/api";
import { fmtFull } from "../lib/utils";

interface TransactionFiltersProps {
  banks: Bank[];
  bankFilter: string;
  dateFrom: string;
  dateTo: string;
  total: number;
  onBankChange: (bankId: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
}

export default function TransactionFilters({
  banks,
  bankFilter,
  dateFrom,
  dateTo,
  total,
  onBankChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: TransactionFiltersProps) {
  const hasFilter = bankFilter !== "" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={bankFilter}
          onChange={(e) => onBankChange(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-1 sm:flex-none min-w-[110px]"
        >
          <option value="">All Banks</option>
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>{bank.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full"
          />
        </div>

        {hasFilter && (
          <div className="flex items-center justify-between w-full sm:w-auto sm:ml-auto gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
            <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
              Total: {fmtFull(total)}
            </span>
            <button
              onClick={onClear}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
