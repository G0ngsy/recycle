import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, BookOpen, RotateCcw, Save } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import InfoBox from '../components/ui/InfoBox';
import { addHistory } from '../services/storage';
import { analyzeImage, getRecyclingGuide } from '../services/api';
import { RecyclingResult } from '../types';

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => (
    (location.state as {
      image?: string;
      searchText?: string;
      region?: { sido: string; sigungu: string; managementArea?: string };
      cachedResult?: RecyclingResult;
    } | null) ?? {}
  ), [location.state]);

  const [phase, setPhase] = useState<'analyzing' | 'confirm' | 'loading' | 'done' | 'error'>('analyzing');
  const [itemName, setItemName] = useState('');
  const [markCategory, setMarkCategory] = useState<string | null>(null);
  const [markMaterial, setMarkMaterial] = useState<string | null>(null);
  const [markTexts, setMarkTexts] = useState<string[]>([]);
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [saved, setSaved] = useState(false);
  const ranRef = useRef(false);

  const requestGuide = useCallback(async (name: string) => {
    if (!state.region) throw new Error('지역 정보가 없습니다.');
    setPhase('loading');
    const guide = await getRecyclingGuide(
      name,
      state.region.sido,
      state.region.sigungu,
      state.region.managementArea,
    );
    setResult(guide);
    setPhase('done');
  }, [state.region]);

  const run = useCallback(async () => {
    try {
      const { image, searchText } = state;

      let name = searchText || '';
      if (image) {
        setPhase('analyzing');
        const mark = await analyzeImage(image);
        setMarkCategory(mark.category);
        setMarkMaterial(mark.material);
        setMarkTexts(mark.texts ?? []);
        name = mark.category
          ? (mark.material ? `${mark.category} (${mark.material})` : mark.category)
          : (mark.texts[0] || '');
        setItemName(name);
        if (!mark.category) {
          setPhase('confirm');
          return;
        }
      }
      setItemName(name);
      await requestGuide(name);
    } catch (e) {
      console.error('[Result] run() 오류:', e);
      setPhase('error');
    }
  }, [requestGuide, state]);

  const handleConfirmItem = async () => {
    const name = itemName.trim();
    if (!name) return;
    try {
      await requestGuide(name);
    } catch (error) {
      console.error('[Result] guide request error:', error);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!state?.region || (!state.image && !state.searchText && !state.cachedResult)) {
      navigate('/', { replace: true });
      return;
    }
    if (state.cachedResult) {
      setResult(state.cachedResult);
      setItemName(state.cachedResult.itemName);
      setPhase('done');
      return;
    }
    void run();
  }, [navigate, run, state]);

  const handleSave = () => {
    if (!result || saved || !state.region) return;
    const didSave = addHistory({
      id: Date.now().toString(),
      image: state.image,
      searchText: state.searchText,
      itemName,
      region: [state.region.sido, state.region.sigungu, state.region.managementArea].filter(Boolean).join(' '),
      regionInfo: state.region,
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
        {markTexts.length > 0 && (
          <p className="text-sm text-slate-500">인식된 문자: {markTexts.join(', ')}</p>
        )}
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          품목명
          <input
            value={itemName}
            onChange={event => setItemName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && void handleConfirmItem()}
            maxLength={100}
            placeholder="예: 페트병, 종이컵"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-400"
            autoFocus
          />
        </label>
        <Button fullWidth disabled={!itemName.trim()} onClick={() => void handleConfirmItem()}>
          이 품목으로 확인
        </Button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 pt-8">
        <XCircle size={48} className="text-red-400" />
        <p className="text-slate-700">분석 중 오류가 발생했어요.</p>
        <Button icon={<RotateCcw size={18} />} onClick={() => navigate(-1)}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* 라벨 분석 결과 */}
      <InfoBox variant="default">
        <p className="text-xs text-slate-400 mb-2">라벨 분석 결과</p>
        {markTexts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {markTexts.map((t, i) => (
              <span key={i} className="bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">인식된 텍스트가 없어요</p>
        )}
        {markCategory && (
          <p className="text-xs text-slate-400 mt-2">
            분류: <span className="text-emerald-600 font-medium">{markCategory}</span>
            {markMaterial && <span className="ml-1">· {markMaterial}</span>}
          </p>
        )}
      </InfoBox>

      {/* 재활용 여부 */}
      <InfoBox variant={result.isRecyclable ? 'success' : 'error'}>
        <div className="flex items-center gap-3">
          {result.isRecyclable
            ? <CheckCircle size={28} className="text-emerald-500 shrink-0" />
            : <XCircle size={28} className="text-red-400 shrink-0" />
          }
          <p className="font-semibold text-lg">
            {result.isRecyclable ? '재활용 가능해요' : '재활용 불가 품목이에요'}
          </p>
        </div>
      </InfoBox>

      {/* 배출 단계 */}
      <InfoBox title="배출 방법">
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
      </InfoBox>

      {/* 주의사항 */}
      {(result.tips ?? []).length > 0 && (
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
      {result.wasteInfo && (
        <InfoBox
          variant="info"
          title={`${result.wasteInfo.sido} ${result.wasteInfo.sigungu} ${result.wasteInfo.managementArea ?? ''} 배출 정보`.replace(/\s+/g, ' ').trim()}
        >
          <div className="flex flex-col gap-3">
            {result.wasteInfo.rules.map((rule, index) => (
              <div key={`${rule.disposalDays}-${rule.startTime}-${rule.endTime}-${rule.place}-${index}`} className="rounded-xl border border-blue-200 bg-white/60 p-3">
                {result.wasteInfo!.rules.length > 1 && <p className="mb-1 text-xs font-semibold text-blue-700">배출 규칙 {index + 1}</p>}
                <ul className="flex flex-col gap-1 text-sm">
                  <li>📅 요일: {rule.disposalDays || '정보 없음'}</li>
                  <li>⏰ 시간: {rule.startTime || '정보 없음'} ~ {rule.endTime || '정보 없음'}</li>
                  <li>📍 장소: {rule.place || '정보 없음'}</li>
                  <li>♻️ 방법: {rule.method || '정보 없음'}</li>
                </ul>
              </div>
            ))}
            {result.wasteInfo.rules.length > 1 && (
              <p className="text-xs text-blue-700">세부 주소에 따라 배출 규칙이 다를 수 있으니 관리기관 안내도 확인해주세요.</p>
            )}
          </div>
        </InfoBox>
      )}

      {/* 근거 */}
      <InfoBox title="근거">
        <div className="flex items-start gap-2">
          <BookOpen size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-slate-500 text-sm">{result.source}</p>
        </div>
      </InfoBox>

      {/* 버튼 */}
      <div className="flex gap-3 mt-2">
        <Button variant="secondary" fullWidth icon={<RotateCcw size={18} />} onClick={() => navigate('/')}>
          다시 하기
        </Button>
        <Button fullWidth disabled={saved} icon={<Save size={18} />} onClick={handleSave}>
          {saved ? '저장됨' : '갤러리 저장'}
        </Button>
      </div>
    </div>
  );
}
