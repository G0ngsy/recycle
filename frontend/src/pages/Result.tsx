import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, CircleHelp, BookOpen, RotateCcw, Save } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import InfoBox from '../components/ui/InfoBox';
import { addHistory, canonicalSido, normalizeResult } from '../services/storage';
import { analyzeImage, getRecyclingGuide } from '../services/api';
import { MarkResult, RecyclingResult, RegionSelection } from '../types';

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    image?: string;
    searchText?: string;
    region: RegionSelection;
    cachedResult?: RecyclingResult;
  };

  const [phase, setPhase] = useState<'analyzing' | 'loading' | 'done' | 'error'>('analyzing');
  const [itemName, setItemName] = useState('');
  const [markResult, setMarkResult] = useState<MarkResult | null>(null);
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [isCachedView, setIsCachedView] = useState(Boolean(state?.cachedResult));
  const ranRef = useRef(false);
  const inFlightRef = useRef(false);
  const resolvedItemRef = useRef('');
  const markResultRef = useRef<MarkResult | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!state?.region) { navigate('/'); return; }
    if (state.cachedResult) {
      setResult(normalizeResult(state.cachedResult));
      setItemName(state.cachedResult.itemName);
      setMarkResult(state.cachedResult.markResult ?? null);
      resolvedItemRef.current = state.cachedResult.itemName;
      markResultRef.current = state.cachedResult.markResult ?? null;
      setPhase('done');
      return;
    }
    void run();
  }, []);

  const run = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsCachedView(false);
    setResult(null);
    try {
      const { image, searchText, region } = state;

      let name = resolvedItemRef.current || searchText || '';
      if (image && !resolvedItemRef.current) {
        setPhase('analyzing');
        const mark = await analyzeImage(image);
        markResultRef.current = mark;
        setMarkResult(mark);
        name = mark.category
          ? (mark.material ? `${mark.category} (${mark.material})` : mark.category)
          : (mark.texts[0] || '알 수 없음');
      }
      resolvedItemRef.current = name;
      setItemName(name);

      setPhase('loading');
      const guide = await getRecyclingGuide(name, region.sido, region.sigungu, region.managementId);
      setResult(normalizeResult({ ...guide, markResult: image ? markResultRef.current ?? undefined : undefined }));
      setPhase('done');
    } catch (e) {
      console.error('[Result] run() 오류:', e);
      setPhase('error');
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSave = () => {
    if (!result || saved || isCachedView || result.guideStatus !== 'ready') return;
    addHistory({
      id: Date.now().toString(),
      image: state.image,
      searchText: state.searchText,
      itemName,
      region: `${state.region.sido} ${state.region.sigungu}`.trim(),
      regionSelection: state.region,
      result,
      timestamp: Date.now(),
    });
    setSaved(true);
  };

  if (phase === 'analyzing') {
    return <LoadingSpinner message="라벨을 분석하고 있어요" subMessage="잠시만 기다려주세요..." />;
  }

  if (phase === 'loading') {
    return <LoadingSpinner message="분리수거 방법을 찾고 있어요" subMessage="잠시만 기다려주세요..." />;
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 pt-8">
        <XCircle size={48} className="text-red-400" />
        <p className="text-slate-700">분석 중 오류가 발생했어요.</p>
        <Button icon={<RotateCcw size={18} />} onClick={() => void run()}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (!result) return null;

  const wasteInfo = result.wasteInfo;
  const recordedAt = wasteInfo?.데이터기준일자;
  const oldByDate = recordedAt && Number.isFinite(new Date(`${recordedAt}T00:00:00`).getTime())
    ? Math.floor((Date.now() - new Date(`${recordedAt}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000)) > 365
    : false;
  const isStale = wasteInfo?.오래된정보 || oldByDate;
  const displayTime = wasteInfo?.배출시작시각 && wasteInfo.배출종료시각
    ? `${wasteInfo.배출시작시각} ~ ${wasteInfo.배출종료시각}`
    : '확인 필요';

  return (
    <div className="flex flex-col gap-4 pb-4">
      {isCachedView && (
        <InfoBox variant="warning">
          <p className="text-sm">저장된 당시의 결과입니다. 최신 배출 정보를 보려면 지역을 다시 선택해주세요.</p>
          <button type="button" className="mt-2 text-sm font-medium underline" onClick={() => navigate('/region', { state: { image: state.image, searchText: state.searchText || itemName } })}>
            현재 정보로 다시 확인
          </button>
        </InfoBox>
      )}
      {/* 라벨 분석 결과 */}
      {state.image && <InfoBox variant="default">
        <p className="text-xs text-slate-400 mb-2">라벨 분석 결과</p>
        {markResult ? (markResult.texts?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {markResult.texts.map((t, i) => (
              <span key={i} className="bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">인식된 텍스트가 없어요</p>
        )) : <p className="text-slate-500 text-sm">저장 당시의 라벨 분석 상세 정보가 없습니다.</p>}
        {markResult?.category && (
          <p className="text-xs text-slate-400 mt-2">
            분류: <span className="text-emerald-600 font-medium">{markResult.category}</span>
            {markResult.material && <span className="ml-1">· {markResult.material}</span>}
          </p>
        )}
      </InfoBox>}

      {/* 재활용 여부 */}
      <InfoBox variant={result.guideStatus === 'unavailable' ? 'warning' : result.isRecyclable ? 'success' : 'error'}>
        <div className="flex items-center gap-3">
          {result.guideStatus === 'unavailable'
            ? <CircleHelp size={28} className="text-amber-600 shrink-0" />
            : result.isRecyclable
            ? <CheckCircle size={28} className="text-emerald-500 shrink-0" />
            : <XCircle size={28} className="text-red-400 shrink-0" />
          }
          <p className="font-semibold text-lg">
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

      {/* 배출 단계 */}
      {result.guideStatus === 'ready' && <InfoBox title="배출 방법">
        <ol className="flex flex-col gap-2">
          {(result.disposalSteps ?? []).map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-slate-700 text-sm">{step}</span>
            </li>
          ))}
        </ol>
      </InfoBox>}

      {/* 주의사항 */}
      {result.guideStatus === 'ready' && (result.tips ?? []).length > 0 && (
        <InfoBox variant="warning" title="주의사항">
          <ul className="flex flex-col gap-1.5">
            {(result.tips ?? []).map((tip, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="mt-1 shrink-0">•</span>{tip}
              </li>
            ))}
          </ul>
        </InfoBox>
      )}

      {/* 지역 배출 정보 */}
      {wasteInfo && (
        <InfoBox variant="info" title={`${canonicalSido(wasteInfo.시도명)} ${wasteInfo.시군구명} 배출 정보`}>
          <ul className="flex flex-col gap-1.5 text-sm">
            {wasteInfo.관리구역대상지역명 && <li>관리구역: {wasteInfo.관리구역대상지역명}</li>}
            {wasteInfo.배출장소유형 && <li>수거 유형: {wasteInfo.배출장소유형}</li>}
            <li>📅 요일: {wasteInfo.배출요일 || '확인 필요'}</li>
            <li>⏰ 시간: {displayTime}</li>
            <li>📍 장소: {wasteInfo.배출장소 || '확인 필요'}</li>
            <li>배출방법: {wasteInfo.재활용품배출방법 || '확인 필요'}</li>
            <li>기준일자: {recordedAt || '미기록'}</li>
          </ul>
          {isStale && <p className="mt-3 text-sm font-medium text-amber-800">오래된 정보입니다. 배출 전에 해당 지자체의 최신 안내를 확인해주세요.</p>}
        </InfoBox>
      )}

      {/* 근거 */}
      {result.guideStatus === 'ready' && <InfoBox title="근거">
        <div className="flex items-start gap-2">
          <BookOpen size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-slate-500 text-sm">{result.source}</p>
        </div>
      </InfoBox>}

      {/* 버튼 */}
      <div className="flex gap-3 mt-2">
        <Button variant="secondary" fullWidth icon={<RotateCcw size={18} />} onClick={() => navigate('/')}>
          다시 하기
        </Button>
        {!isCachedView && result.guideStatus === 'ready' && (
          <Button fullWidth disabled={saved} icon={<Save size={18} />} onClick={handleSave}>
            {saved ? '저장됨' : '갤러리 저장'}
          </Button>
        )}
      </div>
    </div>
  );
}
