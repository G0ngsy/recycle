# 분리수거 AI

## 로컬 실행

필수 환경: Node.js 20.x, Python 3.11.x 이상

### 백엔드

```powershell
cd backend
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
py -3.11 -m pip install -r requirements.txt
py -3.11 -m uvicorn main:app --reload --port 8000
```

정상 실행 여부는 `http://localhost:8000/health`에서 확인합니다.

### 프런트엔드

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

프로덕션 빌드는 `npm run build`로 검증합니다. `vite`를 찾지 못하면 기존의 불완전한 의존성 설치 상태이므로 `npm ci`를 다시 실행하세요.

## 지역 API

- `GET /api/regions`: CSV 기준 16개 시·도 목록
- `GET /api/regions/{sido}/sigungu`: 선택한 시·도의 시·군·구 목록
- `GET /api/regions/{sido}/sigungu/{sigungu}/waste-records?q=&limit=30&offset=0`: 관리구역·배출장소 검색 결과와 총 건수
- `POST /api/recycling-guide`: `itemName`, `sido`, `sigungu`, `managementId`로 안내 조회

시·군·구에 자료가 한 건이면 `managementId`를 생략할 수 있습니다. 여러 건이면 관리번호가 필수이며, 누락 시 409를 반환합니다. 관리번호가 지역과 맞지 않거나 지역이 없으면 404를 반환합니다. 첫 번째 행으로 대체하지 않습니다.

## 지역 데이터 갱신

앱은 `backend/data/waste_records.json`을 지역 배출 정보의 기준으로 사용합니다. 이 파일에는 CP949 `생활쓰레기배출정보.csv`의 10,187건이 관리번호와 기준일자를 포함해 저장되어 있습니다. 원본 CSV를 다시 내려받아 갱신할 때는 다음 명령을 실행합니다.

```powershell
python backend/scripts/import_waste_csv.py "C:\path\to\생활쓰레기배출정보.csv"
```

변환기는 필수 열, 행 수, 관리번호 중복, 기준일자를 검증합니다. 원본의 시도명을 그대로 사용하며 `광주광역시`·`전라남도` 등 기존 명칭은 조회 시 새 명칭으로 매핑합니다. 기준일자가 1년을 넘으면 결과에 최신 정보 확인 안내를 표시합니다. 오래된 시도별 JSON은 앱 조회에 사용하지 않습니다.

지역 데이터와 HTTP API 회귀 테스트는 `backend/requirements-test.txt` 설치 후 `python -m unittest discover -s backend/tests`로 실행합니다.
