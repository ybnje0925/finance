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

const ownerTaggedName = (owner: "영범" | "재은", value: unknown) => {
  const rawName = String(value || "자산 항목").trim();
  return rawName.startsWith(`[${owner}]`) ? rawName : `[${owner}] ${rawName}`;
};

const latestSyncTime = (rows: any[]) => {
  const latest = rows
    .map((row) => row.synced_at || row.created_at)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  return latest ? new Date(latest).toLocaleString("ko-KR") : new Date().toLocaleString("ko-KR");
};

const fetchRows = async (supabase: SupabaseClient, table: string, orderColumn: string, ascending = false) => {
  const rows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
};

export const loadRemoteFinanceState = async (supabase: SupabaseClient): Promise<RemoteFinanceState> => {
  const [incomeExpenses, youngbeomAssets, jaeeunAssets] = await Promise.all([
    fetchRows(supabase, "income_expenses", "date", false),
    fetchRows(supabase, "assets_youngbeom", "amount", false),
    fetchRows(supabase, "assets_jaeeun", "amount", false),
  ]);

  const ledger: LedgerItem[] = incomeExpenses.map((row, index) => {
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
    ...youngbeomAssets.map((row) => ({
      name: ownerTaggedName("영범", row.name),
      amount: toAmount(row.amount),
    })),
    ...jaeeunAssets.map((row) => ({
      name: ownerTaggedName("재은", row.name),
      amount: toAmount(row.amount),
    })),
  ];

  const youngbeomTotal = youngbeomAssets.reduce((sum, row) => sum + toAmount(row.amount), 0);
  const jaeeunTotal = jaeeunAssets.reduce((sum, row) => sum + toAmount(row.amount), 0);

  return {
    ledger,
    freeAssets,
    investmentAssets: [],
    syncStatus: {
      connected: true,
      loadedAt: latestSyncTime([...incomeExpenses, ...youngbeomAssets, ...jaeeunAssets]),
      statusText: "Supabase DB sync active",
      incomeExpensesCount: incomeExpenses.length,
      youngbeomCount: youngbeomAssets.length,
      jaeeunCount: jaeeunAssets.length,
      youngbeomTotal,
      jaeeunTotal,
    },
  };
};
