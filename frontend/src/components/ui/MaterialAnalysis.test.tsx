import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MarkResult } from '../../types';
import MaterialAnalysis from './MaterialAnalysis';

describe('MaterialAnalysis', () => {
  it('asks for a new photo instead of showing a candidate for a blank frame', () => {
    const html = renderToStaticMarkup(<MaterialAnalysis mark={{ category: null, material: null, texts: [],
      materialPrediction: { status: 'unavailable', reason: 'low_information', candidates: [], needsConfirmation: true },
    }} />);
    expect(html).toContain('물체가 잘 보이도록 다시 촬영');
    expect(html).not.toContain('외관상 재질 후보');
  });
  it('renders legacy saved OCR results without a model result', () => {
    const html = renderToStaticMarkup(<MaterialAnalysis mark={{ category: '페트', material: 'PET', texts: ['PET'] }} />);
    expect(html).toContain('PET');
    expect(html).toContain('품목명을 직접 입력');
  });

  it('separates scores from probability and warns about conflicting materials', () => {
    const mark: MarkResult = {
      category: '페트', material: 'PET', texts: ['PET'], materialConflict: true,
      materialPrediction: {
        status: 'ready', candidates: [{ className: 'glass', label: '유리', score: 0.93 }], needsConfirmation: true,
      },
    };
    const html = renderToStaticMarkup(<MaterialAnalysis mark={mark} />);
    expect(html).toContain('유리');
    expect(html).toContain('모델 점수 0.93');
    expect(html).toContain('정답 확률이 아닙니다');
    expect(html).toContain('마크의 재질이 다릅니다');
  });

  it('preserves the material candidate when OCR fails', () => {
    const html = renderToStaticMarkup(<MaterialAnalysis mark={{
      category: null, material: null, texts: [], ocrStatus: 'error',
      materialPrediction: { status: 'ready', candidates: [{ className: 'paper', label: '종이', score: 0.8 }], needsConfirmation: false },
    }} />);
    expect(html).toContain('종이');
    expect(html).toContain('마크를 읽지 못했습니다');
  });
});
