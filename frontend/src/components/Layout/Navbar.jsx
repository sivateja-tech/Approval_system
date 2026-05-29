import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getNotifications, markRead, markAllRead } from '../../api/notification.api';
import ProfileModal from '../ProfileModal';
import { formatDateTime } from '../../utils/formatters';
import { card } from '../../styles/theme';

export default function Navbar({ onMenuClick }) {
  const { user, logout }     = useAuth();
  const { dark, toggle }     = useTheme();
  const navigate              = useNavigate();

  const [showProfile, setShowProfile]     = useState(false);
  const [showNotif, setShowNotif]         = useState(false);
  const [showProfileModal, setShowModal]  = useState(false);
  const [notifs, setNotifs]               = useState([]);
  const [unread, setUnread]               = useState(0);

  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  const fetchNotifs = () => {
    getNotifications({ page: 1, limit: 8 })
      .then(r => { setNotifs(r.data.data || []); setUnread(r.data.pagination?.unread || 0); })
      .catch(() => {});
  };

  useEffect(() => { fetchNotifs(); }, []);

  useEffect(() => {
    const h = e => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setShowNotif(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleMarkAll = async () => {
    await markAllRead();
    setUnread(0);
    setNotifs(n => n.map(x => ({ ...x, isRead: true })));
  };

  const handleReadOne = async (id) => {
    await markRead(id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, isRead: true } : x));
    setUnread(u => Math.max(0, u - 1));
  };

  return (
    <>
      <header className="h-14 bg-white dark:bg-[#13151f] border-b
                         border-orange-100 dark:border-[#1e2235]
                         flex items-center px-4 gap-2 sticky top-0 z-20">

        {/* Hamburger */}
        <button onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-orange-50
                     dark:hover:bg-[#1a1d2e] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h3
  className="flex-1 hidden sm:block
             text-xl font-black tracking-wide
             text-gray-700 dark:text-white"
>
  Fund Request Management System
</h3>

        <div className="flex items-center gap-1 ml-auto">

          {/* Dark mode toggle */}
          <button onClick={toggle}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400
                       hover:bg-orange-50 dark:hover:bg-[#1a1d2e] transition-colors"
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

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => { setShowNotif(v => !v); setShowProfile(false); }}
              className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400
                         hover:bg-orange-50 dark:hover:bg-[#1a1d2e] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-orange-500
                                 text-white text-xs rounded-full flex items-center
                                 justify-center font-black px-0.5 leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#13151f]
                              border border-orange-100 dark:border-[#1e2235]
                              rounded-2xl shadow-2xl dark:shadow-black/50 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3
                                border-b border-orange-100 dark:border-[#1e2235]">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-gray-800 dark:text-white">
                      Notifications
                    </p>
                    {unread > 0 && (
                      <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5
                                       rounded-full font-black">
                        {unread}
                      </span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button onClick={handleMarkAll}
                      className="text-xs text-orange-500 hover:text-orange-600 font-bold">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notifs.length ? (
                    <div className="py-10 text-center">
                      <p className="text-3xl mb-2">🔔</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        No notifications
                      </p>
                    </div>
                  ) : notifs.map(n => (
                    <button key={n.id} onClick={() => !n.isRead && handleReadOne(n.id)}
                      className={`w-full text-left px-4 py-3 border-b last:border-0
                        border-orange-50 dark:border-[#1a1d2e] transition-colors
                        ${!n.isRead
                          ? 'bg-orange-50 dark:bg-orange-500/5 hover:bg-orange-100 dark:hover:bg-orange-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-[#1a1d2e]'}`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0
                          ${!n.isRead ? 'bg-orange-500' : 'bg-transparent'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                            {formatDateTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button onClick={() => { setShowProfile(v => !v); setShowNotif(false); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl
                         hover:bg-orange-50 dark:hover:bg-[#1a1d2e] transition-colors">
              <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-52 bg-white dark:bg-[#13151f]
                              border border-orange-100 dark:border-[#1e2235]
                              rounded-2xl shadow-2xl dark:shadow-black/50 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-orange-100 dark:border-[#1e2235]">
                  <p className="text-sm font-black text-gray-800 dark:text-white truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  {[
                    { icon: '👤', label: 'Edit Profile',   action: () => { setShowModal(true); setShowProfile(false); } },
                    { icon: dark ? '☀️' : '🌙', label: dark ? 'Light Mode' : 'Dark Mode', action: toggle },
                  ].map(i => (
                    <button key={i.label} onClick={i.action}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                 hover:bg-orange-50 dark:hover:bg-[#1a1d2e] text-sm
                                 text-gray-700 dark:text-gray-300 transition-colors">
                      <span>{i.icon}</span>
                      {i.label}
                    </button>
                  ))}
                  <div className="border-t border-orange-100 dark:border-[#1e2235] mt-1 pt-1">
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