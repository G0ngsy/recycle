import { useEffect, useRef, useState } from 'react';
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
  const state = location.state as {
    image?: string;
    searchText?: string;
    region: { sido: string; sigungu: string };
    cachedResult?: RecyclingResult;
  };

  const [phase, setPhase] = useState<'analyzing' | 'loading' | 'done' | 'error'>('analyzing');
  const [itemName, setItemName] = useState('');
  const [markCategory, setMarkCategory] = useState<string | null>(null);
  const [markMaterial, setMarkMaterial] = useState<string | null>(null);
  const [markTexts, setMarkTexts] = useState<string[]>([]);
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [saved, setSaved] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!state?.region) { navigate('/'); return; }
    if (state.cachedResult) {
      setResult(state.cachedResult);
      setItemName(state.cachedResult.itemName);
      setPhase('done');
      return;
    }
    run();
  }, []);

  const run = async () => {
    try {
      const { image, searchText, region } = state;

      let name = searchText || '';
      if (image) {
        setPhase('analyzing');
        const mark = await analyzeImage(image);
        setMarkCategory(mark.category);
        setMarkMaterial(mark.material);
        setMarkTexts(mark.texts ?? []);
        name = mark.category
          ? (mark.material ? `${mark.category} (${mark.material})` : mark.category)
          : (mark.texts[0] || '알 수 없음');
      }
      setItemName(name);

      setPhase('loading');
      const guide = await getRecyclingGuide(name, region.sido, region.sigungu);
      setResult(guide);
      setPhase('done');
    } catch (e) {
      console.error('[Result] run() 오류:', e);
      setPhase('error');
    }
  };

  const handleSave = () => {
    if (!result || saved) return;
    addHistory({
      id: Date.now().toString(),
      image: state.image,
      searchText: state.searchText,
      itemName,
      region: `${state.region.sido} ${state.region.sigungu}`.trim(),
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
        <InfoBox variant="info" title={`${result.wasteInfo.시도명} ${result.wasteInfo.시군구명} 배출 정보`}>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li>📅 요일: {result.wasteInfo.배출요일}</li>
            <li>⏰ 시간: {result.wasteInfo.배출시작시각} ~ {result.wasteInfo.배출종료시각}</li>
            <li>📍 장소: {result.wasteInfo.배출장소}</li>
          </ul>
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
