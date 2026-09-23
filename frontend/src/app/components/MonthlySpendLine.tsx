"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Expense } from "../lib/api";

interface MonthlySpendLineProps {
  expenses: Expense[];
  daysElapsed: number;
  daysInMonth: number;
  salary: number;
}

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

// SVG coordinate constants
const W = 600;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 12;
const PAD_B = 22;

// Balance zones, as a fraction of salary left
const RED_MAX_PCT = 0.08;   // danger: 0%–8% of salary left (includes overspent)
const GREEN_MIN_PCT = 0.6;  // safe: above 60% of salary left
// everything in between is the warning zone

function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    path += ` C ${cx.toFixed(1)},${p0.y.toFixed(1)} ${cx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return path;
}

export default function MonthlySpendLine({
  expenses,
  daysElapsed,
  daysInMonth,
  salary,
}: MonthlySpendLineProps) {
  const [chartH, setChartH] = useState(220);
  const [viewMode, setViewMode] = useState<"trend" | "bars" | "pace">("trend");
  const [tooltip, setTooltip] = useState<{
    screenX: number;
    screenY: number;
    day: number;
    val: number;
    dailyAmt: number;
    isCredit: boolean;
    paceVal: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const lineRef = useRef<SVGPolylineElement>(null);

  // ── Drag-to-resize ───────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startY: clientY, startH: chartH };
    e.preventDefault();
  }, [chartH]);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const delta = clientY - dragRef.current.startY;
      setChartH(Math.max(70, Math.min(480, dragRef.current.startH + delta)));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  // ── Build data series: balance remaining = salary - cumulative spend ──
  // Note: Category "Saving" transfers are investments/savings, not expenditure burn
  const dailyMap: Record<number, number> = {};
  for (const e of expenses) {
    if (e.category === "Saving") continue;
    const day = parseInt(e.expense_date.split("-")[2], 10);
    dailyMap[day] = (dailyMap[day] || 0) + e.amount;
  }

  // Ideal pace burn trajectory (70% max budget spent evenly across month)
  const idealDailyBudget = salary > 0 ? (salary * 0.70) / Math.max(daysInMonth, 1) : 0;
  const currentDaysLimit = Math.max(daysElapsed, 1);

  // Day 0 = salary credit, the starting balance before any spend
  const series: {
    day: number;
    val: number;
    dailyAmt: number;
    isCredit: boolean;
    paceVal: number;
    cumSpent: number;
    isActual: boolean;
  }[] = [];

  let actualSpentSum = 0;
  // Calculate actual daily spend up to currentDaysLimit
  for (let d = 0; d <= daysInMonth; d++) {
    const isActual = d <= currentDaysLimit;
    const amt = d === 0 ? 0 : isActual ? (dailyMap[d] ?? 0) : 0;
    if (isActual) {
      actualSpentSum += amt;
    }
    // Projected cumulative spend remains flat at actualSpentSum for remaining days
    const cumSpent = isActual ? actualSpentSum : actualSpentSum;
    const paceVal = salary > 0 ? Math.max(0, salary - d * idealDailyBudget) : 0;

    series.push({
      day: d,
      val: salary - cumSpent,
      dailyAmt: amt,
      isCredit: d === 0,
      paceVal,
      cumSpent,
      isActual,
    });
  }

  const totalSpent = actualSpentSum;
  const balanceLeft = salary - actualSpentSum;
  const redFloor = salary > 0 ? salary * RED_MAX_PCT : 0;
  const greenFloor = salary > 0 ? salary * GREEN_MIN_PCT : 0;
  const maxDailyAmt = Math.max(...series.map((s) => s.dailyAmt), 1);

  // Current pace health (allow week 1 buffer for upfront monthly bill payments)
  const targetMaxBudget = salary > 0 ? salary * 0.70 : Math.max(totalSpent, 10000);
  const linearProRata = daysElapsed / Math.max(daysInMonth, 1);
  const earlyMonthBuffer = daysElapsed <= 7 ? 0.25 : 0.0;
  const effectiveProRata = Math.min(1.0, Math.max(linearProRata, earlyMonthBuffer));
  const expectedSpentByToday = targetMaxBudget * effectiveProRata;

  const lastActualPoint = series.find((s) => s.day === currentDaysLimit);
  const isAheadOfPace = lastActualPoint ? lastActualPoint.cumSpent <= expectedSpentByToday : true;

  // ── SVG helpers ──────────────────────────────────────────────────
  const innerH = chartH - PAD_T - PAD_B;
  const chartW = W - PAD_L - PAD_R;

  const values = series.map((p) => p.val);
  const topVal = Math.max(salary, ...values, 1);
  const bottomVal = Math.min(0, ...values);
  const range = Math.max(topVal - bottomVal, 1);

  const toX = (day: number) =>
    PAD_L + (day / Math.max(daysInMonth, 1)) * chartW;
  const toY = (val: number) =>
    PAD_T + innerH - ((val - bottomVal) / range) * innerH;

  function statusColor(val: number) {
    if (salary <= 0) return "text-emerald-600";
    if (val <= redFloor) return "text-red-500";
    if (val > greenFloor) return "text-emerald-600";
    return "text-amber-500";
  }

  function statusHex(val: number) {
    if (salary <= 0) return "#00d09c";
    if (val <= redFloor) return "#ff5252";
    if (val > greenFloor) return "#00d09c";
    return "#f59e0b";
  }

  const lineColor = statusHex(balanceLeft);

  const gridLines = [1, 0.66, 0.33, 0].map((f) => {
    const v = bottomVal + range * f;
    return { y: toY(v), label: fmt(v) };
  });

  const xLabels = Array.from(new Set([
    0,
    Math.ceil(daysInMonth / 4),
    Math.ceil(daysInMonth / 2),
    Math.ceil((daysInMonth * 3) / 4),
    daysInMonth,
  ]));

  const redY = toY(redFloor);
  const greenY = toY(greenFloor);

  // Pace mode Y-scaling helper
  const dailyIdealPace = targetMaxBudget / Math.max(daysInMonth, 1);
  const maxPaceY = Math.max(targetMaxBudget, totalSpent, 1) * 1.15;
  const toPaceY = (val: number) =>
    PAD_T + (innerH - 10) - (val / maxPaceY) * (innerH - 25);

  // ── Mouse & Touch handlers ────────────────────────────────────────────────
  function updateTooltipPosition(clientX: number, clientY: number) {
    if (!svgRef.current || series.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const svgX = (clientX - rect.left) * scaleX;
    const dayFloat = ((svgX - PAD_L) / chartW) * daysInMonth;
    const roundedDay = Math.round(dayFloat);

    // Disable hover tooltip & crosshair for future dates beyond daysElapsed
    if (roundedDay > daysElapsed) {
      setTooltip(null);
      return;
    }

    const nearest = Math.max(0, Math.min(daysElapsed, roundedDay));
    const point = series.find((p) => p.day === nearest);
    if (!point) {
      setTooltip(null);
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    const screenX = clientX - (containerRect?.left ?? 0);
    const screenY = clientY - (containerRect?.top ?? 0);

    setTooltip({
      screenX,
      screenY,
      day: point.day,
      val: point.val,
      dailyAmt: point.dailyAmt,
      isCredit: point.isCredit,
      paceVal: point.paceVal,
    });
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    updateTooltipPosition(e.clientX, e.clientY);
  }

  function handleTouch(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length > 0) {
      updateTooltipPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  // Active hover point calculations
  const activeHoverPoint = tooltip ? series.find((p) => p.day === tooltip.day) : null;
  const hoverCy = activeHoverPoint
    ? viewMode === "bars"
      ? PAD_T + innerH - (maxDailyAmt > 0 ? (activeHoverPoint.dailyAmt / maxDailyAmt) * (innerH - 25) : 0) - 5
      : viewMode === "pace"
      ? toPaceY(activeHoverPoint.cumSpent)
      : toY(activeHoverPoint.val)
    : 0;

  // ── Empty state ─────────────────────────────────────────────
  if (expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">This Month · Balance Trend</span>
          <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">No expenses logged yet</span>
        </div>
        <div className="flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/50" style={{ height: 220 }}>
          <div className="text-center space-y-2">
            <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-xs text-gray-400 dark:text-gray-500">Log your first expense to see your balance trend</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-3">
      {/* Groww Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Spend Analytics
          </span>
          {salary > 0 && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isAheadOfPace
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              }`}
            >
              {isAheadOfPace ? "🟢 On Budget Pace" : "⚠️ Exceeding Pace"}
            </span>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-0.5 rounded-xl text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setViewMode("trend")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "trend"
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            📈 Trend
          </button>
          <button
            type="button"
            onClick={() => setViewMode("bars")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "bars"
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            📊 Daily Bars
          </button>
          <button
            type="button"
            onClick={() => setViewMode("pace")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "pace"
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            🎯 Groww Pace
          </button>
        </div>
      </div>

      {/* Metric legend bar */}
      <div className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-gray-800 pb-2">
        <div className="flex items-center gap-3">
          {salary > 0 && (
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              Total Spent: <strong className="text-gray-800 dark:text-gray-200">{fmt(totalSpent)}</strong> ({Math.round((totalSpent / salary) * 100)}%)
            </span>
          )}
        </div>
        <span className={`font-bold ${statusColor(balanceLeft)}`}>
          Balance Left: {fmt(balanceLeft)}
        </span>
      </div>

      {/* Chart container — relative for tooltip overlay */}
      <div ref={containerRef} className="relative select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${chartH}`}
          width="100%"
          height={chartH}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={() => setTooltip(null)}
          className="cursor-crosshair touch-none"
        >
          <defs>
            {/* Groww Emerald Gradient */}
            <linearGradient id="growwEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d09c" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00b386" stopOpacity="0.05" />
            </linearGradient>

            {/* Groww Indigo Gradient */}
            <linearGradient id="growwIndigoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.05" />
            </linearGradient>

            {/* Groww Coral Red Gradient */}
            <linearGradient id="growwCoralGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5252" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0.05" />
            </linearGradient>

            {/* Active Bar Glow Filter */}
            <filter id="growwBarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {(viewMode === "bars"
            ? [1, 0.66, 0.33, 0].map((f) => ({
                y: PAD_T + (innerH - 10) - (innerH - 25) * f,
                label: fmt(maxDailyAmt * f),
              }))
            : viewMode === "pace"
            ? [1, 0.66, 0.33, 0].map((f) => ({
                y: PAD_T + (innerH - 10) - (innerH - 25) * f,
                label: fmt(maxPaceY * f),
              }))
            : gridLines
          ).map(({ y, label }) => (
            <g key={label}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="currentColor" strokeWidth={0.5} vectorEffect="non-scaling-stroke"
                className="text-gray-100 dark:text-gray-800" />
              <text x={PAD_L - 6} y={y + 3.5} textAnchor="end"
                style={{ fontSize: 9 }}
                className="fill-gray-400 dark:fill-gray-500 font-medium">
                {label}
              </text>
            </g>
          ))}

          {/* Mode 1: Balance Remaining Trend Line (Downwards curve across full month) */}
          {viewMode === "trend" && (() => {
            const actualSeries = series.filter((s) => s.isActual);
            const projectedSeries = series.filter((s) => s.day >= currentDaysLimit);

            const actualPoints = actualSeries.map((p) => ({ x: toX(p.day), y: toY(p.val) }));
            const projectedPoints = projectedSeries.map((p) => ({ x: toX(p.day), y: toY(p.val) }));

            const smoothActualPath = getSmoothPath(actualPoints);
            const smoothProjectedPath = getSmoothPath(projectedPoints);

            const trendAreaPath = actualPoints.length > 0
              ? `${smoothActualPath} L ${toX(actualSeries[actualSeries.length - 1].day)},${toY(bottomVal)} L ${toX(actualSeries[0].day)},${toY(bottomVal)} Z`
              : "";

            return (
              <>
                {/* Safe floor line (60% of salary left) */}
                {salary > 0 && (
                  <g>
                    <line
                      x1={PAD_L} y1={greenY} x2={W - PAD_R} y2={greenY}
                      stroke="#00d09c" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text x={W - PAD_R - 4} y={greenY - 4} textAnchor="end"
                      style={{ fontSize: 8 }}
                      className="fill-emerald-600 dark:fill-emerald-400 font-bold">
                      Safe (60%)
                    </text>
                  </g>
                )}

                {/* Danger floor line (8% of salary left) */}
                {salary > 0 && (
                  <g>
                    <line
                      x1={PAD_L} y1={redY} x2={W - PAD_R} y2={redY}
                      stroke="#ff5252" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text x={W - PAD_R - 4} y={redY - 4} textAnchor="end"
                      style={{ fontSize: 8 }}
                      className="fill-red-500 dark:fill-red-400 font-bold">
                      Danger (8%)
                    </text>
                  </g>
                )}

                {/* Groww Smooth Area fill under actual curve */}
                {trendAreaPath && <path d={trendAreaPath} fill="url(#growwEmeraldGrad)" opacity={0.35} />}

                {/* Solid Bezier Line for Elapsed Days */}
                {actualPoints.length > 0 && (
                  <path
                    d={smoothActualPath}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Dashed Projection Line for Remaining Days to Month End */}
                {projectedPoints.length > 1 && (
                  <path
                    d={smoothProjectedPath}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    opacity={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </>
            );
          })()}

          {/* Mode 3: Dedicated Groww Stock Pace Guide Across Full Month */}
          {viewMode === "pace" && (() => {
            const actualSeries = series.filter((s) => s.isActual);
            const projectedSeries = series.filter((s) => s.day >= currentDaysLimit);

            const actualPoints = actualSeries.map((p) => ({ x: toX(p.day), y: toPaceY(p.cumSpent) }));
            const projectedPoints = projectedSeries.map((p) => ({ x: toX(p.day), y: toPaceY(p.cumSpent) }));
            const idealPoints = series.map((p) => ({ x: toX(p.day), y: toPaceY(p.day * dailyIdealPace) }));

            const smoothActualPath = getSmoothPath(actualPoints);
            const smoothProjectedPath = getSmoothPath(projectedPoints);
            const smoothIdealPath = getSmoothPath(idealPoints);

            const paceAreaPath = actualPoints.length > 0
              ? `${smoothActualPath} L ${toX(actualSeries[actualSeries.length - 1].day)},${toPaceY(0)} L ${toX(actualSeries[0].day)},${toPaceY(0)} Z`
              : "";

            return (
              <>
                {/* Groww Target Pace Baseline Line (Horizontal baseline across full width) */}
                {salary > 0 && (
                  <g>
                    <line
                      x1={PAD_L} y1={toPaceY(targetMaxBudget)} x2={W - PAD_R} y2={toPaceY(targetMaxBudget)}
                      stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="4 4" opacity={0.65}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text x={W - PAD_R - 4} y={toPaceY(targetMaxBudget) - 4} textAnchor="end"
                      style={{ fontSize: 8 }}
                      className="fill-indigo-600 dark:fill-indigo-400 font-bold">
                      Budget Baseline ({fmt(targetMaxBudget)})
                    </text>
                  </g>
                )}

                {/* Linear Target Pace Trajectory (Dashed Smooth Line spanning Day 0 to Day 31) */}
                <path
                  d={smoothIdealPath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  opacity={0.8}
                  vectorEffect="non-scaling-stroke"
                />

                {/* Actual Cumulative Spend Area Fill */}
                {paceAreaPath && (
                  <path
                    d={paceAreaPath}
                    fill={isAheadOfPace ? "url(#growwEmeraldGrad)" : "url(#growwCoralGrad)"}
                    opacity={0.25}
                  />
                )}

                {/* Groww Solid Actual Cumulative Curve (Days 0 to Current Day) */}
                <path
                  d={smoothActualPath}
                  fill="none"
                  stroke={isAheadOfPace ? "#00d09c" : "#ff5252"}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Horizontal Extension Line for Remaining Days (Current Total to Month End) */}
                {projectedPoints.length > 1 && (
                  <path
                    d={smoothProjectedPath}
                    fill="none"
                    stroke={isAheadOfPace ? "#00d09c" : "#ff5252"}
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    opacity={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </>
            );
          })()}

          {/* Mode 2: Groww-Style Daily Spend Bars */}
          {viewMode === "bars" && (
            <g>
              <style>{`
                @keyframes growwRise {
                  0% { transform: scaleY(0); }
                  100% { transform: scaleY(1); }
                }
                .groww-bar {
                  transform-origin: bottom;
                  animation: growwRise 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  transition: opacity 0.2s ease, filter 0.2s ease;
                }
              `}</style>
              {series.map((p, idx) => {
                if (p.isCredit) return null;
                const usableH = innerH - 25;
                const barH = maxDailyAmt > 0 ? (p.dailyAmt / maxDailyAmt) * usableH : 0;
                const bw = Math.max(6, Math.min(14, (chartW / Math.max(daysInMonth, 1)) * 0.55));
                const x = toX(p.day) - bw / 2;
                const trackY = PAD_T + 5;
                const trackH = innerH - 10;
                const y = PAD_T + innerH - barH - 5;

                const isHovered = tooltip?.day === p.day;
                const isAnyHovered = tooltip !== null;
                const opacity = isHovered ? 1 : isAnyHovered ? 0.35 : 0.88;

                const isHeavy = salary > 0 ? p.dailyAmt > (salary * 0.035) : p.dailyAmt > 5000;
                const isModerate = salary > 0 ? p.dailyAmt > (salary * 0.015) : p.dailyAmt > 2000;

                const fillUrl = isHeavy
                  ? "url(#growwCoralGrad)"
                  : isModerate
                  ? "url(#growwIndigoGrad)"
                  : "url(#growwEmeraldGrad)";

                return (
                  <g key={p.day} className="cursor-pointer">
                    {/* Groww background track/rail */}
                    <rect
                      x={x}
                      y={trackY}
                      width={bw}
                      height={trackH}
                      rx={bw / 2}
                      className="fill-slate-100 dark:fill-slate-800/60"
                      opacity={0.6}
                    />

                    {/* Groww animated bar fill */}
                    {p.dailyAmt > 0 && (
                      <rect
                        x={x}
                        y={y}
                        width={bw}
                        height={Math.max(barH, 4)}
                        rx={bw / 2}
                        fill={fillUrl}
                        opacity={opacity}
                        filter={isHovered ? "url(#growwBarGlow)" : undefined}
                        className="groww-bar"
                        style={{ animationDelay: `${Math.min(idx * 15, 300)}ms` }}
                      />
                    )}

                    {/* Floating Cap Tag on Hover */}
                    {isHovered && p.dailyAmt > 0 && (
                      <g transform={`translate(${toX(p.day)}, ${Math.max(PAD_T, y - 8)})`}>
                        <rect
                          x={-22}
                          y={-14}
                          width={44}
                          height={15}
                          rx={7}
                          className="fill-gray-900 dark:fill-gray-100 shadow-md"
                        />
                        <text
                          x={0}
                          y={-3}
                          textAnchor="middle"
                          style={{ fontSize: 9, fontWeight: 700 }}
                          className="fill-white dark:fill-gray-900"
                        >
                          {fmt(p.dailyAmt)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Hover vertical crosshair */}
          {tooltip && (
            <line
              x1={toX(tooltip.day)} y1={PAD_T}
              x2={toX(tooltip.day)} y2={PAD_T + innerH}
              stroke={viewMode === "pace" ? (isAheadOfPace ? "#00d09c" : "#ff5252") : statusHex(tooltip.val)} strokeWidth={1} strokeDasharray="3 3" opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Hover dot — directly snapped to active curve trajectory */}
          {tooltip && (
            <circle
              cx={toX(tooltip.day)}
              cy={hoverCy}
              r={5}
              fill={viewMode === "pace" ? (isAheadOfPace ? "#00d09c" : "#ff5252") : statusHex(tooltip.val)}
              stroke="white" strokeWidth={2}
              className="dark:stroke-gray-900 shadow-md"
            />
          )}

          {/* Last-point dot (when not hovering) */}
          {!tooltip && series.length > 0 && (viewMode === "trend" || viewMode === "pace") && (() => {
            const lastActual = series.find((s) => s.day === currentDaysLimit) ?? series[series.length - 1];
            const lastCy = viewMode === "pace" ? toPaceY(lastActual.cumSpent) : toY(lastActual.val);
            const lastColor = viewMode === "pace" ? (isAheadOfPace ? "#00d09c" : "#ff5252") : lineColor;
            return (
              <circle cx={toX(lastActual.day)} cy={lastCy}
                r={4} fill={lastColor} stroke="white" strokeWidth={2}
                className="dark:stroke-gray-900" />
            );
          })()}

          {/* X-axis labels */}
          {xLabels.map((d) => (
            <text key={d} x={toX(d)} y={chartH - 5}
              textAnchor="middle" style={{ fontSize: 9 }}
              className="fill-gray-400 dark:fill-gray-500 font-medium">
              {d === 0 ? "Salary" : `D${d}`}
            </text>
          ))}
        </svg>

        {/* Hover tooltip card */}
        {tooltip && (() => {
          const containerRect = containerRef.current?.getBoundingClientRect();
          const containerW = containerRect?.width ?? 0;
          const showLeft = tooltip.screenX > containerW * 0.65;
          const targetPaceAtDay = tooltip.day * dailyIdealPace;
          const cumSpentAtDay = activeHoverPoint?.cumSpent ?? 0;
          const paceDiff = cumSpentAtDay - targetPaceAtDay;

          return (
            <div
              className="absolute z-20 pointer-events-none bg-white/95 dark:bg-gray-800/95 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2 text-xs space-y-0.5 min-w-[150px]"
              style={{
                top: Math.max(4, tooltip.screenY - 80),
                left: showLeft ? undefined : tooltip.screenX + 12,
                right: showLeft ? containerW - tooltip.screenX + 12 : undefined,
              }}
            >
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {tooltip.isCredit ? "Day 0 · Salary Credit" : `Day ${tooltip.day} ${!activeHoverPoint?.isActual ? "(Projected)" : ""}`}
              </p>
              {viewMode === "pace" ? (
                <>
                  <p className="text-gray-600 dark:text-gray-300">
                    Cum Spent: <span className="font-bold text-gray-900 dark:text-gray-100">{fmt(cumSpentAtDay)}</span>
                  </p>
                  {salary > 0 && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Target Pace: {fmt(targetPaceAtDay)}
                    </p>
                  )}
                  {salary > 0 && (
                    <p className={`text-[11px] font-semibold border-t border-gray-100 dark:border-gray-700/60 pt-1 ${paceDiff <= 0 ? "text-emerald-600" : "text-amber-500"}`}>
                      {paceDiff <= 0 ? `${fmt(Math.abs(paceDiff))} under budget pace 🟢` : `+${fmt(paceDiff)} over budget pace ⚠️`}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-300">
                    Balance Left: <span className="font-bold text-gray-900 dark:text-gray-100">{fmt(tooltip.val)}</span>
                  </p>
                  {tooltip.isCredit ? (
                    <p className="text-emerald-600 dark:text-emerald-400">Salary credited: {fmt(salary)}</p>
                  ) : tooltip.dailyAmt > 0 ? (
                    <p className="text-orange-600 dark:text-orange-400 font-medium">Spent today: {fmt(tooltip.dailyAmt)}</p>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500">No spend on this day</p>
                  )}
                  {salary > 0 && (
                    <p className={`font-semibold ${statusColor(tooltip.val)}`}>
                      {Math.round((tooltip.val / salary) * 100)}% salary left
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Drag-to-resize handle */}
      <div
        className="flex items-center justify-center py-0.5 cursor-ns-resize group"
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        title="Drag to resize"
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-indigo-300 dark:group-hover:bg-indigo-700 transition-colors" />
      </div>
    </div>
  );
}
