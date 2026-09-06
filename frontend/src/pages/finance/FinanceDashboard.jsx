// src/pages/finance/FinanceDashboard.jsx
//
// Changes vs uploaded version:
//   • Removed hierarchy filter entirely — only "All Departments" dropdown remains
//   • Date sort — clickable "Date" column header toggles newest/oldest first
//   • Amount sort — clickable "Amount" column header toggles high/low
//   • Date range filter — "From" and "To" date pickers filter queue by submittedAt
//   • Sort and date filters are local (applied to the current page data) so no
//     extra API calls needed; they reset when filter/dept/page changes
//   • Removed "Needs Review" elements from queue filters and sidebar stats

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFinanceDashboard, getFinanceQueue } from '../../api/finance.api';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ── Dept Donut ────────────────────────────────────────────────────────────────
function DeptDonut({ data = [] }) {
  const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
  const total  = data.reduce((s, d) => s + d.amount, 0) || 1;
  const r = 38, circ = 2 * Math.PI * r;
  let offset = 0;

  const compact = (n) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor"
              strokeWidth="14" className="text-gray-100 dark:text-gray-800" />
            {data.map((d, i) => {
              const dash = (d.amount / total) * circ;
              const el = (
                <circle key={i} cx="50" cy="50" r={r} fill="none"
                  stroke={COLORS[i % COLORS.length]} strokeWidth="14"
                  strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset} />
              );
              offset += dash;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xs font-black text-gray-800 dark:text-white leading-tight">{compact(total)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">Total</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-gray-500 dark:text-gray-400 truncate">{d.name}</span>
              </div>
              <span className="font-bold text-gray-700 dark:text-gray-300 flex-shrink-0 whitespace-nowrap">
                {compact(d.amount)}
              </span>
            </div>
          ))}
          {!data.length && <p className="text-xs text-gray-400 dark:text-gray-500">No approved requests yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Sort indicator icon ───────────────────────────────────────────────────────
function SortIcon({ active, direction }) {
  return (
    <span className={`ml-1 inline-flex flex-col text-[8px] leading-none ${active ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>
      <span className={direction === 'asc' && active ? 'text-amber-500' : ''}>▲</span>
      <span className={direction === 'desc' && active ? 'text-amber-500' : ''}>▼</span>
    </span>
  );
}

const QUEUE_FILTERS = [
  { label: 'Pending',  value: null,       color: 'text-amber-500' },
  { label: 'Approved', value: 'approved', color: 'text-green-500'  },
  { label: 'Rejected', value: 'rejected', color: 'text-red-500'    },
];

export default function FinanceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const filterRef = useRef(null);
  const deptRef   = useRef('');
  const pageRef   = useRef(1);
  const isFirstMount = useRef(true);

  const [stats, setStats]   = useState(null);
  const [queue, setQueue]   = useState([]);
  const [qTotal, setQTotal] = useState(0);

  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState([]);

  const [activeFilter, setActiveFilter] = useState(null);
  const [qPage, setQPage] = useState(1);

  // Search
  const [search, setSearch]                   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // Sort state: field = 'date' | 'amount' | null, dir = 'asc' | 'desc'
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir]     = useState('desc'); // newest first by default

  const [loading, setLoading]   = useState(true);
  const [qLoading, setQLoading] = useState(false);
  const LIMIT = 5;

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(h);
  }, [search]);

  // ── Fetch stats ─────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async (deptId) => {
    try {
      const res = await getFinanceDashboard({ dept: deptId || undefined });
      setStats(res.data.data);
      if (res.data.data?.departments) setAvailableDepts(res.data.data.departments);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, []);

  // ── Fetch queue ─────────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async (statusFilter, pg, deptId, searchVal) => {
    setQLoading(true);
    try {
      const res = await getFinanceQueue({
        page:   pg,
        limit:  LIMIT,
        status: statusFilter !== undefined ? statusFilter : null,
        dept:   deptId || undefined,
        search: searchVal || undefined,
      });
      setQueue(res.data.data || []);
      setQTotal(res.data.pagination?.total || 0);
    } catch {
      setQueue([]); setQTotal(0);
    } finally {
      setQLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchStats(''),
      fetchQueue(null, 1, '', ''),
    ]).finally(() => setLoading(false));
  }, [fetchStats, fetchQueue]);

  // Search debounce effect
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    pageRef.current = 1;
    setQPage(1);
    fetchQueue(filterRef.current, 1, deptRef.current, debouncedSearch);
  }, [debouncedSearch, fetchQueue]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleDeptChange = (e) => {
    const v = e.target.value;
    setSelectedDept(v); deptRef.current = v;
    setQPage(1); pageRef.current = 1;
    fetchStats(v);
    fetchQueue(filterRef.current, 1, v, debouncedSearch);
  };

  const handleFilter = (filter) => {
    setActiveFilter(filter); filterRef.current = filter;
    setQPage(1); pageRef.current = 1;
    setSearch(''); setDateFrom(''); setDateTo('');
    setSortField('date'); setSortDir('desc');
    fetchQueue(filter, 1, deptRef.current, '');
  };

  const handleQPage = (pg) => {
    setQPage(pg); pageRef.current = pg;
    fetchQueue(filterRef.current, pg, deptRef.current, debouncedSearch);
  };

  // Toggle sort — clicking same field reverses direction; new field defaults to desc
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ── Client-side filter + sort ─────────────────────────────────────────────
  // Applied to the current page of results so no extra API round-trips
  const displayed = [...queue]
    // Date range filter
    .filter(req => {
      if (!dateFrom && !dateTo) return true;
      const d = new Date(req.submittedAt || req.createdAt);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    })
    // Sort
    .sort((a, b) => {
      if (sortField === 'amount') {
        const diff = parseFloat(a.amount) - parseFloat(b.amount);
        return sortDir === 'asc' ? diff : -diff;
      }
      // default: date
      const diff = new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt);
      return sortDir === 'asc' ? diff : -diff;
    });

  const counts        = stats?.counts         || {};
  const amounts       = stats?.amounts        || {};
  const deptData      = stats?.departmentSpending || [];
  const recentApproved = stats?.recentApproved || [];
  const totalQPages   = Math.ceil(qTotal / LIMIT);

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto space-y-5 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Finance Portal</p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Finance overview of fund requests</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {/* Department filter only — hierarchy removed */}
            <select value={selectedDept} onChange={handleDeptChange}
              className="bg-white dark:bg-[#13151f] border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all cursor-pointer shadow-sm">
              <option value="">All Departments</option>
              {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <Link to="/finance/queue"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-105">
              Open Queue
              {(counts.pending ?? 0) > 0 && (
                <span className="bg-white text-amber-600 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {counts.pending}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Amount summary cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Pending Amount',  value: formatCurrency(amounts.pending  ?? 0), sub: `${counts.pending  ?? 0} requests`, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/5',  border: 'border-amber-200 dark:border-amber-500/20',  filter: null       },
            { label: 'Approved Amount', value: formatCurrency(amounts.approved ?? 0), sub: `${counts.approved ?? 0} requests`, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/5',  border: 'border-green-200 dark:border-green-500/20',  filter: 'approved' },
            { label: 'Rejected Amount', value: formatCurrency(amounts.rejected ?? 0), sub: `${counts.rejected ?? 0} requests`, color: 'text-red-500',   bg: 'bg-red-50   dark:bg-red-500/5',    border: 'border-red-200   dark:border-red-500/20',    filter: 'rejected' },
          ].map(c => (
            <div key={c.label} onClick={() => c.filter !== undefined && handleFilter(c.filter)}
              className={`${c.bg} border ${c.border} rounded-2xl p-4 cursor-pointer hover:scale-[1.03] transition-all`}>
              <p className={`text-lg font-black ${c.color} leading-tight`}>{c.value}</p>
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1">{c.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-5">

            {/* Queue table */}
            <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl overflow-hidden">

              {/* Toolbar row 1: status filters + search */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-amber-100 dark:border-[#1e2235]">
                <div className="flex gap-1 flex-1 min-w-0 flex-wrap">
                  {QUEUE_FILTERS.map(f => (
                    <button key={String(f.value)} onClick={() => handleFilter(f.value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5
                        ${activeFilter === f.value
                          ? 'bg-amber-500 text-white'
                          : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-600 dark:text-gray-400 hover:bg-amber-100 dark:hover:bg-[#2a2d3e]'}`}>
                      {f.label}
                      <span className={`text-xs px-1 rounded font-black ${activeFilter === f.value ? 'bg-white/20 text-white' : 'text-gray-400'}`}>
                        {f.value === null       ? counts.pending      ?? 0
                          : f.value === 'approved' ? counts.approved  ?? 0
                          : counts.rejected ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="relative flex-shrink-0">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search queue…"
                    className="pl-8 pr-3 py-1.5 text-xs bg-amber-50 dark:bg-[#1a1d2e] border border-amber-200 dark:border-[#2a2d3e] rounded-lg text-gray-800 dark:text-gray-200 w-36 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-400 dark:placeholder-gray-600" />
                </div>
              </div>

              {/* Toolbar row 2: date range filter */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-amber-50/50 dark:bg-[#0f1117] border-b border-amber-100 dark:border-[#1e2235]">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
                  📅 Filter by date:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="text-xs bg-white dark:bg-black border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400 [color-scheme:light] dark:[color-scheme:dark]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">To</label>
                    <input type="date" value={dateTo} min={dateFrom || undefined}
                      onChange={e => setDateTo(e.target.value)}
                      className="text-xs bg-white dark:bg-black border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400 [color-scheme:light] dark:[color-scheme:dark]" />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="text-xs text-red-400 hover:text-red-500 font-bold px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 transition-colors">
                      ✕ Clear
                    </button>
                  )}
                </div>
                {(dateFrom || dateTo) && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold ml-auto">
                    Showing {displayed.length} result{displayed.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Table */}
              {qLoading ? (
                <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
              ) : !displayed.length ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {search || dateFrom || dateTo
                      ? 'No matching requests found'
                      : `No ${QUEUE_FILTERS.find(f => f.value === activeFilter)?.label.toLowerCase()} requests`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="block md:hidden divide-y divide-amber-50 dark:divide-[#1a1d2e]">
                    {displayed.map(req => (
                      <div key={req.id} onClick={() => navigate(`/finance/requests/${req.id}`)}
                        className="p-4 hover:bg-amber-50 dark:hover:bg-[#1a1d2e] cursor-pointer transition-colors">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1 pr-2 truncate">{req.title}</p>
                          <p className="text-sm font-black text-amber-500 flex-shrink-0">{formatCurrency(req.amount)}</p>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {req.createdBy?.name} · {req.createdBy?.department?.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {formatDate(req.submittedAt || req.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table with sortable headers */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-amber-50 dark:border-[#1e2235]">
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3 whitespace-nowrap">ID</th>
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3">Title</th>
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3 whitespace-nowrap">Dept</th>
                          {/* Sortable: Amount */}
                          <th
                            onClick={() => handleSort('amount')}
                            className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3 whitespace-nowrap cursor-pointer hover:text-amber-500 transition-colors select-none">
                            Amount
                            <SortIcon active={sortField === 'amount'} direction={sortDir} />
                          </th>
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3 whitespace-nowrap">Requested By</th>
                          {/* Sortable: Date */}
                          <th
                            onClick={() => handleSort('date')}
                            className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3 whitespace-nowrap cursor-pointer hover:text-amber-500 transition-colors select-none">
                            Date
                            <SortIcon active={sortField === 'date'} direction={sortDir} />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50 dark:divide-[#1a1d2e]">
                        {displayed.map(req => (
                          <tr key={req.id} onClick={() => navigate(`/finance/requests/${req.id}`)}
                            className="hover:bg-amber-50 dark:hover:bg-[#1a1d2e] cursor-pointer transition-colors group">
                            <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">
                              {req.requestNumber?.slice(0, 14)}
                            </td>
                            <td className="px-4 py-3 max-w-[160px]">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-amber-500 transition-colors">
                                {req.title}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {req.createdBy?.department?.name}
                            </td>
                            <td className="px-4 py-3 text-sm font-black text-gray-800 dark:text-gray-200 whitespace-nowrap">
                              {formatCurrency(req.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {req.createdBy?.name}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {formatDate(req.submittedAt || req.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalQPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-amber-100 dark:border-[#1e2235]">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {(qPage - 1) * LIMIT + 1}–{Math.min(qPage * LIMIT, qTotal)} of {qTotal}
                      </p>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(totalQPages, 5) }, (_, i) => i + 1).map(p => (
                          <button key={p} onClick={() => handleQPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                              ${qPage === p ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 hover:bg-amber-100'}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Latest Approved */}
            {recentApproved.length > 0 && (
              <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-black text-gray-800 dark:text-white">Latest Approved</p>
                  <button onClick={() => handleFilter('approved')} className="text-xs font-bold text-amber-500 hover:text-amber-600">View all →</button>
                </div>
                <div className="space-y-2">
                  {recentApproved.map(req => (
                    <div key={req.id} onClick={() => navigate(`/finance/requests/${req.id}`)}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-amber-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <div className="w-7 h-7 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center text-green-500 flex-shrink-0 text-xs font-bold">✓</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{req.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{req.createdBy?.name}</p>
                      </div>
                      <p className="text-xs font-black text-green-500 flex-shrink-0">{formatCurrency(req.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="flex flex-col gap-5">

            {/* Request summary */}
            <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-5">
              <p className="text-sm font-black text-gray-800 dark:text-white mb-4">Request Summary</p>
              <div className="space-y-3">
                {[
                  { l: 'Pending',  v: counts.pending     ?? 0, c: 'bg-amber-500', f: null       },
                  { l: 'Approved', v: counts.approved    ?? 0, c: 'bg-green-500', f: 'approved' },
                  { l: 'Rejected', v: counts.rejected    ?? 0, c: 'bg-red-500',   f: 'rejected' },
                ].map(i => {
                  const t = Object.values(counts).reduce((s, v) => s + (v || 0), 0) || 1;
                  return (
                    <div key={i.l} onClick={() => handleFilter(i.f)} className="cursor-pointer group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">{i.l}</span>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">{i.v}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <div className={`h-full ${i.c} rounded-full transition-all`}
                          style={{ width: `${Math.round((i.v / t) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dept spending donut */}
            <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-5">
              <p className="text-sm font-black text-gray-800 dark:text-white mb-1">Dept. Spending</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                {selectedDept ? 'Approved requests for selected dept.' : 'Approved requests by dept.'}
              </p>
              <DeptDonut data={deptData} />
            </div>

            {/* Insights */}
            <div className="bg-amber-500 rounded-2xl p-5 text-white">
              <p className="text-sm font-black mb-1">Finance Insights</p>
              <p className="text-xs text-amber-100 mb-4">This month</p>
              <div className="space-y-2.5">
                {[
                  { l: 'Total Processed', v: `${(counts.approved ?? 0) + (counts.rejected ?? 0)} requests` },
                  {
                    l: 'Approval Rate',
                    v: (() => {
                      const t = (counts.approved ?? 0) + (counts.rejected ?? 0);
                      return t ? `${Math.round(((counts.approved ?? 0) / t) * 100)}%` : '—';
                    })(),
                  },
                ].map(i => (
                  <div key={i.l} className="bg-white/15 rounded-xl px-3 py-2">
                    <p className="text-xs text-amber-200">{i.l}</p>
                    <p className="text-sm font-black mt-0.5">{i.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}