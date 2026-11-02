import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variants = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500',
  secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  ghost: 'bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50',
  danger: 'bg-white border border-slate-200 text-red-700 hover:text-red-800 hover:bg-red-50 disabled:opacity-50',
};

export default function Button({
  variant = 'primary',
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold
        min-h-11 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
