import React, { useState } from 'react';
import { IMessage } from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ReactionPicker } from './ReactionPicker';
import { mediaUrl } from '../services/api';
import {
  Check,
  CheckCheck,
  Clock,
  Star,
  Pin,
  ChevronDown,
  Reply,
  CornerUpRight,
  FileText,
  MapPin,
  User as UserIcon,
  Download,
  Smile,
  Trash2,
  Edit2,
  AlertCircle
} from 'lucide-react';

interface MessageBubbleProps {
  message: IMessage;
  isOutgoing: boolean;
  isGroup: boolean;
  onReply: (msg: IMessage) => void;
  onForward: (msg: IMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onStar: (msgId: string, star: boolean) => void;
  onPin: (msgId: string, pin: boolean) => void;
  onEdit: (msg: IMessage) => void;
  onDeleteForMe: (msgId: string) => void;
  onDeleteForEveryone: (msgId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  isGroup,
  onReply,
  onForward,
  onReact,
  onStar,
  onPin,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const senderName = typeof message.senderId === 'object' ? (message.senderId as any).name : 'User';
  const isStarred = message.isStarredBy && message.isStarredBy.length > 0;

  const renderStatusTicks = () => {
    if (!isOutgoing) return null;
    if (message.status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-400" aria-label="Failed to send" />;
    if (message.status === 'pending') return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    if (message.status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
    if (message.status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
    if (message.status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
    return <Check className="w-3.5 h-3.5 text-slate-400" />;
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group reactions by emoji
  const reactionCounts = (message.reactions || []).reduce((acc: any, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        if (!message.isDeletedForEveryone) setShowMenu(true);
      }}
      className={`group relative flex flex-col mb-1.5 px-3 max-w-[85%] sm:max-w-[70%] select-text ${
        isOutgoing ? 'ml-auto items-end' : 'mr-auto items-start'
      }`}
    >
      {/* Floating Reaction Picker */}
      {showReactionPicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowReactionPicker(false)} />
      )}
      {showReactionPicker && (
        <ReactionPicker
          onSelectReaction={(emoji) => onReact(message._id, emoji)}
          onClose={() => setShowReactionPicker(false)}
        />
      )}

      {/* Main Bubble Card */}
      <div
        className={`relative px-3 py-2 rounded-2xl shadow-sm text-sm break-words transition-all ${
          isOutgoing
            ? 'bg-[#005c4b] text-slate-100 rounded-tr-none'
            : 'bg-[#202c33] text-slate-200 rounded-tl-none'
        }`}
      >
        {/* Forwarded Header */}
        {message.isForwarded && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 italic mb-1">
            <CornerUpRight className="w-3 h-3" /> Forwarded
          </div>
        )}

        {/* Sender Name in Groups */}
        {isGroup && !isOutgoing && (
          <div className="font-semibold text-xs text-emerald-400 mb-1">{senderName}</div>
        )}

        {/* Reply Preview */}
        {message.replyTo && (
          <div
            className={`mb-2 p-2 rounded-lg border-l-4 text-xs bg-black/20 ${
              isOutgoing ? 'border-emerald-300' : 'border-emerald-500'
            }`}
          >
            <div className="font-semibold text-emerald-400">{message.replyTo.senderName}</div>
            <div className="text-slate-300 line-clamp-1">{message.replyTo.content || 'Media message'}</div>
          </div>
        )}

        {/* Pinned Indicator */}
        {message.isPinned && (
          <div className="flex items-center gap-1 text-[11px] text-amber-300 mb-1">
            <Pin className="w-3 h-3 fill-current" /> Pinned message
          </div>
        )}

        {/* CONTENT RENDERING BY TYPE */}
        {message.isDeletedForEveryone ? (
          <div className="italic text-slate-400 text-xs py-1">🚫 This message was deleted</div>
        ) : (
          <>
            {/* 1. Voice Message */}
            {message.type === 'voice' && (
              <VoiceMessagePlayer
                url={message.attachments?.[0]?.url}
                duration={message.attachments?.[0]?.duration || 12}
                waveform={message.attachments?.[0]?.waveform}
                isOutgoing={isOutgoing}
              />
            )}

            {/* 2. Image Message */}
            {message.type === 'image' && message.attachments?.[0] && (
              <div className="rounded-xl overflow-hidden mb-1 max-w-sm">
                <img
                  src={mediaUrl(message.attachments[0].url)}
                  alt="Attachment"
                  className="w-full max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(mediaUrl(message.attachments?.[0]?.url), '_blank')}
                />
              </div>
            )}

            {/* 3. Document Message */}
            {message.type === 'document' && message.attachments?.[0] && (
              <div className="flex items-center gap-3 p-2 bg-black/20 rounded-xl mb-1 min-w-[200px]">
                <FileText className="w-8 h-8 text-emerald-400 shrink-0" />
                <div className="flex-1 truncate">
                  <div className="font-medium text-xs truncate">{message.attachments[0].fileName || 'Document'}</div>
                  <div className="text-[10px] text-slate-400">
                    {((message.attachments[0].fileSize || 0) / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
                <a
                  href={mediaUrl(message.attachments[0].url)}
                  download
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* 4. Location Message */}
            {message.type === 'location' && message.location && (
              <div className="rounded-xl overflow-hidden bg-black/20 p-2.5 space-y-2 mb-1 min-w-[200px]">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <MapPin className="w-4 h-4" /> Shared Location
                </div>
                <p className="text-xs text-slate-300">{message.location.address || message.location.name || 'Pinned Location'}</p>
                <a
                  href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold"
                >
                  Open in Maps
                </a>
              </div>
            )}

            {/* 5. Contact Card */}
            {message.type === 'contact' && message.contact && (
              <div className="rounded-xl bg-black/20 p-3 space-y-2 mb-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-xs text-white truncate">{message.contact.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{message.contact.phoneNumber}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Standard Text & Caption */}
            {message.content && (
              <p className="whitespace-pre-wrap leading-relaxed select-text">{message.content}</p>
            )}
          </>
        )}

        {/* Footer: Time, Edited status, Star, and Delivery status ticks */}
        <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 mt-1 select-none">
          {message.isEdited && <span className="text-[10px] italic">edited</span>}
          {isStarred && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
          <span>{formatMessageTime(message.createdAt)}</span>
          {renderStatusTicks()}
        </div>

        {/* Context Menu Dropdown Trigger */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Message options"
          className="absolute top-1 right-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-black/20 text-slate-300"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Context Menu */}
        {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
        {showMenu && (
          <div
            className={`fixed left-1/2 -translate-x-1/2 bottom-4 w-[88vw] max-w-xs md:absolute md:translate-x-0 md:bottom-auto md:top-8 md:w-44 md:left-auto z-50 ${
              isOutgoing ? 'md:right-0' : 'md:left-0'
            } bg-[#233138] border border-[#2e3b44] rounded-xl shadow-2xl py-1 text-sm md:text-xs text-slate-200 divide-y divide-[#2e3b44] max-h-[70dvh] overflow-y-auto`}
          >
            <div className="py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onReply(message);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 active:bg-white/10 text-left"
              >
                <Reply className="w-3.5 h-3.5 text-slate-400" /> Reply
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowReactionPicker(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 active:bg-white/10 text-left"
              >
                <Smile className="w-3.5 h-3.5 text-slate-400" /> React
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onForward(message);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 active:bg-white/10 text-left"
              >
                <CornerUpRight className="w-3.5 h-3.5 text-slate-400" /> Forward
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onStar(message._id, !isStarred);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 active:bg-white/10 text-left"
              >
                <Star className="w-3.5 h-3.5 text-slate-400" /> {isStarred ? 'Unstar' : 'Star'}
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onPin(message._id, !message.isPinned);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 active:bg-white/10 text-left"
              >
                <Pin className="w-3.5 h-3.5 text-slate-400" /> {message.isPinned ? 'Unpin' : 'Pin'}
              </button>
            </div>

            <div className="py-1">
              {isOutgoing && !message.isDeletedForEveryone && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(message);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 active:bg-white/10 text-left"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Edit
                </button>
              )}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDeleteForMe(message._id);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete for me
              </button>
              {isOutgoing && !message.isDeletedForEveryone && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDeleteForEveryone(message._id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reaction Badges Pill */}
      {Object.keys(reactionCounts).length > 0 && (
        <div
          className={`flex items-center gap-1 mt-[-6px] px-2 py-0.5 rounded-full bg-[#202c33] border border-[#2e3b44] text-xs shadow-md z-10 ${
            isOutgoing ? 'mr-2' : 'ml-2'
          }`}
        >
          {Object.entries(reactionCounts).map(([emoji, count]: any) => (
            <span key={emoji} className="flex items-center gap-0.5">
              <span>{emoji}</span>
              {count > 1 && <span className="text-[10px] text-slate-400 font-bold">{count}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
