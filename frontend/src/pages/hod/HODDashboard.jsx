import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getHODDashboard, getPendingApprovals, getApprovalHistory } from '../../api/hod.api';
import { approveRequest, rejectRequest } from '../../api/hod.api';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

// Animated counter
function Counter({ target = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let n = 0; const step = Math.max(1, Math.ceil(target / 20));
    const t = setInterval(() => {
      n = Math.min(n + step, target); setV(n);
      if (n >= target) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [target]);
  return <>{v}</>;
}

// Donut chart
function Donut({ approved = 0, pending = 0, rejected = 0 }) {
  const total = approved + pending + rejected || 1;
  const r = 38, c = 2 * Math.PI * r;
  const aD = (approved / total) * c;
  const pD = (pending  / total) * c;
  const rD = (rejected / total) * c;

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none"
            stroke="currentColor" strokeWidth="12"
            className="text-gray-100 dark:text-gray-800" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="12"
            strokeDasharray={`${aD} ${c}`} strokeDashoffset="0" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f97316" strokeWidth="12"
            strokeDasharray={`${pD} ${c}`} strokeDashoffset={-aD} />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="12"
            strokeDasharray={`${rD} ${c}`} strokeDashoffset={-(aD + pD)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-black text-gray-800 dark:text-white">
            {approved + pending + rejected}
          </p>
          <p className="text-xs text-gray-400">total</p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {[
          { l: 'Approved', v: approved, pct: Math.round((approved / total) * 100), c: 'bg-green-500' },
          { l: 'Pending',  v: pending,  pct: Math.round((pending  / total) * 100), c: 'bg-orange-500' },
          { l: 'Rejected', v: rejected, pct: Math.round((rejected / total) * 100), c: 'bg-red-500' },
        ].map(i => (
          <div key={i.l} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${i.c}`} />
              <span className="text-gray-500 dark:text-gray-400">{i.l}</span>
            </div>
            <span className="font-bold text-gray-700 dark:text-gray-300">
              {i.v} ({i.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIORITY_BADGE = {
  High:   'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  Medium: 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Low:    'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400',
};
const getPriority = (amount) =>
  parseFloat(amount) >= 100000 ? 'High' : parseFloat(amount) >= 30000 ? 'Medium' : 'Low';

export default function HODDashboard() {
  const { user }          = useAuth();
  const [stats, setStats] = useState(null);
  const [steps, setSteps] = useState([]);
  const [history, setHistory] = useState([]);
  const [page, setPage]   = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null);
  const LIMIT = 5;

  const load = useCallback(() => {
    Promise.all([
      getHODDashboard(),
      getPendingApprovals({ page, limit: LIMIT }),
      getApprovalHistory({ page: 1, limit: 4 }),
    ]).then(([s, p, h]) => {
      setStats(s.data.data);
      setSteps(p.data.data || []);
      setTotal(p.data.pagination?.total || 0);
      setHistory(h.data.data || []);
    }).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (requestId) => {
    const remarks = window.prompt('Enter approval remarks (required):');
    if (!remarks?.trim()) { toast.error('Remarks are required'); return; }
    setActing(requestId);
    try {
      await approveRequest(requestId, { remarks });
      toast.success('Request approved!');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setActing(null); }
  };

  const handleReject = async (requestId) => {
    const remarks = window.prompt('Enter rejection reason (required):');
    if (!remarks?.trim()) { toast.error('Rejection reason required'); return; }
    setActing(requestId);
    try {
      await rejectRequest(requestId, { remarks });
      toast.success('Request rejected');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setActing(null); }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">
              HOD Portal
            </p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              HOD Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Welcome back, {user?.name}! Here's what's pending your review.
            </p>
          </div>
          <Link to="/hod/approvals"
            className="self-start flex items-center gap-2 bg-orange-500
                       hover:bg-orange-600 text-white font-bold px-5 py-2.5
                       rounded-xl text-sm shadow-lg shadow-orange-500/20
                       transition-all hover:scale-105">
            Pending Approvals
            {(stats?.pending ?? 0) > 0 && (
              <span className="bg-white text-orange-600 text-xs font-black
                               w-5 h-5 rounded-full flex items-center justify-center">
                {stats.pending}
              </span>
            )}
          </Link>
        </div>

        {/* 3 stat cards — NO 4th card */}
        {/* ── 4 clickable stat cards ── */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
  {[
    {
      label: 'All Requests',
      value: (stats?.pending ?? 0) + (stats?.approved ?? 0) + (stats?.rejected ?? 0),
      sub:   'Total handled',
      to:    '/hod/history',
      bg:    'bg-gray-50 dark:bg-[#13151f]',
      border:'border-gray-200 dark:border-[#1e2235]',
      iconBg:'bg-gray-200 dark:bg-gray-700',
      iconColor: 'text-gray-600 dark:text-gray-300',
      subColor:  'text-gray-400 dark:text-gray-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      label:  'Pending',
      value:  stats?.pending ?? 0,
      sub:    'Needs your action',
      to:     '/hod/approvals',
      bg:     'bg-amber-50 dark:bg-[#1a1a0e]',
      border: 'border-amber-200 dark:border-[#2a2a1a]',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-500',
      subColor:  'text-orange-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label:  'Approved',
      value:  stats?.approved ?? 0,
      sub:    'This month',
      to:     '/hod/history?filter=approved',
      bg:     'bg-green-50 dark:bg-[#0a1a0e]',
      border: 'border-green-200 dark:border-[#1a2a1a]',
      iconBg: 'bg-green-500/15',
      iconColor: 'text-green-500',
      subColor:  'text-green-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label:  'Rejected',
      value:  stats?.rejected ?? 0,
      sub:    'This month',
      to:     '/hod/history?filter=rejected',
      bg:     'bg-red-50 dark:bg-[#1a0a0a]',
      border: 'border-red-200 dark:border-[#2a1a1a]',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      subColor:  'text-red-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ].map(c => (
    <Link key={c.label} to={c.to}
      className={`${c.bg} border ${c.border} rounded-2xl p-4 block
                  hover:scale-[1.03] transition-all cursor-pointer hover:shadow-md`}>
      <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center
                       justify-center ${c.iconColor} mb-3`}>
        {c.icon}
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white">
        <Counter target={c.value} />
      </p>
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1">
        {c.label}
      </p>
      <p className={`text-xs ${c.subColor} mt-0.5`}>{c.sub}</p>
    </Link>
  ))}
</div>


        {/* Main grid */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-5">

          {/* Pending approvals table */}
          <div className="bg-white dark:bg-[#13151f] border border-orange-100
                          dark:border-[#1e2235] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4
                            border-b border-orange-100 dark:border-[#1e2235]">
              <div>
                <p className="text-sm font-black text-gray-800 dark:text-white">
                  Pending Approvals
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Requests waiting for your action
                </p>
              </div>
              <Link to="/hod/approvals"
                className="text-xs font-bold text-orange-500 bg-orange-50
                           dark:bg-orange-500/10 border border-orange-200
                           dark:border-orange-500/20 px-3 py-1.5 rounded-lg
                           hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors">
                View All
              </Link>
            </div>

            {!steps.length ? (
              <div className="py-14 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  All caught up!
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                  No pending approvals
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orange-50 dark:border-[#1e2235]">
                        {['Request ID', 'Title', 'Requested By', 'Dept', 'Amount', 'Date', 'Priority', 'Action'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold
                                                 text-gray-400 dark:text-gray-500
                                                 px-4 py-3 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-50 dark:divide-[#1a1d2e]">
                      {steps.map(step => {
                        const req = step.fundRequest;
                        const pri = getPriority(req.amount);
                        return (
                          <tr key={step.id}
                            className="hover:bg-orange-50 dark:hover:bg-[#1a1d2e] transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-400
                                           dark:text-gray-500 font-mono whitespace-nowrap">
                              {req.requestNumber?.slice(0, 10)}
                            </td>
                            <td className="px-4 py-3 max-w-[150px]">
                              <Link to={`/hod/requests/${req.id}`}
                                className="text-sm font-semibold text-gray-800
                                           dark:text-gray-200 truncate block
                                           hover:text-orange-500 transition-colors">
                                {req.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600
                                           dark:text-gray-400 whitespace-nowrap">
                              {req.createdBy?.name}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400
                                           dark:text-gray-500 whitespace-nowrap">
                              {req.createdBy?.department?.name}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold
                                           text-gray-800 dark:text-gray-200 whitespace-nowrap">
                              {formatCurrency(req.amount)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400
                                           dark:text-gray-500 whitespace-nowrap">
                              {formatDate(req.createdAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs font-bold px-2 py-0.5
                                               rounded-lg ${PRIORITY_BADGE[pri]}`}>
                                {pri}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={acting === req.id}
                                  title="Approve"
                                  className="w-7 h-7 bg-green-100 dark:bg-green-500/20
                                             hover:bg-green-200 dark:hover:bg-green-500/30
                                             border border-green-300 dark:border-green-500/30
                                             rounded-full flex items-center justify-center
                                             text-green-600 dark:text-green-400 transition-all
                                             disabled:opacity-50 hover:scale-110">
                                  {acting === req.id ? (
                                    <span className="w-3 h-3 border border-green-500
                                                     border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleReject(req.id)}
                                  disabled={acting === req.id}
                                  title="Reject"
                                  className="w-7 h-7 bg-red-100 dark:bg-red-500/20
                                             hover:bg-red-200 dark:hover:bg-red-500/30
                                             border border-red-300 dark:border-red-500/30
                                             rounded-full flex items-center justify-center
                                             text-red-600 dark:text-red-400 transition-all
                                             disabled:opacity-50 hover:scale-110">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > LIMIT && (
                  <div className="flex items-center justify-between px-5 py-3
                                  border-t border-orange-50 dark:border-[#1e2235]">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                    </p>
                    <div className="flex gap-1">
                      {[...Array(Math.min(totalPages, 3))].map((_, i) => (
                        <button key={i} onClick={() => setPage(i + 1)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors
                            ${page === i + 1
                              ? 'bg-orange-500 text-white'
                              : 'bg-orange-50 dark:bg-[#1a1d2e] text-gray-500 dark:text-gray-400 hover:bg-orange-100'}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">

            {/* Approval summary donut */}
            <div className="bg-white dark:bg-[#13151f] border border-orange-100
                            dark:border-[#1e2235] rounded-2xl p-5">
              <p className="text-sm font-black text-gray-800 dark:text-white mb-1">
                Approval Summary
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                This month
              </p>
              <Donut
                approved={stats?.approved ?? 0}
                pending={stats?.pending ?? 0}
                rejected={stats?.rejected ?? 0}
              />
            </div>

            {/* Recent activity */}
            <div className="bg-white dark:bg-[#13151f] border border-orange-100
                            dark:border-[#1e2235] rounded-2xl p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black text-gray-800 dark:text-white">
                  Recent Activity
                </p>
                <Link to="/hod/history"
                  className="text-xs font-bold text-orange-500 hover:text-orange-600">
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {!history.length ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                    No recent activity
                  </p>
                ) : history.map(step => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center
                                    text-xs font-bold flex-shrink-0 mt-0.5
                                    ${step.status === 'APPROVED'
                                      ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                                      : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                      {step.status === 'APPROVED' ? '✓' : '✕'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200
                                     leading-relaxed">
                        You {step.status === 'APPROVED' ? 'approved' : 'rejected'}{' '}
                        <span className="text-gray-500 dark:text-gray-400">
                          {step.fundRequest?.title}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        by {step.fundRequest?.createdBy?.name}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-600
                                     whitespace-nowrap flex-shrink-0">
                      {step.actionAt ? formatDate(step.actionAt) : '—'}
                    </span>
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