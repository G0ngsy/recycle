import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, BookOpen, RotateCcw, Save } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import InfoBox from '../components/ui/InfoBox';
import { addHistory } from '../services/storage';
import { analyzeImage, getRecyclingGuide } from '../services/api';
import { RecyclingResult, WasteInfo } from '../types';

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    image?: string;
    searchText?: string;
    region: { sido: string; sigungu: string };
  };

  const [phase, setPhase] = useState<'analyzing' | 'loading' | 'done' | 'error'>('analyzing');
  const [itemName, setItemName] = useState('');
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [wasteInfo, setWasteInfo] = useState<WasteInfo | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!state?.region) { navigate('/'); return; }
    run();
  }, []);

  const run = async () => {
    try {
      const { image, searchText, region } = state;

      // 이미지면 품목 추정 (백엔드 OpenCV + EXAONE)
      let name = searchText || '';
      if (image) {
        setPhase('analyzing');
        name = await analyzeImage(image);
      }
      setItemName(name);

      // 분리수거 가이드 조회 (백엔드 EXAONE + 지역 JSON)
      setPhase('loading');
      const guide = await getRecyclingGuide(name, region.sido, region.sigungu);
      setResult(guide);

      // 지역 배출정보는 백엔드 응답에서 추출
      if (guide.wasteInfo) {
        setWasteInfo(guide.wasteInfo as unknown as WasteInfo);
      }

      setPhase('done');
    } catch {
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
    return <LoadingSpinner message="이미지를 분석하여 품목을 추정하고 있어요" subMessage="잠시만 기다려주세요..." />;
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
      {/* 품목 */}
      <InfoBox variant="default">
        <p className="text-xs text-slate-400 mb-1">추정 품목</p>
        <p className="text-2xl font-bold text-slate-800">{result.itemName}</p>
        <p className="text-sm text-slate-500 mt-1">{result.category}</p>
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
          {result.disposalSteps.map((step, i) => (
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
      {result.tips.length > 0 && (
        <InfoBox variant="warning" title="주의사항">
          <ul className="flex flex-col gap-1.5">
            {result.tips.map((tip, i) => (
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
