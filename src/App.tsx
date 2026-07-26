/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Home, 
  DollarSign, 
  TrendingUp, 
  CheckSquare, 
  CreditCard, 
  PlusCircle, 
  Trash2, 
  Percent, 
  ArrowRight, 
  MapPin,
  User,
  Check,
  AlertTriangle, 
  HelpCircle,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  PieChart,
  BarChart2
} from "lucide-react";
import { read, utils } from "xlsx";
import { GoogleGenAI } from "@google/genai";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { LedgerItem, InvestmentItem, ChecklistItem, MortgagePayment } from "./types";
import { 
  MOVE_IN_DATE, 
  HUSBAND, 
  WIFE, 
  LOCATION, 
  ASSET_FREE_DEPOSITS, 
  ASSET_SAVINGS, 
  ASSET_ELECTRONIC, 
  ASSET_INVESTMENTS, 
  LIABILITY_MORTGAGE, 
  INITIAL_CHECKLIST, 
  INITIAL_LEDGER 
} from "./data";

function DonutChart({ value1, value2, label1, label2, color1 = "stroke-blue-600", color2 = "stroke-amber-500" }: { value1: number; value2: number; label1: string; label2: string; color1?: string; color2?: string }) {
  const total = value1 + value2;
  if (total === 0) return <div className="text-xs text-slate-400 text-center py-8">데이터가 없습니다</div>;
  const pct1 = (value1 / total) * 100;
  const pct2 = (value2 / total) * 100;
  
  const circ = 251.3;
  const strokeDash1 = (pct1 / 100) * circ;
  const strokeDash2 = (pct2 / 100) * circ;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-44 h-44">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" className="stroke-slate-100" strokeWidth="12" fill="transparent" />
          <circle cx="50" cy="50" r="40" className={color1} strokeWidth="12" fill="transparent"
            strokeDasharray={`${strokeDash1} ${circ}`}
            strokeDashoffset="0"
            strokeLinecap="round" />
          {value2 > 0 && (
            <circle cx="50" cy="50" r="40" className={color2} strokeWidth="12" fill="transparent"
              strokeDasharray={`${strokeDash2} ${circ}`}
              strokeDashoffset={-strokeDash1}
              strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">고정비 비율</span>
          <span className="text-xl font-bold font-mono text-blue-700">{pct1.toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex justify-center space-x-6 mt-4 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600"></span>
          <span className="text-slate-600 font-semibold">{label1}: {pct1.toFixed(1)}%</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span className="text-slate-600 font-semibold">{label2}: {pct2.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function SVGMultiPieChart({ items }: { items: [string, number][] }) {
  const total = items.reduce((sum, item) => sum + item[1], 0);
  if (total === 0) return <div className="text-xs text-slate-400 text-center py-8">데이터가 없습니다</div>;
  
  const circ = 251.3;
  let currentOffset = 0;
  
  const colors = [
    "stroke-emerald-500 bg-emerald-500",
    "stroke-blue-500 bg-blue-500",
    "stroke-purple-500 bg-purple-500",
    "stroke-rose-500 bg-rose-500",
    "stroke-amber-500 bg-amber-500"
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 p-4">
      <div className="relative w-44 h-44 shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" className="stroke-slate-50" strokeWidth="12" fill="transparent" />
          {items.map(([name, amount], idx) => {
            const pct = (amount / total) * 100;
            const strokeDash = (pct / 100) * circ;
            const strokeOffset = currentOffset;
            currentOffset -= strokeDash;

            return (
              <circle
                key={name}
                cx="50"
                cy="50"
                r="40"
                className={`${colors[idx % colors.length].split(" ")[0]}`}
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${strokeDash} ${circ}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top 5</span>
          <span className="text-xs text-slate-400 font-bold">지출 비중</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 w-full">
        {items.map(([name, amount], idx) => {
          const pct = (amount / total) * 100;
          return (
            <div key={name} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-50 transition-all">
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length].split(" ")[1]}`}></span>
                <span className="text-slate-700 font-bold">{name}</span>
              </div>
              <div className="text-right font-mono text-slate-500">
                <span className="font-bold text-slate-700 mr-2">{amount.toLocaleString()}원</span>
                <span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded font-extrabold">{pct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  // --- 1. LOCAL STORAGE & STATE INITIALIZATION ---
  const [activeTab, setActiveTab] = useState<"overview" | "ledger" | "analysis" | "assets">("overview");
  const [ledgerFileName, setLedgerFileName] = useState<string | null>(null);
  const [assetsFileName, setAssetsFileName] = useState<string | null>(null);

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
    }
    return dateStr;
  };
  
  const [ledger, setLedger] = useState<LedgerItem[]>(() => {
    const saved = localStorage.getItem("VIVALDI_LEDGER") || localStorage.getItem(" VIVALDI_LEDGER");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out dummy/mock items (ids 1-19, or anything below 100) to ensure complete removal of dummy data
          return parsed.filter((item: any) => item && item.id >= 100);
        }
      } catch (e) { /* ignore */ }
    }
    return INITIAL_LEDGER;
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const saved = localStorage.getItem("VIVALDI_CHECKLIST_V2");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_CHECKLIST;
  });

  const [mortgagePayments, setMortgagePayments] = useState<MortgagePayment[]>(() => {
    const saved = localStorage.getItem("VIVALDI_MORTGAGE_PAYMENTS");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("VIVALDI_LEDGER", JSON.stringify(ledger));
  }, [ledger]);

  useEffect(() => {
    localStorage.setItem("VIVALDI_CHECKLIST_V2", JSON.stringify(checklist));
  }, [checklist]);

  useEffect(() => {
    localStorage.setItem("VIVALDI_MORTGAGE_PAYMENTS", JSON.stringify(mortgagePayments));
  }, [mortgagePayments]);

  // --- 0. SUPABASE AUTH (부부 공유 로그인) ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [authView, setAuthView] = useState<"login" | "forgot" | "reset">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // 비밀번호를 잊었을 때: 이메일로 재설정 링크 발송
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  // 이메일의 재설정 링크를 타고 돌아왔을 때: 새 비밀번호 설정
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // 이메일의 재설정 링크를 클릭해서 돌아오면 Supabase가 이 이벤트를 발생시킨다.
      if (event === "PASSWORD_RECOVERY") {
        setAuthView("reset");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoginSubmitting(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    if (error) setLoginError(error.message);
    setLoginSubmitting(false);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setForgotSubmitting(true);
    setForgotError("");
    setForgotMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: window.location.origin
    });
    if (error) {
      setForgotError(error.message);
    } else {
      setForgotMessage("📧 입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.");
    }
    setForgotSubmitting(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setResetError("");
    if (newPassword.length < 6) {
      setResetError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setResetError("두 비밀번호가 서로 다릅니다.");
      return;
    }
    setResetSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setResetError(error.message);
      setResetSubmitting(false);
      return;
    }
    setResetMessage("✅ 비밀번호가 변경되었습니다. 이제 이 비밀번호로 로그인하세요.");
    setResetSubmitting(false);
    setNewPassword("");
    setNewPasswordConfirm("");
  };

  // --- 0b. SUPABASE DATA SYNC (영구 저장 + 부부간 실시간 공유) ---
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;

    const fetchAll = async () => {
      if (!supabase) return;
      const [ledgerRes, freeRes, investRes, checklistRes, paymentsRes, settingsRes] = await Promise.all([
        supabase.from("ledger_items").select("*"),
        supabase.from("asset_free_items").select("*"),
        supabase.from("asset_investment_items").select("*"),
        supabase.from("checklist_items").select("*").order("sort_order", { ascending: true }),
        supabase.from("mortgage_payments").select("*").order("payment_date", { ascending: true }),
        supabase.from("household_settings").select("*").eq("id", 1).maybeSingle()
      ]);
      if (cancelled) return;

      if (ledgerRes.data && ledgerRes.data.length > 0) {
        setLedger(ledgerRes.data.map((r: any) => ({
          id: r.id, month: r.month, type: r.type, category: r.category, content: r.content,
          amount: Number(r.amount), active: r.active, date: r.date,
          memo: r.memo || "", paymentMethod: r.payment_method || ""
        })));
      }
      if (freeRes.data && freeRes.data.length > 0) {
        setFreeAssets(freeRes.data.map((r: any) => ({ name: r.name, amount: Number(r.amount) })));
      }
      if (investRes.data && investRes.data.length > 0) {
        setInvestmentAssets(investRes.data.map((r: any) => ({
          name: r.name, principal: Number(r.principal), appraised: Number(r.appraised), yieldRate: Number(r.yield_rate)
        })));
      }
      if (checklistRes.data && checklistRes.data.length > 0) {
        setChecklist(checklistRes.data.map((r: any) => ({ id: r.id, label: r.label, done: r.done, sortOrder: r.sort_order })));
      }
      if (paymentsRes.data) {
        setMortgagePayments(paymentsRes.data.map((r: any) => ({ id: r.id, paymentDate: r.payment_date, amount: Number(r.amount), memo: r.memo || "" })));
      }
      if (settingsRes.data) {
        LIABILITY_MORTGAGE.name = settingsRes.data.mortgage_name;
        LIABILITY_MORTGAGE.amount = Number(settingsRes.data.mortgage_amount);
        LIABILITY_MORTGAGE.rate = Number(settingsRes.data.mortgage_rate);
        if (settingsRes.data.mortgage_start_date) LIABILITY_MORTGAGE.startDate = settingsRes.data.mortgage_start_date;
        if (settingsRes.data.mortgage_end_date) LIABILITY_MORTGAGE.endDate = settingsRes.data.mortgage_end_date;
        if (settingsRes.data.ledger_file_name) setLedgerFileName(settingsRes.data.ledger_file_name);
        if (settingsRes.data.assets_file_name) setAssetsFileName(settingsRes.data.assets_file_name);
      }
    };

    fetchAll();

    const channel = supabase
      .channel("household_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_items" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "asset_free_items" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "asset_investment_items" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "mortgage_payments" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_settings" }, fetchAll)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session]);

  // Supabase 쓰기 헬퍼 (로컬 상태는 이미 낙관적으로 갱신되고, 이 호출들은 다른 기기와의 동기화를 위한 것)
  // Supabase 쓰기 실패는 그동안 조용히 무시되고 있었다(콘솔에도 안 남음) — 실패가 실제로 보이도록 항상 error를 확인해 로그로 남긴다.
  const logSupabaseError = (label: string, error: { message: string } | null) => {
    if (error) {
      console.error(`[Supabase] ${label} 실패:`, error.message);
    }
  };

  const syncLedgerReplaceToSupabase = async (items: LedgerItem[]): Promise<boolean> => {
    if (!supabase || !session) return true;
    const { error: delError } = await supabase.from("ledger_items").delete().gte("id", 0);
    logSupabaseError("가계부 전체 삭제", delError);
    if (items.length > 0) {
      const { error: insError } = await supabase.from("ledger_items").insert(items.map(i => ({
        id: i.id, month: i.month, type: i.type, category: i.category, content: i.content,
        amount: i.amount, active: i.active, date: i.date, memo: i.memo || "", payment_method: i.paymentMethod || ""
      })));
      logSupabaseError("가계부 일괄 저장", insError);
      return !delError && !insError;
    }
    return !delError;
  };

  const upsertLedgerItemToSupabase = async (item: LedgerItem) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("ledger_items").upsert({
      id: item.id, month: item.month, type: item.type, category: item.category, content: item.content,
      amount: item.amount, active: item.active, date: item.date, memo: item.memo || "", payment_method: item.paymentMethod || ""
    });
    logSupabaseError("가계부 항목 저장", error);
  };

  const deleteLedgerItemFromSupabase = async (id: number) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("ledger_items").delete().eq("id", id);
    logSupabaseError("가계부 항목 삭제", error);
  };

  const syncAssetsReplaceToSupabase = async (free: { name: string; amount: number }[], investments: InvestmentItem[]): Promise<boolean> => {
    if (!supabase || !session) return true;
    let ok = true;
    const { error: delFreeError } = await supabase.from("asset_free_items").delete().gte("id", 0);
    logSupabaseError("자유입출금 자산 전체 삭제", delFreeError);
    ok = ok && !delFreeError;
    const { error: delInvError } = await supabase.from("asset_investment_items").delete().gte("id", 0);
    logSupabaseError("투자 자산 전체 삭제", delInvError);
    ok = ok && !delInvError;
    if (free.length > 0) {
      const { error } = await supabase.from("asset_free_items").insert(free.map(f => ({ name: f.name, amount: f.amount })));
      logSupabaseError("자유입출금 자산 저장", error);
      ok = ok && !error;
    }
    if (investments.length > 0) {
      const { error } = await supabase.from("asset_investment_items").insert(investments.map(i => ({
        name: i.name, principal: i.principal, appraised: i.appraised, yield_rate: i.yieldRate
      })));
      logSupabaseError("투자 자산 저장", error);
      ok = ok && !error;
    }
    return ok;
  };

  const upsertChecklistItemToSupabase = async (item: ChecklistItem) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("checklist_items").upsert({ id: item.id, label: item.label, done: item.done, sort_order: item.sortOrder });
    logSupabaseError("체크리스트 저장", error);
  };

  const deleteChecklistItemFromSupabase = async (id: number) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    logSupabaseError("체크리스트 삭제", error);
  };

  const insertMortgagePaymentToSupabase = async (payment: MortgagePayment) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("mortgage_payments").insert({
      id: payment.id, payment_date: payment.paymentDate, amount: payment.amount, memo: payment.memo || ""
    });
    logSupabaseError("대출 상환 기록 저장", error);
  };

  const deleteMortgagePaymentFromSupabase = async (id: number) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("mortgage_payments").delete().eq("id", id);
    logSupabaseError("대출 상환 기록 삭제", error);
  };

  // household_settings는 단일 행(id=1)이 미리 존재해야 update가 먹는데, 그 행이 없으면 update는
  // "성공"한 것처럼 보이면서 실제로는 아무것도 반영되지 않는다. upsert로 바꿔 행이 없어도 항상 반영되게 한다.
  const updateHouseholdSettingsInSupabase = async (patch: Record<string, unknown>) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("household_settings").upsert({ id: 1, ...patch });
    logSupabaseError("가계 설정 저장", error);
  };

  // --- 2. LEDGER MONTH SELECTION & FORM STATES ---
  const uniqueMonths = Array.from(new Set(ledger.map(item => item.month))).sort() as string[];
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-07");
  const [isMultiMonth, setIsMultiMonth] = useState<boolean>(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(["2026-07"]);

  // 자산 변동 추이 비교 월 (3번: 자산 탭에서 비교할 월들을 직접 선택)
  const [assetCompareMonths, setAssetCompareMonths] = useState<string[]>([]);

  // 재무적 지출 분석 탭: 카테고리별 상세 지출 드릴다운 선택 상태
  const [drilldownCategory, setDrilldownCategory] = useState<string>("전체");

  // Gemini 데이터 분석 챗봇: 개인 API Key는 이 브라우저에만 저장되고 외부로 전송되지 않는다.
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem("VIVALDI_GEMINI_KEY") || "");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("VIVALDI_GEMINI_KEY", geminiApiKey);
  }, [geminiApiKey]);

  // 직접 메모 기능 (VIVALDI_CATEGORY_MEMOS)
  const [categoryMemos, setCategoryMemos] = useState<Record<string, Record<string, string>>>(() => {
    const saved = localStorage.getItem("VIVALDI_CATEGORY_MEMOS");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // 초기 템플릿 메모
    return {
      "2026-07": {
        "식비": "집들이 및 이사 턱으로 과지출됨. 8월엔 외식 줄이기",
        "양육/기타": "어머니 감사수당 고정 지출",
        "주거/대출": "첫 주담대 정기 이자 정상 납부 완료",
        "공과금/관리비": "첫 관리비 계절 요인 분석 필요"
      }
    };
  });

  // 카테고리 메모 변경 핸들러
  const handleCategoryMemoChange = (month: string, category: string, value: string) => {
    setCategoryMemos(prev => {
      const updated = {
        ...prev,
        [month]: {
          ...(prev[month] || {}),
          [category]: value
        }
      };
      localStorage.setItem("VIVALDI_CATEGORY_MEMOS", JSON.stringify(updated));
      return updated;
    });
  };

  // 고정비/변동비 분류 상태
  const [categoryTypes, setCategoryTypes] = useState<Record<string, "고정비" | "변동비">>(() => {
    const saved = localStorage.getItem("VIVALDI_CATEGORY_TYPES");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* ignore */ }
    }
    return {};
  });

  const getCategoryType = (cat: string): "고정비" | "변동비" => {
    if (categoryTypes && categoryTypes[cat]) {
      return categoryTypes[cat];
    }
    // Default classifications based on keywords
    const fixedKeywords = [
      "보험", "통신비", "관리비", "주거비", "공과금", "세금", "구독", "교육", "대출", "월세", "통신", "서비스", "렌탈", "유치원", "어린이집", "학원", "이자", "관리"
    ];
    const lower = cat.toLowerCase();
    if (fixedKeywords.some(k => lower.includes(k))) {
      return "고정비";
    }
    return "변동비";
  };

  const toggleCategoryType = (cat: string) => {
    const current = getCategoryType(cat);
    const next = current === "고정비" ? "변동비" : "고정비";
    const updated = { ...categoryTypes, [cat]: next };
    setCategoryTypes(updated);
    localStorage.setItem("VIVALDI_CATEGORY_TYPES", JSON.stringify(updated));
  };

  // 세부 계좌 보기 토글 상태
  const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({
    free: false,
    savings: false,
    electronic: false,
    investment: false
  });

  const isDummyAsset = (name: string) => {
    const dummyKeywords = [
      "KB Star*t통장",
      "KB Wise통장",
      "KB국민ONE통장",
      "MY 입출금통장",
      "NH주거래우대통장",
      "WON 통장",
      "U드림 저축예금",
      "기타 입출금통장",
      "저금통",
      "NH올원e적금",
      "카카오페이 머니",
      "TIGER 미국S&P500",
      "KODEX 차이나테크TOP10",
      "100세연금저축펀드",
      "CMA계좌",
      "종합위탁계좌"
    ];
    return dummyKeywords.some(keyword => name.includes(keyword));
  };

  // --- 2a. STATEFUL ASSETS FOR BULK UPLOAD AND PERSISTENCE ---
  const [freeAssets, setFreeAssets] = useState<{ name: string; amount: number }[]>(() => {
    const saved = localStorage.getItem("VIVALDI_FREE_ASSETS");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: any) => item && item.name && !isDummyAsset(item.name));
        }
      } catch (e) {}
    }
    return ASSET_FREE_DEPOSITS;
  });

  const [savingsAssets, setSavingsAssets] = useState<{ name: string; amount: number }[]>(() => {
    const saved = localStorage.getItem("VIVALDI_SAVINGS_ASSETS");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: any) => item && item.name && !isDummyAsset(item.name));
        }
      } catch (e) {}
    }
    return ASSET_SAVINGS;
  });

  const [electronicAssets, setElectronicAssets] = useState<{ name: string; amount: number }[]>(() => {
    const saved = localStorage.getItem("VIVALDI_ELECTRONIC_ASSETS");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: any) => item && item.name && !isDummyAsset(item.name));
        }
      } catch (e) {}
    }
    return ASSET_ELECTRONIC;
  });

  const [investmentAssets, setInvestmentAssets] = useState<InvestmentItem[]>(() => {
    const saved = localStorage.getItem("VIVALDI_INVESTMENT_ASSETS");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: any) => item && item.name && !isDummyAsset(item.name));
        }
      } catch (e) {}
    }
    return ASSET_INVESTMENTS;
  });

  useEffect(() => {
    localStorage.setItem("VIVALDI_FREE_ASSETS", JSON.stringify(freeAssets));
  }, [freeAssets]);

  useEffect(() => {
    localStorage.setItem("VIVALDI_SAVINGS_ASSETS", JSON.stringify(savingsAssets));
  }, [savingsAssets]);

  useEffect(() => {
    localStorage.setItem("VIVALDI_ELECTRONIC_ASSETS", JSON.stringify(electronicAssets));
  }, [electronicAssets]);

  useEffect(() => {
    localStorage.setItem("VIVALDI_INVESTMENT_ASSETS", JSON.stringify(investmentAssets));
  }, [investmentAssets]);

  const toggleAssetExpand = (key: "free" | "savings" | "electronic" | "investment") => {
    setExpandedAssets(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleAssetCompareMonth = (m: string) => {
    setAssetCompareMonths(prev => {
      if (prev.includes(m)) {
        return prev.filter(x => x !== m);
      }
      return [...prev, m].sort();
    });
  };

  // 자산 비교 월 기본값: 원장에 기록된 월 중 최근 3개월을 자동 선택 (사용자가 언제든 직접 바꿀 수 있음)
  useEffect(() => {
    if (uniqueMonths.length === 0) return;
    setAssetCompareMonths(prev => {
      const stillValid = prev.filter(m => uniqueMonths.includes(m));
      if (stillValid.length > 0) return stillValid;
      return uniqueMonths.slice(-3);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.length]);

  // If the current selected month is not in uniqueMonths (e.g. all deleted), fallback
  useEffect(() => {
    if (uniqueMonths.length > 0 && !uniqueMonths.includes(selectedMonth)) {
      setSelectedMonth(uniqueMonths[uniqueMonths.length - 1]);
    }
  }, [ledger, uniqueMonths, selectedMonth]);

  // New item form state
  const [formMonth, setFormMonth] = useState("2026-07");
  const [formDate, setFormDate] = useState("2026-07-16");
  const [formType, setFormType] = useState<"수입" | "지출">("지출");
  const [formCategory, setFormCategory] = useState("식비");
  const [formContent, setFormContent] = useState("");
  const [formAmount, setFormAmount] = useState<number>(100000);

  useEffect(() => {
    setFormDate(prev => {
      const parts = prev.split("-");
      if (parts.length === 3) {
        return `${formMonth}-${parts[2]}`;
      }
      return `${formMonth}-15`;
    });
  }, [formMonth]);

  // --- 3. GENERAL METRICS CALCULATION ---
  // Financial aggregates
  const totalFree = freeAssets.reduce((sum, item) => sum + item.amount, 0);
  const totalSavings = savingsAssets.reduce((sum, item) => sum + item.amount, 0);
  const totalElectronic = electronicAssets.reduce((sum, item) => sum + item.amount, 0);
  
  // Custom stock state if users want to simulate, but let's calculate from ASSET_INVESTMENTS
  const totalInvestment = investmentAssets.reduce((sum, item) => sum + item.appraised, 0);
  const totalAssets = totalFree + totalSavings + totalElectronic + totalInvestment;
  const totalLiabilities = LIABILITY_MORTGAGE.amount;
  const netWorth = totalAssets - totalLiabilities;
  const cashAndLike = totalFree + totalSavings + totalElectronic;
  const totalAssetAndLike = cashAndLike + totalInvestment;
  const cashPercent = totalAssetAndLike > 0 ? Math.round((cashAndLike / totalAssetAndLike) * 1000) / 10 : 84.8;
  const investPercent = totalAssetAndLike > 0 ? Math.round((totalInvestment / totalAssetAndLike) * 1000) / 10 : 15.2;

  // Active ledger items for calculation
  const getMonthlyIncomes = (m: string) => {
    return ledger.filter(item => item.month === m && item.type === "수입" && item.active);
  };
  const getMonthlyExpenses = (m: string) => {
    return ledger.filter(item => item.month === m && item.type === "지출" && item.active);
  };

  const getSelectedMonthsIncomes = () => {
    if (isMultiMonth) {
      return ledger.filter(item => selectedMonths.includes(item.month) && item.type === "수입" && item.active);
    }
    return ledger.filter(item => item.month === selectedMonth && item.type === "수입" && item.active);
  };

  const getSelectedMonthsExpenses = () => {
    if (isMultiMonth) {
      return ledger.filter(item => selectedMonths.includes(item.month) && item.type === "지출" && item.active);
    }
    return ledger.filter(item => item.month === selectedMonth && item.type === "지출" && item.active);
  };

  const activeIncomeTotal = getSelectedMonthsIncomes().reduce((sum, item) => sum + item.amount, 0);
  const activeExpenseTotal = getSelectedMonthsExpenses().reduce((sum, item) => sum + item.amount, 0);
  const netMonthlyIncome = activeIncomeTotal - activeExpenseTotal;

  // --- 3.1 FINANCIAL EXPENSE BRIEFING ENGINE ---
  const calculateMonthlyBriefing = (m: string) => {
    const expenses = ledger.filter(item => item.month === m && item.type === "지출" && item.active);
    const incomes = ledger.filter(item => item.month === m && item.type === "수입" && item.active);
    
    const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    
    let fixedSum = 0;
    let variableSum = 0;
    const categoryTotals: Record<string, number> = {};
    
    const fixedKeywords = ["보험", "통신", "관리비", "주거", "공과금", "세금", "구독", "교육", "대출", "월세", "서비스", "렌탈", "유치원", "어린이집", "학원", "이자", "관리", "금융/보험", "주거/통신", "자동차(세금/보험)"];
    
    expenses.forEach(item => {
      const cat = item.category;
      const amt = item.amount;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      
      const catLower = cat.toLowerCase();
      if (fixedKeywords.some(k => catLower.includes(k))) {
        fixedSum += amt;
      } else {
        variableSum += amt;
      }
    });
    
    const fixedRatio = totalExpense > 0 ? (fixedSum / totalExpense * 100) : 0;
    const variableRatio = totalExpense > 0 ? (variableSum / totalExpense * 100) : 0;
    
    let foodSum = 0;
    let insuranceSum = 0;
    
    const foodKeywords = ["식비", "마트", "배달", "외식", "식재료", "커피", "음료", "양식", "한식", "중식", "일식", "편의점", "카페", "간식", "장보기"];
    const insuranceKeywords = ["보험", "보장성", "실비", "종신", "연금", "금융/보험"];
    
    expenses.forEach(item => {
      const cat = item.category;
      const amt = item.amount;
      const catLower = cat.toLowerCase();
      if (foodKeywords.some(k => catLower.includes(k))) {
        foodSum += amt;
      }
      if (insuranceKeywords.some(k => catLower.includes(k))) {
        insuranceSum += amt;
      }
    });
    
    const foodRatio = totalExpense > 0 ? (foodSum / totalExpense * 100) : 0;
    const insuranceRatio = totalExpense > 0 ? (insuranceSum / totalExpense * 100) : 0;
    
    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const top5 = sortedCategories.slice(0, 5) as [string, number][];
    
    const insights: string[] = [];
    insights.push(`📅 **${m}월 총 지출은 ${totalExpense.toLocaleString()}원**입니다.`);
    
    const fixedStatus = fixedRatio <= 40 ? "적정 수준(40% 이하)이며" : "다소 높은 편(40% 초과)으로 집중 관리가 필요하며";
    insights.push(`고정비 비중이 **${fixedRatio.toFixed(1)}% (${fixedSum.toLocaleString()}원)**로 ${fixedStatus}, 변동비 비중은 **${variableRatio.toFixed(1)}% (${variableSum.toLocaleString()}원)**입니다.`);
    
    if (foodSum > 0) {
      insights.push(`특히 **식비 지출(${foodSum.toLocaleString()}원)**이 전체 소비의 **${foodRatio.toFixed(1)}%**를 차지하여 가장 큰 비중을 보입니다.`);
    }
    if (insuranceSum > 0) {
      insights.push(`**보험료/금융 지출(${insuranceSum.toLocaleString()}원)**은 전체 지출의 **${insuranceRatio.toFixed(1)}%**입니다.`);
    }
    if (variableRatio > 50) {
      insights.push("변동비 비중이 높은 편이므로 불필요한 외식이나 불필요한 소액 변동 지출을 조금만 줄여도 추가적인 저축과 예적금 여력을 확보할 수 있습니다.");
    } else {
      insights.push("변동비 지출이 훌륭히 잘 관리되고 있으며, 남는 잉여 자금은 즉시 저축 또는 투자 자산으로 배분하는 것이 유리합니다.");
    }
    
    const summaryText = insights.join(" ");
    
    return {
      totalIncome,
      totalExpense,
      fixedSum,
      variableSum,
      fixedRatio,
      variableRatio,
      foodSum,
      foodRatio,
      insuranceSum,
      insuranceRatio,
      top5,
      summaryText
    };
  };

  // --- 5. ENHANCED AI WEALTH ADVISOR REPORT ENGINE ---
  const renderAiReport = () => {
    // 1) 식비 및 양육/기타 변동비 항목의 적정성 평가
    const selectedExpenses = ledger.filter(item => item.month === selectedMonth && item.type === "지출" && item.active);
    
    const isFood = (cat: string) => {
      const lower = cat.toLowerCase();
      return ["식비", "마트", "배달", "외식", "식재료", "커피", "음료", "양식", "한식", "중식", "일식", "편의점", "카페", "간식", "음품", "푸드", "장보기"].some(k => lower.includes(k));
    };
    const isChild = (cat: string) => {
      const lower = cat.toLowerCase();
      return ["양육", "육아", "교육", "어린이집", "유치원", "학원", "기타", "양육/기타"].some(k => lower.includes(k));
    };

    const foodCost = selectedExpenses.filter(item => isFood(item.category)).reduce((sum, item) => sum + item.amount, 0);
    const childCost = selectedExpenses.filter(item => isChild(item.category)).reduce((sum, item) => sum + item.amount, 0);
    const totalSelectedExpense = selectedExpenses.reduce((sum, item) => sum + item.amount, 0) || 1;

    const foodRatio = Math.round((foodCost / totalSelectedExpense) * 100);
    const childRatio = Math.round((childCost / totalSelectedExpense) * 100);
    
    // 식비 적정성 평가 (30대 부부 적정 식비 권장 비율은 전체 지출의 15%~25% 내외)
    let foodStatus = "적정 수준 유지 중";
    let foodGuidance = "건강하고 균형잡힌 가계 소비 흐름을 이어가고 있습니다.";
    if (foodRatio > 25) {
      foodStatus = "식비 비중 다소 높음 (주의)";
      foodGuidance = "이마트 장보기 및 외식 횟수가 증가했습니다. 비필수 식자재 공동구매나 감이동 로컬 마트 특가를 활용해 지출을 5% 이상 억제해 보세요.";
    } else if (foodRatio < 10 && foodCost > 0) {
      foodStatus = "식비 극단적 절약 중";
      foodGuidance = "가계 다이어트가 훌륭하나, 신혼 부부의 영양 균형과 생활 만족도를 위해 지나친 외식 통제보다는 계획적 지출을 권장합니다.";
    }

    // 양육비 평가 (30대 양육비 비중 가이드: 감사수당 등 고정 지출 포함 20~30% 내외)
    let childStatus = "계획적 범위 내 집행";
    let childGuidance = "어머니 감사 수당 등 부모 보조 양육비가 규칙적으로 안정되게 관리되고 있습니다.";
    if (childRatio > 35) {
      childStatus = "양육비 과밀화 상태 (정밀 모니터링)";
      childGuidance = "돌발 육아용품 구매 또는 육아 인프라 초기 셋업 비용이 증가했습니다. 당장 급하지 않은 교구 등은 당근마켓 거래를 적극 제안합니다.";
    }

    // 2) 가용 자금 및 실시간 수지 피드백
    const isSurplus = netMonthlyIncome >= 0;
    const surplusText = isSurplus 
      ? `현재 당월 순수입(잉여 자금) ${netMonthlyIncome.toLocaleString()}원은 즉시 아래의 3대 자산배분 황금 공식에 태워 조기 운용해야 합니다.`
      : `현재 당월 재정이 ${Math.abs(netMonthlyIncome).toLocaleString()}원 적자 상태입니다. 주택담보대출 이자 및 초기 이사 부대 비용이 겹친 결과로 보이며, 자유입출금 자산에서 예비비를 수혈해야 합니다.`;

    return (
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 border border-indigo-500/20 shadow-xl space-y-6 text-white" id="ai_wealth_report_panel">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 p-2 rounded-xl animate-pulse">
              <PiggyBank className="w-5.5 h-5.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>🤵 AI 수석 자산관리사 리포트</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-indigo-500/30 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Premium Advisor</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">30대 신혼 및 맞벌이 가구 자산 가이드라인 템플릿 표준 적용</p>
            </div>
          </div>
        </div>

        {/* Advisor Persona Intro */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-xs sm:text-sm text-slate-200">
          <p className="font-bold text-emerald-400 text-sm">
            🎯 "최영범 님, 강재은 님! 맞벌이 부부의 탄탄하고 계획적인 자산 형성을 위한 스마트 재정 여정을 응원합니다!"
          </p>
          <p className="leading-relaxed">
            자녀 계획 및 초보 부모 세대인 <strong>30대 중반 맞벌이 부부</strong>의 재정 핵심은 <span className="text-indigo-300 font-bold">"부채 원금 상환을 통한 고정비 절감"</span>과 <span className="text-orange-300 font-bold">"생애 첫 주택 마련 이후 자산 포트폴리오의 영리한 체질 개선"</span>에 있습니다. 현재 가계 재정 지표를 전문 자산관리사의 프레임으로 입체 분석해 드리겠습니다.
          </p>
        </div>

        {/* Two-Column Diagnostic */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Diagnostic 1: Variable Costs */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4.5 space-y-3.5">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📉</span> 당월 ({selectedMonth}월) 변동비 적정성 진단
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                <span className="text-slate-400">🍔 당월 식비 지출 비율:</span>
                <span className="font-bold font-mono text-emerald-400">{foodRatio}% ({foodCost.toLocaleString()}원)</span>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                <span className="text-slate-400">🍼 당월 양육/기타 비율:</span>
                <span className="font-bold font-mono text-emerald-400">{childRatio}% ({childCost.toLocaleString()}원)</span>
              </div>
              
              <div className="pt-2 border-t border-white/5 space-y-1.5 leading-relaxed text-slate-300">
                <p><strong>[식비] {foodStatus}:</strong> {foodGuidance}</p>
                <p><strong>[양육비] {childStatus}:</strong> {childGuidance}</p>
              </div>
            </div>
          </div>

          {/* Diagnostic 2: Portfolio Asset Allocation */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4.5 space-y-3.5">
            <h4 className="text-xs font-bold text-orange-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏛️</span> 포트폴리오 안전성 및 예적금 과다 편중 진단
            </h4>
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                현재 가계 자산의 <span className="text-red-300 font-bold">84.8%가 예적금 및 현금성 자산</span>에 과도하게 치우쳐 있습니다. 저금리 현금 유치는 대출 금리보다 실질 수익률이 낮아 장기적으로 자산 가치가 잠식됩니다.
              </p>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1 text-[11px]">
                <span className="text-orange-400 font-bold block">💡 AI 자산관리사의 황금 분배 제안:</span>
                현재 NH주택담보대출 6억 원의 금리가 <strong>연 4.08%</strong>로 상당한 고금리 부담입니다. 자산관리 관점에서 <span className="text-emerald-300 font-bold">"대출 원금 중도상환 대 미국 S&P500 분할 투자"를 6:4의 황금 비율</span>로 가져가세요.
                대출 이자율인 4.08%는 확정적 고수익율과 같으므로, 여유자금이 생길 때마다 적극 중도 상환하여 이자 누출을 원천 단축하고, 나머지 40%는 복리 효과가 검증된 TIGER 미국S&P500(+50.33% 수익 입증됨)에 적립식으로 지속 분할 매수하는 것이 압도적으로 유리합니다.
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Plan */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-xs sm:text-sm space-y-2">
          <p className="font-bold text-emerald-400 flex items-center gap-2">
            <span>🚀</span> 실시간 피드백 기반 금월 재정 투입 계획
          </p>
          <p className="text-slate-300 leading-relaxed">
            {surplusText} 
            {isSurplus && (
              <span className="block mt-2 text-slate-200 font-bold">
                추천 배분안: 중도원금상환액 {(netMonthlyIncome * 0.6).toLocaleString()}원 (60%) + 미국 S&P500 적립 투자 {(netMonthlyIncome * 0.4).toLocaleString()}원 (40%) 투입을 설계하세요.
              </span>
            )}
          </p>
        </div>
      </div>
    );
  };

  // Add item handler
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    const newItem: LedgerItem = {
      id: Date.now(),
      month: formMonth,
      type: formType,
      category: formCategory,
      content: formContent,
      amount: formAmount,
      active: true,
      date: formDate
    };

    setLedger(prev => [...prev, newItem]);
    upsertLedgerItemToSupabase(newItem);
    setFormContent("");
    // Switch filter to the month of the added item so they see it
    setSelectedMonth(formMonth);
  };

  // Gemini 데이터 분석 챗봇: 업로드된 수입/지출·자산 데이터를 컨텍스트로 전달해 질문에 답한다.
  const handleSendChatMessage = async () => {
    const question = chatInput.trim();
    if (!question || chatLoading) return;

    setChatMessages(prev => [...prev, { role: "user", text: question }]);
    setChatInput("");

    const trimmedKey = geminiApiKey.trim();
    if (!trimmedKey) {
      setChatMessages(prev => [...prev, { role: "assistant", text: "🔑 개인 Gemini API Key를 입력해 주세요." }]);
      return;
    }

    setChatLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: trimmedKey });

      const ledgerContext = ledger.map(item => ({
        월: item.month,
        구분: item.type,
        카테고리: item.category,
        내용: item.content,
        금액: item.amount,
        활성화: item.active
      }));
      const assetContext = {
        자유입출금및예적금: freeAssets,
        투자자산: investmentAssets,
        부채: { 명칭: LIABILITY_MORTGAGE.name, 금액: LIABILITY_MORTGAGE.amount, 금리: LIABILITY_MORTGAGE.rate },
        가계총자산: totalAssets
      };

      const prompt = `당신은 '${LOCATION}'에 거주하는 ${HUSBAND.name}·${WIFE.name} 부부의 가계부 데이터 분석 비서입니다.
아래는 이 가계의 실제 수입/지출 내역(JSON)과 자산 요약(JSON)입니다. 오직 이 데이터를 근거로 사용자의 질문에 한국어로 간결하고 정확하게 답변하세요. 금액은 천 단위 콤마와 "원" 단위로 표기하세요.

[수입/지출 내역]
${JSON.stringify(ledgerContext)}

[자산 요약]
${JSON.stringify(assetContext)}

[질문]
${question}`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });

      setChatMessages(prev => [...prev, { role: "assistant", text: response.text || "응답을 생성하지 못했습니다." }]);
    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: "assistant", text: "⚠️ Gemini API 호출 중 오류가 발생했습니다. API Key가 올바른지 확인해 주세요." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // --- 2b. EXCEL DATA PARSING ENGINES (SMART UNIFIED SPLIT SHIELD) ---
  const handleLedgerExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: "binary" });

        const allParsedLedgerItems: LedgerItem[] = [];
        let anySheetParsed = false;

        for (const wsname of wb.SheetNames) {
          const ws = wb.Sheets[wsname];
          const rows = utils.sheet_to_json<any[]>(ws, { header: 1 });
          if (!rows || rows.length === 0) continue;

          let headerRowIdx = -1;
          for (let r = 0; r < Math.min(rows.length, 10); r++) {
            const row = rows[r];
            if (!row) continue;
            let hasDate = false;
            let hasType = false;
            let hasAmount = false;
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || "").trim().toLowerCase();
              if (["날짜", "일자", "일시", "date", "time"].some(k => val.includes(k))) hasDate = true;
              if (["구분", "타입", "구분유형", "type", "수입지출", "수입/지출"].some(k => val.includes(k))) hasType = true;
              if (["금액", "원", "amount", "price"].some(k => val.includes(k))) hasAmount = true;
            }
            if (hasDate && hasType && hasAmount) {
              headerRowIdx = r;
              break;
            }
          }

          const isLedgerSheetName = wsname.includes("내역") || wsname.includes("가계부") || wsname.includes("ledger");

          if (headerRowIdx !== -1 || isLedgerSheetName) {
            const finalHeaderRowIdx = headerRowIdx !== -1 ? headerRowIdx : 0;
            const headerRow = rows[finalHeaderRowIdx] || [];
            const colIndices = {
              date: -1,
              type: -1,
              category: -1,
              content: -1,
              amount: -1,
              memo: -1,
              paymentMethod: -1
            };

            for (let c = 0; c < headerRow.length; c++) {
              const val = String(headerRow[c] || "").trim().toLowerCase();
              if (["날짜", "일자", "일시", "date", "time"].some(k => val.includes(k))) colIndices.date = c;
              if (["구분", "타입", "구분유형", "type", "수입지출", "수입/지출"].some(k => val.includes(k))) colIndices.type = c;
              if (["카테고리", "분류", "대분류", "소분류", "category"].some(k => val.includes(k))) colIndices.category = c;
              if (["내용", "거래처", "상세", "적요", "content"].some(k => val.includes(k))) colIndices.content = c;
              if (["메모", "memo", "비고", "note"].some(k => val.includes(k))) colIndices.memo = c;
              if (["결제수단", "지급수단", "결제", "카드", "payment", "method"].some(k => val.includes(k))) colIndices.paymentMethod = c;
              if (["금액", "원", "amount", "price"].some(k => val.includes(k))) colIndices.amount = c;
            }

            const parsedItems: LedgerItem[] = [];
            for (let r = finalHeaderRowIdx + 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0) continue;

              const rawDate = colIndices.date !== -1 ? row[colIndices.date] : undefined;
              const rawType = colIndices.type !== -1 ? row[colIndices.type] : undefined;
              const rawCategory = colIndices.category !== -1 ? row[colIndices.category] : undefined;
              const rawContent = colIndices.content !== -1 ? row[colIndices.content] : undefined;
              const rawAmount = colIndices.amount !== -1 ? row[colIndices.amount] : undefined;
              const rawMemo = colIndices.memo !== -1 ? row[colIndices.memo] : undefined;
              const rawPaymentMethod = colIndices.paymentMethod !== -1 ? row[colIndices.paymentMethod] : undefined;

              // "이체" 중에서도 내 계좌끼리 옮긴 것(예: 대분류가 "내계좌이체")만 실제 수입/지출이 아니므로 제외한다.
              // 다른 사람에게 보내거나 받은 이체(예: 지인에게 송금)는 실제 자금 이동이므로 금액 부호에 따라 지출/수입으로 반영한다.
              if (rawCategory !== undefined) {
                const transferCategoryCheck = String(rawCategory).trim();
                if (["내계좌", "내 계좌"].some(k => transferCategoryCheck.includes(k))) continue;
              }

              if (rawDate === undefined && rawAmount === undefined) continue;

              let originalAmount = 0;
              if (rawAmount !== undefined) {
                if (typeof rawAmount === "number") {
                  originalAmount = rawAmount;
                } else {
                  originalAmount = parseInt(String(rawAmount).replace(/[^0-9-]/g, "")) || 0;
                }
              }

              let amount = Math.abs(originalAmount);
              if (amount === 0) continue;

              let type: "수입" | "지출" = "지출";
              if (rawType !== undefined) {
                const tStr = String(rawType).trim();
                if (tStr.includes("수입") || tStr.toLowerCase() === "income" || tStr.toLowerCase() === "deposit") {
                  type = "수입";
                }
              }

              // [핵심 요구사항] 타입이 '지출'이더라도 금액이 0보다 큰 양수(금액 > 0)인 항목은 지출 리스트에서 제외하고 '수입 내역'으로 자동 이동/분류
              if (type === "지출" && originalAmount > 0) {
                type = "수입";
              }

              let dateStr = "";
              let monthStr = "";

              if (rawDate !== undefined) {
                if (typeof rawDate === "number") {
                  const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
                  if (!isNaN(dateObj.getTime())) {
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    dateStr = `${year}-${month}-${day}`;
                    monthStr = `${year}-${month}`;
                  }
                } else {
                  const cleanDate = String(rawDate).replace(/[^0-9./-]/g, "").trim();
                  const match = cleanDate.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
                  if (match) {
                    const y = match[1];
                    const m = match[2].padStart(2, "0");
                    const d = match[3].padStart(2, "0");
                    dateStr = `${y}-${m}-${d}`;
                    monthStr = `${y}-${m}`;
                  }
                }
              }

              if (!dateStr) {
                dateStr = new Date().toISOString().substring(0, 10);
              }
              if (!monthStr) {
                monthStr = dateStr.substring(0, 7);
              }

              const category = rawCategory ? String(rawCategory).trim() : (type === "수입" ? "급여" : "식비");
              const content = rawContent ? String(rawContent).trim() : `${category} 항목`;
              const memo = rawMemo !== undefined && rawMemo !== null ? String(rawMemo).trim() : "";
              const paymentMethod = rawPaymentMethod !== undefined && rawPaymentMethod !== null ? String(rawPaymentMethod).trim() : "";

              parsedItems.push({
                id: Date.now() + r,
                month: monthStr,
                type,
                category,
                content,
                amount,
                active: true,
                date: dateStr,
                memo,
                paymentMethod
              });
            }

            if (parsedItems.length > 0) {
              allParsedLedgerItems.push(...parsedItems);
              anySheetParsed = true;
            }
          }
        }

        if (allParsedLedgerItems.length > 0) {
          // 원본 내역을 있는 그대로 반영한다. 날짜/분류/내용/금액이 같더라도 실제로는
          // 서로 다른 거래(같은 가맹점에서의 반복 결제, 카드+포인트 분할결제 등)일 수 있으므로
          // 임의로 "중복"이라 간주해 걸러내지 않는다.
          const uniqueItems: LedgerItem[] = allParsedLedgerItems;

          setLedger(uniqueItems); // Overwrite completely with the freshly uploaded ledger
          setLedgerFileName(file.name);

          if (uniqueItems[0]?.month) {
            setSelectedMonth(uniqueItems[0].month);
            if (isMultiMonth && !selectedMonths.includes(uniqueItems[0].month)) {
              setSelectedMonths(prev => [...prev, uniqueItems[0].month].sort());
            }
          }

          syncLedgerReplaceToSupabase(uniqueItems).then(ok => {
            if (!ok) {
              alert("⚠️ 이 브라우저에는 반영됐지만, Supabase 저장에 실패했습니다. 개발자 도구 콘솔을 확인해 주세요.");
            }
          });
          updateHouseholdSettingsInSupabase({ ledger_file_name: file.name });

          alert(`🎉 수입/지출 내역 ${uniqueItems.length}건이 성공적으로 연동되었습니다!`);
        } else {
          alert("업로드된 파일에서 유효한 수입/지출 내역 시트를 발견하지 못했습니다.");
        }
      } catch (error) {
        console.error(error);
        alert("수입/지출 내역 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAssetsExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: "binary" });

        // 시트별로 파싱한 결과를 여기에 누적한다(이전엔 시트마다 덮어써서 여러 명의 시트가 있으면
        // 마지막 시트만 남는 버그가 있었음 - 부부 각자 시트를 합산하려면 누적이 필수).
        const combinedFree: typeof ASSET_FREE_DEPOSITS = [];
        const combinedInvestMap = new Map<string, InvestmentItem>();
        let combinedMortgageAmount: number | null = null;
        let combinedMortgageRate: number | null = null;

        let assetsSuccessCount = 0;
        let anySheetParsed = false;

        const genericAssetSheetKeywords = ["현황", "자산", "재무", "뱅샐", "고객", "asset"];

        for (const wsname of wb.SheetNames) {
          const ws = wb.Sheets[wsname];
          const rows = utils.sheet_to_json<any[]>(ws, { header: 1 });
          if (!rows || rows.length === 0) continue;

          const isAssetsSheetName = genericAssetSheetKeywords.some(k => wsname.toLowerCase().includes(k.toLowerCase()));
          const textContent = rows.map(r => r.join(" ")).join("\n").toLowerCase();

          // 시트 이름이 "현황/자산/재무/뱅샐/고객/asset" 같은 일반 구조 키워드가 아니라면
          // (예: "영범", "재은") 실제 명의로 간주하여 계좌명 앞에 명의 태그를 붙인다.
          const ownerTag = isAssetsSheetName ? "" : `[${wsname}] `;

          if (isAssetsSheetName || rows.some(row => row && row.some(val => typeof val === "string" && ["고객정보", "재무현황", "자산", "부채"].some(k => val.includes(k))))) {
            let parsedStructured = false;

            if (textContent.includes("고객정보") || textContent.includes("재무현황") || textContent.includes("투자현황") || textContent.includes("대출현황")) {
              const newFree: typeof ASSET_FREE_DEPOSITS = [];
              const newInvestments: typeof ASSET_INVESTMENTS = [];
              let mortgageAmount: number | null = null;
              let mortgageRate: number | null = null;

              let currentCategory = "";

              // "N.재무현황" 표 헤더(항목/상품명/금액이 자산·부채 두 블록으로 나란히 배치됨)를 찾는다.
              // 항목(구분) 값은 각 카테고리의 첫 행에만 표시되고 이후 행은 공란이므로,
              // 반드시 "마지막으로 읽은 항목 값"을 다음 행에 이어받아야(carry-forward) 각 카테고리의 첫 행을 놓치지 않는다.
              let assetHeaderRowIdx = -1;
              for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const hasItem = row.some(c => String(c || "").trim() === "항목");
                const hasName = row.some(c => String(c || "").trim() === "상품명");
                const hasAmount = row.some(c => String(c || "").trim() === "금액");
                if (hasItem && hasName && hasAmount) {
                  assetHeaderRowIdx = r;
                  break;
                }
              }

              const investMap = new Map<string, InvestmentItem>();

              if (assetHeaderRowIdx !== -1) {
                const headerRow = rows[assetHeaderRowIdx];
                const itemCols: number[] = [];
                const nameCols: number[] = [];
                const amountCols: number[] = [];
                headerRow.forEach((cell, i) => {
                  const v = String(cell || "").trim();
                  if (v === "항목") itemCols.push(i);
                  else if (v === "상품명") nameCols.push(i);
                  else if (v === "금액") amountCols.push(i);
                });

                const assetItemCol = itemCols[0];
                const assetNameCol = nameCols[0];
                const assetAmountCol = amountCols[0];
                const liabItemCol = itemCols[1];
                const liabNameCol = nameCols[1];
                const liabAmountCol = amountCols[1];

                let currentLiabCategory = "";

                for (let r = assetHeaderRowIdx + 1; r < rows.length; r++) {
                  const row = rows[r];
                  if (!row || row.length === 0) continue;

                  if (assetItemCol !== undefined) {
                    const itemCell = row[assetItemCol];
                    if (typeof itemCell === "string" && itemCell.trim().length > 0) {
                      currentCategory = itemCell.trim();
                    }

                    if (currentCategory.includes("총자산")) {
                      break;
                    }

                    const nameCell = assetNameCol !== undefined ? row[assetNameCol] : undefined;
                    const amountCell = assetAmountCol !== undefined ? row[assetAmountCol] : undefined;

                    if (typeof nameCell === "string" && nameCell.trim().length > 0 && typeof amountCell === "number") {
                      const name = ownerTag + nameCell.trim();
                      const amount = Math.abs(amountCell);

                      if (currentCategory.includes("자유입출금") || currentCategory.includes("현금") || currentCategory.includes("저축성") || currentCategory.includes("전자금융")) {
                        if (!newFree.some(f => f.name === name)) {
                          newFree.push({ name, amount });
                        }
                      } else if (currentCategory.includes("투자성") || currentCategory.includes("주식")) {
                        if (!investMap.has(name)) {
                          investMap.set(name, { name, principal: amount, appraised: amount, yieldRate: 0 });
                        }
                      }
                      // 보험 자산 / 연금 자산 / 부동산 / 동산 / 기타 실물 자산 / 신탁 자산은 현금성·투자성 자산이 아니므로 제외
                    }
                  }

                  if (liabItemCol !== undefined) {
                    const liabItemCell = row[liabItemCol];
                    if (typeof liabItemCell === "string" && liabItemCell.trim().length > 0) {
                      currentLiabCategory = liabItemCell.trim();
                    }
                    const liabNameCell = liabNameCol !== undefined ? row[liabNameCol] : undefined;
                    const liabAmountCell = liabAmountCol !== undefined ? row[liabAmountCol] : undefined;
                    if (
                      typeof liabAmountCell === "number" &&
                      ((typeof liabNameCell === "string" && (liabNameCell.includes("주택담보대출") || liabNameCell.includes("주담대"))) || currentLiabCategory.includes("장기대출"))
                    ) {
                      mortgageAmount = Math.abs(liabAmountCell);
                    }
                  }
                }
              }

              // "N.투자현황" 상세 표(상품명/투자원금/평가금액/수익률)에서 더 정확한 값을 찾아 덮어쓴다.
              for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const hasPrincipalHeader = row.some(c => String(c || "").trim() === "투자원금");
                const hasAppraisedHeader = row.some(c => String(c || "").trim() === "평가금액");
                if (!hasPrincipalHeader || !hasAppraisedHeader) continue;

                const nameColIdx = row.findIndex(c => String(c || "").trim() === "상품명");
                const principalColIdx = row.findIndex(c => String(c || "").trim() === "투자원금");
                const appraisedColIdx = row.findIndex(c => String(c || "").trim() === "평가금액");
                const yieldColIdx = row.findIndex(c => String(c || "").trim() === "수익률");

                for (let rr = r + 1; rr < rows.length; rr++) {
                  const dRow = rows[rr];
                  if (!dRow) continue;
                  const nameVal = nameColIdx !== -1 ? dRow[nameColIdx] : undefined;
                  if (typeof nameVal === "string" && (nameVal.includes("총계") || nameVal.includes("보유상품개수"))) break;

                  const principalVal = principalColIdx !== -1 ? dRow[principalColIdx] : undefined;
                  const appraisedVal = appraisedColIdx !== -1 ? dRow[appraisedColIdx] : undefined;
                  if (typeof nameVal === "string" && nameVal.trim().length > 0 && typeof principalVal === "number" && typeof appraisedVal === "number") {
                    const name = ownerTag + nameVal.trim();
                    const rawYield = yieldColIdx !== -1 ? dRow[yieldColIdx] : undefined;
                    const yieldRate = typeof rawYield === "number"
                      ? Math.round(rawYield * 100) / 100
                      : (principalVal !== 0 ? Math.round(((appraisedVal - principalVal) / principalVal) * 10000) / 100 : 0);
                    investMap.set(name, { name, principal: Math.abs(principalVal), appraised: Math.abs(appraisedVal), yieldRate });
                  }
                }
                break;
              }

              // "N.대출현황" 상세 표(상품명/대출잔액/대출금리)에서 주담대 잔액·금리를 더 정확히 반영한다.
              for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const hasBalanceHeader = row.some(c => String(c || "").trim() === "대출잔액");
                const hasRateHeader = row.some(c => String(c || "").trim() === "대출금리");
                if (!hasBalanceHeader || !hasRateHeader) continue;

                const nameColIdx = row.findIndex(c => String(c || "").trim() === "상품명");
                const balanceColIdx = row.findIndex(c => String(c || "").trim() === "대출잔액");
                const rateColIdx = row.findIndex(c => String(c || "").trim() === "대출금리");

                for (let rr = r + 1; rr < rows.length; rr++) {
                  const dRow = rows[rr];
                  if (!dRow) continue;
                  const nameVal = nameColIdx !== -1 ? dRow[nameColIdx] : undefined;
                  if (typeof nameVal === "string" && nameVal.includes("총계")) break;

                  if (typeof nameVal === "string" && (nameVal.includes("주택담보대출") || nameVal.includes("주담대"))) {
                    const balanceVal = balanceColIdx !== -1 ? dRow[balanceColIdx] : undefined;
                    const rateVal = rateColIdx !== -1 ? dRow[rateColIdx] : undefined;
                    if (typeof balanceVal === "number") mortgageAmount = Math.abs(balanceVal);
                    if (typeof rateVal === "number") mortgageRate = rateVal;
                  }
                }
                break;
              }

              if (assetHeaderRowIdx !== -1) {
                newInvestments.push(...Array.from(investMap.values()));

                newFree.forEach(f => {
                  if (!combinedFree.some(cf => cf.name === f.name)) combinedFree.push(f);
                });
                newInvestments.forEach(inv => combinedInvestMap.set(inv.name, inv));
                if (mortgageAmount) combinedMortgageAmount = mortgageAmount;
                if (mortgageRate) combinedMortgageRate = mortgageRate;

                assetsSuccessCount += (newFree.length + newInvestments.length);
                parsedStructured = true;
                anySheetParsed = true;
              }
            }

            if (!parsedStructured) {
              const rawData = utils.sheet_to_json<any>(ws);
              const newFree: typeof ASSET_FREE_DEPOSITS = [];
              const newInvestments: typeof ASSET_INVESTMENTS = [];

              rawData.forEach((row: any) => {
                const findVal = (keys: string[]) => {
                  const matchedKey = Object.keys(row).find(k => 
                    keys.some(candidate => k.toLowerCase().replace(/\s+/g, "").includes(candidate))
                  );
                  return matchedKey ? row[matchedKey] : undefined;
                };

                const rawName = findVal(["자산명", "계좌명", "이름", "name", "asset", "account"]);
                const rawAmount = findVal(["금액", "잔액", "평가액", "amount", "balance", "value"]);
                const rawType = findVal(["유형", "구분", "종류", "type", "category"]);
                const rawOwner = findVal(["소유자", "소유", "명의", "owner"]);

                if (!rawName) return;

                let name = String(rawName).trim();
                let amount = 0;
                if (rawAmount !== undefined) {
                  if (typeof rawAmount === "number") {
                    amount = rawAmount;
                  } else {
                    amount = parseInt(String(rawAmount).replace(/[^0-9-]/g, "")) || 0;
                  }
                }

                const nameLower = name.toLowerCase();

                if (
                  ["합계", "총계", "총자산", "순자산", "소계", "총 5건", "총5건", "건수"].some(h => nameLower.includes(h)) ||
                  nameLower.includes("주택담보대출") || 
                  nameLower.includes("주담대") || 
                  nameLower.includes("nh주택담보대출") || 
                  nameLower.includes("대출금") || 
                  nameLower.includes("대출") || 
                  nameLower.includes("보험") || 
                  nameLower.includes("삼성생명") || 
                  nameLower.includes("삼성화재") || 
                  nameLower.includes("라이프") ||
                  nameLower.includes("보장성") || 
                  nameLower.includes("보험금") || 
                  nameLower.includes("총계") || 
                  nameLower.includes("소계") || 
                  nameLower.includes("합계") || 
                  nameLower.includes("부채")
                ) {
                  return;
                }

                let ownerPrefix = ownerTag;
                if (rawOwner) {
                  const ownerStr = String(rawOwner);
                  if (ownerStr.includes("영범")) {
                    ownerPrefix = "[영범] ";
                  } else if (ownerStr.includes("재은")) {
                    ownerPrefix = "[재은] ";
                  }
                }

                if (ownerPrefix && !name.startsWith("[")) {
                  name = ownerPrefix + name;
                }

                const typeStr = rawType ? String(rawType).toLowerCase() : "";

                if (typeStr.includes("입출금") || typeStr.includes("자유") || typeStr.includes("현금") || typeStr.includes("free") || typeStr.includes("cash") || typeStr.includes("적금") || typeStr.includes("예금") || typeStr.includes("저축") || typeStr.includes("savings") || typeStr.includes("전자") || typeStr.includes("페이") || typeStr.includes("간편") || typeStr.includes("pay") || typeStr.includes("electronic")) {
                  const isInvestmentName = ["주식", "펀드", "cma", "isa", "증권", "위탁", "tiger", "kodex", "s&p", "sp500", "연금저축", "퇴직연금", "irp", "투자", "종합위탁", "중개형"].some(k => nameLower.includes(k));
                  if (isInvestmentName) {
                    newInvestments.push({ name, principal: amount, appraised: amount, yieldRate: 0 });
                  } else {
                    newFree.push({ name, amount });
                  }
                } else if (typeStr.includes("주식") || typeStr.includes("투자") || typeStr.includes("펀드") || typeStr.includes("증권") || typeStr.includes("stock") || typeStr.includes("investment")) {
                  const rawYield = findVal(["수익률", "수익", "yield", "rate"]);
                  const yieldRate = rawYield !== undefined ? parseFloat(String(rawYield).replace(/[^0-9.-]/g, "")) || 0 : 0;
                  newInvestments.push({ name, principal: amount, appraised: amount, yieldRate });
                } else {
                  const isInvestmentName = ["주식", "펀드", "cma", "isa", "증권", "위탁", "tiger", "kodex", "s&p", "sp500", "연금저축", "퇴직연금", "irp", "투자", "종합위탁", "중개형"].some(k => nameLower.includes(k));
                  if (isInvestmentName) {
                    newInvestments.push({ name, principal: amount, appraised: amount, yieldRate: 0 });
                  } else {
                    newFree.push({ name, amount });
                  }
                }
              });

              if (newFree.length > 0 || newInvestments.length > 0) {
                newFree.forEach(f => {
                  if (!combinedFree.some(cf => cf.name === f.name)) combinedFree.push(f);
                });
                newInvestments.forEach(inv => combinedInvestMap.set(inv.name, inv));
                assetsSuccessCount += (newFree.length + newInvestments.length);
                anySheetParsed = true;
              }
            }
          }
        }

        if (anySheetParsed) {
          const finalInvestments = Array.from(combinedInvestMap.values());
          setFreeAssets(combinedFree);
          setSavingsAssets([]);
          setElectronicAssets([]);
          setInvestmentAssets(finalInvestments);
          if (combinedMortgageAmount) LIABILITY_MORTGAGE.amount = combinedMortgageAmount;
          if (combinedMortgageRate) LIABILITY_MORTGAGE.rate = combinedMortgageRate;
          setAssetsFileName(file.name);
          syncAssetsReplaceToSupabase(combinedFree, finalInvestments).then(ok => {
            if (!ok) {
              alert("⚠️ 이 브라우저에는 반영됐지만, Supabase 저장에 실패했습니다. 개발자 도구 콘솔을 확인해 주세요.");
            }
          });
          updateHouseholdSettingsInSupabase({
            assets_file_name: file.name,
            ...(combinedMortgageAmount ? { mortgage_amount: combinedMortgageAmount } : {}),
            ...(combinedMortgageRate ? { mortgage_rate: combinedMortgageRate } : {})
          });
          alert(`🏦 자산/부채 현황 ${assetsSuccessCount}개 계좌가 성공적으로 연동되었습니다!`);
        } else {
          alert("업로드된 파일에서 유효한 자산/부채 현황 정보를 찾지 못했습니다.");
        }
      } catch (error) {
        console.error(error);
        alert("자산/부채 현황 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Toggle item active state
  const handleToggleItem = (id: number) => {
    setLedger(prev => {
      const next = prev.map(item => item.id === id ? { ...item, active: !item.active } : item);
      const toggled = next.find(item => item.id === id);
      if (toggled) upsertLedgerItemToSupabase(toggled);
      return next;
    });
  };

  // Delete ledger item
  const handleDeleteItem = (id: number) => {
    setLedger(prev => prev.filter(item => item.id !== id));
    deleteLedgerItemFromSupabase(id);
  };

  // 체크리스트: 추가/토글/수정/삭제 (Supabase에 저장되어 재접속·다른 기기에서도 유지됨)
  const handleAddChecklistItem = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const newItem: ChecklistItem = {
      id: Date.now(),
      label: trimmed,
      done: false,
      sortOrder: checklist.length > 0 ? Math.max(...checklist.map(c => c.sortOrder)) + 1 : 0
    };
    setChecklist(prev => [...prev, newItem]);
    upsertChecklistItemToSupabase(newItem);
  };

  const handleToggleChecklistItem = (id: number) => {
    setChecklist(prev => {
      const next = prev.map(item => item.id === id ? { ...item, done: !item.done } : item);
      const toggled = next.find(item => item.id === id);
      if (toggled) upsertChecklistItemToSupabase(toggled);
      return next;
    });
  };

  // 입력 중에는 로컬 상태만 갱신하고(타자마다 Supabase에 쓰지 않도록), blur 시점에만 서버에 반영한다.
  const handleChecklistLabelChange = (id: number, newLabel: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, label: newLabel } : item));
  };

  const handleChecklistLabelBlur = (id: number) => {
    const item = checklist.find(c => c.id === id);
    if (item && item.label.trim()) upsertChecklistItemToSupabase(item);
  };

  const handleDeleteChecklistItem = (id: number) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
    deleteChecklistItemFromSupabase(id);
  };

  // 대출 상환 기록 추가/삭제
  const handleAddMortgagePayment = (paymentDate: string, amount: number, memo: string) => {
    if (!paymentDate || amount <= 0) return;
    const newPayment: MortgagePayment = { id: Date.now(), paymentDate, amount, memo };
    setMortgagePayments(prev => [...prev, newPayment].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)));
    insertMortgagePaymentToSupabase(newPayment);
  };

  const handleDeleteMortgagePayment = (id: number) => {
    setMortgagePayments(prev => prev.filter(p => p.id !== id));
    deleteMortgagePaymentFromSupabase(id);
  };

  // Delete all ledger items
  const handleDeleteLedger = () => {
    if (window.confirm("수입/지출 데이터를 완전히 비우고 초기화하시겠습니까? (기본 샘플도 제거됩니다)")) {
      setLedger([]);
      setLedgerFileName(null);
      syncLedgerReplaceToSupabase([]);
      updateHouseholdSettingsInSupabase({ ledger_file_name: null });
    }
  };

  // Delete all assets items
  const handleDeleteAssets = () => {
    if (window.confirm("자산 데이터를 완전히 비우고 초기화하시겠습니까? (기본 샘플도 제거됩니다)")) {
      setFreeAssets([]);
      setSavingsAssets([]);
      setElectronicAssets([]);
      setInvestmentAssets([]);
      setAssetsFileName(null);
      syncAssetsReplaceToSupabase([], []);
      updateHouseholdSettingsInSupabase({ assets_file_name: null });
    }
  };

  // Reset all data
  const handleResetAllData = () => {
    if (window.confirm("모든 가계 데이터를 깨끗하게 초기화하고 전체 리셋하시겠습니까?")) {
      setLedger([]);
      setLedgerFileName(null);
      setFreeAssets([]);
      setSavingsAssets([]);
      setElectronicAssets([]);
      setInvestmentAssets([]);
      setAssetsFileName(null);
      setMortgagePayments([]);
      LIABILITY_MORTGAGE.amount = 600000000;
      LIABILITY_MORTGAGE.rate = 4.08;
      syncLedgerReplaceToSupabase([]);
      syncAssetsReplaceToSupabase([], []);
      updateHouseholdSettingsInSupabase({
        ledger_file_name: null,
        assets_file_name: null,
        mortgage_amount: 600000000,
        mortgage_rate: 4.08
      });
      mortgagePayments.forEach(p => deleteMortgagePaymentFromSupabase(p.id));
    }
  };

  // --- SUPABASE AUTH GATE ---
  if (isSupabaseConfigured && authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-400 text-sm font-bold animate-pulse">불러오는 중...</div>
      </div>
    );
  }

  // 이메일의 재설정 링크를 클릭해서 돌아온 경우: 세션이 있어도(임시 복구 세션) 새 비밀번호 설정 화면을 먼저 보여준다.
  if (isSupabaseConfigured && authView === "reset") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" id="reset_password_screen">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 w-full max-w-sm space-y-5">
          <div className="text-center space-y-1">
            <div className="text-3xl">🔑</div>
            <h1 className="text-lg font-bold text-slate-900">새 비밀번호 설정</h1>
            <p className="text-xs text-slate-400">새로 사용할 비밀번호를 입력해 주세요</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-3" id="reset_password_form">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">새 비밀번호 확인</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {resetError && <p className="text-xs text-rose-600 font-semibold">{resetError}</p>}
            {resetMessage && <p className="text-xs text-emerald-600 font-semibold">{resetMessage}</p>}
            <button
              type="submit"
              disabled={resetSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
            >
              {resetSubmitting ? "저장 중..." : "비밀번호 변경"}
            </button>
            {resetMessage && (
              <button
                type="button"
                onClick={async () => { await handleLogout(); setAuthView("login"); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
              >
                로그인 화면으로 이동
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured && !session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" id="login_screen">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 w-full max-w-sm space-y-5">
          <div className="text-center space-y-1">
            <div className="text-3xl">🏡</div>
            <h1 className="text-lg font-bold text-slate-900">연준이네 가계부</h1>
            <p className="text-xs text-slate-400">
              {authView === "forgot" ? "가입한 이메일로 재설정 링크를 받으세요" : "부부가 공유하는 계정으로 로그인하세요"}
            </p>
          </div>

          {authView === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3" id="login_form">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">이메일</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  id="login_email_input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">비밀번호</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  id="login_password_input"
                />
              </div>
              {loginError && <p className="text-xs text-rose-600 font-semibold">{loginError}</p>}
              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {loginSubmitting ? "로그인 중..." : "로그인"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthView("forgot");
                  setForgotEmail(loginEmail);
                  setForgotError("");
                  setForgotMessage("");
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-emerald-600 font-semibold cursor-pointer"
                id="forgot_password_link"
              >
                비밀번호를 잊으셨나요?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-3" id="forgot_password_form">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">이메일</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  id="forgot_email_input"
                />
              </div>
              {forgotError && <p className="text-xs text-rose-600 font-semibold">{forgotError}</p>}
              {forgotMessage && <p className="text-xs text-emerald-600 font-semibold">{forgotMessage}</p>}
              <button
                type="submit"
                disabled={forgotSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {forgotSubmitting ? "전송 중..." : "재설정 링크 받기"}
              </button>
              <button
                type="button"
                onClick={() => { setAuthView("login"); setLoginError(""); }}
                className="w-full text-center text-xs text-slate-400 hover:text-emerald-600 font-semibold cursor-pointer"
              >
                ← 로그인 화면으로 돌아가기
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col md:flex-row font-sans" id="app_root">

      {/* --- SIDEBAR --- */}
      <aside className="w-full md:w-80 bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0 print:hidden" id="sidebar">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3" id="sidebar_header">
          <div className="bg-emerald-600 p-2.5 rounded-lg text-white">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">🏡 감이동 비발디</h1>
            <p className="text-xs text-slate-400">우리집 통합 재정 대시보드</p>
          </div>
        </div>

        {/* Sidebar Split Excel Uploaders */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/20 space-y-4" id="sidebar_excel_uploader">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2 flex items-center gap-1">
              <span>💸</span> 수입/지출 내역 업로드
            </span>
            <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-3 bg-slate-900/60 hover:bg-slate-800/40 transition-all text-center cursor-pointer relative group">
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleLedgerExcelUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="수입/지출 엑셀 파일 업로드"
              />
              <div className="space-y-1 pointer-events-none">
                <div className="mx-auto w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">
                  수입/지출 내역 선택
                </div>
              </div>
            </label>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2 flex items-center gap-1">
              <span>🏦</span> 자산/부채 현황 업로드
            </span>
            <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-3 bg-slate-900/60 hover:bg-slate-800/40 transition-all text-center cursor-pointer relative group">
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleAssetsExcelUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="자산/부채 엑셀 파일 업로드"
              />
              <div className="space-y-1 pointer-events-none">
                <div className="mx-auto w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">
                  자산/부채 현황 선택
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Sidebar Upload Status Summary & Management */}
        <div className="p-5 border-b border-slate-800 space-y-3 bg-slate-950/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">📊 데이터 업로드 상태</span>
          <div className="space-y-2 text-xs">
            <div className="flex flex-col bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400">💸 수입/지출 데이터</span>
              <span className="font-semibold text-slate-200 truncate mt-0.5">
                {ledgerFileName ? `✅ ${ledgerFileName}` : "⚠️ 기본 샘플 데이터 사용 중"}
              </span>
              <span className="text-[9px] text-emerald-400 font-bold mt-0.5">({ledger.length}건 로드됨)</span>
            </div>

            <div className="flex flex-col bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400">🏦 자산/부채 데이터</span>
              <span className="font-semibold text-slate-200 truncate mt-0.5">
                {assetsFileName ? `✅ ${assetsFileName}` : "⚠️ 기본 샘플 데이터 사용 중"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={handleDeleteLedger}
              className="py-1.5 px-2 bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-800 text-slate-300 hover:text-rose-200 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
              title="수입/지출 내역을 완전히 비웁니다."
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>수입/지출 삭제</span>
            </button>
            <button
              onClick={handleDeleteAssets}
              className="py-1.5 px-2 bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-800 text-slate-300 hover:text-rose-200 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
              title="자산 목록을 완전히 비웁니다."
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>자산 삭제</span>
            </button>
          </div>
          <button
            onClick={handleResetAllData}
            className="w-full py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-[11px] font-bold tracking-wide transition-all mt-1"
            title="모든 데이터를 지우고 디폴트 고정값 상태로 초기화합니다."
          >
            🔄 전체 데이터 초기화
          </button>
          <button
            onClick={() => window.print()}
            className="w-full py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-lg text-[11px] font-bold tracking-wide transition-all mt-1"
            title="현재 화면을 PDF로 저장하거나 인쇄합니다."
          >
            🖨️ 대시보드 보고서 PDF 출력 / 인쇄
          </button>
          {isSupabaseConfigured && session && (
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-bold tracking-wide transition-all mt-1"
              title="로그아웃합니다."
              id="logout_button"
            >
              🚪 로그아웃 ({session.user.email})
            </button>
          )}
        </div>

        {/* Sidebar Profiles & Home Info */}
        <div className="p-6 border-b border-slate-800 space-y-4" id="sidebar_info">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Family profiles</span>
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 space-y-2">
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>최영범 (남편)</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <User className="w-3.5 h-3.5 text-pink-400" />
                <span>강재은 (아내)</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 text-[11px] text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <span>💡</span> 리액티브 통합 피드백
            </p>
            지출/수입 탭에서 항목을 활성화·비활성화하거나 시뮬레이터를 조절하면 모든 자산 계산과 지출 트렌드가 실시간 업데이트됩니다.
          </div>
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="p-4 space-y-1.5 flex-1" id="sidebar_navigation">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "overview"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
            id="nav_btn_overview"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            <span>🏠 총괄 대시보드</span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "ledger"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
            id="nav_btn_ledger"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>💸 지출과 수입</span>
          </button>

          <button
            onClick={() => setActiveTab("analysis")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "analysis"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
            id="nav_btn_analysis"
          >
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>📊 재무적 지출 분석</span>
          </button>

          <button
            onClick={() => setActiveTab("assets")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "assets"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
            id="nav_btn_assets"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>📈 자산 및 부채</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-950/20" id="sidebar_footer">
          <span className="text-[10px] text-slate-500 font-mono">APP V1.0.0</span>
          <button 
            onClick={handleResetAllData}
            className="text-[10px] bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 text-slate-400 px-2.5 py-1 rounded transition-all border border-slate-700/50"
            title="모든 가계 데이터를 깨끗하게 초기화하고 초기 상태로 리셋합니다."
          >
            전체 데이터 초기화
          </button>
        </div>
      </aside>

      {/* --- MAIN MAIN STAGE --- */}
      <main className="flex-1 flex flex-col min-w-0" id="main_content">
        
        {/* --- MAIN HEADER BANNER --- */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0" id="header_banner">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
              <span>Smart Family Portfolio</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span>Financial Portal</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeTab === "overview" && "🏠 총괄 대시보드"}
              {activeTab === "ledger" && "💸 지출과 수입 (Interactive Ledger)"}
              {activeTab === "analysis" && "📊 재무적 지출 분석 (Financial Expense Analysis)"}
              {activeTab === "assets" && "📈 자산 및 부채 (Asset & Trend Analysis)"}
            </h2>
          </div>
        </header>

        {/* --- STAGE COMPONENT INJECTS --- */}
        <div className="p-8 flex-1 overflow-y-auto space-y-8" id="tab_contents">
          
          {/* ==========================================
              TAB 1: 🏠 총괄 대시보드 (Overview)
             ========================================== */}
          {activeTab === "overview" && (
            <div className="space-y-8" id="overview_tab">
              
              {/* Premium AI Wealth Report Panel */}
              {renderAiReport()}
              
              {/* 📊 [이달의 재무 브리핑] 신규 세션 추가 */}
              {(() => {
                const briefing = calculateMonthlyBriefing(selectedMonth);
                return (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6" id="monthly_financial_briefing_card">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">📊</span>
                        <span>[이달의 재무 브리핑] - {selectedMonth.replace("-", "년 ")}월 지출 분석 및 진단</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        감이동 비발디 가계의 실시간 자산 흐름과 당월 지출 구조를 종합 분석한 AI 스마트 요약 리포트입니다.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-rose-50/30 rounded-2xl border border-rose-100/50 p-5 text-center flex flex-col justify-center items-center">
                        <span className="text-xs font-bold text-slate-500 mb-2">🔥 {selectedMonth.replace("-", "년 ")}월 총 지출액</span>
                        <strong className="text-2xl font-mono text-rose-600 font-black">
                          {briefing.totalExpense.toLocaleString()} 원
                        </strong>
                      </div>
                      <div className="bg-blue-50/30 rounded-2xl border border-blue-100/50 p-5 text-center flex flex-col justify-center items-center">
                        <span className="text-xs font-bold text-slate-500 mb-1">🔒 고정비 비중</span>
                        <strong className="text-2xl font-mono text-blue-700 font-black">
                          {briefing.fixedRatio.toFixed(1)}%
                        </strong>
                        <span className="text-[11px] text-slate-400 mt-1 font-semibold">
                          ({briefing.fixedSum.toLocaleString()} 원)
                        </span>
                      </div>
                      <div className="bg-amber-50/30 rounded-2xl border border-amber-100/50 p-5 text-center flex flex-col justify-center items-center">
                        <span className="text-xs font-bold text-slate-500 mb-1">💸 변동비 비중</span>
                        <strong className="text-2xl font-mono text-amber-700 font-black">
                          {briefing.variableRatio.toFixed(1)}%
                        </strong>
                        <span className="text-[11px] text-slate-400 mt-1 font-semibold">
                          ({briefing.variableSum.toLocaleString()} 원)
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50/40 border-l-4 border-blue-500 p-4 rounded-r-2xl shadow-xs">
                      <span className="font-bold text-blue-800 text-sm flex items-center gap-1.5">
                        💡 실시간 재정 분석 리포트 (Financial Insights)
                      </span>
                      <p className="text-slate-700 text-xs sm:text-sm leading-relaxed mt-2 font-medium">
                        {briefing.summaryText.replace(/\*\*/g, "")}
                      </p>
                    </div>
                  </div>
                );
              })()}
              
              {/* 월별 지출 현황 및 수입 종합 분석 패널 (1번 사진 대체) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6" id="monthly_income_expense_summary_dashboard">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-5 gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">📊</span>
                      <span>월별 가계 수입 및 지출 종합 현황</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      각 월별로 활성화되어 가계에 반영된 실질 수입과 지출 항목을 분류하여 한눈에 파악합니다.
                    </p>
                  </div>

                  {/* Month Selection directly integrated */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xs font-bold text-slate-600">기준 월:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-xs"
                      id="dashboard_month_select"
                    >
                      {uniqueMonths.map((m) => (
                        <option key={m} value={m}>{m.replace("-", "년 ")}월</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Column 1: Income summary */}
                  <div className="space-y-4 bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100/50">
                    <div className="flex justify-between items-center border-b border-emerald-100/30 pb-2">
                      <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>수입 현황</span>
                      </h4>
                      <span className="text-xs font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100">
                        총 {getMonthlyIncomes(selectedMonth).length}건
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 block">당월 실질 총 수입</span>
                      <strong className="text-2xl sm:text-3xl font-mono text-emerald-700 font-black tracking-tight">
                        {activeIncomeTotal.toLocaleString()}원
                      </strong>
                    </div>

                    {/* Category Breakdown list for Income */}
                    <div className="space-y-3 pt-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">카테고리별 세부내역</span>
                      {getMonthlyIncomes(selectedMonth).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">선택한 월에 활성화된 수입 항목이 없습니다.</p>
                      ) : (
                        Object.entries(
                          getMonthlyIncomes(selectedMonth).reduce((acc, curr) => {
                            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([category, amt]) => {
                          const numAmt = amt as number;
                          const percent = activeIncomeTotal > 0 ? Math.round((numAmt / activeIncomeTotal) * 100) : 0;
                          return (
                            <div key={category} className="space-y-1">
                              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                                  <span className="shrink-0">{category}</span>
                                  <input
                                    type="text"
                                    placeholder="직접 메모 입력..."
                                    value={categoryMemos[selectedMonth]?.[category] || ""}
                                    onChange={(e) => handleCategoryMemoChange(selectedMonth, category, e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[150px] truncate"
                                    title="대분류 메모 (자동 저장)"
                                  />
                                </div>
                                <span className="font-mono text-slate-600 shrink-0">{numAmt.toLocaleString()}원 ({percent}%)</span>
                              </div>
                              <div className="w-full bg-slate-100/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Column 2: Expense summary */}
                  <div className="space-y-4 bg-rose-50/20 p-5 rounded-2xl border border-rose-100/50">
                    <div className="flex justify-between items-center border-b border-rose-100/30 pb-2">
                      <h4 className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span>지출 현황</span>
                      </h4>
                      <span className="text-xs font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-100">
                        총 {getMonthlyExpenses(selectedMonth).length}건
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 block">당월 실질 총 지출</span>
                      <strong className="text-2xl sm:text-3xl font-mono text-rose-700 font-black tracking-tight">
                        {activeExpenseTotal.toLocaleString()}원
                      </strong>
                    </div>

                    {/* 지출 카테고리 비중 도넛 차트 (4번: 재무적 지출 분석 비중 시각화) */}
                    {getMonthlyExpenses(selectedMonth).length > 0 && (
                      <div className="bg-white/70 rounded-2xl border border-rose-100/50">
                        <SVGMultiPieChart
                          items={
                            Object.entries(
                              getMonthlyExpenses(selectedMonth).reduce((acc, curr) => {
                                acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
                                return acc;
                              }, {} as Record<string, number>)
                            ).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5) as [string, number][]
                          }
                        />
                      </div>
                    )}

                    {/* Category Breakdown list for Expense */}
                    <div className="space-y-3 pt-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">카테고리별 세부내역</span>
                      {getMonthlyExpenses(selectedMonth).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">선택한 월에 활성화된 지출 항목이 없습니다.</p>
                      ) : (
                        Object.entries(
                          getMonthlyExpenses(selectedMonth).reduce((acc, curr) => {
                            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
                            return acc;
                          }, {} as Record<string, number>)
                        )
                        .sort(([catA], [catB]) => {
                          const typeA = getCategoryType(catA);
                          const typeB = getCategoryType(catB);
                          if (typeA !== typeB) {
                            return typeA === "고정비" ? -1 : 1; // "고정비" first, then "변동비"
                          }
                          return catA.localeCompare(catB);
                        })
                        .map(([category, amt]) => {
                          const numAmt = amt as number;
                          const percent = activeExpenseTotal > 0 ? Math.round((numAmt / activeExpenseTotal) * 100) : 0;
                          const catType = getCategoryType(category);
                          return (
                            <div key={category} className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                                  <button
                                    onClick={() => toggleCategoryType(category)}
                                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                      catType === "고정비"
                                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                                        : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                                    }`}
                                    title="클릭 시 고정비 <-> 변동비 전환"
                                  >
                                    [{catType}]
                                  </button>
                                  <span className="shrink-0 font-bold text-slate-900">{category}</span>
                                  <input
                                    type="text"
                                    placeholder="직접 메모 입력..."
                                    value={categoryMemos[selectedMonth]?.[category] || ""}
                                    onChange={(e) => handleCategoryMemoChange(selectedMonth, category, e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[150px] truncate"
                                    title="대분류 메모 (자동 저장)"
                                  />
                                </div>
                                <span className="font-mono text-slate-600 shrink-0">{numAmt.toLocaleString()}원 ({percent}%)</span>
                              </div>
                              <div className="w-full bg-slate-100/70 rounded-full h-2 overflow-hidden">
                                <div className={`h-2 rounded-full ${catType === "고정비" ? "bg-indigo-500" : "bg-orange-500"}`} style={{ width: `${percent}%` }}></div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Final Net balance footer banner */}
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                  netMonthlyIncome >= 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                    : "bg-rose-50 border-rose-200 text-rose-950"
                }`}>
                  <div className="space-y-0.5">
                    <p className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      {netMonthlyIncome >= 0 ? "🟢 당월 종합 재정 건전성: 흑자" : "🔴 당월 종합 재정 건전성: 적자 모니터링"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {netMonthlyIncome >= 0
                        ? "이번 달은 안정적인 흐름으로 수입이 지출보다 많아 흑자 재정을 유지 중입니다."
                        : "이번 달은 지출이 수입을 초과하였습니다. 주담대 이자 납입 또는 일시적 이사 비용 영향을 점검하세요."}
                    </p>
                  </div>
                  <div className="font-mono text-right shrink-0">
                    <span className="text-xs block text-slate-400 font-sans">실질 최종 순수지</span>
                    <strong className={`text-base sm:text-lg font-black ${
                      netMonthlyIncome >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}>
                      {netMonthlyIncome >= 0 ? "+" : ""}{netMonthlyIncome.toLocaleString()}원
                    </strong>
                  </div>
                </div>
              </div>

              {/* KPI CARD STATS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="kpi_cards_grid">
                
                {/* Card 1: Total Assets */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between" id="kpi_card_assets">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">💵 가계 총 자산</span>
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">예적금+투자</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black font-mono text-slate-950 tracking-tight">
                      {totalAssets.toLocaleString()}원
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">영범 자산 + 재은 자산 합산 (예적금, 주식, 전자금융 총액)</p>
                  </div>
                </div>

                {/* Card 2: Total Debt */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between" id="kpi_card_liabilities">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">🚨 총 부채 (대출)</span>
                    <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">NH주담대</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black font-mono text-rose-600 tracking-tight">
                      {totalLiabilities.toLocaleString()}원
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">고정금리 {LIABILITY_MORTGAGE.rate}% 장기 주택담보</p>
                  </div>
                </div>

                {/* Card 3: Net Worth (Dynamic highlight on negative worth) */}
                <div className={`rounded-2xl p-6 border shadow-sm flex flex-col justify-between transition-all ${
                  netWorth < 0 
                    ? "bg-rose-50/50 border-rose-200" 
                    : "bg-white border-slate-200"
                }`} id="kpi_card_net_worth">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">📉 순금융자산</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      netWorth < 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {netWorth < 0 ? "⚠️ 레버리지" : "순자산 흑자"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className={`text-2xl font-black font-mono tracking-tight ${
                      netWorth < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}>
                      {netWorth.toLocaleString()}원
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {netWorth < 0 ? "내집마련 대출 반영에 따른 순융자" : "금융 안전망 여유 상태"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning Alert if netWorth is negative */}
              {netWorth < 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start space-x-3.5 text-rose-950 shadow-xs" id="net_worth_warning_alert">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs sm:text-sm">
                    <h4 className="font-bold text-rose-900">가계 순금융자산 모니터링 경보</h4>
                    <p className="leading-relaxed text-rose-800">
                      현재 우리 가계는 총 부채(<span className="font-mono font-semibold">{totalLiabilities.toLocaleString()}원</span>)가 
                      통합 금융 자산(<span className="font-mono font-semibold">{totalAssets.toLocaleString()}원</span>)을 초과하여 
                      순금융자산이 <span className="font-mono font-bold text-rose-700">{netWorth.toLocaleString()}원</span>으로 마이너스 상태입니다. 
                      이는 감이동 한라비발디 주택 구매를 위한 장기 주택담보대출 실행에 따른 자연스러운 상태입니다. 
                      향후 <strong>지출과 수입 탭</strong> 및 <strong>자산 및 부채 탭</strong>의 상환 시뮬레이션을 통해 주기적인 계획을 설계하세요.
                    </p>
                  </div>
                </div>
              )}

              {/* TWO PANEL INTERACTIVE SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="two_panel_section">
                
                {/* Left Panel: Checklist (Direct Checklist state) */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6" id="interactive_checklist_panel">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                        <span>📋 이번 달 주요 재정 체크리스트</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">이번 달 챙겨야 할 핵심 가계 이체 및 운용 업무</p>
                    </div>
                    
                    {/* Mission completion rate badge */}
                    <div className="text-right">
                      <span className="text-[10px] font-mono font-bold bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700">
                        완료: {checklist.filter(c => c.done).length}/{checklist.length}
                      </span>
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-3" id="checklist_items">
                    {checklist.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">체크리스트 항목이 없습니다. 아래에서 추가해 보세요.</p>
                    ) : (
                      checklist.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center space-x-3.5 p-4 rounded-2xl border transition-all ${
                            item.done
                              ? "bg-emerald-50/30 border-emerald-100 text-slate-400"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => handleToggleChecklistItem(item.id)}
                            className="w-4.5 h-4.5 rounded text-emerald-600 border-slate-300 accent-emerald-500 shrink-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => handleChecklistLabelChange(item.id, e.target.value)}
                            onBlur={() => handleChecklistLabelBlur(item.id)}
                            className={`flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold leading-normal focus:outline-none focus:underline ${item.done ? "line-through" : ""}`}
                          />
                          <button
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                            title="항목 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add new checklist item */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("newChecklistLabel") as HTMLInputElement;
                      handleAddChecklistItem(input.value);
                      input.value = "";
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="newChecklistLabel"
                      type="text"
                      placeholder="새 체크리스트 항목 추가..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shrink-0 cursor-pointer"
                    >
                      추가
                    </button>
                  </form>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>미션 달성률</span>
                      <span className="font-bold text-slate-800">
                        {checklist.length > 0 ? Math.round((checklist.filter(c => c.done).length / checklist.length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${checklist.length > 0 ? (checklist.filter(c => c.done).length / checklist.length) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Right Panel: NH Mortgage Specs */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-6" id="mortgage_detail_panel">
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-4">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                        <span>🏦 NH 주택담보대출 스펙</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">농협은행 한라비발디 주택 구입 자금 대출 정보</p>
                    </div>

                    <div className="space-y-3 text-xs sm:text-sm" id="mortgage_specs">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">대출 약정 기관</span>
                        <span className="font-bold text-slate-900">NH농협은행</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">최초 대출 원금</span>
                        <span className="font-bold font-mono text-slate-900">600,000,000원</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">약정 연 이자율</span>
                        <span className="font-bold text-emerald-600 flex items-center">
                          <Percent className="w-3.5 h-3.5 mr-0.5" />
                          <span>{LIABILITY_MORTGAGE.rate}%</span>
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">대출 신규 일자</span>
                        <span className="font-semibold text-slate-800">{LIABILITY_MORTGAGE.startDate}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">대출 만기 일자</span>
                        <span className="font-semibold text-slate-800">{LIABILITY_MORTGAGE.endDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Monthly Interest Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-1" id="mortgage_quick_interest">
                    <span className="text-[10px] text-slate-500 block">매월 고정 약정 이자 예상액</span>
                    <strong className="text-lg font-mono text-slate-950 font-black">
                      {Math.round((LIABILITY_MORTGAGE.amount * (LIABILITY_MORTGAGE.rate / 100)) / 12).toLocaleString()}원
                    </strong>
                    <p className="text-[9px] text-slate-400">일할 계산 정산 기준에 따라 실제 부과액 변동 가능</p>
                  </div>

                </div>

              </div>

              {/* Gemini AI 데이터 분석 챗봇 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4" id="gemini_chatbot_panel">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">🤖</span>
                    <span>Gemini 데이터 분석 챗봇</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    업로드된 수입/지출 내역과 자산 데이터를 바탕으로 질문에 답합니다. (예: "6월보다 7월에 지출을 얼마 더 했어?")
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">🔑 개인 Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="gemini_api_key_input"
                  />
                  <p className="text-[10px] text-slate-400">키는 이 브라우저에만 저장되며 외부 서버로 전송되지 않습니다. (Google AI Studio에서 발급)</p>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 max-h-80 overflow-y-auto" id="gemini_chat_messages">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">아직 대화가 없습니다. 아래에 질문을 입력해 보세요.</p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 text-slate-400 rounded-2xl px-4 py-2.5 text-xs">답변 생성 중...</div>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
                  className="flex gap-2"
                  id="gemini_chat_form"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="예: 6월보다 7월에 지출을 얼마 더 했어?"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm px-5 py-2 rounded-xl transition-all shrink-0"
                  >
                    전송
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB 2: 💸 지출과 수입 (Interactive Ledger)
             ========================================== */}
          {activeTab === "ledger" && (
            <div className="space-y-8" id="ledger_tab">
              
              {/* Explanatory Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2" id="ledger_intro">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>💸</span> 월별 가계부 지출·수입 유효반영 제어기
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  각 행 왼쪽의 <strong>'유효반영' 체크박스</strong>를 끄거나 켬으로써 실제 가계 운용 결과에 합산할지 여부를 실시간으로 선택할 수 있습니다. 
                  모의 입력 기능을 활용해 가상의 지출이나 수입 일정을 추가하고 흑자/적자 상황을 미리 테스트해 보세요.
                </p>
              </div>

              {/* MONTH SELECTION FILTER */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-3xl border border-slate-200 shadow-sm gap-4" id="ledger_filter_bar">
                <div className="space-y-3 w-full md:w-auto">
                  <div className="flex items-center justify-between md:justify-start gap-4">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      <span>📅</span> 조회 모드:
                    </span>
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                      <button
                        onClick={() => {
                          setIsMultiMonth(false);
                          if (!selectedMonths.includes(selectedMonth)) {
                            setSelectedMonth(selectedMonths[0] || "2026-07");
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          !isMultiMonth ? "bg-white text-slate-800 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        단일 월 조회
                      </button>
                      <button
                        onClick={() => {
                          setIsMultiMonth(true);
                          if (!selectedMonths.includes(selectedMonth)) {
                            setSelectedMonths([selectedMonth]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isMultiMonth ? "bg-white text-slate-800 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        다중 월 선택 토글
                      </button>
                    </div>
                  </div>

                  {!isMultiMonth ? (
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-slate-500">조회 대상 월 선택:</span>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 shadow-xs"
                        id="ledger_month_selector"
                      >
                        {uniqueMonths.map((m) => (
                          <option key={m} value={m}>{m.replace("-", "년 ")}월</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-500 block">원장 합산 대상 월 복수 선택 (토글):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {uniqueMonths.map((m) => {
                          const isSelected = selectedMonths.includes(m);
                          return (
                            <button
                              key={m}
                              onClick={() => {
                                if (isSelected) {
                                  if (selectedMonths.length > 1) {
                                    setSelectedMonths(prev => prev.filter(x => x !== m));
                                  } else {
                                    alert("최소 한 개의 월은 선택되어야 합니다.");
                                  }
                                } else {
                                  setSelectedMonths(prev => [...prev, m].sort());
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-600 border-emerald-500 text-white font-black shadow-sm"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {m.replace("-", "년 ")}월
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-[11px] sm:text-xs text-slate-500 font-bold bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-right self-stretch md:self-auto flex flex-col justify-center">
                  <div>
                    현재 조회 범위:{" "}
                    <span className="text-slate-900 font-black">
                      {isMultiMonth ? selectedMonths.map(m => m.substring(5) + "월").join(", ") : `${selectedMonth.substring(5)}월`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-normal">
                    선택 범위 내역 총{" "}
                    <span className="text-slate-900 font-bold">
                      {ledger.filter(x => isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth).length}
                    </span>
                    개 활성화
                  </div>
                </div>
              </div>

              {/* TWO LEDGER COLUMNS FOR INCOME AND EXPENSES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="ledger_tables_grid">
                
                {/* Left Column: Incomes */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4" id="ledger_incomes_column">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-emerald-700 flex items-center space-x-2 text-xs sm:text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>🟢 수입 내역 리스트</span>
                    </h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                      총 {ledger.filter(x => (isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth) && x.type === "수입").length}건
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2" id="income_items_list">
                    {ledger.filter(x => (isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth) && x.type === "수입").length === 0 ? (
                       <div className="text-center py-12 text-slate-400 text-xs">선택한 범위에 수입 내역이 없습니다.</div>
                    ) : (
                      ledger
                        .filter(x => (isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth) && x.type === "수입")
                        .map((item) => (
                          <div 
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              item.active 
                                ? "bg-white border-slate-200 shadow-xs" 
                                : "bg-slate-50/70 border-slate-100 text-slate-400 opacity-60"
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleItem(item.id)}
                                className={`px-2 py-1 rounded-full text-[10px] font-black transition-all border shrink-0 cursor-pointer ${
                                  item.active
                                    ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-300"
                                }`}
                                title="클릭 시 가계 연산 반영 여부 전환"
                              >
                                {item.active ? "반영" : "제외"}
                              </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-md inline-block">
                                    {item.category}
                                  </span>
                                  {item.date && (
                                    <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-block font-mono">
                                      {formatDateLabel(item.date)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-1">{item.content}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 shrink-0">
                              <input
                                type="text"
                                placeholder="메모 추가..."
                                value={item.memo || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLedger(prev => prev.map(x => x.id === item.id ? { ...x, memo: val } : x));
                                }}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[100px] sm:max-w-[140px] truncate font-sans"
                                title="개별 거래 메모 (자동 저장)"
                              />
                              <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600">
                                +{item.amount.toLocaleString()}원
                              </span>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="내역 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Right Column: Expenses */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4" id="ledger_expenses_column">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-rose-700 flex items-center space-x-2 text-xs sm:text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span>🔴 지출 내역 리스트</span>
                    </h4>
                    <span className="text-[10px] bg-rose-50 text-rose-800 px-2.5 py-0.5 rounded-full font-bold">
                      총 {ledger.filter(x => (isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth) && x.type === "지출").length}건
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2" id="expense_items_list">
                    {ledger.filter(x => (isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth) && x.type === "지출").length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">선택한 범위에 지출 내역이 없습니다.</div>
                    ) : (
                      ledger
                        .filter(x => (isMultiMonth ? selectedMonths.includes(x.month) : x.month === selectedMonth) && x.type === "지출")
                        .map((item) => (
                          <div 
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              item.active 
                                ? "bg-white border-slate-200 shadow-xs" 
                                : "bg-slate-50/70 border-slate-100 text-slate-400 opacity-60"
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleItem(item.id)}
                                className={`px-2 py-1 rounded-full text-[10px] font-black transition-all border shrink-0 cursor-pointer ${
                                  item.active
                                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-400 shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-300"
                                }`}
                                title="클릭 시 가계 연산 반영 여부 전환"
                              >
                                {item.active ? "반영" : "제외"}
                              </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-rose-50 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-md inline-block">
                                    {item.category}
                                  </span>
                                  {item.date && (
                                    <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-block font-mono">
                                      {formatDateLabel(item.date)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-1">{item.content}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 shrink-0">
                              <input
                                type="text"
                                placeholder="메모 추가..."
                                value={item.memo || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLedger(prev => prev.map(x => x.id === item.id ? { ...x, memo: val } : x));
                                }}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[100px] sm:max-w-[140px] truncate font-sans"
                                title="개별 거래 메모 (자동 저장)"
                              />
                              <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                                {item.amount < 0 ? "+" : "-"}{Math.abs(item.amount).toLocaleString()}원
                              </span>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="내역 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

              </div>

              {/* DYNAMIC SUM TOTALS BOX */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-6" id="ledger_totals_box">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-3">
                  📊 {selectedMonth.replace("-", "년 ")}월 유효 계산 메트릭 (실시간 리액티브 결과)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">🟢 선택 수입 총합</span>
                      <strong className="text-lg sm:text-xl font-mono text-emerald-600">
                        {activeIncomeTotal.toLocaleString()}원
                      </strong>
                    </div>
                    <ArrowUpRight className="w-8 h-8 text-emerald-500 opacity-50 shrink-0" />
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">🔴 선택 지출 총합</span>
                      <strong className="text-lg sm:text-xl font-mono text-slate-900">
                        {activeExpenseTotal.toLocaleString()}원
                      </strong>
                    </div>
                    <ArrowDownRight className="w-8 h-8 text-rose-500 opacity-50 shrink-0" />
                  </div>

                  <div className={`p-4 border rounded-2xl flex justify-between items-center ${
                    netMonthlyIncome >= 0 
                      ? "bg-emerald-50/40 border-emerald-200" 
                      : "bg-rose-50/40 border-rose-200"
                  }`}>
                    <div>
                      <span className="text-[10px] text-slate-500 block">📊 당월 최종 순수입 (잉여)</span>
                      <strong className={`text-lg sm:text-xl font-mono ${
                        netMonthlyIncome >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}>
                        {netMonthlyIncome.toLocaleString()}원
                      </strong>
                    </div>
                    <div className="text-right text-xs">
                      {netMonthlyIncome >= 0 ? (
                        <span className="text-[10px] sm:text-xs text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1 rounded-md block">
                          흑자 저축가능
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs text-rose-700 font-bold bg-rose-100 px-2.5 py-1 rounded-md block">
                          ⚠️ 비상 예비비 사용
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ADD DATA MOCK FORM */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-6" id="add_mock_ledger_form">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                    <PlusCircle className="w-5 h-5 text-emerald-400" />
                    <span>➕ 당월 신규/가상 데이터 모의 입력</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">원장 리스트에 새로운 수입이나 돌발 지출을 추가하여 가계 재정 변화를 실시간 분석하세요.</p>
                </div>

                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-6 gap-4" id="ledger_add_form_elem">
                  
                  {/* Month Select */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">대상 월</label>
                    <select
                      value={formMonth}
                      onChange={(e) => setFormMonth(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg w-full px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="2026-06">2026-06</option>
                      <option value="2026-07">2026-07</option>
                      <option value="2026-08">2026-08</option>
                      <option value="2026-09">2026-09</option>
                    </select>
                  </div>

                  {/* Date Input */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">일자 (날짜)</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg w-full px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  {/* Type Select */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">구분</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setFormType("수입"); setFormCategory("급여"); }}
                        className={`py-2 text-xs rounded-lg font-bold border transition-all ${
                          formType === "수입"
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        수입
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormType("지출"); setFormCategory("식비"); }}
                        className={`py-2 text-xs rounded-lg font-bold border transition-all ${
                          formType === "지출"
                            ? "bg-rose-600 border-rose-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        지출
                      </button>
                    </div>
                  </div>

                  {/* Category Select */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">대분류</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg w-full px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {formType === "수입" ? (
                        <>
                          <option value="급여">급여</option>
                          <option value="투자/배당">투자/배당</option>
                          <option value="이월자금">이월자금</option>
                          <option value="기타">기타수입</option>
                        </>
                      ) : (
                        <>
                          <option value="식비">식비</option>
                          <option value="주거/대출">주거/대출</option>
                          <option value="양육/기타">양육/기타</option>
                          <option value="공과금/관리비">공과금/관리비</option>
                          <option value="생활용품">생활용품</option>
                          <option value="여가/교통">여가/교통</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Content Memo */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">상세 내용 및 메모</label>
                    <input
                      type="text"
                      placeholder="예: 이마트 장보기, 보너스"
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg w-full px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">금액 (원)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={formAmount}
                        onChange={(e) => setFormAmount(Number(e.target.value))}
                        className="bg-slate-800 border border-slate-700 rounded-lg w-full pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold font-sans">원</span>
                    </div>
                  </div>

                  {/* Form Action Button */}
                  <div className="md:col-span-6 flex justify-end pt-2">
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer border border-emerald-500/30"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>원장에 모의내역 임시 등록</span>
                    </button>
                  </div>

                </form>
              </div>

            </div>
          )}

          {/* ==========================================
              TAB 2.5: 📊 재무적 지출 분석 (Financial Expense Analysis)
             ========================================== */}
          {activeTab === "analysis" && (
            <div className="space-y-8" id="financial_expense_analysis_tab">
              
              {/* Header and month select */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">📊</span>
                    <span>재무적 지출 세부 분석</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    선택된 월의 가계부 지출 정보를 분석하여 고정비와 변동비의 균형 상태 및 비중 순위를 정밀 진단합니다.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600">조회 대상 월:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-xs"
                    id="analysis_month_select"
                  >
                    {uniqueMonths.map((m) => (
                      <option key={m} value={m}>{m.replace("-", "년 ")}월</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid block for Donut and Top 5 */}
              {(() => {
                const briefing = calculateMonthlyBriefing(selectedMonth);
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* ① 고정비 vs 변동비 자동 분류 및 비중 산출 */}
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            <span>① 고정비 vs 변동비 자동 분류 및 비중</span>
                          </h4>
                          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            매월 고정적으로 청구되는 고정비(금융, 주거, 보험 등)와 통제가 가능한 변동비(식비, 쇼핑 등)의 조화로운 자산 배분 비중입니다.
                          </p>

                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100/30 text-center">
                              <span className="text-[10px] text-slate-400 font-bold block mb-1">🔒 고정비 합계</span>
                              <strong className="text-base sm:text-lg font-mono text-blue-700 block">{briefing.fixedSum.toLocaleString()}원</strong>
                              <span className="text-xs font-black text-blue-500 bg-white border border-blue-100 px-2 py-0.5 rounded-full inline-block mt-1.5">{briefing.fixedRatio.toFixed(1)}%</span>
                            </div>
                            <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/30 text-center">
                              <span className="text-[10px] text-slate-400 font-bold block mb-1">💸 변동비 합계</span>
                              <strong className="text-base sm:text-lg font-mono text-amber-700 block">{briefing.variableSum.toLocaleString()}원</strong>
                              <span className="text-xs font-black text-amber-500 bg-white border border-amber-100 px-2 py-0.5 rounded-full inline-block mt-1.5">{briefing.variableRatio.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                          <DonutChart
                            value1={briefing.fixedSum}
                            value2={briefing.variableSum}
                            label1="고정비"
                            label2="변동비"
                            color1="stroke-blue-600"
                            color2="stroke-amber-500"
                          />
                        </div>
                      </div>

                      {/* ② 주요 카테고리 비중 분석 */}
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <span>② 집중 관리 항목 및 주요 지출 Top 5</span>
                          </h4>
                          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            소비 지출의 가장 큰 비중을 차지하는 식비 및 보험료의 당월 점유율과 가장 높은 5대 지출 분야의 파이 분석입니다.
                          </p>

                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/30 text-center">
                              <span className="text-[10px] text-slate-400 font-bold block mb-1">🍚 식비 점유비</span>
                              <strong className="text-base sm:text-lg font-mono text-emerald-700 block">{briefing.foodSum.toLocaleString()}원</strong>
                              <span className="text-xs font-black text-emerald-600 bg-white border border-emerald-100 px-2 py-0.5 rounded-full inline-block mt-1.5">{briefing.foodRatio.toFixed(1)}%</span>
                            </div>
                            <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100/30 text-center">
                              <span className="text-[10px] text-slate-400 font-bold block mb-1">🛡️ 보험료/금융 점유비</span>
                              <strong className="text-base sm:text-lg font-mono text-rose-700 block">{briefing.insuranceSum.toLocaleString()}원</strong>
                              <span className="text-xs font-black text-rose-500 bg-white border border-rose-100 px-2 py-0.5 rounded-full inline-block mt-1.5">{briefing.insuranceRatio.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                          <SVGMultiPieChart items={briefing.top5} />
                        </div>
                      </div>
                    </div>

                    {/* ③ 재무 분석 요약 리포트 */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                      <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                        <span className="p-1 bg-blue-50 text-blue-600 rounded flex items-center justify-center w-6 h-6">💡</span>
                        <span>③ 재무 분석 요약 리포트 (Financial Insights)</span>
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        선택된 월의 자산 배분 결과와 지출 체질에 대하여 AI 지출 진단 엔진이 자동 산출한 정량적 보고서입니다.
                      </p>
                      
                      <div className="bg-blue-50/50 border-l-4 border-blue-500 p-5 rounded-r-2xl shadow-xs">
                        <span className="font-bold text-blue-800 text-sm block mb-2">당월 정밀 재정 제언</span>
                        <p className="text-slate-700 text-xs sm:text-sm leading-relaxed font-medium">
                          {briefing.summaryText.replace(/\*\*/g, "")}
                        </p>
                      </div>
                    </div>

                    {/* ④ 카테고리별 상세 지출 드릴다운 */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5" id="expense_category_drilldown">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                          <span className="p-1 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center w-6 h-6">🔍</span>
                          <span>④ 카테고리별 상세 지출 드릴다운</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          궁금한 지출 카테고리를 선택하면 해당 카테고리의 지출 규모와 비중, 세부 거래 내역을 바로 확인할 수 있습니다.
                        </p>
                      </div>

                      {(() => {
                        const monthExpenses = ledger.filter(item => item.month === selectedMonth && item.type === "지출" && item.active);
                        const totalExpenseForMonth = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
                        const categories = Array.from(new Set(monthExpenses.map(item => item.category))).sort();
                        const selectedCat = drilldownCategory === "전체" || categories.includes(drilldownCategory) ? drilldownCategory : "전체";
                        const filteredItems = selectedCat === "전체" ? monthExpenses : monthExpenses.filter(item => item.category === selectedCat);
                        const filteredTotal = filteredItems.reduce((sum, item) => sum + item.amount, 0);
                        const filteredRatio = totalExpenseForMonth > 0 ? (filteredTotal / totalExpenseForMonth) * 100 : 0;

                        return (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-600">카테고리 선택:</span>
                              <select
                                value={selectedCat}
                                onChange={(e) => setDrilldownCategory(e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-xs"
                                id="drilldown_category_select"
                              >
                                <option value="전체">전체</option>
                                {categories.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/30 text-center">
                                <span className="text-[10px] text-slate-400 font-bold block mb-1">💰 총 지출 금액</span>
                                <strong className="text-base sm:text-lg font-mono text-emerald-700 block">{filteredTotal.toLocaleString()}원</strong>
                              </div>
                              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100/30 text-center">
                                <span className="text-[10px] text-slate-400 font-bold block mb-1">🧾 건수</span>
                                <strong className="text-base sm:text-lg font-mono text-blue-700 block">{filteredItems.length}건</strong>
                              </div>
                              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/30 text-center">
                                <span className="text-[10px] text-slate-400 font-bold block mb-1">📊 전체 지출 대비 비중</span>
                                <strong className="text-base sm:text-lg font-mono text-amber-700 block">{filteredRatio.toFixed(1)}%</strong>
                              </div>
                            </div>

                            {selectedCat !== "전체" && (() => {
                              const monthToIdx = (m: string) => {
                                const [y, mo] = m.split("-").map(Number);
                                return y * 12 + (mo - 1);
                              };
                              const idxToMonth = (idx: number) => {
                                const y = Math.floor(idx / 12);
                                const mo = (idx % 12) + 1;
                                return `${y}-${String(mo).padStart(2, "0")}`;
                              };
                              const baseIdx = monthToIdx(selectedMonth);
                              const last6Months = Array.from({ length: 6 }, (_, i) => idxToMonth(baseIdx - (5 - i)));

                              const monthlyTotals = last6Months.map(m => ({
                                month: m,
                                total: ledger.filter(item => item.month === m && item.category === selectedCat && item.type === "지출" && item.active).reduce((sum, item) => sum + item.amount, 0)
                              }));

                              const maxTotal = Math.max(...monthlyTotals.map(x => x.total), 1);

                              return (
                                <div className="space-y-3" id="drilldown_category_trend">
                                  <h5 className="text-xs font-bold text-slate-600">📈 "{selectedCat}" 카테고리 최근 6개월 지출 추이</h5>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs sm:text-sm">
                                      <thead>
                                        <tr className="border-b border-slate-200 text-slate-500 text-left">
                                          <th className="py-2 pr-3 font-bold whitespace-nowrap">월</th>
                                          <th className="py-2 pr-3 font-bold text-right whitespace-nowrap">지출액</th>
                                          <th className="py-2 pr-3 font-bold whitespace-nowrap">전월 대비</th>
                                          <th className="py-2 pr-3 font-bold w-1/2">규모</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {monthlyTotals.map((mt, i) => {
                                          const prev = i > 0 ? monthlyTotals[i - 1].total : null;
                                          const delta = prev !== null ? mt.total - prev : null;
                                          const pct = maxTotal > 0 ? (mt.total / maxTotal) * 100 : 0;
                                          const isCurrent = mt.month === selectedMonth;
                                          return (
                                            <tr key={mt.month} className={`border-b border-slate-100 ${isCurrent ? "bg-emerald-50/40" : ""}`}>
                                              <td className={`py-2 pr-3 font-bold whitespace-nowrap ${isCurrent ? "text-emerald-700" : "text-slate-700"}`}>
                                                {mt.month}{isCurrent ? " (선택)" : ""}
                                              </td>
                                              <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{mt.total.toLocaleString()}원</td>
                                              <td className="py-2 pr-3 whitespace-nowrap">
                                                {delta === null ? (
                                                  <span className="text-slate-400">-</span>
                                                ) : delta === 0 ? (
                                                  <span className="text-slate-400">변동없음</span>
                                                ) : (
                                                  <span className={`font-bold ${delta > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString()}원
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 pr-3">
                                                <div className="w-full bg-slate-100 rounded-full h-3">
                                                  <div className={`h-3 rounded-full ${isCurrent ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${pct}%` }}></div>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="overflow-x-auto">
                              <table className="w-full text-xs sm:text-sm" id="drilldown_detail_table">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                                    <th className="py-2 pr-3 font-bold whitespace-nowrap">날짜</th>
                                    <th className="py-2 pr-3 font-bold whitespace-nowrap">카테고리</th>
                                    <th className="py-2 pr-3 font-bold">내용</th>
                                    <th className="py-2 pr-3 font-bold text-right whitespace-nowrap">금액</th>
                                    <th className="py-2 pr-3 font-bold whitespace-nowrap">결제수단</th>
                                    <th className="py-2 pr-3 font-bold">메모</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredItems.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">해당 조건의 지출 내역이 없습니다.</td></tr>
                                  ) : (
                                    filteredItems.map(item => (
                                      <tr key={item.id} className="border-b border-slate-100">
                                        <td className="py-2 pr-3 font-mono text-slate-500 whitespace-nowrap">{formatDateLabel(item.date)}</td>
                                        <td className="py-2 pr-3 whitespace-nowrap">
                                          <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md">{item.category}</span>
                                        </td>
                                        <td className="py-2 pr-3 font-semibold text-slate-800">{item.content}</td>
                                        <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{item.amount.toLocaleString()}원</td>
                                        <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{item.paymentMethod || "-"}</td>
                                        <td className="py-2 pr-3 text-slate-500">{item.memo || "-"}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}

            </div>
          )}

          {/* ==========================================
              TAB 3: 📈 자산 및 부채 (Asset & Trend Analysis)
             ========================================== */}
          {activeTab === "assets" && (
            <div className="space-y-8" id="analysis_tab">
              
              {/* Calculating dynamic assets for trend (3번) */}
              {(() => {
                const anchorMonth = uniqueMonths.length > 0 ? uniqueMonths[uniqueMonths.length - 1] : selectedMonth;

                const getMonthNet = (m: string) => {
                  const inc = ledger.filter(item => item.month === m && item.type === "수입" && item.active).reduce((sum, item) => sum + item.amount, 0);
                  const exp = ledger.filter(item => item.month === m && item.type === "지출" && item.active).reduce((sum, item) => sum + item.amount, 0);
                  return inc - exp;
                };

                const monthToIdx = (m: string) => {
                  const [y, mo] = m.split("-").map(Number);
                  return y * 12 + (mo - 1);
                };
                const idxToMonth = (idx: number) => {
                  const y = Math.floor(idx / 12);
                  const mo = (idx % 12) + 1;
                  return `${y}-${String(mo).padStart(2, "0")}`;
                };

                // 원장에 기록된 가장 최근 월(anchorMonth)의 실시간 자산(totalAssets)을 기준으로,
                // 각 월의 실질 수지(수입-지출)를 누적 가감하여 해당 월의 추정 자산을 계산한다.
                const estimateAssetsForMonth = (targetMonth: string) => {
                  const anchorIdx = monthToIdx(anchorMonth);
                  const targetIdx = monthToIdx(targetMonth);
                  let val = totalAssets;
                  if (targetIdx === anchorIdx) return val;
                  if (targetIdx > anchorIdx) {
                    for (let idx = anchorIdx + 1; idx <= targetIdx; idx++) val += getMonthNet(idxToMonth(idx));
                  } else {
                    for (let idx = anchorIdx; idx > targetIdx; idx--) val -= getMonthNet(idxToMonth(idx));
                  }
                  return val;
                };

                const compareList = assetCompareMonths.length > 0 ? assetCompareMonths : (uniqueMonths.length > 0 ? uniqueMonths.slice(-3) : [anchorMonth]);
                const points = compareList.map(m => ({ month: m, value: estimateAssetsForMonth(m) }));

                const maxVal = Math.max(...points.map(p => p.value), 1);
                const minVal = Math.min(...points.map(p => p.value), 0);
                const valRange = maxVal - minVal || 1;
                const minBound = minVal - valRange * 0.15;
                const maxBound = maxVal + valRange * 0.15;
                const boundRange = maxBound - minBound || 1;

                const chartWidth = Math.max(520, points.length * 170);
                const chartHeight = 220;
                const padSide = 60;
                const plotTop = 36;
                const plotBottom = chartHeight - 56;

                const getX = (i: number) => points.length === 1 ? chartWidth / 2 : padSide + (i / (points.length - 1)) * (chartWidth - padSide * 2);
                const getY = (val: number) => plotBottom - ((val - minBound) / boundRange) * (plotBottom - plotTop);

                return (
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-8" id="total_asset_hero_panel">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-6">
                      <div className="space-y-1">
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block">
                          Assets & Wealth Status 💰
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white">
                          우리집 현재 통합 금융 자산 및 변동 추이
                        </h3>
                        <p className="text-xs text-slate-400">
                          가계부의 수지 타산과 실시간 연동되어 운용되는 통합 순자산 현황판입니다.
                        </p>
                      </div>
                      
                      <div className="text-left md:text-right">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">우리집 실시간 총 금융자산</span>
                        <strong className="text-3xl sm:text-4xl font-mono text-emerald-400 font-black tracking-tight block mt-1">
                          {totalAssets.toLocaleString()}원
                        </strong>
                      </div>
                    </div>

                    {/* Sub-asset grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="sub_assets_metrics_grid">
                      
                      {/* Card 1: 자유입출금 자산 */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-between transition-all hover:bg-white/10">
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold">💵 자유입출금 자산</span>
                            <button
                              onClick={() => toggleAssetExpand("free")}
                              className="text-[10px] bg-white/10 hover:bg-white/20 text-emerald-300 px-2 py-0.5 rounded transition-all cursor-pointer font-bold font-sans"
                            >
                              {expandedAssets.free ? "숨기기 ▲" : "세부 보기 ▼"}
                            </button>
                          </div>
                          <strong className="text-base sm:text-lg font-mono text-white mt-2 block">{totalFree.toLocaleString()}원</strong>
                        </div>
                        {expandedAssets.free && (
                          <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-[10px] text-slate-300 max-h-36 overflow-y-auto font-mono">
                            {freeAssets.map(acc => (
                              <div key={acc.name} className="flex justify-between items-center">
                                <span className="truncate max-w-[130px]" title={acc.name}>{acc.name}</span>
                                <span>{acc.amount.toLocaleString()}원</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card 2: 주식 및 투자자산 */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-between transition-all hover:bg-white/10">
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold">📈 주식 및 투자자산</span>
                            <button
                              onClick={() => toggleAssetExpand("investment")}
                              className="text-[10px] bg-white/10 hover:bg-white/20 text-emerald-300 px-2 py-0.5 rounded transition-all cursor-pointer font-bold font-sans"
                            >
                              {expandedAssets.investment ? "숨기기 ▲" : "세부 보기 ▼"}
                            </button>
                          </div>
                          <strong className="text-base sm:text-lg font-mono text-white mt-2 block">{totalInvestment.toLocaleString()}원</strong>
                        </div>
                        {expandedAssets.investment && (
                          <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-[10px] text-slate-300 max-h-36 overflow-y-auto font-mono">
                            {investmentAssets.map(acc => {
                              const isStock = acc.yieldRate !== 0;
                              return (
                                <div key={acc.name} className="flex justify-between items-center">
                                  <span className="truncate max-w-[110px]" title={acc.name}>{acc.name}</span>
                                  <div className="text-right">
                                    <span>{acc.appraised.toLocaleString()}원</span>
                                    {isStock && (
                                      <span className={`text-[8px] ml-1 ${acc.yieldRate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        ({acc.yieldRate >= 0 ? "+" : ""}{acc.yieldRate}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Net Worth Alert Block */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block">🏠 총 부채 차감 후 순금융자산</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          NH농협은행 주택담보대출 이자 및 원금 ({totalLiabilities.toLocaleString()}원)을 제외한 순수한 금융 자산가치입니다.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm sm:text-base font-extrabold text-indigo-300">
                          {netWorth.toLocaleString()}원
                        </span>
                      </div>
                    </div>

                    {/* Comparison Month Picker & Trend Chart (3번: 비교 월을 직접 선택) */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                          <span>📈 월별 총 금융자산 변동 비교</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          비교하고 싶은 월들을 자유롭게 선택하세요. {anchorMonth.replace("-", "년 ")}월 실시간 자산을 기준으로, 원장에 기록 및 활성화된 월별 실질 수지를 누적 반영해 추정합니다.
                        </p>
                      </div>

                      {uniqueMonths.length === 0 ? (
                        <div className="text-xs text-slate-400 bg-white/5 rounded-xl p-4 text-center">
                          가계부 데이터가 없어 비교할 월이 없습니다. 지출과 수입 탭에서 내역을 추가해 주세요.
                        </div>
                      ) : (
                        <>
                          {/* Month toggle pills */}
                          <div className="flex flex-wrap gap-2" id="asset_compare_month_toggles">
                            {uniqueMonths.map(m => (
                              <button
                                key={m}
                                onClick={() => toggleAssetCompareMonth(m)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                                  assetCompareMonths.includes(m)
                                    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                }`}
                              >
                                {m.replace("-", "년 ")}월
                              </button>
                            ))}
                          </div>

                          {/* Per-month snapshot cards (찌그러짐 방지: 카드마다 독립된 그리드 셀 확보) */}
                          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }} id="asset_compare_cards">
                            {points.map((p, i) => {
                              const prev = i > 0 ? points[i - 1].value : null;
                              const delta = prev !== null ? p.value - prev : null;
                              return (
                                <div key={p.month} className={`rounded-2xl p-4 border ${p.month === anchorMonth ? "bg-emerald-500/10 border-emerald-400/30" : "bg-white/5 border-white/10"}`}>
                                  <span className="text-[10px] text-slate-400 font-bold block">
                                    {p.month.replace("-", "년 ")}월{p.month === anchorMonth ? " (기준)" : ""}
                                  </span>
                                  <strong className="text-sm sm:text-base font-mono text-white block mt-1">{Math.round(p.value).toLocaleString()}원</strong>
                                  {delta !== null && (
                                    <span className={`text-[11px] font-bold font-mono ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta)).toLocaleString()}원
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* SVG Chart Stage: 월 개수에 맞춰 가로 폭이 늘어나고, 비율 왜곡 없이(preserveAspectRatio) 렌더링되어 찌그러짐 없이 표시됨 */}
                          <div className="bg-slate-950/60 rounded-2xl border border-white/10 p-4 relative overflow-x-auto">
                            <div style={{ minWidth: `${chartWidth}px` }} className="h-56 relative mx-auto">
                              <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
                                <defs>
                                  <linearGradient id="wealth_gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0"/>
                                  </linearGradient>
                                </defs>

                                {/* Grid lines */}
                                <line x1={padSide} y1={plotTop} x2={chartWidth - padSide} y2={plotTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                                <line x1={padSide} y1={(plotTop + plotBottom) / 2} x2={chartWidth - padSide} y2={(plotTop + plotBottom) / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                                <line x1={padSide} y1={plotBottom} x2={chartWidth - padSide} y2={plotBottom} stroke="rgba(255,255,255,0.15)" />

                                {/* Area Gradient */}
                                {points.length > 1 && (
                                  <path
                                    d={`M ${getX(0)} ${plotBottom} ${points.map((p, i) => `L ${getX(i)} ${getY(p.value)}`).join(" ")} L ${getX(points.length - 1)} ${plotBottom} Z`}
                                    fill="url(#wealth_gradient)"
                                  />
                                )}

                                {/* Connection Line */}
                                {points.length > 1 && (
                                  <path
                                    d={points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.value)}`).join(" ")}
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Point Circles & Labels */}
                                {points.map((p, i) => (
                                  <g key={p.month}>
                                    <circle
                                      cx={getX(i)}
                                      cy={getY(p.value)}
                                      r={p.month === anchorMonth ? 7 : 6}
                                      fill="#10B981"
                                      stroke="#0F172A"
                                      strokeWidth="2.5"
                                      className={p.month === anchorMonth ? "animate-pulse" : ""}
                                    />
                                    <text x={getX(i)} y={getY(p.value) - 16} className="text-[11px] fill-emerald-300 font-mono font-bold" textAnchor="middle">
                                      {Math.round(p.value).toLocaleString()}원
                                    </text>
                                    <text x={getX(i)} y={plotBottom + 24} className="text-[11px] fill-slate-300 font-bold" textAnchor="middle">
                                      {p.month.replace("-", "년 ")}월{p.month === anchorMonth ? " (기준)" : ""}
                                    </text>
                                  </g>
                                ))}
                              </svg>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="text-[11px] text-slate-400 text-center font-bold bg-white/5 py-2.5 rounded-xl border border-white/5">
                        💡 <span className="text-emerald-300 font-extrabold">실시간 피드백:</span> 가계부 탭에서 각 행의 활성/비활성 상태를 변경하면, 선택한 월들의 자산 추정치가 즉시 다시 계산됩니다!
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Asset Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="asset_pie_and_stock_bars">
                
                {/* 1) Donut Asset Ratio Box */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4" id="asset_ratio_donut_box">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></span>
                      <span>🍩 예적금·현금성 vs 투자성 자산 비율</span>
                    </h4>
                    <p className="text-xs text-slate-400">우리 가계의 금융 포트폴리오 안전성 현황</p>
                  </div>

                  {/* Interactive Custom SVG Pie Chart */}
                  <div className="flex flex-col sm:flex-row items-center justify-around py-4" id="custom_donut_graph_stage">
                    
                    {/* SVG Donut */}
                    <div className="relative w-44 h-44 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Circle background */}
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="16" />
                        
                        {/* Circle 1: Cash/Deposit like (84.8%) */}
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="38" 
                          fill="transparent" 
                          stroke="#10B981" 
                          strokeWidth="16" 
                          strokeDasharray="238.76" 
                          strokeDashoffset={(238.76 * (1 - 0.848))}
                        />
                        
                        {/* Circle 2: Stocks/Investments (15.2%) */}
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="38" 
                          fill="transparent" 
                          stroke="#F97316" 
                          strokeWidth="16" 
                          strokeDasharray="238.76" 
                          strokeDashoffset="238.76" // Align to top
                          style={{
                            strokeDashoffset: (238.76 * (1 - 0.152)),
                            transform: "rotate(" + (360 * 0.848) + "deg)",
                            transformOrigin: "50% 50%"
                          }}
                        />
                      </svg>
                      
                      {/* Central label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Asset Ratio</span>
                        <strong className="text-base font-black text-slate-900 font-mono">15.2%</strong>
                        <span className="text-[9px] text-orange-500 font-bold">투자 자산율</span>
                      </div>
                    </div>

                    {/* Custom Pie Legend details */}
                    <div className="space-y-3.5 text-xs sm:text-sm mt-4 sm:mt-0 max-w-xs" id="pie_legend_details">
                      <div className="flex items-start space-x-2">
                        <span className="w-3.5 h-3.5 bg-emerald-500 rounded mt-0.5 shrink-0"></span>
                        <div>
                          <p className="font-bold text-slate-800">예적금 및 현금성 자산</p>
                          <span className="font-mono text-slate-500 text-xs block">
                            {(totalFree + totalSavings + totalElectronic).toLocaleString()}원 (84.8%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start space-x-2">
                        <span className="w-3.5 h-3.5 bg-orange-500 rounded mt-0.5 shrink-0"></span>
                        <div>
                          <p className="font-bold text-slate-800">투자성 자산 (주식/CMA)</p>
                          <span className="font-mono text-slate-500 text-xs block">
                            {totalInvestment.toLocaleString()}원 (15.2%)
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2) Stock Evaluation Comparison */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4" id="stock_comparison_box">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></span>
                      <span>📊 주요 주식 종목 평가 (투자 원금 대비 수익 현황)</span>
                    </h4>
                    <p className="text-xs text-slate-400">TIGER S&P500 (+50.33%) 및 KODEX 차이나테크 (-0.68%) 상세 현황</p>
                  </div>

                  {/* Compound Stock Bars */}
                  <div className="space-y-6 py-2" id="stock_bars_display">
                    
                    {/* Item 1: TIGER S&P500 */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <strong className="text-slate-800 text-xs sm:text-sm">TIGER 미국S&P500</strong>
                        <span className="text-emerald-600 font-mono font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-md">
                          수익률: +50.33%
                        </span>
                      </div>
                      
                      {/* Bars overlay */}
                      <div className="space-y-1">
                        {/* Principal Bar */}
                        <div className="relative">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5 font-bold">
                            <span>투자 원금:</span>
                            <span className="font-mono">1,277,189원</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-lg h-3.5">
                            <div className="bg-slate-400 h-3.5 rounded-lg transition-all duration-500" style={{ width: "66%" }}></div>
                          </div>
                        </div>

                        {/* Appraised Bar */}
                        <div className="relative">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5 font-bold">
                            <span>평가 금액:</span>
                            <span className="font-mono text-emerald-600 font-bold">1,919,980원</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-lg h-3.5">
                            <div className="bg-emerald-500 h-3.5 rounded-lg transition-all duration-500" style={{ width: "100%" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Item 2: KODEX 차이나테크TOP10 */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <strong className="text-slate-800 text-xs sm:text-sm">KODEX 차이나테크TOP10</strong>
                        <span className="text-rose-600 font-mono font-bold text-xs bg-rose-50 px-2 py-0.5 rounded-md">
                          수익률: -0.68%
                        </span>
                      </div>

                      {/* Bars overlay */}
                      <div className="space-y-1">
                        {/* Principal Bar */}
                        <div className="relative">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5 font-bold">
                            <span>투자 원금:</span>
                            <span className="font-mono">1,737,959원</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-lg h-3.5">
                            <div className="bg-slate-400 h-3.5 rounded-lg transition-all duration-500" style={{ width: "100%" }}></div>
                          </div>
                        </div>

                        {/* Appraised Bar */}
                        <div className="relative">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5 font-bold">
                            <span>평가 금액:</span>
                            <span className="font-mono text-slate-800 font-bold">1,726,080원</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-lg h-3.5">
                            <div className="bg-rose-400 h-3.5 rounded-lg transition-all duration-500" style={{ width: "99.3%" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* 대출 상환 기록 (원리금균등/원금균등 방식 순차 재계산) */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6" id="mortgage_payment_history_section">
                <div className="border-b border-slate-100 pb-4">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <span>🏦 {LIABILITY_MORTGAGE.name} 상환 기록</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    상환할 때마다 그 회차의 이자(남은 원금 × 월 이자율)를 먼저 계산하고, 나머지가 원금을 줄이는 방식으로 잔액과 누적 이자를 순차 재계산합니다.
                  </p>
                </div>

                {(() => {
                  const monthlyRate = (LIABILITY_MORTGAGE.rate / 100) / 12;
                  let runningBalance = LIABILITY_MORTGAGE.amount;
                  const rows = mortgagePayments.map(p => {
                    const interest = runningBalance * monthlyRate;
                    let principalPortion = p.amount - interest;
                    if (principalPortion < 0) principalPortion = 0;
                    if (principalPortion > runningBalance) principalPortion = runningBalance;
                    runningBalance -= principalPortion;
                    return { ...p, interest, principalPortion, balanceAfter: runningBalance };
                  });
                  const totalPrincipalPaid = rows.reduce((s, r) => s + r.principalPortion, 0);
                  const totalInterestPaid = rows.reduce((s, r) => s + r.interest, 0);
                  const remainingBalance = runningBalance;

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100/30 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">🏠 현재 남은 원금</span>
                          <strong className="text-base sm:text-lg font-mono text-rose-700 block">{Math.round(remainingBalance).toLocaleString()}원</strong>
                        </div>
                        <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/30 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">💰 누적 원금 상환액</span>
                          <strong className="text-base sm:text-lg font-mono text-emerald-700 block">{Math.round(totalPrincipalPaid).toLocaleString()}원</strong>
                        </div>
                        <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/30 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">📉 누적 납부 이자</span>
                          <strong className="text-base sm:text-lg font-mono text-amber-700 block">{Math.round(totalInterestPaid).toLocaleString()}원</strong>
                        </div>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const dateInput = form.elements.namedItem("paymentDate") as HTMLInputElement;
                          const amountInput = form.elements.namedItem("paymentAmount") as HTMLInputElement;
                          const memoInput = form.elements.namedItem("paymentMemo") as HTMLInputElement;
                          handleAddMortgagePayment(dateInput.value, Number(amountInput.value), memoInput.value);
                          amountInput.value = "";
                          memoInput.value = "";
                        }}
                        className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-slate-50 border border-slate-200 rounded-2xl p-4"
                        id="mortgage_payment_form"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block">상환 날짜</label>
                          <input
                            name="paymentDate"
                            type="date"
                            required
                            defaultValue={new Date().toISOString().substring(0, 10)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block">상환액 (원)</label>
                          <input
                            name="paymentAmount"
                            type="number"
                            required
                            min="1"
                            placeholder="2500000"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block">메모 (선택)</label>
                          <input
                            name="paymentMemo"
                            type="text"
                            placeholder="정기 상환 / 중도상환 등"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <button
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all cursor-pointer"
                        >
                          상환 기록 추가
                        </button>
                      </form>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm" id="mortgage_payment_table">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-left">
                              <th className="py-2 pr-3 font-bold whitespace-nowrap">회차</th>
                              <th className="py-2 pr-3 font-bold whitespace-nowrap">날짜</th>
                              <th className="py-2 pr-3 font-bold text-right whitespace-nowrap">상환액</th>
                              <th className="py-2 pr-3 font-bold text-right whitespace-nowrap">이자</th>
                              <th className="py-2 pr-3 font-bold text-right whitespace-nowrap">원금 상환분</th>
                              <th className="py-2 pr-3 font-bold text-right whitespace-nowrap">상환 후 잔액</th>
                              <th className="py-2 pr-3 font-bold whitespace-nowrap">메모</th>
                              <th className="py-2 pr-3 font-bold whitespace-nowrap"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr><td colSpan={8} className="text-center py-8 text-slate-400">아직 기록된 상환 내역이 없습니다.</td></tr>
                            ) : (
                              rows.map((r, i) => (
                                <tr key={r.id} className="border-b border-slate-100">
                                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{i + 1}회</td>
                                  <td className="py-2 pr-3 font-mono text-slate-500 whitespace-nowrap">{r.paymentDate}</td>
                                  <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{r.amount.toLocaleString()}원</td>
                                  <td className="py-2 pr-3 text-right font-mono text-amber-600 whitespace-nowrap">{Math.round(r.interest).toLocaleString()}원</td>
                                  <td className="py-2 pr-3 text-right font-mono text-emerald-600 whitespace-nowrap">{Math.round(r.principalPortion).toLocaleString()}원</td>
                                  <td className="py-2 pr-3 text-right font-mono text-rose-600 whitespace-nowrap">{Math.round(r.balanceAfter).toLocaleString()}원</td>
                                  <td className="py-2 pr-3 text-slate-500">{r.memo || "-"}</td>
                                  <td className="py-2 pr-3">
                                    <button
                                      onClick={() => handleDeleteMortgagePayment(r.id)}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                      title="상환 기록 삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </div>

            </div>
          )}

        </div>

        {/* --- GLOBAL APP FOOTER --- */}
        <footer className="bg-white border-t border-slate-200 px-8 py-6 text-center text-[11px] sm:text-xs text-slate-400" id="global_footer">
          <p className="font-medium">© 2026 최영범·강재은 한라비발디 통합 재정 대시보드. All Rights Reserved.</p>
          <p className="text-[10px] text-slate-300 mt-1">Designed with precision in Google AI Studio • Professional Polish Theme</p>
        </footer>

      </main>

    </div>
  );
}

