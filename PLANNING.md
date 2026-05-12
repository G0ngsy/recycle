# 분리수거 AI — 기획서

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 분리수거 AI |
| 목적 | 이미지 또는 텍스트로 품목을 입력하면 AI가 지역별 분리수거 방법을 안내 |
| 차별점 | 실제 공공데이터 기반 근거 표시 + 지역별 배출 요일/시간/장소 제공 |
| 로그인 | 없음 (localStorage 기반 히스토리) |

---

## 2. 기술 스택

### 프론트엔드 → Vercel 배포
| 항목 | 기술 |
|------|------|
| 언어 | TypeScript |
| 프레임워크 | React 19 |
| 스타일 | Tailwind CSS |
| 라우팅 | React Router v7 |
| 카메라 | 브라우저 MediaDevices API (캡처) → 백엔드로 전송 |

### 백엔드 → Railway 배포
| 항목 | 기술 |
|------|------|
| 언어 | Python |
| 프레임워크 | FastAPI |
| 이미지 처리 | OpenCV (opencv-python-headless) |
| AI 모델 | EXAONE 3.5 |
| AI 연동 (로컬) | Ollama |
| AI 연동 (배포) | HuggingFace Inference API |

### 데이터
| 항목 | 출처 |
|------|------|
| 지역별 배출정보 | 행정안전부 생활쓰레기배출정보 CSV → 시도별 JSON 변환 완료 |
| 실시간 지역 조회 | 행정안전부 생활쓰레기배출정보 API (키 발급 완료) |

---

## 3. 화면 구성

### 3-1. 공통 — Header (sticky)
```
[ ♻ 분리수거 AI ]          [ 갤러리 | 홈 ]
```

### 3-2. 홈 `/`
```
어떤 방식으로 확인할까요?

[ 📷 이미지 스캔 카드 ]  → /scan 이동
[ ⌨️ 텍스트 검색 카드 ]  → /search 이동
```

### 3-3. 이미지 스캔 `/scan`
```
분리수거할 물건을 촬영하거나 업로드해주세요

[ 이미지 미리보기 영역 ]
  - 선택 전: 점선 박스 + 안내 문구
  - 선택 후: 이미지 표시 + X 버튼

[ 📷 사진 찍기 ] [ 🖼 이미지 업로드 ]

[ 다음 → ] (이미지 없으면 비활성)
```

### 3-4. 텍스트 검색 `/search`
```
분리수거할 품목을 입력해주세요

[ 🔍 검색창 ]
[ 자동완성 드롭다운 ]
[ 빠른 선택 태그: 페트병 / 캔 / 종이컵 ... ]

[ 다음 → ] (입력 없으면 비활성)
```

### 3-5. 지역 선택 `/region`
```
어느 지역의 분리수거 기준을 알려드릴까요?

[ ▼ 시/도 선택 ]
[ ▼ 구/군 선택 ] (선택사항)

[ 확인 → ]
```

### 3-6. 결과 `/result` ⭐ 핵심 화면
```
[ 추정 품목 ]         예: 🧴 페트병 · 플라스틱

[ 재활용 가능 여부 ]  ✅ 재활용 가능해요 / ❌ 재활용 불가

[ 배출 방법 ]
  1. 내용물을 비워주세요
  2. 라벨을 제거해주세요
  3. 투명 비닐봉투에 담아 배출

[ 주의사항 ]
  • 오염된 경우 일반쓰레기로 배출

[ 우리 동네 배출 정보 ]   ← 공공데이터 기반
  📅 배출 요일: 월+수+금
  ⏰ 시간: 19:00 ~ 21:00
  📍 장소: 집앞

[ 근거 ]              ← 차별점
  📌 환경부 분리배출 가이드라인 2024
  📌 서울특별시 종로구 배출정보

[ 다시 하기 ]  [ 갤러리 저장 ]
```

### 3-7. 갤러리 `/gallery`
```
내 스캔 기록

[ 이미지/아이콘 | 품목명 | 지역 | 재활용여부 ] [ 🗑 ]
[ 이미지/아이콘 | 품목명 | 지역 | 재활용여부 ] [ 🗑 ]
...
```

---

## 4. 사용자 흐름 (UX Flow)

```
홈
 ├─ 이미지 스캔 선택
 │    ├─ 이미지 촬영 or 업로드
 │    ├─ [백엔드] OpenCV 전처리 → EXAONE 품목 분석
 │    ├─ 품목 추정 로딩 화면
 │    ├─ 지역 선택
 │    └─ 결과 화면
 │
 └─ 텍스트 검색 선택
      ├─ 품목 직접 입력
      ├─ 지역 선택
      └─ 결과 화면
           └─ [백엔드] 지역 JSON + EXAONE → 분리수거 안내 생성
```

---

## 5. API 설계 (백엔드)

### POST `/api/analyze-image`
이미지를 받아 품목을 추정

**Request**
```json
{
  "image": "base64 문자열"
}
```

**Response**
```json
{
  "itemName": "페트병"
}
```

---

### POST `/api/recycling-guide`
품목 + 지역 정보를 받아 분리수거 가이드 생성

**Request**
```json
{
  "itemName": "페트병",
  "sido": "서울특별시",
  "sigungu": "종로구"
}
```

**Response**
```json
{
  "itemName": "페트병",
  "category": "플라스틱",
  "isRecyclable": true,
  "disposalSteps": ["내용물 비우기", "라벨 제거", "투명 비닐에 담아 배출"],
  "tips": ["오염된 경우 일반쓰레기로"],
  "wasteInfo": {
    "배출요일": "월+수+금",
    "배출시작시각": "19:00",
    "배출종료시각": "21:00",
    "배출장소": "집앞"
  },
  "source": "환경부 분리배출 가이드라인 2024, 서울특별시 종로구 배출정보"
}
```

---

## 6. 데이터 흐름

```
[프론트] 이미지 캡처
    ↓ base64 전송
[백엔드] OpenCV 전처리 (리사이즈, 최적화)
    ↓
[백엔드] EXAONE → 품목 추정
    ↓ itemName 반환
[프론트] 지역 선택 화면
    ↓ itemName + 지역 전송
[백엔드] 지역 JSON에서 배출정보 조회
    ↓
[백엔드] EXAONE → 품목 + 지역 배출정보 context로 가이드 생성
    ↓ 결과 반환
[프론트] 결과 화면 표시
```

---

## 7. 작업 순서

### Phase 1 — 백엔드 세팅
- [ ] FastAPI 프로젝트 초기화 (`backend/`)
- [ ] 의존성 정의 (`requirements.txt`)
- [ ] OpenCV 이미지 전처리 모듈
- [ ] EXAONE 연동 (Ollama 로컬)
- [ ] `/api/analyze-image` 엔드포인트
- [ ] `/api/recycling-guide` 엔드포인트
- [ ] 지역 JSON 데이터 로드 로직
- [ ] CORS 설정 (프론트 연동용)

### Phase 2 — 프론트엔드 개편
- [ ] 기존 Gemini 코드 → 백엔드 API 호출로 교체
- [ ] 이미지 스캔 화면 완성
- [ ] 텍스트 검색 화면 완성
- [ ] 지역 선택 화면 완성
- [ ] 결과 화면 완성 (근거 포함)
- [ ] 갤러리 화면 완성

### Phase 3 — 연동 테스트
- [ ] 이미지 스캔 전체 흐름 테스트
- [ ] 텍스트 검색 전체 흐름 테스트
- [ ] 지역별 배출정보 연동 확인
- [ ] 에러 처리 (API 실패, 이미지 오류 등)

### Phase 4 — 배포
- [ ] 프론트: Vercel 배포 설정
- [ ] 백엔드: Railway 배포 설정
- [ ] EXAONE → HuggingFace API로 전환 (배포 환경)
- [ ] 환경변수 설정 (.env)
- [ ] CORS 도메인 확정

---

## 8. 환경변수

### 프론트엔드 (`.env`)
```
VITE_API_BASE_URL=http://localhost:8000   # 로컬
# VITE_API_BASE_URL=https://xxx.railway.app  # 배포
```

### 백엔드 (`.env`)
```
USE_OLLAMA=true                  # 로컬: Ollama 사용
OLLAMA_MODEL=exaone3.5

# 배포 시
USE_OLLAMA=false
HF_API_TOKEN=hf_xxx              # HuggingFace API 키
HF_MODEL=LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct
```

---

## 9. 폴더 구조

```
recycle/
├── backend/                  # Python FastAPI
│   ├── main.py
│   ├── routers/
│   │   └── recycling.py
│   ├── services/
│   │   ├── image_service.py  # OpenCV
│   │   └── ai_service.py     # EXAONE
│   ├── data/                 # 지역 JSON (복사본)
│   └── requirements.txt
│
├── src/                      # React 프론트엔드
│   ├── App.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── ImageScan.tsx
│   │   ├── TextSearch.tsx
│   │   ├── RegionSelect.tsx
│   │   ├── Result.tsx
│   │   └── Gallery.tsx
│   ├── components/
│   │   └── layout/Header.tsx
│   ├── services/
│   │   ├── api.ts            # 백엔드 API 호출
│   │   └── storage.ts        # localStorage
│   └── types/index.ts
│
├── public/
│   └── data/                 # 시도별 JSON (17개)
│
├── index.html
├── vite.config.ts
└── PLANNING.md
```
