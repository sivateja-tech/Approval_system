import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboard } from '../../api/request.api';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { card } from '../../styles/theme';

function Counter({ target = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let n = 0; const step = Math.max(1, Math.ceil(target / 25));
    const t = setInterval(() => {
      n = Math.min(n + step, target); setV(n);
      if (n >= target) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [target]);
  return <>{v}</>;
}

const CARDS = [
  {
    key: 'total',
    label: 'Total Requests',
    sub: 'All time',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    light: 'bg-orange-500', glow: 'shadow-orange-500/20',
    // No filter = show all
    onClick: (navigate) => navigate('/requests'),
  },
  {
    key: 'inProgress',
    label: 'In Progress',
    sub: 'Under review',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    light: 'bg-blue-500', glow: 'shadow-blue-500/20',
    onClick: (navigate) => navigate('/requests?filter=inprogress'),
  },
  {
    key: 'approved',
    label: 'Approved',
    sub: 'Finance approved',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    light: 'bg-green-500', glow: 'shadow-green-500/20',
    onClick: (navigate) => navigate('/requests?status=FINANCE_APPROVED'),
  },
  {
    key: 'needsReview',
    label: 'Needs Review',
    sub: 'Action required',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    light: 'bg-amber-500', glow: 'shadow-amber-500/20',
    onClick: (navigate) => navigate('/requests?status=NEEDS_REVIEW'),
  },
  {
    key: 'rejectedByFinance',
    label: 'Rejected by Finance',
    sub: 'Closed',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    light: 'bg-red-500', glow: 'shadow-red-500/20',
    onClick: (navigate) => navigate('/requests?status=FINANCE_REJECTED'),
  },
];

export default function Dashboard() {
  const { user }          = useAuth();
  const navigate          = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback(() => {
    getDashboard().then(r => setStats(r.data.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const filtered = (stats?.recent || []).filter(r =>
    !search ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.requestNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">
              My Workspace
            </p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Hello, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {user?.department?.name} {' '}
            </p>
          </div>
          <Link to="/requests/new"
            className="self-start sm:self-auto flex items-center gap-2 bg-orange-500
                       hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl
                       text-sm shadow-lg shadow-orange-500/20 transition-all hover:scale-105">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Link>
        </div>

        {/* Stat cards — 5 cards, wraps nicely */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CARDS.map(c => (
  <div key={c.key}
    onClick={() => c.onClick(navigate)}
    className={`group relative overflow-hidden rounded-2xl p-4 text-white
                ${c.light} shadow-lg ${c.glow}
                hover:scale-[1.04] transition-transform cursor-pointer`}>
    <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-white/10" />
    <div className="relative z-10">
      <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center
                      justify-center mb-3">
        {c.icon}
      </div>
      <p className="text-2xl font-black">
        <Counter target={stats?.[c.key] ?? 0} />
      </p>
      <p className="text-xs font-bold mt-0.5 text-white/90">{c.label}</p>
      <p className="text-xs text-white/60">{c.sub}</p>
    </div>
  </div>
))}
        </div>

        {/* Needs review alert */}
        {(stats?.needsReview ?? 0) > 0 && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200
                          dark:border-amber-500/20 rounded-2xl p-4
                          flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 dark:bg-amber-500/20 rounded-xl
                              flex items-center justify-center text-lg flex-shrink-0">
                🔄
              </div>
              <div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {stats.needsReview} request(s) need your attention
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Edit and resubmit to continue the approval process
                </p>
              </div>
            </div>
            <Link to="/requests?status=NEEDS_REVIEW"
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold
                         px-4 py-2 rounded-xl transition-colors flex-shrink-0">
              Review →
            </Link>
          </div>
        )}

        {/* Recent requests */}
        <div className={card + ' overflow-hidden'}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4
                          border-b border-orange-100 dark:border-[#1e2235]">
            <div className="flex-1">
              <p className="text-sm font-black text-gray-800 dark:text-white">
                Recent Requests
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Your latest submissions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                                text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-orange-50 dark:bg-[#1a1d2e]
                             border border-orange-200 dark:border-[#2a2d3e] rounded-lg
                             text-gray-800 dark:text-gray-200 w-36
                             focus:outline-none focus:ring-1 focus:ring-orange-400
                             placeholder-gray-400 dark:placeholder-gray-600" />
              </div>
              <Link to="/requests"
                className="text-xs font-bold text-orange-500 hover:text-orange-600 whitespace-nowrap">
                View all →
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-orange-50 dark:border-[#1e2235]">
                  {['Request', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold
                                           text-gray-400 dark:text-gray-500 px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50 dark:divide-[#1a1d2e]">
                {!filtered.length ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {search ? 'No matching requests' : 'No requests yet'}
                      </p>
                      {!search && (
                        <Link to="/requests/new"
                          className="inline-block mt-2 text-xs text-orange-500 font-bold hover:underline">
                          Create your first →
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : filtered.map(req => (
                  <tr key={req.id}
                    onClick={() => navigate(`/requests/${req.id}`)}
                    className="cursor-pointer hover:bg-orange-50 dark:hover:bg-[#1a1d2e]
                               transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0
                          ${req.status === 'FINANCE_APPROVED'  ? 'bg-green-500'  :
                            req.status === 'NEEDS_REVIEW'      ? 'bg-amber-500'  :
                            req.status === 'FINANCE_REJECTED'  ? 'bg-red-500'    : 'bg-blue-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200
                                         truncate max-w-[200px]">
                            {req.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {req.requestNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-800
                                   dark:text-gray-200 whitespace-nowrap">
                      {formatCurrency(req.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {formatDate(req.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}