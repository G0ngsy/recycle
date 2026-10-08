import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, CircleHelp, RotateCcw, Save, XCircle } from 'lucide-react';

import Button from '../components/ui/Button';
import InfoBox from '../components/ui/InfoBox';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { analyzeImage, getRecyclingGuide } from '../services/api';
import { addHistory, canonicalSido, normalizeResult } from '../services/storage';
import type { MarkResult, RecyclingResult, RegionSelection } from '../types';

type ResultState = {
  image?: string;
  searchText?: string;
  inputKind?: 'image' | 'text';
  region?: RegionSelection;
  cachedResult?: RecyclingResult;
};

const PAGE_LOADED_AT = Date.now();

function knownLegacyValue(value: string): string {
  return value && !['없음', '해당없음', '기타'].includes(value) ? value : '확인 필요';
}

function legacyTime(start: string, end: string): string {
  if (!start || !end || (start === '00:00' && end === '00:00')) return '확인 필요';
  return `${start} ~ ${end === '2400' ? '24:00' : end}`;
}

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => (location.state as ResultState | null) ?? {}, [location.state]);
  const [phase, setPhase] = useState<'analyzing' | 'confirm' | 'loading' | 'done' | 'error'>('analyzing');
  const [itemName, setItemName] = useState('');
  const [markResult, setMarkResult] = useState<MarkResult | null>(null);
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [isCachedView, setIsCachedView] = useState(Boolean(state.cachedResult));
  const ranRef = useRef(false);
  const inFlightRef = useRef(false);
  const resolvedItemRef = useRef('');
  const markResultRef = useRef<MarkResult | null>(null);

  const run = useCallback(async () => {
    if (inFlightRef.current || !state.region) return;
    inFlightRef.current = true;
    setIsCachedView(false);
    setResult(null);
    try {
      let name = resolvedItemRef.current || state.searchText || '';
      if (state.image && !resolvedItemRef.current) {
        setPhase('analyzing');
        const mark = await analyzeImage(state.image);
        markResultRef.current = mark;
        setMarkResult(mark);
        name = mark.category
          ? (mark.material ? `${mark.category} (${mark.material})` : mark.category)
          : (mark.texts?.[0] || '');
        setItemName(name);
        if (!mark.category) {
          setPhase('confirm');
          return;
        }
      }
      resolvedItemRef.current = name;
      setItemName(name);
      setPhase('loading');
      const guide = await getRecyclingGuide(
        name, state.region.sido, state.region.sigungu, state.region.managementId,
      );
      setResult(normalizeResult({
        ...guide,
        markResult: state.image ? markResultRef.current ?? undefined : guide.markResult,
      }));
      setPhase('done');
    } catch (error) {
      console.error('[Result] analysis error:', error);
      setPhase('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
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
      searchText: state.searchText,
      itemName,
      region: `${state.region.sido} ${state.region.sigungu}`,
      regionSelection: state.region,
      result,
      timestamp: Date.now(),
    });
    if (didSave) setSaved(true);
    else alert('브라우저 저장 공간이 부족해 기록을 저장하지 못했습니다.');
  };

  if (phase === 'analyzing') {
    return <LoadingSpinner message="라벨을 분석하고 있어요" subMessage="잠시만 기다려주세요..." />;
  }
  if (phase === 'loading') {
    return <LoadingSpinner message="분리수거 방법을 찾고 있어요" subMessage="잠시만 기다려주세요..." />;
  }
  if (phase === 'confirm') {
    return (
      <div className="flex flex-col gap-5 pt-4">
        <InfoBox variant="warning" title="라벨을 정확히 인식하지 못했어요">
          <p className="text-sm">품목명을 확인하거나 직접 입력한 뒤 안내를 계속해주세요.</p>
        </InfoBox>
        {(markResult?.texts?.length ?? 0) > 0 && (
          <p className="text-sm text-slate-500">인식된 문자: {markResult!.texts.join(', ')}</p>
        )}
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          품목명
          <input value={itemName} onChange={event => setItemName(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') handleConfirmItem(); }}
            maxLength={100} placeholder="예: 페트병, 종이컵"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-400" autoFocus />
        </label>
        <Button fullWidth disabled={!itemName.trim()} onClick={handleConfirmItem}>이 품목으로 확인</Button>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 pt-8">
        <XCircle size={48} className="text-red-400" />
        <p className="text-slate-700">분석 중 오류가 발생했어요.</p>
        <Button icon={<RotateCcw size={18} />} onClick={() => void run()}>다시 시도</Button>
        <Button variant="secondary" onClick={() => navigate('/region', { state: {
          image: state.image, searchText: state.searchText || itemName,
        } })}>지역 다시 선택</Button>
      </div>
    );
  }
  if (!result) return null;

  const wasteInfo = result.wasteInfo;
  const recordedAt = wasteInfo?.데이터기준일자;
  const dateMs = recordedAt ? new Date(`${recordedAt}T00:00:00`).getTime() : NaN;
  const isStale = wasteInfo?.오래된정보 || (Number.isFinite(dateMs) && PAGE_LOADED_AT - dateMs > 365 * 24 * 60 * 60 * 1000);
  const displayTime = wasteInfo?.배출시작시각 && wasteInfo.배출종료시각
    ? `${wasteInfo.배출시작시각} ~ ${wasteInfo.배출종료시각}` : '확인 필요';
  const isImageFlow = Boolean(state.image || state.inputKind === 'image' || result.markResult);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {isCachedView && (
        <InfoBox variant="warning">
          <p className="text-sm">저장된 당시의 결과입니다. 최신 배출 정보를 보려면 지역을 다시 선택해주세요.</p>
          <button type="button" className="mt-2 text-sm font-medium underline"
            onClick={() => navigate('/region', { state: { image: state.image, searchText: state.searchText || itemName } })}>
            현재 정보로 다시 확인
          </button>
        </InfoBox>
      )}

      {isImageFlow && (
        <InfoBox variant="default">
          <p className="mb-2 text-xs text-slate-400">라벨 분석 결과</p>
          {markResult ? (markResult.texts?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {markResult.texts.map((text, index) => (
                <span key={index} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{text}</span>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">인식된 텍스트가 없어요</p>)
            : <p className="text-sm text-slate-500">저장 당시의 라벨 분석 상세 정보가 없습니다.</p>}
          {markResult?.category && (
            <p className="mt-2 text-xs text-slate-400">
              분류: <span className="font-medium text-emerald-600">{markResult.category}</span>
              {markResult.material && <span className="ml-1">· {markResult.material}</span>}
            </p>
          )}
        </InfoBox>
      )}

      <InfoBox variant={result.guideStatus === 'unavailable' ? 'warning' : result.isRecyclable ? 'success' : 'error'}>
        <div className="flex items-center gap-3">
          {result.guideStatus === 'unavailable'
            ? <CircleHelp size={28} className="shrink-0 text-amber-600" />
            : result.isRecyclable
              ? <CheckCircle size={28} className="shrink-0 text-emerald-500" />
              : <XCircle size={28} className="shrink-0 text-red-400" />}
          <p className="text-lg font-semibold">
            {result.guideStatus === 'unavailable' ? '재활용 여부 확인 필요' : result.isRecyclable ? '재활용 가능해요' : '재활용 불가 품목이에요'}
          </p>
        </div>
        {result.guideStatus === 'unavailable' && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm">AI 안내를 확인하지 못했습니다. 아래 지역 배출 정보를 확인하거나 다시 시도해주세요.</p>
            <Button variant="secondary" icon={<RotateCcw size={18} />} onClick={() => void run()}>다시 시도</Button>
          </div>
        )}
      </InfoBox>

      {result.guideStatus === 'ready' && (
        <InfoBox title="배출 방법">
          <ol className="flex flex-col gap-2">
            {(result.disposalSteps ?? []).map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{index + 1}</span>
                <span className="text-sm text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </InfoBox>
      )}

      {result.guideStatus === 'ready' && (result.tips ?? []).length > 0 && (
        <InfoBox variant="warning" title="주의사항">
          <ul className="flex flex-col gap-1.5">
            {(result.tips ?? []).map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm"><span className="mt-1 shrink-0">•</span>{tip}</li>
            ))}
          </ul>
        </InfoBox>
      )}

      {wasteInfo && (
        <InfoBox variant="info" title={`${canonicalSido(wasteInfo.시도명)} ${wasteInfo.시군구명} 배출 정보`}>
          {wasteInfo.legacyRules ? (
            <div className="flex flex-col gap-3">
              {wasteInfo.legacyRules.map((rule, index) => (
                <div key={index} className="rounded-xl border border-blue-200 bg-white/60 p-3 text-sm">
                  <p>요일: {knownLegacyValue(rule.disposalDays)}</p>
                  <p>시간: {legacyTime(rule.startTime, rule.endTime)}</p>
                  <p>장소: {knownLegacyValue(rule.place)}</p>
                  <p>방법: {knownLegacyValue(rule.method)}</p>
                </div>
              ))}
              <p className="text-xs text-blue-700">저장 당시의 지역 정보입니다. 정확한 장소는 다시 선택해 확인해주세요.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {wasteInfo.관리구역대상지역명 && <li>관리구역: {wasteInfo.관리구역대상지역명}</li>}
              {wasteInfo.배출장소유형 && <li>수거 유형: {wasteInfo.배출장소유형}</li>}
              <li>📅 요일: {wasteInfo.배출요일 || '확인 필요'}</li>
              <li>⏰ 시간: {displayTime}</li>
              <li>📍 장소: {wasteInfo.배출장소 || '확인 필요'}</li>
              <li>배출방법: {wasteInfo.재활용품배출방법 || '확인 필요'}</li>
              <li>기준일자: {recordedAt || '미기록'}</li>
            </ul>
          )}
          {isStale && <p className="mt-3 text-sm font-medium text-amber-800">오래된 정보입니다. 배출 전에 해당 지자체의 최신 안내를 확인해주세요.</p>}
        </InfoBox>
      )}

      {result.guideStatus === 'ready' && (
        <InfoBox title="근거">
          <div className="flex items-start gap-2">
            <BookOpen size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-500">{result.source}</p>
          </div>
        </InfoBox>
      )}

      <div className="mt-2 flex gap-3">
        <Button variant="secondary" fullWidth icon={<RotateCcw size={18} />} onClick={() => navigate('/')}>다시 하기</Button>
        {!isCachedView && result.guideStatus === 'ready' && (
          <Button fullWidth disabled={saved} icon={<Save size={18} />} onClick={handleSave}>
            {saved ? '저장됨' : '갤러리 저장'}
          </Button>
        )}
      </div>
    </div>
  );
}
