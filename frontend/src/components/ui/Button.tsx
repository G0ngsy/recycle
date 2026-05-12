import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variants = {
  primary: 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400',
  secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  ghost: 'bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50',
  danger: 'bg-white border border-slate-200 text-red-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50',
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
        transition-colors cursor-pointer disabled:cursor-not-allowed
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
