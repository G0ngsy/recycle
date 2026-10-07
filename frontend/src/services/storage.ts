import { HistoryItem, RecyclingResult } from '../types';

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
  const legacyFailure = result.source?.includes('AI 응답 파싱 실패 시 기본 안내');
  if (legacyFailure || result.guideStatus === 'unavailable' || typeof result.isRecyclable !== 'boolean') {
    return { ...result, guideStatus: 'unavailable', isRecyclable: null };
  }
  return { ...result, guideStatus: 'ready' };
}

export function loadHistory(): HistoryItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]') as HistoryItem[];
    if (!Array.isArray(items)) return [];
    return items.map(item => {
      const [sido, ...rest] = item.region.split(' ');
      return {
        ...item,
        result: normalizeResult(item.result),
        region: [canonicalSido(sido), ...rest].join(' '),
        regionSelection: item.regionSelection ? {
          ...item.regionSelection,
          sido: canonicalSido(item.regionSelection.sido),
        } : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addHistory(item: HistoryItem): void {
  const history = loadHistory();
  const updated = [item, ...history].slice(0, 30);
  saveHistory(updated);
}

export function deleteHistory(id: string): void {
  const updated = loadHistory().filter(h => h.id !== id);
  saveHistory(updated);
}
