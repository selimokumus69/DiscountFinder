import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
  variant?: 'default' | 'warning' | 'danger';
}

export function StatCard({ label, value, icon, hint, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm',
        variant === 'danger' && 'border-red-200',
        variant === 'warning' && 'border-amber-200'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            variant === 'danger' ? 'bg-red-50 text-red-600' : variant === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-600'
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
