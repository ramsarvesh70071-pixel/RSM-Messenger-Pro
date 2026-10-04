import React, { useState } from 'react';
import { X, Check, Users, User as UserIcon, Send } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import { IMessage } from '../types';

interface ForwardModalProps {
  message: IMessage;
  onClose: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ message, onClose }) => {
  const { chats } = useChatStore();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setError('');
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        setError('You can forward to at most 5 chats at once');
        return prev;
      }
      return [...prev, id];
    });
  };

  const send = async () => {
    if (selected.length === 0) return;
    setSending(true);
    try {
      await api.post('/messages/forward', { messageIds: [message._id], targetChatIds: selected });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to forward message');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md sm:p-4">
      <div className="w-full sm:max-w-md bg-[#222e35] border border-[#2e3b44] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
        <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
          <h2 className="font-bold text-base text-[#e9edef]">Forward to…</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#2e3b44]/40">
          {chats.map((chat) => {
            const isGroup = chat.type === 'group';
            const other = chat.participants.find((p) => p._id !== user?._id);
            const name = isGroup ? chat.name : other?.name || 'User';
            const on = selected.includes(chat._id);
            return (
              <button
                key={chat._id}
                onClick={() => toggle(chat._id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#202c33] flex items-center justify-center text-slate-400 shrink-0">
                  {isGroup ? <Users className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                </div>
                <span className="flex-1 truncate text-sm text-[#e9edef]">{name}</span>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    on ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-500'
                  }`}
                >
                  {on && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && <div className="px-4 py-2 text-xs text-red-400">{error}</div>}

        <div className="p-3 border-t border-[#2e3b44] flex justify-end" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <button
            onClick={send}
            disabled={selected.length === 0 || sending}
            className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> {sending ? 'Sending…' : `Send${selected.length ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
