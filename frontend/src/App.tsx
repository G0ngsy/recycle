import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Home from './pages/Home';
import ImageScan from './pages/ImageScan';
import TextSearch from './pages/TextSearch';
import RegionSelect from './pages/RegionSelect';
import Result from './pages/Result';
import Gallery from './pages/Gallery';
import ConfirmItem from './pages/ConfirmItem';

function AppLayout() {
  const path = useLocation().pathname;
  const isHome = path === '/';
  const isResult = path === '/result';

  return (
      <div className="app-shell relative isolate min-h-screen flex flex-col">
        <div aria-hidden="true" className={`app-background-panel ${isHome ? 'app-home-background' : ''} ${isResult ? 'app-result-background' : ''}`} />
        <Header />
        <main className={`relative z-10 flex-1 w-full max-w-md mx-auto px-4 py-6 ${isHome ? 'app-home-main' : ''} ${isResult ? 'app-result-main' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/confirm" element={<ConfirmItem />} />
            <Route path="/scan" element={<ImageScan />} />
            <Route path="/search" element={<TextSearch />} />
            <Route path="/region" element={<RegionSelect />} />
            <Route path="/result" element={<Result />} />
            <Route path="/gallery" element={<Gallery />} />
          </Routes>
        </main>
      </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
