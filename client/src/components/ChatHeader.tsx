import React, { useState } from 'react';
import { IChat } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useCallStore } from '../store/useCallStore';
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Clock,
  Trash2,
  Image as ImageIcon,
  Users,
  User as UserIcon,
  ArrowLeft,
  Pin,
  Archive
} from 'lucide-react';

interface ChatHeaderProps {
  chat: IChat;
  onOpenInfo: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ chat, onOpenInfo }) => {
  const { user } = useAuthStore();
  const { typingUsers, recordingUsers, clearChat, setActiveChat, togglePinChat, toggleArchiveChat } = useChatStore();
  const { startCall } = useCallStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const isGroup = chat.type === 'group';
  const otherParticipant = chat.participants.find((p) => p._id !== user?._id);

  const displayName = isGroup ? chat.name : otherParticipant?.name || 'User';
  const displayAvatar = isGroup ? chat.avatarUrl : otherParticipant?.avatarUrl;

  const isTyping = Boolean(typingUsers[chat._id]);
  const isRecording = Boolean(recordingUsers[chat._id]);

  const myMeta: any = chat.membersMeta?.find((m: any) => (typeof m.userId === 'object' ? m.userId?._id : m.userId) === user?._id);

  const formatLastSeen = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sameDay ? `last seen today at ${t}` : `last seen ${d.toLocaleDateString()} ${t}`;
  };

  const getSubheader = () => {
    if (isRecording) return <span className="text-emerald-400 font-semibold animate-pulse">recording audio...</span>;
    if (isTyping) return <span className="text-emerald-400 font-semibold animate-pulse">typing...</span>;
    if (isGroup) {
      return (
        <span className="truncate">
          {chat.participants.map((p) => p.name).join(', ')}
        </span>
      );
    }
    if (otherParticipant?.isOnline) return <span className="text-emerald-400 font-semibold">online</span>;
    if (otherParticipant?.lastSeen) {
      return formatLastSeen(otherParticipant.lastSeen);
    }
    return '';
  };

  return (
    <header
      className="min-h-16 px-2 sm:px-4 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between shrink-0 z-20"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: Back (mobile) + Avatar & Info */}
      <button
        onClick={() => setActiveChat(null)}
        className="md:hidden p-2 mr-1 rounded-full hover:bg-white/10 text-[#aebac1] shrink-0"
        aria-label="Back to chats"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-3 cursor-pointer overflow-hidden min-w-0 flex-1" onClick={onOpenInfo}>
        <div className="relative w-10 h-10 rounded-full bg-[#111b21] flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
          ) : isGroup ? (
            <Users className="w-5 h-5 text-slate-400" />
          ) : (
            <UserIcon className="w-5 h-5 text-slate-400" />
          )}
          {!isGroup && otherParticipant?.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#202c33]" />
          )}
        </div>

        <div className="truncate">
          <div className="font-semibold text-sm text-[#e9edef] truncate">{displayName}</div>
          <div className="text-xs text-[#8696a0] truncate">{getSubheader()}</div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0 sm:gap-2 text-[#aebac1] shrink-0">
        {/* Video Call (direct chats only) */}
        {!isGroup && <button
          onClick={() => otherParticipant && startCall(otherParticipant, 'video', chat._id)}
          title="Video call"
          className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <Video className="w-5 h-5" />
        </button>}

        {/* Audio Call */}
        {!isGroup && <button
          onClick={() => otherParticipant && startCall(otherParticipant, 'voice', chat._id)}
          title="Voice call"
          className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <Phone className="w-5 h-5" />
        </button>}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />}
          {showDropdown && (
            <div className="absolute right-0 top-12 w-52 bg-[#233138] border border-[#2e3b44] rounded-xl shadow-2xl py-1 text-sm text-[#d1d7db] z-50 divide-y divide-[#2e3b44]">
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onOpenInfo();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10"
                >
                  {isGroup ? 'Group info' : 'Contact info'}
                </button>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    togglePinChat(chat._id, !myMeta?.isPinned);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2"
                >
                  <Pin className="w-4 h-4" /> {myMeta?.isPinned ? 'Unpin chat' : 'Pin chat'}
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    toggleArchiveChat(chat._id, !myMeta?.isArchived);
                    setActiveChat(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" /> {myMeta?.isArchived ? 'Unarchive' : 'Archive chat'}
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (!window.confirm('Clear all messages in this chat?')) return;
                    clearChat(chat._id);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-red-400 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Clear chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
