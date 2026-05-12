import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Keyboard } from 'lucide-react';
import SelectCard from '../components/ui/SelectCard';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-8 pt-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">어떤 방식으로</h1>
        <h1 className="text-2xl font-bold text-slate-800">확인할까요?</h1>
        <p className="text-slate-500 text-sm mt-2">분리수거 방법을 AI가 알려드려요</p>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <SelectCard
          icon={<Camera size={28} />}
          title="이미지 스캔"
          description={'사진을 찍거나 업로드해서\n분리수거 방법을 알려드려요'}
          accent="emerald"
          onClick={() => navigate('/scan')}
        />
        <SelectCard
          icon={<Keyboard size={28} />}
          title="텍스트 검색"
          description={'품목 이름을 입력해서\n분리수거 방법을 확인해요'}
          accent="blue"
          onClick={() => navigate('/search')}
        />
      </div>
    </div>
  );
}
