import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { useSavedRegion } from '../services/useSavedRegion';
import { guideDestination } from '../services/region';

const SUGGESTIONS = ['페트병', '플라스틱 용기', '유리병', '캔', '종이컵', '비닐봉투', '스티로폼', '골판지', '신문지', '형광등', '건전지', '옷', '가전제품'];

export default function TextSearch() {
  const navigate = useNavigate();
  const savedRegion = useSavedRegion();
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = query.length > 0 ? SUGGESTIONS.filter(s => s.includes(query)) : [];

  const handleSelect = (item: string) => {
    setQuery(item);
    setShowSuggestions(false);
  };

  const handleNext = () => {
    if (!query.trim()) return;
    const next = guideDestination({ searchText: query.trim(), inputKind: 'text', itemConfirmed: true }, savedRegion);
    navigate(next.pathname, { state: next.state });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="품목명으로 검색" subtitle="분리수거할 품목을 입력해주세요" />

      <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setShowSuggestions(false); }}>
        <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 py-3 focus-within:border-blue-400 transition-colors">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            type="text"
            aria-label="품목명"
            maxLength={100}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            onFocus={() => setShowSuggestions(true)}
            placeholder="예: 플라스틱 병, 종이컵, 캔"
            className="flex-1 outline-none text-slate-800 placeholder-slate-400 bg-transparent"
          />
        </div>

        {showSuggestions && filtered.length > 0 && (
          <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
            {filtered.map(item => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.slice(0, 8).map(item => (
          <button
            key={item}
            onClick={() => handleSelect(item)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            {item}
          </button>
        ))}
      </div>

      <Button
        fullWidth
        disabled={!query.trim()}
        icon={<ChevronRight size={20} />}
        onClick={handleNext}
      >
        {savedRegion ? '배출 안내 보기' : '지역 선택하기'}
      </Button>
    </div>
  );
}
