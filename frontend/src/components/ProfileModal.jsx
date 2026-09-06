import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser } from '../api/auth.api';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { card, inp } from '../styles/theme';

export default function ProfileModal({ onClose }) {
  const { user, loginUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(user?.name || '');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { name });
      const meRes = await getCurrentUser();
      loginUser(localStorage.getItem('token'), meRes.data.data);
      toast.success('Name updated!');
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const roleColors = {
    USER:    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    MANAGER: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    FINANCE: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };
  const roleAvatarBg = {
    USER:    'from-blue-500 to-blue-700',
    MANAGER: 'from-purple-500 to-purple-700',
    FINANCE: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center
                    justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-[#1e2235]
                      rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 bg-gradient-to-br ${roleAvatarBg[user?.role] || 'from-gray-500 to-gray-700'}
                            rounded-2xl flex items-center justify-center text-white
                            text-2xl font-black border-2 border-white/20`}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-white truncate">{user?.name}</h2>
              <p className="text-blue-200 text-sm truncate">{user?.email}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full
                               font-bold ${roleColors[user?.role]} bg-white/20 text-white`}>
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">

          {/* Name field — editable */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400
                                uppercase tracking-wide">
                Full Name
              </label>
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  Edit
                </button>
              ) : (
                <button onClick={() => { setEditing(false); setName(user?.name || ''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  Cancel
                </button>
              )}
            </div>
            {editing ? (
              <div className="flex gap-2">
                <input value={name} onChange={e => setName(e.target.value)}
                  className={inp + ' flex-1'} />
                <button onClick={handleSave} disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                             px-4 text-sm font-bold disabled:opacity-50 transition-colors">
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200
                             bg-gray-50 dark:bg-[#1a1d2e] border border-gray-200
                             dark:border-[#2a2d3e] rounded-xl px-4 py-2.5">
                {user?.name}
              </p>
            )}
          </div>

          {/* Read-only fields */}
          {[
            { label: 'Email',          value: user?.email },
            { label: 'Role',           value: user?.role },
            { label: 'Department',     value: user?.department?.name || '—' },
            { label: 'Approval Limit', value: user?.role === 'USER'
                ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
                    .format(user?.approvalLimit)
                : 'N/A' },
            { label: 'Member Since',   value: user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400
                             uppercase tracking-wide mb-1">
                {f.label}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300
                             bg-gray-50 dark:bg-[#1a1d2e] border border-gray-200
                             dark:border-[#2a2d3e] rounded-xl px-4 py-2.5 font-medium">
                {f.value}
              </p>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full border border-gray-200 dark:border-[#2a2d3e]
                       text-gray-600 dark:text-gray-400 rounded-2xl py-2.5 text-sm
                       font-semibold hover:bg-gray-50 dark:hover:bg-[#1a1d2e] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}