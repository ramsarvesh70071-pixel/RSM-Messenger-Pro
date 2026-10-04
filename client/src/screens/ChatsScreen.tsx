import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { MessageBubble } from '../components/MessageBubble';
import { ChatHeader } from '../components/ChatHeader';
import { ChatInput } from '../components/ChatInput';
import { GroupInfoModal } from '../components/GroupInfoModal';
import { ForwardModal } from '../components/ForwardModal';
import { api } from '../services/api';
import {
  Search,
  Pin,
  Archive,
  Check,
  CheckCheck,
  Users,
  User as UserIcon,
  MessageSquare,
  Lock,
  ArrowDown,
  ArrowLeft
} from 'lucide-react';
import { IMessage } from '../types';

export const ChatsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const {
    chats,
    activeChat,
    messages,
    searchFilter,
    setSearchFilter,
    setActiveChat,
    setReplyingTo,
    reactToMessage,
    toggleStarMessage,
    togglePinMessage,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    loadOlderMessages,
    isLoadingMessages,
    typingUsers
  } = useChatStore();

  const [forwardMsg, setForwardMsg] = useState<IMessage | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedChats, setArchivedChats] = useState<any[]>([]);

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeMessages = activeChat ? messages[activeChat._id] || [] : [];
  const pinnedMessage = activeMessages.find((m) => m.isPinned);

  // Auto scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const stickToBottomRef = useRef(true);
  const lastMsgIdRef = useRef<string | null>(null);

  // Opening a chat jumps to the newest message
  useEffect(() => {
    stickToBottomRef.current = true;
    lastMsgIdRef.current = null;
    requestAnimationFrame(() => scrollToBottom(false));
  }, [activeChat?._id]);

  // New message: follow it only if the user is already at the bottom or sent it themselves
  useEffect(() => {
    const last = activeMessages[activeMessages.length - 1];
    if (!last) return;
    const prevId = lastMsgIdRef.current;
    lastMsgIdRef.current = last._id;
    if (prevId === null) {
      requestAnimationFrame(() => scrollToBottom(false));
      return;
    }
    const senderId = typeof last.senderId === 'object' ? (last.senderId as any)._id : last.senderId;
    if (stickToBottomRef.current || senderId === user?._id) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [activeMessages.length, activeMessages[activeMessages.length - 1]?._id]);

  const handleScroll = async () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    stickToBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);

    // Infinite scroll up: load older history and keep the viewport anchored
    if (scrollTop < 80 && activeChat && !isLoadingMessages) {
      const before = el.scrollHeight;
      await loadOlderMessages(activeChat._id);
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - before + scrollTop;
      });
    }
  };

  // Archived list (only fetched when opened)
  useEffect(() => {
    if (!showArchived) return;
    api
      .get('/chats', { params: { archived: true } })
      .then((res) => setArchivedChats(res.data.data))
      .catch(() => setArchivedChats([]));
  }, [showArchived, chats.length]);

  const sourceChats = showArchived ? archivedChats : chats;
  const filteredChats = sourceChats.filter((c: any) => {
    if (!searchFilter.trim()) return true;
    const isGroup = c.type === 'group';
    const otherParticipant = c.participants.find((p: any) => p._id !== user?._id);
    const name = isGroup ? c.name : otherParticipant?.name || '';
    return (name || '').toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 1. Chats List Sidebar */}
      <div
        className={`${
          activeChat ? 'hidden md:flex' : 'flex'
        } w-full md:w-[380px] lg:w-[420px] bg-[#111b21] border-r border-[#222d34] flex-col shrink-0 h-full min-h-0`}
      >
        {/* Search Bar */}
        <div className="p-3 bg-[#111b21] border-b border-[#222d34]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8696a0]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full pl-10 pr-4 py-2 bg-[#202c33] rounded-xl text-xs text-[#d1d7db] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Archived Chats Row */}
        <div
          onClick={() => setShowArchived((v) => !v)}
          className="px-4 py-3 border-b border-[#222d34] flex items-center gap-4 hover:bg-[#202c33] cursor-pointer text-[#8696a0] transition-colors"
        >
          {showArchived ? <ArrowLeft className="w-5 h-5 text-emerald-400" /> : <Archive className="w-5 h-5 text-emerald-400" />}
          <span className="font-semibold text-sm text-[#e9edef]">{showArchived ? 'Back to chats' : 'Archived'}</span>
        </div>

        {/* Chat List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/40">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-[#8696a0] text-xs">No conversations found</div>
          ) : (
            filteredChats.map((chat: any) => {
              const isGroup = chat.type === 'group';
              const other = chat.participants.find((p: any) => p._id !== user?._id);
              const displayName = isGroup ? chat.name : other?.name || 'User';
              const displayAvatar = isGroup ? chat.avatarUrl : other?.avatarUrl;
              const isActive = activeChat?._id === chat._id;
              const memberMeta = chat.membersMeta.find((m: any) => (typeof m.userId === 'object' ? m.userId?._id : m.userId) === user?._id);
              const isPinned = memberMeta?.isPinned;
              const unreadCount = memberMeta?.unreadCount || 0;

              return (
                <div
                  key={chat._id}
                  onClick={() => setActiveChat(chat)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-12 h-12 rounded-full bg-[#202c33] overflow-hidden flex items-center justify-center shrink-0 border border-white/5">
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : isGroup ? (
                      <Users className="w-6 h-6 text-slate-400" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-slate-400" />
                    )}
                    {!isGroup && other?.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#111b21]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-[#e9edef] truncate">{displayName}</span>
                      <span className="text-[11px] text-[#8696a0] shrink-0 font-mono">
                        {chat.lastMessageAt
                          ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate pr-2 ${typingUsers[chat._id] ? 'text-emerald-400' : unreadCount > 0 ? 'text-[#d1d7db]' : 'text-[#8696a0]'}`}>
                        {typingUsers[chat._id]
                          ? 'typing…'
                          : chat.lastMessage?.isDeletedForEveryone
                          ? '🚫 This message was deleted'
                          : chat.lastMessage?.content || (chat.lastMessage?.type ? `[${chat.lastMessage.type}]` : 'Tap to chat')}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPinned && <Pin className="w-3.5 h-3.5 text-slate-400 fill-current" />}
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] text-center px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Chat Conversation View */}
      {activeChat ? (
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 bg-[#0b141a] wa-chat-pattern relative overflow-hidden">
          {/* Chat Header */}
          <ChatHeader chat={activeChat} onOpenInfo={() => setShowGroupInfo(true)} />

          {/* Pinned Message Sticky Banner */}
          {pinnedMessage && (
            <div className="px-4 py-2 bg-[#182229] border-b border-[#222d34] flex items-center justify-between text-xs text-amber-300 z-10 shadow-md">
              <div className="flex items-center gap-2 truncate">
                <Pin className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="font-semibold">Pinned:</span>
                <span className="truncate text-slate-300">{pinnedMessage.content || 'Attachment'}</span>
              </div>
              <button
                onClick={() => togglePinMessage(pinnedMessage._id, false)}
                className="text-[11px] text-slate-400 hover:text-white ml-2"
              >
                Unpin
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overscroll-contain py-4 px-1 sm:px-6 space-y-1 relative"
          >
            {/* E2EE Info Pill */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#182229] border border-[#222d34] text-[11px] text-[#ffd279] shadow-sm text-center">
                <Lock className="w-3 h-3" />
                Messages are secured with transport & database token authorization.
              </div>
            </div>

            {/* Message Bubbles */}
            {activeMessages.map((msg) => {
              const isOutgoing = typeof msg.senderId === 'object'
                ? (msg.senderId as any)._id === user?._id
                : msg.senderId === user?._id;

              return (
                <MessageBubble
                  key={msg._id}
                  message={msg}
                  isOutgoing={isOutgoing}
                  isGroup={activeChat.type === 'group'}
                  onReply={(m) => setReplyingTo(m)}
                  onForward={(m) => setForwardMsg(m)}
                  onReact={(id, emoji) => reactToMessage(id, emoji)}
                  onStar={(id, star) => toggleStarMessage(id, star)}
                  onPin={(id, pin) => togglePinMessage(id, pin)}
                  onEdit={(m) => {
                    const newText = prompt('Edit message:', m.content);
                    if (newText) editMessage(m._id, newText);
                  }}
                  onDeleteForMe={(id) => deleteMessageForMe(id)}
                  onDeleteForEveryone={(id) => deleteMessageForEveryone(id)}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-24 right-4 sm:right-6 p-2 rounded-full bg-[#202c33] border border-[#2e3b44] text-[#8696a0] hover:text-white shadow-xl transition-all hover:scale-105 z-20"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}

          {/* Chat Input Bar */}
          <ChatInput chatId={activeChat._id} />

          {/* Group Info Modal */}
          {forwardMsg && <ForwardModal message={forwardMsg} onClose={() => setForwardMsg(null)} />}

          {showGroupInfo && (
            <GroupInfoModal chat={activeChat} onClose={() => setShowGroupInfo(false)} />
          )}
        </div>
      ) : (
        /* Empty Welcome Splash Screen */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#222e35] text-center p-8 border-b-8 border-emerald-500">
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 shadow-2xl">
            <MessageSquare className="w-12 h-12 fill-current" />
          </div>
          <h2 className="text-2xl font-bold text-[#e9edef] tracking-tight">RSM Messenger Web</h2>
          <p className="text-[#8696a0] text-sm mt-2 max-w-md leading-relaxed">
            Send and receive messages in real time with high-quality media sharing, WebRTC encrypted calling, and group administration.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#8696a0] mt-8">
            <Lock className="w-3.5 h-3.5" /> High-concurrency WebSocket powered
          </div>
        </div>
      )}
    </div>
  );
};
