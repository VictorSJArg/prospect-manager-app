import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logOut } from '../firebase';

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: 'dashboard', label: 'DASHBOARD' },
    { path: '/new-lead', icon: 'add_circle', label: 'NUEVO' },
    { path: '/clients', icon: 'person_search', label: 'CLIENTES' },
    { path: '/settings', icon: 'settings', label: 'CONFIG' },
  ];

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-24 md:pb-0">
      {/* TopAppBar */}
      <header className="bg-slate-50 dark:bg-slate-950 shadow-sm dark:shadow-none border-b border-slate-200/15 dark:border-slate-800/15 docked full-width top-0 sticky z-50 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-indigo-900 dark:text-indigo-400">gavel</span>
          <h1 className="text-lg font-bold tracking-[0.15em] text-indigo-950 dark:text-indigo-50">ESTUDIO MARIA FILOMENA NORIEGA</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-slate-500 hidden md:block">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-slate-500 hidden md:block">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="h-10 w-10 rounded-full bg-primary-container overflow-hidden ring-2 ring-indigo-900/10 cursor-pointer" onClick={logOut}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white bg-primary">
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1920px] mx-auto px-2 md:px-4 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200/20 dark:border-slate-800/20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50 rounded-t-xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/clients' && location.pathname.startsWith('/clients'));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-900 dark:text-indigo-300 bg-slate-100 dark:bg-indigo-950/50'
                  : 'text-slate-400 dark:text-slate-500 hover:text-indigo-700'
              }`}
            >
              <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              <span className="font-sans text-[10px] font-semibold tracking-wider uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
