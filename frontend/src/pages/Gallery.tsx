import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, CheckCircle, XCircle, ImageIcon } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { loadHistory, deleteHistory } from '../services/storage';
import { HistoryItem } from '../types';

export default function Gallery() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const handleDelete = (id: string) => {
    deleteHistory(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-64 text-slate-400">
        <ImageIcon size={48} />
        <p className="font-medium">저장된 기록이 없어요</p>
        <button onClick={() => navigate('/')} className="text-emerald-500 font-medium text-sm mt-1">
          분리수거 확인하러 가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="내 스캔 기록" />
      <div className="flex flex-col gap-3">
        {history.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            {item.image ? (
              <img src={item.image} alt={item.itemName} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <ImageIcon size={24} className="text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 truncate">{item.itemName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{item.region}</p>
              <div className="flex items-center gap-1 mt-1">
                {item.result.isRecyclable
                  ? <><CheckCircle size={14} className="text-emerald-500" /><span className="text-xs text-emerald-600">재활용 가능</span></>
                  : <><XCircle size={14} className="text-red-400" /><span className="text-xs text-red-500">재활용 불가</span></>
                }
              </div>
            </div>
            <Button
              variant="danger"
              className="!p-2 !rounded-lg"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 size={18} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
