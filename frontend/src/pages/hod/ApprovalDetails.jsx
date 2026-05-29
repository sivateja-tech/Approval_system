import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHODRequestDetails, approveRequest, rejectRequest } from '../../api/hod.api';
import api from '../../api/axios';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import RequestTimeline from '../../components/RequestTimeline';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import { card, inp, STATUS } from '../../styles/theme';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const STEP_STYLE = {
  APPROVED: { bg: 'bg-green-50  dark:bg-green-500/10',  border: 'border-green-200  dark:border-green-500/20',  text: 'text-green-700  dark:text-green-400',  dot: 'bg-green-500',                   label: '✓ Approved' },
  REJECTED: { bg: 'bg-red-50    dark:bg-red-500/10',    border: 'border-red-200    dark:border-red-500/20',    text: 'text-red-700    dark:text-red-400',    dot: 'bg-red-500',                     label: '✕ Rejected' },
  PENDING:  { bg: 'bg-amber-50  dark:bg-amber-500/10',  border: 'border-amber-200  dark:border-amber-500/20',  text: 'text-amber-700  dark:text-amber-400',  dot: 'bg-amber-500 animate-pulse',     label: '⏳ Pending' },
  WAITING:  { bg: 'bg-gray-50   dark:bg-gray-800/30',   border: 'border-gray-200   dark:border-gray-700/40',   text: 'text-gray-500   dark:text-gray-500',   dot: 'bg-gray-300 dark:bg-gray-600',   label: '— Waiting'  },
};

const dedupeHistory = (h = []) => {
  const seen = new Set();
  return h.filter(item => {
    const k = `${item.action}-${item.actorId}-${item.toStatus}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
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

export default function ApprovalDetails() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [req, setReq]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSub]  = useState(false);
  const [action, setAction]   = useState(null); // 'approve' | 'reject'
  const remarksRef            = useRef(null);

  useEffect(() => {
    getHODRequestDetails(id)
      .then(r => {
        setReq(r.data.data);
        // Mark as viewed
        api.post(`/requests/${id}/mark-viewed`).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [id]);

  const myStep = req?.approvalSteps?.find(s => s.approverId === user?.id);
  const canAct = myStep?.status === 'PENDING';

  // Finance status for this request
  const financeStatus =
    req?.status === 'PENDING_FINANCE_APPROVAL' ? 'PENDING' :
    req?.status === 'FINANCE_APPROVED'          ? 'APPROVED' :
    req?.status === 'FINANCE_REJECTED'          ? 'REJECTED' : 'WAITING';

  const handleAction = async (type) => {
    if (!remarks.trim()) {
      toast.error('Please enter remarks before submitting');
      remarksRef.current?.focus();
      return;
    }
    setSub(true);
    try {
      if (type === 'approve') {
        await approveRequest(id, { remarks });
        toast.success('Request approved!');
      } else {
        await rejectRequest(id, { remarks });
        toast.success('Request rejected');
      }
      navigate('/hod/approvals');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally { setSub(false); }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (!req)    return <Layout><p className="p-6 text-gray-400">Not found</p></Layout>;

  const timeline = dedupeHistory(req.workflowHistory || []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">

        {/* Back */}
        <button onClick={() => navigate('/hod/approvals')}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                     flex items-center gap-1 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to approvals
        </button>

        {/* Main card */}
        <div className={card + ' p-5'}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">{req.title}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {req.requestNumber} · by {req.createdBy?.name} · {req.createdBy?.department?.name}
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
                <div className="bg-gray-50 dark:bg-[#1a1d2e] rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Purpose</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{req.purpose}</p>
                </div>
              )}
              {req.startDate && (
                <div className="bg-gray-50 dark:bg-[#1a1d2e] rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Start Date</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatDate(req.startDate)}</p>
                </div>
              )}
              {req.endDate && (
                <div className="bg-gray-50 dark:bg-[#1a1d2e] rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">End Date</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatDate(req.endDate)}</p>
                </div>
              )}
            </div>
          )}

          {/* ── APPROVAL CHAIN — HODs + Finance ── */}
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase
                           tracking-wide mb-3">
              Approval Chain
            </p>
            <div className="space-y-2">
              {req.approvalSteps?.map(step => {
                const s = STEP_STYLE[step.status] || STEP_STYLE.WAITING;
                return (
                  <div key={step.id}
                    className={`flex items-start justify-between p-3 rounded-xl border
                                ${s.bg} ${s.border}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
                      <div>
                        <p className={`text-sm font-semibold ${s.text}`}>
                          Level {step.hodLevel} — {step.approver?.name}
                          {step.approverId === user?.id && (
                            <span className="ml-1.5 text-xs opacity-70">(you)</span>
                          )}
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
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg
                                     ${s.bg} ${s.text} border ${s.border} flex-shrink-0`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}

              {/* Finance step — always shown */}
              {(() => {
                const fs = STEP_STYLE[financeStatus] || STEP_STYLE.WAITING;
                const fr = req.financeReviews?.[0];
                return (
                  <div className={`flex items-start justify-between p-3 rounded-xl border
                                   ${fs.bg} ${fs.border}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${fs.dot}`} />
                      <div>
                        <p className={`text-sm font-semibold ${fs.text}`}>
                          Finance Review
                          <span className="ml-1.5 text-xs opacity-70 font-normal">(Final step)</span>
                        </p>
                        {fr?.remarks && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                            "{fr.remarks}"
                          </p>
                        )}
                        {financeStatus === 'WAITING' && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Waiting for HOD chain to complete
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg
                                     ${fs.bg} ${fs.text} border ${fs.border} flex-shrink-0`}>
                      {financeStatus === 'WAITING' ? '— Waiting' : fs.label}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── SINGLE REMARKS + ACTIONS — only when canAct ── */}
          {canAct && (
            <div className="border-t border-orange-100 dark:border-[#1e2235] pt-4">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400
                                 uppercase tracking-wide mb-1.5">
                Remarks
                <span className="text-red-400 ml-0.5">*</span>
                <span className="ml-1.5 text-gray-400 font-normal normal-case">
                  — required for both approve and reject
                </span>
              </label>
              <textarea
                ref={remarksRef}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder="Enter your remarks here before taking action…"
                className={[
                  inp, 'resize-none',
                  !remarks.trim()
                    ? 'border-orange-300 dark:border-orange-500/30'
                    : 'border-green-300 dark:border-green-500/30',
                ].join(' ')}
              />
              {!remarks.trim() && (
                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Remarks are required before approving or rejecting
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={submitting || !remarks.trim()}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-green-500 hover:bg-green-600 text-white font-bold
                             rounded-xl py-2.5 text-sm transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed
                             shadow-lg shadow-green-500/20">
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={submitting || !remarks.trim()}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-red-500 hover:bg-red-600 text-white font-bold
                             rounded-xl py-2.5 text-sm transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed
                             shadow-lg shadow-red-500/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Attachments */}
        {req.attachments?.filter(a => !a.isDeleted).length > 0 && (
          <div className={card + ' p-5'}>
            <p className="text-sm font-black text-gray-800 dark:text-white mb-3">
              Attachments
            </p>
            <div className="grid grid-cols-2 gap-2">
              {req.attachments.filter(a => !a.isDeleted).map(att => (
                <div key={att.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#1a1d2e]
                             rounded-xl border border-orange-100 dark:border-[#2a2d3e]">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-500/10 rounded-lg
                                  flex items-center justify-center text-orange-500 flex-shrink-0">
                    📎
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                      {att.originalName}
                    </p>
                    <p className="text-xs text-gray-400">{(att.fileSize / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow timeline */}
        {timeline.length > 0 && (
          <div className={card + ' p-5'}>
            <p className="text-sm font-black text-gray-800 dark:text-white mb-4">
              Workflow Timeline
            </p>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px
                              bg-orange-100 dark:bg-[#2a2d3e]" />
              <div className="space-y-4">
                {timeline.map((item, idx) => {
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
                              {item.actor?.name}
                              <span className="ml-1.5 font-normal text-xs text-gray-400
                                               bg-gray-100 dark:bg-[#1a1d2e] px-1.5 py-0.5 rounded">
                                {item.actorRole}
                              </span>
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
                          <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                            {formatDateTime(item.createdAt)}
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