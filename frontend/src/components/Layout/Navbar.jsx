// src/components/Layout/Navbar.jsx
//
// Changes vs uploaded version:
//
//  1. UNREAD COUNT FIX — was reading r.data.pagination?.unread (wrong key).
//     Backend returns unread at r.data.unread (top-level). Fixed.
//
//  2. CLICK-TO-REDIRECT — clicking a notification now:
//       a) marks it as read (optimistic UI update)
//       b) closes the panel
//       c) navigates to the correct request detail page based on type:
//            APPROVAL_REQUIRED → /manager/requests/:id
//            FINANCE_REVIEW    → /finance/requests/:id
//            everything else   → /requests/:id
//
//  3. BADGE STYLE — kept the existing amber glowing dot for unread indicator.
//     Also added the count number inside the panel header (already there).
//
//  4. AUTO-REFRESH — polls every 30 s silently so the badge stays current.
//
//  5. REQUEST NUMBER CHIP — shown inside each notification item when available.
//
//  6. Layout.jsx note: remove the NotificationBell import from Layout.jsx —
//     the bell lives here now, no need for it in Layout.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getNotifications, markRead, markAllRead } from '../../api/notification.api';
import ProfileModal from '../ProfileModal';
import { formatDateTime } from '../../utils/formatters';

// ── Route resolver ────────────────────────────────────────────────────────────
// Maps notification type + fundRequestId → the correct detail page URL.

const resolveRoute = (notif) => {
  const id = notif.fundRequestId ?? notif.fundRequest?.id;
  if (!id) return null;
  if (notif.type === 'APPROVAL_REQUIRED') return `/manager/requests/${id}`;
  if (notif.type === 'FINANCE_REVIEW')    return `/finance/requests/${id}`;
  return `/requests/${id}`;
};

// ── Notification type → icon ──────────────────────────────────────────────────
const TYPE_ICON = {
  APPROVAL_REQUIRED: '⏳',
  REQUEST_APPROVED:  '✅',
  REQUEST_REJECTED:  '❌',
  FINANCE_REVIEW:    '💰',
  STATUS_UPDATE:     '🔔',
  NEEDS_REVIEW:      '🔄',
};

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate         = useNavigate();

  const [showProfile, setShowProfile]    = useState(false);
  const [showNotif, setShowNotif]        = useState(false);
  const [showProfileModal, setShowModal] = useState(false);
  const [notifs, setNotifs]              = useState([]);
  const [unread, setUnread]              = useState(0);

  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  // ── Fetch notifications ─────────────────────────────────────────────────
  const fetchNotifs = useCallback((silent = false) => {
    getNotifications({ page: 1, limit: 10 })
      .then(r => {
        setNotifs(r.data.data   || []);
        // Fix 1: unread is at r.data.unread, NOT r.data.pagination.unread
        setUnread(r.data.unread ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Auto-refresh every 30 s so the badge stays current
  useEffect(() => {
    const t = setInterval(() => fetchNotifs(true), 30_000);
    return () => clearInterval(t);
  }, [fetchNotifs]);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotif(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Mark all as read ──────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    await markAllRead();
    setUnread(0);
    setNotifs(n => n.map(x => ({ ...x, isRead: true })));
  };

  // ── Click notification → mark read + navigate (Fix 2) ────────────────────
  const handleNotifClick = async (notif) => {
    // Close panel first so navigation feels instant
    setShowNotif(false);

    // Optimistically mark as read in local state
    if (!notif.isRead) {
      setNotifs(prev => prev.map(x => x.id === notif.id ? { ...x, isRead: true } : x));
      setUnread(u => Math.max(0, u - 1));
      // Fire-and-forget — non-blocking
      markRead(notif.id).catch(() => {});
    }

    // Navigate to the correct detail page
    const route = resolveRoute(notif);
    if (route) navigate(route);
  };

  return (
    <>
      <header className="h-14 bg-white dark:bg-[#13151f] border-b
                         border-amber-100 dark:border-[#1e2235]
                         flex items-center px-4 gap-2 sticky top-0 z-20">

        {/* Hamburger */}
        <button onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-amber-50
                     dark:hover:bg-[#1a1d2e] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-1 ml-auto">

          {/* Dark mode toggle */}
          <button onClick={toggle}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400
                       hover:bg-amber-50 dark:hover:bg-[#1a1d2e] transition-colors"
            title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* ── Notifications ── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotif(v => !v); setShowProfile(false); }}
              className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400
                         hover:bg-amber-50 dark:hover:bg-[#1a1d2e] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>

              {/* Unread badge — glowing amber dot + count number */}
              {unread > 0 && (
                <>
                  {/* Glowing dot (existing style kept) */}
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full
                                     rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5
                                     bg-red-500 border-2 border-white dark:border-[#13151f]" />
                  </span>
                  {/* Count pill — shown when more than 1 unread */}
                  {unread > 1 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5
                                     bg-red-500 text-white text-[9px] font-black
                                     rounded-full flex items-center justify-center
                                     shadow-sm shadow-red-500/40 leading-none">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* ── Notification panel ── */}
            {showNotif && (
              <div className="absolute right-0 top-12 w-80 sm:w-96
                              bg-white dark:bg-[#13151f]
                              border border-amber-100 dark:border-[#1e2235]
                              rounded-2xl shadow-2xl dark:shadow-black/50
                              overflow-hidden z-50">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3
                                border-b border-amber-100 dark:border-[#1e2235]">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-gray-800 dark:text-white">
                      Notifications
                    </p>
                    {unread > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black
                                       px-1.5 py-0.5 rounded-full">
                        {unread} new
                      </span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button onClick={handleMarkAll}
                      className="text-xs font-bold text-amber-500 hover:text-amber-600
                                 transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[400px] overflow-y-auto">
                  {!notifs.length ? (
                    <div className="py-10 text-center">
                      <p className="text-3xl mb-2">🔕</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        No notifications yet
                      </p>
                    </div>
                  ) : notifs.map(n => {
                    const route = resolveRoute(n);
                    const icon  = TYPE_ICON[n.type] || '🔔';
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3
                          border-b last:border-0 border-amber-50 dark:border-[#1a1d2e]
                          transition-colors group
                          ${!n.isRead
                            ? 'bg-amber-50/70 dark:bg-amber-500/5 hover:bg-amber-100 dark:hover:bg-amber-500/10'
                            : 'hover:bg-gray-50 dark:hover:bg-[#1a1d2e]'}`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Type icon */}
                          <span className="text-base flex-shrink-0 mt-0.5 leading-none">
                            {icon}
                          </span>

                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <p className={`text-xs font-semibold leading-snug
                              ${!n.isRead
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-600 dark:text-gray-400'}`}>
                              {n.title}
                            </p>

                            {/* Message */}
                            <p className="text-xs text-gray-500 dark:text-gray-400
                                          mt-0.5 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>

                            {/* Request number chip + timestamp + "View" hint */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {n.fundRequest?.requestNumber && (
                                <span className="text-[10px] font-mono font-bold
                                                 text-amber-600 dark:text-amber-400
                                                 bg-amber-50 dark:bg-amber-500/10
                                                 px-1.5 py-0.5 rounded">
                                  {n.fundRequest.requestNumber}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 dark:text-gray-600">
                                {formatDateTime(n.createdAt)}
                              </span>
                              {route && (
                                <span className="text-[10px] font-bold text-amber-500
                                                 ml-auto opacity-0 group-hover:opacity-100
                                                 transition-opacity">
                                  View →
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Unread dot */}
                          {!n.isRead && (
                            <div className="w-2 h-2 rounded-full bg-red-500
                                            flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                {notifs.length > 0 && (
                  <div className="px-4 py-2 border-t border-amber-100 dark:border-[#1e2235]
                                  bg-gray-50/50 dark:bg-[#0f1117] text-center">
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">
                      Showing last {notifs.length} notifications
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Profile ── */}
          <div className="relative" ref={profileRef}>
            <button onClick={() => { setShowProfile(v => !v); setShowNotif(false); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl
                         hover:bg-amber-50 dark:hover:bg-[#1a1d2e] transition-colors">
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center
                              justify-center text-white text-xs font-black flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-none">
                  {user?.name?.split(' ')[0]}
                </p>
                <p className="text-xs text-gray-400 leading-none mt-0.5">{user?.role}</p>
              </div>
              <svg className="w-3 h-3 text-gray-400 hidden sm:block" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-52 bg-white dark:bg-[#13151f]
                              border border-amber-100 dark:border-[#1e2235]
                              rounded-2xl shadow-2xl dark:shadow-black/50
                              overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-amber-100 dark:border-[#1e2235]">
                  <p className="text-sm font-black text-gray-800 dark:text-white truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  {[
                    {
                      icon: '👤', label: 'Edit Profile',
                      action: () => { setShowModal(true); setShowProfile(false); },
                    },
                    {
                      icon: dark ? '☀️' : '🌙',
                      label: dark ? 'Light Mode' : 'Dark Mode',
                      action: toggle,
                    },
                  ].map(i => (
                    <button key={i.label} onClick={i.action}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                 hover:bg-amber-50 dark:hover:bg-[#1a1d2e] text-sm
                                 text-gray-700 dark:text-gray-300 transition-colors">
                      <span>{i.icon}</span>{i.label}
                    </button>
                  ))}
                  <div className="border-t border-amber-100 dark:border-[#1e2235] mt-1 pt-1">
                    <button onClick={() => { logout(); navigate('/login'); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm
                                 text-red-500 transition-colors">
                      <span>🚪</span> Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {showProfileModal && <ProfileModal onClose={() => setShowModal(false)} />}
    </>
  );
}
