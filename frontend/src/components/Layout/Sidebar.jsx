import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SVG = ({ d }) => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
  </svg>
);

const D = {
  home:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  list:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  plus:    'M12 4v16m8-8H4',
  clock:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  history: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  inbox:   'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
};

const NAV = {
  USER:    [
    { to: '/dashboard',    label: 'Dashboard',   icon: D.home,    end: true },
    { to: '/requests',     label: 'My Requests', icon: D.list,    end: true },
    { to: '/requests/new', label: 'New Request', icon: D.plus,    end: true },
  ],
  // Updated from HOD to MANAGER and updated the route paths
  MANAGER: [
    { to: '/manager/dashboard', label: 'Dashboard',         icon: D.home,    end: true },
    { to: '/manager/approvals', label: 'Pending Approvals', icon: D.clock,   end: true },
    { to: '/manager/history',   label: 'Approval History',  icon: D.history, end: true },
  ],
  FINANCE: [
    { to: '/finance/dashboard', label: 'Dashboard',    icon: D.home,  end: true },
    { to: '/finance/queue',     label: 'Review Queue', icon: D.inbox, end: true },
  ],
};

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const items    = NAV[user?.role] || [];

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={onClose} />
      )}
      
      <aside className={`
        fixed md:static z-30 flex flex-col
        w-56 h-full                            /* full height */
        bg-white dark:bg-[#13151f]
        border-r border-amber-100 dark:border-[#1e2235]
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        overflow-y-auto                        /* scroll on small screens */
      `}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4
                        border-b border-amber-100 dark:border-[#1e2235]">
          <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center
                          justify-center text-white font-black text-sm shadow-lg
                          shadow-amber-500/30">
            ₹
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-900 dark:text-white leading-none">
              Fund Request
            </p>
            <p className="text-xs font-black text-gray-900 dark:text-white leading-none">
              Management System
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-600
                         uppercase tracking-wider px-2 py-2">
            Menu
          </p>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => [
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                'transition-all duration-150',
                isActive
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-[#1a1d2e] hover:text-amber-600 dark:hover:text-amber-400',
              ].join(' ')}
            >
              <SVG d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

      </aside>
    </>
  );
}