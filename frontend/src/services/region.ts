import type { RegionSelection, ScanState, WasteRecordOption } from '../types';

export const REGION_KEY = 'recycling_region_v1';
export const REGION_CHANGED = 'recycling-region-changed';
export interface SavedRegion {
  selection: RegionSelection;
  record: WasteRecordOption;
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function parseSavedRegion(raw: string | null): SavedRegion | null {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (!data || data.version !== 1) return null;
    const { selection, record } = data;
    if (!selection || !record || !nonempty(selection.sido) || !nonempty(selection.sigungu) || !nonempty(selection.managementId)) return null;
    if (record.관리번호 !== selection.managementId || !['관리구역명', '관리구역대상지역명', '배출장소유형', '배출장소'].every(key => typeof record[key] === 'string')) return null;
    return {
      selection: { sido: selection.sido, sigungu: selection.sigungu, managementId: selection.managementId },
      record: { 관리번호: record.관리번호, 관리구역명: record.관리구역명, 관리구역대상지역명: record.관리구역대상지역명, 배출장소유형: record.배출장소유형, 배출장소: record.배출장소 },
    };
  } catch { return null; }
}

export function loadSavedRegion(): SavedRegion | null {
  try { return parseSavedRegion(localStorage.getItem(REGION_KEY)); }
  catch { return null; }
}

export function saveRegion(region: SavedRegion): boolean {
  const value = JSON.stringify({ version: 1, ...region });
  if (!parseSavedRegion(value)) return false;
  try {
    localStorage.setItem(REGION_KEY, value);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(REGION_CHANGED));
    return true;
  } catch { return false; }
}

export function guideDestination(state: ScanState, saved: SavedRegion | null) {
  return saved
    ? { pathname: '/result', state: { ...state, region: saved.selection } }
    : { pathname: '/region', state };
}
