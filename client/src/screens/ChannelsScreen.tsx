import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Radio, Plus, Check, Loader2, Sparkles } from 'lucide-react';

export const ChannelsScreen: React.FC = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await api.get('/channels');
      setChannels(res.data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreateChannel = async () => {
    const name = prompt('Channel Name:');
    if (!name) return;
    const handle = prompt('Channel Handle (without @):') || name.toLowerCase().replace(/\s+/g, '_');
    const description = prompt('Description:') || '';

    try {
      await api.post('/channels', { name, handle, description });
      fetchChannels();
    } catch {
      alert('Failed to create channel');
    }
  };

  const handleToggleFollow = async (channelId: string, isFollowing: boolean) => {
    try {
      await api.post(`/channels/${channelId}/follow`, { follow: !isFollowing });
      fetchChannels();
    } catch {
      alert('Failed to update follow status');
    }
  };

  return (
    <div className="flex-1 bg-[#111b21] flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-[#222d34] flex items-center justify-between">
        <h1 className="font-bold text-xl text-white">Broadcast Channels</h1>
        <button
          onClick={handleCreateChannel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Channel
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-xl mx-auto w-full">
        <div className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Discover Channels
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : channels.length === 0 ? (
          <div className="p-12 text-center text-[#8696a0] text-sm">No channels available. Create one!</div>
        ) : (
          channels.map((chan) => (
            <div
              key={chan._id}
              className="flex items-center justify-between p-4 bg-[#202c33] rounded-2xl border border-[#2e3b44]"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base overflow-hidden">
                  {chan.avatarUrl ? (
                    <img src={chan.avatarUrl} alt={chan.name} className="w-full h-full object-cover" />
                  ) : (
                    chan.name.charAt(0)
                  )}
                </div>
                <div>
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    {chan.name}
                    {chan.isVerified && <span className="text-emerald-400 text-xs">✓</span>}
                  </div>
                  <div className="text-xs text-[#8696a0] line-clamp-1">{chan.description || `@${chan.handle}`}</div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                    {chan.followersCount || 1} followers
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleToggleFollow(chan._id, true)}
                className="px-4 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors"
              >
                Follow
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
