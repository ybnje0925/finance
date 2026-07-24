import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date

# ------------------------------------------------------------------
# 0. PAGE CONFIG & STYLING
# ------------------------------------------------------------------
st.set_page_config(
    page_title="우리집 통합 재정 대시보드",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (CSS)
st.markdown("""
<style>
    .reportview-container {
        background: #F8F9FA;
    }
    .metric-card {
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        border: 1px solid #E9ECEF;
    }
    .warning-card {
        background-color: #FFF5F5;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #FEB2B2;
        color: #C53030;
    }
    .highlight-text {
        font-weight: bold;
        color: #2B6CB0;
    }
</style>
""", unsafe_allow_html=True)

# ------------------------------------------------------------------
# Excel Parsing Engines
# ------------------------------------------------------------------
def parse_asset_data(df: pd.DataFrame):
    # Locate credit score
    credit_score = None
    for r in range(df.shape[0]):
        for c in range(df.shape[1]):
            val = str(df.iloc[r, c])
            if any(k in val for k in ["신용", "KCB", "최영범"]):
                import re
                numbers = re.findall(r'\d+', val)
                for n in numbers:
                    if 300 <= int(n) <= 1000:
                        credit_score = int(n)
                        break
                if credit_score is None:
                    for offset in [1, 2, 3]:
                        if c + offset < df.shape[1]:
                            next_val = str(df.iloc[r, c+offset])
                            next_numbers = re.findall(r'\d+', next_val)
                            for n in next_numbers:
                                if 300 <= int(n) <= 1000:
                                    credit_score = int(n)
                                    break
                        if r + offset < df.shape[0]:
                            next_val = str(df.iloc[r+offset, c])
                            next_numbers = re.findall(r'\d+', next_val)
                            for n in next_numbers:
                                if 300 <= int(n) <= 1000:
                                    credit_score = int(n)
                                    break
                        if credit_score is not None:
                            break
            if credit_score is not None:
                break
        if credit_score is not None:
            break
            
    if credit_score:
        st.session_state.husband_credit = credit_score

    new_free = {}
    new_savings = {}
    new_electronic = {}
    new_investment = {}
    new_investment_details = {}
    
    for idx, row in df.iterrows():
        # Convert all cells to strings and check
        row_str = " ".join(row.astype(str).values).lower()
        
        # Check for mortgage or NH주택담보대출 row
        if any(k in row_str for k in ["주택담보대출", "주담대", "nh주택담보대출"]):
            num_cells = []
            for val in row:
                if isinstance(val, (int, float)) and not isinstance(val, bool) and not pd.isna(val):
                    num_cells.append(val)
            amounts = [x for x in num_cells if x > 10000000]
            rates = [x for x in num_cells if 1.0 <= x <= 10.0]
            if amounts:
                st.session_state.liability_mortgage["금액"] = int(amounts[0])
            if rates:
                st.session_state.liability_mortgage["금리"] = float(rates[0])
                
            import re
            dates_found = re.findall(r'\d{4}[-./]\d{1,2}[-./]\d{1,2}', row_str)
            if dates_found:
                parsed_dates = []
                for d_str in dates_found:
                    clean_d = d_str.replace(".", "-").replace("/", "-")
                    try:
                        dt = datetime.strptime(clean_d, "%Y-%m-%d").date()
                        parsed_dates.append(dt)
                    except:
                        pass
                if len(parsed_dates) >= 1:
                    st.session_state.liability_mortgage["대출일"] = parsed_dates[0]
                if len(parsed_dates) >= 2:
                    st.session_state.liability_mortgage["만기일"] = parsed_dates[1]
            continue

        # Check for stock details rows
        is_stock_row = False
        stock_name = None
        for val in row:
            if isinstance(val, str) and any(k in val.upper() for k in ["TIGER", "KODEX", "S&P", "차이나", "100세연금", "CMA", "종합위탁", "중개형ISA"]):
                is_stock_row = True
                stock_name = val.strip()
                break
                
        if is_stock_row and stock_name:
            num_cells = []
            for val in row:
                if isinstance(val, (int, float)) and not isinstance(val, bool) and not pd.isna(val):
                    num_cells.append(val)
                    
            principal = None
            appraised = None
            yield_rate = None
            
            large_nums = [x for x in num_cells if x > 100]
            small_nums = [x for x in num_cells if -100 <= x <= 150]
            
            if len(large_nums) >= 2:
                principal = int(large_nums[0])
                appraised = int(large_nums[1])
            elif len(large_nums) == 1:
                principal = int(large_nums[0])
                appraised = int(large_nums[0])
                
            if small_nums:
                yield_rate = float(small_nums[-1])
            else:
                for val in row:
                    if isinstance(val, str) and "%" in val:
                        import re
                        match = re.findall(r'-?\d+\.\d+|-?\d+', val)
                        if match:
                            yield_rate = float(match[0])
                            break
                if yield_rate is None and principal and appraised and principal > 0:
                    yield_rate = round(((appraised - principal) / principal) * 100, 2)
                    
            if appraised is not None:
                clean_name = stock_name.replace(" (평가금액)", "").replace(" (평가액)", "")
                new_investment[f"{clean_name} (평가금액)"] = appraised
                new_investment_details[clean_name] = {
                    "원금": principal if principal is not None else appraised,
                    "평가액": appraised,
                    "수익률": yield_rate if yield_rate is not None else 0.0
                }
            continue
            
        str_cells = []
        num_cells = []
        for col_idx, cell in enumerate(row):
            if pd.isna(cell):
                continue
            if isinstance(cell, (int, float)) and not isinstance(cell, bool):
                num_cells.append(cell)
            else:
                cell_str = str(cell).strip()
                if cell_str:
                    str_cells.append(cell_str)
                    
        if len(str_cells) >= 1 and len(num_cells) >= 1:
            name = str_cells[-1]
            if len(str_cells) >= 2:
                name = str_cells[1]
                
            amount = int(abs(num_cells[0]))
            
            if any(h in name for h in ["고객정보", "재무현황", "투자현황", "대출현황", "계좌명", "자산명", "금액", "잔액", "평가금액", "구분", "비율", "합계", "소계", "총합", "수익률", "소유자", "총계", "부채", "대출", "보험", "보험금"]):
                continue
            if any(h in str_cells[0] for h in ["고객정보", "재무현황", "투자현황", "대출현황", "계좌명", "자산명", "금액", "잔액", "평가금액", "구분", "비율", "합계", "소계", "총합", "수익률", "소유자", "총계", "부채", "대출", "보험", "보험금"]):
                continue
            if name.startswith(("1.", "2.", "3.", "4.", "5.", "6.")):
                continue
                
            name_lower = name.lower()
            
            if any(k in name_lower for k in ["주택담보대출", "주담대", "nh주택담보대출", "mortgage", "대출금", "대출", "보험", "보험금", "보장성", "총계", "소계", "부채", "합계"]):
                continue
                
            if any(k in name_lower for k in ["페이", "머니", "pay", "카카오", "토스"]):
                new_free[name] = amount
            elif any(k in name_lower for k in ["적금", "청약", "예금"]) and "저축예금" not in name_lower and "입출금" not in name_lower:
                new_free[name] = amount
            elif any(k in name_lower for k in ["주식", "s&p", "차이나", "투자", "펀드", "cma", "증권", "위탁", "tiger", "kodex", "평가액", "평가금액"]):
                clean_name = name.replace(" (평가금액)", "").replace(" (평가액)", "")
                new_investment[f"{clean_name} (평가금액)"] = amount
                if clean_name not in new_investment_details:
                    new_investment_details[clean_name] = {
                        "원금": amount,
                        "평가액": amount,
                        "수익률": 0.0
                    }
            else:
                new_free[name] = amount
                
    if new_free:
        st.session_state.asset_free = new_free
        st.session_state.asset_savings = {}
        st.session_state.asset_electronic = {}
    if new_investment:
        st.session_state.asset_investment = new_investment
    if new_investment_details:
        st.session_state.investment_details = new_investment_details
        
    for idx, row in df.iterrows():
        row_str = " ".join(row.astype(str).values).lower()
        if any(k in row_str for k in ["대출일", "신규일", "신규일자", "만기", "만기일", "만기일자"]):
            import re
            dates_found = re.findall(r'\d{4}[-./]\d{1,2}[-./]\d{1,2}', row_str)
            if dates_found:
                parsed_dates = []
                for d_str in dates_found:
                    clean_d = d_str.replace(".", "-").replace("/", "-")
                    try:
                        dt = datetime.strptime(clean_d, "%Y-%m-%d").date()
                        parsed_dates.append(dt)
                    except:
                        pass
                if len(parsed_dates) >= 1:
                    st.session_state.liability_mortgage["대출일"] = parsed_dates[0]
                if len(parsed_dates) >= 2:
                    st.session_state.liability_mortgage["만기일"] = parsed_dates[1]

def parse_ledger_data(df: pd.DataFrame):
    header_row_idx = 0
    max_matches = 0
    
    for idx in range(min(10, len(df))):
        row_vals = [str(x).lower().strip() for x in df.iloc[idx].values]
        matches = sum(1 for v in row_vals if any(k in v for k in ["날짜", "일시", "구분", "타입", "대분류", "소분류", "내용", "상세", "금액", "원"]))
        if matches > max_matches:
            max_matches = matches
            header_row_idx = idx
            
    if max_matches >= 2:
        df.columns = df.iloc[header_row_idx]
        df = df.iloc[header_row_idx + 1:].reset_index(drop=True)
        
    df = df.drop_duplicates()
        
    col_mapping = {}
    for col in df.columns:
        if pd.isna(col):
            continue
        col_str = str(col).lower().replace(" ", "").replace("_", "")
        if any(k in col_str for k in ["날짜", "일시", "date", "time"]):
            col_mapping["날짜"] = col
        elif any(k in col_str for k in ["타입", "type", "구분", "수입지출", "수입/지출"]):
            col_mapping["구분"] = col
        elif any(k in col_str for k in ["대분류", "소분류", "카테고리", "분류", "category"]):
            col_mapping["대분류"] = col
        elif any(k in col_str for k in ["내용", "상세", "적요", "상세내역", "content", "description"]):
            col_mapping["내용"] = col
        elif any(k in col_str for k in ["금액", "원", "amount", "price", "수하금액"]):
            col_mapping["금액"] = col
            
    parsed_items = []
    start_id = 1
    
    for idx, row in df.iterrows():
        date_val = row[col_mapping["날짜"]] if "날짜" in col_mapping else None
        type_val = row[col_mapping["구분"]] if "구분" in col_mapping else None
        category_val = row[col_mapping["대분류"]] if "대분류" in col_mapping else None
        content_val = row[col_mapping["내용"]] if "내용" in col_mapping else None
        amount_val = row[col_mapping["금액"]] if "금액" in col_mapping else None
        
        original_amount = 0
        if pd.isna(amount_val):
            continue
        try:
            if isinstance(amount_val, (int, float)):
                original_amount = amount_val
            else:
                original_amount = float(str(amount_val).replace(",", "").replace("원", "").replace(" ", "").strip())
        except:
            continue
            
        amount = int(abs(original_amount))
        if amount == 0:
            continue
            
        gubuun = "지출"
        if not pd.isna(type_val):
            t_str = str(type_val).strip()
            if any(k in t_str for k in ["수입", "급여", "배당", "income", "deposit"]):
                gubuun = "수입"
            elif any(k in t_str for k in ["이체", "내계좌", "대체", "transfer"]):
                continue

        # "구분이 지출이더라도, 금액이 양수라면 수입으로 잡아주도록 해줘."
        if gubuun == "지출" and original_amount > 0:
            gubuun = "수입"
                
        month_str = "2026-07"
        if not pd.isna(date_val):
            try:
                if isinstance(date_val, (datetime, date)):
                    month_str = date_val.strftime("%Y-%m")
                elif isinstance(date_val, (int, float)):
                    date_obj = pd.to_datetime(date_val, unit='D', origin='1899-12-30')
                    month_str = date_obj.strftime("%Y-%m")
                else:
                    date_str = str(date_val).strip()
                    import re
                    match = re.search(r'(\d{4})[-./](\d{1,2})', date_str)
                    if match:
                        month_str = f"{match.group(1)}-{match.group(2).zfill(2)}"
            except Exception as e:
                pass
                
        category = str(category_val).strip() if not pd.isna(category_val) else ("기타" if gubuun == "지출" else "기타수입")
        content = str(content_val).strip() if not pd.isna(content_val) else f"{category} 내역"
        
        parsed_items.append({
            "id": start_id + len(parsed_items),
            "월": month_str,
            "구분": gubuun,
            "대분류": category,
            "내용": content,
            "금액": amount,
            "활성화": True
        })
        
    if parsed_items:
        st.session_state.ledger = parsed_items

def parse_only_ledger(file):
    try:
        xls = pd.ExcelFile(file)
        sheet_names = xls.sheet_names
        ledger_sheet = "가계부 내역" if "가계부 내역" in sheet_names else (sheet_names[1] if len(sheet_names) > 1 else sheet_names[0])
        df_ledger = pd.read_excel(xls, sheet_name=ledger_sheet)
        rename_map = {
            '타입': '구분', 'Type': '구분', '수입지출': '구분',
            '대분류': '카테고리', '분류': '카테고리', 'Category': '카테고리',
            '내용': '내용', '거래처': '내용', '상세': '내용',
            '금액': '금액', '원': '금액',
            '날짜': '날짜', '일시': '날짜'
        }
        df_ledger = df_ledger.rename(columns=rename_map)
        parse_ledger_data(df_ledger)
        return True
    except Exception as e:
        st.error(f"수입/지출 내역 엑셀 파일 처리 중 예외 발생: {e}")
        return False

def parse_only_assets(file):
    try:
        xls = pd.ExcelFile(file)
        sheet_names = xls.sheet_names
        asset_sheet = "뱅샐현황" if "뱅샐현황" in sheet_names else sheet_names[0]
        df_asset = pd.read_excel(xls, sheet_name=asset_sheet, header=None)
        parse_asset_data(df_asset)
        return True
    except Exception as e:
        st.error(f"자산/부채 현황 엑셀 파일 처리 중 예외 발생: {e}")
        return False

@st.cache_data
def load_financial_data(file):
    xls = pd.ExcelFile(file)
    sheet_names = xls.sheet_names
    
    # 1번 시트 (자산 현황): '뱅샐현황' 또는 Index 0
    asset_sheet = "뱅샐현황" if "뱅샐현황" in sheet_names else sheet_names[0]
    df_asset = pd.read_excel(xls, sheet_name=asset_sheet, header=None)
    
    # 2번 시트 (지출/수입 내역): '가계부 내역' 또는 Index 1
    ledger_sheet = "가계부 내역" if "가계부 내역" in sheet_names else (sheet_names[1] if len(sheet_names) > 1 else sheet_names[0])
    df_ledger = pd.read_excel(xls, sheet_name=ledger_sheet)
    
    # 컬럼명 유연 변환 (자동 매핑)
    rename_map = {
        '타입': '구분', 'Type': '구분', '수입지출': '구분',
        '대분류': '카테고리', '분류': '카테고리', 'Category': '카테고리',
        '내용': '내용', '거래처': '내용', '상세': '내용',
        '금액': '금액', '원': '금액',
        '날짜': '날짜', '일시': '날짜'
    }
    df_ledger = df_ledger.rename(columns=rename_map)
    return df_asset, df_ledger

def identify_and_parse_excel(file):
    try:
        df_asset, df_ledger = load_financial_data(file)
        parse_asset_data(df_asset)
        parse_ledger_data(df_ledger)
        return True
    except Exception as e:
        st.error(f"엑셀 파일 처리 중 예외 발생: {e}")
        return False

# ------------------------------------------------------------------
# 1. CORE DATA PREPARATION (SESSION STATE INIT)
# ------------------------------------------------------------------

# 1.1 기본 정보
HUSBAND_NAME = "최영범 (1992년생)"
HUSBAND_CREDIT = 969
WIFE_NAME = "강재은 (1989년생)"
MOVE_IN_DATE = date(2026, 7, 6)

# 1.2 자산 및 부채 고정 데이터
ASSET_FREE = {
    "KB Star*t통장-저축예금": 3931685,
    "KB Wise통장-저축예금": 13090630,
    "KB국민ONE통장-저축예금": 41,
    "MY 입출금통장": 2,
    "NH주거래우대통장": 3269297,
    "U드림 저축예금": 1107,
    "WON 통장": 126,
    "기타 입출금통장 1": 6449648,
    "기타 입출금통장 2": 7000,
    "저금통": 41506,
    "NH올원e적금": 100000,
    "카카오페이 머니": 12000
}

ASSET_SAVINGS = {}

ASSET_ELECTRONIC = {}

ASSET_INVESTMENT = {
    "TIGER 미국S&P500 (평가금액)": 1919980,
    "KODEX 차이나테크TOP10 (평가금액)": 1726080,
    "100세연금저축펀드": 20105,
    "CMA계좌": 446955,
    "종합위탁계좌": 693121
}

# 투자원금 및 상세
INVESTMENT_DETAILS = {
    "TIGER 미국S&P500": {"원금": 1277189, "평가액": 1919980, "수익률": 50.33},
    "KODEX 차이나테크TOP10": {"원금": 1737959, "평가액": 1726080, "수익률": -0.68}
}

LIABILITY_MORTGAGE = {
    "명칭": "NH주택담보대출 (주택자금)",
    "금액": 600000000,
    "금리": 4.08,
    "대출일": date(2026, 6, 19),
    "만기일": date(2056, 5, 23)
}

# 세션 상태 초기화 (동적 데이터 바인딩 지원)
if 'uploaded_ledger_filename' not in st.session_state:
    st.session_state.uploaded_ledger_filename = None

if 'uploaded_assets_filename' not in st.session_state:
    st.session_state.uploaded_assets_filename = None

if 'husband_credit' not in st.session_state:
    st.session_state.husband_credit = HUSBAND_CREDIT

if 'asset_free' not in st.session_state:
    st.session_state.asset_free = ASSET_FREE.copy()

if 'asset_savings' not in st.session_state:
    st.session_state.asset_savings = ASSET_SAVINGS.copy()

if 'asset_electronic' not in st.session_state:
    st.session_state.asset_electronic = ASSET_ELECTRONIC.copy()

if 'asset_investment' not in st.session_state:
    st.session_state.asset_investment = ASSET_INVESTMENT.copy()

if 'investment_details' not in st.session_state:
    st.session_state.investment_details = INVESTMENT_DETAILS.copy()

if 'liability_mortgage' not in st.session_state:
    st.session_state.liability_mortgage = LIABILITY_MORTGAGE.copy()

# 1.3 수입/지출 원장 내역 세션 상태 초기화
if 'ledger' not in st.session_state:
    # 기본 내역 제공 (6월, 7월, 8월 데이터)
    st.session_state.ledger = [
        # 6월 내역
        {"id": 1, "월": "2026-06", "구분": "수입", "대분류": "급여", "내용": "최영범 급여", "금액": 4500000, "활성화": True},
        {"id": 2, "월": "2026-06", "구분": "수입", "대분류": "급여", "내용": "강재은 급여", "금액": 3800000, "활성화": True},
        {"id": 3, "월": "2026-06", "구분": "수입", "대분류": "투자/배당", "내용": "SCHD 배당금", "금액": 45000, "활성화": True},
        {"id": 4, "월": "2026-06", "구분": "지출", "대분류": "주거/대출", "내용": "NH주담대 이자 (일할)", "금액": 816000, "활성화": True},
        {"id": 5, "월": "2026-06", "구분": "지출", "대분류": "식비", "내용": "이마트 장보기", "금액": 320000, "활성화": True},
        {"id": 6, "월": "2026-06", "구분": "지출", "대분류": "기타", "내용": "생활 소모품 구매", "금액": 150000, "활성화": True},
        # 7월 내역
        {"id": 7, "월": "2026-07", "구분": "수입", "대분류": "급여", "내용": "최영범 급여", "금액": 4500000, "활성화": True},
        {"id": 8, "월": "2026-07", "구분": "수입", "대분류": "급여", "내용": "강재은 급여", "금액": 3800000, "활성화": True},
        {"id": 9, "월": "2026-07", "구분": "수입", "대분류": "투자/배당", "내용": "JEPQ 배당금", "금액": 32000, "활성화": True},
        {"id": 10, "월": "2026-07", "구분": "지출", "대분류": "주거/대출", "내용": "NH주담대 이자 (첫 정기)", "금액": 2040000, "활성화": True},
        {"id": 11, "월": "2026-07", "구분": "지출", "대분류": "양육/기타", "내용": "육아도우미 어머니 감사수당", "금액": 1200000, "활성화": True},
        {"id": 12, "월": "2026-07", "구분": "지출", "대분류": "식비", "내용": "하남 감이동 이사 턱 외식", "금액": 250000, "활성화": True},
        {"id": 13, "월": "2026-07", "구분": "지출", "대분류": "공과금/관리비", "내용": "아파트 첫 관리비", "금액": 220000, "활성화": True},
        {"id": 14, "월": "2026-07", "구분": "지출", "대분류": "식비", "내용": "새 아파트 집들이 장보기", "금액": 350000, "활성화": True},
        # 8월 가상 내역
        {"id": 15, "월": "2026-08", "구분": "수입", "대분류": "급여", "내용": "최영범 급여", "금액": 4500000, "활성화": True},
        {"id": 16, "월": "2026-08", "구분": "수입", "대분류": "급여", "내용": "강재은 급여", "금액": 3800000, "활성화": True},
        {"id": 17, "월": "2026-08", "구분": "지출", "대분류": "주거/대출", "내용": "NH주담대 이자", "금액": 2040000, "활성화": True},
        {"id": 18, "월": "2026-08", "구분": "지출", "대분류": "양육/기타", "내용": "육아도우미 감사수당", "금액": 1200000, "활성화": True},
        {"id": 19, "월": "2026-08", "구분": "지출", "대분류": "식비", "내용": "이마트 및 외식", "금액": 600000, "활성화": True}
    ]

if 'checklist' not in st.session_state:
    st.session_state.checklist = {
        "주택담보대출 이자 및 관리비 자동이체 확인": False,
        "어머니 육아 도우미 감사 수당 이체 확인": False,
        "배당금 분배금(SCHD/JEPQ) 재투자 계좌 이체": False
    }

# 1.4 월별 조회 타겟 초기화 및 재무 분석 계산기 함수 정의
available_months = sorted(list(set([item["월"] for item in st.session_state.ledger])))
if 'selected_month' not in st.session_state or st.session_state.selected_month not in available_months:
    st.session_state.selected_month = available_months[-1] if available_months else "2026-07"

def calculate_monthly_briefing(month_str):
    items = [item for item in st.session_state.ledger if item["월"] == month_str and item["활성화"]]
    
    incomes = [item for item in items if item["구분"] == "수입"]
    expenses = [item for item in items if item["구분"] == "지출"]
    
    total_income = sum([item["금액"] for item in incomes])
    total_expense = sum([item["금액"] for item in expenses])
    
    fixed_sum = 0
    variable_sum = 0
    category_totals = {}
    
    fixed_keywords = ["보험", "통신", "관리비", "주거", "공과금", "세금", "구독", "교육", "대출", "월세", "서비스", "렌탈", "유치원", "어린이집", "학원", "이자", "관리"]
    
    for item in expenses:
        cat = item["대분류"]
        amt = item["금액"]
        category_totals[cat] = category_totals.get(cat, 0) + amt
        
        cat_lower = cat.lower()
        if any(k in cat_lower for k in fixed_keywords):
            fixed_sum += amt
        else:
            variable_sum += amt
            
    fixed_ratio = (fixed_sum / total_expense * 100) if total_expense > 0 else 0
    variable_ratio = (variable_sum / total_expense * 100) if total_expense > 0 else 0
    
    food_sum = 0
    insurance_sum = 0
    
    food_keywords = ["식비", "마트", "배달", "외식", "식재료", "커피", "음료", "양식", "한식", "중식", "일식", "편의점", "카페", "간식", "음품", "장보기"]
    insurance_keywords = ["보험", "보장성", "실비", "종신", "연금"]
    
    for item in expenses:
        cat = item["대분류"]
        amt = item["금액"]
        cat_lower = cat.lower()
        if any(k in cat_lower for k in food_keywords):
            food_sum += amt
        if any(k in cat_lower for k in insurance_keywords):
            insurance_sum += amt
            
    food_ratio = (food_sum / total_expense * 100) if total_expense > 0 else 0
    insurance_ratio = (insurance_sum / total_expense * 100) if total_expense > 0 else 0
    
    sorted_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    top_5 = sorted_categories[:5]
    
    insights = []
    insights.append(f"📅 **{month_str}월 총 지출은 {total_expense:,.0f}원**입니다.")
    
    fixed_status = "적정 수준(40% 이하)이며" if fixed_ratio <= 40 else "다소 높은 편(40% 초과)으로 집중 관리가 필요하며"
    insights.append(f"고정비 비중이 **{fixed_ratio:.1f}% ({fixed_sum:,.0f}원)**로 {fixed_status}, 변동비 비중은 **{variable_ratio:.1f}% ({variable_sum:,.0f}원)**입니다.")
    
    if food_ratio > 0:
        insights.append(f"특히 **식비 지출({food_sum:,.0f}원)**이 전체 소비의 **{food_ratio:.1f}%**를 차지하여 가장 큰 비중을 보입니다.")
        
    if insurance_ratio > 0:
        insights.append(f"**보험료/금융 지출({insurance_sum:,.0f}원)**은 전체 지출의 **{insurance_ratio:.1f}%**입니다.")
        
    if variable_ratio > 50:
        insights.append("변동비 비중이 높은 편이므로 불필요한 외식이나 불필요한 소액 변동 지출을 조금만 줄여도 추가적인 저축과 예적금 여력을 확보할 수 있습니다.")
    else:
        insights.append("변동비 지출이 훌륭히 잘 관리되고 있으며, 남는 잉여 자금은 즉시 저축 또는 투자 자산으로 배분하는 것이 유리합니다.")
        
    summary_text = " ".join(insights)
    
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "fixed_sum": fixed_sum,
        "variable_sum": variable_sum,
        "fixed_ratio": fixed_ratio,
        "variable_ratio": variable_ratio,
        "food_sum": food_sum,
        "food_ratio": food_ratio,
        "insurance_sum": insurance_sum,
        "insurance_ratio": insurance_ratio,
        "top_5": top_5,
        "summary_text": summary_text
    }

# ------------------------------------------------------------------
# 2. SIDEBAR CONFIG
# ------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 📂 가계 파일 업로드")
    
    # 1) 수입/지출 내역 전용 업로드
    st.markdown("##### 💸 수입/지출 내역 업로드")
    uploaded_ledger = st.file_uploader(
        "수입/지출 내역 엑셀 선택", 
        type=["xlsx", "xls"], 
        key="sidebar_ledger_uploader", 
        label_visibility="collapsed"
    )
    if uploaded_ledger is not None:
        if ('uploaded_ledger_filename' not in st.session_state or 
            st.session_state.uploaded_ledger_filename != uploaded_ledger.name):
            
            # 덮어쓰기 위해 기존 ledger 초기화
            st.session_state.ledger = []
            success = parse_only_ledger(uploaded_ledger)
            if success:
                st.session_state.uploaded_ledger_filename = uploaded_ledger.name
                st.success("💸 수입/지출 내역 로드 성공!")
                st.rerun()

    # 2) 자산/부채 현황 전용 업로드
    st.markdown("##### 🏦 자산/부채 현황 업로드")
    uploaded_assets = st.file_uploader(
        "자산/부채 현황 엑셀 선택", 
        type=["xlsx", "xls"], 
        key="sidebar_assets_uploader", 
        label_visibility="collapsed"
    )
    if uploaded_assets is not None:
        if ('uploaded_assets_filename' not in st.session_state or 
            st.session_state.uploaded_assets_filename != uploaded_assets.name):
            
            success = parse_only_assets(uploaded_assets)
            if success:
                st.session_state.uploaded_assets_filename = uploaded_assets.name
                st.success("🏦 자산/부채 현황 로드 성공!")
                st.rerun()
                
    st.markdown("---")
    st.image("https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&q=80", width=120)
    st.title("🏡 감이동 비발디")
    st.subheader("우리집 통합 재정 대시보드")
    st.markdown("---")
    
    st.markdown("### 👨‍👩‍👦 가계 구성원")
    st.markdown(f"- **남편:** {HUSBAND_NAME}")
    st.markdown(f"- **아내:** {WIFE_NAME}")
    
    st.markdown("---")
    
    # 3) 업로드 파일 상태 확인 및 삭제(초기화) 기능
    st.markdown("### 📊 업로드 상태 & 관리")
    
    # 파일 상태 카드
    ledger_status = f"✅ {st.session_state.uploaded_ledger_filename} ({len(st.session_state.ledger)}건)" if st.session_state.uploaded_ledger_filename else "⚠️ 기본 샘플 데이터 사용 중"
    assets_status = f"✅ {st.session_state.uploaded_assets_filename}" if st.session_state.uploaded_assets_filename else "⚠️ 기본 샘플 데이터 사용 중"
    
    st.info(f"**수입/지출 데이터:**\n{ledger_status}")
    st.success(f"**자산/부채 데이터:**\n{assets_status}")
    
    # 데이터 삭제/초기화 버튼들
    col_del1, col_del2 = st.columns(2)
    with col_del1:
        if st.button("🗑️ 수입/지출 삭제", help="수입/지출 데이터를 기본 샘플 없이 완전히 지웁니다."):
            st.session_state.ledger = []
            st.session_state.uploaded_ledger_filename = None
            st.success("수입/지출 삭제 완료!")
            st.rerun()
    with col_del2:
        if st.button("🗑️ 자산 데이터 삭제", help="자산 데이터를 완전히 비우고 초기화합니다."):
            st.session_state.asset_free = {}
            st.session_state.asset_savings = {}
            st.session_state.asset_electronic = {}
            st.session_state.asset_investment = {}
            st.session_state.investment_details = {}
            st.session_state.uploaded_assets_filename = None
            st.success("자산 데이터 삭제 완료!")
            st.rerun()
            
    if st.button("🔄 전체 데이터 초기화", use_container_width=True, help="모든 가계 데이터를 깨끗하게 지우고 새로고침합니다."):
        st.session_state.ledger = []
        st.session_state.uploaded_ledger_filename = None
        st.session_state.asset_free = {}
        st.session_state.asset_savings = {}
        st.session_state.asset_electronic = {}
        st.session_state.asset_investment = {}
        st.session_state.investment_details = {}
        st.session_state.uploaded_assets_filename = None
        st.session_state.husband_credit = HUSBAND_CREDIT
        st.session_state.liability_mortgage = LIABILITY_MORTGAGE.copy()
        st.success("전체 데이터 초기화 완료!")
        st.rerun()
        
    st.markdown("---")
    st.info("💡 **리액티브 피드백**: 탭의 체크박스를 활성화/비활성화하거나 새로운 가상 데이터를 입력하면 메트릭과 차트가 실시간으로 재계산됩니다!")

# ------------------------------------------------------------------
# 3. TABS STRUCTURE
# ------------------------------------------------------------------
tab_home, tab_ledger, tab_analysis, tab_assets = st.tabs(["🏠 총괄 대시보드", "💸 지출과 수입", "📊 재무적 지출 분석", "📈 자산 및 부채"])

# ==================================================================
# TAB 1: 🏠 총괄 대시보드
# ==================================================================
with tab_home:
    st.markdown("<h2 style='text-align: center; color: #2D3748;'>우리집 통합 재정 현황</h2>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #718096; font-size: 1.1rem;'>예적금, 투자 포트폴리오 및 대출 상환 현황을 실시간으로 종합 집계한 대시보드입니다.</p>", unsafe_allow_html=True)
    st.markdown("---")

    # 금융 데이터 계산
    total_free = sum(st.session_state.asset_free.values())
    total_savings = sum(st.session_state.asset_savings.values())
    total_electronic = sum(st.session_state.asset_electronic.values())
    total_investment = sum(st.session_state.asset_investment.values())
    
    total_asset_sum = total_free + total_savings + total_electronic + total_investment
    total_liability_sum = st.session_state.liability_mortgage["금액"]
    net_asset = total_asset_sum - total_liability_sum

    # 2) KPI Cards Row
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            label="💵 총 금융자산",
            value=f"{total_asset_sum:,.0f} 원",
            delta="예적금 + 투자 자산"
        )
        
    with col2:
        st.metric(
            label="🚨 총 부채 (장기대출)",
            value=f"{total_liability_sum:,.0f} 원",
            delta="NH 주택담보대출",
            delta_color="inverse"
        )
        
    with col3:
        if net_asset < 0:
            st.metric(
                label="📉 순금융자산 (자산-부채)",
                value=f"{net_asset:,.0f} 원",
                delta="⚠️ 순자산 마이너스 상태 (내집마련 대출 반영)",
                delta_color="inverse"
            )
        else:
            st.metric(
                label="📈 순금융자산 (자산-부채)",
                value=f"{net_asset:,.0f} 원",
                delta="순자산 양수 상태"
            )
            
    with col4:
        st.metric(
            label="⭐️ 아빠 신용점수",
            value=f"{st.session_state.husband_credit} 점",
            delta="KB국민 등급 최상위"
        )

    # 마이너스 순자산에 대한 보완 설명 경고 카드
    if net_asset < 0:
        st.markdown(f"""
        <div class="warning-card">
            <strong>⚠️ 가계 순금융자산 경보</strong><br>
            현재 총 부채({total_liability_sum:,.0f}원)가 금융 자산({total_asset_sum:,.0f}원)보다 많아 순자산이 
            <strong>{net_asset:,.0f}원</strong>으로 마이너스 상태입니다. 이는 주택 구매(감이동 한라비발디)를 위한 
            장기 주택담보대출 실행에 따른 정상적인 부채 레버리지 상황이며, 향후 상환 흐름과 저축 포트폴리오를 지속적으로 관리해야 합니다.
        </div>
        """, unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)

    # 📊 [이달의 재무 브리핑] 신규 세션 추가
    briefing = calculate_monthly_briefing(st.session_state.selected_month)
    
    st.markdown(f"### 📊 [이달의 재무 브리핑] - {st.session_state.selected_month}월 지출 분석 및 진단")
    st.markdown("감이동 비발디 가계의 실시간 자산 흐름과 당월 지출 구조를 종합 분석한 AI 스마트 요약 리포트입니다.")
    
    col_b1, col_b2, col_b3 = st.columns(3)
    with col_b1:
        st.markdown(f"""
        <div class="metric-card" style="text-align: center; border-top: 4px solid #E53E3E;">
            <p style="font-size: 0.9rem; color: #718096; margin-bottom: 5px;">🔥 {st.session_state.selected_month}월 총 지출액</p>
            <h3 style="font-size: 1.8rem; color: #E53E3E; margin-top: 0; margin-bottom: 0;">{briefing['total_expense']:,.0f} 원</h3>
        </div>
        """, unsafe_allow_html=True)
    with col_b2:
        st.markdown(f"""
        <div class="metric-card" style="text-align: center; border-top: 4px solid #3182CE;">
            <p style="font-size: 0.9rem; color: #718096; margin-bottom: 5px;">🔒 고정비 비중</p>
            <h3 style="font-size: 1.8rem; color: #2B6CB0; margin-top: 0; margin-bottom: 0;">{briefing['fixed_ratio']:.1f}%</h3>
            <p style="font-size: 0.8rem; color: #A0AEC0; margin-top: 2px; margin-bottom: 0;">({briefing['fixed_sum']:,.0f} 원)</p>
        </div>
        """, unsafe_allow_html=True)
    with col_b3:
        st.markdown(f"""
        <div class="metric-card" style="text-align: center; border-top: 4px solid #DD6B20;">
            <p style="font-size: 0.9rem; color: #718096; margin-bottom: 5px;">💸 변동비 비중</p>
            <h3 style="font-size: 1.8rem; color: #C05621; margin-top: 0; margin-bottom: 0;">{briefing['variable_ratio']:.1f}%</h3>
            <p style="font-size: 0.8rem; color: #A0AEC0; margin-top: 2px; margin-bottom: 0;">({briefing['variable_sum']:,.0f} 원)</p>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown(f"""
    <div style="background-color: #EBF8FF; border-left: 5px solid #3182CE; padding: 18px; border-radius: 8px; margin-top: 15px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(49, 130, 206, 0.05);">
        <span style="font-weight: bold; color: #2B6CB0; font-size: 1rem; display: flex; items-center: center; gap: 5px;">💡 실시간 재정 분석 리포트 (Financial Insights)</span>
        <p style="margin: 8px 0 0 0; color: #2D3748; line-height: 1.6; font-size: 0.95rem;">{briefing['summary_text']}</p>
    </div>
    """, unsafe_allow_html=True)

    # 3) Checklist & Interactive Content
    col_left, col_right = st.columns([2, 1])
    
    with col_left:
        st.markdown("### 📋 이번 달 가계 주요 체크리스트")
        st.markdown("화면에서 체크 상태를 직접 관리할 수 있으며, 이체 및 공과금 납부 상태를 한눈에 모니터링하세요.")
        
        # Interactive checklist
        for task, checked in st.session_state.checklist.items():
            st.session_state.checklist[task] = st.checkbox(task, value=checked)
            
        completed_tasks = sum(st.session_state.checklist.values())
        total_tasks = len(st.session_state.checklist)
        progress = completed_tasks / total_tasks
        
        st.write(f"**미션 완료율:** {completed_tasks}/{total_tasks} ({progress*100:.0f}%)")
        st.progress(progress)
        
    with col_right:
        st.markdown("### 🏦 감이동 한라비발디 대출 현황")
        st.markdown(f"""
        - **대출기관:** NH농협은행
        - **대출금리:** `{st.session_state.liability_mortgage['금리']}%` (고정/변동 혼합)
        - **신규일자:** `{st.session_state.liability_mortgage['대출일']}`
        - **만기일자:** `{st.session_state.liability_mortgage['만기일']}`
        - **월 고정이자 예상액:** <span class='highlight-text'>{(total_liability_sum * (st.session_state.liability_mortgage['금리']/100) / 12):,.0f}원</span>
        """, unsafe_allow_html=True)

# ==================================================================
# TAB 2: 💸 지출과 수입 (Interactive Ledger)
# ==================================================================
with tab_ledger:
    st.markdown("### 💸 월별 가계부 및 지출·수입 제어기")
    st.markdown("특정 월을 선택한 후 개별 내역의 체크박스를 켜거나 끔으로써, **실제 가계에 유효하게 합산할 실시간 금액**을 동적으로 결정할 수 있습니다.")
    
    # Unique months available
    available_months = sorted(list(set([item["월"] for item in st.session_state.ledger])))
    
    col_select, col_space = st.columns([1, 2])
    with col_select:
        selected_month = st.selectbox(
            "📅 조회 대상 월 선택", 
            available_months, 
            index=available_months.index(st.session_state.selected_month) if st.session_state.selected_month in available_months else len(available_months)-1,
            key="selected_month"
        )
    
    # Filter ledger
    filtered_items = [item for item in st.session_state.ledger if item["월"] == selected_month]
    
    st.markdown(f"#### 🔍 {selected_month} 월의 입출금 원장 세부 항목")
    st.info("💡 개별 내역 왼쪽의 '유효반영' 체크박스를 해제하면 해당 금액은 상단 총합계 및 자산 누적 계산에서 즉각 배제됩니다.")

    # We dynamically render checkboxes for each item.
    # To handle reactive state correctly in Streamlit, we split into Income and Expense columns.
    col_inc_table, col_exp_table = st.columns(2)
    
    with col_inc_table:
        st.markdown("##### 🟢 수입 내역")
        inc_items = [item for item in filtered_items if item["구분"] == "수입"]
        updated_inc_items = []
        for item in inc_items:
            # We use checkbox with key to maintain state
            cb_key = f"ledger_item_{item['id']}"
            is_active = st.checkbox(f"[{item['대분류']}] {item['내용']} | {item['금액']:,.0f}원", value=item["활성화"], key=cb_key)
            
            # Find and update back in session_state
            for original in st.session_state.ledger:
                if original["id"] == item["id"]:
                    original["활성화"] = is_active
            
            item_copy = item.copy()
            item_copy["활성화"] = is_active
            updated_inc_items.append(item_copy)
            
    with col_exp_table:
        st.markdown("##### 🔴 지출 내역")
        exp_items = [item for item in filtered_items if item["구분"] == "지출"]
        updated_exp_items = []
        for item in exp_items:
            cb_key = f"ledger_item_{item['id']}"
            is_active = st.checkbox(f"[{item['대분류']}] {item['내용']} | {item['금액']:,.0f}원", value=item["활성화"], key=cb_key)
            
            for original in st.session_state.ledger:
                if original["id"] == item["id"]:
                    original["활성화"] = is_active
            
            item_copy = item.copy()
            item_copy["활성화"] = is_active
            updated_exp_items.append(item_copy)

    # Compute Real-time dynamic totals for the selected month
    active_inc_total = sum([item["금액"] for item in st.session_state.ledger if item["월"] == selected_month and item["구분"] == "수입" and item["활성화"]])
    active_exp_total = sum([item["금액"] for item in st.session_state.ledger if item["월"] == selected_month and item["구분"] == "지출" and item["활성화"]])
    net_monthly_income = active_inc_total - active_exp_total

    st.markdown("---")
    st.markdown("#### 📊 당월 유효 계산 메트릭 (실시간 리액티브 결과)")
    
    col_res1, col_res2, col_res3 = st.columns(3)
    with col_res1:
        st.metric("🟢 선택 수입 총계", f"{active_inc_total:,.0f} 원")
    with col_res2:
        st.metric("🔴 선택 지출 총계", f"{active_exp_total:,.0f} 원")
    with col_res3:
        if net_monthly_income >= 0:
            st.metric("📊 당월 최종 순수입 (잉여 자금)", f"{net_monthly_income:,.0f} 원", delta="흑자 상태")
        else:
            st.metric("📊 당월 최종 순수입 (잉여 자금)", f"{net_monthly_income:,.0f} 원", delta="⚠️ 가계 적자 상태 (예비비 사용 필요)", delta_color="inverse")

    # 4) 모의 입력 기능 (임시 입력 Form)
    st.markdown("---")
    st.markdown("### ➕ 당월 신규/가상 데이터 모의 입력")
    st.markdown("원장 리스트에 새로운 예상 수입이나 돌발 지출을 추가하여 가계 재정에 어떤 변화가 생기는지 시뮬레이션해 보세요.")
    
    with st.form("add_ledger_item_form", clear_on_submit=True):
        f_month = st.selectbox("입력할 대상 년월", ["2026-06", "2026-07", "2026-08", "2026-09"])
        f_type = st.radio("구분", ["수입", "지출"], horizontal=True)
        f_category = st.selectbox("대분류", ["급여", "투자/배당", "주거/대출", "식비", "공과금/관리비", "양육/기타", "생활용품", "여가/문화"])
        f_memo = st.text_input("내용 및 메모 (예: JEPQ 추가배당, 아파트 인테리어 가구 구매)", placeholder="상세 내용을 작성하세요")
        f_amount = st.number_input("금액 (원)", min_value=0, value=100000, step=10000)
        
        submit_btn = st.form_submit_button("원장에 임시 추가")
        
        if submit_btn:
            new_id = max([item["id"] for item in st.session_state.ledger]) + 1 if st.session_state.ledger else 1
            new_item = {
                "id": new_id,
                "월": f_month,
                "구분": f_type,
                "대분류": f_category,
                "내용": f_memo if f_memo else "미기재",
                "금액": f_amount,
                "활성화": True
            }
            st.session_state.ledger.append(new_item)
            st.success(f"성공적으로 추가 완료: {f_month} [{f_type}] {f_category} - {f_memo} ({f_amount:,.0f}원)")
            st.rerun()

# ==================================================================
# TAB 3: 📊 재무적 지출 분석 (Dedicated Analysis)
# ==================================================================
with tab_analysis:
    st.markdown("### 📊 재무적 지출 세부 분석")
    st.markdown("선택한 월의 지출 내역을 기반으로 구조적 비용 분석 및 고정비/변동비 비중을 산출한 상세 진단입니다.")
    
    # Unique months available
    available_months_an = sorted(list(set([item["월"] for item in st.session_state.ledger])))
    
    col_select_an, col_space_an = st.columns([1, 2])
    with col_select_an:
        selected_month_an = st.selectbox(
            "📅 분석 대상 월 선택", 
            available_months_an, 
            index=available_months_an.index(st.session_state.selected_month) if st.session_state.selected_month in available_months_an else len(available_months_an)-1,
            key="analysis_tab_selected_month"
        )
        # Sync back to global session state target
        st.session_state.selected_month = selected_month_an
        
    briefing = calculate_monthly_briefing(selected_month_an)
    
    col_an1, col_an2 = st.columns(2)
    
    with col_an1:
        st.markdown("#### ① 고정비 vs 변동비 자동 분류 및 비중 산출")
        st.markdown("매월 정기 출금되는 고정 비용군과 소비 통제가 가능한 변동 비용군의 크기 및 비율을 나타냅니다.")
        
        # Metric cards
        st.markdown(f"""
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <div class="metric-card" style="flex: 1; text-align: center; border-top: 4px solid #3182CE; padding: 15px; border-radius: 8px;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 2px;">🔒 고정비 합계</p>
                <h4 style="font-size: 1.3rem; color: #2B6CB0; margin: 0;">{briefing['fixed_sum']:,.0f} 원</h4>
                <p style="font-size: 0.9rem; font-weight: bold; color: #3182CE; margin: 0;">{briefing['fixed_ratio']:.1f}%</p>
            </div>
            <div class="metric-card" style="flex: 1; text-align: center; border-top: 4px solid #DD6B20; padding: 15px; border-radius: 8px;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 2px;">💸 변동비 합계</p>
                <h4 style="font-size: 1.3rem; color: #C05621; margin: 0;">{briefing['variable_sum']:,.0f} 원</h4>
                <p style="font-size: 0.9rem; font-weight: bold; color: #DD6B20; margin: 0;">{briefing['variable_ratio']:.1f}%</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Donut Chart for Fixed vs Variable
        fig_fv = go.Figure(data=[go.Pie(
            labels=["고정비 (Fixed)", "변동비 (Variable)"],
            values=[briefing['fixed_sum'], briefing['variable_sum']],
            hole=.45,
            marker_colors=["#3182CE", "#DD6B20"],
            textinfo="percent+label"
        )])
        fig_fv.update_layout(
            margin=dict(t=10, b=10, l=10, r=10),
            height=250,
            showlegend=False
        )
        st.plotly_chart(fig_fv, use_container_width=True)
        
    with col_an2:
        st.markdown("#### ② 주요 카테고리 비중 분석 (식비 & 보험료)")
        st.markdown("당월 집중적 비용 관리가 필요한 핵심 카테고리인 식비 및 보험료 비중과 당월 지출 상위 5대 카테고리 비중입니다.")
        
        # Metric cards
        st.markdown(f"""
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <div class="metric-card" style="flex: 1; text-align: center; border-top: 4px solid #48BB78; padding: 15px; border-radius: 8px;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 2px;">🍚 식비 비중</p>
                <h4 style="font-size: 1.3rem; color: #2F855A; margin: 0;">{briefing['food_sum']:,.0f} 원</h4>
                <p style="font-size: 0.9rem; font-weight: bold; color: #48BB78; margin: 0;">{briefing['food_ratio']:.1f}%</p>
            </div>
            <div class="metric-card" style="flex: 1; text-align: center; border-top: 4px solid #E53E3E; padding: 15px; border-radius: 8px;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 2px;">🛡️ 보험료/금융 비중</p>
                <h4 style="font-size: 1.3rem; color: #9B2C2C; margin: 0;">{briefing['insurance_sum']:,.0f} 원</h4>
                <p style="font-size: 0.9rem; font-weight: bold; color: #E53E3E; margin: 0;">{briefing['insurance_ratio']:.1f}%</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Pie Chart for Top 5 Categories
        if briefing['top_5']:
            labels = [x[0] for x in briefing['top_5']]
            values = [x[1] for x in briefing['top_5']]
            
            fig_top5 = go.Figure(data=[go.Pie(
                labels=labels,
                values=values,
                hole=.3,
                textinfo="percent+label"
            )])
            fig_top5.update_layout(
                margin=dict(t=10, b=10, l=10, r=10),
                height=250,
                showlegend=False
            )
            st.plotly_chart(fig_top5, use_container_width=True)
        else:
            st.write("표시할 카테고리별 지출 데이터가 없습니다.")
            
    # ③ 재무 분석 요약 리포트 (Financial Insights)
    st.markdown("#### ③ 재무 분석 요약 리포트 (Financial Insights)")
    st.markdown(f"""
    <div style="background-color: #F7FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
        <p style="margin: 0; color: #2D3748; line-height: 1.6; font-size: 0.95rem;">{briefing['summary_text']}</p>
    </div>
    """, unsafe_allow_html=True)

# ==================================================================
# TAB 4: 📈 자산 및 부채
# ==================================================================
with tab_assets:
    st.markdown("### 📈 포트폴리오 다각화 및 부채 분석")
    
    # 0) 순수 자유입출금 계좌 접기/펴기 (st.expander)
    with st.expander("💳 순수 자유입출금 및 예적금 세부 계좌 보기", expanded=False):
        if st.session_state.asset_free:
            col_acc_l, col_acc_r = st.columns(2)
            acc_keys = list(st.session_state.asset_free.keys())
            half = len(acc_keys) // 2 + len(acc_keys) % 2
            with col_acc_l:
                for k in acc_keys[:half]:
                    st.markdown(f"- **{k}:** `{st.session_state.asset_free[k]:,.0f} 원`")
            with col_acc_r:
                for k in acc_keys[half:]:
                    st.markdown(f"- **{k}:** `{st.session_state.asset_free[k]:,.0f} 원`")
            st.markdown(f"**합계:** `{sum(st.session_state.asset_free.values()):,.0f} 원`")
        else:
            st.info("등록된 자유입출금 및 예적금 계좌 자산이 없습니다. 사이드바에서 자산 파일을 업로드해 주세요.")
            
    col_chart_l, col_chart_r = st.columns(2)
    
    # 1) 자산 비율 도넛 차트
    with col_chart_l:
        st.markdown("#### 🍩 예적금·현금 vs 투자성 자산 비율")
        
        cash_like = total_free + total_savings + total_electronic
        invest_like = total_investment
        
        fig_pie = go.Figure(data=[go.Pie(
            labels=["예적금 및 현금자산", "투자성 자산(주식/CMA)"],
            values=[cash_like, invest_like],
            hole=.45,
            marker_colors=["#4299E1", "#ED8936"],
            textinfo="percent+label"
        )])
        fig_pie.update_layout(
            margin=dict(t=30, b=10, l=10, r=10),
            height=300,
            showlegend=False
        )
        st.plotly_chart(fig_pie, use_container_width=True)
        st.write(f"- **현금성 자산:** {cash_like:,.0f}원 ({cash_like/total_asset_sum*100:.1f}%)")
        st.write(f"- **투자형 자산:** {invest_like:,.0f}원 ({invest_like/total_asset_sum*100:.1f}%)")

    # 2) 주식 포트폴리오 바 차트 (원금 vs 평가금액)
    with col_chart_r:
        st.markdown("#### 📊 주요 주식 종목 평가 (투자 원금 대비 수익률)")
        
        stock_labels = list(st.session_state.investment_details.keys())
        principal_vals = [st.session_state.investment_details[s]["원금"] for s in stock_labels]
        appraised_vals = [st.session_state.investment_details[s]["평가액"] for s in stock_labels]
        yields = [st.session_state.investment_details[s]["수익률"] for s in stock_labels]
        
        fig_bar = go.Figure(data=[
            go.Bar(name="투자 원금", x=stock_labels, y=principal_vals, marker_color="#A0AEC0"),
            go.Bar(name="평가 금액", x=stock_labels, y=appraised_vals, marker_color="#48BB78")
        ])
        fig_bar.update_layout(
            barmode='group',
            margin=dict(t=30, b=10, l=10, r=10),
            height=300,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_bar, use_container_width=True)
        
        for s in stock_labels:
            detail = st.session_state.investment_details[s]
            color = "green" if detail['수익률'] >= 0 else "red"
            st.markdown(f"- **{s}:** 원금 {detail['원금']:,.0f}원 → 평가액 {detail['평가액']:,.0f}원 (<span style='color:{color}; font-weight:bold;'>{detail['수익률']}%</span>)", unsafe_allow_html=True)

    st.markdown("---")
    
    # 3) 월별 소비/수입 패턴 분석 (Trend)
    st.markdown("#### 📈 월별 가계 수입 대 지출 트렌드 분석")
    st.markdown("원장 데이터에 기반하여 생성된 월별 실질 수입과 실질 지출 추이 차트입니다. (비활성화한 데이터는 차트에서도 즉각 제외됩니다.)")
    
    # Pre-process ledger to calculate monthly stats
    months_stat = sorted(list(set([item["월"] for item in st.session_state.ledger])))
    inc_trends = []
    exp_trends = []
    
    for m in months_stat:
        inc_trends.append(sum([item["금액"] for item in st.session_state.ledger if item["월"] == m and item["구분"] == "수입" and item["활성화"]]))
        exp_trends.append(sum([item["금액"] for item in st.session_state.ledger if item["월"] == m and item["구분"] == "지출" and item["활성화"]]))
        
    df_trend = pd.DataFrame({
        "조회월": months_stat,
        "실질수입": inc_trends,
        "실질지출": exp_trends
    })
    
    fig_trend = go.Figure()
    fig_trend.add_trace(go.Bar(
        x=df_trend["조회월"], y=df_trend["실질수입"],
        name="실질 수입", marker_color="#48BB78"
    ))
    fig_trend.add_trace(go.Bar(
        x=df_trend["조회월"], y=df_trend["실질지출"],
        name="실질 지출", marker_color="#F56565"
    ))
    
    # Add net trend line
    fig_trend.add_trace(go.Scatter(
        x=df_trend["조회월"], y=df_trend["실질수입"] - df_trend["실질지출"],
        name="잉여 자금(순수입)", mode="lines+markers",
        line=dict(color="#3182CE", width=3)
    ))
    
    fig_trend.update_layout(
        barmode='group',
        margin=dict(t=30, b=10, l=10, r=10),
        height=350,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )
    st.plotly_chart(fig_trend, use_container_width=True)

    st.markdown("---")
    
    # 4) 대출 및 상환 시뮬레이터 (NH주택담보대출 6억원 상환 시뮬레이션)
    st.markdown("#### 🧮 NH 주택담보대출 조기 상환 시뮬레이터")
    st.markdown("매월 약정 이자 외에 추가로 원금을 적극 상환할 경우, **줄어드는 이자 비용과 대출 만기 단축 개월 수**를 계산해 줍니다.")
    
    col_sim_l, col_sim_r = st.columns([1, 2])
    
    with col_sim_l:
        st.markdown("##### ⚙️ 시뮬레이션 매개변수")
        sim_loan = st.number_input("대출 원금 (원)", value=st.session_state.liability_mortgage["금액"], step=10000000)
        sim_rate = st.slider("대출 이자율 (%)", min_value=1.0, max_value=10.0, value=st.session_state.liability_mortgage["금리"], step=0.05)
        monthly_repay = st.number_input("기본 월 약정 원리금 상환액 (원)", value=2500000, step=100000)
        extra_monthly = st.slider("매월 추가 원금 중도상환액 (원)", min_value=0, max_value=5000000, value=1000000, step=100000)
        
    with col_sim_r:
        st.markdown("##### 📊 시뮬레이션 결과 및 상환 시나리오")
        
        # Simple amortization simulation
        balance = sim_loan
        monthly_rate_decimal = (sim_rate / 100) / 12
        months = 0
        total_interest = 0
        
        # Standard track (without extra payment)
        standard_balance = sim_loan
        standard_months = 0
        standard_total_interest = 0
        
        # Simulate with extra payment
        while balance > 0 and months < 360: # Max 30 years limit
            interest_this_month = balance * monthly_rate_decimal
            principal_paid = (monthly_repay - interest_this_month) + extra_monthly
            
            if principal_paid <= 0:
                # If basic monthly repay doesn't cover interest
                principal_paid = extra_monthly
                
            if balance < principal_paid:
                principal_paid = balance
                
            balance -= principal_paid
            total_interest += interest_this_month
            months += 1
            
        # Simulate standard track
        while standard_balance > 0 and standard_months < 360:
            interest_this_month = standard_balance * monthly_rate_decimal
            principal_paid = (monthly_repay - interest_this_month)
            
            if principal_paid <= 0:
                # Prevent infinite loop if repayment is too low
                principal_paid = 500000 
                
            if standard_balance < principal_paid:
                principal_paid = standard_balance
                
            standard_balance -= principal_paid
            standard_total_interest += interest_this_month
            standard_months += 1

        interest_saved = standard_total_interest - total_interest
        months_saved = standard_months - months
        
        col_m1, col_m2 = st.columns(2)
        with col_m1:
            st.metric("⏳ 조기 완납 기간", f"{months // 12}년 {months % 12}개월", f"기본 트랙 대비 {months_saved}개월 단축", delta_color="normal")
        with col_m2:
            st.metric("💰 절감 이자 비용", f"{interest_saved:,.0f} 원", f"총 납부이자: {total_interest:,.0f}원")
            
        st.markdown(f"""
        - **총 기본 이자 비용:** `{standard_total_interest:,.0f}원` ({standard_months // 12}년 {standard_months % 12}개월 소요)
        - **중도 원금 상환 반영 시:** `{total_interest:,.0f}원` ({months // 12}년 {months % 12}개월 소요)
        - **감이동 비발디 재정 전략 조언:** 매월 추가로 `{extra_monthly:,.0f}원`을 저축 대신 원금 조기 상환에 활용할 경우, 총 **{interest_saved:,.0f}원**의 금융 비용을 원천 차단하는 효과와 더불어, 내 집 마련의 진정한 완전소유를 **{months_saved}개월** 조기 달성할 수 있습니다!
        """)
