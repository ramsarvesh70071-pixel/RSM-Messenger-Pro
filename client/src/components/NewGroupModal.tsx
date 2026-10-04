import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { X, Users, Check, Loader2 } from 'lucide-react';

interface NewGroupModalProps {
  onClose: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ onClose }) => {
  const { setActiveChat, fetchChats } = useChatStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const res = await api.get('/contacts', { params: { registeredOnly: true } });
        setContacts(res.data.data);
      } catch {}
    };
    loadContacts();
  }, []);

  const toggleSelect = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await api.post('/groups', {
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedUserIds
      });

      const newGroup = res.data.data;
      await fetchChats();
      setActiveChat(newGroup);
      onClose();
    } catch (err) {
      alert('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#222e35] border border-[#2e3b44] rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
          <h2 className="font-bold text-base text-[#e9edef]">Create New Group</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-3 bg-[#111b21] border-b border-[#2e3b44]">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Group Subject</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type group subject here..."
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Group description..."
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Member Selection List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Add Members ({selectedUserIds.length} selected)
            </div>

            {contacts.map((c) => {
              const uId = c.contactUserId?._id || c.contactUserId;
              if (!uId) return null;
              const isSelected = selectedUserIds.includes(uId);

              return (
                <div
                  key={c._id}
                  onClick={() => toggleSelect(uId)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-[#202c33]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-slate-300">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.phoneNumber}</div>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Footer */}
          <div className="p-4 bg-[#202c33] border-t border-[#2e3b44]">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
