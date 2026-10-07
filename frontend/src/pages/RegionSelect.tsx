import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, MapPin, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { getRegions, getSigungu, getWasteRecords } from '../services/api';
import { WasteRecordOption } from '../types';

const PAGE_SIZE = 30;

function recordLabel(record: WasteRecordOption): string {
  return [record.관리구역명, record.관리구역대상지역명, record.배출장소유형, record.배출장소]
    .filter(value => value && value !== '없음' && value !== '해당없음')
    .join(' · ');
}

export default function RegionSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevState = (location.state as { image?: string; searchText?: string }) || {};
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [records, setRecords] = useState<WasteRecordOption[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<WasteRecordOption | null>(null);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingSigungu, setLoadingSigungu] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRegions()
      .then(({ regions: loaded }) => { if (active) setRegions(loaded); })
      .catch(() => { if (active) setError('지역 목록을 불러오지 못했습니다. 다시 시도해주세요.'); })
      .finally(() => { if (active) setLoadingRegions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sido) {
      setSigunguList([]);
      return;
    }
    let active = true;
    setSigunguList([]);
    setLoadingSigungu(true);
    getSigungu(sido)
      .then(({ sigungu: loaded }) => { if (active) setSigunguList(loaded); })
      .catch(() => { if (active) setError('시·군·구 목록을 불러오지 못했습니다. 다시 시도해주세요.'); })
      .finally(() => { if (active) setLoadingSigungu(false); });
    return () => { active = false; };
  }, [sido]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchText.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!sido || !sigungu || query !== searchText.trim()) return;
    let active = true;
    setLoadingRecords(true);
    getWasteRecords(sido, sigungu, query, offset)
      .then(({ total: count, records: loaded }) => {
        if (!active) return;
        setTotal(count);
        setRecords(previous => offset === 0 ? loaded : [...previous, ...loaded]);
        setError('');
        if (!query && count === 1 && loaded[0]) setSelected(loaded[0]);
      })
      .catch(() => { if (active) setError('세부 지역 목록을 불러오지 못했습니다. 다시 시도해주세요.'); })
      .finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [sido, sigungu, query, offset, searchText]);

  const resetRecords = () => {
    setSearchText('');
    setQuery('');
    setOffset(0);
    setRecords([]);
    setTotal(0);
    setSelected(null);
    setError('');
  };

  const handleNext = () => {
    if (!sido || !sigungu || !selected) return;
    navigate('/result', {
      state: { ...prevState, region: { sido, sigungu, managementId: selected.관리번호 } },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="지역 선택" subtitle="시·군·구와 실제 배출 장소를 선택해주세요" />

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => window.location.reload()} className="font-medium underline">재시도</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400">
          <MapPin size={20} className="text-emerald-500 shrink-0" />
          <select
            aria-label="시·도"
            value={sido}
            onChange={event => { setSido(event.target.value); setSigungu(''); resetRecords(); }}
            disabled={loadingRegions}
            className="flex-1 outline-none text-slate-800 bg-transparent disabled:text-slate-400"
          >
            <option value="">{loadingRegions ? '시·도 목록을 불러오는 중...' : '시·도 선택'}</option>
            {regions.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-emerald-400">
          <MapPin size={20} className="text-slate-400 shrink-0" />
          <select
            aria-label="시·군·구"
            value={sigungu}
            onChange={event => { setSigungu(event.target.value); resetRecords(); }}
            disabled={!sido || loadingSigungu}
            className="flex-1 outline-none text-slate-800 bg-transparent disabled:text-slate-400"
          >
            <option value="">{loadingSigungu ? '시·군·구 목록을 불러오는 중...' : '시·군·구 선택'}</option>
            {sigunguList.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {sigungu && (
        <section className="flex flex-col gap-3" aria-label="세부 관리구역 또는 배출장소">
          <label htmlFor="record-search" className="text-sm font-semibold text-slate-700">세부 관리구역 또는 배출장소</label>
          <input
            id="record-search"
            type="search"
            value={searchText}
            onChange={event => { setSearchText(event.target.value); setRecords([]); setSelected(null); setLoadingRecords(true); setError(''); }}
            placeholder="지역명이나 배출장소 검색"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
          />
          {selected && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              선택됨: {recordLabel(selected)} · 관리번호 {selected.관리번호}
            </p>
          )}
          {loadingRecords ? <p className="text-sm text-slate-500">배출장소를 찾는 중...</p> : (
            <>
              <p className="text-xs text-slate-500">검색 결과 {total.toLocaleString()}건</p>
              {total === 0 && <p className="text-sm text-slate-600">일치하는 장소가 없습니다. 검색어를 바꿔주세요.</p>}
              {total > 0 && (total > 1 || !!query) && (
                <div className="max-h-72 overflow-y-auto flex flex-col gap-2" role="group" aria-label="배출장소 검색 결과">
                  {records.map(record => (
                    <button
                      key={record.관리번호}
                      type="button"
                      aria-pressed={selected?.관리번호 === record.관리번호}
                      onClick={() => setSelected(record)}
                      className={`rounded-xl border px-3 py-3 text-left text-sm ${selected?.관리번호 === record.관리번호 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                    >
                      <span className="block text-slate-800">{recordLabel(record) || '세부 위치 정보 없음'}</span>
                      <span className="block mt-1 text-xs text-slate-500">관리번호 {record.관리번호}</span>
                    </button>
                  ))}
                </div>
              )}
              {records.length < total && (
                <button type="button" onClick={() => setOffset(previous => previous + PAGE_SIZE)} className="self-center text-sm font-medium text-emerald-700 underline">
                  더 보기
                </button>
              )}
            </>
          )}
        </section>
      )}

      <Button fullWidth disabled={!selected || !sido || !sigungu || loadingRegions || loadingSigungu || loadingRecords || !!error} icon={<ChevronRight size={20} />} onClick={handleNext}>
        확인
      </Button>
    </div>
  );
}
