# Recycle 프로젝트 현재 상태 분석

> 분석 기준: 저장소 `poly` 브랜치의 HEAD `4513d5a` (`라벨인식으로 변경`)
>
> 분석일: 2026-08-22
> 분석 방법: 소스·설정·기획 문서·Git 이력·데이터 파일 정적 분석 및 로컬 빌드 시도

## 0. Executive Summary

Recycle은 사용자가 사진 또는 품목명과 거주 지역을 입력하면 재활용 가능 여부, 배출 단계, 주의사항, 지역별 배출 일정을 안내하는 모바일 우선 웹 애플리케이션이다. React 기반 화면과 FastAPI 기반 API, 전국 지역 데이터, OCR 기반 재활용 표시 인식, LLM 기반 안내 생성까지 MVP의 골격은 갖춰져 있다.

다만 현재 상태는 **화면과 핵심 경로를 먼저 연결한 초기 MVP 구현 단계**다. 정상적인 제품 동작을 보장하는 테스트와 배포 설정이 없고, 전국 데이터가 준비되어 있음에도 UI는 경기도로 고정되어 있다. 이미지 기능은 범용 품목 인식이 아니라 EasyOCR로 재활용 표시의 문자·재질 코드를 찾는 방식이며, 포함된 YOLOv8 범용 모델과 Neo4j Graph RAG 코드는 실제 요청 경로에 연결되지 않았다. 로컬 환경에서는 프론트엔드 의존성 설치가 완료되지 않아 빌드에 실패했고, Python 실행 환경도 사용할 수 없어 백엔드 실행을 검증하지 못했다.

**종합 진행률은 약 52%**로 추정한다. 코드 양보다 실제 사용자 경로의 완결성, 재현 가능한 실행·검증·배포 가능성을 더 크게 반영한 수치다.

---

## 1. 프로젝트 개요

### 1.1 목적

사용자가 폐기하려는 물건의 사진 또는 이름을 입력하고 지역을 선택하면 다음 정보를 한 화면에서 제공하는 것이 목적이다.

- 품목 또는 재활용 표시의 분류와 재질 추정
- 재활용 가능 여부
- 올바른 배출 단계와 주의사항
- 지방자치단체별 배출 요일·시간·장소
- 판단 근거 또는 데이터 출처
- 조회 결과의 브라우저 내 기록 저장

`PLANNING.md`에는 프론트엔드를 Vercel, 백엔드를 Railway에 배포하고 로컬에서는 Ollama/EXAONE, 배포 환경에서는 Hugging Face Inference API를 사용하는 구상이 기록되어 있다.

### 1.2 핵심 기능

1. 이미지 촬영 또는 파일 업로드
2. 이미지 전처리 후 EasyOCR 기반 재활용 표시 인식
3. 품목명 직접 검색과 추천 품목 선택
4. 지역 선택
5. 지역 JSON 조회와 LLM 기반 분리배출 가이드 생성
6. 결과 및 근거 표시
7. `localStorage` 기반 최근 기록 저장·조회·삭제
8. 선택적 Neo4j 지식 그래프 구성 코드

### 1.3 기술 스택

| 영역 | 기술 | 비고 |
| --- | --- | --- |
| 프론트엔드 | React 19, TypeScript 5.8, React Router 7, Vite 6 | 모바일 폭(`max-w-md`) 중심 SPA |
| UI | Tailwind CSS CDN, Lucide React, Google Fonts CDN | Tailwind 패키지/빌드 구성은 없음 |
| 백엔드 | Python, FastAPI 0.115, Uvicorn | JSON REST API 2개 + health check |
| 이미지 처리 | OpenCV, EasyOCR, Ultralytics YOLOv8 | 실제 API는 전처리 + EasyOCR 경로만 사용 |
| 생성형 AI | Ollama/EXAONE 3.5 또는 Hugging Face Inference API | 환경 변수로 실행 방식을 전환 |
| 그래프 DB | Neo4j 5.24 | 서비스와 마이그레이션 코드는 있으나 API 미연결 |
| 데이터 | 전국 17개 시도 JSON 8,877행 | 고유 시도·시군구 조합 220개 |
| 브라우저 저장소 | Web Storage `localStorage` | 최근 30건 저장 |

### 1.4 전체 아키텍처

현재 구현은 별도 인증이나 영구 애플리케이션 DB가 없는 2-tier SPA/API 구조다.

```text
사용자 브라우저
  └─ React SPA
      ├─ MediaDevices / FileReader: 촬영·업로드
      ├─ fetch: FastAPI 호출
      └─ localStorage: 결과 기록 최대 30건
             │
             ▼
FastAPI
  ├─ POST /api/analyze-image
  │   └─ OpenCV 전처리 → EasyOCR → 분류/재질 코드 매핑
  ├─ POST /api/recycling-guide
  │   ├─ 시도 JSON에서 지역 데이터 조회
  │   └─ Ollama EXAONE 또는 Hugging Face → JSON 가이드 생성
  └─ GET /health

분리되어 있으나 미연결된 경로
  ├─ YOLOv8n 범용 물체 감지
  ├─ Neo4j Graph RAG 조회
  └─ 프론트엔드 Gemini 직접 호출 서비스
```

아키텍처상 주의할 점은 “AI 분석”이 단일 일관된 파이프라인이 아니라는 것이다. 현재 라우터는 `detect_recycle_mark()`만 호출한다. YOLO 결과와 EXAONE을 조합하는 `analyze_image_item()`은 정의·import만 되어 있으며 호출되지 않는다. Neo4j의 `build_graph_context()`도 가이드 생성에 전달되지 않는다.

---

## 2. 구현 현황

| 기능 | 상태 | 설명 |
| --- | --- | --- |
| 홈 및 방식 선택 | 완료 | 이미지 스캔과 텍스트 검색으로 이동 가능 |
| 이미지 촬영 | 완료 | `MediaDevices.getUserMedia` 사용, 후면 카메라 요청 및 스트림 종료 처리 |
| 이미지 업로드·미리보기 | 완료 | 파일을 Data URL로 읽고 제거 가능 |
| 이미지 전처리 | 완료 | 최대 1024px 리사이즈, sharpening, JPEG 재인코딩 |
| 재활용 라벨 OCR | 진행중 | EasyOCR로 한글/영문을 추출하고 정적 맵으로 분류·재질 판정. 정확도 평가와 테스트 없음 |
| 일반 물체 인식 | 미구현 | `yolov8n.pt`와 `detect_objects()`는 있으나 실제 API 미사용. 모델도 재활용 품목 전용 모델이 아님 |
| 이미지 기반 품목명 추론 | 미구현 | `analyze_image_item()`이 있지만 라우터가 호출하지 않아 실제 사용자 흐름에는 미적용 |
| 텍스트 품목 검색 | 완료 | 직접 입력, Enter 이동, 정적 추천 목록 제공 |
| 자동완성 | 진행중 | 현재 정적 추천 목록의 부분 문자열 필터일 뿐 데이터/AI 검색과 연계되지 않음 |
| 지역 선택 | 진행중 | 경기도 31개 시군 목록만 하드코딩. 시도 선택 UI 없음 |
| 전국 지역 데이터 | 완료 | 17개 JSON, 총 8,877행이 백엔드와 프론트 public에 중복 보관됨 |
| 지역 정보 조회 | 진행중 | 시도 파일과 시군구명으로 조회하지만 동일 시군구의 여러 관리구역 중 첫 행만 사용하고, 불일치 시 해당 시도의 첫 행으로 조용히 대체 |
| 분리배출 가이드 API | 진행중 | Ollama/HF 호출, JSON 추출·정규화·fallback 구현. 스키마 검증과 신뢰도 관리 부족 |
| AI 장애 fallback | 완료 | 호출 또는 JSON 파싱 실패 시 기본 안내 객체 반환 |
| 결과 화면 | 완료 | OCR 텍스트, 분류, 재활용 여부, 단계, 팁, 지역 정보, 근거 표시 |
| 결과 기록 저장 | 완료 | `localStorage`에 최대 30개 저장, 갤러리 조회·삭제 지원 |
| 인증/사용자 계정 | 미구현 | 기획상 로그인 없음. 개인화·서버 동기화도 없음 |
| Neo4j 마이그레이션 | 진행중 | 제약조건, 지역/품목 노드 생성 스크립트 존재. 실행 및 데이터 검증 흔적 없음 |
| Graph RAG | 미구현 | 조회 서비스는 있으나 API/AI 프롬프트에 연결되지 않음 |
| Gemini 연동 | 미사용 | 이전 구조의 `frontend/src/services/gemini.ts`와 의존성이 남아 있으나 어느 화면에서도 import하지 않음 |
| 에러 UX | 진행중 | 결과 화면에 포괄적 오류 표시만 있고 상세 원인, 재시도 실행, timeout, offline 대응 없음 |
| 테스트 | 미구현 | 백엔드·프론트엔드 단위/통합/E2E 테스트와 test script가 없음 |
| 배포 | 미구현 | Vercel/Railway/Docker/CI 설정과 운영 환경 구성 없음 |
| 보안·운영 | 미구현 | CORS 전체 허용, 요청 크기 제한·rate limit·구조화 로그·모니터링 없음 |

---

## 3. 폴더 구조 분석

```text
poly/
├─ PLANNING.md                         # 제품 구상, 화면/API/배포 계획
├─ backend/
│  ├─ main.py                          # FastAPI 앱, CORS, router, /health
│  ├─ requirements.txt                 # Python 의존성 고정
│  ├─ yolov8n.pt                       # 약 6.5MB 범용 YOLOv8 nano 가중치
│  ├─ routers/
│  │  └─ recycling.py                  # 이미지 분석/가이드 API 및 지역 JSON 조회
│  ├─ services/
│  │  ├─ image_service.py              # OpenCV, EasyOCR, YOLO 및 라벨 매핑
│  │  ├─ ai_service.py                 # Ollama/HF 호출, 프롬프트, fallback
│  │  └─ graph_service.py              # 선택적 Neo4j 조회와 컨텍스트 생성
│  ├─ scripts/
│  │  └─ migrate_to_neo4j.py           # JSON과 정적 품목을 Neo4j로 이관
│  ├─ data/                             # 전국 17개 시도 지역 배출 JSON
│  └─ assets/recycle_marks/             # 재활용 표시 참고 이미지 32개
└─ frontend/
   ├─ package.json / package-lock.json  # npm 의존성 및 명령
   ├─ vite.config.ts / tsconfig.json    # Vite/TypeScript 설정
   ├─ index.html                        # Tailwind·폰트를 CDN에서 로드
   ├─ public/data/                      # 백엔드 데이터와 중복된 지역 JSON
   └─ src/
      ├─ main.tsx / App.tsx             # SPA 진입점과 6개 라우트
      ├─ pages/                         # Home, Scan, Search, Region, Result, Gallery
      ├─ components/                    # Header와 재사용 UI 컴포넌트
      ├─ services/api.ts                # FastAPI client
      ├─ services/storage.ts            # localStorage CRUD
      ├─ services/gemini.ts             # 미사용 레거시 Gemini client
      └─ types/index.ts                 # API·기록 타입
```

### 3.1 핵심 파일

- `frontend/src/pages/Result.tsx`: 사용자 흐름을 실제로 조율한다. 이미지면 `/analyze-image`를 먼저 호출하고, 그 결과로 `/recycling-guide`를 호출한 뒤 저장까지 처리한다.
- `backend/routers/recycling.py`: 외부 API 계약과 지역 JSON 조회를 담당한다.
- `backend/services/image_service.py`: OCR 초기화, 영상 전처리, 라벨 문자열 매핑을 담당한다. 모델이 전역 lazy singleton이므로 첫 요청 지연이 크다.
- `backend/services/ai_service.py`: 로컬 Ollama와 원격 HF를 전환하고, 모델 응답을 정규화한다.
- `backend/data/*.json`: 실제 지역 안내의 근거 데이터다. 레코드 수 편차가 크고 관리구역 단위 중복이 있어 단순 첫 행 선택으로는 정확한 결과를 보장하기 어렵다.
- `backend/services/graph_service.py`: 향후 Graph RAG용이나 현재 dead path다.

### 3.2 실제 서비스 동작 흐름

#### 이미지 경로

1. `/scan`에서 촬영 또는 업로드하고 Data URL을 React Router state로 전달한다.
2. `/region`에서 **경기도의 시군구 하나**를 선택한다.
3. `/result`가 `/api/analyze-image`를 호출한다.
4. 서버가 이미지를 디코딩·리사이즈·sharpen하고 EasyOCR로 읽는다.
5. OCR 텍스트를 `RECYCLE_MARK_MAP`과 비교해 `category`, `material`, `texts`를 반환한다.
6. 프론트가 `category (material)` 또는 첫 OCR 문자열을 품목명처럼 사용해 `/api/recycling-guide`를 호출한다.
7. 서버가 경기도 JSON의 일치 시군구 중 첫 레코드를 선택하고 이를 프롬프트에 넣어 EXAONE/HF 가이드를 생성한다.
8. 프론트가 결과를 표시하고 사용자가 선택하면 `localStorage`에 저장한다.

#### 텍스트 경로

1. `/search`에서 품목명을 직접 입력하거나 정적 추천 태그를 선택한다.
2. `/region`에서 경기도 시군구를 선택한다.
3. `/result`가 이미지 분석 없이 `/api/recycling-guide`를 호출한다.
4. 이후 표시·저장 흐름은 이미지 경로와 같다.

#### 기록 재조회

갤러리의 기록을 누르면 저장된 `cachedResult`를 Router state로 전달하므로 API를 다시 호출하지 않는다. 삭제 버튼의 클릭 이벤트는 부모 카드로 전파될 수 있어, 삭제와 동시에 결과 화면으로 이동하는 결함 가능성이 있다(`stopPropagation` 없음).

---

## 4. 개발 진행률 추정

| 영역 | 진행률 | 판단 근거 |
| --- | ---: | --- |
| 기획 | 75% | 목적, UX, API, 배포 방향은 문서화. 수용 기준, 데이터 정책, 비기능 요구사항은 없음 |
| 백엔드 | 60% | 핵심 API와 fallback은 존재. 검증, 테스트, Graph 연계, 운영 안전장치 부족 |
| 프론트엔드 | 68% | 6개 주요 화면과 양대 사용자 경로 구현. 전국 지역 선택, 접근성, 안정적 오류 UX 부족 |
| 데이터베이스/데이터 | 55% | 전국 JSON은 충분히 수집됨. 정규화·중복 처리·정확성 검증 부족, Neo4j 미연결 |
| AI 기능 | 45% | OCR와 LLM 호출은 구현. 품목 인식·정확도 측정·Graph RAG·모델 운영 전략 미완성 |
| 테스트/품질 | 5% | 자동 테스트, lint/typecheck script, fixture, CI가 없음 |
| 배포/운영 | 10% | 배포 계획만 있고 설정·관측성·보안 강화 없음 |
| **종합** | **52%** | 기능 골격은 있으나 재현 가능한 MVP 완료 조건에 미달 |

---

## 5. 미완성 기능 및 흔적

### 5.1 명시적 TODO

소스에서 `TODO`, `FIXME`, `XXX` 주석은 발견되지 않았다. 하지만 TODO가 없다는 것이 완성을 뜻하지는 않는다. 다음은 사용되지 않거나 절반만 연결된 구현 흔적이다.

### 5.2 사용되지 않는 코드·의존성

- `analyze_image_item()`: OCR + YOLO + EXAONE으로 품목명을 만들도록 작성되어 있지만 라우터에서는 import만 하고 호출하지 않는다.
- `detect_objects()`: 위 미사용 함수에서만 호출되어 현재 서비스 경로에서는 YOLO 모델이 전혀 쓰이지 않는다.
- `extract_text()`: 호출 지점이 없다.
- `graph_service.py`: `build_graph_context()`를 포함한 모든 기능이 API에서 호출되지 않는다.
- `get_recycling_guide(..., graph_context="")`: Graph 컨텍스트를 받을 수 있으나 항상 기본값으로 호출된다.
- `frontend/src/services/gemini.ts`: import 지점이 없는 레거시 서비스다. `@google/genai` 의존성과 `VITE_GEMINI_API_KEY` 요구도 잔존한다.
- `frontend/public/data`: 프론트 코드가 읽지 않는다. 백엔드 데이터와 중복되어 저장소 크기와 동기화 위험만 늘린다.
- `backend/assets/recycle_marks`: 32개 참고 이미지가 있지만 학습·테스트·template matching 어느 코드에서도 사용되지 않는다.

### 5.3 하드코딩·임시 구현

- 지역 선택이 `SIDO = '경기도'`와 31개 시군구 배열로 고정되어 있다.
- 검색 추천 13개가 컴포넌트 상수로 하드코딩되어 있다.
- Neo4j 초기 품목 10개가 마이그레이션 스크립트 안에 직접 정의되어 있다.
- CORS가 `allow_origins=["*"]`로 전체 허용되어 있다.
- 결과의 `source`는 LLM이 생성하므로 실제 근거 URL/문서와의 일치가 보장되지 않는다.
- 지역 일치 실패 시 오류를 알리지 않고 해당 시도 JSON의 첫 행을 반환한다. 잘못된 지역 정보를 확신 있게 표시할 위험이 있다.

### 5.4 누락된 품질 요소

- API request/response에 대한 엄격한 Pydantic response model 없음
- 이미지 MIME, base64 유효성, 용량 및 해상도 제한 없음
- AI 호출 timeout/retry/circuit breaker 없음
- 프론트의 API 오류 body 처리와 사용자용 원인 안내 없음
- React Router state에 의존하여 새로고침·직접 URL 접근 시 흐름 복원 불가
- 테스트, lint, formatter, typecheck 전용 npm script 없음
- README, 설치 자동화, `.env.example` 없음
- 주석 처리된 코드는 두드러지지 않았고 실제 mock 응답도 없지만, 정적 추천·첫 행 fallback이 사실상 임시 데이터 처리 역할을 한다.

---

## 6. 현재 실행 가능 여부

### 6.1 검증 결과

| 항목 | 결과 | 해석 |
| --- | --- | --- |
| `package.json` JSON 파싱 | 성공 | 파일 자체는 유효 |
| 지역 JSON 파싱 | 17개 모두 성공 | 총 8,877행 확인 |
| 프론트 `npm ci` | 완료되지 않음 | 제한된 환경에서 90초 이상 출력 없이 지연되어 중단. 부분 `node_modules`만 생성됨 |
| 프론트 `npm run build` | 실패 | 의존성 설치 미완료로 `vite` 실행 파일 없음 |
| 백엔드 Python 컴파일/실행 | 미검증 | 현재 환경의 `python` 명령이 없고 `py` launcher 대상 Python도 실행 불가 |
| 테스트 | 실행 불가 | 테스트 코드와 명령 자체가 없음 |

따라서 **현재 체크아웃을 이 환경에서 즉시 실행 가능한 상태로 확인하지 못했다.** 이는 소스 컴파일 오류가 확인되었다는 의미는 아니며, 필요한 런타임과 의존성을 재현할 수 없었다는 뜻이다.

### 6.2 예상 실행 방법

#### 백엔드

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

기본값 `USE_OLLAMA=true`이므로 별도 Ollama 설치 후 `exaone3.5` 모델이 준비되어 있어야 실제 AI 답변을 생성한다. 미준비 상태에서도 가이드 API는 예외를 잡아 fallback을 반환할 가능성이 있지만, OCR은 EasyOCR/PyTorch 초기화에 의존한다.

#### 프론트엔드

```powershell
cd frontend
npm ci
$env:VITE_API_BASE_URL='http://localhost:8000'
npm run dev
```

브라우저에서 `http://localhost:3000`에 접근한다. 카메라 API는 일반적으로 localhost 또는 HTTPS 보안 컨텍스트가 필요하다.

### 6.3 환경 변수

| 변수 | 필요 조건 | 기본값/용도 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 선택 | 기본 `http://localhost:8000` |
| `USE_OLLAMA` | 선택 | 기본 `true` |
| `OLLAMA_MODEL` | Ollama 사용 시 선택 | 기본 `exaone3.5` |
| `HF_API_TOKEN` | `USE_OLLAMA=false`일 때 필수 | Hugging Face 인증 |
| `HF_MODEL` | HF 사용 시 선택 | 기본 EXAONE 3.5 7.8B Instruct |
| `NEO4J_URI` | Graph DB 사용 시 필수 | 현재 런타임 경로에는 미사용 |
| `NEO4J_USERNAME` / `NEO4J_USER` | Graph DB 사용 시 선택 | 기본 `neo4j` |
| `NEO4J_PASSWORD` | Graph DB 사용 시 필수 | 현재 런타임 경로에는 미사용 |
| `VITE_GEMINI_API_KEY` | 미사용 레거시 코드에서만 필요 | 현 API 기반 화면 흐름에는 불필요 |

### 6.4 누락된 설정과 예상 문제

- `.env.example`, README, 지원 Node/Python 버전 명시가 없다.
- Vercel/Railway 설정, SPA rewrite, 프로세스 시작 명령, Dockerfile이 없다.
- Tailwind와 Google Fonts를 런타임 CDN에 의존하므로 오프라인/차단 환경에서 스타일 또는 폰트가 깨질 수 있다.
- EasyOCR가 `gpu=True`로 고정되어 CPU 전용 서버에서 CUDA 관련 실패 가능성이 크다. 운영 환경에 맞춘 자동 감지 또는 `gpu=False` 설정이 필요하다.
- EasyOCR는 첫 실행 시 모델 파일 다운로드가 필요할 수 있어 네트워크 제한 환경에서 실패할 수 있다.
- `opencv-python-headless`, EasyOCR/PyTorch, Ultralytics를 함께 설치하므로 이미지가 크고 빌드 시간이 길다.
- 포함된 `yolov8n.pt`는 현재 실제 API에 사용되지 않아 배포 용량만 증가시킨다.
- LLM 응답 지연이 길어도 timeout이 없으므로 요청이 장시간 대기할 수 있다.
- 데이터 레코드 선택 기준이 너무 단순해 같은 시군구 내 관리구역별 규칙을 잃는다.

---

## 7. 다음 개발 우선순위

### 1. 실행 가능한 기준선 복구 및 자동 검증

가장 먼저 지원 런타임 버전, `.env.example`, README를 추가하고 프론트 빌드와 백엔드 smoke test를 재현해야 한다. 동시에 최소한의 lint/typecheck와 API 단위 테스트를 CI에 연결한다. 지금은 기능을 추가해도 회귀 여부를 확인할 방법이 없다.

### 2. 핵심 사용자 경로의 데이터 정확성 완성

전국 시도/시군구 선택을 실제 JSON에서 생성하고, 관리구역이 여러 개인 경우 사용자 선택 또는 명확한 집계 규칙을 둔다. 지역 불일치 시 첫 행을 반환하지 말고 404/명시적 “정보 없음”으로 처리한다. 이 작업이 제품의 차별점인 지역별 안내의 신뢰도를 결정한다.

### 3. 이미지/AI 아키텍처를 하나로 결정하고 연결

제품 요구가 “재활용 라벨 인식”인지 “물건 자체 인식”인지 먼저 확정해야 한다. 라벨 인식이면 YOLO·범용 품목 추론 코드를 제거하고 OCR 정확도 평가 세트를 만든다. 물체 인식까지 필요하면 전용 데이터셋/모델을 준비하고 `analyze_image_item()`을 실제 API에 연결한다. Neo4지도 정확도 개선 근거가 확인될 때만 연결하며, 그렇지 않으면 초기 MVP에서 제외하는 편이 낫다.

### 4. 운영 안전성 및 배포

AI timeout/retry, 요청 크기 제한, CPU/GPU 설정, CORS 제한, structured logging을 추가하고 스테이징 환경에 배포한다. 실제 모바일 카메라와 지역별 데이터 결과를 E2E로 확인한 후 베타 범위를 넓힌다.

---

## 8. 개발 재개 로드맵

### 단계 A — 기준선과 재현성

- [ ] README에 목적, 요구 버전, 설치·실행·테스트 방법 작성
- [ ] `frontend/.env.example`, `backend/.env.example` 추가
- [ ] Node/Python 버전 고정(`.nvmrc`/Volta, `.python-version` 등)
- [ ] 깨끗한 환경에서 `npm ci && npm run build` 성공 확인
- [ ] 백엔드 의존성 설치 및 `/health` smoke test 성공 확인
- [ ] `typecheck`, `lint`, `test` 스크립트 추가
- [ ] GitHub Actions 등 CI에서 프론트 빌드와 백엔드 테스트 실행

### 단계 B — MVP 데이터 흐름 완성

- [ ] 전국 시도 선택 UI 구현
- [ ] 시군구 목록을 하드코딩 대신 데이터/API에서 생성
- [ ] 관리구역 단위 데이터 선택 정책 정의
- [ ] 지역 미일치 시 잘못된 첫 행 fallback 제거
- [ ] 백엔드 데이터와 `frontend/public/data` 중 단일 원본만 유지
- [ ] API response model과 오류 응답 스키마 정의
- [ ] 직접 URL/새로고침 시 state 복구 또는 안전한 redirect 구현
- [ ] 갤러리 삭제 이벤트 전파 방지 및 확인 UX 추가

### 단계 C — AI·이미지 품질

- [ ] 이미지 기능의 목표를 라벨 OCR/품목 인식 중 명확히 확정
- [ ] 대표 재활용 표시 이미지로 OCR fixture와 정확도 기준 작성
- [ ] CPU/GPU 자동 선택 및 모델 warm-up 전략 구현
- [ ] 이미지 형식·용량·해상도 검증 추가
- [ ] LLM timeout, 제한된 retry, 오류 코드 추가
- [ ] LLM 출력에 엄격한 구조화 스키마 적용
- [ ] 근거 출처를 모델 생성 문자열이 아닌 검증된 데이터로 구성
- [ ] YOLO/Neo4j/Gemini의 사용 여부를 결정하고 미사용 코드는 제거
- [ ] Graph RAG를 유지한다면 API에 연결하고 품질 개선 효과 측정

### 단계 D — 테스트와 사용자 경험

- [ ] `load_waste_info`, AI 응답 파싱, fallback 단위 테스트
- [ ] 두 API의 성공/실패 통합 테스트
- [ ] 이미지·텍스트 양대 경로 E2E 테스트
- [ ] API 오류, 오프라인, 카메라 거부, 빈 OCR 결과 UX 개선
- [ ] 접근성(키보드, label, aria, 대비) 점검
- [ ] 모바일 실기기 카메라·성능 테스트
- [ ] 개인정보 관점에서 이미지 처리·보관 정책 명시

### 단계 E — 배포와 운영

- [ ] 프론트 Vercel 설정 및 SPA rewrite 구성
- [ ] 백엔드 Railway 또는 대체 플랫폼 시작 명령 구성
- [ ] 운영 도메인만 허용하도록 CORS 제한
- [ ] secret 관리 및 환경별 설정 분리
- [ ] structured logging, 오류 추적, latency/실패율 모니터링 추가
- [ ] rate limit 및 요청 본문 크기 제한 적용
- [ ] 스테이징 배포 후 smoke/E2E 수행
- [ ] 데이터 출처, 갱신 주기, 마지막 갱신일 표시
- [ ] 베타 사용자 피드백 후 운영 배포

---

## 9. 기술 부채 분석

### 9.1 리팩토링 필요 코드

- 라우터가 파일 I/O, fallback 선택, 응답 조합, debug 출력을 모두 담당한다. 지역 repository/service와 API schema 계층으로 분리할 필요가 있다.
- `Result.tsx`가 두 API 조율, 상태 머신, 저장, 표시를 한 컴포넌트에서 처리한다. custom hook 또는 orchestration service로 분리하면 테스트가 쉬워진다.
- Python API 모델은 camelCase이고 데이터는 한글 key이며 내부 코드는 snake_case가 섞여 있다. 경계별 명시적 DTO와 alias 정책이 필요하다.
- `print` 기반 디버그 출력을 Python logging으로 교체하고 request ID와 latency를 기록해야 한다.
- broad `except Exception`과 Neo4j의 무음 예외 처리는 장애 원인을 감춘다.

### 9.2 구조 개선 포인트

- 전국 JSON을 매 요청마다 파일에서 읽고 전체 배열을 선형 탐색한다. 시작 시 인덱스를 구축하거나 SQLite/PostgreSQL 등 조회용 저장소로 정규화하는 편이 안정적이다.
- 8,877행 자체는 작지만 동일 데이터가 backend와 frontend에 중복되어 변경 시 불일치할 수 있다.
- AI 모델 제공자 선택, 이미지 분석 전략, Graph RAG가 코드 곳곳에 분산되어 있다. provider interface와 feature flag를 정의할 필요가 있다.
- 프론트가 Router의 일시적 state를 workflow 저장소처럼 사용한다. 새로고침 복원 전략 또는 URL/session storage 기반 상태 설계가 필요하다.
- Tailwind CDN 대신 빌드 의존성으로 고정해야 재현성과 CSP 대응이 좋아진다.

### 9.3 성능 문제 가능성

- EasyOCR reader 첫 초기화와 모델 로딩이 매우 느릴 수 있다.
- `gpu=True` 고정은 CPU 배포에서 장애, GPU 환경에서도 자원 경쟁을 일으킬 수 있다.
- base64 JSON은 바이너리 업로드보다 약 33% 큰 전송량을 만들며 서버가 재인코딩까지 수행한다.
- 매 가이드 요청마다 JSON 파일 전체 load/parse 및 선형 검색이 실행된다.
- LLM 요청 timeout과 동시성 제어가 없어 worker 고갈 가능성이 있다.
- YOLO를 실제 연결할 경우 OCR+YOLO+LLM의 직렬 파이프라인은 모바일 사용자에게 큰 지연을 유발할 수 있다.
- gallery가 base64 원본 이미지를 `localStorage`에 저장하므로 브라우저의 통상적인 작은 quota를 빠르게 초과할 수 있다. `setItem` 예외도 처리하지 않는다.

### 9.4 유지보수·신뢰성 위험

- 자동 테스트가 전무해 데이터 스키마나 AI provider 변경이 즉시 사용자 장애로 이어질 수 있다.
- `@types/react-router-dom` v5 타입 패키지는 React Router DOM v7과 불필요하거나 충돌 소지가 있다.
- `allowJs`, `skipLibCheck`, 느슨한 TypeScript 설정은 문제를 빌드 전에 숨길 수 있다.
- LLM이 `source`까지 생성하므로 출처 환각 가능성이 있다. 공공데이터 기반 서비스의 핵심 신뢰성 위험이다.
- 지역 데이터의 출처 URL, 수집일, 라이선스, 최신성 정보가 코드에서 추적되지 않는다.
- 지역 불일치 시 첫 레코드 fallback은 조용한 데이터 오류를 만든다.
- `frontend/services/gemini.ts`처럼 이전 아키텍처가 남아 신규 개발자가 어느 AI 경로가 정식인지 오해할 수 있다.
- 세 번의 커밋만 있고 최신 커밋에 기능·데이터·모델·그래프 변경이 크게 묶여 있어 변경 추적과 회귀 원인 파악이 어렵다.

---

## 10. 최종 요약

- **현재 진행률: 52%**
- **현재 상태: 초기 MVP 단계** — 화면과 핵심 API의 happy path는 있으나 재현 가능한 빌드, 테스트, 전국 지역 UX, AI 품질 검증, 배포가 완료되지 않음
- **가장 큰 문제점:** 실제 서비스 정확도와 실행 가능성을 보장할 테스트·배포 기준선이 없고, 준비된 전국 데이터와 AI/Graph 코드가 핵심 사용자 경로에 제대로 연결되지 않음
- **가장 먼저 해야 할 일:** 깨끗한 개발 환경에서 프론트 빌드와 백엔드 smoke test를 재현하고 CI를 만든 뒤, 전국 지역 선택과 정확한 지역 레코드 조회를 완성할 것
- **예상 완성까지 필요한 작업량:** 1명의 풀스택 개발자 기준 안정적인 데모 MVP까지 약 3~5주, 테스트·보안·모니터링·실기기 검증을 포함한 베타까지 약 6~10주. 전용 이미지 인식 모델의 데이터 수집/학습까지 범위에 포함하면 별도로 4~8주 이상이 추가될 수 있음

### 출시 판단

현재 상태로는 외부 사용자 대상 출시를 권장하지 않는다. 우선 “정확한 지역 안내를 제공하는 텍스트 검색 MVP”를 안정화해 베타 범위를 좁히는 것이 가장 빠른 경로다. 이미지 기능은 라벨 OCR의 성공/실패를 명확히 표시하고 수동 품목명 보정 수단을 제공한 뒤 점진적으로 확장하는 것이 적절하다.
