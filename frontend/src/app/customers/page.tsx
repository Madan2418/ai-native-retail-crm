'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { customersApi } from '@/lib/api';
import { Search, X, ShoppingBag, MapPin, Star, TrendingUp, Clock } from 'lucide-react';
import clsx from 'clsx';

const SEGMENT_STYLES: Record<string, string> = {
  'Champions':           'bg-blue-50 text-blue-700',
  'Loyal':               'bg-violet-50 text-violet-700',
  'Potential Loyalists': 'bg-emerald-50 text-emerald-700',
  'At Risk':             'bg-amber-50 text-amber-700',
  'Cannot Lose':         'bg-red-50 text-red-700',
  'Hibernating':         'bg-slate-100 text-slate-600',
  'Lost':                'bg-slate-100 text-slate-400',
};

const TIER_STYLES: Record<string, { badge: string; dot: string }> = {
  platinum: { badge: 'bg-cyan-50 text-cyan-700',   dot: 'bg-cyan-400' },
  gold:     { badge: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
  silver:   { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  bronze:   { badge: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
};

const LIMIT = 50;

function CustomerModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customersApi.get(customer.id)
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customer.id]);

  const tier = TIER_STYLES[customer.tier] || TIER_STYLES.bronze;

  return (
    <div className="modal-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
              <p className="text-sm text-slate-500">{customer.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', tier.badge)}>
                  {customer.tier}
                </span>
                {customer.segment_label && (
                  <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', SEGMENT_STYLES[customer.segment_label] || SEGMENT_STYLES['Lost'])}>
                    {customer.segment_label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* RFM Stats */}
          <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
            {[
              { icon: TrendingUp, label: 'Total Spend', value: customer.monetary ? `₹${Number(customer.monetary).toLocaleString('en-IN')}` : '—', color: 'text-emerald-600' },
              { icon: ShoppingBag, label: 'Orders', value: customer.frequency ?? '—', color: 'text-blue-600' },
              { icon: Clock, label: 'Last Order', value: customer.recency_days != null ? `${customer.recency_days}d ago` : '—', color: 'text-amber-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="px-6 py-4 text-center border-r border-slate-100 last:border-r-0">
                <Icon className={clsx('w-4 h-4 mx-auto mb-1.5', color)} />
                <p className="text-xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {customer.city && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{customer.city}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 text-xs font-mono">📱</span>
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order History */}
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Order History</h3>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 shimmer rounded-lg" />)}
              </div>
            ) : detail?.orders?.length > 0 ? (
              <div className="space-y-2">
                {detail.orders.slice(0, 10).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{order.product_name || 'Order'}</p>
                      <p className="text-xs text-slate-400">{order.product_category} · {new Date(order.ordered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">₹{Number(order.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No orders found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers]       = useState<any[]>([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [segFilter, setSegFilter]       = useState('');
  const [loading, setLoading]           = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await customersApi.list({
        page, limit: LIMIT,
        search: search || undefined,
        segment_label: segFilter || undefined,
      });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, segFilter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Customers</h1>
            <p className="text-sm text-slate-500 mt-0.5">{total.toLocaleString()} total shoppers</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </form>
          <select
            value={segFilter}
            onChange={e => { setSegFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Segments</option>
            {['Champions', 'Loyal', 'Potential Loyalists', 'At Risk', 'Cannot Lose', 'Hibernating', 'Lost'].map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Customer', 'City', 'Tier', 'Orders', 'Total Spend', 'Last Order', 'Segment'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(12)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                  : customers.map(c => {
                    const tier = TIER_STYLES[c.tier] || TIER_STYLES.bronze;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCustomer(c)}
                        className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{c.name}</div>
                              <div className="text-xs text-slate-400">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{c.city || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={clsx('w-1.5 h-1.5 rounded-full', tier.dot)} />
                            <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded', tier.badge)}>
                              {c.tier}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs font-semibold">{c.frequency ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs font-semibold">
                          {c.monetary ? `₹${Number(c.monetary).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {c.recency_days != null ? `${c.recency_days}d ago` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.segment_label ? (
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', SEGMENT_STYLES[c.segment_label] || SEGMENT_STYLES['Lost'])}>
                              {c.segment_label}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-500">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3 text-center">Click any row to view customer details & order history</p>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </AppLayout>
  );
}
