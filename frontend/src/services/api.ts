import { MarkResult, RecyclingResult, RegionListResponse, SigunguListResponse, WasteRecordListResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function createApiError(res: Response): Promise<Error> {
  let detail = '';
  try {
    const body = await res.json() as { detail?: string };
    detail = typeof body.detail === 'string' ? body.detail : '';
  } catch {
    // Status remains available when the response has no JSON body.
  }
  return new Error(detail || `API 오류: ${res.status}`);
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await createApiError(res);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw await createApiError(res);
  return res.json();
}

export function getRegions(): Promise<RegionListResponse> {
  return get<RegionListResponse>('/api/regions');
}

export function getSigungu(sido: string): Promise<SigunguListResponse> {
  return get<SigunguListResponse>(`/api/regions/${encodeURIComponent(sido)}/sigungu`);
}

export function getWasteRecords(
  sido: string, sigungu: string, query = '', offset = 0,
): Promise<WasteRecordListResponse> {
  const params = new URLSearchParams({ q: query, limit: '30', offset: String(offset) });
  return get<WasteRecordListResponse>(
    `/api/regions/${encodeURIComponent(sido)}/sigungu/${encodeURIComponent(sigungu)}/waste-records?${params}`,
  );
}

export function analyzeImage(image: string): Promise<MarkResult> {
  return post<MarkResult>('/api/analyze-image', { image });
}

export function getRecyclingGuide(
  itemName: string,
  sido: string,
  sigungu: string,
  managementId: string,
): Promise<RecyclingResult> {
  return post<RecyclingResult>('/api/recycling-guide', { itemName, sido, sigungu, managementId });
}
