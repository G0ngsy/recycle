import type { MarkResult } from '../../types';
import InfoBox from './InfoBox';

export default function MaterialAnalysis({ mark }: { mark: MarkResult | null }) {
  const prediction = mark?.materialPrediction;
  return (
    <>
      <InfoBox title="사진 재질 분석 · 실험 기능">
        {prediction?.status === 'ready' ? (
          <>
            <p className="text-sm text-slate-700">외관상 재질 후보: {prediction.candidates[0]?.label || '확인 필요'}</p>
            <details className="mt-2"><summary className="cursor-pointer min-h-11 text-sm font-medium text-slate-700">모델 점수 보기</summary><ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
              {prediction.candidates.map(candidate => (
                <li key={candidate.className}>{candidate.label} · 모델 점수 {candidate.score.toFixed(2)}</li>
              ))}
            </ul></details>
            <p className="mt-2 text-xs text-slate-500">모델 점수는 정답 확률이 아닙니다. 실제 촬영 환경의 정확도는 검증 중입니다.</p>
            {prediction.needsConfirmation && <p className="mt-2 text-sm font-medium text-amber-700">확인 필요: 품목과 재질 표시를 확인해주세요.</p>}
          </>
        ) : <p className="text-sm text-slate-600">{prediction?.reason === 'low_information'
          ? '사진에서 구분할 수 있는 정보가 부족합니다. 물체가 잘 보이도록 다시 촬영하거나 품목명을 직접 입력해주세요.'
          : '사진 재질 분석을 이용할 수 없습니다. 마크를 확인하거나 품목명을 직접 입력해주세요.'}</p>}
        {mark?.materialConflict && <p className="mt-2 text-sm font-medium text-amber-700">외관 분류와 마크의 재질이 다릅니다. 포장과 내용물 등 어떤 부분을 배출할지 확인해주세요.</p>}
      </InfoBox>
      <InfoBox title="분리배출 마크 분석">
        {mark?.ocrStatus === 'error' ? <p className="text-sm text-slate-600">마크를 읽지 못했습니다. 사진 재질 후보를 참고해 품목을 입력해주세요.</p> : (
          <>
            <p className="text-sm text-slate-700">{mark?.category ? `마크 분류: ${mark.category}${mark.material ? ` · ${mark.material}` : ''}` : '마크를 찾지 못했어요. 재질 표시를 가까이 촬영하거나 품목명을 직접 입력해주세요.'}</p>
            {!!mark?.texts?.length && <details className="mt-2"><summary className="cursor-pointer min-h-11 text-sm font-medium text-slate-700">인식된 문자 보기</summary><p className="text-sm text-slate-600 break-words">{mark.texts.join(', ')}</p></details>}
          </>
        )}
      </InfoBox>
    </>
  );
}
