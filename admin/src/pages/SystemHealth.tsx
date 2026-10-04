import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Cpu, HardDrive, Clock, Server, CheckCircle2, RefreshCw } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/health');
      setHealth(res.data.data);
    } catch (err) {
      console.error('Failed to load system health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Infrastructure Health</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time Node.js process & OS diagnostics</p>
        </div>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Node.js Process */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white">Node.js Runtime Process</h2>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy & Operational
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
              <span>Process Uptime</span>
              <span className="font-mono text-white">{health ? formatUptime(health.uptime) : '--'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
              <span>Heap Used</span>
              <span className="font-mono text-white">
                {health ? `${(health.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB` : '--'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
              <span>RSS Memory</span>
              <span className="font-mono text-white">
                {health ? `${(health.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Host OS Metrics */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white">Host Machine Hardware</h2>
              <div className="text-xs text-slate-400 mt-0.5">{health?.os?.platform || 'windows'}</div>
            </div>
          </div>

          <div className="space-y-2 pt-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
              <span>Logical CPU Cores</span>
              <span className="font-mono text-white">{health?.os?.cpus || '--'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
              <span>Total System Memory</span>
              <span className="font-mono text-white">
                {health ? `${(health.os.totalMem / 1024 / 1024 / 1024).toFixed(2)} GB` : '--'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
              <span>Free System Memory</span>
              <span className="font-mono text-emerald-400">
                {health ? `${(health.os.freeMem / 1024 / 1024 / 1024).toFixed(2)} GB` : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
