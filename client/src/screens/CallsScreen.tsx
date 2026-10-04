import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useCallStore } from '../store/useCallStore';
import { ICall } from '../types';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2, User as UserIcon } from 'lucide-react';

export const CallsScreen: React.FC = () => {
  const [calls, setCalls] = useState<ICall[]>([]);
  const [loading, setLoading] = useState(true);
  const { startCall, callsVersion } = useCallStore();

  const fetchCalls = async () => {
    try {
      const res = await api.get('/calls/history');
      setCalls(res.data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [callsVersion]);

  if (loading) {
    return <div className="flex-1 bg-[#111b21] flex items-center justify-center text-[#8696a0] text-sm">Loading…</div>;
  }

  const handleDeleteCall = async (id: string) => {
    try {
      await api.delete(`/calls/log/${id}`);
      setCalls((prev) => prev.filter((c) => c._id !== id));
    } catch {
      alert('Failed to delete call log');
    }
  };

  return (
    <div className="flex-1 min-w-0 bg-[#111b21] flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-[#222d34] flex items-center justify-between">
        <h1 className="font-bold text-xl text-white">Call History</h1>
      </div>

      <div className="p-4 space-y-2 max-w-xl mx-auto w-full">
        {calls.length === 0 ? (
          <div className="p-12 text-center text-[#8696a0] text-sm">
            <Phone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            No recent calls. Start a voice or video call with any contact!
          </div>
        ) : (
          calls.map((call) => {
            const isMissed = call.isMissed;
            const isOutgoing = call.direction === 'outgoing';

            return (
              <div
                key={call._id}
                className="flex items-center justify-between p-3.5 bg-[#202c33] rounded-2xl hover:bg-[#2a3942] transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-[#111b21] overflow-hidden flex items-center justify-center text-slate-400 border border-white/5">
                    {call.otherParty?.avatarUrl ? (
                      <img src={call.otherParty.avatarUrl} alt={call.otherParty.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-sm text-white">{call.otherParty?.name || 'Contact'}</div>
                    <div className="flex items-center gap-1.5 text-xs text-[#8696a0] mt-0.5">
                      {isMissed ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-red-400" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <PhoneIncoming className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>
                        {new Date(call.createdAt).toLocaleDateString()}{' '}
                        {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => call.otherParty && startCall(call.otherParty, 'voice')}
                    className="p-2 rounded-full hover:bg-white/10 text-emerald-400 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => call.otherParty && startCall(call.otherParty, 'video')}
                    className="p-2 rounded-full hover:bg-white/10 text-emerald-400 transition-colors"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCall(call._id)}
                    className="p-2 rounded-full hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
