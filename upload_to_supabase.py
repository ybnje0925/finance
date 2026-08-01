import argparse
import os
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")


def normalize_amount(value: Any) -> int:
    if pd.isna(value):
        return 0
    if isinstance(value, str):
        cleaned = value.replace(",", "").replace("원", "").replace("₩", "").replace(" ", "")
        if cleaned in ("", "-", "+"):
            return 0
        return int(round(float(cleaned)))
    return int(round(float(value)))


def pick_column(columns: List[str], candidates: List[str]) -> Optional[str]:
    for keyword in candidates:
        for col in columns:
            if keyword in str(col):
                return col
    return None


def parse_ledger(path: str) -> pd.DataFrame:
    book = pd.ExcelFile(path)
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
        ).dropna(subset=["date"])
        parsed["type"] = "지출"
        parsed.loc[parsed["amount"] > 0, "type"] = "수입"
        parsed.loc[parsed["amount"] < 0, "type"] = "지출"
        parsed["amount_abs"] = parsed["amount"].abs()
        rows.append(parsed)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def parse_assets(path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    book = pd.ExcelFile(path)
    output: Dict[str, List[pd.DataFrame]] = {"영범": [], "재은": []}
    for sheet_name in book.sheet_names:
        owner = "영범" if "영범" in sheet_name else "재은" if "재은" in sheet_name else ""
        if not owner:
            continue
        raw = pd.read_excel(book, sheet_name=sheet_name)
        if raw.empty:
            continue
        name_col = pick_column(raw.columns.tolist(), ["계좌", "상품", "종목", "자산", "이름", "명"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "잔액", "평가", "현재가", "자산"])
        category_col = pick_column(raw.columns.tolist(), ["구분", "분류", "유형", "카테고리"])
        if not name_col or not amount_col:
            continue
        output[owner].append(
            pd.DataFrame(
                {
                    "owner": owner,
                    "name": raw[name_col].astype(str).apply(lambda name: f"[{owner}] {name}"),
                    "category": raw[category_col].astype(str) if category_col else "금융자산",
                    "amount": raw[amount_col].apply(normalize_amount),
                    "source_sheet": sheet_name,
                }
            )
        )
    youngbeom = pd.concat(output["영범"], ignore_index=True) if output["영범"] else pd.DataFrame()
    jaeeun = pd.concat(output["재은"], ignore_index=True) if output["재은"] else pd.DataFrame()
    return youngbeom, jaeeun


def replace_table(table: str, df: pd.DataFrame) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY are required.")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    client.table(table).delete().neq("id", 0).execute()
    if df.empty:
        return
    records = df.where(pd.notna(df), None).to_dict(orient="records")
    for start in range(0, len(records), 500):
        client.table(table).insert(records[start : start + 500]).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload household finance Excel files to Supabase.")
    parser.add_argument("--ledger", help="수입/지출 엑셀 파일 경로")
    parser.add_argument("--assets", help="자산 엑셀 파일 경로")
    args = parser.parse_args()

    if args.ledger:
        ledger = parse_ledger(args.ledger)
        replace_table("income_expenses", ledger)
        print(f"income_expenses uploaded: {len(ledger):,} rows")

    if args.assets:
        youngbeom, jaeeun = parse_assets(args.assets)
        replace_table("assets_youngbeom", youngbeom)
        replace_table("assets_jaeeun", jaeeun)
        print(f"assets_youngbeom uploaded: {len(youngbeom):,} rows")
        print(f"assets_jaeeun uploaded: {len(jaeeun):,} rows")


if __name__ == "__main__":
    main()
