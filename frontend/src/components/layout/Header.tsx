import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Recycle, ImageIcon, History } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 font-bold text-emerald-600 text-lg">
          <Recycle size={22} />
          분리수거 AI
        </button>
        <nav className="flex items-center gap-1">
          <button
            onClick={() => navigate('/gallery')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/gallery'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <History size={16} />
            갤러리
          </button>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            홈
          </button>
        </nav>
      </div>
    </header>
  );
}
