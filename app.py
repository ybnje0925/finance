import os
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai
import pandas as pd
import plotly.express as px
import streamlit as st
from supabase import Client, create_client


st.set_page_config(
    page_title="연준이네 가계부",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded",
)


def get_setting(name: str, default: str = "") -> str:
    env_value = os.getenv(name)
    if env_value:
        return env_value
    try:
        return st.secrets.get(name, default)
    except Exception:
        return default


SUPABASE_URL = get_setting("SUPABASE_URL")
SUPABASE_KEY = get_setting("SUPABASE_SERVICE_ROLE_KEY") or get_setting("SUPABASE_ANON_KEY")
GEMINI_API_KEY = get_setting("GEMINI_API_KEY")

INCOME_EXPENSES_TABLE = "income_expenses"
ASSETS_YOUNGBEOM_TABLE = "assets_youngbeom"
ASSETS_JAEEUN_TABLE = "assets_jaeeun"


@st.cache_resource(show_spinner=False)
def get_supabase_client() -> Optional[Client]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def money(value: Any) -> str:
    try:
        return f"{int(round(float(value))):,}원"
    except (TypeError, ValueError):
        return "0원"


def pct(value: float) -> str:
    return f"{value:.1f}%"


def normalize_amount(value: Any) -> int:
    if pd.isna(value):
        return 0
    if isinstance(value, str):
        cleaned = (
            value.replace(",", "")
            .replace("원", "")
            .replace("₩", "")
            .replace(" ", "")
        )
        if cleaned in ("", "-", "+"):
            return 0
        try:
            return int(round(float(cleaned)))
        except ValueError:
            return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def pick_column(columns: List[str], candidates: List[str]) -> Optional[str]:
    normalized = {str(col).strip(): col for col in columns}
    for keyword in candidates:
        for name, original in normalized.items():
            if keyword in name:
                return original
    return None


def fetch_all(table: str) -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if client is None:
        return []

    rows: List[Dict[str, Any]] = []
    start = 0
    page_size = 1000
    while True:
        result = (
            client.table(table)
            .select("*")
            .order("date", desc=False)
            .range(start, start + page_size - 1)
            .execute()
        )
        page = result.data or []
        rows.extend(page)
        if len(page) < page_size:
            break
        start += page_size
    return rows


def fetch_assets(table: str) -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if client is None:
        return []
    result = client.table(table).select("*").order("amount", desc=True).execute()
    return result.data or []


@st.cache_data(ttl=30, show_spinner=False)
def load_remote_data() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    ledger = pd.DataFrame(fetch_all(INCOME_EXPENSES_TABLE))
    youngbeom = pd.DataFrame(fetch_assets(ASSETS_YOUNGBEOM_TABLE))
    jaeeun = pd.DataFrame(fetch_assets(ASSETS_JAEEUN_TABLE))

    for frame in (ledger, youngbeom, jaeeun):
        if "amount" in frame.columns:
            frame["amount"] = frame["amount"].apply(normalize_amount)

    if not ledger.empty and "date" in ledger.columns:
        ledger["date"] = pd.to_datetime(ledger["date"], errors="coerce")
        ledger = ledger.sort_values("date", ascending=False)

    sync_info = {
        "ledger_count": len(ledger),
        "youngbeom_count": len(youngbeom),
        "jaeeun_count": len(jaeeun),
        "loaded_at": datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S"),
    }
    return ledger, youngbeom, jaeeun, sync_info


def classify_signed_ledger(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    result = df.copy()
    if "type" not in result.columns:
        result["type"] = "지출"
    result["amount"] = result["amount"].apply(normalize_amount)
    result.loc[result["amount"] > 0, "type"] = "수입"
    result.loc[result["amount"] < 0, "type"] = "지출"
    result["amount_abs"] = result["amount"].abs()
    return result


def parse_ledger_excel(file: BytesIO) -> pd.DataFrame:
    book = pd.ExcelFile(file)
    rows: List[pd.DataFrame] = []
    for sheet_name in book.sheet_names:
        raw = pd.read_excel(book, sheet_name=sheet_name)
        if raw.empty:
            continue
        date_col = pick_column(raw.columns.tolist(), ["날짜", "일자", "거래일", "사용일"])
        content_col = pick_column(raw.columns.tolist(), ["내용", "적요", "거래내용", "가맹점", "사용처"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "출금", "입금", "사용금액", "결제금액"])
        category_col = pick_column(raw.columns.tolist(), ["카테고리", "분류", "항목"])
        method_col = pick_column(raw.columns.tolist(), ["결제수단", "카드", "계좌", "수단"])
        memo_col = pick_column(raw.columns.tolist(), ["메모", "비고", "content", "note"])
        if not date_col or not amount_col:
            continue
        parsed = pd.DataFrame(
            {
                "date": pd.to_datetime(raw[date_col], errors="coerce").dt.date.astype(str),
                "content": raw[content_col].astype(str) if content_col else "",
                "amount": raw[amount_col].apply(normalize_amount),
                "category": raw[category_col].astype(str) if category_col else "미분류",
                "payment_method": raw[method_col].astype(str) if method_col else "",
                "memo": raw[memo_col].astype(str) if memo_col else "",
                "spender": sheet_name.strip(),
            }
        )
        rows.append(parsed.dropna(subset=["date"]))
    if not rows:
        return pd.DataFrame()
    ledger = pd.concat(rows, ignore_index=True)
    ledger = classify_signed_ledger(ledger)
    return ledger


def parse_asset_excel(file: BytesIO) -> Tuple[pd.DataFrame, pd.DataFrame]:
    book = pd.ExcelFile(file)
    parsed_by_owner: Dict[str, List[pd.DataFrame]] = {"영범": [], "재은": []}
    for sheet_name in book.sheet_names:
        owner = "영범" if "영범" in sheet_name else "재은" if "재은" in sheet_name else sheet_name.strip()
        raw = pd.read_excel(book, sheet_name=sheet_name)
        if raw.empty:
            continue
        name_col = pick_column(raw.columns.tolist(), ["계좌", "상품", "종목", "자산", "이름", "명"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "잔액", "평가", "현재가", "자산"])
        category_col = pick_column(raw.columns.tolist(), ["구분", "분류", "유형", "카테고리"])
        if not name_col or not amount_col:
            continue
        assets = pd.DataFrame(
            {
                "owner": owner,
                "name": raw[name_col].astype(str).apply(lambda name: f"[{owner}] {name}"),
                "category": raw[category_col].astype(str) if category_col else "금융자산",
                "amount": raw[amount_col].apply(normalize_amount),
                "source_sheet": sheet_name,
            }
        )
        if owner in parsed_by_owner:
            parsed_by_owner[owner].append(assets)
    youngbeom = pd.concat(parsed_by_owner["영범"], ignore_index=True) if parsed_by_owner["영범"] else pd.DataFrame()
    jaeeun = pd.concat(parsed_by_owner["재은"], ignore_index=True) if parsed_by_owner["재은"] else pd.DataFrame()
    return youngbeom, jaeeun


def replace_table(table: str, df: pd.DataFrame) -> None:
    client = get_supabase_client()
    if client is None or df.empty:
        return
    client.table(table).delete().neq("id", 0).execute()
    records = df.where(pd.notna(df), None).to_dict(orient="records")
    for start in range(0, len(records), 500):
        client.table(table).insert(records[start : start + 500]).execute()


def render_sidebar(sync_info: Dict[str, Any]) -> None:
    st.sidebar.title("연준이네 가계부")
    st.sidebar.caption("Supabase 자동 연동 상태")

    connected = get_supabase_client() is not None
    st.sidebar.metric("DB 연결", "정상" if connected else "미설정")
    st.sidebar.metric("최종 동기화", sync_info.get("loaded_at", "-"))
    st.sidebar.metric("수입/지출 레코드", f"{sync_info.get('ledger_count', 0):,}건")
    st.sidebar.metric("영범 자산", f"{sync_info.get('youngbeom_count', 0):,}건")
    st.sidebar.metric("재은 자산", f"{sync_info.get('jaeeun_count', 0):,}건")

    if st.sidebar.button("Supabase 최신 데이터 새로고침", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    st.sidebar.divider()
    st.sidebar.subheader("엑셀 수동 동기화")
    ledger_file = st.sidebar.file_uploader("수입/지출 엑셀", type=["xlsx", "xls"], key="ledger_upload")
    asset_file = st.sidebar.file_uploader("자산 엑셀", type=["xlsx", "xls"], key="asset_upload")

    if ledger_file and st.sidebar.button("수입/지출 DB 저장", use_container_width=True):
        ledger = parse_ledger_excel(ledger_file)
        replace_table(INCOME_EXPENSES_TABLE, ledger)
        st.cache_data.clear()
        st.sidebar.success(f"{len(ledger):,}건 저장 완료")
        st.rerun()

    if asset_file and st.sidebar.button("자산 DB 저장", use_container_width=True):
        youngbeom, jaeeun = parse_asset_excel(asset_file)
        replace_table(ASSETS_YOUNGBEOM_TABLE, youngbeom)
        replace_table(ASSETS_JAEEUN_TABLE, jaeeun)
        st.cache_data.clear()
        st.sidebar.success(f"영범 {len(youngbeom):,}건, 재은 {len(jaeeun):,}건 저장 완료")
        st.rerun()


def render_overview(ledger: pd.DataFrame, all_assets: pd.DataFrame) -> None:
    ledger = classify_signed_ledger(ledger)
    income = ledger[ledger["type"] == "수입"]["amount_abs"].sum() if not ledger.empty else 0
    expense = ledger[ledger["type"] == "지출"]["amount_abs"].sum() if not ledger.empty else 0
    total_assets = all_assets["amount"].sum() if not all_assets.empty else 0
    net_cash_flow = income - expense

    cols = st.columns(4)
    cols[0].metric("총 수입", money(income))
    cols[1].metric("총 지출", money(expense))
    cols[2].metric("순현금흐름", money(net_cash_flow))
    cols[3].metric("가계 총 자산", money(total_assets))

    if not ledger.empty:
        monthly = (
            ledger.assign(month=ledger["date"].dt.strftime("%Y-%m"))
            .groupby(["month", "type"], as_index=False)["amount_abs"]
            .sum()
        )
        st.plotly_chart(
            px.bar(monthly, x="month", y="amount_abs", color="type", barmode="group", title="월별 수입/지출"),
            use_container_width=True,
        )

    st.subheader("Gemini 데이터 분석 챗봇")
    question = st.chat_input("예: 지난달보다 이번 달 지출이 얼마나 늘었어?")
    if question:
        if not GEMINI_API_KEY:
            st.warning("Vercel 환경변수 GEMINI_API_KEY가 설정되어 있지 않습니다.")
            return
        context = {
            "ledger_recent": ledger.head(300).to_dict(orient="records"),
            "asset_summary": all_assets.to_dict(orient="records"),
        }
        prompt = (
            "너는 부부 가계부 데이터 분석가다. 한국어로 짧고 구체적으로 답한다.\n"
            f"질문: {question}\n"
            f"데이터 컨텍스트: {context}"
        )
        with st.spinner("Gemini가 최신 데이터를 분석 중입니다."):
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            st.write(response.text)


def render_ledger(ledger: pd.DataFrame) -> None:
    st.subheader("지출과 수입")
    if ledger.empty:
        st.info("Supabase에 저장된 수입/지출 데이터가 없습니다.")
        return
    ledger = classify_signed_ledger(ledger)
    category = st.selectbox("카테고리", ["전체"] + sorted(ledger["category"].dropna().unique().tolist()))
    sort_by = st.radio("정렬 기준", ["날짜 기준", "지출자 기준"], horizontal=True)
    filtered = ledger if category == "전체" else ledger[ledger["category"] == category]
    if sort_by == "지출자 기준":
        filtered = filtered.sort_values(["spender", "date"], ascending=[True, False])
    else:
        filtered = filtered.sort_values("date", ascending=False)
    st.dataframe(
        filtered[["date", "type", "category", "content", "amount_abs", "payment_method", "spender", "memo"]],
        use_container_width=True,
        hide_index=True,
    )


def render_financial_analysis(ledger: pd.DataFrame) -> None:
    st.subheader("재무적 지출 분석")
    if ledger.empty:
        st.info("분석할 지출 데이터가 없습니다.")
        return
    ledger = classify_signed_ledger(ledger)
    expense = ledger[ledger["type"] == "지출"].copy()
    if expense.empty:
        st.info("지출 데이터가 없습니다.")
        return
    category_sum = expense.groupby("category", as_index=False)["amount_abs"].sum().sort_values("amount_abs", ascending=False)
    st.plotly_chart(px.pie(category_sum, names="category", values="amount_abs", hole=0.55, title="카테고리별 지출 비중"), use_container_width=True)

    selected = st.selectbox("상세 지출 드릴다운 카테고리", category_sum["category"].tolist())
    detail = expense[expense["category"] == selected].copy()
    total_expense = expense["amount_abs"].sum()
    selected_sum = detail["amount_abs"].sum()
    cols = st.columns(3)
    cols[0].metric("선택 카테고리 지출", money(selected_sum))
    cols[1].metric("건수", f"{len(detail):,}건")
    cols[2].metric("전체 지출 대비", pct(selected_sum / total_expense * 100 if total_expense else 0))

    recent = (
        detail.assign(month=detail["date"].dt.strftime("%Y-%m"))
        .groupby("month", as_index=False)["amount_abs"]
        .sum()
        .sort_values("month", ascending=False)
        .head(6)
        .sort_values("month")
    )
    st.dataframe(recent.rename(columns={"month": "월", "amount_abs": "지출금액"}), use_container_width=True, hide_index=True)
    st.dataframe(detail[["date", "content", "amount_abs", "payment_method", "spender", "memo"]], use_container_width=True, hide_index=True)


def render_assets(youngbeom: pd.DataFrame, jaeeun: pd.DataFrame) -> pd.DataFrame:
    st.subheader("자산 및 부채")
    all_assets = pd.concat([youngbeom, jaeeun], ignore_index=True) if not youngbeom.empty or not jaeeun.empty else pd.DataFrame()
    if all_assets.empty:
        st.info("Supabase에 저장된 자산 데이터가 없습니다.")
        return all_assets
    for owner, frame in [("영범", youngbeom), ("재은", jaeeun)]:
        st.markdown(f"#### {owner} 자산")
        st.dataframe(frame.sort_values("amount", ascending=False), use_container_width=True, hide_index=True)
    st.metric("가계 총 자산", money(all_assets["amount"].sum()))
    return all_assets


def render_improvement_report(ledger: pd.DataFrame, all_assets: pd.DataFrame) -> None:
    st.subheader("가계부 및 앱 개선 리포트")
    ledger = classify_signed_ledger(ledger)
    income = ledger[ledger["type"] == "수입"]["amount_abs"].sum() if not ledger.empty else 0
    expense = ledger[ledger["type"] == "지출"]["amount_abs"].sum() if not ledger.empty else 0
    total_assets = all_assets["amount"].sum() if not all_assets.empty else 0
    expense_ratio = expense / income * 100 if income else 0

    st.markdown("#### 재무 체질 개선 리포트")
    st.write(f"- 수입 대비 지출 비중은 **{pct(expense_ratio)}**입니다.")
    st.write(f"- 현재 확인된 가계 총 자산은 **{money(total_assets)}**입니다.")
    if expense_ratio >= 80:
        st.warning("지출 비중이 높습니다. 고정비와 반복 결제 항목부터 줄일 여지가 있는지 확인해 보세요.")
    elif expense_ratio >= 60:
        st.info("지출 비중은 관리 가능한 범위지만, 변동비 상위 카테고리의 월별 추이를 꾸준히 보는 편이 좋습니다.")
    else:
        st.success("수입 대비 지출 비중이 안정적입니다. 남는 현금흐름을 비상금과 투자 재원으로 분리 관리해 보세요.")

    st.markdown("#### 앱 및 기능 개선 제안")
    st.write("- 카테고리별 월 예산 한도를 저장하고 초과 시 경고하는 기능")
    st.write("- 최근 3개월 평균보다 지출이 급증한 항목 자동 알림")
    st.write("- 비상금 목표액과 현재 달성률 추적")
    st.write("- 자산별 수익률과 현금성 자산 비중 자동 진단")


def main() -> None:
    ledger, youngbeom, jaeeun, sync_info = load_remote_data()
    render_sidebar(sync_info)

    all_assets = pd.concat([youngbeom, jaeeun], ignore_index=True) if not youngbeom.empty or not jaeeun.empty else pd.DataFrame()
    tabs = st.tabs(["🏠 총괄 대시보드", "💸 지출과 수입", "📊 재무적 지출 분석", "📈 자산 및 부채", "🧩 가계부 및 앱 개선 리포트"])
    with tabs[0]:
        render_overview(ledger, all_assets)
    with tabs[1]:
        render_ledger(ledger)
    with tabs[2]:
        render_financial_analysis(ledger)
    with tabs[3]:
        render_assets(youngbeom, jaeeun)
    with tabs[4]:
        render_improvement_report(ledger, all_assets)


if __name__ == "__main__":
    main()
