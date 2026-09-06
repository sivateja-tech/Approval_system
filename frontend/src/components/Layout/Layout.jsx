// src/components/Layout/Layout.jsx
//
// Change: removed the unused NotificationBell import.
// The bell now lives inside Navbar.jsx where it belongs.

import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar  from './Navbar';

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0f1117] overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto
                         p-3 sm:p-4 md:p-5 lg:p-6
                         text-gray-900 dark:text-white">
          {children}
        </main>
      </div>
    </div>
  );
}
