import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Camera, Keyboard, MapPin } from 'lucide-react';
import SelectCard from '../components/ui/SelectCard';
import { useSavedRegion } from '../services/useSavedRegion';
import { knownText, regionLabel } from '../services/display';

const mascots = [
  { name: '페트병', src: '/mascots/pet.png', pose: '/mascots/pet-pose.png', motion: 'hop' },
  { name: '캔', src: '/mascots/can.png', pose: '/mascots/can-pose.png', motion: 'rock' },
  { name: '종이', src: '/mascots/paper.png', pose: '/mascots/paper-pose.png', motion: 'step' },
  { name: '유리', src: '/mascots/glass.png', pose: '/mascots/glass-pose.png', motion: 'float' },
  { name: '비닐', src: '/mascots/vinyl.png', pose: '/mascots/vinyl-pose.png', motion: 'wiggle' },
];

export default function Home() {
  const navigate = useNavigate();
  const savedRegion = useSavedRegion();
  if (!savedRegion) return <Navigate to="/region" replace state={{ regionMode: 'setup' }} />;
  const { selection, record } = savedRegion;

  return (
    <div className="flex flex-col gap-6">
    <section aria-label="저장된 배출 지역" className="rounded-2xl border border-emerald-200 bg-white/95 p-4 flex items-start gap-3">
      <MapPin size={22} className="mt-1 shrink-0 text-emerald-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-600">내 배출 지역</p>
        <p className="mt-1 font-semibold text-slate-800 break-words">{regionLabel(selection.sido, selection.sigungu, knownText(record.관리구역대상지역명) || knownText(record.관리구역명)).replaceAll('+', ' · ')}</p>
        <p className="mt-1 text-sm text-slate-600 break-words">{[record.배출장소유형, record.배출장소].map(knownText).filter(Boolean).join(' · ') || '선택한 지역 기준으로 안내합니다.'}</p>
      </div>
      <button type="button" onClick={() => navigate('/region', { state: { regionMode: 'edit' } })} className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-emerald-800 focus-visible:outline focus-visible:outline-2">지역 변경</button>
    </section>
    <div className="home-layout">
      <div className="home-intro text-center">
        <h1 className="text-2xl font-bold text-slate-800">어떤 방식으로<br />확인할까요?</h1>
        <p className="text-slate-500 text-sm mt-2">분리수거 방법을 AI가 알려드려요</p>
      </div>

      <div className="home-actions flex flex-col gap-4 w-full">
        <SelectCard
          icon={<Camera size={28} />}
          title="사진으로 확인"
          description={'사진을 찍거나 업로드해서\n분리수거 방법을 알려드려요'}
          accent="emerald"
          onClick={() => navigate('/scan')}
        />
        <SelectCard
          icon={<Keyboard size={28} />}
          title="품목명으로 검색"
          description={'품목 이름을 입력해서\n분리수거 방법을 확인해요'}
          accent="blue"
          onClick={() => navigate('/search')}
        />
      </div>
      <div className="home-mascots" aria-hidden="true">
        {mascots.map(({ name, src, pose, motion }) => <span key={name} className={`mascot mascot-${motion}`}>
          <img className="mascot-base" src={src} alt="" draggable={false} />
          <img className="mascot-pose" src={pose} alt="" draggable={false} />
        </span>)}
      </div>
    </div>
    </div>
  );
}
