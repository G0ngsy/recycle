import { describe, expect, it } from 'vitest';
import { disposalTime, regionLabel, savedDate, stepText } from './display';

describe('display public records', () => {
  it('removes duplicate step numbers while preserving quantities', () => {
    expect(stepText('1. 내용물을 비우세요')).toBe('내용물을 비우세요');
    expect(stepText('① 헹구세요')).toBe('헹구세요');
    expect(stepText('1.5L 용기는 비워주세요')).toBe('1.5L 용기는 비워주세요');
  });
  it('keeps an absent district out of the visible region', () => {
    expect(regionLabel('세종특별자치시', '없음', '전의면')).toBe('세종특별자치시 · 전의면');
  });
  it('marks overnight schedules without changing daytime ones', () => {
    expect(disposalTime('20:00', '08:00')).toBe('20:00 ~ 다음 날 08:00');
    expect(disposalTime('08:00', '20:00')).toBe('08:00 ~ 20:00');
    expect(disposalTime('20:00', '2400')).toBe('20:00 ~ 24:00');
    expect(disposalTime('00:00', '00:00')).toBe('확인 필요');
  });
  it('does not invent a missing saved date', () => {
    expect(savedDate()).toBe('저장 날짜 미기록');
  });
});
