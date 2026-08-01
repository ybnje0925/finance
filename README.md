# 연준이네 가계부

Supabase DB를 기준으로 수입/지출과 부부 자산을 자동 조회하는 Streamlit 대시보드입니다.

## 필요한 환경변수

`.env.example`을 참고해서 로컬에는 `.env` 또는 Streamlit secrets, Vercel에는 Environment Variables로 설정합니다.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` - 로컬 업로드 CLI 또는 서버 측 DB 저장용
- `GEMINI_API_KEY` - 총괄 대시보드 챗봇 자동 연결용

## Supabase 테이블 생성

Supabase SQL Editor에서 `schema.sql` 전체를 실행합니다.

생성되는 테이블:

- `income_expenses`
- `assets_youngbeom`
- `assets_jaeeun`

## 로컬 실행

```bash
pip install -r requirements.txt
streamlit run app.py
```

## 엑셀 파일을 Supabase로 업로드

```bash
python upload_to_supabase.py --ledger "수입지출.xlsx" --assets "자산.xlsx"
```

업로드 후 앱을 새로고침하면 Supabase의 최신 데이터가 자동 반영됩니다.

## Vercel 배포

Vercel 프로젝트의 Environment Variables에 위 환경변수를 등록한 뒤 배포합니다.

주의: Streamlit은 장시간 실행 서버 구조라 Vercel Serverless와 궁합이 제한적입니다. 배포가 안정적으로 필요하면 Streamlit Community Cloud, Render, Railway 같은 Python 웹앱 호스팅이 더 적합합니다.
