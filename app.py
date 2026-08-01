import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai
import pandas as pd
from flask import Flask, jsonify, render_template_string, request
from supabase import Client, create_client


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or ""
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

INCOME_EXPENSES_TABLE = "income_expenses"
ASSETS_YOUNGBEOM_TABLE = "assets_youngbeom"
ASSETS_JAEEUN_TABLE = "assets_jaeeun"

app = Flask(__name__)


def get_supabase_client() -> Optional[Client]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def normalize_amount(value: Any) -> int:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0
    if isinstance(value, str):
        cleaned = (
            value.replace(",", "")
            .replace("원", "")
            .replace("₩", "")
            .replace(" ", "")
            .strip()
        )
        if cleaned in {"", "-", "+"}:
            return 0
        try:
            return int(round(float(cleaned)))
        except ValueError:
            return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def money(value: Any) -> str:
    return f"{normalize_amount(value):,}원"


def pct(value: float) -> str:
    return f"{value:.1f}%"


def fetch_table(table: str, order_column: str = "id", desc: bool = False) -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if client is None:
        return []

    rows: List[Dict[str, Any]] = []
    start = 0
    page_size = 1000
    while True:
        response = (
            client.table(table)
            .select("*")
            .order(order_column, desc=desc)
            .range(start, start + page_size - 1)
            .execute()
        )
        page = response.data or []
        rows.extend(page)
        if len(page) < page_size:
            return rows
        start += page_size


def load_data() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    ledger = pd.DataFrame(fetch_table(INCOME_EXPENSES_TABLE, "date", True))
    youngbeom = pd.DataFrame(fetch_table(ASSETS_YOUNGBEOM_TABLE, "amount", True))
    jaeeun = pd.DataFrame(fetch_table(ASSETS_JAEEUN_TABLE, "amount", True))

    for frame in (ledger, youngbeom, jaeeun):
        if not frame.empty and "amount" in frame.columns:
            frame["amount"] = frame["amount"].apply(normalize_amount)

    if not ledger.empty:
        if "date" in ledger.columns:
            ledger["date"] = pd.to_datetime(ledger["date"], errors="coerce")
        if "type" not in ledger.columns:
            ledger["type"] = "지출"
        ledger.loc[ledger["amount"] > 0, "type"] = "수입"
        ledger.loc[ledger["amount"] < 0, "type"] = "지출"
        ledger["amount_abs"] = ledger["amount"].abs()
        ledger = ledger.sort_values("date", ascending=False)

    youngbeom = tag_owner_assets(youngbeom, "영범")
    jaeeun = tag_owner_assets(jaeeun, "재은")
    latest_sync = latest_sync_time([ledger, youngbeom, jaeeun])
    youngbeom_total = int(youngbeom["amount"].sum()) if not youngbeom.empty else 0
    jaeeun_total = int(jaeeun["amount"].sum()) if not jaeeun.empty else 0

    sync_info = {
        "connected": get_supabase_client() is not None,
        "loaded_at": latest_sync or datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S"),
        "income_expenses_count": len(ledger),
        "assets_youngbeom_count": len(youngbeom),
        "assets_jaeeun_count": len(jaeeun),
        "assets_youngbeom_total": youngbeom_total,
        "assets_jaeeun_total": jaeeun_total,
        "tables": [
            {"name": INCOME_EXPENSES_TABLE, "count": len(ledger), "status": "연동됨" if not ledger.empty else "비어 있음"},
            {"name": ASSETS_YOUNGBEOM_TABLE, "count": len(youngbeom), "status": "연동됨" if not youngbeom.empty else "비어 있음"},
            {"name": ASSETS_JAEEUN_TABLE, "count": len(jaeeun), "status": "연동됨" if not jaeeun.empty else "비어 있음"},
        ],
    }
    return ledger, youngbeom, jaeeun, sync_info


def latest_sync_time(frames: List[pd.DataFrame]) -> Optional[str]:
    candidates: List[pd.Timestamp] = []
    for frame in frames:
        if frame.empty:
            continue
        for column in ("synced_at", "created_at"):
            if column not in frame.columns:
                continue
            values = pd.to_datetime(frame[column], errors="coerce", utc=True).dropna()
            if not values.empty:
                candidates.append(values.max())
    if not candidates:
        return None
    return max(candidates).tz_convert(None).strftime("%Y-%m-%d %H:%M:%S")


def tag_owner_assets(df: pd.DataFrame, owner: str) -> pd.DataFrame:
    if df.empty:
        return df
    result = df.copy()
    result["owner"] = owner
    if "name" not in result.columns:
        result["name"] = ""
    result["name"] = result["name"].astype(str).apply(
        lambda name: name if name.startswith(f"[{owner}]") else f"[{owner}] {name}"
    )
    if "category" not in result.columns:
        result["category"] = "금융자산"
    return result


def summarize_finance(ledger: pd.DataFrame, assets: pd.DataFrame) -> Dict[str, Any]:
    if ledger.empty:
        income = expense = fixed_expense = variable_expense = 0
        category_expense: List[Dict[str, Any]] = []
        monthly: List[Dict[str, Any]] = []
    else:
        income_df = ledger[ledger["type"] == "수입"]
        expense_df = ledger[ledger["type"] == "지출"]
        income = int(income_df["amount_abs"].sum())
        expense = int(expense_df["amount_abs"].sum())
        fixed_words = ("보험", "관리비", "통신", "구독", "대출", "렌트", "월세", "교육")
        fixed_mask = expense_df["category"].fillna("").astype(str).str.contains("|".join(fixed_words), regex=True)
        fixed_expense = int(expense_df.loc[fixed_mask, "amount_abs"].sum())
        variable_expense = int(expense - fixed_expense)
        category_expense = (
            expense_df.groupby("category", dropna=False)["amount_abs"]
            .sum()
            .sort_values(ascending=False)
            .head(10)
            .reset_index()
            .to_dict(orient="records")
        )
        monthly = (
            ledger.assign(month=ledger["date"].dt.strftime("%Y-%m"))
            .groupby(["month", "type"], as_index=False)["amount_abs"]
            .sum()
            .sort_values("month")
            .tail(18)
            .to_dict(orient="records")
        )

    total_assets = int(assets["amount"].sum()) if not assets.empty else 0
    return {
        "income": income,
        "expense": expense,
        "cash_flow": income - expense,
        "total_assets": total_assets,
        "fixed_expense": fixed_expense,
        "variable_expense": variable_expense,
        "expense_ratio": expense / income * 100 if income else 0,
        "fixed_ratio": fixed_expense / expense * 100 if expense else 0,
        "variable_ratio": variable_expense / expense * 100 if expense else 0,
        "category_expense": category_expense,
        "monthly": monthly,
    }


def dataframe_records(df: pd.DataFrame, limit: int = 100) -> List[Dict[str, Any]]:
    if df.empty:
        return []
    safe = df.head(limit).copy()
    for col in safe.columns:
        if pd.api.types.is_datetime64_any_dtype(safe[col]):
            safe[col] = safe[col].dt.strftime("%Y-%m-%d")
    return safe.where(pd.notna(safe), None).to_dict(orient="records")


def build_gemini_context(ledger: pd.DataFrame, assets: pd.DataFrame, summary: Dict[str, Any]) -> str:
    context = {
        "summary": summary,
        "recent_income_expenses": dataframe_records(ledger, 250),
        "assets": dataframe_records(assets, 200),
    }
    return json.dumps(context, ensure_ascii=False, default=str)


def render_rows(rows: List[Dict[str, Any]], columns: List[str], money_columns: Optional[List[str]] = None) -> str:
    money_columns = money_columns or []
    if not rows:
        return "<p class='empty'>표시할 데이터가 없습니다.</p>"
    header = "".join(f"<th>{col}</th>" for col in columns)
    body = []
    for row in rows:
        cells = []
        for col in columns:
            value = row.get(col, "")
            if col in money_columns:
                value = money(value)
            cells.append(f"<td>{value}</td>")
        body.append(f"<tr>{''.join(cells)}</tr>")
    return f"<div class='table-wrap'><table><thead><tr>{header}</tr></thead><tbody>{''.join(body)}</tbody></table></div>"


def build_recommendations(summary: Dict[str, Any]) -> List[str]:
    recommendations = []
    if summary["expense_ratio"] >= 80:
        recommendations.append("수입 대비 지출 비중이 높습니다. 반복 결제와 고정비를 먼저 점검해 월 지출의 하한선을 낮추는 것이 좋습니다.")
    elif summary["expense_ratio"] >= 60:
        recommendations.append("지출 비중은 관리 가능한 범위지만, 상위 소비 카테고리의 월별 추이를 예산과 함께 추적하면 개선 여지가 큽니다.")
    else:
        recommendations.append("현금흐름은 안정적입니다. 남는 현금흐름을 비상금, 투자, 조기상환 재원으로 분리 관리해도 좋습니다.")

    if summary["fixed_ratio"] >= 50:
        recommendations.append("고정비 비중이 큽니다. 통신, 보험, 구독, 대출성 지출의 재계약 주기를 캘린더로 관리하는 기능이 유용합니다.")
    else:
        recommendations.append("변동비 관리 효과가 클 수 있습니다. 카테고리별 예산 초과 경고와 전월 대비 급증 알림을 추가해보세요.")

    if summary["total_assets"] > 0:
        recommendations.append("자산 데이터가 연결되어 있으므로 순자산 추이, 목표 비상금 달성률, 자산군 비중 리밸런싱 안내를 다음 기능으로 확장할 수 있습니다.")
    else:
        recommendations.append("자산 테이블이 비어 있습니다. 영범/재은 자산 업로드를 먼저 연결하면 가계 총 자산과 순자산 진단이 자동화됩니다.")
    return recommendations


@app.route("/")
def index() -> str:
    ledger, youngbeom, jaeeun, sync_info = load_data()
    all_assets = pd.concat([youngbeom, jaeeun], ignore_index=True) if not youngbeom.empty or not jaeeun.empty else pd.DataFrame()
    summary = summarize_finance(ledger, all_assets)

    ledger_rows = dataframe_records(ledger, 80)
    asset_rows = dataframe_records(all_assets.sort_values("amount", ascending=False) if not all_assets.empty else all_assets, 100)
    category_rows = summary["category_expense"]
    monthly_json = json.dumps(summary["monthly"], ensure_ascii=False, default=str)
    category_json = json.dumps(category_rows, ensure_ascii=False, default=str)
    asset_json = json.dumps(dataframe_records(all_assets, 300), ensure_ascii=False, default=str)
    recommendations = build_recommendations(summary)

    return render_template_string(
        TEMPLATE,
        sync_info=sync_info,
        summary=summary,
        ledger_table=render_rows(
            ledger_rows,
            ["date", "type", "category", "content", "amount_abs", "payment_method", "spender", "memo"],
            ["amount_abs"],
        ),
        category_table=render_rows(category_rows, ["category", "amount_abs"], ["amount_abs"]),
        asset_table=render_rows(asset_rows, ["owner", "name", "category", "amount", "source_sheet"], ["amount"]),
        monthly_json=monthly_json,
        category_json=category_json,
        asset_json=asset_json,
        recommendations=recommendations,
        gemini_enabled=bool(GEMINI_API_KEY),
        money=money,
        pct=pct,
    )


@app.post("/api/chat")
def chat() -> Any:
    if not GEMINI_API_KEY:
        return jsonify({"answer": "Vercel 환경변수 GEMINI_API_KEY가 설정되어 있지 않습니다."}), 400

    payload = request.get_json(silent=True) or {}
    question = str(payload.get("question", "")).strip()
    if not question:
        return jsonify({"answer": "질문을 입력해주세요."}), 400

    ledger, youngbeom, jaeeun, _sync_info = load_data()
    all_assets = pd.concat([youngbeom, jaeeun], ignore_index=True) if not youngbeom.empty or not jaeeun.empty else pd.DataFrame()
    summary = summarize_finance(ledger, all_assets)
    context = build_gemini_context(ledger, all_assets, summary)
    prompt = (
        "너는 한국어로 답하는 가계 재무 분석 어시스턴트다. "
        "아래 Supabase 최신 수입/지출/자산 데이터를 근거로, 과장 없이 구체적으로 답해라. "
        "금액은 원화 기준으로 표기하고, 필요한 경우 계산 근거를 짧게 덧붙여라.\n\n"
        f"질문: {question}\n\n"
        f"데이터 컨텍스트: {context}"
    )

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    return jsonify({"answer": getattr(response, "text", "") or "답변을 생성하지 못했습니다."})


@app.get("/api/status")
def status() -> Any:
    ledger, youngbeom, jaeeun, sync_info = load_data()
    all_assets = pd.concat([youngbeom, jaeeun], ignore_index=True) if not youngbeom.empty or not jaeeun.empty else pd.DataFrame()
    return jsonify({"sync": sync_info, "summary": summarize_finance(ledger, all_assets)})


TEMPLATE = """
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>우리집 통합 재정 대시보드</title>
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
  <style>
    :root {
      --bg: #f7f8fb;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #6b7280;
      --line: #dfe4ea;
      --blue: #2563eb;
      --green: #0f8f6f;
      --red: #d94d4d;
      --amber: #b7791f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, "Malgun Gothic", sans-serif;
      letter-spacing: 0;
    }
    .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }
    aside {
      border-right: 1px solid var(--line);
      background: #ffffff;
      padding: 24px 18px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
    }
    main { padding: 26px; min-width: 0; }
    h1 { font-size: 26px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 22px 0 12px; }
    h3 { font-size: 16px; margin: 18px 0 10px; }
    .caption, .muted { color: var(--muted); font-size: 13px; }
    .status-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      margin-top: 16px;
      background: #fbfcff;
    }
    .status-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #edf0f5; }
    .status-row:last-child { border-bottom: 0; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
    .tab-button {
      border: 0;
      border-bottom: 3px solid transparent;
      padding: 12px 10px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-weight: 700;
      font-size: 14px;
    }
    .tab-button.active { color: var(--blue); border-color: var(--blue); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 12px; }
    .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .metric .label { color: var(--muted); font-size: 13px; }
    .metric .value { font-size: 24px; font-weight: 800; margin-top: 8px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      margin-top: 16px;
    }
    .table-wrap { overflow: auto; max-height: 560px; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; background: white; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #edf0f5; text-align: left; white-space: nowrap; }
    th { background: #f1f4f8; position: sticky; top: 0; z-index: 1; }
    .empty { color: var(--muted); }
    .chat-box { display: grid; gap: 10px; }
    textarea { width: 100%; min-height: 92px; border: 1px solid var(--line); border-radius: 8px; padding: 12px; font-family: inherit; resize: vertical; }
    button.primary { width: fit-content; border: 0; background: var(--blue); color: white; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .answer { white-space: pre-wrap; background: #f7fafc; border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 52px; }
    .pill { display: inline-block; border-radius: 999px; padding: 3px 8px; font-size: 12px; background: #e8f1ff; color: #174ea6; }
    .warning { color: var(--amber); font-weight: 700; }
    .good { color: var(--green); font-weight: 700; }
    .sim-grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; align-items: end; }
    input { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      aside { position: static; height: auto; }
      main { padding: 18px; }
      .metrics, .grid-2, .sim-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <h1>우리집 통합 재정 대시보드</h1>
      <div class="caption">Supabase DB 자동 연동</div>
      <div class="status-card">
        <div class="status-row"><span>DB 연결</span><strong>{{ "정상" if sync_info.connected else "미설정" }}</strong></div>
        <div class="status-row"><span>최종 동기화</span><strong>{{ sync_info.loaded_at }}</strong></div>
        {% for table in sync_info.tables %}
          <div class="status-row"><span>{{ table.name }}</span><strong>{{ table.status }} · {{ "{:,}".format(table.count) }}건</strong></div>
        {% endfor %}
      </div>
      <p class="muted">엑셀 파일은 `upload_to_supabase.py`로 Supabase에 업로드하면 다음 접속부터 자동 반영됩니다.</p>
    </aside>
    <main>
      <div class="tabs">
        <button class="tab-button active" data-tab="overview">🏠 총괄 대시보드</button>
        <button class="tab-button" data-tab="ledger">💸 지출과 수입</button>
        <button class="tab-button" data-tab="analysis">📊 재무적 지출 분석</button>
        <button class="tab-button" data-tab="assets">📈 자산 및 부채</button>
        <button class="tab-button" data-tab="report">🧩 가계부 및 앱 개선 리포트</button>
      </div>

      <section id="overview" class="tab-panel active">
        <div class="metrics">
          <div class="metric"><div class="label">총 수입</div><div class="value">{{ money(summary.income) }}</div></div>
          <div class="metric"><div class="label">총 지출</div><div class="value">{{ money(summary.expense) }}</div></div>
          <div class="metric"><div class="label">순현금흐름</div><div class="value">{{ money(summary.cash_flow) }}</div></div>
          <div class="metric"><div class="label">가계 총 자산</div><div class="value">{{ money(summary.total_assets) }}</div></div>
        </div>
        <div class="grid-2">
          <div class="section"><h2>월별 수입/지출</h2><div id="monthlyChart"></div></div>
          <div class="section"><h2>상위 지출 카테고리</h2><div id="categoryChart"></div></div>
        </div>
        <div class="section">
          <h2>Gemini 데이터 분석 챗봇 <span class="pill">{{ "자동 연결됨" if gemini_enabled else "GEMINI_API_KEY 필요" }}</span></h2>
          <div class="chat-box">
            <textarea id="question" placeholder="예: 최근 지출에서 줄일 만한 항목을 알려줘"></textarea>
            <button class="primary" id="askButton">질문하기</button>
            <div class="answer" id="answer">질문하면 Supabase 최신 데이터 컨텍스트로 Gemini가 답변합니다.</div>
          </div>
        </div>
      </section>

      <section id="ledger" class="tab-panel">
        <h2>지출과 수입</h2>
        {{ ledger_table|safe }}
      </section>

      <section id="analysis" class="tab-panel">
        <div class="metrics">
          <div class="metric"><div class="label">수입 대비 지출</div><div class="value">{{ pct(summary.expense_ratio) }}</div></div>
          <div class="metric"><div class="label">고정비 비율</div><div class="value">{{ pct(summary.fixed_ratio) }}</div></div>
          <div class="metric"><div class="label">변동비 비율</div><div class="value">{{ pct(summary.variable_ratio) }}</div></div>
          <div class="metric"><div class="label">상위 카테고리 수</div><div class="value">{{ summary.category_expense|length }}개</div></div>
        </div>
        <div class="section"><h2>카테고리별 지출 상세</h2>{{ category_table|safe }}</div>
      </section>

      <section id="assets" class="tab-panel">
        <div class="metrics">
          <div class="metric"><div class="label">영범 자산</div><div class="value">{{ money(sync_info.assets_youngbeom_total) }}</div><div class="muted">{{ "{:,}".format(sync_info.assets_youngbeom_count) }}건</div></div>
          <div class="metric"><div class="label">재은 자산</div><div class="value">{{ money(sync_info.assets_jaeeun_total) }}</div><div class="muted">{{ "{:,}".format(sync_info.assets_jaeeun_count) }}건</div></div>
          <div class="metric"><div class="label">가계 총 자산</div><div class="value">{{ money(summary.total_assets) }}</div></div>
          <div class="metric"><div class="label">DB 상태</div><div class="value">{{ "정상" if sync_info.connected else "미설정" }}</div></div>
        </div>
        <div class="section"><h2>영범/재은 개별 자산 항목</h2>{{ asset_table|safe }}</div>
        <div class="section">
          <h2>주담대 원리금 균등상환 조기상환 시뮬레이터</h2>
          <div class="sim-grid">
            <label>대출 원금<input id="loanPrincipal" type="number" value="300000000"></label>
            <label>연 이자율(%)<input id="loanRate" type="number" step="0.01" value="4.2"></label>
            <label>잔여 기간(개월)<input id="loanMonths" type="number" value="360"></label>
            <label>조기상환액<input id="prepay" type="number" value="10000000"></label>
          </div>
          <p id="loanResult" class="answer"></p>
        </div>
      </section>

      <section id="report" class="tab-panel">
        <div class="section">
          <h2>재무 체질 개선 리포트</h2>
          <p>수입 대비 지출 비중은 <strong>{{ pct(summary.expense_ratio) }}</strong>, 고정비/변동비 비율은 <strong>{{ pct(summary.fixed_ratio) }} / {{ pct(summary.variable_ratio) }}</strong>입니다.</p>
          <p>현재 Supabase 자산 테이블 기준 가계 총 자산은 <strong>{{ money(summary.total_assets) }}</strong>입니다.</p>
          {% if summary.expense_ratio >= 80 %}
            <p class="warning">지출 구조가 빡빡합니다. 고정비를 먼저 낮춰야 현금흐름 개선 효과가 큽니다.</p>
          {% elif summary.expense_ratio >= 60 %}
            <p>전반적으로 관리 가능한 범위지만, 상위 카테고리 지출을 월별 예산과 비교하는 루틴이 필요합니다.</p>
          {% else %}
            <p class="good">현금흐름이 안정적인 편입니다. 남는 금액을 비상금과 투자 재원으로 자동 분리하면 좋습니다.</p>
          {% endif %}
        </div>
        <div class="section">
          <h2>앱 및 기능 개선 제안</h2>
          <ul>
            {% for item in recommendations %}
              <li>{{ item }}</li>
            {% endfor %}
          </ul>
        </div>
      </section>
    </main>
  </div>

  <script>
    const monthly = {{ monthly_json|safe }};
    const category = {{ category_json|safe }};
    const assets = {{ asset_json|safe }};

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach((el) => el.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((el) => el.classList.remove("active"));
        button.classList.add("active");
        document.getElementById(button.dataset.tab).classList.add("active");
      });
    });

    function drawCharts() {
      const months = [...new Set(monthly.map((row) => row.month))];
      const income = months.map((month) => {
        const row = monthly.find((item) => item.month === month && item.type === "수입");
        return row ? row.amount_abs : 0;
      });
      const expense = months.map((month) => {
        const row = monthly.find((item) => item.month === month && item.type === "지출");
        return row ? row.amount_abs : 0;
      });
      Plotly.newPlot("monthlyChart", [
        { x: months, y: income, type: "bar", name: "수입", marker: { color: "#0f8f6f" } },
        { x: months, y: expense, type: "bar", name: "지출", marker: { color: "#d94d4d" } }
      ], { margin: { t: 18, l: 52, r: 16, b: 42 }, barmode: "group" }, { responsive: true, displayModeBar: false });

      Plotly.newPlot("categoryChart", [{
        labels: category.map((row) => row.category),
        values: category.map((row) => row.amount_abs),
        type: "pie",
        hole: 0.55
      }], { margin: { t: 18, l: 16, r: 16, b: 16 } }, { responsive: true, displayModeBar: false });
    }

    async function askGemini() {
      const question = document.getElementById("question").value.trim();
      const answer = document.getElementById("answer");
      if (!question) {
        answer.textContent = "질문을 입력해주세요.";
        return;
      }
      answer.textContent = "Gemini가 최신 Supabase 데이터를 분석하고 있습니다.";
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      answer.textContent = data.answer || "답변을 생성하지 못했습니다.";
    }

    function updateLoanSimulator() {
      const principal = Number(document.getElementById("loanPrincipal").value || 0);
      const annualRate = Number(document.getElementById("loanRate").value || 0) / 100;
      const months = Number(document.getElementById("loanMonths").value || 0);
      const prepay = Number(document.getElementById("prepay").value || 0);
      const monthlyRate = annualRate / 12;
      const payment = monthlyRate === 0 ? principal / months : principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
      const afterPrincipal = Math.max(0, principal - prepay);
      const afterPayment = monthlyRate === 0 ? afterPrincipal / months : afterPrincipal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
      const beforeTotal = payment * months;
      const afterTotal = afterPayment * months + prepay;
      const saving = Math.max(0, beforeTotal - afterTotal);
      document.getElementById("loanResult").textContent =
        `현재 월 상환액 약 ${Math.round(payment).toLocaleString()}원, 조기상환 후 월 상환액 약 ${Math.round(afterPayment).toLocaleString()}원, 예상 이자 절감액 약 ${Math.round(saving).toLocaleString()}원입니다.`;
    }

    document.getElementById("askButton").addEventListener("click", askGemini);
    ["loanPrincipal", "loanRate", "loanMonths", "prepay"].forEach((id) => {
      document.getElementById(id).addEventListener("input", updateLoanSimulator);
    });
    drawCharts();
    updateLoanSimulator();
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8501")), debug=True)
