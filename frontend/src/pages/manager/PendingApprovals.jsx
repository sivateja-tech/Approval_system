// src/pages/manager/PendingApprovals.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingApprovals } from '../../api/manager.api'; 
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function PendingApprovals() {
  const navigate      = useNavigate();
  const pageRef       = useRef(1);
  const isFirstMount  = useRef(true);
  
  const [steps, setSteps]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Search States
  const [search, setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const LIMIT = 10;

  // 1. Debounce the search input (waits 500ms after the user stops typing)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Update fetch to accept the searchVal
  const fetchPending = useCallback(async (pg, searchVal) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (searchVal) params.search = searchVal; // Send to API

      const res = await getPendingApprovals(params);
      setSteps(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setSteps([]); setTotal(0);
    } finally { setLoading(false); }
  }, []);

  // 3. Trigger API call when debouncedSearch changes
  useEffect(() => {
    setPage(1);
    pageRef.current = 1;
    fetchPending(1, debouncedSearch);
  }, [debouncedSearch, fetchPending]);

  const handlePage = (pg) => {
    pageRef.current = pg;
    setPage(pg);
    fetchPending(pg, debouncedSearch); // Preserve search while paginating
  };

  // 4. Remove the client-side filter! The backend handles it entirely now.
  const displayed = steps; 
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Layout>
      <div className="max-w-[1100px] mx-auto animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Pending Approvals
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {total} request{total !== 1 ? 's' : ''} awaiting your decision
            </p>
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search requests…"
              className="pl-8 pr-3 py-2 text-xs bg-white dark:bg-black
                         border border-amber-200 dark:border-amber-500/30
                         rounded-xl text-gray-800 dark:text-gray-200 w-48
                         focus:outline-none focus:ring-1 focus:ring-amber-400
                         placeholder-gray-400 dark:placeholder-gray-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#13151f] border border-amber-100
                        dark:border-[#1e2235] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
          ) : !displayed.length ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {search ? 'No matching requests globally' : 'All caught up!'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden divide-y divide-amber-50 dark:divide-[#1a1d2e]">
                {displayed.map(step => {
                  const req = step.fundRequest;
                  return (
                    <div key={step.id}
                      onClick={() => navigate(`/manager/requests/${req.id}`)}
                      className="p-4 hover:bg-amber-50 dark:hover:bg-[#1a1d2e]
                                 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1 pr-2">
                          {req.title}
                        </p>
                        <p className="text-sm font-black text-amber-500 flex-shrink-0">
                          {formatCurrency(req.amount)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {req.createdBy?.name} · {req.createdBy?.department?.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatDate(req.createdAt)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-50 dark:border-[#1e2235]">
                      {['ID', 'Title', 'Requested By', 'Dept', 'Amount', 'Date', 'Level'].map(h => (
                        <th key={h}
                          className="text-left text-xs font-semibold text-gray-400
                                     dark:text-gray-500 px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50 dark:divide-[#1a1d2e]">
                    {displayed.map(step => {
                      const req = step.fundRequest;
                      return (
                        <tr key={step.id}
                          onClick={() => navigate(`/manager/requests/${req.id}`)}
                          className="hover:bg-amber-50 dark:hover:bg-[#1a1d2e]
                                     cursor-pointer transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500
                                         font-mono whitespace-nowrap">
                            {req.requestNumber?.slice(0, 11)}
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200
                                           truncate hover:text-amber-500 transition-colors">
                              {req.title}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {req.createdBy?.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {req.createdBy?.department?.name}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-800
                                         dark:text-gray-200 whitespace-nowrap">
                            {formatCurrency(req.amount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {formatDate(req.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold bg-amber-100
                                             dark:bg-amber-500/10 text-amber-600
                                             dark:text-amber-400 px-2 py-0.5 rounded-lg">
                              L{step.level}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3
                                border-t border-amber-100 dark:border-[#1e2235]">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                  </p>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => handlePage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                          ${page === p
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 hover:bg-amber-100'}`}>
                        {p}
                      </button>
                    ))}
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