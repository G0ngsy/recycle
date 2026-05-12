import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Home from './pages/Home';
import ImageScan from './pages/ImageScan';
import TextSearch from './pages/TextSearch';
import RegionSelect from './pages/RegionSelect';
import Result from './pages/Result';
import Gallery from './pages/Gallery';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<ImageScan />} />
            <Route path="/search" element={<TextSearch />} />
            <Route path="/region" element={<RegionSelect />} />
            <Route path="/result" element={<Result />} />
            <Route path="/gallery" element={<Gallery />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
