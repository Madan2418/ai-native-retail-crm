'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { campaignsApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line,
} from 'recharts';
import { TrendingUp, Send, MousePointerClick, Mail, MessageCircle } from 'lucide-react';
import clsx from 'clsx';

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: '💬',
  sms: '📱',
  email: '📧',
  rcs: '🔵',
};

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: '#25d366',
  sms: '#3b82f6',
  email: '#7c3aed',
  rcs: '#06b6d4',
};

function MetricCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {Icon && <Icon className={clsx('w-4 h-4', color)} />}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-blue-600 mt-0.5 font-medium">{sub}</p>}
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 12,
  color: '#0f172a',
};

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    campaignsApi.list()
      .then(d => setCampaigns(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totals = campaigns.reduce((acc, c) => ({
    sent:      (acc.sent      || 0) + (c.sent      || 0),
    delivered: (acc.delivered || 0) + (c.delivered || 0),
    opened:    (acc.opened    || 0) + (c.opened    || 0),
    clicked:   (acc.clicked   || 0) + (c.clicked   || 0),
    failed:    (acc.failed    || 0) + (c.failed    || 0),
  }), {} as any);

  const deliveryRate = totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) : '0';
  const openRate     = totals.sent > 0 ? ((totals.opened    / totals.sent) * 100).toFixed(1) : '0';
  const clickRate    = totals.sent > 0 ? ((totals.clicked   / totals.sent) * 100).toFixed(1) : '0';

  const channelBreakdown: any[] = Object.values(
    campaigns.reduce((acc: any, c) => {
      const key = c.channel;
      if (!acc[key]) acc[key] = { channel: key, sent: 0, delivered: 0, opened: 0, clicked: 0, count: 0 };
      acc[key].sent      += (c.sent      || 0);
      acc[key].delivered += (c.delivered || 0);
      acc[key].opened    += (c.opened    || 0);
      acc[key].clicked   += (c.clicked   || 0);
      acc[key].count     += 1;
      return acc;
    }, {})
  );

  const campaignPerf = campaigns.slice(0, 8).map(c => ({
    name:      c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name,
    Sent:      c.sent      || 0,
    Delivered: c.delivered || 0,
    Opened:    c.opened    || 0,
    Clicked:   c.clicked   || 0,
  }));

  const funnelData = [
    { name: 'Sent',      value: totals.sent      || 0, color: '#2563eb', pct: 100 },
    { name: 'Delivered', value: totals.delivered || 0, color: '#7c3aed',
      pct: totals.sent > 0 ? +((totals.delivered / totals.sent) * 100).toFixed(1) : 0 },
    { name: 'Opened',    value: totals.opened    || 0, color: '#059669',
      pct: totals.sent > 0 ? +((totals.opened / totals.sent) * 100).toFixed(1) : 0 },
    { name: 'Clicked',   value: totals.clicked   || 0, color: '#d97706',
      pct: totals.sent > 0 ? +((totals.clicked / totals.sent) * 100).toFixed(1) : 0 },
  ];

  // Campaign performance rate table (sorted by click rate)
  const campRateTable = campaigns
    .filter(c => (c.sent || 0) > 0)
    .map(c => ({
      ...c,
      delivery_rate: c.sent > 0 ? ((c.delivered || 0) / c.sent * 100).toFixed(1) : '0',
      open_rate:     c.sent > 0 ? ((c.opened    || 0) / c.sent * 100).toFixed(1) : '0',
      click_rate:    c.sent > 0 ? ((c.clicked   || 0) / c.sent * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => parseFloat(b.click_rate) - parseFloat(a.click_rate));

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="grid grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <div key={i} className="card h-20 shimmer" />)}</div>
          <div className="grid grid-cols-2 gap-6">{[...Array(4)].map((_, i) => <div key={i} className="card h-64 shimmer" />)}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cross-campaign performance overview</p>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger">
          <MetricCard label="Total Campaigns"  value={campaigns.length}                             icon={MessageCircle}    color="text-blue-500" />
          <MetricCard label="Messages Sent"    value={(totals.sent || 0).toLocaleString()}          icon={Send}             color="text-violet-500" sub={`${deliveryRate}% delivery`} />
          <MetricCard label="Total Opens"      value={(totals.opened || 0).toLocaleString()}        icon={Mail}             color="text-emerald-500" sub={`${openRate}% open rate`} />
          <MetricCard label="Total Clicks"     value={(totals.clicked || 0).toLocaleString()}       icon={MousePointerClick} color="text-amber-500" sub={`${clickRate}% click rate`} />
        </div>

        {/* Funnel */}
        <div className="mb-7">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Aggregate Engagement Funnel</h2>
          <div className="card p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {funnelData.map((item, idx) => {
                const height = Math.max(32, (item.value / (funnelData[0].value || 1)) * 140);
                return (
                  <div key={item.name} className="flex flex-col items-center animate-slide-up" style={{ animationDelay: `${idx * 80}ms` }}>
                    <div className="relative w-full flex items-end justify-center" style={{ height: 144 }}>
                      <div
                        className="w-full rounded-t-xl transition-all duration-700"
                        style={{ height, backgroundColor: `${item.color}20`, border: `1px solid ${item.color}40` }}
                      />
                      <div
                        className="absolute bottom-0 w-full rounded-t-xl"
                        style={{ height: Math.max(4, height * 0.15), backgroundColor: item.color, opacity: 0.7 }}
                      />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-3">{item.value.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.name}</div>
                    <div className="text-sm font-bold mt-1" style={{ color: item.color }}>{item.pct}%</div>
                    {idx < funnelData.length - 1 && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        → {funnelData[idx + 1].pct}% →
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">
          {/* Campaign performance bar chart */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-3">Campaign Performance</h2>
            <div className="card p-5">
              {campaignPerf.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={campaignPerf} barSize={6} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={40} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                    <Bar dataKey="Sent"      fill="#2563eb" radius={[3,3,0,0]} />
                    <Bar dataKey="Delivered" fill="#7c3aed" radius={[3,3,0,0]} />
                    <Bar dataKey="Opened"    fill="#059669" radius={[3,3,0,0]} />
                    <Bar dataKey="Clicked"   fill="#d97706" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-300 text-sm">No campaign data yet</div>
              )}
            </div>
          </div>

          {/* Channel breakdown */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-3">By Channel</h2>
            <div className="card p-5">
              {channelBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={channelBreakdown} layout="vertical" barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis
                      type="category" dataKey="channel"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      width={75}
                      tickFormatter={v => `${CHANNEL_ICON[v] || ''} ${v}`}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                    <Bar dataKey="sent"      fill="#2563eb" radius={[0,3,3,0]} name="Sent" />
                    <Bar dataKey="delivered" fill="#7c3aed" radius={[0,3,3,0]} name="Delivered" />
                    <Bar dataKey="opened"    fill="#059669" radius={[0,3,3,0]} name="Opened" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-300 text-sm">No channel data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Campaign Rate Table */}
        {campRateTable.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-3">Campaign Rate Leaderboard</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Campaign', 'Channel', 'Sent', 'Delivery%', 'Open%', 'Click%'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campRateTable.map((c, idx) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300 w-4">{idx + 1}</span>
                          <span className="font-medium text-slate-800 truncate max-w-[150px]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{CHANNEL_ICON[c.channel]} {c.channel}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{(c.sent || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min(parseFloat(c.delivery_rate), 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono text-slate-600 w-8">{c.delivery_rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(parseFloat(c.open_rate), 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono text-slate-600 w-8">{c.open_rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(parseFloat(c.click_rate) * 3, 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono font-semibold text-amber-600 w-8">{c.click_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
