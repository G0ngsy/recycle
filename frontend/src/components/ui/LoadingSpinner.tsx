import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
}

export default function LoadingSpinner({ message = '불러오는 중...', subMessage }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-64">
      <Loader2 size={40} className="text-emerald-500 animate-spin" />
      <p className="text-slate-700 font-medium">{message}</p>
      {subMessage && <p className="text-slate-400 text-sm">{subMessage}</p>}
    </div>
  );
}
