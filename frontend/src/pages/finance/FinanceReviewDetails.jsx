import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFinanceRequestDetails, financeApprove, financeReject, financeNeedsReview } from '../../api/finance.api';
import api from '../../api/axios';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

const STEP_STYLE = {
  APPROVED: { bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500',  label: '✓ Approved' },
  REJECTED: { bg: 'bg-red-50   dark:bg-red-500/10',   border: 'border-red-200   dark:border-red-500/20',   text: 'text-red-700   dark:text-red-400',   dot: 'bg-red-500',    label: '✕ Rejected' },
  PENDING:  { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500',  label: '⏳ Pending'  },
  WAITING:  { bg: 'bg-gray-50  dark:bg-gray-800/30',  border: 'border-gray-200  dark:border-gray-700/40',  text: 'text-gray-500  dark:text-gray-500',  dot: 'bg-gray-300 dark:bg-gray-600', label: '— Waiting'  },
};

const TIMELINE_LABELS = {
  SUBMITTED_FOR_HOD_APPROVAL: { label: 'Submitted for HOD approval', color: 'bg-blue-500',   icon: '📤' },
  SUBMITTED_TO_FINANCE:       { label: 'Submitted to Finance',       color: 'bg-blue-500',   icon: '📤' },
  HOD_APPROVED:               { label: 'Approved by HOD',            color: 'bg-green-500',  icon: '✓'  },
  HOD_REJECTED:               { label: 'Rejected by HOD',            color: 'bg-red-500',    icon: '✕'  },
  FINANCE_APPROVED:           { label: 'Approved by Finance',        color: 'bg-green-500',  icon: '✓'  },
  FINANCE_REJECTED:           { label: 'Rejected by Finance',        color: 'bg-red-500',    icon: '✕'  },
  MARKED_NEEDS_REVIEW:        { label: 'Sent back for revision',     color: 'bg-orange-500', icon: '🔄' },
};

const dedupeHistory = (h = []) => {
  const seen = new Set();
  return (h || []).filter(item => {
    const k = `${item?.action}-${item?.actorId}-${item?.toStatus}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
};

const card = 'bg-white dark:bg-black border border-orange-100 dark:border-orange-500/15 rounded-2xl';

export default function FinanceReviewDetails() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [req, setReq]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [remarks, setRemarks] = useState('');
  const [acting, setActing]   = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getFinanceRequestDetails(id)
      .then(r => {
        setReq(r.data.data);
        // mark as viewed
        api.post(`/requests/${id}/mark-viewed`).catch(() => {});
      })
      .catch(err => {
        const msg = err.response?.data?.message || 'Failed to load request';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (type) => {
    if ((type === 'reject' || type === 'review') && !remarks.trim()) {
      toast.error('Remarks are required for this action');
      return;
    }
    if (type === 'approve' && !remarks.trim()) {
      toast.error('Remarks are required for approval');
      return;
    }
    setActing(type);
    try {
      if (type === 'approve') await financeApprove(id, { remarks });
      if (type === 'reject')  await financeReject(id, { remarks });
      if (type === 'review')  await financeNeedsReview(id, { remarks });
      const msgs = {
        approve: '✓ Request approved',
        reject:  '✕ Request rejected',
        review:  '↺ Sent back for review',
      };
      toast.success(msgs[type]);
      navigate('/finance/queue');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally { setActing(null); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;

  // Error state — don't crash
  if (error) return (
    <Layout>
      <div className="max-w-2xl mx-auto mt-8">
        <button onClick={() => navigate('/finance/queue')}
          className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1 mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to queue
        </button>
        <div className="bg-red-50 dark:bg-red-500/5 border border-red-200
                        dark:border-red-500/20 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-sm font-bold text-red-700 dark:text-red-400">Error loading request</p>
          <p className="text-xs text-red-500 dark:text-red-500 mt-1">{error}</p>
          <button onClick={() => window.location.reload()}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white text-xs
                       font-bold px-4 py-2 rounded-xl transition-colors">
            Retry
          </button>
        </div>
      </div>
    </Layout>
  );

  if (!req) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-400 dark:text-gray-500">Request not found</p>
        <button onClick={() => navigate('/finance/queue')}
          className="mt-3 text-xs text-orange-500 hover:underline">
          ← Back to queue
        </button>
      </div>
    </Layout>
  );

  const isPending  = req.status === 'PENDING_FINANCE_APPROVAL';
  const timeline   = dedupeHistory(req.workflowHistory || []);
  const financeReview = req.financeReviews?.[0];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">

        {/* Back */}
        <button onClick={() => navigate('/finance/queue')}
          className="text-xs text-gray-400 hover:text-orange-500 flex items-center
                     gap-1 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to queue
        </button>

        {/* Main card */}
        <div className={card + ' p-5'}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                {req.title}
              </h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {req.requestNumber} · by {req.createdBy?.name}
                · {req.createdBy?.department?.name}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-orange-500">
                {formatCurrency(req.amount)}
              </p>
              <StatusBadge status={req.status} />
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {req.description}
          </p>

          {/* Meta */}
          {(req.purpose || req.startDate || req.endDate) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {req.purpose && (
                <div className="bg-orange-50 dark:bg-orange-500/5 rounded-xl p-3
                                border border-orange-100 dark:border-orange-500/10">
                  <p className="text-xs text-gray-400 mb-0.5">Purpose</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {req.purpose}
                  </p>
                </div>
              )}
              {req.startDate && (
                <div className="bg-orange-50 dark:bg-orange-500/5 rounded-xl p-3
                                border border-orange-100 dark:border-orange-500/10">
                  <p className="text-xs text-gray-400 mb-0.5">Start Date</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {formatDate(req.startDate)}
                  </p>
                </div>
              )}
              {req.endDate && (
                <div className="bg-orange-50 dark:bg-orange-500/5 rounded-xl p-3
                                border border-orange-100 dark:border-orange-500/10">
                  <p className="text-xs text-gray-400 mb-0.5">End Date</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {formatDate(req.endDate)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* HOD chain */}
          {req.approvalSteps?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400
                             uppercase tracking-wide mb-2">
                HOD Approval Chain
              </p>
              <div className="space-y-2">
                {req.approvalSteps.map(step => {
                  const s = STEP_STYLE[step.status] || STEP_STYLE.WAITING;
                  return (
                    <div key={step.id}
                      className={`flex items-center justify-between p-3 rounded-xl border
                                  ${s.bg} ${s.border}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`} />
                        <div>
                          <p className={`text-xs font-semibold ${s.text}`}>
                            Level {step.hodLevel} — {step.approver?.name}
                          </p>
                          {step.remarks && (
                            <p className="text-xs text-gray-400 italic mt-0.5">
                              "{step.remarks}"
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg
                                       ${s.bg} ${s.text} border ${s.border}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Finance actions */}
          {isPending && (
            <div className="border-t border-orange-100 dark:border-orange-500/10 pt-4">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400
                                 uppercase tracking-wide mb-1.5">
                Remarks <span className="text-orange-500">*</span>
                <span className="normal-case font-normal text-gray-400 ml-1">
                  — required for all actions
                </span>
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder="Enter your finance remarks before taking action…"
                className={`w-full rounded-xl px-4 py-2.5 text-sm resize-none transition-all
                  bg-white dark:bg-black
                  border ${!remarks.trim()
                    ? 'border-orange-200 dark:border-orange-500/30'
                    : 'border-green-300 dark:border-green-500/30'}
                  text-gray-900 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-600
                  focus:outline-none focus:ring-2 focus:ring-orange-500/40`}
              />
              {!remarks.trim() && (
                <p className="text-xs text-orange-400 mt-1">
                  ⚠ Enter remarks before any action
                </p>
              )}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={!!acting || !remarks.trim()}
                  className="flex items-center justify-center gap-1.5
                             bg-green-500 hover:bg-green-600 text-white
                             font-bold rounded-xl py-2.5 text-sm transition-all
                             disabled:opacity-40 shadow-sm shadow-green-500/20">
                  {acting === 'approve' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                  ) : <><span>✓</span> Approve</>}
                </button>
                <button
                  onClick={() => handleAction('review')}
                  disabled={!!acting || !remarks.trim()}
                  className="flex items-center justify-center gap-1.5
                             bg-orange-500 hover:bg-orange-600 text-white
                             font-bold rounded-xl py-2.5 text-sm transition-all
                             disabled:opacity-40 shadow-sm shadow-orange-500/20">
                  {acting === 'review' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                  ) : <><span>↺</span> Review</>}
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={!!acting || !remarks.trim()}
                  className="flex items-center justify-center gap-1.5
                             bg-red-500 hover:bg-red-600 text-white
                             font-bold rounded-xl py-2.5 text-sm transition-all
                             disabled:opacity-40 shadow-sm shadow-red-500/20">
                  {acting === 'reject' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                  ) : <><span>✕</span> Reject</>}
                </button>
              </div>
            </div>
          )}

          {/* Previous finance review */}
          {financeReview && !isPending && (
            <div className={`mt-4 p-4 rounded-xl border
              ${financeReview.action === 'APPROVED'
                ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Finance Decision: {financeReview.action}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(financeReview.reviewedAt)}
                </p>
              </div>
              {financeReview.remarks && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                  "{financeReview.remarks}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Attachments */}
        {req.attachments?.length > 0 && (
          <div className={card + ' p-5'}>
            <p className="text-sm font-black text-gray-800 dark:text-white mb-3">
              Attachments ({req.attachments.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {req.attachments.map(att => (
                <div key={att.id}
                  className="flex items-center gap-3 p-3 bg-orange-50
                             dark:bg-orange-500/5 rounded-xl border border-orange-100
                             dark:border-orange-500/10">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-500/10 rounded-lg
                                  flex items-center justify-center text-orange-500 flex-shrink-0 text-sm">
                    📎
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                      {att.originalName || att.fileName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className={card + ' p-5'}>
            <p className="text-sm font-black text-gray-800 dark:text-white mb-4">
              Workflow Timeline
            </p>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px
                              bg-orange-100 dark:bg-orange-500/10" />
              <div className="space-y-4">
                {timeline.map((item, idx) => {
                  if (!item) return null;
                  const cfg = TIMELINE_LABELS[item.action] || {
                    label: (item.action || '').replace(/_/g, ' '),
                    color: 'bg-gray-400', icon: '•',
                  };
                  return (
                    <div key={item.id || idx} className="relative flex gap-4 pl-2">
                      <div className={`relative z-10 w-6 h-6 rounded-full ${cfg.color}
                                      flex items-center justify-center text-white
                                      text-xs font-bold flex-shrink-0`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              {item.actor?.name || 'System'}
                              {item.actorRole && (
                                <span className="ml-1.5 font-normal text-xs text-gray-400
                                                 bg-gray-100 dark:bg-[#1a1d2e] px-1.5 py-0.5 rounded">
                                  {item.actorRole}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              {cfg.label}
                            </p>
                            {item.remarks && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                                "{item.remarks}"
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500
                                         whitespace-nowrap flex-shrink-0">
                            {item.createdAt ? formatDateTime(item.createdAt) : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}