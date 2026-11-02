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

## 사진 재질 분류 (실험 기능)

사진 한 장에 물체 하나를 담아 촬영하면 MobileNetV3 Small의 재질 후보와 기존 OCR의 마크 분석을 함께 표시합니다. 이미지 분석 후에는 반드시 품목 확인 화면을 거칩니다. 모델 점수는 정답 확률이 아니며, `trash`는 일반쓰레기 배출 판정으로 사용하지 않습니다. 세부 수지(PET/PP), 오염·코팅 여부는 외관 분류 대상이 아닙니다.

프로젝트 루트에서 다음 순서로 준비합니다. 원본 다운로드 폴더는 수정하지 않습니다.

```powershell
# RTX 4070용 GPU 패키지를 먼저 설치합니다.
backend\venv\Scripts\python.exe -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
backend\venv\Scripts\python.exe -m pip install -r backend/requirements-material.txt
backend\venv\Scripts\python.exe backend/scripts/prepare_trashnet.py "C:\Users\akfnx\Downloads\dataset-resized\dataset-resized" --output backend/data/trashnet-reviewed-v2 --reviewed-groups backend/data/trashnet_reviewed_groups.json
$env:TORCH_HOME = "$PWD\backend\.cache\torch"
backend\venv\Scripts\python.exe backend/scripts/train_trashnet.py
```

데이터는 `backend/data/trashnet-reviewed-v2`에 분류별 70/15/15 비율로 복사하고 `manifest.json`에 분리 결과와 검사 기록을 저장합니다. 손상 이미지와 분류가 충돌하는 동일 사진은 제외합니다. 동일한 픽셀의 중복 사진과 직접 검토한 동일 장면의 변형 사진은 대표 사진 하나만 사용해 학습·검증·평가 사이 누출을 막습니다. 검토 목록은 `backend/data/trashnet_reviewed_groups.json`에 원본 픽셀 해시와 함께 저장돼 원본이 바뀌면 준비를 중단합니다. 유사도 검사만으로 사진을 자동 삭제하지 않습니다. 출력 폴더가 비어 있지 않으면 덮어쓰지 않습니다. 재학습 시 준비·학습 명령의 `--output`으로 새 폴더를 지정하세요.

학습은 ImageNet 사전 학습 가중치로 시작해 분류층 5회, 전체 미세조정 최대 20회 진행합니다. 배치 크기 32, AdamW, 분류별 손실 가중치와 학습 사진에만 적용되는 증강을 사용합니다. 검증 macro-F1이 5회 연속 개선되지 않으면 미세조정을 종료합니다. 검증에서 가장 좋은 모델을 `backend/models/trashnet-reviewed-v2/model.pt`에 저장합니다. `metadata.json`에는 모델 버전·전처리·분류 순서·임계값이, `evaluation.json`에는 학습 기록과 평가 지표·혼동행렬이 저장됩니다. 이미지·모델·캐시는 Git에서 제외합니다.

후보 표시 기준은 검증 데이터의 분류별 정밀도 90% 이상이며 최소 10개의 예측을 요구합니다. 기준을 얻지 못한 분류와 낮은 점수는 ‘확인 필요’로 표시합니다. 이는 검증 표본에서 얻은 기준이며 실제 휴대폰 정확도를 보장하지 않습니다. 실제 국내 제품·빈 배경·다양한 조명의 별도 평가 자료를 확보하기 전에는 실험 기능으로 제공합니다.

`POST /api/analyze-image`는 기존 `category`, `material`, `texts`와 함께 `ocrStatus`, `materialPrediction`(상태·상위 3개 후보·점수·추가 확인 여부·모델 버전), `materialConflict`를 반환합니다. 모델은 CPU에서 최초 요청 시 로딩하며 요청 중 다운로드나 학습을 하지 않습니다. `MATERIAL_MODEL_DIR`로 모델 폴더를 변경할 수 있습니다. 모델 변경 후에는 백엔드를 재시작하세요. 모델 누락·실행 실패 시 OCR을, OCR 실패 시 재질 후보를 이용할 수 있고, 둘 다 이용할 수 없으면 직접 입력합니다. 실제 이미지가 아닌 데이터는 400으로 거절합니다.

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

## 환경부 분리배출 가이드라인

환경부가 [2018년 공개한 분리배출 가이드라인](https://mcee.go.kr/home/web/board/read.do?boardId=875840&boardMasterId=54&maxIndexPages=10&maxPageItems=10&menuId=10181&pagerOffset=0)의 PDF 36쪽을 `backend/data/recycling_guideline_2018.pdf`로 보관하고, 추출한 페이지별 텍스트를 `backend/data/recycling_guideline_pages.json`에 저장합니다. JSON에는 원본 PDF의 SHA-256이 기록됩니다.

- `GET /api/guideline/search?q=페트병&limit=2`: 관련 원문 쪽과 발췌문 검색
- `GET /api/guideline/pdf`: 원본 PDF 열기 (`#page=10`으로 쪽 이동 가능)
- `POST /api/recycling-guide`: 품목에 관련된 원문을 AI 참고 자료로 전달하고 `guidelineReferences`를 결과에 포함

결과 화면은 AI 안내가 실패해도 원문 발췌와 쪽 번호를 보여줍니다. 2018년 자료이므로 최신 지자체 배출 규칙을 확인하도록 안내하며, 지역별 요일·시간·장소는 기존 관리번호 기반 CSV 데이터만 사용합니다. PDF 검색 결과 자체를 재활용 가능 여부의 확정 판정으로 사용하지 않습니다.

같은 PDF에서 색인을 다시 생성하려면 `python backend/scripts/import_guideline_pdf.py --check`로 일치 여부를 확인하거나 `python backend/scripts/import_guideline_pdf.py`로 다시 추출합니다. 다른 판본으로 교체할 때는 쪽 수와 주요 쪽 검증 기준을 먼저 갱신해야 합니다.

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
- 로컬 안내는 JSON 형식, 입력 컨텍스트 4,096 토큰·출력 최대 512 토큰으로 요청합니다. 기본 응답 제한은 60초(`AI_TIMEOUT_SECONDS`)이며 Ollama 모델을 10분 유지합니다. 기존 `.env`에 20초가 지정돼 있다면 첫 모델 로딩 시 제한을 넘을 수 있습니다. 안내 생성은 작업 스레드에서 실행해 다른 API 요청을 막지 않습니다. 설정은 [Ollama API 문서](https://docs.ollama.com/api/chat)와 [컨텍스트 설정 안내](https://docs.ollama.com/faq)를 참고했습니다.
- 실제 API 토큰과 데이터베이스 비밀번호는 저장소에 커밋하지 마세요.
