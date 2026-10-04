import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { X, Search, Users, UserPlus, Radio, User as UserIcon, Loader2 } from 'lucide-react';

interface NewChatModalProps {
  onClose: () => void;
  onOpenNewGroup: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ onClose, onOpenNewGroup }) => {
  const { setActiveChat, fetchChats } = useChatStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoading(true);
        const res = await api.get('/contacts', { params: { search, registeredOnly: true } });
        setContacts(res.data.data);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      } finally {
        setLoading(false);
      }
    };
    loadContacts();
  }, [search]);

  const handleStartChat = async (targetUserId: string) => {
    try {
      const res = await api.post('/chats/direct', { targetUserId });
      const chat = res.data.data.chat;
      await fetchChats();
      setActiveChat(chat);
      onClose();
    } catch (err) {
      alert('Failed to initiate conversation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#222e35] border border-[#2e3b44] rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
          <h2 className="font-bold text-base text-[#e9edef]">New Chat</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 bg-[#111b21] border-b border-[#2e3b44]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-9 pr-4 py-2 bg-[#202c33] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Action Row */}
        <div className="p-2 space-y-1 bg-[#111b21]">
          <button
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#202c33] text-left transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#e9edef]">New group</div>
              <div className="text-xs text-slate-400">Collaborate with multiple people</div>
            </div>
          </button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2e3b44]/40 p-2">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Registered Contacts
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">No registered contacts found</div>
          ) : (
            contacts.map((c) => (
              <div
                key={c._id}
                onClick={() => c.contactUserId && handleStartChat(c.contactUserId._id || c.contactUserId)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#202c33] cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#202c33] overflow-hidden flex items-center justify-center text-slate-400 border border-white/5">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 truncate">
                  <div className="font-semibold text-sm text-[#e9edef] truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 truncate">{c.about || c.phoneNumber}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
