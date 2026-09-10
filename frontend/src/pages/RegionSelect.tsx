import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, MapPin } from 'lucide-react';

import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { getManagementAreas, getRegions, getSigungu } from '../services/api';

type RequestKind = 'regions' | 'sigungu' | 'areas';

export default function RegionSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevState = useMemo(
    () => (location.state as { image?: string; searchText?: string } | null) ?? {},
    [location.state],
  );
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [managementArea, setManagementArea] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [areaRequired, setAreaRequired] = useState(false);
  const [loading, setLoading] = useState<RequestKind | null>('regions');
  const [failedRequest, setFailedRequest] = useState<RequestKind | null>(null);
  const [error, setError] = useState('');
  const [retries, setRetries] = useState<Record<RequestKind, number>>({ regions: 0, sigungu: 0, areas: 0 });

  const fail = (kind: RequestKind, message: string) => {
    setFailedRequest(kind);
    setError(message);
  };

  const loadRegions = useCallback(async () => {
    setLoading('regions');
    setError('');
    try {
      const response = await getRegions();
      setRegions(response.regions);
      setFailedRequest(null);
    } catch {
      fail('regions', '지역 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(null);
    }
  }, []);

  useEffect(() => {
    if (!prevState.image && !prevState.searchText) {
      navigate('/', { replace: true });
      return;
    }
    void loadRegions();
  }, [loadRegions, navigate, prevState.image, prevState.searchText, retries.regions]);

  useEffect(() => {
    if (!sido) return;
    let active = true;
    setLoading('sigungu');
    setError('');
    getSigungu(sido)
      .then(response => {
        if (active) {
          setSigunguList(response.sigungu);
          setFailedRequest(null);
        }
      })
      .catch(() => {
        if (active) fail('sigungu', '시·군·구 목록을 불러오지 못했습니다.');
      })
      .finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [sido, retries.sigungu]);

  useEffect(() => {
    if (!sido || !sigungu) return;
    let active = true;
    setLoading('areas');
    setError('');
    getManagementAreas(sido, sigungu)
      .then(response => {
        if (active) {
          setAreas(response.areas);
          setAreaRequired(response.required);
          setFailedRequest(null);
        }
      })
      .catch(() => {
        if (active) fail('areas', '관리구역 목록을 불러오지 못했습니다.');
      })
      .finally(() => { if (active) setLoading(null); });
    return () => { active = false; };
  }, [sido, sigungu, retries.areas]);

  const handleSidoChange = (value: string) => {
    setLoading(value ? 'sigungu' : null);
    setFailedRequest(null);
    setSido(value);
    setSigungu('');
    setManagementArea('');
    setSigunguList([]);
    setAreas([]);
    setAreaRequired(false);
    setError('');
  };

  const handleSigunguChange = (value: string) => {
    setLoading(value ? 'areas' : null);
    setFailedRequest(null);
    setSigungu(value);
    setManagementArea('');
    setAreas([]);
    setAreaRequired(false);
    setError('');
  };

  const handleRetry = () => {
    setError('');
    if (failedRequest) {
      setRetries(current => ({ ...current, [failedRequest]: current[failedRequest] + 1 }));
    }
  };

  const isBusy = loading !== null;
  const selectionIncomplete = !sido || isBusy || Boolean(error) || (areaRequired && !managementArea);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="지역 선택" subtitle="시·도, 시·군·구와 필요한 경우 관리구역을 선택해주세요" />

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={handleRetry} className="font-medium underline">
            {failedRequest ? '재시도' : '다시 불러오기'}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <RegionSelectField iconClass="text-emerald-500">
          <select value={sido} onChange={event => handleSidoChange(event.target.value)} disabled={loading === 'regions'} className="flex-1 outline-none bg-transparent disabled:text-slate-400">
            <option value="">{loading === 'regions' ? '시·도 목록을 불러오는 중...' : '시·도 선택'}</option>
            {regions.map(region => <option key={region}>{region}</option>)}
          </select>
        </RegionSelectField>

        <RegionSelectField>
          <select value={sigungu} onChange={event => handleSigunguChange(event.target.value)} disabled={!sido || loading === 'sigungu'} className="flex-1 outline-none bg-transparent disabled:text-slate-400">
            <option value="">{loading === 'sigungu' ? '시·군·구 목록을 불러오는 중...' : '시·군·구 선택 (선택 사항)'}</option>
            {sigunguList.map(item => <option key={item}>{item}</option>)}
          </select>
        </RegionSelectField>

        {sigungu && (loading === 'areas' || areaRequired) && (
          <RegionSelectField>
            <select value={managementArea} onChange={event => setManagementArea(event.target.value)} disabled={loading === 'areas'} className="flex-1 outline-none bg-transparent disabled:text-slate-400">
              <option value="">{loading === 'areas' ? '관리구역 목록을 불러오는 중...' : '관리구역 선택'}</option>
              {areas.map(area => <option key={area}>{area}</option>)}
            </select>
          </RegionSelectField>
        )}
      </div>

      <Button
        fullWidth
        disabled={selectionIncomplete}
        icon={<ChevronRight size={20} />}
        onClick={() => navigate('/result', { state: { ...prevState, region: { sido, sigungu, managementArea } } })}
      >
        확인
      </Button>
    </div>
  );
}

function RegionSelectField({ children, iconClass = 'text-slate-400' }: { children: ReactNode; iconClass?: string }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 transition-colors focus-within:border-emerald-400">
      <MapPin size={20} className={`${iconClass} shrink-0`} />
      {children}
    </label>
  );
}
