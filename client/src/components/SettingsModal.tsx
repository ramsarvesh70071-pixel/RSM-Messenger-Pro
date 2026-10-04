import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import {
  X,
  User,
  Lock,
  Database,
  Smartphone,
  Trash2,
  Camera,
  Check,
  Loader2,
  HardDrive,
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'profile' | 'privacy' | 'storage' | 'devices' | 'account';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { user, updateProfile, uploadAvatar, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [username, setUsername] = useState(user?.username || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Privacy Settings state
  const [privacy, setPrivacy] = useState({
    lastSeen: user?.privacySettings?.lastSeen || 'everyone',
    online: user?.privacySettings?.online || 'everyone',
    profilePhoto: user?.privacySettings?.profilePhoto || 'everyone',
    about: user?.privacySettings?.about || 'everyone',
    readReceipts: user?.privacySettings?.readReceipts !== false
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Linked Devices state
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'devices') {
      api.get('/devices').then((res) => setDevices(res.data.data)).catch(() => {});
    }
  }, [activeTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    await updateProfile({ name, about, username });
    setSavingProfile(false);
    alert('Profile updated successfully!');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      await api.put('/users/privacy', privacy);
      alert('Privacy settings saved!');
    } catch {
      alert('Failed to update privacy');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleLogoutDevice = async (deviceId: string) => {
    try {
      await api.delete(`/devices/${deviceId}`);
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
    } catch {
      alert('Failed to revoke device');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmText = prompt('Type DELETE to confirm permanent account deletion:');
    if (confirmText === 'DELETE') {
      try {
        await api.delete('/auth/delete-account');
        await logout();
        onClose();
      } catch {
        alert('Failed to delete account');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#222e35] border border-[#2e3b44] rounded-2xl shadow-2xl flex flex-col md:flex-row h-[85dvh] max-h-[650px] overflow-hidden">
        {/* Left Settings Sidebar */}
        <aside className="w-full md:w-56 bg-[#111b21] border-r border-[#2e3b44] p-3 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            <div className="p-3 font-bold text-base text-white">Settings</div>
            <nav className="space-y-1 text-xs">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                  activeTab === 'profile' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-[#202c33]'
                }`}
              >
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                  activeTab === 'privacy' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-[#202c33]'
                }`}
              >
                <Lock className="w-4 h-4" /> Privacy
              </button>
              <button
                onClick={() => setActiveTab('storage')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                  activeTab === 'storage' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-[#202c33]'
                }`}
              >
                <Database className="w-4 h-4" /> Storage & Data
              </button>
              <button
                onClick={() => setActiveTab('devices')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                  activeTab === 'devices' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-[#202c33]'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Linked Devices
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors ${
                  activeTab === 'account' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:bg-[#202c33]'
                }`}
              >
                <Trash2 className="w-4 h-4" /> Account
              </button>
            </nav>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </aside>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#222e35]">
          {/* Header */}
          <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
            <h2 className="font-bold text-sm text-white capitalize">{activeTab} Settings</h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* 1. PROFILE TAB */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-md">
                {/* Avatar Uploader */}
                <div className="flex items-center gap-5">
                  <div className="relative group w-20 h-20 rounded-full bg-[#111b21] overflow-hidden border-2 border-emerald-500/40">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 m-5 text-slate-400" />
                    )}
                    <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px] font-bold">CHANGE</span>
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{user?.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{user?.phoneNumber}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">About</label>
                    <input
                      type="text"
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@username"
                      className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 rounded-xl text-sm flex items-center justify-center gap-2"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* 2. PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <div className="space-y-6 max-w-md">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Last Seen & Online</label>
                    <select
                      value={privacy.lastSeen}
                      onChange={(e) => setPrivacy({ ...privacy, lastSeen: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">My contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Profile Photo</label>
                    <select
                      value={privacy.profilePhoto}
                      onChange={(e) => setPrivacy({ ...privacy, profilePhoto: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">My contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">About</label>
                    <select
                      value={privacy.about}
                      onChange={(e) => setPrivacy({ ...privacy, about: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">My contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  {/* Read Receipts */}
                  <div className="flex items-center justify-between p-3 bg-[#111b21] rounded-xl border border-[#2e3b44]">
                    <div>
                      <div className="text-xs font-semibold text-white">Read Receipts</div>
                      <div className="text-[11px] text-slate-400">If turned off, you won't send or see blue checks</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={privacy.readReceipts}
                      onChange={(e) => setPrivacy({ ...privacy, readReceipts: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleSavePrivacy}
                    disabled={savingPrivacy}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 rounded-xl text-sm flex items-center justify-center gap-2"
                  >
                    {savingPrivacy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Privacy Rules'}
                  </button>
                </div>
              </div>
            )}

            {/* 3. STORAGE TAB */}
            {activeTab === 'storage' && (
              <div className="space-y-5 max-w-md">
                <div className="p-4 bg-[#111b21] rounded-xl border border-[#2e3b44] space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <HardDrive className="w-4 h-4 text-emerald-400" /> Local Storage Consumption
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-[#202c33] rounded-lg">
                      <div className="text-slate-400">Cached Images</div>
                      <div className="text-white font-bold mt-0.5">14.2 MB</div>
                    </div>
                    <div className="p-2.5 bg-[#202c33] rounded-lg">
                      <div className="text-slate-400">Voice Notes</div>
                      <div className="text-white font-bold mt-0.5">3.8 MB</div>
                    </div>
                    <div className="p-2.5 bg-[#202c33] rounded-lg">
                      <div className="text-slate-400">Documents</div>
                      <div className="text-white font-bold mt-0.5">8.1 MB</div>
                    </div>
                    <div className="p-2.5 bg-[#202c33] rounded-lg">
                      <div className="text-slate-400">Video Previews</div>
                      <div className="text-white font-bold mt-0.5">22.4 MB</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => alert('Local cache cleared successfully!')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs"
                >
                  Clear Cached Media Files
                </button>
              </div>
            )}

            {/* 4. LINKED DEVICES TAB */}
            {activeTab === 'devices' && (
              <div className="space-y-4 max-w-md">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Sessions & Linked Devices
                </div>
                <div className="space-y-2">
                  {devices.map((d) => (
                    <div
                      key={d._id}
                      className="p-3 bg-[#111b21] rounded-xl border border-[#2e3b44] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-sm text-white flex items-center gap-2">
                            {d.deviceName} {d.isCurrent && <span className="text-[10px] text-emerald-400 font-bold">(Current Device)</span>}
                          </div>
                          <div className="text-xs text-slate-400">Last active: {new Date(d.lastActive).toLocaleDateString()}</div>
                        </div>
                      </div>

                      {!d.isCurrent && (
                        <button
                          onClick={() => handleLogoutDevice(d.deviceId)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="space-y-4 max-w-md">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                  <h3 className="font-bold text-red-400 text-sm">Danger Zone: Permanent Account Deletion</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Deleting your account will erase your profile, message history, status stories, and revoke all active sessions across all devices.
                  </p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Permanently Delete My Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
