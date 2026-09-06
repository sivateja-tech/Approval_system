// src/pages/user/CreateRequest.jsx
//
// Key changes:
//   • Calls GET /requests/my-limits once on mount to get the user's
//     approvalLimit and the hierarchy's maxApprovableLimit.
//   • On every amount keystroke, validates client-side instantly:
//       – amount ≤ approvalLimit      → green  "Will bypass managers → Finance"
//       – amount ≤ maxApprovableLimit → blue   "Will be routed to eligible managers"
//       – amount > maxApprovableLimit → red    "Exceeds max — Save disabled"
//   • "Save as Draft" button is disabled when amount exceeds maxApprovableLimit.
//   • All feedback is inline below the Amount field — no toast / popup.
//   • Start and End dates are optional, but if one is provided, both must be provided.

import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { createRequest, getMyLimits } from '../../api/request.api';
import Layout from '../../components/Layout/Layout';
import toast  from 'react-hot-toast';

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

const fileIcon = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
  if (ext === 'pdf')  return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx'].includes(ext)) return '📊';
  return '📎';
};

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// ── Pure client-side amount feedback ─────────────────────────────────────────
const getAmountFeedback = (amount, approvalLimit, maxApprovableLimit, hasHierarchy) => {
  const v = parseFloat(amount) || 0;
  if (!v) return null;

  if (v <= approvalLimit) {
    return {
      type: 'ok',
      message: `${fmt(v)} is within your approval limit (${fmt(approvalLimit)}) — this request will go directly to Finance without manager approval.`,
    };
  }
  if (v <= maxApprovableLimit) {
    return {
      type: 'info',
      message: `${fmt(v)} exceeds your approval limit (${fmt(approvalLimit)}) — the request will be routed to eligible managers in your approval chain (max approvable: ${fmt(maxApprovableLimit)}).`,
    };
  }
  if (!hasHierarchy) {
    return {
      type: 'error',
      message: `${fmt(v)} exceeds your approval limit (${fmt(approvalLimit)}) and you have no approval chain assigned. Please contact an admin.`,
    };
  }
  return {
    type: 'error',
    message: `${fmt(v)} exceeds the maximum approvable limit in your approval chain (${fmt(maxApprovableLimit)}). No eligible approver exists — please reduce the amount or contact an admin to update the hierarchy.`,
  };
};

const AmountFeedback = ({ feedback }) => {
  if (!feedback) return null;
  const styles = {
    ok:    'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400',
    info:  'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',
    error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400',
  };
  const icons = { ok: '✓', info: 'ℹ', error: '⚠' };
  return (
    <div className={`mt-2 flex items-start gap-2 border rounded-xl px-3 py-2.5 ${styles[feedback.type]}`}>
      <span className="text-xs font-black flex-shrink-0 mt-0.5">{icons[feedback.type]}</span>
      <p className="text-xs leading-relaxed">{feedback.message}</p>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateRequest() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '', description: '', amount: '',
    purpose: '', startDate: '', endDate: '',
  });
  const [files, setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);

  const [limits, setLimits] = useState({
    approvalLimit: 0, maxApprovableLimit: 0, hasHierarchy: false, ready: false,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Fetch once on mount
  useEffect(() => {
    getMyLimits()
      .then(r => {
        const d = r.data.data;
        setLimits({
          approvalLimit:      d.approvalLimit      ?? 0,
          maxApprovableLimit: d.maxApprovableLimit ?? 0,
          hasHierarchy:       d.hasHierarchy       ?? false,
          ready:              true,
        });
      })
      .catch(() => setLimits(l => ({ ...l, ready: true })));
  }, []);

  const removeFile = (idx) => setFiles(f => f.filter((_, i) => i !== idx));
  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...picked.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  };

  // Live client-side feedback — instant, no API call per keystroke
  const feedback     = limits.ready
    ? getAmountFeedback(form.amount, limits.approvalLimit, limits.maxApprovableLimit, limits.hasHierarchy)
    : null;
  const amountBlocked = feedback?.type === 'error';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if ((form.startDate && !form.endDate) || (!form.startDate && form.endDate)) {
      toast.error('Please provide both start and end dates, or leave them both empty.');
      return;
    }

    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      toast.error('End date must be after start date'); return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid amount'); return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      files.forEach(f => fd.append('attachments', f));
      const res = await createRequest(fd);
      toast.success('Request saved as draft!');
      navigate(`/requests/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">

        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">New Fund Request</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Fill in the details below. Your request will be saved as a draft — submit it from the next page.
          </p>
        </div>

        <div className="bg-white dark:bg-black border border-amber-100 dark:border-amber-500/20 rounded-3xl shadow-sm p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <Label required>Title</Label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Office Equipment Purchase" required className={fieldCls} />
            </div>

            {/* ── Amount with live inline validation ── */}
            <div>
              <Label required>Amount (₹)</Label>
              <input
                type="number" min="1"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="Enter amount"
                required
                className={`${fieldCls}
                  [appearance:textfield]
                  [&::-webkit-outer-spin-button]:appearance-none
                  [&::-webkit-inner-spin-button]:appearance-none
                  ${feedback?.type === 'error' ? '!border-red-500 dark:!border-red-500/60'
                  : feedback?.type === 'ok'    ? '!border-green-500 dark:!border-green-500/60'
                  : feedback?.type === 'info'  ? '!border-blue-400 dark:!border-blue-400/60' : ''}`}
              />
              <AmountFeedback feedback={feedback} />
            </div>

            <div>
              <Label required>Description</Label>
              <textarea rows={4} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe the purpose of this fund request…"
                required className={fieldCls + ' resize-none'} />
            </div>

            <div>
              <Label hint="(optional)">Purpose</Label>
              <input value={form.purpose} onChange={e => set('purpose', e.target.value)}
                placeholder="e.g. Infrastructure upgrade" className={fieldCls} />
            </div>

            <div>
              <Label hint="— when the fund will be used">Fund Usage Period</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">Start Date</p>
                  <div className="relative">
                    <input type="date" value={form.startDate} min={today}
                      className={fieldCls + ' pr-8'} onChange={e => set('startDate', e.target.value)} />
                    {form.startDate && (
                      <button type="button" onClick={() => set('startDate', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold z-10">✕</button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">End Date</p>
                  <div className="relative">
                    <input type="date" value={form.endDate} min={form.startDate || today}
                      className={fieldCls + ' pr-8'} onChange={e => set('endDate', e.target.value)} />
                    {form.endDate && (
                      <button type="button" onClick={() => set('endDate', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold z-10">✕</button>
                    )}
                  </div>
                </div>
              </div>
              
            </div>

            <div>
              <Label hint="PDF, Images, DOC — max 10 MB each">Attachments</Label>
              <div className="relative border-2 border-dashed rounded-2xl p-5 text-center border-amber-200 dark:border-amber-500/20 hover:border-amber-400 bg-amber-50/50 dark:bg-amber-500/5 cursor-pointer transition-colors">
                <input type="file" multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-3 pointer-events-none">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 pointer-events-none">Click or drag files here</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 pointer-events-none">PDF, Images, Word, Excel, CSV</p>
              </div>
              {files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-xl">
                      <span className="text-base flex-shrink-0">{fileIcon(f.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button type="button" onClick={() => removeFile(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors text-xs font-bold px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/requests')}
                className="flex-1 border border-amber-200 dark:border-amber-500/20 text-gray-600 dark:text-gray-400 rounded-2xl py-3 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-500/5 transition-colors">
                Cancel
              </button>
              <button type="submit"
                disabled={loading || amountBlocked}
                title={amountBlocked ? 'Amount exceeds maximum approvable limit' : ''}
                className={`flex-[2] rounded-2xl py-3 text-sm font-black transition-all disabled:opacity-60
                  ${amountBlocked
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02]'}`}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : amountBlocked ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Amount Too High
                  </span>
                ) : 'Save as Draft →'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </Layout>
  );
}