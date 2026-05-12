import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';

const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도',
  '경상남도', '제주특별자치도',
];

export default function RegionSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevState = (location.state as { image?: string; searchText?: string }) || {};

  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSidoChange = async (value: string) => {
    setSido(value);
    setSigungu('');
    setSigunguList([]);
    if (!value) return;

    setLoading(true);
    try {
      const res = await fetch(`/data/${encodeURIComponent(value)}.json`);
      const data = await res.json();
      const list: string[] = [...new Set<string>(data.map((d: any) => d.시군구명).filter(Boolean))].sort();
      setSigunguList(list);
    } catch {
      setSigunguList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!sido) return;
    navigate('/result', {
      state: { ...prevState, region: { sido, sigungu } },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="지역 선택" subtitle="어느 지역의 분리수거 기준을 알려드릴까요?" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400 transition-colors">
          <MapPin size={20} className="text-slate-400 shrink-0" />
          <select
            value={sido}
            onChange={e => handleSidoChange(e.target.value)}
            className="flex-1 outline-none text-slate-800 bg-transparent"
          >
            <option value="">시/도 선택</option>
            {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {sido && (
          <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400 transition-colors">
            <MapPin size={20} className="text-slate-400 shrink-0" />
            <select
              value={sigungu}
              onChange={e => setSigungu(e.target.value)}
              disabled={loading || sigunguList.length === 0}
              className="flex-1 outline-none text-slate-800 bg-transparent disabled:text-slate-400"
            >
              <option value="">{loading ? '불러오는 중...' : '구/군 선택 (선택사항)'}</option>
              {sigunguList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <Button fullWidth disabled={!sido} icon={<ChevronRight size={20} />} onClick={handleNext}>
        확인
      </Button>
    </div>
  );
}
