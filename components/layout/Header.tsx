
import React from 'react';
import { Home, Image as ImageIcon } from 'lucide-react';

interface HeaderProps {
  onGoHome: () => void;
  onGoGallery: () => void;
  activeView: 'main' | 'gallery';
}

export const Header: React.FC<HeaderProps> = ({ onGoHome, onGoGallery, activeView }) => {
  return (
    <header className="w-full max-w-md bg-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-sm border-b border-slate-100">
      <div 
        className="flex items-center gap-2 cursor-pointer group" 
        onClick={onGoHome}
      >
        <div className="bg-green-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
          <span className="text-white font-bold">♻</span>
        </div>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">분리수거 AI</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onGoGallery} 
          className={`p-2.5 rounded-xl transition-all ${activeView === 'gallery' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          title="갤러리"
        >
          <ImageIcon className="w-6 h-6" />
        </button>
        <button 
          onClick={onGoHome} 
          className={`p-2.5 rounded-xl transition-all ${activeView === 'main' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          title="홈"
        >
          <Home className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};
