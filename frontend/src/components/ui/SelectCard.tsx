import React from 'react';

interface SelectCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: 'emerald' | 'blue';
  onClick: () => void;
}

const accents = {
  emerald: {
    border: 'hover:border-emerald-400',
    iconBg: 'bg-emerald-50 group-hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  blue: {
    border: 'hover:border-blue-400',
    iconBg: 'bg-blue-50 group-hover:bg-blue-100',
    iconColor: 'text-blue-600',
  },
};

export default function SelectCard({ icon, title, description, accent = 'emerald', onClick }: SelectCardProps) {
  const a = accents[accent];
  return (
    <button
      onClick={onClick}
      className={`w-full bg-white border-2 border-slate-200 rounded-2xl p-6 text-left hover:shadow-md transition-all group ${a.border}`}
    >
      <div className="flex items-start gap-4">
        <div className={`rounded-xl p-3 transition-colors ${a.iconBg}`}>
          <span className={a.iconColor}>{icon}</span>
        </div>
        <div>
          <p className="font-bold text-slate-800 text-lg">{title}</p>
          <p className="text-slate-500 text-sm mt-1 whitespace-pre-line">{description}</p>
        </div>
      </div>
    </button>
  );
}
