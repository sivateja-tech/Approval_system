// src/pages/manager/ManagerDashboard.jsx
//
// Two-tab dashboard for managers:
//   • "Approvals Dashboard" — existing approval stats, pending queue, activity feed
//   • "My Requests"         — the full user-style dashboard (stats + recent requests)
//     showing requests THIS manager created themselves
//
// Tab state is persisted in sessionStorage so the selected tab survives
// navigation back from a detail page.

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getManagerDashboard,
  getPendingApprovals,
  getApprovalHistory,
} from '../../api/manager.api';
import { getDashboard } from '../../api/request.api';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function Counter({ target = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let n = 0;
    const step = Math.max(1, Math.ceil(target / 20));
    const t = setInterval(() => {
      n = Math.min(n + step, target); setV(n);
      if (n >= target) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [target]);
  return <>{v}</>;
}

function Donut({ approved = 0, pending = 0, rejected = 0, skipped = 0 }) {
  const total = approved + pending + rejected + skipped || 1;
  const r = 38, c = 2 * Math.PI * r;
  const aD = (approved / total) * c;
  const pD = (pending  / total) * c;
  const rD = (rejected / total) * c;
  const sD = (skipped  / total) * c;
  const pOff = -aD, rOff = pOff - pD, sOff = rOff - rD;
  const actualTotal = approved + pending + rejected + skipped;
  return (
    <div className="flex flex-col xl:flex-row items-center gap-5">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="12"
            className="text-gray-100 dark:text-gray-800" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="12"
            strokeDasharray={`${aD} ${c}`} strokeDashoffset="0" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f97316" strokeWidth="12"
            strokeDasharray={`${pD} ${c}`} strokeDashoffset={pOff} />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="12"
            strokeDasharray={`${rD} ${c}`} strokeDashoffset={rOff} />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#9ca3af" strokeWidth="12"
            strokeDasharray={`${sD} ${c}`} strokeDashoffset={sOff} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-black text-gray-800 dark:text-white">{actualTotal}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Total</p>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        {[
          { l: 'Approved', v: approved, pct: Math.round((approved / total) * 100), c: 'bg-green-500' },
          { l: 'Pending',  v: pending,  pct: Math.round((pending  / total) * 100), c: 'bg-amber-500' },
          { l: 'Rejected', v: rejected, pct: Math.round((rejected / total) * 100), c: 'bg-red-500'   },
          { l: 'Skipped',  v: skipped,  pct: Math.round((skipped  / total) * 100), c: 'bg-gray-400'  },
        ].map(i => (
          <div key={i.l} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${i.c}`} />
              <span className="text-gray-500 dark:text-gray-400">{i.l}</span>
            </div>
            <span className="font-bold text-gray-700 dark:text-gray-300">
              {i.v} <span className="opacity-50 font-normal ml-1 w-8 inline-block text-right">({i.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const GlobalStatusBadge = ({ status }) => {
  let color = 'text-gray-500 bg-gray-100 dark:bg-gray-800';
  let label = status?.replace(/_/g, ' ') || 'UNKNOWN';
  if (['SUBMITTED', 'PENDING_MANAGER_APPROVAL'].includes(status)) {
    color = 'text-amber-600 bg-amber-100 dark:bg-amber-500/20'; label = 'Pending Manager';
  } else if (['MANAGER_APPROVED', 'PENDING_FINANCE_APPROVAL'].includes(status)) {
    color = 'text-blue-600 bg-blue-100 dark:bg-blue-500/20'; label = 'Pending Finance';
  } else if (status === 'FINANCE_APPROVED') {
    color = 'text-green-600 bg-green-100 dark:bg-green-500/20'; label = 'Fully Approved';
  } else if (['REJECTED', 'FINANCE_REJECTED'].includes(status)) {
    color = 'text-red-600 bg-red-100 dark:bg-red-500/20'; label = 'Rejected';
  } else if (status === 'NEEDS_REVIEW') {
    color = 'text-purple-600 bg-purple-100 dark:bg-purple-500/20'; label = 'Needs Review';
  }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${color}`}>
        {label}
      </span>
    </div>
  );
};

// ─── USER STATS CARDS (same as user Dashboard.jsx) ───────────────────────────
// Bug 2: Removed "Needs Review" card — merged into Rejected.
// "Rejected" now shows all rejected statuses (REJECTED + FINANCE_REJECTED + NEEDS_REVIEW).

const USER_CARDS = [
  {
    key: 'total', label: 'Total Requests', sub: 'All time',
    light: 'bg-amber-500', glow: 'shadow-amber-500/20',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    onClick: (navigate) => navigate('/requests'),
  },
  {
    key: 'draft', label: 'Drafts', sub: 'Not submitted',
    light: 'bg-gray-400', glow: 'shadow-gray-400/20',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    onClick: (navigate) => navigate('/requests?status=DRAFT'),
  },
  {
    key: 'inProgress', label: 'In Progress', sub: 'Under review',
    light: 'bg-blue-500', glow: 'shadow-blue-500/20',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    onClick: (navigate) => navigate('/requests?filter=inprogress'),
  },
  {
    key: 'approved', label: 'Approved', sub: 'Finance approved',
    light: 'bg-green-500', glow: 'shadow-green-500/20',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    onClick: (navigate) => navigate('/requests?status=FINANCE_APPROVED'),
  },
  {
    // Bug 2: key changed from 'rejectedByFinance' to 'rejected' to match
    // the merged count returned by the updated getDashboardStats.
    key: 'rejected', label: 'Rejected', sub: 'All rejections',
    light: 'bg-red-500', glow: 'shadow-red-500/20',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    onClick: (navigate) => navigate('/requests?status=REJECTED'),
  },
  {
    key: 'cancelled', label: 'Cancelled', sub: 'Aborted',
    light: 'bg-gray-600', glow: 'shadow-gray-600/20',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    onClick: (navigate) => navigate('/requests?status=CANCELLED'),
  },
];

// ─── APPROVALS DASHBOARD (tab 1) ─────────────────────────────────────────────

function ApprovalsDashboard({ user, stats, steps, history, total, page, setPage, LIMIT }) {
  const navigate   = useNavigate();
  const totalPages = Math.ceil(total / LIMIT);

  const CARDS = [
    {
      key: 'all', label: 'All Requests',
      value: (stats?.pending ?? 0) + (stats?.approved ?? 0) + (stats?.rejected ?? 0) + (stats?.skipped ?? 0),
      sub: 'Total requests', to: '/manager/history',
      bg: 'bg-gray-50 dark:bg-[#13151f]', border: 'border-gray-200 dark:border-[#1e2235]',
      iconBg: 'bg-gray-200 dark:bg-gray-700', iconColor: 'text-gray-600 dark:text-gray-300', subColor: 'text-gray-400 dark:text-gray-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    },
    {
      key: 'pending', label: 'Pending', value: stats?.pending ?? 0,
      sub: 'Needs your action', to: '/manager/approvals',
      bg: 'bg-amber-50 dark:bg-[#1a1a0e]', border: 'border-amber-200 dark:border-[#2a2a1a]',
      iconBg: 'bg-amber-500/15', iconColor: 'text-amber-500', subColor: 'text-amber-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      key: 'approved', label: 'Approved', value: stats?.approved ?? 0,
      sub: 'This month', to: '/manager/history?filter=approved',
      bg: 'bg-green-50 dark:bg-[#0a1a0e]', border: 'border-green-200 dark:border-[#1a2a1a]',
      iconBg: 'bg-green-500/15', iconColor: 'text-green-500', subColor: 'text-green-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      key: 'rejected', label: 'Rejected', value: stats?.rejected ?? 0,
      sub: 'This month', to: '/manager/history?filter=rejected',
      bg: 'bg-red-50 dark:bg-[#1a0a0a]', border: 'border-red-200 dark:border-[#2a1a1a]',
      iconBg: 'bg-red-500/15', iconColor: 'text-red-500', subColor: 'text-red-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      key: 'skipped', label: 'Skipped', value: stats?.skipped ?? 0,
      sub: 'Bypassed requests', to: '/manager/history?filter=skipped',
      bg: 'bg-gray-50 dark:bg-[#15171e]', border: 'border-gray-200 dark:border-[#202436]',
      iconBg: 'bg-gray-500/15', iconColor: 'text-gray-500', subColor: 'text-gray-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {CARDS.map(c => (
          <Link key={c.key} to={c.to}
            className={`${c.bg} border ${c.border} rounded-2xl p-4 block hover:scale-[1.03] transition-all cursor-pointer hover:shadow-md`}>
            <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center ${c.iconColor} mb-3`}>
              {c.icon}
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              <Counter target={c.value} />
            </p>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1">{c.label}</p>
            <p className={`text-[10px] ${c.subColor} mt-0.5`}>{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">

        {/* Pending approvals table */}
        <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 dark:border-[#1e2235]">
            <div>
              <p className="text-sm font-black text-gray-800 dark:text-white">Pending Approvals</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Requests waiting for your action</p>
            </div>
            <Link to="/manager/approvals"
              className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors">
              View All
            </Link>
          </div>

          {!steps.length ? (
            <div className="py-14 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">All caught up!</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">No pending approvals</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-50 dark:border-[#1e2235]">
                      {['Request ID', 'Title', 'Requested By', 'Dept', 'Amount', 'Date'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50 dark:divide-[#1a1d2e]">
                    {steps.map(step => {
                      const req = step.fundRequest;
                      return (
                        <tr key={step.id} onClick={() => navigate(`/manager/requests/${req.id}`)}
                          className="group hover:bg-amber-50 dark:hover:bg-[#1a1d2e] cursor-pointer transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">{req.requestNumber?.slice(0, 10)}</td>
                          <td className="px-4 py-3 max-w-[150px]">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate block group-hover:text-amber-500 transition-colors">{req.title}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{req.createdBy?.name}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{req.createdBy?.department?.name}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{formatCurrency(req.amount)}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatDate(req.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {total > LIMIT && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-amber-50 dark:border-[#1e2235]">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                  </p>
                  <div className="flex gap-1">
                    {[...Array(Math.min(totalPages, 3))].map((_, i) => (
                      <button key={i} onClick={() => setPage(i + 1)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${page === i + 1 ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-[#1a1d2e] text-gray-500 hover:bg-amber-100'}`}>
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
          <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-5">
            <p className="text-sm font-black text-gray-800 dark:text-white mb-1">Approval Summary</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Total distribution metrics</p>
            <Donut approved={stats?.approved ?? 0} pending={stats?.pending ?? 0} rejected={stats?.rejected ?? 0} skipped={stats?.skipped ?? 0} />
          </div>

          <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-black text-gray-800 dark:text-white">Recent Activity</p>
              <Link to="/manager/history" className="text-xs font-bold text-amber-500 hover:text-amber-600">View All</Link>
            </div>
            <div className="space-y-3">
              {!history.length ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No recent activity</p>
              ) : history.filter(s => s.status !== 'WAITING').map(step => {
                const req = step.fundRequest;
                const isApprovedGlobally = ['MANAGER_APPROVED', 'PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED'].includes(req?.status);
                const isRejectedGlobally = ['REJECTED', 'FINANCE_REJECTED', 'NEEDS_REVIEW', 'CANCELLED'].includes(req?.status);
                let actionText = '', icon = '', colorClass = '';
                if (step.status === 'APPROVED') {
                  actionText = 'You approved'; icon = '✓'; colorClass = 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400';
                } else if (step.status === 'REJECTED') {
                  actionText = 'You rejected'; icon = '✕'; colorClass = 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400';
                } else if (step.status === 'SKIPPED') {
                  actionText = isApprovedGlobally ? 'Chain Approved:' : isRejectedGlobally ? 'Chain Rejected:' : 'Skipped:';
                  icon = isApprovedGlobally ? '✓' : isRejectedGlobally ? '✕' : '⏭️';
                  colorClass = 'bg-gray-100 dark:bg-gray-800 text-gray-500';
                } else {
                  actionText = 'Pending:'; icon = '⏳'; colorClass = 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400';
                }
                return (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${colorClass}`}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
                        {actionText}{' '}<span className="text-gray-500 dark:text-gray-400">{req?.title}</span>
                      </p>
                      <GlobalStatusBadge status={req?.status} />
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">by {req?.createdBy?.name}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-600 whitespace-nowrap flex-shrink-0">
                      {step.actionAt ? formatDate(step.actionAt) : formatDate(step.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MY REQUESTS DASHBOARD (tab 2) ───────────────────────────────────────────

function MyRequestsDashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDashboard().then(r => setStats(r.data.data)).finally(() => setLoading(false));
  }, []);

  const filtered = (stats?.recent || []).filter(r =>
    !search ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.requestNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
  );

  return (
    <div className="space-y-5">

      {/* Stat cards — 6 cards now (Needs Review removed) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {USER_CARDS.map(c => (
          <div key={c.key} onClick={() => c.onClick(navigate)}
            className={`group relative overflow-hidden rounded-2xl p-4 text-white ${c.light} shadow-lg ${c.glow} hover:scale-[1.04] transition-transform cursor-pointer`}>
            <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-white/10" />
            <div className="relative z-10">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">{c.icon}</div>
              <p className="text-2xl font-black"><Counter target={stats?.[c.key] ?? 0} /></p>
              <p className="text-xs font-bold mt-0.5 text-white/90">{c.label}</p>
              <p className="text-[10px] text-white/60">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent requests table */}
      <div className="bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-amber-100 dark:border-[#1e2235]">
          <div className="flex-1">
            <p className="text-sm font-black text-gray-800 dark:text-white">Recent Requests</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Your latest submissions</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-xs bg-amber-50 dark:bg-[#1a1d2e] border border-amber-200 dark:border-[#2a2d3e] rounded-lg text-gray-800 dark:text-gray-200 w-36 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-400 dark:placeholder-gray-600" />
            </div>
            <Link to="/requests" className="text-xs font-bold text-amber-500 hover:text-amber-600 whitespace-nowrap">View all →</Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-amber-50 dark:border-[#1e2235]">
                {['Request', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50 dark:divide-[#1a1d2e]">
              {!filtered.length ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {search ? 'No matching requests' : 'No requests yet'}
                    </p>
                    {!search && (
                      <Link to="/requests/new" className="inline-block mt-2 text-xs text-amber-500 font-bold hover:underline">
                        Create your first →
                      </Link>
                    )}
                  </td>
                </tr>
              ) : filtered.map(req => (
                <tr key={req.id} onClick={() => navigate(`/requests/${req.id}`)}
                  className="cursor-pointer hover:bg-amber-50 dark:hover:bg-[#1a1d2e] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0
                        ${req.status === 'FINANCE_APPROVED' ? 'bg-green-500' :
                          req.status === 'NEEDS_REVIEW'     ? 'bg-amber-500' :
                          req.status === 'REJECTED'         ? 'bg-amber-500' :
                          req.status === 'CANCELLED'        ? 'bg-gray-500'  :
                          req.status === 'FINANCE_REJECTED' ? 'bg-red-500'   : 'bg-blue-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{req.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{req.requestNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {formatCurrency(req.amount)}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={req.status} /></td>
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
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const TAB_KEY = 'manager_dashboard_tab';

export default function ManagerDashboard() {
  const { user }     = useAuth();
  const navigate     = useNavigate();

  // Persist selected tab across navigation
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem(TAB_KEY) || 'approvals'
  );

  // Approvals data
  const [stats, setStats]   = useState(null);
  const [steps, setSteps]   = useState([]);
  const [history, setHistory] = useState([]);
  const [page, setPage]     = useState(1);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const LIMIT = 5;

  const switchTab = (tab) => {
    sessionStorage.setItem(TAB_KEY, tab);
    setActiveTab(tab);
  };

  const load = useCallback(() => {
    Promise.all([
      getManagerDashboard(),
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

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  const pendingCount = stats?.pending ?? 0;

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto space-y-5 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">
              Manager Portal
            </p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h1>
          </div>

          {/* Quick-action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/requests/new"
              className="flex items-center gap-2 bg-white dark:bg-[#1a1d2e] border border-amber-200 dark:border-amber-500/20 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-600 dark:text-amber-500 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Request
            </Link>
            <Link to="/manager/approvals"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-105">
              Pending Approvals
              {pendingCount > 0 && (
                <span className="bg-white text-amber-600 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#1a1d2e] rounded-2xl w-fit">
          {/* Tab 1 — Approvals */}
          <button
            onClick={() => switchTab('approvals')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'approvals'
                ? 'bg-white dark:bg-black text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approvals
            {pendingCount > 0 && activeTab !== 'approvals' && (
              <span className="bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>

          {/* Tab 2 — My Requests */}
          <button
            onClick={() => switchTab('my-requests')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'my-requests'
                ? 'bg-white dark:bg-black text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            My Requests
          </button>
        </div>

        {/* ── Tab content ── */}
        {activeTab === 'approvals' ? (
          <ApprovalsDashboard
            user={user}
            stats={stats}
            steps={steps}
            history={history}
            total={total}
            page={page}
            setPage={setPage}
            LIMIT={LIMIT}
          />
        ) : (
          <MyRequestsDashboard user={user} />
        )}
      </div>
    </Layout>
  );
}