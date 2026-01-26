
import React, { useState, useRef } from 'react';
import { Scan, Search, Camera, RefreshCw } from 'lucide-react';
import { AppState, RecyclingResult, TabType } from '../types';
import { analyzeImage, searchRecycling } from '../services/gemini';
import { ResultView } from './ResultView';
import { Button } from '../components/ui/Button';

interface HomeProps {
  onAddHistory: (image: string, result: RecyclingResult) => void;
}

export const Home: React.FC<HomeProps> = ({ onAddHistory }) => {
  const [activeTab, setActiveTab] = useState<TabType>('scanner');
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<RecyclingResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      setError(null);
      setState(AppState.SCANNING);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError('카메라를 시작할 수 없습니다.');
      setState(AppState.IDLE);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
    setState(AppState.LOADING);
    try {
      const res = await analyzeImage(dataUrl.split(',')[1]);
      setResult(res);
      onAddHistory(dataUrl, res);
      setState(AppState.RESULT);
    } catch {
      setError('분석에 실패했습니다.');
      setState(AppState.ERROR);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setState(AppState.LOADING);
    try {
      const res = await searchRecycling(searchQuery);
      setResult(res);
      onAddHistory('search-placeholder', res);
      setState(AppState.RESULT);
    } catch {
      setError('검색 결과를 찾을 수 없습니다.');
      setState(AppState.ERROR);
    }
  };

  const reset = () => {
    setState(AppState.IDLE);
    setResult(null);
    setCapturedImage(null);
    setError(null);
    if (activeTab === 'scanner') startCamera();
  };

  return (
    <div className="flex flex-col h-full">
      <nav className="bg-slate-200 p-1.5 rounded-[1.5rem] flex mb-8 shadow-inner relative">
        <button 
          onClick={() => { setActiveTab('scanner'); reset(); }} 
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all relative z-10 ${activeTab === 'scanner' ? 'text-white' : 'text-slate-500'}`}
        >
          <Scan className="w-4 h-4" /> 스캐너
        </button>
        <button 
          onClick={() => { setActiveTab('search'); stopCamera(); reset(); }} 
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all relative z-10 ${activeTab === 'search' ? 'text-white' : 'text-slate-500'}`}
        >
          <Search className="w-4 h-4" /> 검색
        </button>
        <div 
          className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-green-600 rounded-2xl transition-all duration-300 shadow-lg ${activeTab === 'search' ? 'translate-x-[calc(100%+0px)]' : 'translate-x-0'}`} 
        />
      </nav>

      <div className="flex-1">
        {state === AppState.RESULT && result ? (
          <ResultView 
            result={result} 
            image={capturedImage || 'search-placeholder'} 
            onReset={reset} 
          />
        ) : activeTab === 'scanner' ? (
          <div className="animate-in fade-in duration-300">
            <div className="relative aspect-[4/5] bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
              {state === AppState.IDLE && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-12 text-center bg-gradient-to-br from-slate-800 to-slate-950">
                  <div className="bg-green-600/20 p-8 rounded-full mb-8">
                    <Camera className="w-12 h-12 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-black mb-3">AI 리사이클 스캔</h3>
                  <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">카메라로 물건을 찍으면<br/>즉시 배출 방법을 분석합니다</p>
                  <Button onClick={startCamera} className="px-12 py-5 text-lg">스캔 시작하기</Button>
                </div>
              )}
              {state === AppState.SCANNING && (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-12 left-0 right-0 flex justify-center">
                    <button onClick={handleCapture} className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-full p-2 border-2 border-white/50 active:scale-90 transition-all">
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                        <div className="w-16 h-16 bg-green-600 rounded-full" />
                      </div>
                    </button>
                  </div>
                </>
              )}
              {state === AppState.LOADING && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/60 backdrop-blur-md">
                  <RefreshCw className="w-16 h-16 animate-spin text-green-400 mb-6" />
                  <p className="text-xl font-black tracking-tighter">AI 분석 중...</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <form onSubmit={handleSearch} className="relative mb-8">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="물건 이름을 입력하세요 (예: 페트병)" 
                className="w-full bg-white border-2 border-slate-100 p-6 pr-16 rounded-3xl shadow-sm focus:border-green-500 outline-none transition-all font-bold text-slate-700"
              />
              <button type="submit" className="absolute right-3.5 top-3.5 p-3 bg-green-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all">
                <Search className="w-6 h-6" />
              </button>
            </form>
            <div className="p-8 text-center bg-white rounded-[2.5rem] border border-slate-50 shadow-sm">
              <div className="text-4xl mb-4">♻️</div>
              <p className="text-slate-400 font-bold leading-relaxed">이름을 검색하면 정확한<br/>분리배출 가이드를 알려드려요</p>
            </div>
          </div>
        )}

        {state === AppState.ERROR && (
          <div className="mt-8 bg-red-50 rounded-[2.5rem] p-10 text-center border border-red-100">
            <p className="text-red-900 font-black text-lg mb-2">분석에 실패했어요</p>
            <p className="text-red-600 text-sm mb-8 font-medium">{error}</p>
            <Button onClick={reset} variant="danger" fullWidth>다시 시도</Button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
