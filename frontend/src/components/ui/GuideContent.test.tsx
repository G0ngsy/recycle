import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RecyclingResult } from '../../types';
import GuideContent from './GuideContent';

const result: RecyclingResult = { itemName: '유리병', category: '유리', guideStatus: 'ready', isRecyclable: true,
  disposalSteps: ['비우고 헹구세요'], tips: ['깨지지 않게 배출하세요'], source: 'AI 생성 안내',
  wasteInfo: { 관리번호: '1', 시도명: '세종특별자치시', 시군구명: '없음', 관리구역명: null, 관리구역대상지역명: '전의면', 배출장소유형: null,
    배출장소: '집앞', 재활용품배출방법: '투명봉투', 배출요일: '일+월', 배출시작시각: '20:00', 배출종료시각: '08:00', 데이터기준일자: '2026-05-21', 오래된정보: false },
  guidelineReferences: [{ page: 9, title: '유리병', excerpt: '공식 원문 내용' }],
};

describe('readable guide', () => {
  it('can open legacy records without optional step and tip arrays', () => {
    const legacy = { ...result, disposalSteps: undefined, tips: undefined } as unknown as RecyclingResult;
    expect(renderToStaticMarkup(<GuideContent result={legacy} />)).toContain('배출 단계가 제공되지 않았습니다');
  });
  it('puts region schedules before long official excerpts and preserves dates', () => {
    const html = renderToStaticMarkup(<GuideContent result={result} />);
    expect(html.indexOf('우리 지역 배출 정보')).toBeLessThan(html.indexOf('공식 원문 내용'));
    expect(html).toContain('다음 날');
    expect(html).not.toContain('세종특별자치시 없음');
    expect(html).toContain('2026-05-21');
    expect(html).toContain('2018년');
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
  });
  it('keeps schedules and official sources when AI is unavailable', () => {
    const html = renderToStaticMarkup(<GuideContent result={{ ...result, guideStatus: 'unavailable', isRecyclable: null }} />);
    expect(html).toContain('우리 지역 배출 정보');
    expect(html).toContain('원문 9쪽 열기');
    expect(html).not.toContain('비우고 헹구세요');
  });
});
