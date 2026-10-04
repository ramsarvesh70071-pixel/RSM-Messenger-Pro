import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Users, MessageSquare, PhoneCall, AlertTriangle, Database, Activity, RefreshCw } from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Registered Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'from-blue-500/20 to-blue-600/5',
      border: 'border-blue-500/30',
      text: 'text-blue-400'
    },
    {
      title: 'Active Today',
      value: stats?.activeUsersToday || 0,
      icon: Activity,
      color: 'from-emerald-500/20 to-emerald-600/5',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400'
    },
    {
      title: 'Messages Processed',
      value: stats?.totalMessages || 0,
      icon: MessageSquare,
      color: 'from-purple-500/20 to-purple-600/5',
      border: 'border-purple-500/30',
      text: 'text-purple-400'
    },
    {
      title: 'Calls Initiated',
      value: stats?.totalCalls || 0,
      icon: PhoneCall,
      color: 'from-amber-500/20 to-amber-600/5',
      border: 'border-amber-500/30',
      text: 'text-amber-400'
    },
    {
      title: 'Pending Abuse Reports',
      value: stats?.pendingReports || 0,
      icon: AlertTriangle,
      color: 'from-red-500/20 to-red-600/5',
      border: 'border-red-500/30',
      text: 'text-red-400'
    },
    {
      title: 'Active Groups',
      value: stats?.totalGroups || 0,
      icon: Database,
      color: 'from-cyan-500/20 to-cyan-600/5',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Analytics & Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Live metrics across the RSM Messenger ecosystem</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl bg-gradient-to-br ${card.color} bg-slate-900/60 border ${card.border} backdrop-blur-xl relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm font-medium">{card.title}</span>
                <div className={`p-2.5 rounded-xl bg-slate-800/80 ${card.text}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-extrabold text-white tracking-tight">{card.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Storage & Architecture Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" /> Storage & Media Infrastructure
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 font-medium">Storage Engine Driver</span>
            <p className="text-lg font-bold text-emerald-400 uppercase mt-1">
              {stats?.storageStats?.storageDriver || 'local (sharp optimized)'}
            </p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 font-medium">Estimated Media Volume</span>
            <p className="text-lg font-bold text-white mt-1">
              ~{stats?.storageStats?.totalFilesEstimateMb || 0} MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
