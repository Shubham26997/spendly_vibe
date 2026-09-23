const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("spendly_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(init?.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `API ${path} → ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) detail = errJson.detail;
    } catch {
      // fallback
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function loginUser(email: string, password: str): Promise<AuthToken> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function registerUser(email: string, password: str, fullName?: string): Promise<AuthToken> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function getMeUser(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  month?: number,
  year?: number,
): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ message, history, month, year }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  const data = await res.json();
  return data.reply as string;
}

export interface ZoneResponse {
  zone: "SAFE" | "WARNING" | "DANGER";
  saving_score: number | null;
  spend_score: number | null;
  zone_score: number | null;
  narrative: string | null;
  action_pills: string[] | null;
  category_data: Record<string, { spent: number; budget: number }> | null;
  month: number;
  year: number;
}

export interface SavingsPlan {
  id: string;
  month: number;
  year: number;
  salary_amount: number;
  target_save_pct: number;
  allocations: Array<{ instrument: string; amount: number; rationale?: string; reason?: string }>;
  total_to_save: number;
  gemini_narrative: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  source: string;
  created_at: string;
  expense_date: string;
  confirmed: boolean;
  bank_id: string | null;
  bank_name: string | null;
}

export interface Bank {
  id: string;
  name: string;
}

export async function fetchZone(): Promise<ZoneResponse> {
  return apiFetch<ZoneResponse>("/zone");
}

export async function fetchSavingsPlan(month: number, year: number): Promise<SavingsPlan | null> {
  try {
    return await apiFetch<SavingsPlan>(`/savings-plan?month=${month}&year=${year}`);
  } catch {
    return null;
  }
}

export async function fetchExpenses(
  month?: number,
  year?: number,
  dateFrom?: string,
  dateTo?: string,
): Promise<Expense[]> {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (!dateFrom && !dateTo && month !== undefined && year !== undefined) {
      params.set("month", month.toString());
      params.set("year", year.toString());
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiFetch<Expense[]>(`/expenses${query}`);
  } catch {
    return [];
  }
}

export async function postExpense(rawText: string): Promise<unknown> {
  return apiFetch("/expense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText, source: "web" }),
  });
}

export async function confirmExpense(expenseId: string): Promise<void> {
  await apiFetch(`/expense/${expenseId}/confirm`, { method: "POST" });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await apiFetch(`/expense/${expenseId}`, { method: "DELETE" });
}

export async function updateExpense(
  expenseId: string,
  fields: { amount?: number; description?: string; category?: string; bank_id?: string | null },
): Promise<Expense> {
  return apiFetch<Expense>(`/expense/${expenseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function fetchBanks(): Promise<Bank[]> {
  try {
    return await apiFetch<Bank[]>("/settings/banks");
  } catch {
    return [];
  }
}

export async function createBank(name: string): Promise<Bank> {
  return apiFetch<Bank>("/settings/banks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteBank(bankId: string): Promise<void> {
  await apiFetch(`/settings/banks/${bankId}`, { method: "DELETE" });
}

export async function refreshInsights(): Promise<ZoneResponse> {
  return apiFetch<ZoneResponse>("/insights/refresh", { method: "POST" });
}

export interface MonthSettingsOut {
  salary: number | null;
  save_pct: number | null;
  month: number;
  year: number;
  locked: boolean;
}

export interface MonthlySummary {
  month: number;
  year: number;
  month_label: string;
  total_spent: number;
  salary: number;
  total_saved: number;
  zone: string | null;
  saving_score: number | null;
  spend_score: number | null;
}

export async function fetchSettings(month: number, year: number): Promise<MonthSettingsOut> {
  return apiFetch<MonthSettingsOut>(`/settings?month=${month}&year=${year}`);
}

export async function saveSettings(salary: number, save_pct: number, month: number, year: number): Promise<MonthSettingsOut> {
  return apiFetch<MonthSettingsOut>("/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ salary, save_pct, month, year }),
  });
}

export async function updateSettings(salary: number, save_pct: number, month: number, year: number): Promise<MonthSettingsOut> {
  return apiFetch<MonthSettingsOut>("/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ salary, save_pct, month, year }),
  });
}

export async function restartMonth(month: number, year: number): Promise<void> {
  await apiFetch(`/settings/restart?month=${month}&year=${year}`, { method: "DELETE" });
}

export interface InvestmentInsight {
  assessment: "GOOD" | "MODERATE" | "NEEDS_ATTENTION";
  summary: string;
  allocation_review: string;
  action_items: string[];
  priority_action: string;
}

export async function fetchInvestmentInsight(month: number, year: number): Promise<InvestmentInsight> {
  return apiFetch<InvestmentInsight>(`/insights/investment-review?month=${month}&year=${year}`, {
    method: "POST",
  });
}

export async function fetchMonthlyHistory(): Promise<MonthlySummary[]> {
  try {
    return await apiFetch<MonthlySummary[]>("/insights/monthly-history");
  } catch {
    return [];
  }
}
