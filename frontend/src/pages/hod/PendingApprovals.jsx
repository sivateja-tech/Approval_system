import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingApprovals } from '../../api/hod.api';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function PendingApprovals() {
  const navigate      = useNavigate();
  const pageRef       = useRef(1);
  const [steps, setSteps]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const LIMIT = 10;

  // fetch with explicit page — no stale closure
  const fetch = useCallback(async (pg) => {
    setLoading(true);
    try {
      const res = await getPendingApprovals({ page: pg, limit: LIMIT });
      setSteps(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setSteps([]); setTotal(0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(1); }, [fetch]);

  const handlePage = (pg) => {
    pageRef.current = pg;
    setPage(pg);
    fetch(pg);
  };

  const displayed = search
    ? steps.filter(s =>
        s.fundRequest?.title?.toLowerCase().includes(search.toLowerCase()) ||
        s.fundRequest?.requestNumber?.toLowerCase().includes(search.toLowerCase()) ||
        s.fundRequest?.createdBy?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : steps;

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
                         border border-orange-200 dark:border-orange-500/30
                         rounded-xl text-gray-800 dark:text-gray-200 w-48
                         focus:outline-none focus:ring-1 focus:ring-orange-400
                         placeholder-gray-400 dark:placeholder-gray-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#13151f] border border-orange-100
                        dark:border-[#1e2235] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
          ) : !displayed.length ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {search ? 'No matching requests' : 'All caught up!'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden divide-y divide-orange-50 dark:divide-[#1a1d2e]">
                {displayed.map(step => {
                  const req = step.fundRequest;
                  return (
                    <div key={step.id}
                      onClick={() => navigate(`/hod/requests/${req.id}`)}
                      className="p-4 hover:bg-orange-50 dark:hover:bg-[#1a1d2e]
                                 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1 pr-2">
                          {req.title}
                        </p>
                        <p className="text-sm font-black text-orange-500 flex-shrink-0">
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
                    <tr className="border-b border-orange-50 dark:border-[#1e2235]">
                      {['ID', 'Title', 'Requested By', 'Dept', 'Amount', 'Date', 'Level'].map(h => (
                        <th key={h}
                          className="text-left text-xs font-semibold text-gray-400
                                     dark:text-gray-500 px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50 dark:divide-[#1a1d2e]">
                    {displayed.map(step => {
                      const req = step.fundRequest;
                      return (
                        <tr key={step.id}
                          onClick={() => navigate(`/hod/requests/${req.id}`)}
                          className="hover:bg-orange-50 dark:hover:bg-[#1a1d2e]
                                     cursor-pointer transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500
                                         font-mono whitespace-nowrap">
                            {req.requestNumber?.slice(0, 11)}
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200
                                           truncate hover:text-orange-500 transition-colors">
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
                            <span className="text-xs font-bold bg-orange-100
                                             dark:bg-orange-500/10 text-orange-600
                                             dark:text-orange-400 px-2 py-0.5 rounded-lg">
                              L{step.hodLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && !search && (
                <div className="flex items-center justify-between px-5 py-3
                                border-t border-orange-100 dark:border-[#1e2235]">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                  </p>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => handlePage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                          ${page === p
                            ? 'bg-orange-500 text-white'
                            : 'bg-orange-50 dark:bg-[#1a1d2e] text-gray-500 hover:bg-orange-100'}`}>
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