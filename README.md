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
- `GET /api/regions/{sido}/sigungu/{sigungu}/areas`: 관리구역 목록과 선택 필요 여부

관리구역 데이터가 있는 시·군·구는 가이드 요청의 `managementArea`가 필수입니다. 선택한 관리구역에 서로 다른 배출 규칙이 있으면 동일 규칙만 제거하고 `wasteInfo.rules`에 모두 반환합니다. 지원하지 않는 시·도 또는 시·군·구는 다른 지역으로 대체하지 않고 `404`를 반환합니다.

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
- Ollama/Hugging Face 호출이 실패하면 서버는 기본 분리배출 안내를 반환합니다.
- 실제 API 토큰과 데이터베이스 비밀번호는 저장소에 커밋하지 마세요.
