'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { campaignsApi, segmentsApi, aiApi } from '@/lib/api';
import { Plus, Megaphone, Loader2, Sparkles, BarChart3, Play, X, Trash2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const CHANNELS = [
  { value: 'whatsapp', label: '💬 WhatsApp', color: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'sms',      label: '📱 SMS',      color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'email',    label: '📧 Email',    color: 'text-violet-700 bg-violet-50 border-violet-200' },
  { value: 'rcs',      label: '🔵 RCS',      color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
];

const STATUS_STYLES: Record<string, string> = {
  running:   'bg-emerald-100 text-emerald-700',
  done:      'bg-slate-100 text-slate-500',
  draft:     'bg-amber-100 text-amber-700',
  scheduled: 'bg-blue-100 text-blue-700',
};

const CHANNEL_STYLES: Record<string, string> = {
  whatsapp: 'bg-green-50 text-green-700',
  sms:      'bg-blue-50 text-blue-700',
  email:    'bg-violet-50 text-violet-700',
  rcs:      'bg-cyan-50 text-cyan-700',
};

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: '💬', sms: '📱', email: '📧', rcs: '🔵',
};

function FunnelBar({ label, value, total, color, bgColor }: any) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <span className="text-xs font-mono text-slate-700 font-semibold">
          {value.toLocaleString()} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className={clsx('h-2 rounded-full overflow-hidden', bgColor || 'bg-slate-100')}>
        <div
          className={clsx('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns]       = useState<any[]>([]);
  const [segments, setSegments]         = useState<any[]>([]);
  const [creating, setCreating]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [selectedCamp, setSelectedCamp] = useState<any>(null);
  const [campStats, setCampStats]       = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [aiInsight, setAiInsight]       = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const [name, setName]         = useState('');
  const [segId, setSegId]       = useState('');
  const [channel, setChannel]   = useState('whatsapp');
  const [template, setTemplate] = useState('');
  const [launch, setLaunch]     = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [camps, segs] = await Promise.all([campaignsApi.list(), segmentsApi.list()]);
      setCampaigns(camps);
      setSegments(segs);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!name || !segId || !template) return;
    setSaving(true);
    try {
      await campaignsApi.create({ name, segment_id: segId, channel, message_template: template, launch });
      setCreating(false); setName(''); setSegId(''); setTemplate('');
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function openStats(camp: any) {
    setSelectedCamp(camp); setCampStats(null); setAiInsight(null); setLoadingStats(true);
    try { setCampStats(await campaignsApi.stats(camp.id)); }
    finally { setLoadingStats(false); }
  }

  async function handleAIInsight() {
    if (!selectedCamp || loadingInsight) return;
    setLoadingInsight(true);
    try {
      const d = await aiApi.explainPerformance(selectedCamp.id);
      setAiInsight(d.insights);
    } catch (err) { console.error(err); }
    finally { setLoadingInsight(false); }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this campaign?')) return;
    setDeleting(id);
    try {
      await campaignsApi.delete(id);
      if (selectedCamp?.id === id) { setSelectedCamp(null); setCampStats(null); }
      await load();
    } catch (err) { console.error(err); }
    finally { setDeleting(null); }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Campaigns</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create and launch personalised campaigns</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-semibold transition-all shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="card p-6 mb-6 animate-slide-up border-blue-100 bg-blue-50/30">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">New Campaign</h2>
              <button onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Campaign Name</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Win-Back Champions"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Segment</label>
                <select
                  value={segId} onChange={e => setSegId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">Select a segment...</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.actual_count ?? s.customer_count} customers)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Channel</label>
              <div className="flex gap-2">
                {CHANNELS.map(ch => (
                  <button
                    key={ch.value}
                    onClick={() => setChannel(ch.value)}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                      channel === ch.value ? ch.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Message Template{' '}
                <span className="text-slate-400 font-normal">— use {'{name}'} · AI will personalize each message</span>
              </label>
              <textarea
                value={template} onChange={e => setTemplate(e.target.value)}
                rows={4}
                placeholder={`Hi {name}, we have a special offer just for you! ...`}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={launch} onChange={e => setLaunch(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-slate-600">Launch immediately (AI personalizes each message)</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setCreating(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !name || !segId || !template}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm text-white font-semibold transition-all shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {launch ? 'Launch Campaign' : 'Save Draft'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign list */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="card h-16 shimmer" />)}
              </div>
            ) : (
              <div className="card overflow-hidden">
                {campaigns.length === 0 ? (
                  <div className="px-5 py-16 text-center text-slate-400">
                    <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium mb-1">No campaigns yet</p>
                    <p className="text-xs">Create your first campaign or use the AI Builder</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Campaign', 'Channel', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Status', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider last:w-8">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map(camp => (
                          <tr
                            key={camp.id}
                            onClick={() => openStats(camp)}
                            className={clsx(
                              'border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group',
                              selectedCamp?.id === camp.id && 'bg-blue-50 hover:bg-blue-50 border-l-2 border-l-blue-500'
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 truncate max-w-[160px]">{camp.name}</div>
                              <div className="text-xs text-slate-400">{camp.segment_name}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', CHANNEL_STYLES[camp.channel] || 'bg-slate-100 text-slate-600')}>
                                {CHANNEL_ICON[camp.channel]} {camp.channel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-700">{(camp.sent ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-700">{(camp.delivered ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-700">{(camp.opened ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-700">{(camp.clicked ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', STATUS_STYLES[camp.status] || STATUS_STYLES.draft)}>
                                {camp.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <button
                                onClick={e => handleDelete(camp.id, e)}
                                disabled={deleting === camp.id}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 rounded"
                              >
                                {deleting === camp.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />
                                }
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats panel */}
          <div>
            {selectedCamp ? (
              <div className="card p-5 animate-slide-in">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedCamp.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', CHANNEL_STYLES[selectedCamp.channel] || 'bg-slate-100 text-slate-600')}>
                        {CHANNEL_ICON[selectedCamp.channel]} {selectedCamp.channel}
                      </span>
                      <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', STATUS_STYLES[selectedCamp.status] || STATUS_STYLES.draft)}>
                        {selectedCamp.status}
                      </span>
                    </div>
                  </div>
                </div>

                {loadingStats ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-8 shimmer rounded-lg" />)}
                  </div>
                ) : campStats ? (
                  <>
                    <div className="space-y-3 mb-5">
                      <FunnelBar label="Sent"      value={campStats.funnel.sent}      total={campStats.funnel.total} color="bg-slate-400"   bgColor="bg-slate-100" />
                      <FunnelBar label="Delivered" value={campStats.funnel.delivered} total={campStats.funnel.total} color="bg-blue-500"    bgColor="bg-blue-100" />
                      <FunnelBar label="Opened"    value={campStats.funnel.opened}    total={campStats.funnel.total} color="bg-violet-500"  bgColor="bg-violet-100" />
                      <FunnelBar label="Clicked"   value={campStats.funnel.clicked}   total={campStats.funnel.total} color="bg-emerald-500" bgColor="bg-emerald-100" />
                      <FunnelBar label="Converted" value={campStats.funnel.converted} total={campStats.funnel.total} color="bg-amber-500"   bgColor="bg-amber-100" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        ['Delivery', campStats.funnel.delivery_rate, 'text-blue-600'],
                        ['Open', campStats.funnel.open_rate, 'text-violet-600'],
                        ['Click', campStats.funnel.click_rate, 'text-emerald-600'],
                        ['Convert', campStats.funnel.conversion_rate, 'text-amber-600'],
                      ].map(([l, v, c]) => (
                        <div key={l as string} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                          <div className={clsx('text-lg font-bold', c)}>{v}%</div>
                          <div className="text-[10px] text-slate-400 font-medium">{l} rate</div>
                        </div>
                      ))}
                    </div>

                    {!aiInsight ? (
                      <button
                        onClick={handleAIInsight}
                        disabled={loadingInsight}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-violet-200 bg-violet-50 text-sm text-violet-700 font-semibold hover:bg-violet-100 transition-colors disabled:opacity-60"
                      >
                        {loadingInsight ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {loadingInsight ? 'Analyzing…' : 'AI Explain Performance'}
                      </button>
                    ) : (
                      <div className="border-t border-slate-100 pt-4 animate-fade-in">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Sparkles className="w-3 h-3 text-violet-500" />
                          <span className="text-xs font-bold text-violet-700">AI Analysis</span>
                          <span className={clsx(
                            'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                            aiInsight.performance_grade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                            aiInsight.performance_grade === 'B' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            Grade {aiInsight.performance_grade}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-3 leading-relaxed">{aiInsight.summary}</p>
                        {aiInsight.recommendations?.map((r: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 mb-2">
                            <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="card p-10 text-center text-slate-400">
                <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a campaign</p>
                <p className="text-xs mt-0.5 text-slate-300">to view funnel stats</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
