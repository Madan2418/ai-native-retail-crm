import Sidebar from '@/components/Sidebar';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* lg: offset for fixed sidebar; mobile: offset for top bar */}
      <main className="flex-1 min-h-screen overflow-y-auto pt-14 lg:pt-0 lg:ml-56">
        {children}
      </main>
    </div>
  );
}
