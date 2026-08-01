import argparse
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or ""

INCOME_EXPENSES_TABLE = "income_expenses"
ASSETS_YOUNGBEOM_TABLE = "assets_youngbeom"
ASSETS_JAEEUN_TABLE = "assets_jaeeun"


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
        return int(round(float(cleaned)))
    return int(round(float(value)))


def pick_column(columns: List[str], candidates: List[str]) -> Optional[str]:
    normalized = [(str(column).strip().lower(), column) for column in columns]
    for keyword in candidates:
        key = keyword.lower()
        for normalized_name, original in normalized:
            if key in normalized_name:
                return original
    return None


def parse_ledger(path: str) -> pd.DataFrame:
    book = pd.ExcelFile(path)
    frames: List[pd.DataFrame] = []
    for sheet_name in book.sheet_names:
        raw = pd.read_excel(book, sheet_name=sheet_name)
        if raw.empty:
            continue

        date_col = pick_column(raw.columns.tolist(), ["날짜", "일자", "거래일", "사용일", "date"])
        content_col = pick_column(raw.columns.tolist(), ["내용", "적요", "거래내용", "가맹점", "사용처", "content"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "출금", "입금", "사용금액", "결제금액", "amount"])
        category_col = pick_column(raw.columns.tolist(), ["카테고리", "분류", "항목", "category"])
        method_col = pick_column(raw.columns.tolist(), ["결제수단", "카드", "계좌", "수단", "method"])
        memo_col = pick_column(raw.columns.tolist(), ["메모", "비고", "memo", "note"])

        if not date_col or not amount_col:
            continue

        parsed = pd.DataFrame(
            {
                "date": pd.to_datetime(raw[date_col], errors="coerce").dt.date.astype(str),
                "content": raw[content_col].astype(str) if content_col else "",
                "amount": raw[amount_col].apply(normalize_amount),
                "category": raw[category_col].astype(str) if category_col else "미분류",
                "payment_method": raw[method_col].astype(str) if method_col else "",
                "spender": sheet_name.strip(),
                "memo": raw[memo_col].astype(str) if memo_col else "",
                "source_file": os.path.basename(path),
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
        ).dropna(subset=["date"])

        parsed["type"] = "지출"
        parsed.loc[parsed["amount"] > 0, "type"] = "수입"
        parsed.loc[parsed["amount"] < 0, "type"] = "지출"
        parsed["amount_abs"] = parsed["amount"].abs()
        frames.append(parsed)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def detect_owner(sheet_name: str) -> Optional[str]:
    compact = sheet_name.replace(" ", "")
    if "영범" in compact or "youngbeom" in compact.lower():
        return "영범"
    if "재은" in compact or "jaeeun" in compact.lower():
        return "재은"
    return None


def parse_assets(path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    book = pd.ExcelFile(path)
    output: Dict[str, List[pd.DataFrame]] = {"영범": [], "재은": []}
    for sheet_name in book.sheet_names:
        owner = detect_owner(sheet_name)
        if not owner:
            continue

        raw = pd.read_excel(book, sheet_name=sheet_name)
        if raw.empty:
            continue

        name_col = pick_column(raw.columns.tolist(), ["계좌", "상품", "종목", "자산", "이름", "명칭", "name"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "잔액", "평가", "현재가", "자산", "amount"])
        category_col = pick_column(raw.columns.tolist(), ["구분", "분류", "유형", "카테고리", "category"])

        if not name_col or not amount_col:
            continue

        parsed = pd.DataFrame(
            {
                "owner": owner,
                "name": raw[name_col].astype(str).apply(
                    lambda name: name if name.startswith(f"[{owner}]") else f"[{owner}] {name}"
                ),
                "category": raw[category_col].astype(str) if category_col else "금융자산",
                "amount": raw[amount_col].apply(normalize_amount),
                "source_sheet": sheet_name,
                "source_file": os.path.basename(path),
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        output[owner].append(parsed)

    youngbeom = pd.concat(output["영범"], ignore_index=True) if output["영범"] else pd.DataFrame()
    jaeeun = pd.concat(output["재은"], ignore_index=True) if output["재은"] else pd.DataFrame()
    return youngbeom, jaeeun


def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY are required.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def replace_table(table: str, df: pd.DataFrame) -> int:
    client = get_client()
    client.table(table).delete().neq("id", 0).execute()
    if df.empty:
        return 0

    records = df.where(pd.notna(df), None).to_dict(orient="records")
    for start in range(0, len(records), 500):
        client.table(table).insert(records[start : start + 500]).execute()
    return len(records)


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload household finance Excel files to Supabase.")
    parser.add_argument("--ledger", help="수입/지출 엑셀 파일 경로")
    parser.add_argument("--assets", help="영범/재은 자산 엑셀 파일 경로")
    args = parser.parse_args()

    if not args.ledger and not args.assets:
        parser.error("--ledger 또는 --assets 중 하나 이상을 지정하세요.")

    if args.ledger:
        ledger = parse_ledger(args.ledger)
        count = replace_table(INCOME_EXPENSES_TABLE, ledger)
        print(f"{INCOME_EXPENSES_TABLE}: {count:,} rows uploaded")

    if args.assets:
        youngbeom, jaeeun = parse_assets(args.assets)
        youngbeom_count = replace_table(ASSETS_YOUNGBEOM_TABLE, youngbeom)
        jaeeun_count = replace_table(ASSETS_JAEEUN_TABLE, jaeeun)
        print(f"{ASSETS_YOUNGBEOM_TABLE}: {youngbeom_count:,} rows uploaded")
        print(f"{ASSETS_JAEEUN_TABLE}: {jaeeun_count:,} rows uploaded")


if __name__ == "__main__":
    main()
