import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getRequestById,
  submitRequest,
  cancelRequest,
  validateSubmission,
} from '../../api/request.api';
import Layout from '../../components/Layout/Layout';
import StatusBadge from '../../components/UI/StatusBadge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const STEP = {
  APPROVED:     { bg: 'bg-green-50 dark:bg-green-500/10',  border: 'border-green-200 dark:border-green-500/20',  text: 'text-green-700 dark:text-green-400',  dot: 'bg-green-500',               badge: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',   icon: '✓',  label: 'Approved'     },
  REJECTED:     { bg: 'bg-red-50 dark:bg-red-500/10',      border: 'border-red-200 dark:border-red-500/20',      text: 'text-red-700 dark:text-red-400',      dot: 'bg-red-500',                 badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',           icon: '✕',  label: 'Rejected'     },
  PENDING:      { bg: 'bg-amber-50 dark:bg-amber-500/10',  border: 'border-amber-200 dark:border-amber-500/20',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500 animate-pulse', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',  icon: '⏳', label: 'Pending'      },
  NEEDS_REVIEW: { bg: 'bg-amber-50 dark:bg-amber-500/10',  border: 'border-amber-200 dark:border-amber-500/20',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500',               badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',  icon: '🔄', label: 'Needs Review' },
  WAITING:      { bg: 'bg-gray-50 dark:bg-gray-800/20',    border: 'border-gray-200 dark:border-gray-700/40',    text: 'text-gray-400 dark:text-gray-500',    dot: 'bg-gray-300 dark:bg-gray-600', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',        icon: '—',  label: 'Waiting'      },
  SKIPPED:      { bg: 'bg-gray-50 dark:bg-gray-800/10',    border: 'border-gray-200 dark:border-gray-700/30',    text: 'text-gray-400 dark:text-gray-600',    dot: 'bg-gray-200 dark:bg-gray-700', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600',        icon: '⏭️', label: 'Skipped'      },
};

const TL = {
  SUBMITTED:                      { label: 'Request Submitted',                    iconBg: 'bg-blue-500',   icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> },
  SUBMITTED_FOR_MANAGER_APPROVAL: { label: 'Submitted for Manager approval',       iconBg: 'bg-blue-500',   icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> },
  BYPASSED_TO_FINANCE:            { label: 'Bypassed managers — sent to Finance',  iconBg: 'bg-blue-500',   icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg> },
  SUBMITTED_TO_FINANCE:           { label: 'Submitted to Finance',                 iconBg: 'bg-blue-500',   icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> },
  RESUBMITTED:                    { label: 'Request Resubmitted',                  iconBg: 'bg-blue-500',   icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
  WORKFLOW_RECALCULATED:          { label: 'Approval chain recalculated',          iconBg: 'bg-purple-500', icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
  MANAGER_APPROVED:               { label: 'Approved by Manager',                  iconBg: 'bg-green-500',  icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> },
  MANAGER_REJECTED:               { label: 'Rejected by Manager',                  iconBg: 'bg-red-500',    icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> },
  FINANCE_APPROVED:               { label: 'Approved by Finance',                  iconBg: 'bg-green-500',  icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> },
  FINANCE_REJECTED:               { label: 'Rejected by Finance',                  iconBg: 'bg-red-500',    icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> },
  FINANCE_NEEDS_REVIEW:           { label: 'Sent back for revision',               iconBg: 'bg-amber-500',  icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
  MARKED_NEEDS_REVIEW:            { label: 'Sent back for revision',               iconBg: 'bg-amber-500',  icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
  CANCELLED:                      { label: 'Request Cancelled',                    iconBg: 'bg-gray-500',   icon: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> },
};

const card = 'bg-white dark:bg-black border border-amber-100 dark:border-amber-500/15 rounded-2xl shadow-sm';

const fileIcon = (type = '') => {
  if (type.includes('pdf'))   return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('sheet') || type.includes('excel'))   return '📊';
  return '📎';
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function RequestDetails() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [req, setReq]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Bug 2: validation state
  const [validation, setValidation] = useState(null); // { blocked, reason }

  const load = useCallback(() => {
    getRequestById(id)
      .then(r => setReq(r.data.data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Bug 2: call validateSubmission whenever we load a DRAFT or NEEDS_REVIEW request
  useEffect(() => {
    if (!req) return;
    if (!['DRAFT', 'NEEDS_REVIEW'].includes(req.status)) {
      setValidation(null);
      return;
    }
    validateSubmission(id)
      .then(r => setValidation(r.data.data))
      .catch(() => setValidation(null));
  }, [id, req?.status, req?.amount]); // re-validate if amount changes after an edit

  // ── Action guards ─────────────────────────────────────────────────────────
  const isPermanentlyRejected = req?.isRejectedPermanently === true;
  const isAlwaysEditable      = req && ['DRAFT', 'NEEDS_REVIEW'].includes(req.status) && !isPermanentlyRejected;
  const hasBeenViewed         = req && (req.viewedByManagerAt || req.viewedByFinanceAt);
  const isPendingButUnviewed  = req &&
    ['SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'].includes(req.status) &&
    !hasBeenViewed;

  const canEdit   = isAlwaysEditable || isPendingButUnviewed;
  // Bug 2: canSubmit also requires validation to pass (not blocked)
  const canSubmit = req &&
    ['DRAFT', 'NEEDS_REVIEW'].includes(req.status) &&
    !isPermanentlyRejected &&
    !validation?.blocked;
  const canCancel = (isAlwaysEditable || isPendingButUnviewed) && !isPermanentlyRejected;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitRequest(id);
      toast.success('Request submitted!');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await cancelRequest(id);
      toast.success('Request cancelled');
      navigate('/requests');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  // ── Cloudinary Direct Link Viewer ──────────────────────────────────────────
  const handleViewFile = (fileUrl) => {
    if (!fileUrl) {
      toast.error("File link is not available.");
      return;
    }
    // Securely opens the live Cloudinary URL in a new tab
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><LoadingSpinner /></div></Layout>;
  if (!req)    return <Layout><p className="p-6 text-gray-400">Request not found</p></Layout>;

  const timeline = dedupeHistory(req.workflowHistory || []);

  // Bug 3: only show chain section when request has been submitted (has steps)
  // DRAFT with no steps shows nothing rather than an empty/broken chain.
  const isDraft = req.status === 'DRAFT';

  const currentCycleSteps = (req.approvalSteps || []).filter(
    s => s.cycle === req.approvalCycle && s.isEligible !== false
  );

  const activeApprovalChain = Object.values(
    currentCycleSteps.reduce((acc, step) => {
      acc[step.level] = step;
      return acc;
    }, {})
  ).sort((a, b) => a.level - b.level);

  const rejectedStep = activeApprovalChain.find(s => s.status === 'REJECTED');

  const financeStatus = () => {
    if (req.status === 'FINANCE_APPROVED')         return 'APPROVED';
    if (req.status === 'FINANCE_REJECTED')         return 'REJECTED';
    if (req.status === 'NEEDS_REVIEW')             return 'NEEDS_REVIEW';
    if (req.status === 'PENDING_FINANCE_APPROVAL') return 'PENDING';
    const allDone = activeApprovalChain.length > 0 &&
      activeApprovalChain.every(s => ['APPROVED', 'REJECTED', 'SKIPPED'].includes(s.status));
    if (allDone && activeApprovalChain.every(s => ['APPROVED', 'SKIPPED'].includes(s.status)))
      return 'PENDING';
    return 'WAITING';
  };

  const finSt = (isDraft || req.status === 'CANCELLED') ? null : financeStatus();

  const approvedByLabel = req.approvedByName ? `Approved by ${req.approvedByName}` : null;
  const rejectedByLabel = req.rejectedByName
    ? `Rejected by ${req.rejectedByName}${req.rejectionSource === 'FINANCE' ? ' (Finance)' : ' (Manager)'}`
    : null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">

        {/* Header row */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/requests')}
            className="text-xs text-gray-400 hover:text-amber-500 flex items-center gap-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex-1" />
          <StatusBadge status={req.status} />
        </div>

        {/* ── Main card ── */}
        <div className={card + ' p-5'}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">{req.title}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {req.requestNumber} · Created {formatDate(req.createdAt)}
              </p>
            </div>
            <p className="text-2xl font-black text-amber-500 flex-shrink-0">
              {formatCurrency(req.amount)}
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {req.description}
          </p>

          {/* ── Bug 2: inline amount warning ── */}
          {validation?.blocked && (
            <div className="mb-4 flex items-start gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-400">Cannot Submit</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{validation.reason}</p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  Please reduce the amount or contact an admin to update the approval hierarchy.
                </p>
              </div>
            </div>
          )}

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {req.createdBy?.department?.name && (
              <span className="text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 px-3 py-1 rounded-lg">
                {req.createdBy.department.name}
              </span>
            )}
            {req.purpose && (
              <span className="text-xs bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-lg">
                {req.purpose}
              </span>
            )}
            {req.startDate && (
              <span className="text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 px-3 py-1 rounded-lg">
                📅 {formatDate(req.startDate)} → {req.endDate ? formatDate(req.endDate) : '—'}
              </span>
            )}
            {approvedByLabel && (
              <span className="text-xs bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 px-3 py-1 rounded-lg font-semibold">
                ✓ {approvedByLabel}
              </span>
            )}
            {rejectedByLabel && (
              <span className="text-xs bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 px-3 py-1 rounded-lg font-semibold">
                ✕ {rejectedByLabel}
              </span>
            )}
          </div>

          {/* Status alerts */}
          {req.status === 'REJECTED' && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center text-red-500 flex-shrink-0 mt-0.5 font-black text-sm">✕</div>
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-400">
                  {rejectedByLabel || `Rejected by ${rejectedStep?.approver?.name || 'Manager'}`}
                  {rejectedStep && (
                    <span className="ml-2 text-xs font-normal bg-red-100 dark:bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full">
                      Level {rejectedStep.level} Manager
                    </span>
                  )}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                  "{rejectedStep?.remarks || 'No remarks provided'}"
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-bold">
                  This request has been permanently closed and cannot be resubmitted.
                </p>
              </div>
            </div>
          )}

          {req.status === 'NEEDS_REVIEW' && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 flex-shrink-0 mt-0.5 text-lg">🔄</div>
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Needs Review (Returned by Finance)</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 italic">
                  "{req.financeReviews?.[0]?.remarks || 'Please review and update your request.'}"
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  Finance has requested changes. Edit your request and resubmit.
                </p>
              </div>
            </div>
          )}

          {req.status === 'FINANCE_REJECTED' && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center text-red-500 flex-shrink-0 mt-0.5 font-black text-sm">✕</div>
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-400">
                  {rejectedByLabel || 'Rejected by Finance'}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                  "{req.financeReviews?.[0]?.remarks || 'No remarks provided'}"
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-bold">
                  This request has been permanently closed and cannot be resubmitted.
                </p>
              </div>
            </div>
          )}

          {req.status === 'FINANCE_APPROVED' && approvedByLabel && (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center text-green-500 flex-shrink-0 mt-0.5 font-black text-sm">✓</div>
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-400">Fully Approved</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  Manager: {approvedByLabel} · Finance: approved
                </p>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {(canEdit || canSubmit || canCancel || (isAlwaysEditable && validation?.blocked)) && (
            <div className="flex gap-2 pt-4 border-t border-amber-100 dark:border-amber-500/10">
              {canEdit && (
                <button onClick={() => navigate(`/requests/${id}/edit`)}
                  className="flex items-center gap-1.5 border border-amber-200 dark:border-amber-500/20 text-gray-600 dark:text-gray-400 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white dark:bg-transparent hover:bg-amber-50 dark:hover:bg-amber-500/5 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
              )}
              {canCancel && (
                <button onClick={handleCancel}
                  className="border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white dark:bg-transparent hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors">
                  Cancel
                </button>
              )}
              {/* Bug 2: Submit button always rendered for DRAFT/NEEDS_REVIEW but disabled + greyed when validation says blocked */}
              {req && ['DRAFT', 'NEEDS_REVIEW'].includes(req.status) && !isPermanentlyRejected && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || validation?.blocked}
                  title={validation?.blocked ? 'Amount exceeds maximum approvable limit' : ''}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-all
                    ${validation?.blocked
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.01]'}
                    disabled:opacity-50`}>
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting…
                    </span>
                  ) : validation?.blocked ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Submit Blocked
                    </span>
                  ) : 'Submit Request'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── APPROVAL CHAIN — hidden for DRAFT (Bug 3) ── */}
        {!isDraft && req.status !== 'CANCELLED' && (
          <div className={card + ' p-5'}>
            <h2 className="text-sm font-black text-gray-800 dark:text-white mb-4">Approval Chain</h2>
            <div className="space-y-2">
              {activeApprovalChain.length > 0 ? (
                activeApprovalChain.map(step => {
                  const s = STEP[step.status] || STEP.WAITING;
                  return (
                    <div key={step.id}
                      className={`flex items-start justify-between p-3.5 rounded-xl border ${s.bg} ${s.border}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5 ${s.dot}`}>
                          {s.icon}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${s.text}`}>
                            Level {step.level} — {step.approver?.name}
                            <span className="ml-2 text-xs font-normal opacity-60">(Manager)</span>
                          </p>
                          {step.remarks && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">"{step.remarks}"</p>
                          )}
                          {step.actionAt && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDateTime(step.actionAt)}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${s.badge}`}>{s.label}</span>
                    </div>
                  );
                })
              ) : (
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No Manager approval required — sent directly to Finance
                  </p>
                </div>
              )}

              {/* Finance step */}
              {finSt && (() => {
                const s  = STEP[finSt] || STEP.WAITING;
                const fr = req.financeReviews?.[0];
                return (
                  <div className={`flex items-start justify-between p-3.5 rounded-xl border ${s.bg} ${s.border}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5 ${s.dot}`}>
                        {s.icon}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${s.text}`}>
                          Finance Review
                          <span className="ml-2 text-xs font-normal opacity-60">(Final)</span>
                        </p>
                        {finSt === 'NEEDS_REVIEW' && <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-0.5">"{fr?.remarks || 'Please review and resubmit'}"</p>}
                        {finSt === 'REJECTED'     && <p className="text-xs text-red-600 dark:text-red-400 italic mt-0.5">"{fr?.remarks || 'Request rejected'}"</p>}
                        {finSt === 'APPROVED'     && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Request successfully processed and approved.</p>}
                        {finSt === 'PENDING'      && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Currently under finance review</p>}
                        {finSt === 'WAITING'      && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Waiting for Manager approvals to complete</p>}
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

        {/* ── ATTACHMENTS — Cloudinary Viewing ── */}
        {req.attachments?.filter(a => !a.isDeleted).length > 0 && (
          <div className={card + ' p-5'}>
            <h2 className="text-sm font-black text-gray-800 dark:text-white mb-3">
              Attachments ({req.attachments.filter(a => !a.isDeleted).length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {req.attachments.filter(a => !a.isDeleted).map(att => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => handleViewFile(att.filePath)} // 👉 Pass the Cloudinary URL here
                  className="w-full text-left flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/5 rounded-xl border border-amber-100 dark:border-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors group"
                >
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500 flex-shrink-0 text-base">
                    {fileIcon(att.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {att.originalName || att.fileName}
                    </p>
                    {att.fileSize && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {(att.fileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── WORKFLOW TIMELINE ── */}
        {!isDraft && timeline.length > 0 && (
          <div className={card + ' p-5'}>
            <h2 className="text-sm font-black text-gray-800 dark:text-white mb-5">Workflow Timeline</h2>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-200 via-amber-100 to-transparent dark:from-amber-500/30 dark:via-amber-500/10 dark:to-transparent" />
              <div className="space-y-0">
                {timeline.map((item, idx) => {
                  if (!item) return null;
                  const cfg    = TL[item.action];
                  const isLast = idx === timeline.length - 1;
                  return (
                    <div key={item.id || idx} className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}>
                      <div className={`relative z-10 w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ${cfg ? cfg.iconBg : 'bg-gray-400'}`}>
                        {cfg ? cfg.icon : <span className="text-white text-xs font-bold">•</span>}
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="bg-white dark:bg-[#0f1117] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-3.5 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-gray-800 dark:text-white">
                                {item.actor?.name || 'System'}
                              </p>
                              {item.actorRole && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md
                                  ${item.actorRole === 'USER'    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                  : item.actorRole === 'MANAGER' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                  : item.actorRole === 'FINANCE' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
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
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5 italic border-t border-amber-50 dark:border-[#1e2235] pt-1.5">
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