import { HistoryItem } from '../types';

const KEY = 'recycling_history';

export function loadHistory(): HistoryItem[] {
  try {
    const history = JSON.parse(localStorage.getItem(KEY) || '[]') as HistoryItem[];
    return history.map(migrateHistoryItem);
  } catch {
    return [];
  }
}

function migrateHistoryItem(item: HistoryItem): HistoryItem {
  const wasteInfo = item.result?.wasteInfo as unknown as Record<string, unknown> | undefined;
  if (!wasteInfo || Array.isArray(wasteInfo.rules)) return item;
  if (typeof wasteInfo['시도명'] !== 'string') return item;
  return {
    ...item,
    result: {
      ...item.result,
      wasteInfo: {
        sido: wasteInfo['시도명'] as string,
        sigungu: (wasteInfo['시군구명'] as string) || '',
        rules: [{
          disposalDays: (wasteInfo['배출요일'] as string) || '',
          startTime: (wasteInfo['배출시작시각'] as string) || '',
          endTime: (wasteInfo['배출종료시각'] as string) || '',
          place: (wasteInfo['배출장소'] as string) || '',
          method: '',
        }],
      },
    },
  };
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
  const safeItem = { ...item, image: undefined };
  const sanitizedHistory = history.map(({ image: _image, ...entry }) => entry);
  const updated = [safeItem, ...sanitizedHistory].slice(0, 30);
  return saveHistory(updated);
}

export function deleteHistory(id: string): boolean {
  const updated = loadHistory().filter(h => h.id !== id);
  return saveHistory(updated);
}
