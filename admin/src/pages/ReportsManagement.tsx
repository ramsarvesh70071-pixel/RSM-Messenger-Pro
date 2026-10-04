import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const ReportsManagement: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reports');
      setReports(res.data.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResolve = async (reportId: string, status: 'resolved' | 'dismissed') => {
    const notes = prompt(`Resolution notes for marking as ${status}:`) || '';
    try {
      await api.post(`/admin/reports/${reportId}/resolve`, { status, resolutionNotes: notes });
      fetchReports();
    } catch (err) {
      alert('Failed to resolve report');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Trust & Safety Moderation</h1>
        <p className="text-slate-400 text-sm mt-1">Review flagged users, messages, channels, and groups</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
            No pending abuse reports. All clear!
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reports.map((r) => (
              <div key={r._id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                      {r.targetType}
                    </span>
                    <span className="text-xs text-slate-500">
                      Reported by {r.reporterId?.name || 'Anonymous'} on {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white text-base">{r.reason}</h3>
                  {r.details && <p className="text-sm text-slate-400">{r.details}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve(r._id, 'resolved')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                  </button>
                  <button
                    onClick={() => handleResolve(r._id, 'dismissed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
