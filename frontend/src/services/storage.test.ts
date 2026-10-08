import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HistoryItem } from '../types';
import { addHistory, deleteHistory, loadHistory, normalizeResult } from './storage';

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
});

const historyItem: HistoryItem = {
  id: '1',
  image: 'data:image/jpeg;base64,large-image',
  itemName: '페트병',
  region: '서울특별시 종로구',
  result: {
    itemName: '페트병', category: '플라스틱', guideStatus: 'ready', isRecyclable: true,
    disposalSteps: ['비우기'], tips: [], source: '공공데이터',
  },
  timestamp: 1,
};

describe('history storage', () => {
  it('stores metadata without a base64 image', () => {
    expect(addHistory(historyItem)).toBe(true);
    expect(loadHistory()[0].image).toBeUndefined();
    expect(loadHistory()[0].inputKind).toBe('image');
  });

  it('deletes a history item', () => {
    addHistory(historyItem);
    expect(deleteHistory('1')).toBe(true);
    expect(loadHistory()).toEqual([]);
  });

  it('reports quota failures', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
    });
    expect(addHistory(historyItem)).toBe(false);
  });

  it('removes images from existing history during the next save', () => {
    values.set('recycling_history', JSON.stringify([{ ...historyItem, id: 'old' }]));
    addHistory(historyItem);
    expect(loadHistory().every(item => item.image === undefined)).toBe(true);
  });

  it('migrates legacy regional waste information', () => {
    const legacy = {
      ...historyItem,
      result: {
        ...historyItem.result,
        wasteInfo: {
          시도명: '서울특별시', 시군구명: '종로구', 배출요일: '월',
          배출시작시각: '18:00', 배출종료시각: '21:00', 배출장소: '집 앞',
        },
      },
    };
    values.set('recycling_history', JSON.stringify([legacy]));
    const migrated = loadHistory()[0].result.wasteInfo!;
    expect(migrated.시도명).toBe('서울특별시');
    expect(migrated.배출요일).toBe('월');
  });

  it('preserves all rules in older saved regional results', () => {
    values.set('recycling_history', JSON.stringify([{ ...historyItem, result: {
      ...historyItem.result,
      wasteInfo: { sido: '서울특별시', sigungu: '종로구', rules: [
        { disposalDays: '월', startTime: '', endTime: '', place: 'A', method: '' },
        { disposalDays: '화', startTime: '', endTime: '', place: 'B', method: '' },
      ] },
    } }]));
    expect(loadHistory()[0].result.wasteInfo?.legacyRules).toHaveLength(2);
    addHistory(historyItem);
    expect(loadHistory()[1].result.wasteInfo?.legacyRules).toHaveLength(2);
  });

  it('marks a legacy AI fallback as unavailable', () => {
    const oldResult = { ...historyItem.result, guideStatus: undefined, isRecyclable: false,
      category: '확인 필요', disposalSteps: ['품목의 재질 표시와 오염 여부를 먼저 확인하세요.'] };
    const migrated = normalizeResult(oldResult as typeof historyItem.result);
    expect(migrated.guideStatus).toBe('unavailable');
    expect(migrated.isRecyclable).toBeNull();
  });
});
