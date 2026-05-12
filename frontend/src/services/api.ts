import { RecyclingResult } from '../types';

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

// 이미지 → 품목 추정
export async function analyzeImage(image: string): Promise<string> {
  const data = await post<{ itemName: string }>('/api/analyze-image', { image });
  return data.itemName;
}

// 품목 + 지역 → 분리수거 가이드
export async function getRecyclingGuide(
  itemName: string,
  sido: string,
  sigungu: string
): Promise<RecyclingResult> {
  return post<RecyclingResult>('/api/recycling-guide', { itemName, sido, sigungu });
}
