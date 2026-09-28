// Thin fetch wrapper. The dev server proxies /api to the backend
// (see vite.config.ts); in production, nginx does the same (see
// frontend/nginx.conf) so the browser always calls a same-origin /api.

const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// --- Types (mirrors backend/app/schemas + models, kept minimal on purpose) ---

export type Account = {
  id: number;
  name: string;
  account_type: string;
  institution?: string | null;
  owner?: string | null;
  masked_number?: string | null;
  opening_balance: number;
  balance: number;
  is_archived: boolean;
  notes?: string | null;
};

export type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  is_system: boolean;
};

export type Label = { id: number; name: string; color?: string | null };

export type Counterparty = {
  id: number;
  display_name: string;
  relationship: string;
  aliases: string[];
  transaction_count: number;
  total_paid: number;
  total_received: number;
  net_balance: number;
  notes?: string | null;
};

export type Transaction = {
  id: number;
  date: string;
  time?: string | null;
  amount: number;
  direction: "debit" | "credit";
  raw_narration: string;
  raw_counterparty: string;
  account_id: number;
  transaction_type: string;
  counterparty_id: number | null;
  category_id: number | null;
  subcategory_id: number | null;
  notes?: string | null;
  needs_review: boolean;
  review_reason?: string | null;
  match_explanation?: string | null;
  is_ignored: boolean;
  labels: string[];
  source: string;
};

export type Rule = {
  id: number;
  name: string;
  description?: string | null;
  conditions: { field: string; operator: string; value: any }[];
  actions: { type: string; value?: any }[];
  priority: number;
  is_active: boolean;
  matched_count: number;
};

export type CommitmentStatus = {
  commitment_id: number;
  name: string;
  group_name: string | null;
  period: string;
  expected_amount: number;
  paid_amount: number;
  status: string;
  payments: { id: number; transaction_id: number | null; allocated_amount: number; source_type: string; is_manual: boolean; manual_note?: string | null; paid_date?: string | null }[];
};

export type CommitmentCalendarItem = {
  payment_id: number;
  commitment_id: number;
  commitment_name: string;
  group_name?: string | null;
  period: string;
  amount: number;
  source_type: string;
  is_manual: boolean;
  manual_note?: string | null;
  transaction_id: number | null;
};

export type CommitmentCalendarDay = {
  date: string;
  day: number;
  total_paid: number;
  items: CommitmentCalendarItem[];
};

export type CommitmentCalendarMonth = {
  month: string;
  days: CommitmentCalendarDay[];
  payments_count: number;
  days_with_payments: number;
  total_paid: number;
};

export type GoalProgress = {
  goal_id: number;
  name: string;
  target_amount: number | null;
  total_contributed: number;
  remaining: number | null;
  by_commitment: { commitment_id: number; commitment_name: string; total: number; ytd?: number }[];
  current_year?: number;
  ytd_contributed?: number;
  annual_scheduled_target?: number;
};

export type ImportBatch = {
  id: number;
  filename: string;
  imported_at: string;
  status: string;
  transactions_found: number;
  transactions_new: number;
  transactions_duplicate: number;
  transactions_failed: number;
  transactions_needs_review: number;
  error_message?: string | null;
};

export type ReviewInbox = {
  total: number;
  groups: { reason: string; count: number; transactions: any[] }[];
};
