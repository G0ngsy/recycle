import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, MapPin } from 'lucide-react';

import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { getRegions, getSigungu, getWasteRecords } from '../services/api';
import type { ScanState, WasteRecordOption } from '../types';
import { saveRegion } from '../services/region';
import { useSavedRegion } from '../services/useSavedRegion';
import { regionLabel } from '../services/display';

const PAGE_SIZE = 30;
type RequestKind = 'regions' | 'sigungu' | 'records';

function recordLabel(record: WasteRecordOption): string {
  return [record.관리구역명, record.관리구역대상지역명, record.배출장소유형, record.배출장소]
    .filter(value => value && value !== '없음' && value !== '해당없음')
    .join(' · ');
}

export default function RegionSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevState = useMemo(
    () => (location.state as (ScanState & { regionMode?: 'setup' | 'edit' }) | null) ?? {},
    [location.state],
  );
  const savedRegion = useSavedRegion();
  const settingsMode = Boolean(prevState.regionMode || (!prevState.image && !prevState.searchText));
  const initialRegion = prevState.region ?? savedRegion?.selection;
  const [sido, setSido] = useState(initialRegion?.sido ?? '');
  const [sigungu, setSigungu] = useState(initialRegion?.sigungu ?? '');
  const [regions, setRegions] = useState<string[]>([]);
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [records, setRecords] = useState<WasteRecordOption[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<WasteRecordOption | null>(() => initialRegion?.managementId === savedRegion?.selection.managementId ? savedRegion?.record ?? null : null);
  const [saveError, setSaveError] = useState('');
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingSigungu, setLoadingSigungu] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [failedRequest, setFailedRequest] = useState<RequestKind | null>(null);
  const [retries, setRetries] = useState<Record<RequestKind, number>>({ regions: 0, sigungu: 0, records: 0 });

  useEffect(() => {
    if (!settingsMode && prevState.image && !prevState.itemConfirmed) {
      navigate('/confirm', { replace: true, state: prevState });
      return;
    }
    let active = true;
    setLoadingRegions(true);
    getRegions()
      .then(({ regions: loaded }) => {
        if (!active) return;
        setRegions(loaded);
        setFailedRequest(null);
      })
      .catch(() => { if (active) setFailedRequest('regions'); })
      .finally(() => { if (active) setLoadingRegions(false); });
    return () => { active = false; };
  }, [navigate, prevState, settingsMode, retries.regions]);

  useEffect(() => {
    if (!sido) { setSigunguList([]); return; }
    let active = true;
    setLoadingSigungu(true);
    getSigungu(sido)
      .then(({ sigungu: loaded }) => {
        if (!active) return;
        setSigunguList(loaded);
        setFailedRequest(null);
      })
      .catch(() => { if (active) setFailedRequest('sigungu'); })
      .finally(() => { if (active) setLoadingSigungu(false); });
    return () => { active = false; };
  }, [sido, retries.sigungu]);

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
        setFailedRequest(null);
        if (!query && count === 1 && loaded[0]) setSelected(loaded[0]);
      })
      .catch(() => { if (active) setFailedRequest('records'); })
      .finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [sido, sigungu, query, offset, searchText, retries.records]);

  const resetRecords = () => {
    setSaveError('');
    setSearchText('');
    setQuery('');
    setOffset(0);
    setRecords([]);
    setTotal(0);
    setSelected(null);
    setLoadingRecords(false);
    setFailedRequest(null);
  };

  const handleRetry = () => {
    if (!failedRequest) return;
    setRetries(current => ({ ...current, [failedRequest]: current[failedRequest] + 1 }));
  };

  const isBusy = loadingRegions || loadingSigungu || loadingRecords;
  const handleSave = () => {
    if (!selected || isBusy || failedRequest) return;
    const region = { sido, sigungu, managementId: selected.관리번호 };
    if (!saveRegion({ selection: region, record: selected })) {
      setSaveError('지역을 저장하지 못했습니다. 브라우저 저장 공간과 사이트 데이터 설정을 확인한 뒤 다시 시도해주세요.');
      return;
    }
    if (settingsMode) navigate('/', { replace: true });
    else navigate('/result', { state: { ...prevState, region } });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={settingsMode ? savedRegion ? '배출 지역 변경' : '내 배출 지역 설정' : '지역 선택'} subtitle="시·군·구와 실제 배출 장소를 선택해주세요" />
      <p className="text-sm leading-6 text-slate-600">한 번 저장하면 다음부터 이 지역으로 안내합니다. 지역은 홈에서 언제든 변경할 수 있어요. 이 브라우저에 저장됩니다.</p>
      {savedRegion && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">현재 저장된 지역: {regionLabel(savedRegion.selection.sido, savedRegion.selection.sigungu, savedRegion.record.관리구역대상지역명)}</p>}
      {saveError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}

      {failedRequest && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{failedRequest === 'regions' ? '지역 목록을' : failedRequest === 'sigungu' ? '시·군·구 목록을' : '배출장소 목록을'} 불러오지 못했습니다.</span>
          <button type="button" onClick={handleRetry} className="font-medium underline">재시도</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 focus-within:border-emerald-400">
          <MapPin size={20} className="text-emerald-500 shrink-0" />
          <select aria-label="시·도" value={sido}
            onChange={event => { setSido(event.target.value); setSigungu(''); setSigunguList([]); resetRecords(); }}
            disabled={loadingRegions} className="flex-1 outline-none bg-transparent disabled:text-slate-400">
            <option value="">{loadingRegions ? '시·도 목록을 불러오는 중...' : '시·도 선택'}</option>
            {regions.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 focus-within:border-emerald-400">
          <MapPin size={20} className="text-slate-400 shrink-0" />
          <select aria-label="시·군·구" value={sigungu}
            onChange={event => { setSigungu(event.target.value); resetRecords(); }}
            disabled={!sido || loadingSigungu} className="flex-1 outline-none bg-transparent disabled:text-slate-400">
            <option value="">{loadingSigungu ? '시·군·구 목록을 불러오는 중...' : '시·군·구 선택'}</option>
            {sigunguList.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {sigungu && (
        <section className="flex flex-col gap-3" aria-label="세부 관리구역 또는 배출장소">
          <label htmlFor="record-search" className="text-sm font-semibold text-slate-700">세부 관리구역 또는 배출장소</label>
          <input id="record-search" type="search" value={searchText}
            onChange={event => { setSearchText(event.target.value); setRecords([]); setSelected(null); setLoadingRecords(true); setFailedRequest(null); }}
            placeholder="지역명이나 배출장소 검색"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400" />
          {selected && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">선택됨: {recordLabel(selected)}</p>}
          {loadingRecords ? <p className="text-sm text-slate-500">배출장소를 찾는 중...</p> : (
            <>
              <p className="text-xs text-slate-500">검색 결과 {total.toLocaleString()}건</p>
              {total === 0 && <p className="text-sm text-slate-600">일치하는 장소가 없습니다. 검색어를 바꿔주세요.</p>}
              {total > 0 && (total > 1 || !!query) && (
                <div className="max-h-72 overflow-y-auto flex flex-col gap-2" role="group" aria-label="배출장소 검색 결과">
                  {records.map(record => (
                    <div key={record.관리번호} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <button type="button" aria-pressed={selected?.관리번호 === record.관리번호}
                      onClick={() => setSelected(record)}
                      className={`w-full border-l-4 px-3 py-3 text-left text-sm ${selected?.관리번호 === record.관리번호 ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-white'}`}>
                      <span className="block font-semibold text-slate-800">{[record.관리구역명, record.관리구역대상지역명].filter(value => value && value !== '없음' && value !== '해당없음').join(' · ') || '세부 지역 정보 없음'}</span>
                      <span className="block mt-1 text-sm text-slate-600">{[record.배출장소유형, record.배출장소].filter(value => value && value !== '없음' && value !== '해당없음').join(' · ') || '배출장소 확인 필요'}</span>
                      {selected?.관리번호 === record.관리번호 && <span className="block mt-2 font-semibold text-emerald-800">✓ 선택한 장소</span>}
                    </button>
                    <details className="px-3 pb-2 text-xs text-slate-600"><summary className="cursor-pointer py-2">상세 정보</summary><p>관리번호 {record.관리번호}</p></details>
                    </div>
                  ))}
                </div>
              )}
              {records.length < total && (
                <button type="button" onClick={() => setOffset(previous => previous + PAGE_SIZE)} className="self-center text-sm font-medium text-emerald-700 underline">더 보기</button>
              )}
            </>
          )}
        </section>
      )}

      <Button fullWidth disabled={!sido || !sigungu || !selected || isBusy || !!failedRequest}
        icon={<ChevronRight size={20} />}
        onClick={handleSave}>
        {settingsMode ? '이 지역 저장하기' : '지역 저장하고 배출 안내 보기'}
      </Button>
      {settingsMode && savedRegion && <Button variant="secondary" fullWidth onClick={() => navigate('/', { replace: true })}>변경 취소</Button>}
    </div>
  );
}
