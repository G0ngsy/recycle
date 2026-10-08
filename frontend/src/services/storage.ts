import type { DisposalRule, HistoryItem, RecyclingResult, WasteInfoSimple } from '../types';

const KEY = 'recycling_history';
const SIDO_ALIASES: Record<string, string> = {
  광주광역시: '전남광주통합특별시',
  전라남도: '전남광주통합특별시',
  전라북도: '전북특별자치도',
  강원도: '강원특별자치도',
};

export function canonicalSido(sido: string): string {
  return SIDO_ALIASES[sido] || sido;
}

export function normalizeResult(result: RecyclingResult): RecyclingResult {
  const legacyFailure = result.source?.includes('AI 응답 파싱 실패 시 기본 안내') || (
    result.category === '확인 필요' && result.isRecyclable === false &&
    result.disposalSteps?.[0] === '품목의 재질 표시와 오염 여부를 먼저 확인하세요.'
  );
  if (legacyFailure || result.guideStatus === 'unavailable' || typeof result.isRecyclable !== 'boolean') {
    return { ...result, guideStatus: 'unavailable', isRecyclable: null };
  }
  return { ...result, guideStatus: 'ready' };
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function migrateWasteInfo(raw: unknown): WasteInfoSimple | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const info = raw as Record<string, unknown>;
  if (typeof info['시도명'] === 'string') {
    return {
      관리번호: String(info['관리번호'] || ''),
      시도명: canonicalSido(info['시도명']),
      시군구명: String(info['시군구명'] || ''),
      관리구역명: textOrNull(info['관리구역명']),
      관리구역대상지역명: textOrNull(info['관리구역대상지역명']),
      배출장소유형: textOrNull(info['배출장소유형']),
      배출장소: textOrNull(info['배출장소']),
      재활용품배출방법: textOrNull(info['재활용품배출방법']),
      배출요일: textOrNull(info['배출요일']),
      배출시작시각: textOrNull(info['배출시작시각']),
      배출종료시각: textOrNull(info['배출종료시각']),
      데이터기준일자: String(info['데이터기준일자'] || ''),
      오래된정보: info['오래된정보'] === true,
      legacyRules: Array.isArray(info.legacyRules) ? info.legacyRules as DisposalRule[] : undefined,
    };
  }
  if (typeof info.sido !== 'string' || !Array.isArray(info.rules)) return undefined;
  return {
    관리번호: '',
    시도명: canonicalSido(info.sido),
    시군구명: String(info.sigungu || ''),
    관리구역명: textOrNull(info.managementArea),
    관리구역대상지역명: textOrNull(info.managementArea),
    배출장소유형: null,
    배출장소: null,
    재활용품배출방법: null,
    배출요일: null,
    배출시작시각: null,
    배출종료시각: null,
    데이터기준일자: '',
    오래된정보: false,
    legacyRules: info.rules as DisposalRule[],
  };
}

function migrateHistoryItem(item: HistoryItem): HistoryItem {
  const [sido, ...rest] = item.region.split(' ');
  const wasteInfo = migrateWasteInfo(item.result?.wasteInfo);
  const regionSelection = item.regionSelection ?? (item.regionInfo ? {
    sido: canonicalSido(item.regionInfo.sido),
    sigungu: item.regionInfo.sigungu,
    managementId: wasteInfo?.관리번호 || '',
  } : undefined);
  return {
    ...item,
    inputKind: item.inputKind ?? (item.image || item.result?.markResult ? 'image' : item.searchText ? 'text' : undefined),
    region: [canonicalSido(sido), ...rest].join(' '),
    regionSelection: regionSelection ? { ...regionSelection, sido: canonicalSido(regionSelection.sido) } : undefined,
    result: normalizeResult({ ...item.result, wasteInfo }),
  };
}

export function loadHistory(): HistoryItem[] {
  try {
    const history = JSON.parse(localStorage.getItem(KEY) || '[]') as HistoryItem[];
    return Array.isArray(history) ? history.map(migrateHistoryItem) : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function addHistory(item: HistoryItem): boolean {
  const history = loadHistory();
  const safeItem = { ...item, image: undefined, inputKind: item.inputKind ?? (item.image ? 'image' : 'text') };
  const sanitizedHistory = history.map(({ image: _image, ...entry }) => entry);
  return saveHistory([safeItem, ...sanitizedHistory].slice(0, 30));
}

export function deleteHistory(id: string): boolean {
  return saveHistory(loadHistory().filter(item => item.id !== id));
}
