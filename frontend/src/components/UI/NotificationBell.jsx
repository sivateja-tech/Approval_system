// src/components/UI/NotificationBell.jsx
//
// Drop-in bell icon component for any Layout/Navbar.
// Usage:  <NotificationBell />
//
// Features:
//   • Red/orange badge on the bell when unread notifications exist
//   • Slide-down panel listing recent notifications
//   • Clicking a notification → marks it as read → redirects to the request
//   • "Mark all as read" button
//   • Polls every 30 s for new notifications
//   • Closes on Escape key or click-outside

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markRead, markAllRead } from '../../api/notification.api';
import { formatDate } from '../../utils/formatters';

// ── Notification type → icon + colour ────────────────────────────────────────
const TYPE_STYLE = {
  APPROVAL_REQUIRED: { icon: '⏳', color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10'  },
  REQUEST_APPROVED:  { icon: '✅', color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-500/10'  },
  REQUEST_REJECTED:  { icon: '❌', color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-500/10'      },
  FINANCE_REVIEW:    { icon: '💰', color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10'    },
  STATUS_UPDATE:     { icon: '🔔', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10'},
  NEEDS_REVIEW:      { icon: '🔄', color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10'  },
};
const defaultStyle = { icon: '🔔', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/50' };

// ── Route resolver: given a notification, return the path to navigate to ─────
const resolveRoute = (notif) => {
  const reqId = notif.fundRequestId ?? notif.fundRequest?.id;
  if (!reqId) return null;

  // Route by role implied in the notification type or by actor role if available
  // We use the type to decide which detail page to open:
  //   APPROVAL_REQUIRED → manager view
  //   FINANCE_REVIEW    → finance view
  //   everything else   → user request view (works for any role, backend guards access)
  if (notif.type === 'APPROVAL_REQUIRED') return `/manager/requests/${reqId}`;
  if (notif.type === 'FINANCE_REVIEW')    return `/finance/requests/${reqId}`;
  return `/requests/${reqId}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const navigate = useNavigate();

  const [open, setOpen]               = useState(false);
  const [notifications, setNotifs]    = useState([]);
  const [unread, setUnread]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [markingAll, setMarkingAll]   = useState(false);
  const panelRef                      = useRef(null);
  const bellRef                       = useRef(null);

  // ── Fetch notifications ─────────────────────────────────────────────────
  const fetchNotifs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getNotifications({ page: 1, limit: 20 });
      setNotifs(res.data.data      || []);
      setUnread(res.data.unread    ?? 0);
    } catch { /* non-fatal */ } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + 30 s poll
  useEffect(() => {
    fetchNotifs();
    const t = setInterval(() => fetchNotifs(true), 30_000);
    return () => clearInterval(t);
  }, [fetchNotifs]);

  // Close panel on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (
        open &&
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current  && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // ── Click a notification → mark read → navigate ─────────────────────────
  const handleClick = async (notif) => {
    setOpen(false);

    // Optimistically mark as read in UI
    if (!notif.isRead) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
      try { await markRead(notif.id); } catch { /* non-fatal */ }
    }

    const route = resolveRoute(notif);
    if (route) navigate(route);
  };

  // ── Mark all as read ─────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* non-fatal */ } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative">

      {/* ── Bell button ── */}
      <button
        ref={bellRef}
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl
                   bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235]
                   hover:bg-amber-50 dark:hover:bg-[#1a1d2e] transition-colors shadow-sm"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread badge — red when unread > 0 */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                           bg-red-500 text-white text-[10px] font-black
                           rounded-full flex items-center justify-center
                           shadow-md shadow-red-500/40 animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Notification panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 w-80 sm:w-96 z-50
                     bg-white dark:bg-[#13151f]
                     border border-amber-100 dark:border-[#1e2235]
                     rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40
                     overflow-hidden animate-fade-in"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-amber-100 dark:border-[#1e2235]">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-gray-800 dark:text-white">
                Notifications
              </p>
              {unread > 0 && (
                <span className="text-[10px] font-black bg-red-500 text-white
                                 px-1.5 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="text-xs font-bold text-amber-500 hover:text-amber-600
                           transition-colors disabled:opacity-50"
              >
                {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent
                                 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <p className="text-3xl mb-2">🔕</p>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  No notifications yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                  You'll see updates about your requests here
                </p>
              </div>
            ) : (
              notifications.map(notif => {
                const style   = TYPE_STYLE[notif.type] || defaultStyle;
                const route   = resolveRoute(notif);
                const isClickable = !!route;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`flex items-start gap-3 px-4 py-3 transition-all
                      border-b border-amber-50 dark:border-[#1a1d2e] last:border-0
                      ${isClickable ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-[#1a1d2e]' : ''}
                      ${!notif.isRead ? 'bg-amber-50/60 dark:bg-amber-500/5' : ''}`}
                  >
                    {/* Type icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center
                                     text-sm flex-shrink-0 mt-0.5 ${style.bg}`}>
                      {style.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <p className={`text-xs font-bold leading-snug
                        ${!notif.isRead
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400'}`}>
                        {notif.title}
                      </p>

                      {/* Message */}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {/* Request number + date row */}
                      <div className="flex items-center gap-2 mt-1">
                        {notif.fundRequest?.requestNumber && (
                          <span className="text-[10px] font-mono text-amber-500
                                           bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {notif.fundRequest.requestNumber}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-600">
                          {formatDate(notif.createdAt)}
                        </span>
                        {isClickable && (
                          <span className="text-[10px] text-amber-500 font-bold ml-auto">
                            View →
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Panel footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-amber-100 dark:border-[#1e2235]
                            bg-amber-50/50 dark:bg-[#0f1117] text-center">
              <p className="text-xs text-gray-400 dark:text-gray-600">
                Showing last {notifications.length} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
