import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getRequestById,
  updateRequest,
  deleteAttachment,
  getMyLimits,
  getEditLimits,
} from '../../api/request.api';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

// ── Shared UI ─────────────────────────────────────────────────────────────────

const Label = ({ children, required, hint }) => (
  <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-gray-600 dark:text-gray-400">
    {children}
    {required && <span className="text-amber-500 ml-0.5">*</span>}
    {hint && <span className="ml-1.5 normal-case font-normal text-gray-400 dark:text-gray-600">{hint}</span>}
  </label>
);

const fieldCls = `w-full rounded-xl px-4 py-2.5 text-sm transition-all
  bg-white dark:bg-black border border-amber-200 dark:border-amber-500/30
  text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-amber-500/40
  focus:border-amber-500 dark:focus:border-amber-400
  [color-scheme:light] dark:[color-scheme:dark]`;

const numberFieldCls = `${fieldCls}
  [appearance:textfield]
  [&::-webkit-outer-spin-button]:appearance-none
  [&::-webkit-inner-spin-button]:appearance-none`;

const fileIcon = (type = '', name = '') => {
  if (type.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return '🖼️';
  if (type.includes('pdf')   || /\.pdf$/i.test(name))  return '📄';
  if (type.includes('word')  || /\.docx?$/i.test(name)) return '📝';
  if (type.includes('sheet') || /\.xlsx?$/i.test(name)) return '📊';
  return '📎';
};

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// ── Strict Amount Feedback Calculator ─────────────────────────────────────────

const getAmountFeedback = (amount, editLimits) => {
  const v = parseFloat(amount) || 0;
  if (!v || !editLimits) return null;

  const {
    isDraft,
    approvalLimit,
    maxApprovableLimit,
    minAmount,
    maxAmount,
    hasHierarchy,
    highestApproverName,
    highestApproverLimit,
  } = editLimits;

  if (isDraft) {
    if (v <= approvalLimit) return { type: 'ok', message: `${fmt(v)} is within your approval limit (${fmt(approvalLimit)}) — will go directly to Finance.` };
    if (v <= maxApprovableLimit) return { type: 'info', message: `${fmt(v)} exceeds your approval limit — will be routed to eligible managers (max approvable: ${fmt(maxApprovableLimit)}).` };
    if (!hasHierarchy) return { type: 'error', message: `${fmt(v)} exceeds your approval limit and you have no approval chain assigned. Please contact an admin.` };
    return { type: 'error', message: `${fmt(v)} exceeds the maximum approvable limit in your approval chain (${fmt(maxApprovableLimit)}). No eligible approver exists — reduce the amount or contact an admin.` };
  }

  // ── SUBMITTED REQUEST RULES ──
  if (v < minAmount) {
    return { type: 'error', message: `Amount cannot be reduced below ${fmt(minAmount)} for a submitted request — this would alter the approval chain. Please create a new request.` };
  }
  if (v > maxAmount) {
    const name  = highestApproverName  || 'the highest approver in your chain';
    const limit = highestApproverLimit || maxAmount;
    return { type: 'error', message: `The amount cannot exceed ${name}'s approval limit of ${fmt(limit)}. Please enter an amount within the allowed range.` };
  }

  return { type: 'info', message: `${fmt(v)} is within the allowed range for this request (${fmt(minAmount)} - ${fmt(maxAmount)}).` };
};

// ── Approval chain display ────────────────────────────────────────────────────

const STEP_STYLE = {
  APPROVED: { dot: 'bg-green-500',               badge: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',   label: '✓ Approved' },
  REJECTED: { dot: 'bg-red-500',                 badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',           label: '✕ Rejected' },
  PENDING:  { dot: 'bg-amber-500 animate-pulse', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',  label: '⏳ Pending'  },
  SKIPPED:  { dot: 'bg-gray-300 dark:bg-gray-600', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',        label: '⏭️ Skipped'  },
  WAITING:  { dot: 'bg-gray-300 dark:bg-gray-600', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',        label: '— Waiting'   },
};

function ApprovalChain({ approvalSteps = [], approvalCycle, status }) {
  const currentSteps = approvalSteps
    .filter(s => s.cycle === approvalCycle && s.isEligible !== false)
    .sort((a, b) => a.level - b.level);

  if (status === 'DRAFT' || !currentSteps.length) return null;

  return (
    <div className="bg-gray-50 dark:bg-[#0f1117] border border-amber-100 dark:border-[#1e2235] rounded-2xl p-4">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Current Approval Chain</p>
      <div className="space-y-2">
        {currentSteps.map(step => {
          const s = STEP_STYLE[step.status] || STEP_STYLE.WAITING;
          return (
            <div key={step.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Level {step.level} — {step.approver?.name}</p>
                  {step.approvalLimitAtTime && <p className="text-xs text-gray-400 dark:text-gray-600">Limit: {fmt(step.approvalLimitAtTime)}</p>}
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${s.badge}`}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditRequest() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [canEdit, setCanEdit]   = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', amount: '', purpose: '', startDate: '', endDate: '',
  });

  const [reqData, setReqData]             = useState(null);
  const [reqStatus, setReqStatus]         = useState('');
  const [existingAttachments, setExisting] = useState([]);
  const [deletingIds, setDeletingIds]      = useState(new Set());
  const [newFiles, setNewFiles]            = useState([]);
  const [editLimits, setEditLimits]       = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Cloudinary Direct Link Viewer ──────────────────────────────────────────
  const handleViewFile = (fileUrl) => {
    if (!fileUrl) {
      toast.error("File link is not available.");
      return;
    }
    // Securely opens the live Cloudinary URL in a new tab
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const r   = await getRequestById(id);
        const req = r.data.data;

        if (req.isRejectedPermanently) {
          setBlockMsg('This request was permanently rejected and cannot be edited.');
          setCanEdit(false);
          return;
        }

        const alwaysOk      = ['DRAFT', 'NEEDS_REVIEW'].includes(req.status);
        const conditionalOk = ['PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'SUBMITTED'].includes(req.status);

        if (!alwaysOk && !conditionalOk) {
          setBlockMsg(['FINANCE_REJECTED', 'REJECTED'].includes(req.status) ? 'This request has been permanently rejected and cannot be edited.' : 'This request has been viewed by an approver and can no longer be edited.');
          setCanEdit(false);
          return;
        }

        setCanEdit(true);
        setReqStatus(req.status);
        setReqData(req);

        setForm({
          title:       req.title       || '',
          description: req.description || '',
          amount:      req.amount      ? String(req.amount) : '',
          purpose:     req.purpose     || '',
          startDate:   req.startDate   ? new Date(req.startDate).toISOString().split('T')[0] : '',
          endDate:     req.endDate     ? new Date(req.endDate).toISOString().split('T')[0]   : '',
        });

        setExisting((req.attachments || []).filter(a => !a.isDeleted));

        try {
          const limRes = await getEditLimits(id);
          setEditLimits(limRes.data.data);
        } catch {
          try {
            const glRes = await getMyLimits();
            const d     = glRes.data.data;
            setEditLimits({ isDraft: alwaysOk, minAmount: 0, maxAmount: d.maxApprovableLimit, approvalLimit: d.approvalLimit, maxApprovableLimit: d.maxApprovableLimit, hasHierarchy: d.hasHierarchy });
          } catch { }
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleDeleteAttachment = async (attId) => {
    if (!window.confirm('Remove this attachment?')) return;
    setDeletingIds(s => new Set(s).add(attId));
    try {
      await deleteAttachment(id, attId);
      setExisting(prev => prev.filter(a => a.id !== attId));
      toast.success('Attachment removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove attachment');
    } finally {
      setDeletingIds(s => { const n = new Set(s); n.delete(attId); return n; });
    }
  };

  const handleNewFiles = (e) => {
    const picked = Array.from(e.target.files);
    setNewFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...picked.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  };
  const removeNewFile = (idx) => setNewFiles(f => f.filter((_, i) => i !== idx));

  const feedback    = getAmountFeedback(form.amount, editLimits);
  const amountBlocked = feedback?.type === 'error';

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Added Date Validations
    if ((form.startDate && !form.endDate) || (!form.startDate && form.endDate)) {
      toast.error('Please provide both start and end dates, or leave them both empty.');
      return;
    }

    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      newFiles.forEach(f => fd.append('attachments', f));
      await updateRequest(id, fd);
      toast.success('Request updated!');
      navigate(`/requests/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  if (!canEdit) return (
    <Layout>
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Request Locked</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{blockMsg}</p>
          <button onClick={() => navigate(`/requests/${id}`)} className="mt-4 text-xs font-bold text-amber-500 hover:underline">← Back to request</button>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-5">
          <button onClick={() => navigate(`/requests/${id}`)} className="text-xs text-gray-400 hover:text-amber-500 flex items-center gap-1 mb-3 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Back
          </button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Edit Request</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update the details and save changes.</p>
        </div>

        {editLimits && !editLimits.isDraft && (
          <div className="mb-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
            <span className="text-blue-500 text-sm flex-shrink-0 mt-0.5">ℹ</span>
            <div>
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Amount Range for This Request</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                You can edit the amount between <span className="font-bold">{fmt(editLimits.minAmount)}</span> and <span className="font-bold">{fmt(editLimits.maxAmount)}</span>
                {editLimits.highestApproverName && <> (ceiling: {editLimits.highestApproverName}'s limit)</>}.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-black border border-amber-100 dark:border-amber-500/20 rounded-3xl shadow-sm p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label required>Title</Label>
              <input value={form.title} onChange={e => set('title', e.target.value)} required className={fieldCls} placeholder="Request title" />
            </div>

            <div>
              <Label required>Amount (₹)</Label>
              <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} required
                className={`${numberFieldCls} ${feedback?.type === 'error' ? '!border-red-500 dark:!border-red-500/60 bg-red-50/50 dark:bg-red-500/5' : feedback?.type === 'ok' ? '!border-green-500 dark:!border-green-500/60' : feedback?.type === 'info' ? '!border-blue-400 dark:!border-blue-400/60' : ''}`}
                placeholder={editLimits && !editLimits.isDraft ? `${fmt(editLimits.minAmount)} – ${fmt(editLimits.maxAmount)}` : 'Enter amount'}
              />
              {feedback && (
                <div className={`mt-2 flex items-start gap-2 border rounded-xl px-3 py-2.5 ${feedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : feedback.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                  <span className="text-xs font-black flex-shrink-0 mt-0.5">{feedback.type === 'error' ? '⚠' : feedback.type === 'ok' ? '✓' : 'ℹ'}</span>
                  <p className="text-xs leading-relaxed">{feedback.message}</p>
                </div>
              )}
            </div>

            <div>
              <Label required>Description</Label>
              <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} required className={fieldCls + ' resize-none'} placeholder="Describe the purpose…" />
            </div>

            <div>
              <Label>Purpose</Label>
              <input value={form.purpose} onChange={e => set('purpose', e.target.value)} className={fieldCls} placeholder="e.g. Infrastructure upgrade" />
            </div>

            {/* Added Missing Fund Usage Period Inputs */}
            <div>
              <Label hint="— when the fund will be used">Fund Usage Period</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">Start Date</p>
                  <div className="relative">
                    <input type="date" value={form.startDate} className={fieldCls + ' pr-8'} onChange={e => set('startDate', e.target.value)} />
                    {form.startDate && (
                      <button type="button" onClick={() => set('startDate', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold z-10">✕</button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">End Date</p>
                  <div className="relative">
                    <input type="date" value={form.endDate} min={form.startDate || ''} className={fieldCls + ' pr-8'} onChange={e => set('endDate', e.target.value)} />
                    {form.endDate && (
                      <button type="button" onClick={() => set('endDate', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold z-10">✕</button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {reqData && !amountBlocked && (
              <ApprovalChain approvalSteps={reqData.approvalSteps} approvalCycle={reqData.approvalCycle} status={reqStatus} />
            )}

            {existingAttachments.length > 0 && (
              <div>
                <Label>Current Attachments</Label>
                <div className="space-y-1.5">
                  {existingAttachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-xl">
                      <span className="text-base flex-shrink-0">{fileIcon(att.fileType, att.originalName)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{att.originalName || att.fileName}</p>
                      </div>
                      <button type="button" onClick={() => handleViewFile(att.filePath)} className="text-amber-500 hover:text-amber-600 text-xs font-bold px-1 flex-shrink-0">↗</button>
                      <button type="button" onClick={() => handleDeleteAttachment(att.id)} disabled={deletingIds.has(att.id)} className="text-gray-400 hover:text-red-500 text-xs font-bold px-1 flex-shrink-0 disabled:opacity-40">{deletingIds.has(att.id) ? '…' : '✕'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label hint="(optional)">Add More Attachments</Label>
              <div className="relative border-2 border-dashed rounded-2xl p-4 text-center border-amber-200 dark:border-amber-500/20 hover:border-amber-400 transition-colors cursor-pointer bg-amber-50/50 dark:bg-amber-500/5">
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleNewFiles} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <p className="text-xs text-gray-400 dark:text-gray-600 pointer-events-none">Click to add more files</p>
              </div>
              {newFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {newFiles.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-green-50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/10 rounded-xl">
                      <span className="text-base flex-shrink-0">{fileIcon('', f.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{f.name}</p>
                      </div>
                      <button type="button" onClick={() => removeNewFile(idx)} className="text-gray-400 hover:text-red-500 text-xs font-bold px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate(`/requests/${id}`)} className="flex-1 border border-amber-200 text-gray-600 rounded-2xl py-3 text-sm font-semibold hover:bg-amber-50 transition-colors">Cancel</button>
              <button type="submit" disabled={saving || amountBlocked} className={`flex-[2] rounded-2xl py-3 text-sm font-black transition-all ${amountBlocked ? 'bg-gray-200 text-gray-400 opacity-60' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'}`}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}