/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LedgerItem, InvestmentItem, ChecklistItem } from "./types";

export const MOVE_IN_DATE = "2026-07-06";

export const HUSBAND = {
  name: "최영범",
  birthYear: 1992,
};

export const WIFE = {
  name: "강재은",
  birthYear: 1989,
};

// 자유입출금 자산
export const ASSET_FREE_DEPOSITS: { name: string; amount: number }[] = [];

// 저축성 자산
export const ASSET_SAVINGS: { name: string; amount: number }[] = [];

// 전자금융 자산
export const ASSET_ELECTRONIC: { name: string; amount: number }[] = [];

// 투자성 자산 (상세 및 평가액)
export const ASSET_INVESTMENTS: InvestmentItem[] = [];

// 부채
export const LIABILITY_MORTGAGE = {
  name: "NH주택담보대출",
  amount: 600000000,
  rate: 4.08,
  startDate: "2026-06-19",
  endDate: "2056-05-23",
};

// 체크리스트
export const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: 1, label: "주택담보대출 이자 및 관리비 자동이체 확인", done: false, sortOrder: 0 },
  { id: 2, label: "어머니 육아 도우미 감사 수당 이체 확인", done: false, sortOrder: 1 },
  { id: 3, label: "배당금 분배금(SCHD/JEPQ) 재투자 계좌 이체", done: false, sortOrder: 2 },
];

// 가계부 내역
export const INITIAL_LEDGER: LedgerItem[] = [];
