import React, { useState } from 'react';
import { IChat } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { api } from '../services/api';
import {
  X,
  Users,
  Shield,
  ShieldAlert,
  Link,
  Copy,
  LogOut,
  UserMinus,
  Crown,
  Settings,
  Check
} from 'lucide-react';

interface GroupInfoModalProps {
  chat: IChat;
  onClose: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({ chat, onClose }) => {
  const { user } = useAuthStore();
  const { fetchChats, setActiveChat } = useChatStore();
  const [copied, setCopied] = useState(false);

  const currentMember = chat.membersMeta.find((m) => m.userId.toString() === user?._id);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = isOwner || currentMember?.role === 'admin';

  const handleCopyInvite = () => {
    if (chat.inviteCode) {
      navigator.clipboard.writeText(`${window.location.origin}/join/${chat.inviteCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleOnlyAdminsSend = async () => {
    try {
      const current = chat.groupSettings?.onlyAdminsCanSend || false;
      await api.put(`/groups/${chat._id}/settings`, { onlyAdminsCanSend: !current });
      await fetchChats();
    } catch {
      alert('Failed to update group permissions');
    }
  };

  const handlePromote = async (memberId: string) => {
    try {
      await api.post(`/groups/${chat._id}/members/${memberId}/promote`);
      await fetchChats();
    } catch {
      alert('Failed to promote member');
    }
  };

  const handleDemote = async (memberId: string) => {
    try {
      await api.post(`/groups/${chat._id}/members/${memberId}/demote`);
      await fetchChats();
    } catch {
      alert('Failed to demote admin');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/groups/${chat._id}/members/${memberId}`);
      await fetchChats();
    } catch {
      alert('Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await api.delete(`/groups/${chat._id}/members/${user?._id}`);
      await fetchChats();
      setActiveChat(null);
      onClose();
    } catch {
      alert('Failed to leave group');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#222e35] border border-[#2e3b44] rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
          <h2 className="font-bold text-base text-[#e9edef]">Group Details</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Avatar & Title */}
          <div className="text-center space-y-2">
            <div className="w-24 h-24 rounded-full bg-[#111b21] mx-auto overflow-hidden border-2 border-emerald-500/30 flex items-center justify-center">
              {chat.avatarUrl ? (
                <img src={chat.avatarUrl} alt={chat.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{chat.name}</h1>
            <p className="text-xs text-slate-400">{chat.description || 'No description provided'}</p>
            <div className="text-xs text-emerald-400 font-semibold">{chat.participants.length} participants</div>
          </div>

          {/* Group Settings / Admin Controls */}
          {isAdmin && (
            <div className="bg-[#111b21] rounded-2xl p-4 space-y-3 border border-[#2e3b44]">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Group Settings
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-xs font-medium text-white">Send Messages</div>
                  <div className="text-[11px] text-slate-400">
                    {chat.groupSettings?.onlyAdminsCanSend ? 'Only admins' : 'All participants'}
                  </div>
                </div>
                <button
                  onClick={handleToggleOnlyAdminsSend}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    chat.groupSettings?.onlyAdminsCanSend
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {chat.groupSettings?.onlyAdminsCanSend ? 'Admin Only' : 'Everyone'}
                </button>
              </div>

              {/* Invite Link */}
              <div className="flex items-center justify-between py-1 border-t border-[#2e3b44] pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Link className="w-4 h-4 text-emerald-400" /> Invite via link
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {chat.participants.length} Members
            </div>

            <div className="space-y-1">
              {chat.participants.map((member) => {
                const memberMeta = chat.membersMeta.find((m) => m.userId.toString() === member._id);
                const isMemberOwner = memberMeta?.role === 'owner';
                const isMemberAdmin = memberMeta?.role === 'admin' || isMemberOwner;
                const isSelf = member._id === user?._id;

                return (
                  <div
                    key={member._id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#111b21] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-slate-400">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-white flex items-center gap-2">
                          {member.name} {isSelf && <span className="text-xs text-slate-400 font-normal">(You)</span>}
                        </div>
                        <div className="text-xs text-slate-400">{member.about || member.phoneNumber}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMemberOwner ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Crown className="w-3 h-3" /> Group Creator
                        </span>
                      ) : isMemberAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Shield className="w-3 h-3" /> Group Admin
                        </span>
                      ) : null}

                      {/* Admin Controls on other members */}
                      {isAdmin && !isSelf && !isMemberOwner && (
                        <div className="flex items-center gap-1">
                          {isMemberAdmin ? (
                            <button
                              onClick={() => handleDemote(member._id)}
                              title="Dismiss as admin"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePromote(member._id)}
                              title="Make group admin"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-400"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(member._id)}
                            title="Remove member"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exit Group Button */}
          <div className="pt-2 border-t border-[#2e3b44]">
            <button
              onClick={handleLeaveGroup}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl flex items-center justify-center gap-2 border border-red-500/20 transition-all text-sm"
            >
              <LogOut className="w-4 h-4" /> Exit Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
