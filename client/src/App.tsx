import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { useCallStore } from './store/useCallStore';
import { useStatusStore } from './store/useStatusStore';
import { socketService } from './services/socket.service';
import { AuthScreen } from './screens/AuthScreen';
import { ChatsScreen } from './screens/ChatsScreen';
import { StatusScreen } from './screens/StatusScreen';
import { CallsScreen } from './screens/CallsScreen';
import { CommunitiesScreen } from './screens/CommunitiesScreen';
import { ChannelsScreen } from './screens/ChannelsScreen';
import { CallModal } from './components/CallModal';
import { StatusViewerModal } from './components/StatusViewerModal';
import { NewChatModal } from './components/NewChatModal';
import { NewGroupModal } from './components/NewGroupModal';
import { SettingsModal } from './components/SettingsModal';
import {
  MessageSquare,
  CircleDashed,
  Users2,
  Radio,
  Phone,
  Settings,
  Plus,
  Shield,
  Loader2,
  ExternalLink
} from 'lucide-react';

type NavTab = 'chats' | 'status' | 'communities' | 'channels' | 'calls';

export const App: React.FC = () => {
  const { user, token, isLoading, initAuth } = useAuthStore();
  const { chats, activeChat, fetchChats, setupSocketListeners, teardownSocketListeners } = useChatStore();
  const { setupCallListeners, teardownCallListeners } = useCallStore();
  const { setupSocketListeners: setupStatusListeners } = useStatusStore();

  const [activeTab, setActiveTab] = useState<NavTab>('chats');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initAuth();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Wire all realtime listeners once the user is logged in; always clean up on logout/unmount
  useEffect(() => {
    if (!token || !user) return;
    socketService.connect(token);
    fetchChats();
    setupSocketListeners(user._id);
    setupCallListeners(user._id);
    setupStatusListeners();
    return () => {
      teardownSocketListeners();
      teardownCallListeners();
    };
  }, [token, user?._id]);

  const totalUnread = chats.reduce((acc, c) => {
    const meta = c.membersMeta?.find(
      (m: any) => m.userId === user?._id || (m.userId && m.userId._id === user?._id)
    );
    return acc + (meta?.unreadCount || 0);
  }, 0);
  // On phones the chat opens full-screen, so the bottom nav and top bar get out of the way
  const inChatOnMobile = activeTab === 'chats' && Boolean(activeChat);

  // Update dynamic document title with total unread count
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) RSM Messenger Pro`;
    } else {
      document.title = 'RSM Messenger Pro';
    }
  }, [totalUnread]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0c1317]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-2xl">
            <MessageSquare className="w-8 h-8 fill-current" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <AuthScreen />;
  }

  const navItems = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'status', label: 'Status', icon: CircleDashed },
    { id: 'communities', label: 'Communities', icon: Users2 },
    { id: 'channels', label: 'Channels', icon: Radio },
    { id: 'calls', label: 'Calls', icon: Phone }
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-[#0c1317] text-[#e9edef] overflow-hidden select-none font-['Segoe_UI',sans-serif]">
      {/* 1. Slim Left Navigation Rail */}
      <nav
        className={`${
          inChatOnMobile ? 'hidden md:flex' : 'flex'
        } w-full md:w-16 md:h-full bg-[#202c33] border-t md:border-t-0 md:border-r border-[#222d34] md:flex-col items-center justify-between px-1 pt-1 md:p-2 shrink-0 z-30 order-last md:order-first`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
      >
        {/* Top: App Icon & Navigation Items */}
        <div className="flex md:flex-col items-center justify-around md:justify-start w-full gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                title={item.label}
                aria-label={item.label}
                className={`p-2.5 md:p-3 rounded-xl transition-all relative flex flex-col items-center gap-0.5 ${
                  isActive
                    ? 'bg-[#374248] text-emerald-400'
                    : 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="md:hidden text-[10px] leading-none">{item.label}</span>
                {item.id === 'chats' && totalUnread > 0 && (
                  <span className="absolute top-1 right-1.5 md:right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
                {isActive && (
                  <span className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-r-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: New Chat, Settings, and Profile Avatar */}
        <div className="hidden md:flex flex-col items-center gap-3 pb-2">
          {/* New Chat Button */}
          <button
            onClick={() => setShowNewChat(true)}
            title="New Chat"
            className="p-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Admin Dashboard shortcut (if admin) */}
          {user.role === 'admin' && (
            <a
              href={import.meta.env.VITE_ADMIN_URL || `${window.location.protocol}//${window.location.hostname}:5173`}
              target="_blank"
              rel="noreferrer"
              title="Open Web Admin Console"
              className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
            >
              <Shield className="w-5 h-5" />
            </a>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="p-2.5 rounded-xl text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/5 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Profile Avatar */}
          <div
            onClick={() => setShowSettings(true)}
            title="My Profile"
            className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden cursor-pointer border border-white/10 hover:border-emerald-500 transition-colors"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white">
                {user.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile top bar: New chat / Settings were desktop-only before and unreachable on phones */}
      {!inChatOnMobile && (
        <header
          className="md:hidden order-first flex items-center justify-between px-4 py-2.5 bg-[#202c33] border-b border-[#222d34] shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
        >
          <h1 className="font-bold text-lg text-white capitalize">{activeTab === 'chats' ? 'RSM Messenger' : activeTab}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowNewChat(true)} aria-label="New chat" className="p-2 rounded-full bg-emerald-500 text-slate-950">
              <Plus className="w-5 h-5" />
            </button>
            <button onClick={() => setShowSettings(true)} aria-label="Settings" className="p-2 rounded-full text-[#aebac1] hover:bg-white/10">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* 2. Main Tab Views */}
      <main className="flex-1 flex overflow-hidden min-h-0 min-w-0 order-2 md:order-none">
        {activeTab === 'chats' && <ChatsScreen />}
        {activeTab === 'status' && <StatusScreen />}
        {activeTab === 'communities' && <CommunitiesScreen />}
        {activeTab === 'channels' && <ChannelsScreen />}
        {activeTab === 'calls' && <CallsScreen />}
      </main>

      {/* 3. Global Overlays & Modals */}
      <CallModal />
      <StatusViewerModal />
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onOpenNewGroup={() => setShowNewGroup(true)}
        />
      )}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};
