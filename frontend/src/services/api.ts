import { RecyclingResult, MarkResult, RegionListResponse, SigunguListResponse, WasteRecordListResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API 오류: ${res.status}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API 오류: ${res.status}`);
  return res.json();
}

export function getRegions(): Promise<RegionListResponse> {
  return get<RegionListResponse>('/api/regions');
}

export function getSigungu(sido: string): Promise<SigunguListResponse> {
  return get<SigunguListResponse>(`/api/regions/${encodeURIComponent(sido)}/sigungu`);
}

export function getWasteRecords(
  sido: string, sigungu: string, query = '', offset = 0
): Promise<WasteRecordListResponse> {
  const params = new URLSearchParams({ q: query, limit: '30', offset: String(offset) });
  return get<WasteRecordListResponse>(
    `/api/regions/${encodeURIComponent(sido)}/sigungu/${encodeURIComponent(sigungu)}/waste-records?${params}`
  );
}

// 이미지 → 라벨 분석 결과
export async function analyzeImage(image: string): Promise<MarkResult> {
  return post<MarkResult>('/api/analyze-image', { image });
}

// 품목 + 지역 → 분리수거 가이드
export async function getRecyclingGuide(
  itemName: string,
  sido: string,
  sigungu: string,
  managementId: string
): Promise<RecyclingResult> {
  return post<RecyclingResult>('/api/recycling-guide', { itemName, sido, sigungu, managementId });
}
