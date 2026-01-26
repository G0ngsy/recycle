
import React, { useState } from 'react';
import { Trash, Image as ImageIcon, Search } from 'lucide-react';
import { HistoryItem } from '../types';
import { ResultView } from './ResultView';

interface GalleryProps {
  history: HistoryItem[];
  onDelete: (id: string) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ history, onDelete }) => {
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  if (selected) {
    return <ResultView result={selected.result} image={selected.image} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6 px-1">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">최근 기록</h2>
        <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-400">
          {history.length} ITEMS
        </span>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-100 shadow-sm">
          <ImageIcon className="w-16 h-16 text-slate-100 mx-auto mb-4" />
          <p className="text-slate-400 font-bold">아직 저장된 기록이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 pb-12">
          {history.map((item) => (
            <div 
              key={item.id} 
              onClick={() => setSelected(item)} 
              className="group relative bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 active:scale-95 transition-all"
            >
              <div className="aspect-square bg-slate-50 relative overflow-hidden">
                {item.image === 'search-placeholder' ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <Search className="w-12 h-12" />
                  </div>
                ) : (
                  <img src={item.image} className="w-full h-full object-cover" alt="History" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="p-4">
                <p className="font-black text-slate-800 text-sm truncate leading-tight">{item.result.itemName}</p>
                <p className="text-[10px] text-green-600 font-black uppercase mt-1 tracking-wider">{item.result.category}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur text-red-500 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
