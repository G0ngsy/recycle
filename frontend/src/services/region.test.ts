import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guideDestination, loadSavedRegion, parseSavedRegion, REGION_KEY, saveRegion, type SavedRegion } from './region';

const region: SavedRegion = {
  selection: { sido: '경기도', sigungu: '가평군', managementId: 'place-1' },
  record: { 관리번호: 'place-1', 관리구역명: '가평읍', 관리구역대상지역명: '읍내리', 배출장소유형: '문전', 배출장소: '집앞' },
};
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});

describe('saved disposal region', () => {
  it('starts unset and restores the exact disposal location after a reload', () => {
    expect(loadSavedRegion()).toBeNull();
    expect(saveRegion(region)).toBe(true);
    expect(loadSavedRegion()).toEqual(region);
  });
  it('replaces the saved location without changing history', () => {
    values.set('recycling_history', '[{"id":"old"}]');
    saveRegion(region);
    const updated = { ...region, selection: { ...region.selection, managementId: 'place-2' }, record: { ...region.record, 관리번호: 'place-2', 배출장소: '공동 수거함' } };
    expect(saveRegion(updated)).toBe(true);
    expect(loadSavedRegion()).toEqual(updated);
    expect(values.get('recycling_history')).toBe('[{"id":"old"}]');
  });
  it('rejects damaged, incomplete and mismatched settings', () => {
    for (const value of ['broken json', '[]', '{"version":2}', JSON.stringify({ version: 1, selection: region.selection }), JSON.stringify({ version: 1, ...region, record: { ...region.record, 관리번호: 'wrong' } })]) {
      values.set(REGION_KEY, value);
      expect(loadSavedRegion()).toBeNull();
    }
    expect(parseSavedRegion(null)).toBeNull();
  });
  it('reports storage failures without pretending to save or destroying the previous setting', () => {
    saveRegion(region);
    vi.stubGlobal('localStorage', { getItem: () => values.get(REGION_KEY), setItem: () => { throw new Error('full'); } });
    expect(saveRegion(region)).toBe(false);
    expect(loadSavedRegion()).toEqual(region);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(loadSavedRegion()).toBeNull();
  });
  it('skips region selection while keeping the confirmed photo and analysis', () => {
    const state = { image: 'photo', searchText: '유리병', itemConfirmed: true, analysisComplete: true, markResult: { category: null, material: null, texts: [] } };
    expect(guideDestination(state, region)).toEqual({ pathname: '/result', state: { ...state, region: region.selection } });
    expect(guideDestination(state, null)).toEqual({ pathname: '/region', state });
  });
});
