import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRequest } from '../../api/request.api';
import Layout from '../../components/Layout/Layout';
import toast from 'react-hot-toast';

const Label = ({ children, required, hint }) => (
  <label className="block text-xs font-bold uppercase tracking-wide mb-1.5
                     text-gray-600 dark:text-gray-400">
    {children}
    {required && <span className="text-orange-500 ml-0.5">*</span>}
    {hint && <span className="ml-1.5 normal-case font-normal text-gray-400 dark:text-gray-600">
      {hint}
    </span>}
  </label>
);

const Field = ({ className = '', ...props }) => (
  <input {...props}
    className={`w-full rounded-xl px-4 py-2.5 text-sm transition-all
      bg-white dark:bg-black
      border border-orange-200 dark:border-orange-500/30
      text-gray-900 dark:text-white
      placeholder-gray-400 dark:placeholder-gray-600
      focus:outline-none focus:ring-2 focus:ring-orange-500/40
      focus:border-orange-500 dark:focus:border-orange-400
      [color-scheme:light] dark:[color-scheme:dark] ${className}`} />
);

const TextArea = ({ className = '', ...props }) => (
  <textarea {...props}
    className={`w-full rounded-xl px-4 py-2.5 text-sm transition-all resize-none
      bg-white dark:bg-black
      border border-orange-200 dark:border-orange-500/30
      text-gray-900 dark:text-white
      placeholder-gray-400 dark:placeholder-gray-600
      focus:outline-none focus:ring-2 focus:ring-orange-500/40
      focus:border-orange-500 dark:focus:border-orange-400 ${className}`} />
);

export default function CreateRequest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', amount: '', purpose: '',
    startDate: '', endDate: '',
  });
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.startDate && form.endDate &&
        new Date(form.startDate) > new Date(form.endDate)) {
      toast.error('End date must be after start date'); return;
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
    } finally { setLoading(false); }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-5">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">
            New Request
          </p>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            New Fund Request
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Fill in the details. Save as draft and submit later.
          </p>
        </div>

        <div className="bg-white dark:bg-black border border-orange-100
                        dark:border-orange-500/20 rounded-3xl shadow-sm
                        dark:shadow-orange-500/5 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <Label required>Title</Label>
              <Field value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Office Equipment Purchase" required />
            </div>

            <div>
              <Label required>Amount (₹)</Label>
              <Field type="number" min="1" value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="Enter amount" required />
            </div>

            <div>
              <Label required>Description</Label>
              <TextArea rows={4} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe the purpose of this fund request…" required />
            </div>

            <div>
              <Label hint="(optional)">Purpose</Label>
              <Field value={form.purpose} onChange={e => set('purpose', e.target.value)}
                placeholder="e.g. Infrastructure upgrade" />
            </div>

            {/* Date range */}
            <div>
              <Label hint="— when the fund will be used">Fund Usage Period</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">Start Date</p>
                  <div className="relative">
                    <Field type="date" value={form.startDate}
                      onChange={e => set('startDate', e.target.value)} />
                    {form.startDate && (
                      <button type="button" onClick={() => set('startDate', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2
                                   text-gray-400 hover:text-red-500 transition-colors
                                   text-xs font-bold">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">End Date</p>
                  <div className="relative">
                    <Field type="date" value={form.endDate}
                      onChange={e => set('endDate', e.target.value)}
                      min={form.startDate || undefined} />
                    {form.endDate && (
                      <button type="button" onClick={() => set('endDate', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2
                                   text-gray-400 hover:text-red-500 transition-colors
                                   text-xs font-bold">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {(form.startDate || form.endDate) && (
                <button type="button"
                  onClick={() => { set('startDate', ''); set('endDate', ''); }}
                  className="text-xs text-red-500 hover:text-red-600 mt-1.5
                             flex items-center gap-1">
                  ✕ Clear both dates
                </button>
              )}
              {form.endDate && (
                <p className="text-xs text-orange-500 dark:text-orange-400 mt-1.5
                               flex items-center gap-1">
                  ⚠ If funds are unused before end date, they must be returned.
                </p>
              )}
            </div>

            {/* Attachments */}
            <div>
              <Label hint="PDF, Images, DOC">Attachments</Label>
              <div className="relative border-2 border-dashed rounded-2xl p-5
                              text-center transition-colors cursor-pointer
                              border-orange-200 dark:border-orange-500/20
                              hover:border-orange-400 dark:hover:border-orange-400
                              bg-orange-50/50 dark:bg-orange-500/5">
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setFiles(Array.from(e.target.files))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/10
                                rounded-xl flex items-center justify-center
                                mx-auto mb-3">
                  <svg className="w-5 h-5 text-orange-500" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                {files.length > 0 ? (
                  <p className="text-sm font-bold text-orange-500">
                    {files.length} file(s) selected
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Click or drag files here
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                      Max 10MB each
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/requests')}
                className="flex-1 border border-orange-200 dark:border-orange-500/20
                           text-gray-600 dark:text-gray-400 rounded-2xl py-3 text-sm
                           font-semibold hover:bg-orange-50 dark:hover:bg-orange-500/5
                           transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white
                           rounded-2xl py-3 text-sm font-black disabled:opacity-50
                           shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Next'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}