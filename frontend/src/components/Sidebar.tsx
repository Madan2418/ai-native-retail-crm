'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, FolderKanban,
  Megaphone, BarChart3, Sparkles, Zap, Menu, X,
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/customers',  label: 'Customers',   icon: Users           },
  { href: '/segments',   label: 'Segments',    icon: FolderKanban    },
  { href: '/campaigns',  label: 'Campaigns',   icon: Megaphone       },
  { href: '/analytics',  label: 'Analytics',   icon: BarChart3       },
  { href: '/ai-builder', label: 'AI Builder',  icon: Sparkles        },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const NavLinks = () => (
    <>
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          const isAI = href === '/ai-builder';
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative',
                active
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r-full" />
              )}
              <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
              <span className="flex-1">{label}</span>
              {isAI && (
                <span className="text-[9px] bg-gradient-to-r from-blue-500 to-violet-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System status + user */}
      <div className="px-4 pb-4 space-y-3">
        {/* Status indicator */}
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="live-dot" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">System Status</span>
          </div>
          <div className="space-y-1">
            {[
              { label: 'Backend API', ok: true },
              { label: 'Channel Service', ok: true },
              { label: 'AI (Gemini)', ok: true },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{label}</span>
                <div className={clsx('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-red-400')} />
              </div>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[11px] font-bold text-white">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-700">Madan</div>
            <div className="text-[10px] text-slate-400">Admin · Xeno CRM</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">Xeno CRM</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={clsx(
        'lg:hidden fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-slate-200 flex flex-col z-40 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <NavLinks />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-slate-200 flex-col z-30">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-none">Xeno CRM</div>
              <div className="text-[10px] text-slate-400 mt-0.5">AI-Native Platform</div>
            </div>
          </div>
        </div>
        <NavLinks />
      </aside>
    </>
  );
}
