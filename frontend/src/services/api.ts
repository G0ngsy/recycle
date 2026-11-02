import { MarkResult, RecyclingResult, RegionListResponse, SigunguListResponse, WasteRecordListResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message: string, public kind: 'network' | 'timeout' | 'http' | 'response', public status?: number) { super(message); }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw await createApiError(response);
    try { return await response.json() as T; }
    catch {
      if (controller.signal.aborted) throw new ApiError('응답이 늦어 요청을 종료했습니다. 다시 시도해주세요.', 'timeout');
      throw new ApiError('서버 응답을 읽지 못했습니다. 다시 시도해주세요.', 'response');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? '응답이 늦어 요청을 종료했습니다. 다시 시도해주세요.' : '서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.', controller.signal.aborted ? 'timeout' : 'network');
  } finally { clearTimeout(timeout); }
}

async function createApiError(res: Response): Promise<Error> {
  let detail = '';
  try {
    const body = await res.json() as { detail?: string };
    detail = typeof body.detail === 'string' ? body.detail : '';
  } catch {
    // Status remains available when the response has no JSON body.
  }
  return new ApiError(detail || '요청을 처리하지 못했습니다. 다시 시도해주세요.', 'http', res.status);
}

async function post<T>(path: string, body: object): Promise<T> {
  return request<T>(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function get<T>(path: string): Promise<T> {
  return request<T>(`${BASE_URL}${path}`);
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

export function guidelinePdfUrl(page: number): string {
  return `${BASE_URL}/api/guideline/pdf#page=${page}`;
}
