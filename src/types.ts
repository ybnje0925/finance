/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LedgerItem {
  id: number;
  month: string;
  type: "수입" | "지출";
  category: string;
  content: string;
  amount: number;
  active: boolean;
  date: string;
  memo?: string;
  paymentMethod?: string;
  spender?: string;
}

export interface InvestmentItem {
  name: string;
  principal: number;
  appraised: number;
  yieldRate: number;
}

export interface AssetSnapshot {
  freeAssets: { name: string; amount: number }[];
  savingsAssets: { name: string; amount: number }[];
  electronicAssets: { name: string; amount: number }[];
  investmentAssets: InvestmentItem[];
  liability?: {
    amount: number;
    rate?: number | null;
  };
}

export interface ChecklistItem {
  id: number;
  label: string;
  done: boolean;
  sortOrder: number;
}

export interface MortgagePayment {
  id: number;
  paymentDate: string;
  amount: number;
  memo?: string;
}
