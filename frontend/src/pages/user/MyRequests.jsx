import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getMyRequests } from '../../api/request.api';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

const IN_PROGRESS = [
  'SUBMITTED', 'PENDING_HOD_APPROVAL', 'HOD_APPROVED',
  'PENDING_FINANCE_APPROVAL', 'RESUBMITTED',
];

const FILTERS = [
  { label: 'All',             value: '',                 badge: null },
  { label: 'Draft',           value: 'DRAFT',            badge: 'gray' },
  { label: 'In Progress',     value: 'INPROGRESS',       badge: 'blue' },
  { label: 'Needs Review',    value: 'NEEDS_REVIEW',     badge: 'amber' },
  { label: 'Approved',        value: 'FINANCE_APPROVED', badge: 'green' },
  { label: 'Rejected',        value: 'FINANCE_REJECTED', badge: 'red' },
];

export default function MyRequests() {
  const navigate            = useNavigate();
  const [searchParams]      = useSearchParams();

  // Use ref for the current filter — avoids stale closure in useEffect
  const filterRef = useRef('');
  const pageRef   = useRef(1);

  const [activeFilter, setActiveFilter] = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [requests, setRequests]         = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');

  // Fetch with explicit params — no stale closure issue
  const fetchRequests = useCallback(async (statusVal, pg) => {
    setLoading(true);
    try {
      const res = await getMyRequests({
        page:   pg,
        limit:  10,
        status: statusVal || undefined,
      });
      setRequests(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setRequests([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount — read URL params and fetch immediately
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    const urlFilter = searchParams.get('filter') || '';
    let initial = urlStatus;
    if (urlFilter === 'inprogress') initial = 'INPROGRESS';

    filterRef.current = initial;
    pageRef.current   = 1;
    setActiveFilter(initial);
    setCurrentPage(1);
    fetchRequests(initial, 1);   // fetch with the determined value immediately
  }, []); // only on mount

  // Handle filter button click — pass value directly, no state lag
  const handleFilter = (val) => {
    filterRef.current = val;
    pageRef.current   = 1;
    setActiveFilter(val);
    setCurrentPage(1);
    setSearch('');
    fetchRequests(val, 1);   // use val directly — not state
  };

  const handlePage = (pg) => {
    pageRef.current = pg;
    setCurrentPage(pg);
    fetchRequests(filterRef.current, pg);
  };

  const displayed = search
    ? requests.filter(r =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.requestNumber || '').toLowerCase().includes(search.toLowerCase())
      )
    : requests;

  const totalPages = Math.ceil(total / 10);

  return (
    <Layout>
      <div className="max-w-[1100px] mx-auto animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              My Requests
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {total} {activeFilter ? `${FILTERS.find(f => f.value === activeFilter)?.label}` : 'total'} request{total !== 1 ? 's' : ''}
            </p>
          </div>
          <Link to="/requests/new"
            className="self-start flex items-center gap-2 bg-orange-500
                       hover:bg-orange-600 text-white font-bold px-5 py-2.5
                       rounded-xl text-sm shadow-lg shadow-orange-500/20
                       transition-all hover:scale-105">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Link>
        </div>

        <div className="bg-white dark:bg-[#13151f] border border-orange-100
                        dark:border-[#1e2235] rounded-2xl overflow-hidden">

          {/* Filters + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4
                          border-b border-orange-100 dark:border-[#1e2235]">
            <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
              {FILTERS.map(f => (
                <button key={f.value} onClick={() => handleFilter(f.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold
                               transition-all whitespace-nowrap
                    ${activeFilter === f.value
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                      : 'bg-orange-50 dark:bg-[#1a1d2e] text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-[#2a2d3e]'}`}>
                  {f.label}
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
                placeholder="Search requests…"
                className="pl-8 pr-3 py-1.5 text-xs bg-orange-50 dark:bg-[#1a1d2e]
                           border border-orange-200 dark:border-[#2a2d3e] rounded-lg
                           text-gray-800 dark:text-gray-200 w-44
                           focus:outline-none focus:ring-1 focus:ring-orange-400
                           placeholder-gray-400 dark:placeholder-gray-600" />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : !displayed.length ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {search ? 'No matching requests' : 'No requests found'}
              </p>
              {!search && !activeFilter && (
                <Link to="/requests/new"
                  className="mt-3 text-xs text-orange-500 font-bold hover:underline">
                  Create your first →
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-orange-50 dark:divide-[#1a1d2e]">
              {displayed.map(req => (
                <div key={req.id} onClick={() => navigate(`/requests/${req.id}`)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer
                             hover:bg-orange-50 dark:hover:bg-[#1a1d2e] transition-colors
                             group">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0
                    ${req.status === 'FINANCE_APPROVED'  ? 'bg-green-500'  :
                      req.status === 'NEEDS_REVIEW'      ? 'bg-amber-500'  :
                      req.status === 'FINANCE_REJECTED'  ? 'bg-red-500'    :
                      req.status === 'DRAFT'             ? 'bg-gray-400'   : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200
                                   truncate group-hover:text-orange-500 transition-colors">
                      {req.title}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {req.requestNumber} · {formatDate(req.createdAt)}
                    </p>
                    {req.status === 'NEEDS_REVIEW' && (
                      <p className="text-xs text-amber-500 font-medium mt-0.5">
                        ⚠ Action required — edit and resubmit
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300
                                   hidden sm:block">
                      {formatCurrency(req.amount)}
                    </p>
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && !search && (
            <div className="flex items-center justify-between px-5 py-3
                            border-t border-orange-100 dark:border-[#1e2235]">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-1">
                <button onClick={() => handlePage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-[#1a1d2e]
                             text-gray-600 dark:text-gray-400 text-xs font-bold
                             disabled:opacity-30 hover:bg-orange-100 transition-colors">
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => handlePage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                      ${currentPage === p
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 dark:bg-[#1a1d2e] text-gray-600 dark:text-gray-400 hover:bg-orange-100'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => handlePage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-[#1a1d2e]
                             text-gray-600 dark:text-gray-400 text-xs font-bold
                             disabled:opacity-30 hover:bg-orange-100 transition-colors">
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}