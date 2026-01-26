
import React, { useState, useEffect } from 'react';
import { ViewType, HistoryItem, RecyclingResult } from './types';
import { loadHistory, saveHistory } from './services/storage';
import { Header } from './components/layout/Header';
import { Home } from './pages/Home';
import { Gallery } from './pages/Gallery';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('main');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleAddHistory = (image: string, result: RecyclingResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      image,
      result,
      timestamp: Date.now()
    };
    const updated = [newItem, ...history].slice(0, 30); // 최대 30개 유지
    setHistory(updated);
    saveHistory(updated);
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <Header 
        activeView={view} 
        onGoHome={() => setView('main')} 
        onGoGallery={() => setView('gallery')} 
      />

      <main className="w-full max-w-md flex-1 p-5 overflow-x-hidden">
        {view === 'main' ? (
          <Home onAddHistory={handleAddHistory} />
        ) : (
          <Gallery history={history} onDelete={handleDeleteHistory} />
        )}
      </main>

      <footer className="mt-4 mb-10 text-slate-300 text-[10px] font-black tracking-[0.3em] uppercase opacity-50">
        EcoScan AI &bull; Gemini Powered
      </footer>
    </div>
  );
};

export default App;
