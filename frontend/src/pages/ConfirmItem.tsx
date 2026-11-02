import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import MaterialAnalysis from '../components/ui/MaterialAnalysis';
import { analyzePhotoOnce, photoItemDraft, rememberPhotoItem } from '../services/analysis';
import type { MarkResult, ScanState } from '../types';
import { useSavedRegion } from '../services/useSavedRegion';
import { guideDestination } from '../services/region';

export default function ConfirmItem() {
  const navigate = useNavigate();
  const savedRegion = useSavedRegion();
  const location = useLocation();
  const state = useMemo(() => (location.state as ScanState | null) ?? {}, [location.state]);
  const [mark, setMark] = useState<MarkResult | null>(state.markResult ?? null);
  const [itemName, setItemName] = useState(state.searchText ?? '');
  const [busy, setBusy] = useState(!state.analysisComplete);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!state.image) { navigate('/scan', { replace: true }); return; }
    if (state.analysisComplete && attempt === 0) {
      setItemName(photoItemDraft(state.image) ?? state.searchText ?? '');
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    setError('');
    analyzePhotoOnce(state.image).then(result => {
      if (!active) return;
      setMark(result);
      setAttempt(0);
      const name = photoItemDraft(state.image!) ?? state.searchText ?? (result.category
        ? `${result.category}${result.material ? ` (${result.material})` : ''}` : '');
      setItemName(name);
      navigate('/confirm', { replace: true, state: { ...state, markResult: result, analysisComplete: true, searchText: name } });
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : '사진을 분석하지 못했습니다.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [state, navigate, attempt]);

  useEffect(() => { if (!busy) heading.current?.focus({ preventScroll: true }); }, [busy]);
  const next = useCallback(() => {
    const name = itemName.trim();
    if (!name || busy) return;
    if (state.image) rememberPhotoItem(state.image, name);
    const destination = guideDestination({ ...state, searchText: name, markResult: mark, inputKind: 'image', itemConfirmed: true, analysisComplete: true }, savedRegion);
    navigate(destination.pathname, { state: destination.state });
  }, [itemName, busy, state, mark, navigate, savedRegion]);

  if (busy) return <LoadingSpinner message="사진과 마크를 분석하고 있어요" subMessage="분석 후 배출할 품목을 확인해주세요." />;
  return <div className="flex flex-col gap-5">
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-800 focus:outline-none">배출할 품목을 확인해주세요</h1>
    <p className="leading-7 text-slate-600">재질 후보를 참고해 품목명을 입력해주세요. 오염이나 코팅 여부는 직접 확인해야 합니다.</p>
    {state.image && <img src={state.image} alt="분석한 물체" className="max-h-48 w-full rounded-xl object-contain" />}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
      <p>{error}</p><p className="mt-2">품목명을 직접 입력해서 계속 진행할 수 있습니다.</p>
      <Button variant="secondary" className="mt-3" onClick={() => setAttempt(value => value + 1)}>분석 다시 시도</Button>
    </div>}
    <MaterialAnalysis mark={mark} />
    <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); next(); }}>
      <label className="flex flex-col gap-2 font-medium text-slate-700">품목명
        <input maxLength={100} value={itemName} onChange={event => setItemName(event.target.value)} placeholder="예: 페트병, 종이컵" className="rounded-xl border border-slate-300 px-4 py-3 focus:border-emerald-500" />
      </label>
      <Button type="submit" fullWidth disabled={!itemName.trim()}>{savedRegion ? '배출 안내 보기' : '지역 선택하기'}</Button>
    </form>
    <Button variant="secondary" fullWidth onClick={() => navigate('/scan')}>다시 촬영하기</Button>
  </div>;
}
