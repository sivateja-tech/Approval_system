import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequestById, updateRequest } from '../../api/request.api';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const Label = ({ children, required }) => (
  <label className="block text-xs font-bold uppercase tracking-wide mb-1.5
                     text-gray-600 dark:text-gray-400">
    {children}{required && <span className="text-orange-500 ml-0.5">*</span>}
  </label>
);

const fieldCls = `w-full rounded-xl px-4 py-2.5 text-sm transition-all
  bg-white dark:bg-black
  border border-orange-200 dark:border-orange-500/30
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-orange-500/40
  focus:border-orange-500 dark:focus:border-orange-400
  [color-scheme:light] dark:[color-scheme:dark]`;

export default function EditRequest() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [loading, setLoading]  = useState(true);
  const [saving, setSaving]    = useState(false);
  const [canEdit, setCanEdit]  = useState(false);
  const [blockMsg, setBlockMsg] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', amount: '', purpose: '',
    startDate: '', endDate: '',
  });
  const [files, setFiles] = useState([]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    getRequestById(id).then(r => {
      const req = r.data.data;
      const alwaysOk = ['DRAFT', 'NEEDS_REVIEW'].includes(req.status);
      const conditionalOk =
        (req.status === 'PENDING_HOD_APPROVAL'     && !req.viewedByHODAt) ||
        (req.status === 'PENDING_FINANCE_APPROVAL' && !req.viewedByFinanceAt);

      if (!alwaysOk && !conditionalOk) {
        setBlockMsg('This request has been viewed and can no longer be edited.');
        setCanEdit(false);
      } else {
        setCanEdit(true);
      }

      setForm({
        title:       req.title       || '',
        description: req.description || '',
        amount:      req.amount      ? String(req.amount) : '',
        purpose:     req.purpose     || '',
        startDate: req.startDate
          ? new Date(req.startDate).toISOString().split('T')[0] : '',
        endDate: req.endDate
          ? new Date(req.endDate).toISOString().split('T')[0] : '',
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      files.forEach(f => fd.append('attachments', f));
      await updateRequest(id, fd);
      toast.success('Request updated!');
      navigate(`/requests/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  if (!canEdit) return (
    <Layout>
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200
                        dark:border-amber-500/20 rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
            Request Locked
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{blockMsg}</p>
          <button onClick={() => navigate(`/requests/${id}`)}
            className="mt-4 text-xs font-bold text-orange-500 hover:underline">
            ← Back to request
          </button>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-5">
          <button onClick={() => navigate(`/requests/${id}`)}
            className="text-xs text-gray-400 hover:text-orange-500 flex items-center
                       gap-1 mb-3 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Edit Request</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Update the details and save changes.
          </p>
        </div>

        <div className="bg-white dark:bg-black border border-orange-100
                        dark:border-orange-500/20 rounded-3xl shadow-sm p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label required>Title</Label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                required className={fieldCls}
                placeholder="Request title" />
            </div>
            <div>
              <Label required>Amount (₹)</Label>
              <input type="number" min="1" value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required className={fieldCls} placeholder="Enter amount" />
            </div>
            <div>
              <Label required>Description</Label>
              <textarea rows={4} value={form.description}
                onChange={e => set('description', e.target.value)}
                required className={fieldCls + ' resize-none'}
                placeholder="Describe the purpose…" />
            </div>
            <div>
              <Label>Purpose</Label>
              <input value={form.purpose} onChange={e => set('purpose', e.target.value)}
                className={fieldCls} placeholder="e.g. Infrastructure upgrade" />
            </div>

            {/* Dates */}
            <div>
              <Label>Fund Usage Period</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">Start Date</p>
                  <div className="relative">
                    <input type="date" value={form.startDate}
                      onChange={e => set('startDate', e.target.value)}
                      className={fieldCls + ' pr-8'} />
                    {form.startDate && (
                      <button type="button" onClick={() => set('startDate', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2
                                   text-gray-400 hover:text-red-500 text-xs font-bold">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">End Date</p>
                  <div className="relative">
                    <input type="date" value={form.endDate}
                      onChange={e => set('endDate', e.target.value)}
                      min={form.startDate || undefined}
                      className={fieldCls + ' pr-8'} />
                    {form.endDate && (
                      <button type="button" onClick={() => set('endDate', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2
                                   text-gray-400 hover:text-red-500 text-xs font-bold">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {(form.startDate || form.endDate) && (
                <button type="button"
                  onClick={() => { set('startDate', ''); set('endDate', ''); }}
                  className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  ✕ Clear both dates
                </button>
              )}
            </div>

            {/* Additional files */}
            <div>
              <Label>Add More Attachments</Label>
              <div className="relative border-2 border-dashed rounded-2xl p-4 text-center
                              border-orange-200 dark:border-orange-500/20
                              hover:border-orange-400 transition-colors cursor-pointer
                              bg-orange-50/50 dark:bg-orange-500/5">
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setFiles(Array.from(e.target.files))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                {files.length > 0 ? (
                  <p className="text-sm font-bold text-orange-500">
                    {files.length} new file(s) selected
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-600">
                    Click to add more files (optional)
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate(`/requests/${id}`)}
                className="flex-1 border border-orange-200 dark:border-orange-500/20
                           text-gray-600 dark:text-gray-400 rounded-2xl py-3 text-sm
                           font-semibold hover:bg-orange-50 dark:hover:bg-orange-500/5
                           transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white
                           rounded-2xl py-3 text-sm font-black disabled:opacity-50
                           shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]">
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}