import React, { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { UserManagement } from './pages/UserManagement';
import { ReportsManagement } from './pages/ReportsManagement';
import { SystemHealth } from './pages/SystemHealth';
import { LayoutDashboard, Users, AlertTriangle, Activity, LogOut, ShieldCheck } from 'lucide-react';

type Tab = 'overview' | 'users' | 'reports' | 'health';

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    const savedToken = localStorage.getItem('rsm_admin_token');
    const savedUser = localStorage.getItem('rsm_admin_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    const handleAuthChange = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rsm_admin_token');
    localStorage.removeItem('rsm_admin_user');
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return <Login onLoginSuccess={(u, t) => { setUser(u); setToken(t); }} />;
  }

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'User Directory', icon: Users },
    { id: 'reports', label: 'Trust & Safety', icon: AlertTriangle },
    { id: 'health', label: 'System Health', icon: Activity }
  ];

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-base text-white tracking-tight">RSM Console</div>
              <div className="text-xs text-emerald-400 font-medium">Administrator</div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as Tab)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium truncate">Logged in as</div>
            <div className="text-sm font-semibold text-white truncate">{user.name}</div>
            <div className="text-xs text-slate-500 font-mono truncate">{user.phoneNumber}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {activeTab === 'overview' && <DashboardOverview />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'reports' && <ReportsManagement />}
        {activeTab === 'health' && <SystemHealth />}
      </main>
    </div>
  );
};
