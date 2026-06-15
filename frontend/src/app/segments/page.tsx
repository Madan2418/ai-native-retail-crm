'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { segmentsApi, aiApi } from '@/lib/api';
import { Plus, Sparkles, Trash2, Users, Loader2, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

type Condition = { field: string; op: string; value: any };
type FilterRules = { operator: 'AND' | 'OR'; conditions: Condition[] };

const FIELD_OPTIONS = [
  { value: 'monetary',      label: 'Total Spend (₹)',      type: 'number' },
  { value: 'recency_days',  label: 'Days Since Last Order', type: 'number' },
  { value: 'frequency',     label: 'Number of Orders',      type: 'number' },
  { value: 'city',          label: 'City',                   type: 'text'   },
  { value: 'tier',          label: 'Tier',                   type: 'select', options: ['bronze','silver','gold','platinum'] },
  { value: 'segment_label', label: 'RFM Segment',            type: 'select', options: ['Champions','Loyal','Potential Loyalists','At Risk','Cannot Lose','Hibernating','Lost'] },
];

const OP_OPTIONS = [
  { value: 'gte', label: '≥ at least' },
  { value: 'lte', label: '≤ at most'  },
  { value: 'gt',  label: '> more than' },
  { value: 'lt',  label: '< less than' },
  { value: 'eq',  label: '= equals'    },
  { value: 'in',  label: 'in (any of)' },
];

const URGENCY_CONFIG: Record<string, { badge: string; dot: string }> = {
  high:   { badge: 'bg-red-50 text-red-600 border-red-100',    dot: 'bg-red-400' },
  medium: { badge: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-400' },
  low:    { badge: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-400' },
};

export default function SegmentsPage() {
  const [segments, setSegments]           = useState<any[]>([]);
  const [creating, setCreating]           = useState(false);
  const [name, setName]                   = useState('');
  const [description, setDescription]     = useState('');
  const [filterRules, setFilterRules]     = useState<FilterRules>({ operator: 'AND', conditions: [] });
  const [previewCount, setPreviewCount]   = useState<number | null>(null);
  const [previewing, setPreviewing]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingAI, setLoadingAI]         = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  async function loadSegments() {
    try { const d = await segmentsApi.list(); setSegments(d); }
    catch (err) { console.error(err); }
  }

  useEffect(() => { loadSegments(); }, []);

  function addCondition() {
    setFilterRules(p => ({ ...p, conditions: [...p.conditions, { field: 'monetary', op: 'gte', value: 1000 }] }));
  }

  function updateCondition(i: number, key: keyof Condition, val: any) {
    setFilterRules(p => {
      const c = [...p.conditions];
      c[i] = { ...c[i], [key]: val };
      return { ...p, conditions: c };
    });
  }

  function removeCondition(i: number) {
    setFilterRules(p => ({ ...p, conditions: p.conditions.filter((_, idx) => idx !== i) }));
    setPreviewCount(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    try { const { count } = await segmentsApi.preview(filterRules); setPreviewCount(count); }
    catch (err) { console.error(err); }
    finally { setPreviewing(false); }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await segmentsApi.create({ name, description, filter_rules: filterRules });
      setCreating(false); setName(''); setDescription('');
      setFilterRules({ operator: 'AND', conditions: [] }); setPreviewCount(null);
      await loadSegments();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this segment? Campaigns using it won\'t be affected.')) return;
    setDeletingId(id);
    try { await segmentsApi.delete(id); await loadSegments(); }
    catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  }

  async function handleAISuggestions() {
    setLoadingAI(true);
    try { setAiSuggestions(await aiApi.suggestSegments()); }
    catch (err) { console.error(err); }
    finally { setLoadingAI(false); }
  }

  function applyAISuggestion(sug: any) {
    setName(sug.label);
    setDescription(sug.description);
    setFilterRules(sug.filter_rules);
    setPreviewCount(null);
    setCreating(true);
    setAiSuggestions([]);
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Segments</h1>
            <p className="text-sm text-slate-500 mt-0.5">Build audiences with filters or AI</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAISuggestions}
              disabled={loadingAI}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-200 bg-violet-50 text-sm text-violet-700 font-semibold hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Suggestions
            </button>
            <button
              onClick={() => { setCreating(true); setAiSuggestions([]); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Segment
            </button>
          </div>
        </div>

        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <div className="mb-6 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" /> AI-Suggested Segments
              </p>
              <button onClick={() => setAiSuggestions([])} className="text-xs text-slate-400 hover:text-slate-600">
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 stagger">
              {aiSuggestions.map((sug, i) => {
                const urg = URGENCY_CONFIG[sug.urgency] || URGENCY_CONFIG.low;
                return (
                  <div
                    key={i}
                    className="card p-4 cursor-pointer hover:shadow-lg transition-all group animate-slide-up"
                    onClick={() => applyAISuggestion(sug)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-bold text-slate-800">{sug.label}</span>
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', urg.badge)}>
                        {sug.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2 leading-relaxed">{sug.description}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-violet-600 font-semibold">{sug.suggested_action}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="card p-6 mb-6 animate-slide-up border-blue-100 bg-blue-50/20">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">
                {name || 'Create Segment'}
              </h2>
              <button onClick={() => { setCreating(false); setName(''); setDescription(''); setFilterRules({ operator: 'AND', conditions: [] }); setPreviewCount(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Segment Name *</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. High-Value Lapsed"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Description</label>
                <input
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            {/* Filter rules */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-slate-600">Match</span>
                <select
                  value={filterRules.operator}
                  onChange={e => setFilterRules(p => ({ ...p, operator: e.target.value as 'AND' | 'OR' }))}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none"
                >
                  <option value="AND">ALL conditions (AND)</option>
                  <option value="OR">ANY condition (OR)</option>
                </select>
              </div>

              <div className="space-y-2.5">
                {filterRules.conditions.map((cond, i) => {
                  const fieldDef = FIELD_OPTIONS.find(f => f.value === cond.field);
                  return (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200">
                      <select
                        value={cond.field}
                        onChange={e => updateCondition(i, 'field', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none"
                      >
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select
                        value={cond.op}
                        onChange={e => updateCondition(i, 'op', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none"
                      >
                        {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {fieldDef?.type === 'select' ? (
                        <select
                          value={cond.value}
                          onChange={e => updateCondition(i, 'value', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none"
                        >
                          {fieldDef.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          value={cond.value}
                          onChange={e => updateCondition(i, 'value', e.target.value)}
                          placeholder="value"
                          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                      )}
                      <button
                        onClick={() => removeCondition(i)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addCondition}
                className="mt-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add condition
              </button>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={handlePreview}
                disabled={previewing || filterRules.conditions.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Preview
              </button>
              {previewCount !== null && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-bold text-emerald-700">{previewCount.toLocaleString()} customers match</span>
                </div>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setCreating(false); setName(''); setDescription(''); setFilterRules({ operator: 'AND', conditions: [] }); setPreviewCount(null); }}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm text-white font-semibold transition-colors shadow-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Segment
              </button>
            </div>
          </div>
        )}

        {/* Segments list */}
        <div className="card overflow-hidden">
          {segments.length === 0 && !creating ? (
            <div className="px-5 py-16 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium mb-1">No segments yet</p>
              <p className="text-xs text-slate-300">Create one manually or get AI suggestions</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Segment', 'Description', 'Customers', 'Created', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segments.map(seg => (
                  <tr key={seg.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{seg.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {seg.filter_rules?.conditions?.length || 0} condition{(seg.filter_rules?.conditions?.length || 0) !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{seg.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-700 font-mono text-xs">
                          {(seg.actual_count ?? seg.customer_count).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(seg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/campaigns?segment=${seg.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          onClick={e => e.stopPropagation()}
                        >
                          Use →
                        </Link>
                        <button
                          onClick={() => handleDelete(seg.id)}
                          disabled={deletingId === seg.id}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                        >
                          {deletingId === seg.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
