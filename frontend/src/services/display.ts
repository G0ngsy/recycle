import { canonicalSido } from './storage';

export function knownText(value?: string | null): string {
  const text = value?.trim() ?? '';
  return ['', '없음', '해당없음', '기타'].includes(text) ? '' : text;
}

export function regionLabel(sido: string, sigungu: string, area?: string | null): string {
  return [canonicalSido(sido), knownText(sigungu), knownText(area)].filter(Boolean).join(' · ');
}

export function disposalTime(start?: string | null, end?: string | null): string {
  if (!knownText(start) || !knownText(end) || (start === '00:00' && end === '00:00')) return '확인 필요';
  const finish = end === '2400' ? '24:00' : end!;
  const clock = (value: string) => /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
  return `${start} ~ ${clock(finish) < clock(start!) ? '다음 날 ' : ''}${finish}`;
}

export function savedDate(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) return '저장 날짜 미기록';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

export function stepText(value: string): string {
  return value.replace(/^\s*(?:\d{1,2}[.)]\s+|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/u, '').trim();
}
