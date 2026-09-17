import { WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthShell({ children, maxWidth = 'max-w-md' }: { children: ReactNode; maxWidth?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--app-bg)] p-4">
      <div className={`card w-full ${maxWidth} p-7`}>
        <div className="mb-5 flex items-center gap-3">
          <span className="brand-mark size-12 rounded-2xl" aria-hidden="true">
            <WalletCards size={23} />
          </span>
          <p className="brand-wordmark">FAMILY FINANCE</p>
        </div>
        {children}
      </div>
    </main>
  );
}
