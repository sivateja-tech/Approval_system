import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequestById, submitRequest, cancelRequest } from '../../api/request.api';
import api from '../../api/axios';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

// ── Deduplicate timeline ──────────────────────────────────────────────────
const dedupeHistory = (h = []) => {
  const seen = new Set();
  return (h || []).filter(item => {
    if (!item) return false;
    const k = `${item.action}-${item.actorId}-${item.toStatus}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ── Step style map ────────────────────────────────────────────────────────
const STEP = {
  APPROVED: {
    bg:     'bg-green-50 dark:bg-green-500/10',
    border: 'border-green-200 dark:border-green-500/20',
    text:   'text-green-700 dark:text-green-400',
    dot:    'bg-green-500',
    badge:  'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    icon:   '✓',
    label:  'Approved',
  },
  REJECTED: {
    bg:     'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/20',
    text:   'text-red-700 dark:text-red-400',
    dot:    'bg-red-500',
    badge:  'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    icon:   '✕',
    label:  'Rejected',
  },
  PENDING: {
    bg:     'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
    text:   'text-amber-700 dark:text-amber-400',
    dot:    'bg-amber-500 animate-pulse',
    badge:  'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    icon:   '⏳',
    label:  'Pending',
  },
  WAITING: {
    bg:     'bg-gray-50 dark:bg-gray-800/20',
    border: 'border-gray-200 dark:border-gray-700/40',
    text:   'text-gray-400 dark:text-gray-500',
    dot:    'bg-gray-300 dark:bg-gray-600',
    badge:  'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
    icon:   '—',
    label:  'Waiting',
  },
  SKIPPED: {
    bg:     'bg-gray-50 dark:bg-gray-800/10',
    border: 'border-gray-200 dark:border-gray-700/30',
    text:   'text-gray-400 dark:text-gray-600',
    dot:    'bg-gray-200 dark:bg-gray-700',
    badge:  'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600',
    icon:   '—',
    label:  'Skipped',
  },
};

// ── Timeline action config ────────────────────────────────────────────────
const TL = {
  SUBMITTED_FOR_HOD_APPROVAL: {
    label: 'Submitted for HOD approval',
    iconBg: 'bg-blue-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  SUBMITTED_TO_FINANCE: {
    label: 'Submitted to Finance',
    iconBg: 'bg-blue-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  HOD_APPROVED: {
    label: 'Approved by HOD',
    iconBg: 'bg-green-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  HOD_REJECTED: {
    label: 'Rejected by HOD',
    iconBg: 'bg-red-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  FINANCE_APPROVED: {
    label: 'Approved by Finance',
    iconBg: 'bg-green-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  FINANCE_REJECTED: {
    label: 'Rejected by Finance',
    iconBg: 'bg-red-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  MARKED_NEEDS_REVIEW: {
    label: 'Sent back for revision',
    iconBg: 'bg-orange-500', icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
};

const card = 'bg-white dark:bg-black border border-orange-100 dark:border-orange-500/15 rounded-2xl shadow-sm';

export default function RequestDetails() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [req, setReq]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    getRequestById(id)
      .then(r => setReq(r.data.data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const canEdit = req && (
    ['DRAFT', 'NEEDS_REVIEW'].includes(req.status) ||
    (req.status === 'PENDING_HOD_APPROVAL'     && !req.viewedByHODAt) ||
    (req.status === 'PENDING_FINANCE_APPROVAL' && !req.viewedByFinanceAt)
  );
  const canSubmit = req && ['DRAFT', 'NEEDS_REVIEW'].includes(req.status);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitRequest(id);
      toast.success('Request submitted!');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Submit failed'); }
    finally     { setSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await cancelRequest(id);
      toast.success('Request cancelled');
      navigate('/requests');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;
  if (!req)    return <Layout><p className="p-6 text-gray-400">Request not found</p></Layout>;

  const rejectedStep = req.approvalSteps?.find(s => s.status === 'REJECTED');
  const timeline     = dedupeHistory(req.workflowHistory || []);

  // Determine finance step status
  const financeStatus = () => {
    if (req.status === 'FINANCE_APPROVED')         return 'APPROVED';
    if (req.status === 'FINANCE_REJECTED')         return 'REJECTED';
    if (req.status === 'PENDING_FINANCE_APPROVAL') return 'PENDING';
    // Check if all HODs approved → finance is next
    const allHODsDone = req.approvalSteps?.length > 0 &&
      req.approvalSteps.every(s => ['APPROVED', 'REJECTED', 'SKIPPED'].includes(s.status));
    if (allHODsDone && req.approvalSteps?.every(s => s.status === 'APPROVED')) return 'PENDING';
    return 'WAITING';
  };

  const finSt = req.status === 'DRAFT' ? null : financeStatus();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">

        {/* Header row */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/requests')}
            className="text-xs text-gray-400 hover:text-orange-500 flex items-center
                       gap-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex-1" />
          <StatusBadge status={req.status} />
        </div>

        {/* Main card */}
        <div className={card + ' p-5'}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">
                {req.title}
              </h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {req.requestNumber} · Created {formatDate(req.createdAt)}
              </p>
            </div>
            <p className="text-2xl font-black text-orange-500 flex-shrink-0">
              {formatCurrency(req.amount)}
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {req.description}
          </p>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {req.createdBy?.department?.name && (
              <span className="text-xs bg-orange-50 dark:bg-orange-500/10 text-orange-600
                               dark:text-orange-400 border border-orange-100 dark:border-orange-500/20
                               px-3 py-1 rounded-lg">
                {req.createdBy.department.name}
              </span>
            )}
            {req.purpose && (
              <span className="text-xs bg-gray-50 dark:bg-gray-800/50 text-gray-600
                               dark:text-gray-400 border border-gray-200 dark:border-gray-700
                               px-3 py-1 rounded-lg">
                {req.purpose}
              </span>
            )}
            {req.startDate && (
              <span className="text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-600
                               dark:text-blue-400 border border-blue-100 dark:border-blue-500/20
                               px-3 py-1 rounded-lg">
                📅 {formatDate(req.startDate)} → {req.endDate ? formatDate(req.endDate) : '—'}
              </span>
            )}
          </div>

          {/* HOD rejection banner */}
          {req.status === 'NEEDS_REVIEW' && rejectedStep && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200
                            dark:border-red-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-red-100 dark:bg-red-500/20 rounded-full
                                flex items-center justify-center text-red-500 font-black
                                text-sm flex-shrink-0">
                  ✕
                </div>
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">
                    Rejected by {rejectedStep.approver?.name}
                    <span className="ml-2 text-xs font-normal bg-red-100 dark:bg-red-500/20
                                     text-red-500 px-2 py-0.5 rounded-full">
                      Level {rejectedStep.hodLevel} HOD
                    </span>
                  </p>
                  {rejectedStep.remarks && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                      "{rejectedStep.remarks}"
                    </p>
                  )}
                  <p className="text-xs text-red-400 mt-1.5">
                    Edit your request and resubmit. The approval chain will restart from Level 1.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {(canEdit || canSubmit) && (
            <div className="flex gap-2 pt-4 border-t border-orange-100 dark:border-orange-500/10">
              {canEdit && (
                <button onClick={() => navigate(`/requests/${id}/edit`)}
                  className="flex items-center gap-1.5 border border-orange-200
                             dark:border-orange-500/20 text-gray-600 dark:text-gray-400
                             rounded-xl px-4 py-2.5 text-sm font-semibold
                             bg-white dark:bg-transparent
                             hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
              )}
              {canSubmit && (
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl
                             py-2.5 text-sm font-black shadow-lg shadow-orange-500/20
                             disabled:opacity-50 transition-all hover:scale-[1.01]">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent
                                       rounded-full animate-spin" />
                      Submitting…
                    </span>
                  ) : 'Submit Request'}
                </button>
              )}
              {canSubmit && (
                <button onClick={handleCancel}
                  className="border border-red-200 dark:border-red-500/20 text-red-500
                             dark:text-red-400 rounded-xl px-4 py-2.5 text-sm font-semibold
                             bg-white dark:bg-transparent
                             hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── APPROVAL CHAIN — only after submission ── */}
        {req.status !== 'DRAFT' && (
          <div className={card + ' p-5'}>
            <h2 className="text-sm font-black text-gray-800 dark:text-white mb-4">
              Approval Chain
            </h2>
            <div className="space-y-2">

              {/* HOD steps */}
              {req.approvalSteps?.length > 0 ? (
                req.approvalSteps.map(step => {
                  const s = STEP[step.status] || STEP.WAITING;
                  return (
                    <div key={step.id}
                      className={`flex items-start justify-between p-3.5 rounded-xl border
                                  ${s.bg} ${s.border}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center
                                        text-white text-xs font-black flex-shrink-0 mt-0.5
                                        ${s.dot}`}>
                          {s.icon}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${s.text}`}>
                            Level {step.hodLevel} — {step.approver?.name}
                            <span className="ml-2 text-xs font-normal opacity-60">(HOD)</span>
                          </p>
                          {step.remarks && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                              "{step.remarks}"
                            </p>
                          )}
                          {step.actionAt && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {formatDateTime(step.actionAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${s.badge}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/20
                                border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No HOD approval required — goes directly to Finance
                  </p>
                </div>
              )}

              {/* Finance step — always shown after submission */}
              {finSt && (() => {
                const s  = STEP[finSt] || STEP.WAITING;
                const fr = req.financeReviews?.[0];
                return (
                  <div className={`flex items-start justify-between p-3.5 rounded-xl border
                                   ${s.bg} ${s.border}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center
                                      text-white text-xs font-black flex-shrink-0 mt-0.5
                                      ${s.dot}`}>
                        {s.icon}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${s.text}`}>
                          Finance Review
                          <span className="ml-2 text-xs font-normal opacity-60">(Final)</span>
                        </p>
                        {fr?.remarks && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                            "{fr.remarks}"
                          </p>
                        )}
                        {finSt === 'WAITING' && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Waiting for HOD approvals to complete
                          </p>
                        )}
                        {finSt === 'PENDING' && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Under finance review
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${s.badge}`}>
                      {finSt === 'WAITING' ? 'Waiting' : s.label}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Attachments */}
        {req.attachments?.length > 0 && (
          <div className={card + ' p-5'}>
            <h2 className="text-sm font-black text-gray-800 dark:text-white mb-3">
              Attachments ({req.attachments.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {req.attachments.map(att => (
                <div key={att.id}
                  className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-500/5
                             rounded-xl border border-orange-100 dark:border-orange-500/10">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-500/10 rounded-lg
                                  flex items-center justify-center text-orange-500 flex-shrink-0">
                    📎
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                      {att.originalName || att.fileName}
                    </p>
                    {att.fileSize && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {(att.fileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WORKFLOW TIMELINE — beautiful diagram style ── */}
        {req.status !== 'DRAFT' && timeline.length > 0 && (
          <div className={card + ' p-5'}>
            <h2 className="text-sm font-black text-gray-800 dark:text-white mb-5">
              Workflow Timeline
            </h2>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5
                              bg-gradient-to-b from-orange-200 via-orange-100 to-transparent
                              dark:from-orange-500/30 dark:via-orange-500/10 dark:to-transparent" />

              <div className="space-y-0">
                {timeline.map((item, idx) => {
                  if (!item) return null;
                  const cfg = TL[item.action];
                  const isLast = idx === timeline.length - 1;

                  return (
                    <div key={item.id || idx}
                      className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}>

                      {/* Icon circle */}
                      <div className={`relative z-10 w-10 h-10 rounded-full flex-shrink-0
                                      flex items-center justify-center shadow-sm
                                      ${cfg ? cfg.iconBg : 'bg-gray-400'}`}>
                        {cfg ? cfg.icon : (
                          <span className="text-white text-xs font-bold">•</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="bg-white dark:bg-[#0f1117] border border-orange-100
                                        dark:border-[#1e2235] rounded-2xl p-3.5 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center
                                          justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-gray-800 dark:text-white">
                                {item.actor?.name || 'System'}
                              </p>
                              {item.actorRole && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md
                                  ${item.actorRole === 'USER'
                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                    : item.actorRole === 'HOD'
                                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                    : item.actorRole === 'FINANCE'
                                    ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                  {item.actorRole}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {item.createdAt ? formatDateTime(item.createdAt) : ''}
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            {cfg?.label || (item.action || '').replace(/_/g, ' ')}
                          </p>
                          {item.remarks && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5
                                           italic border-t border-orange-50 dark:border-[#1e2235]
                                           pt-1.5">
                              "{item.remarks}"
                            </p>
                          )}
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
