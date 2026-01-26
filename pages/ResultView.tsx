
import React from 'react';
import { ChevronLeft, CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import { RecyclingResult } from '../types';
import { Button } from '../components/ui/Button';

interface ResultViewProps {
  result: RecyclingResult;
  image: string;
  onBack?: () => void;
  onReset?: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ result, image, onBack, onReset }) => {
  return (
    <div className="animate-in slide-in-from-bottom duration-500 w-full">
      <div className="relative aspect-video w-full rounded-t-3xl overflow-hidden shadow-md bg-slate-100 flex items-center justify-center">
        {image === 'search-placeholder' ? (
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-4xl mb-2">🔍</span>
            <span className="text-sm font-bold">TEXT SEARCH RESULT</span>
          </div>
        ) : (
          <img src={image} className="w-full h-full object-cover" alt="Captured" />
        )}
        {onBack && (
          <button 
            onClick={onBack} 
            className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg active:scale-90"
          >
            <ChevronLeft className="w-6 h-6 text-slate-800" />
          </button>
        )}
      </div>
      
      <div className="bg-white rounded-b-3xl p-6 shadow-xl border border-slate-100 -mt-4 relative z-10 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 pr-4">
            <h2 className="text-2xl font-black text-slate-800 break-words leading-tight">{result.itemName}</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold mt-2">
              {result.category}
            </div>
          </div>
          {result.isRecyclable ? (
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          ) : (
            <XCircle className="w-10 h-10 text-red-500" />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
              <Info className="w-4 h-4" /> 배출 가이드
            </h3>
            <ul className="space-y-3">
              {result.disposalSteps.map((step, idx) => (
                <li key={idx} className="flex gap-4 text-slate-700 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center text-xs font-black text-green-600">
                    {idx + 1}
                  </span>
                  <p className="text-[15px] font-medium leading-relaxed">{step}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100/50">
            <p className="text-sm text-amber-800 font-medium leading-relaxed italic">
              " {result.tips} "
            </p>
          </div>

          {onReset && (
            <Button onClick={onReset} fullWidth variant="secondary" className="gap-2">
              <RefreshCw className="w-5 h-5" /> 다시 촬영/검색하기
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
