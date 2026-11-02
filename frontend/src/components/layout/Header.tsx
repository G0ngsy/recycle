import { useNavigate, useLocation } from 'react-router-dom';

const tabClass = (active: boolean) =>
  `min-h-8 rounded-full px-1.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
    active
      ? 'bg-white text-emerald-700 shadow-sm'
      : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
  }`;

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isGallery = location.pathname === '/gallery';

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-md items-center px-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="app-brand min-h-11 absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="분리수거 AI 홈으로"
        >
          <img src="/brand-faces-transparent.png" alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain" />
          <span className="whitespace-nowrap text-sm font-extrabold tracking-tight text-slate-800">
            분리수거 <span className="text-emerald-600">AI</span>
          </span>
        </button>
        <nav aria-label="주요 메뉴" className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full border border-emerald-100 bg-emerald-50 p-0.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-current={isHome ? 'page' : undefined}
            className={tabClass(isHome)}
          >
            홈
          </button>
          <button
            type="button"
            onClick={() => navigate('/gallery')}
            aria-current={isGallery ? 'page' : undefined}
            className={tabClass(isGallery)}
          >
            갤러리
          </button>
        </nav>
      </div>
    </header>
  );
}
