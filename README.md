# 분리수거 AI

## 로컬 실행

필수 환경: Node.js 20.x, Python 3.11.x

### 백엔드

```powershell
cd backend
Copy-Item .env.example .env
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

프로덕션 빌드와 품질 검사는 다음 명령으로 검증합니다.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

백엔드 테스트는 활성화된 가상 환경에서 실행합니다.

```powershell
cd backend
py -3.11 -m pip install -r requirements-test.txt
py -3.11 -m pytest -q
```

## 지역 API

- `GET /api/regions`: 지원하는 시·도 목록
- `GET /api/regions/{sido}/sigungu`: 선택한 시·도의 시·군·구 목록
- `GET /api/regions/{sido}/sigungu/{sigungu}/waste-records?q=&limit=30&offset=0`: 관리번호별 배출장소 후보
- `POST /api/recycling-guide`: 품목명, 시·도, 시·군·구, 선택한 `managementId`로 안내 조회

생활쓰레기 CSV 10,187건을 관리번호별로 변환한 `backend/data/waste_records.json`을 기준으로 사용합니다. 한 시·군·구에 후보가 여러 건이면 `managementId`가 필수이며, 선택한 관리번호의 규칙 한 건을 반환합니다. 일치하지 않는 지역이나 관리번호는 `404`, 선택이 필요한 경우는 `409`를 반환합니다. AI 안내를 확인할 수 없으면 `guideStatus: "unavailable"`과 `isRecyclable: null`을 반환하고 지역 정보는 유지합니다.

## 지역 데이터 갱신

원본 CP949 `생활쓰레기배출정보.csv`를 갱신할 때 아래 명령으로 앱용 JSON을 다시 생성합니다.

```powershell
python backend/scripts/import_waste_csv.py "C:\path\to\생활쓰레기배출정보.csv"
```

변환기는 필수 열, 행 수, 관리번호 중복, 기준일자를 검증합니다. 기존 명칭으로 저장된 시·도는 조회 시 CSV 명칭으로 매핑합니다. 오래된 시도별 JSON은 앱 조회에 사용하지 않습니다.

## OCR 통합 테스트

기본 테스트는 OCR 모델을 다운로드하거나 실행하지 않습니다. 실제 OCR 기준선은 EasyOCR 런타임과 한국어·영어 모델 파일을 사전에 준비한 환경에서만 실행합니다.

```powershell
cd backend
$env:RUN_OCR_INTEGRATION='1'
$env:EASYOCR_GPU='false'
$env:EASYOCR_MODEL_DIR='C:\path\to\EasyOCR\model'
python -m pytest tests/integration/test_ocr_marks.py -m ocr -v
```

결과는 `backend/test-results/ocr-baseline.json`에 생성되며 Git에는 포함되지 않습니다. release 기준을 강제하려면 `OCR_ENFORCE_THRESHOLDS=1`을 추가합니다. 기준은 category 90%, material 80%입니다.

## 안전한 로컬 설정

- 기본 CORS 허용 대상은 `localhost:3000`과 `127.0.0.1:3000`뿐입니다.
- EasyOCR는 CPU 모드가 기본입니다. 검증된 CUDA 환경에서만 `EASYOCR_GPU=true`를 사용하세요.
- 이미지는 JPEG/PNG Data URL만 허용하며 기본 최대 크기는 5MB입니다.
- Ollama/Hugging Face 호출이 실패하면 재활용 가능 여부를 추정하지 않고 확인 필요 상태를 반환합니다.
- 실제 API 토큰과 데이터베이스 비밀번호는 저장소에 커밋하지 마세요.
