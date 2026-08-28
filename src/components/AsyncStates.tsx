import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-black/8 dark:bg-white/10 motion-reduce:animate-none ${className}`} />;
}

export function PageSkeleton({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div className="space-y-5" role="status" aria-live="polite" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div className="space-y-2"><Skeleton className="h-4 w-28"/><Skeleton className="h-8 w-64 max-w-full"/></div>
    <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="card space-y-3 p-4" key={index}><Skeleton className="h-3 w-24"/><Skeleton className="h-7 w-36 max-w-full"/></div>)}</div>
    <div className="card space-y-4 p-4"><Skeleton className="h-5 w-48"/>{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-14 w-full" key={index}/>)}</div>
  </div>;
}

export function TransactionListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div role="status" aria-live="polite" aria-label="Đang tải giao dịch" className="divide-y divide-black/10 dark:divide-white/10">
    <span className="sr-only">Đang tải giao dịch…</span>
    {Array.from({ length: rows }, (_, index) => <div className="grid gap-3 p-4 md:grid-cols-[100px_minmax(220px,1fr)_150px_150px_170px_140px_90px] md:items-center" key={index}><Skeleton className="h-4 w-20"/><Skeleton className="h-6 w-full"/><Skeleton className="hidden h-4 w-28 md:block"/><Skeleton className="hidden h-4 w-28 md:block"/><Skeleton className="hidden h-4 w-28 md:block"/><Skeleton className="h-5 w-28"/><Skeleton className="hidden h-8 w-16 md:block"/></div>)}
  </div>;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: string; icon?: LucideIcon; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-5 py-10 text-center" role="status">
    <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-[#e5f2eb] text-[#155e46] dark:bg-emerald-950/60 dark:text-emerald-300"><Icon size={24} aria-hidden="true"/></span>
    <h3 className="font-bold">{title}</h3>
    {description && <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}
