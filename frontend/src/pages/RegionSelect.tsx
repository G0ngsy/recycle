import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, MapPin, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { getRegions, getSigungu } from '../services/api';

export default function RegionSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevState = (location.state as { image?: string; searchText?: string }) || {};
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingSigungu, setLoadingSigungu] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingRegions(true);
    getRegions()
      .then(({ regions: loadedRegions }) => {
        if (active) setRegions(loadedRegions);
      })
      .catch(() => {
        if (active) setError('지역 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      })
      .finally(() => {
        if (active) setLoadingRegions(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sido) {
      setSigunguList([]);
      setLoadingSigungu(false);
      return;
    }
    let active = true;
    setLoadingSigungu(true);
    getSigungu(sido)
      .then(({ sigungu: loadedSigungu }) => {
        if (active) setSigunguList(loadedSigungu);
      })
      .catch(() => {
        if (active) setError('시·군·구 목록을 불러오지 못했습니다. 다시 시도해주세요.');
      })
      .finally(() => {
        if (active) setLoadingSigungu(false);
      });
    return () => { active = false; };
  }, [sido]);

  const handleSidoChange = (nextSido: string) => {
    setSido(nextSido);
    setSigungu('');
    setError('');
  };

  const handleRetry = () => window.location.reload();

  const handleNext = () => {
    if (!sido) return;
    navigate('/result', {
      state: { ...prevState, region: { sido, sigungu } },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="지역 선택" subtitle="시·도를 선택하고, 더 정확한 안내가 필요하면 시·군·구를 선택해주세요" />

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={handleRetry} className="font-medium underline">재시도</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400 transition-colors">
          <MapPin size={20} className="text-emerald-500 shrink-0" />
          <select
            value={sido}
            onChange={e => handleSidoChange(e.target.value)}
            disabled={loadingRegions}
            className="flex-1 outline-none text-slate-800 bg-transparent disabled:text-slate-400"
          >
            <option value="">{loadingRegions ? '시·도 목록을 불러오는 중...' : '시·도 선택'}</option>
            {regions.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400 transition-colors">
          <MapPin size={20} className="text-slate-400 shrink-0" />
          <select
            value={sigungu}
            onChange={e => setSigungu(e.target.value)}
            disabled={!sido || loadingSigungu}
            className="flex-1 outline-none text-slate-800 bg-transparent disabled:text-slate-400"
          >
            <option value="">{loadingSigungu ? '시·군·구 목록을 불러오는 중...' : '시·군·구 선택 (선택 사항)'}</option>
            {sigunguList.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <Button fullWidth disabled={!sido || loadingRegions || loadingSigungu} icon={<ChevronRight size={20} />} onClick={handleNext}>
        확인
      </Button>
    </div>
  );
}
