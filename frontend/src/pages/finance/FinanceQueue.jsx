// src/pages/finance/FinanceQueue.jsx
//
// Changes vs uploaded version:
//   • Department filter (All Departments dropdown) — consistent with dashboard
//   • Date range filter — From / To date pickers
//   • Sortable Amount column — click to toggle high/low
//   • Sortable Date column   — click to toggle newest/oldest (default: newest)
//   • Search bar for title / request number / requester name
//   • All sorts and date filters are client-side on the current page

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFinanceQueue, getFinanceDashboard } from '../../api/finance.api';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import StatusBadge from '../../components/UI/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';

function SortIcon({ active, direction }) {
  return (
    <span className={`ml-1 inline-flex flex-col text-[8px] leading-none ${active ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>
      <span className={direction === 'asc'  && active ? 'text-amber-500' : ''}>▲</span>
      <span className={direction === 'desc' && active ? 'text-amber-500' : ''}>▼</span>
    </span>
  );
}

const STATUS_TABS = [
  { label: 'Pending',  value: null       },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  
];

export default function FinanceQueue() {
  const navigate = useNavigate();

  const [requests, setRequests]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [activeStatus, setStatus] = useState(null);

  // Filters
  const [search, setSearch]                   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept]       = useState('');
  const [availableDepts, setAvailableDepts]   = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // Sort
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir]     = useState('desc');

  const deptRef   = useRef('');
  const statusRef = useRef(null);
  const LIMIT = 10;

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(h);
  }, [search]);

  // Load dept list once
  useEffect(() => {
    getFinanceDashboard().then(r => {
      if (r.data.data?.departments) setAvailableDepts(r.data.data.departments);
    }).catch(() => {});
  }, []);

  const fetchQueue = useCallback(async (pg, status, dept, searchVal) => {
    setLoading(true);
    try {
      const res = await getFinanceQueue({
        page:   pg,
        limit:  LIMIT,
        status: status,
        dept:   dept || undefined,
        search: searchVal || undefined,
      });
      setRequests(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setRequests([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(1, null, '', '');
  }, [fetchQueue]);

  // Re-fetch when debounced search changes
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setPage(1);
    fetchQueue(1, statusRef.current, deptRef.current, debouncedSearch);
  }, [debouncedSearch, fetchQueue]);

  const handleStatus = (s) => {
    setStatus(s); statusRef.current = s;
    setPage(1); setSearch('');
    setDateFrom(''); setDateTo('');
    setSortField('date'); setSortDir('desc');
    fetchQueue(1, s, deptRef.current, '');
  };

  const handleDept = (e) => {
    const v = e.target.value;
    setSelectedDept(v); deptRef.current = v;
    setPage(1);
    fetchQueue(1, statusRef.current, v, debouncedSearch);
  };

  const handlePage = (pg) => {
    setPage(pg);
    fetchQueue(pg, statusRef.current, deptRef.current, debouncedSearch);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Client-side date filter + sort on current page
  const displayed = [...requests]
    .filter(req => {
      if (!dateFrom && !dateTo) return true;
      const d = new Date(req.submittedAt || req.createdAt);
      if (dateFrom && d < new Date(dateFrom))                  return false;
      if (dateTo   && d > new Date(dateTo + 'T23:59:59'))      return false;
      return true;
    })
    .sort((a, b) => {
      if (sortField === 'amount') {
        const diff = parseFloat(a.amount) - parseFloat(b.amount);
        return sortDir === 'asc' ? diff : -diff;
      }
      const diff = new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt);
      return sortDir === 'asc' ? diff : -diff;
    });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Layout>
      <div className="max-w-[1100px] mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Finance Review Queue</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {total} request{total !== 1 ? 's' : ''} in queue
            </p>
          </div>
          <Link to="/finance/dashboard"
            className="text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1 transition-colors">
            ← Back to dashboard
          </Link>
        </div>

        <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl overflow-hidden shadow-sm">

          {/* Toolbar row 1: status tabs + dept + search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-amber-100 dark:border-[#1e2235]">
            <div className="flex gap-1 flex-wrap flex-1">
              {STATUS_TABS.map(t => (
                <button key={String(t.value)} onClick={() => handleStatus(t.value)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap
                    ${activeStatus === t.value
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-600 dark:text-gray-400 hover:bg-amber-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dept filter */}
              <select value={selectedDept} onChange={handleDept}
                className="text-xs bg-white dark:bg-black border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="">All Departments</option>
                {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="pl-8 pr-3 py-1.5 text-xs bg-amber-50 dark:bg-[#1a1d2e] border border-amber-200 dark:border-[#2a2d3e] rounded-lg text-gray-800 dark:text-gray-200 w-32 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-400 dark:placeholder-gray-600" />
              </div>
            </div>
          </div>

          {/* Toolbar row 2: date range */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-amber-50/40 dark:bg-[#0f1117] border-b border-amber-100 dark:border-[#1e2235]">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
              📅 Date range:
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 flex-shrink-0">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="text-xs bg-white dark:bg-black border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400 [color-scheme:light] dark:[color-scheme:dark]" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 flex-shrink-0">To</label>
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
            {(dateFrom || dateTo) && (
              <span className="text-xs text-amber-500 font-semibold ml-auto">
                {displayed.length} result{displayed.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {search || dateFrom || dateTo ? 'No matching requests' : 'Queue is empty'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                {!search && !dateFrom && !dateTo && 'No requests currently pending finance review.'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile list */}
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
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-400">{formatDate(req.submittedAt || req.createdAt)}</p>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-50 dark:border-[#1e2235]">
                      <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 whitespace-nowrap">Request</th>
                      <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 whitespace-nowrap">Dept</th>
                      {/* Sortable: Amount */}
                      <th onClick={() => handleSort('amount')}
                        className="text-left text-xs font-semibold text-gray-400 px-5 py-3 whitespace-nowrap cursor-pointer hover:text-amber-500 transition-colors select-none">
                        Amount<SortIcon active={sortField === 'amount'} direction={sortDir} />
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 whitespace-nowrap">Status</th>
                      {/* Sortable: Date */}
                      <th onClick={() => handleSort('date')}
                        className="text-left text-xs font-semibold text-gray-400 px-5 py-3 whitespace-nowrap cursor-pointer hover:text-amber-500 transition-colors select-none">
                        Date<SortIcon active={sortField === 'date'} direction={sortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50 dark:divide-[#1a1d2e]">
                    {displayed.map(req => (
                      <tr key={req.id} onClick={() => navigate(`/finance/requests/${req.id}`)}
                        className="hover:bg-amber-50 dark:hover:bg-[#1a1d2e] cursor-pointer transition-colors group">
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-amber-500 transition-colors truncate max-w-[200px]">
                            {req.title}
                          </p>
                          <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">
                            {req.requestNumber} · {req.createdBy?.name}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {req.createdBy?.department?.name}
                        </td>
                        <td className="px-5 py-4 text-sm font-black text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {formatCurrency(req.amount)}
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={req.status} /></td>
                        <td className="px-5 py-4 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {formatDate(req.submittedAt || req.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-amber-100 dark:border-[#1e2235]">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</p>
                  <div className="flex gap-1">
                    <button onClick={() => handlePage(Math.max(1, page - 1))} disabled={page === 1}
                      className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 text-xs font-bold disabled:opacity-30 hover:bg-amber-100 transition-colors">‹</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => handlePage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                          ${page === p ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 hover:bg-amber-100'}`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => handlePage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                      className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 text-xs font-bold disabled:opacity-30 hover:bg-amber-100 transition-colors">›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
