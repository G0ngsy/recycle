import React from 'react';

interface InfoBoxProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default';
  title?: string;
  children: React.ReactNode;
}

const variants = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  error: 'bg-red-50 border-red-200 text-red-600',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  default: 'bg-slate-50 border-slate-200 text-slate-700',
};

const titleColors = {
  success: 'text-emerald-800',
  error: 'text-red-700',
  warning: 'text-amber-800',
  info: 'text-blue-800',
  default: 'text-slate-700',
};

export default function InfoBox({ variant = 'default', title, children }: InfoBoxProps) {
  return (
    <div className={`rounded-2xl p-5 border ${variants[variant]}`}>
      {title && <p className={`font-semibold mb-2 ${titleColors[variant]}`}>{title}</p>}
      {children}
    </div>
  );
}
