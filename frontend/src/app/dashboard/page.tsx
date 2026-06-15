'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { rfmApi, campaignsApi, customersApi, aiApi } from '@/lib/api';
import {
  Users, Megaphone, TrendingUp, CheckCircle2, RefreshCw, Sparkles,
  ArrowUpRight, Target, Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';
import Link from 'next/link';

const SEGMENT_COLORS: Record<string, string> = {
  'Champions':           '#2563eb',
  'Loyal':               '#7c3aed',
  'Potential Loyalists': '#059669',
  'At Risk':             '#d97706',
  'Cannot Lose':         '#dc2626',
  'Hibernating':         '#64748b',
  'Lost':                '#94a3b8',
};

const SEGMENT_BG: Record<string, string> = {
  'Champions':           'bg-blue-50 text-blue-700 border-blue-100',
  'Loyal':               'bg-violet-50 text-violet-700 border-violet-100',
  'Potential Loyalists': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'At Risk':             'bg-amber-50 text-amber-700 border-amber-100',
  'Cannot Lose':         'bg-red-50 text-red-700 border-red-100',
  'Hibernating':         'bg-slate-100 text-slate-600 border-slate-200',
  'Lost':                'bg-slate-50 text-slate-500 border-slate-100',
};

const STATUS_COLORS: Record<string, string> = {
  running:   'bg-emerald-100 text-emerald-700',
  done:      'bg-slate-100 text-slate-500',
  draft:     'bg-amber-100 text-amber-700',
  scheduled: 'bg-blue-100 text-blue-700',
};

function StatCard({ label, value, icon: Icon, sub, accent, glow, href }: any) {
  const inner = (
    <div className={clsx('card p-5 flex items-start justify-between animate-slide-up', glow)}>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', accent)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RFMCard({ segment, insight, action }: any) {
  const label = segment.segment_label;
  const style = SEGMENT_BG[label] || SEGMENT_BG['Lost'];
  return (
    <div className={clsx('card p-4 hover:shadow-lg transition-all duration-200 animate-slide-up border-l-4', style.split(' ').slice(-1)[0])}>
      <div className="flex items-start justify-between mb-2">
        <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full border', style)}>
          {label}
        </span>
        <div className="text-right">
          <div className="text-xl font-bold text-slate-900">{segment.count}</div>
          <div className="text-[10px] text-slate-400 leading-none">customers</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
        <span>Avg spend: <span className="font-semibold text-slate-700">₹{Number(segment.avg_monetary || 0).toLocaleString('en-IN')}</span></span>
        <span className="w-1 h-1 rounded-full bg-slate-300" />
        <span><span className="font-semibold text-slate-700">{Math.round(segment.avg_recency_days || 0)}d</span> ago</span>
      </div>

      {/* Progress bar for count proportion */}
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min((segment.count / 30) * 100, 100)}%`,
            backgroundColor: SEGMENT_COLORS[label] || '#94a3b8',
          }}
        />
      </div>

      {insight && (
        <div className="border-t border-slate-100 pt-2.5">
          <div className="flex items-start gap-1.5">
            <Sparkles className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">{insight}</p>
          </div>
          {action && <p className="text-[11px] text-blue-600 font-semibold mt-1">{action}</p>}
        </div>
      )}
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 12, color: '#0f172a',
};

export default function DashboardPage() {
  const [rfmData, setRfmData]             = useState<any[]>([]);
  const [rfmInsights, setRfmInsights]     = useState<any>(null);
  const [campaigns, setCampaigns]         = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [topPriority, setTopPriority]     = useState('');
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  async function loadData() {
    try {
      const [rfm, camps, customers] = await Promise.all([
        rfmApi.summary(),
        campaignsApi.list(),
        customersApi.list({ limit: 1 }),
      ]);
      setRfmData(rfm);
      setCampaigns(camps);
      setCustomerStats(customers);
      aiApi.rfmInsights()
        .then(d => { setRfmInsights(d.segments); setTopPriority(d.top_priority || ''); })
        .catch(console.error);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try { await rfmApi.recalculate(); await loadData(); }
    finally { setRefreshing(false); }
  }

  const totalCustomers  = customerStats?.total || 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
  const totalSent       = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalDelivered  = campaigns.reduce((s, c) => s + (c.delivered || 0), 0);
  const avgDelivery     = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(0) : '—';

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-24 shimmer" />)}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(7)].map((_, i) => <div key={i} className="card h-36 shimmer" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="live-dot" />
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Live</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Customer intelligence overview</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/ai-builder"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-sm text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200">
              <Sparkles className="w-3.5 h-3.5" /> AI Builder
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'spin-slow')} />
              Refresh RFM
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger">
          <StatCard
            label="Total Customers" value={totalCustomers.toLocaleString()}
            icon={Users} accent="bg-blue-600" glow="stat-glow-blue" href="/customers"
          />
          <StatCard
            label="Active Campaigns" value={activeCampaigns}
            icon={Megaphone} accent="bg-violet-600" glow="stat-glow-violet" href="/campaigns"
          />
          <StatCard
            label="Messages Sent" value={totalSent.toLocaleString()}
            icon={TrendingUp} accent="bg-emerald-600" glow="stat-glow-green"
            sub={totalSent > 0 ? `${avgDelivery}% delivery rate` : 'No campaigns yet'}
          />
          <StatCard
            label="Total Campaigns" value={campaigns.length}
            icon={CheckCircle2} accent="bg-amber-500" glow="stat-glow-amber" href="/campaigns"
          />
        </div>

        {/* AI Priority Banner */}
        {topPriority && (
          <div className="card px-5 py-4 mb-7 flex items-start gap-3 border-l-4 border-l-blue-500 animate-slide-up bg-gradient-to-r from-blue-50/60 to-white">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-0.5">AI Priority Action</p>
              <p className="text-sm text-slate-700 leading-relaxed">{topPriority}</p>
            </div>
            <Link href="/ai-builder" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 shrink-0 mt-0.5">
              Act now <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RFM Cards */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">RFM Segments</h2>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Zap className="w-3 h-3 text-amber-400" />
                Powered by Gemini AI
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
              {rfmData.map(seg => (
                <RFMCard
                  key={seg.segment_label}
                  segment={seg}
                  insight={rfmInsights?.[seg.segment_label]?.insight}
                  action={rfmInsights?.[seg.segment_label]?.action}
                />
              ))}
              {rfmData.length === 0 && (
                <div className="col-span-2 card px-5 py-10 text-center text-slate-400">
                  <p className="text-sm">No RFM data yet. Seed the database to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Segment distribution chart */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Segment Distribution</h2>
              <div className="card p-4">
                {rfmData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={rfmData} layout="vertical" barSize={10}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category" dataKey="segment_label"
                        width={120} tick={{ fill: '#64748b', fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        formatter={(v: any) => [v, 'Customers']}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {rfmData.map(entry => (
                          <Cell key={entry.segment_label} fill={SEGMENT_COLORS[entry.segment_label] || '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
                )}
              </div>
            </div>

            {/* Recent campaigns */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-800">Recent Campaigns</h2>
                <Link href="/campaigns" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5">
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {campaigns.slice(0, 5).map(c => (
                  <div key={c.id} className="card px-4 py-3 flex items-center justify-between hover:shadow-md transition-all">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.channel} · {(c.total_recipients || 0).toLocaleString()} recipients
                      </p>
                    </div>
                    <span className={clsx('ml-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0', STATUS_COLORS[c.status] || STATUS_COLORS.draft)}>
                      {c.status}
                    </span>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="card px-4 py-8 text-center text-slate-400">
                    <Megaphone className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No campaigns yet</p>
                    <Link href="/campaigns" className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 inline-block">
                      Create your first →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
