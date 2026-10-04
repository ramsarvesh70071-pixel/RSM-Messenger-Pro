import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { Users2, Plus, MessageSquare, ChevronRight, Loader2 } from 'lucide-react';

export const CommunitiesScreen: React.FC = () => {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActiveChat } = useChatStore();

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communities');
      setCommunities(res.data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  const handleCreateCommunity = async () => {
    const name = prompt('Community Name:');
    if (!name) return;
    const description = prompt('Community Description:') || '';

    try {
      await api.post('/communities', { name, description });
      fetchCommunities();
    } catch {
      alert('Failed to create community');
    }
  };

  return (
    <div className="flex-1 bg-[#111b21] flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-[#222d34] flex items-center justify-between">
        <h1 className="font-bold text-xl text-white">Communities</h1>
        <button
          onClick={handleCreateCommunity}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> New Community
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : communities.length === 0 ? (
          <div className="p-12 text-center text-[#8696a0] text-sm space-y-2">
            <Users2 className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="font-semibold text-white">Stay connected with your neighborhood or school</div>
            <div className="text-xs">Communities bring members together in topic-based groups.</div>
          </div>
        ) : (
          communities.map((comm) => (
            <div key={comm._id} className="bg-[#202c33] rounded-2xl p-4 border border-[#2e3b44] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                  {comm.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{comm.name}</h3>
                  <p className="text-xs text-[#8696a0]">{comm.description || 'Community hub'}</p>
                </div>
              </div>

              {/* Announcement Room */}
              {comm.announcementChatId && (
                <div
                  onClick={() => setActiveChat(comm.announcementChatId)}
                  className="flex items-center justify-between p-3 bg-[#111b21] rounded-xl cursor-pointer hover:bg-[#2a3942] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-white">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold">Announcements</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
