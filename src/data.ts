/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LedgerItem, InvestmentItem, ChecklistState } from "./types";

export const MOVE_IN_DATE = "2026-07-06";

export const HUSBAND = {
  name: "최영범",
  birthYear: 1992,
  creditScore: 969,
};

export const WIFE = {
  name: "강재은",
  birthYear: 1989,
};

export const LOCATION = "경기도 하남시 감이동 한라비발디";

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
export const INITIAL_CHECKLIST: ChecklistState = {
  "주택담보대출 이자 및 관리비 자동이체 확인": false,
  "어머니 육아 도우미 감사 수당 이체 확인": false,
  "배당금 분배금(SCHD/JEPQ) 재투자 계좌 이체": false,
};

// 가계부 내역
export const INITIAL_LEDGER: LedgerItem[] = [];

export const STREAMLIT_CODE = `import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date

# ------------------------------------------------------------------
# PAGE CONFIG & STYLING
# ------------------------------------------------------------------
st.set_page_config(
    page_title="우리집 통합 재정 대시보드",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ... (전체 소스 코드는 /app.py 파일을 직접 열어 보시거나 복사해 가실 수 있습니다!)
`;
