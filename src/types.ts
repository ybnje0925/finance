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
}

export interface InvestmentItem {
  name: string;
  principal: number;
  appraised: number;
  yieldRate: number;
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
