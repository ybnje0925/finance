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
            .replace("+", "")
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

        date_col = pick_column(raw.columns.tolist(), ["날짜", "일자", "거래일", "date"])
        content_col = pick_column(raw.columns.tolist(), ["내용", "적요", "거래내용", "content"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "출금", "입금", "지출금액", "결제금액", "amount"])
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


def detect_owner_from_name(file_name: str) -> Optional[str]:
    upper = file_name.upper()
    if "[YB]" in upper or upper.startswith("YB"):
        return "영범"
    if "[JE]" in upper or upper.startswith("JE"):
        return "재은"
    return None


def parse_assets(path: str, owner_hint: Optional[str] = None) -> pd.DataFrame:
    book = pd.ExcelFile(path)
    frames: List[pd.DataFrame] = []
    owner = owner_hint or detect_owner_from_name(os.path.basename(path))
    if not owner:
        raise ValueError(f"Cannot detect owner from file name: {os.path.basename(path)}")

    owner_tag = "YB" if owner == "영범" else "JE"

    for sheet_name in book.sheet_names:
        raw = pd.read_excel(book, sheet_name=sheet_name)
        if raw.empty:
            continue

        name_col = pick_column(raw.columns.tolist(), ["항목", "자산", "명칭", "name"])
        amount_col = pick_column(raw.columns.tolist(), ["금액", "잔액", "평가액", "amount", "balance", "value"])
        category_col = pick_column(raw.columns.tolist(), ["구분", "분류", "카테고리", "category"])

        if not name_col or not amount_col:
            continue

        parsed = pd.DataFrame(
            {
                "owner": owner,
                "name": raw[name_col].astype(str).apply(
                    lambda name: name if name.startswith(f"[{owner_tag}]") else f"[{owner_tag}] {name}"
                ),
                "category": raw[category_col].astype(str) if category_col else "기타자산",
                "amount": raw[amount_col].apply(normalize_amount),
                "source_sheet": sheet_name,
                "source_file": os.path.basename(path),
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        frames.append(parsed)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


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
    parser.add_argument("--assets", nargs="*", help="[JE]/[YB] 자산 파일 경로 1~2개")
    parser.add_argument("--assets-je", dest="assets_je", help="[JE] 자산 파일 경로")
    parser.add_argument("--assets-yb", dest="assets_yb", help="[YB] 자산 파일 경로")
    args = parser.parse_args()

    if not args.ledger and not args.assets and not args.assets_je and not args.assets_yb:
        parser.error("--ledger 또는 --assets / --assets-je / --assets-yb 중 하나 이상을 지정하세요.")

    if args.ledger:
        ledger = parse_ledger(args.ledger)
        count = replace_table(INCOME_EXPENSES_TABLE, ledger)
        print(f"{INCOME_EXPENSES_TABLE}: {count:,} rows uploaded")

    asset_inputs: List[Tuple[str, str]] = []
    if args.assets:
        for file_path in args.assets:
            owner = detect_owner_from_name(os.path.basename(file_path))
            if owner:
                asset_inputs.append((owner, file_path))
    if args.assets_je:
        asset_inputs.append(("재은", args.assets_je))
    if args.assets_yb:
        asset_inputs.append(("영범", args.assets_yb))

    if asset_inputs:
        youngbeom_frames: List[pd.DataFrame] = []
        jaeeun_frames: List[pd.DataFrame] = []
        for owner, file_path in asset_inputs:
            parsed = parse_assets(file_path, owner_hint=owner)
            if owner == "영범":
                youngbeom_frames.append(parsed)
            else:
                jaeeun_frames.append(parsed)

        youngbeom = pd.concat(youngbeom_frames, ignore_index=True) if youngbeom_frames else pd.DataFrame()
        jaeeun = pd.concat(jaeeun_frames, ignore_index=True) if jaeeun_frames else pd.DataFrame()
        youngbeom_count = replace_table(ASSETS_YOUNGBEOM_TABLE, youngbeom)
        jaeeun_count = replace_table(ASSETS_JAEEUN_TABLE, jaeeun)
        print(f"{ASSETS_YOUNGBEOM_TABLE}: {youngbeom_count:,} rows uploaded")
        print(f"{ASSETS_JAEEUN_TABLE}: {jaeeun_count:,} rows uploaded")


if __name__ == "__main__":
    main()
