import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';

const SIDO = '경기도';

const SIGUNGU_LIST = [
  '가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시',
  '김포시', '남양주', '동두천', '부천시', '성남시', '수원시', '시흥시',
  '안산시', '안성시', '안양시', '양주시', '양평군', '여주시', '연천군',
  '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시', '평택시',
  '포천시', '하남시', '화성시',
];

export default function RegionSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevState = (location.state as { image?: string; searchText?: string }) || {};

  const [sigungu, setSigungu] = useState('');

  const handleNext = () => {
    navigate('/result', {
      state: { ...prevState, region: { sido: SIDO, sigungu } },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="지역 선택" subtitle="시군구를 선택해주세요" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <MapPin size={20} className="text-emerald-500 shrink-0" />
          <span className="text-emerald-700 font-medium">{SIDO}</span>
        </div>

        <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400 transition-colors">
          <MapPin size={20} className="text-slate-400 shrink-0" />
          <select
            value={sigungu}
            onChange={e => setSigungu(e.target.value)}
            className="flex-1 outline-none text-slate-800 bg-transparent"
          >
            <option value="">시/군 선택</option>
            {SIGUNGU_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <Button fullWidth disabled={!sigungu} icon={<ChevronRight size={20} />} onClick={handleNext}>
        확인
      </Button>
    </div>
  );
}
