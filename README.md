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

- `GET /api/regions`: 지원하는 시·도 목록
- `GET /api/regions/{sido}/sigungu`: 선택한 시·도의 시·군·구 목록

시·도만 선택하면 해당 시·도의 기본 배출 안내를 제공합니다.
