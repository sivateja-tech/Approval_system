import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApprovalHistory } from '../../api/manager.api';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const FILTERS = [
  { label: 'All',       value: undefined,   activeColor: 'bg-amber-500 text-white' },
  { label: 'Approved',  value: 'approved',  activeColor: 'bg-green-500 text-white'  },
  { label: 'Rejected',  value: 'rejected',  activeColor: 'bg-red-500 text-white'    },
  { label: 'Skipped',   value: 'skipped',  activeColor: 'bg-gray-500 text-white'    },
];

export default function ApprovalHistory() {
  const navigate          = useNavigate();
  const filterRef         = useRef(undefined);
  const pageRef           = useRef(1);
  const isFirstMount      = useRef(true); // Prevents double fetching on load

  const [steps, setSteps]                 = useState([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [activeFilter, setActiveFilter]   = useState(undefined);
  const [loading, setLoading]             = useState(true);
  
  // Global Search States
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const LIMIT = 10;

  // 1. Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Fetch history (Now accepts searchVal)
  const fetchHistory = useCallback(async (filter, pg, searchVal) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (filter !== undefined) params.filter = filter;
      if (searchVal) params.search = searchVal; // Send search to backend

      const res = await getApprovalHistory(params);
      setSteps(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setSteps([]); setTotal(0);
    } finally { setLoading(false); }
  }, []);

  // 3. Initial Load
  useEffect(() => {
    const urlFilter = new URLSearchParams(window.location.search).get('filter');
    const init = urlFilter === 'approved'  ? 'approved'
               : urlFilter === 'rejected'  ? 'rejected'
               : urlFilter === 'skipped'   ? 'skipped'
               : undefined;
    filterRef.current = init;
    setActiveFilter(init);
    fetchHistory(init, 1, '');
  }, [fetchHistory]);

  // 4. Global Search Side Effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    pageRef.current = 1;
    setPage(1);
    fetchHistory(filterRef.current, 1, debouncedSearch);
  }, [debouncedSearch, fetchHistory]);

  const handleFilter = (val) => {
    filterRef.current = val;
    pageRef.current   = 1;
    setActiveFilter(val);
    setPage(1);
    setSearch(''); // Clear search box when switching tabs
    fetchHistory(val, 1, '');
  };

  const handlePage = (pg) => {
    pageRef.current = pg;
    setPage(pg);
    fetchHistory(filterRef.current, pg, debouncedSearch); // Preserve search during pagination
  };

  // Backend handles filtration entirely now
  const displayed = steps.filter(step => step.status !== 'WAITING');
  const totalPages = Math.ceil(total / LIMIT);

  const getStepBadge = (step) => {
  if (step.status === 'APPROVED') return 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20';
  if (step.status === 'REJECTED') return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
  if (step.status === 'SKIPPED')  return 'bg-gray-100 dark:bg-gray-800/40 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700';
  if (step.status === 'WAITING')  return 'bg-gray-50 dark:bg-gray-800/20 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700/50';
  return 'bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700';
};
  const getStepLabel = (step) => {
  if (step.status === 'APPROVED') return '✓ Approved';
  if (step.status === 'REJECTED') return '✕ Rejected';
  if (step.status === 'SKIPPED')  return '— Skipped';
  if (step.status === 'WAITING')  return '— Waiting';
  return step.status;
};

  return (
    <Layout>
      <div className="max-w-[1100px] mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Approval History</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {total} decision{total !== 1 ? 's' : ''} made
            </p>
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search history…"
              className="pl-8 pr-3 py-2 text-xs bg-white dark:bg-black border border-amber-200
                         dark:border-amber-500/30 rounded-xl text-gray-800 dark:text-gray-200 w-48
                         focus:outline-none focus:ring-1 focus:ring-amber-400
                         placeholder-gray-400 dark:placeholder-gray-600" />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map(f => (
            <button key={String(f.value)} onClick={() => handleFilter(f.value)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all
                ${activeFilter === f.value
                  ? (f.activeColor || 'bg-amber-500 text-white')
                  : 'bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-[#1a1d2e]'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
          ) : !displayed.length ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-4xl mb-3">
  {activeFilter === 'approved' ? '✅' : 
   activeFilter === 'rejected' ? '❌' : 
   activeFilter === 'skipped'  ? '⏭️' : '📋'}
</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {search ? 'No matching results found globally' : `No ${activeFilter || ''} decisions yet`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-amber-50 dark:divide-[#1a1d2e]">
              {displayed.map(step => {
                const req = step.fundRequest;
                return (
                  <div key={step.id}
                    onClick={() => navigate(`/manager/requests/${req?.id}`)}
                    className="flex items-start gap-4 px-5 py-4 transition-colors cursor-pointer hover:bg-amber-50 dark:hover:bg-[#1a1d2e] group">

                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0
                      ${step.status === 'APPROVED'  ? 'bg-green-500' :
                        step.status === 'REJECTED'  ? 'bg-red-500'   :
                        'bg-gray-300 dark:bg-gray-600'}`} />

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-amber-500 transition-colors">
                              {req?.title}
                            </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {req?.requestNumber} · by {req?.createdBy?.name}
                        {req?.createdBy?.department?.name && ` · ${req.createdBy.department.name}`}
                      </p>
                      {step.remarks && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                          Your remarks: "{step.remarks}"
                        </p>
                      )}
                      {step.status === 'SKIPPED' && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          A higher-level manager acted first
                        </p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-gray-800 dark:text-gray-200">
                        {formatCurrency(req?.amount)}
                      </p>
                      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-lg mt-1 border
                                        ${getStepBadge(step)}`}>
                        {getStepLabel(step)}
                      </span>
                      {step.actionAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatDateTime(step.actionAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-amber-100 dark:border-[#1e2235]">
              <p className="text-xs text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => handlePage(Math.max(1, page - 1))} disabled={page === 1}
                  className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-[#1a1d2e] text-gray-500
                             text-xs font-bold disabled:opacity-30 hover:bg-amber-100 transition-colors">‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => handlePage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                      ${page === p ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 hover:bg-amber-100'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => handlePage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                  className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-[#1a1d2e] text-gray-500
                             text-xs font-bold disabled:opacity-30 hover:bg-amber-100 transition-colors">›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}