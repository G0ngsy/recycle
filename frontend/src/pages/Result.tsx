import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Save, XCircle } from 'lucide-react';

import Button from '../components/ui/Button';
import InfoBox from '../components/ui/InfoBox';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import MaterialAnalysis from '../components/ui/MaterialAnalysis';
import GuideContent from '../components/ui/GuideContent';
import { regionLabel, savedDate } from '../services/display';
import { ApiError, getRecyclingGuide } from '../services/api';
import { addHistory, normalizeResult } from '../services/storage';
import type { MarkResult, RecyclingResult, RegionSelection } from '../types';

type ResultState = {
  image?: string;
  searchText?: string;
  inputKind?: 'image' | 'text';
  region?: RegionSelection;
  cachedResult?: RecyclingResult;
  savedAt?: number;
  markResult?: MarkResult | null;
  itemConfirmed?: boolean;
  analysisComplete?: boolean;
};

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => (location.state as ResultState | null) ?? {}, [location.state]);
  const [phase, setPhase] = useState<'analyzing' | 'confirm' | 'loading' | 'done' | 'error'>('analyzing');
  const [itemName, setItemName] = useState('');
  const [markResult, setMarkResult] = useState<MarkResult | null>(state.markResult ?? null);
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [errorKind, setErrorKind] = useState<'image' | 'guide' | 'network'>('guide');
  const [notice, setNotice] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCachedView, setIsCachedView] = useState(Boolean(state.cachedResult));
  const ranRef = useRef(false);
  const inFlightRef = useRef(false);
  const resolvedItemRef = useRef(state.itemConfirmed ? state.searchText ?? '' : '');
  const markResultRef = useRef<MarkResult | null>(state.markResult ?? null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (phase === 'done' || phase === 'error' || phase === 'confirm') {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [phase]);

  const run = useCallback(async () => {
    if (inFlightRef.current || !state.region) return;
    inFlightRef.current = true;
    setIsCachedView(false);
    setResult(null);
    setSaved(false);
    setNotice('');
    try {
      const name = resolvedItemRef.current || state.searchText || '';
      resolvedItemRef.current = name;
      setItemName(name);
      setPhase('loading');
      const guide = await getRecyclingGuide(
        name, state.region.sido, state.region.sigungu, state.region.managementId,
      );
      setResult(normalizeResult({
        ...guide,
        markResult: markResultRef.current ?? guide.markResult,
      }));
      setPhase('done');
    } catch (error) {
      setErrorKind(error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout') ? 'network' : 'guide');
      setErrorText(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
      setPhase('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (state.image && !state.itemConfirmed && !state.cachedResult) {
      navigate('/confirm', { replace: true, state });
      return;
    }
    if (!state.region || (!state.image && !state.searchText && !state.cachedResult)) {
      navigate('/', { replace: true });
      return;
    }
    if (state.cachedResult) {
      const cached = normalizeResult(state.cachedResult);
      setResult(cached);
      setItemName(cached.itemName);
      setMarkResult(cached.markResult ?? null);
      resolvedItemRef.current = cached.itemName;
      markResultRef.current = cached.markResult ?? null;
      setPhase('done');
      return;
    }
    void run();
  }, [navigate, run, state]);

  const handleConfirmItem = () => {
    const name = itemName.trim();
    if (!name) return;
    resolvedItemRef.current = name;
    void run();
  };

  const handleSave = () => {
    if (!result || saved || isCachedView || result.guideStatus !== 'ready' || !state.region) return;
    const didSave = addHistory({
      id: Date.now().toString(),
      image: state.image,
      inputKind: state.inputKind ?? (state.image ? 'image' : 'text'),
      searchText: itemName,
      itemName,
      region: `${state.region.sido} ${state.region.sigungu}`,
      regionSelection: state.region,
      result,
      timestamp: Date.now(),
    });
    if (didSave) setSaved(true);
    else setNotice('브라우저 저장 공간이 부족해 기록을 저장하지 못했습니다.');
  };

  const latestRegion = () => navigate('/region', { state: { image: state.image, searchText: itemName, markResult, itemConfirmed: true, analysisComplete: true, inputKind: state.inputKind ?? (state.image ? 'image' : 'text') } });
  const editItem = () => { setItemName(resolvedItemRef.current || itemName); setIsEditing(true); setPhase('confirm'); };

  if (phase === 'analyzing' || phase === 'loading') {
    return <LoadingSpinner message={phase === 'analyzing' ? '사진과 마크를 분석하고 있어요' : '분리수거 방법을 찾고 있어요'} subMessage="잠시만 기다려주세요…" />;
  }
  if (phase === 'confirm') {
    return <div className="flex flex-col gap-5 pt-4">
      <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-20 text-2xl font-bold text-slate-800 focus:outline-none">{isEditing ? '품목명 수정' : '배출할 품목을 확인해주세요'}</h1>
      <p className="text-slate-600 leading-7">재질 후보를 참고해 실제 배출할 품목을 입력해주세요. 오염이나 코팅 여부는 직접 확인해야 합니다.</p>
      {state.image && <img src={state.image} alt="분석한 물체" className="max-h-48 w-full rounded-xl object-contain" />}
      {(state.image || markResult) && <MaterialAnalysis mark={markResult} />}
      <label className="flex flex-col gap-2 font-medium text-slate-700">품목명
        <input value={itemName} onChange={event => setItemName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') handleConfirmItem(); }}
          maxLength={100} placeholder="예: 페트병, 종이컵" className="rounded-xl border border-slate-300 px-4 py-3 focus:border-emerald-500" />
      </label>
      <Button fullWidth disabled={!itemName.trim()} onClick={handleConfirmItem}>이 품목으로 확인</Button>
      {isEditing && result && <Button variant="secondary" fullWidth onClick={() => { setItemName(result.itemName); setPhase('done'); }}>수정 취소</Button>}
      {state.image && <Button variant="secondary" fullWidth onClick={() => navigate('/scan')}>다시 촬영하기</Button>}
    </div>;
  }
  if (phase === 'error') {
    return <div className="flex flex-col gap-4 pt-6">
      <XCircle size={40} className="text-red-500" />
      <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-20 text-xl font-bold text-slate-800 focus:outline-none">{errorKind === 'network' ? '서버 연결을 확인해주세요' : errorKind === 'image' ? '사진을 분석하지 못했어요' : '배출 안내를 가져오지 못했어요'}</h1>
      <p role="alert" className="text-slate-600 leading-7">{errorText}</p>
      <Button fullWidth onClick={() => void run()}>다시 시도</Button>
      {state.image && <Button variant="secondary" fullWidth onClick={() => navigate('/scan')}>다시 촬영하기</Button>}
      <Button variant="secondary" fullWidth onClick={() => navigate('/search')}>품목명 직접 입력</Button>
      <Button variant="ghost" fullWidth onClick={() => navigate('/region', { state: { image: state.image, searchText: itemName || state.searchText, markResult, itemConfirmed: true, analysisComplete: true } })}>지역 다시 선택</Button>
    </div>;
  }
  if (!result) return null;
  const info = result.wasteInfo;
  const region = info ? regionLabel(info.시도명, info.시군구명, info.관리구역대상지역명) : state.region ? regionLabel(state.region.sido, state.region.sigungu) : '';
  const imageFlow = Boolean(state.image || state.inputKind === 'image' || markResult);

  return <div className="flex flex-col gap-4 pb-6">
    <header className="pt-3">
      <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-20 text-2xl font-bold text-slate-800 break-words focus:outline-none">{itemName} 배출 안내</h1>
      <p className="mt-2 text-sm text-slate-600 leading-6 break-words">{region}</p>
      {imageFlow && <p className="mt-2 text-sm text-slate-700">{markResult?.materialPrediction?.status === 'ready'
        ? `사진 재질 후보: ${markResult.materialPrediction.candidates[0]?.label || '확인 필요'} · 실험 기능`
        : '사진 분류 확인 필요 · 실험 기능'}</p>}
      <Button variant="ghost" className="mt-1 !px-0 text-emerald-800" onClick={editItem}>품목 수정</Button>
    </header>
    {isCachedView && <InfoBox variant="warning">
      <p className="font-medium">저장 당시의 안내입니다.</p>
      <p className="mt-1 text-sm">{savedDate(state.savedAt)}</p>
      <Button variant="secondary" fullWidth className="mt-3" onClick={latestRegion}>최신 정보 다시 확인</Button>
    </InfoBox>}
    <InfoBox variant={result.guideStatus === 'unavailable' ? 'warning' : 'info'} title="AI 참고 안내">
      <p className="font-semibold text-slate-800">{result.guideStatus === 'unavailable' ? '재활용 여부 확인 필요' : result.isRecyclable ? '재활용 가능으로 안내됐어요' : '재활용 불가로 안내됐어요'}</p>
      <p className="mt-2 text-sm text-slate-600 leading-6">품목의 실제 재질·오염 상태와 해당 지역의 배출 규칙을 확인해주세요.</p>
      {result.guideStatus === 'unavailable' && <><p className="mt-2 text-sm">AI 안내 생성에 실패했습니다. 아래 {result.guidelineReferences?.length ? '공식 근거와 ' : ''}지역 정보는 확인할 수 있습니다.</p>
        <Button variant="secondary" fullWidth className="mt-3" onClick={() => void run()}>안내 다시 요청</Button></>}
    </InfoBox>
    <GuideContent result={result} />
    {imageFlow && <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer min-h-11 font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2">사진 분석 상세 보기 · 실험 기능</summary>
      <div className="mt-3 space-y-3"><MaterialAnalysis mark={markResult} /></div>
    </details>}
    {notice && <p role="alert" className="text-sm text-red-700">{notice}</p>}
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" fullWidth onClick={() => navigate('/')}>다른 품목 확인</Button>
      {!isCachedView && result.guideStatus === 'ready' && <Button fullWidth disabled={saved} icon={<Save size={18} />} onClick={handleSave}>{saved ? '저장됨' : '갤러리 저장'}</Button>}
    </div>
  </div>;
}
