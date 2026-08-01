import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvestmentItem, LedgerItem } from "./types";

export type SyncStatus = {
  connected: boolean;
  loadedAt: string;
  statusText: string;
  incomeExpensesCount: number;
  youngbeomCount: number;
  jaeeunCount: number;
  youngbeomTotal: number;
  jaeeunTotal: number;
};

export type RemoteFinanceState = {
  ledger: LedgerItem[];
  freeAssets: { name: string; amount: number }[];
  investmentAssets: InvestmentItem[];
  syncStatus: SyncStatus;
};

export const emptySyncStatus: SyncStatus = {
  connected: false,
  loadedAt: "-",
  statusText: "Supabase not configured",
  incomeExpensesCount: 0,
  youngbeomCount: 0,
  jaeeunCount: 0,
  youngbeomTotal: 0,
  jaeeunTotal: 0,
};

const pageSize = 1000;

const toAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const ownerTag = (owner: "영범" | "재은", value: unknown) => {
  const prefix = owner === "영범" ? "[YB]" : "[JE]";
  const rawName = String(value || "미분류 자산").trim();
  return rawName.startsWith(prefix) ? rawName : `${prefix} ${rawName}`;
};

const latestSyncTime = (rows: any[]) => {
  const latest = rows
    .map((row) => row.synced_at || row.created_at)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  return latest ? new Date(latest).toLocaleString("ko-KR") : "-";
};

async function fetchRowsSafe(supabase: SupabaseClient, table: string, orderColumn: string) {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      if (error.message.includes("Could not find the table")) {
        return { rows: [], missingTable: true, error: null as string | null };
      }
      return { rows: [], missingTable: false, error: `${table}: ${error.message}` };
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { rows, missingTable: false, error: null as string | null };
}

export const loadRemoteFinanceState = async (supabase: SupabaseClient): Promise<RemoteFinanceState> => {
  const [incomeExpensesRes, youngbeomRes, jaeeunRes] = await Promise.all([
    fetchRowsSafe(supabase, "income_expenses", "date"),
    fetchRowsSafe(supabase, "assets_youngbeom", "amount"),
    fetchRowsSafe(supabase, "assets_jaeeun", "amount"),
  ]);

  const ledger: LedgerItem[] = incomeExpensesRes.rows.map((row, index) => {
    const signedAmount = toAmount(row.amount);
    const amount = toAmount(row.amount_abs || Math.abs(signedAmount));
    const date = String(row.date || "").slice(0, 10);
    const type: LedgerItem["type"] = signedAmount > 0 || row.type === "수입" ? "수입" : "지출";

    return {
      id: Number(row.id) || 100000 + index,
      month: date ? date.slice(0, 7) : "미분류",
      type,
      category: String(row.category || "미분류"),
      content: String(row.content || row.memo || "거래 내역"),
      amount,
      active: true,
      date,
      memo: String(row.memo || ""),
      paymentMethod: String(row.payment_method || ""),
      spender: String(row.spender || ""),
    };
  });

  const freeAssets = [
    ...youngbeomRes.rows.map((row) => ({
      name: ownerTag("영범", row.name),
      amount: toAmount(row.amount),
    })),
    ...jaeeunRes.rows.map((row) => ({
      name: ownerTag("재은", row.name),
      amount: toAmount(row.amount),
    })),
  ];

  return {
    ledger,
    freeAssets,
    investmentAssets: [],
    syncStatus: {
      connected: !(incomeExpensesRes.missingTable || youngbeomRes.missingTable || jaeeunRes.missingTable),
      loadedAt: latestSyncTime([...incomeExpensesRes.rows, ...youngbeomRes.rows, ...jaeeunRes.rows]),
      statusText:
        incomeExpensesRes.error || youngbeomRes.error || jaeeunRes.error
          ? [incomeExpensesRes.error, youngbeomRes.error, jaeeunRes.error].filter(Boolean).join(" | ")
          : "Supabase DB sync active",
      incomeExpensesCount: incomeExpensesRes.rows.length,
      youngbeomCount: youngbeomRes.rows.length,
      jaeeunCount: jaeeunRes.rows.length,
      youngbeomTotal: youngbeomRes.rows.reduce((sum, row) => sum + toAmount(row.amount), 0),
      jaeeunTotal: jaeeunRes.rows.reduce((sum, row) => sum + toAmount(row.amount), 0),
    },
  };
};
