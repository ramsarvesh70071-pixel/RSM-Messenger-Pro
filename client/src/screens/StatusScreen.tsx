import React, { useEffect, useState } from 'react';
import { useStatusStore } from '../store/useStatusStore';
import { useAuthStore } from '../store/useAuthStore';
import { CreateStatusModal } from '../components/CreateStatusModal';
import { Plus, Eye, User as UserIcon, Clock, Sparkles } from 'lucide-react';

export const StatusScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { feed, myStatuses, fetchFeed, fetchMyStatuses, openViewer } = useStatusStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchFeed();
    fetchMyStatuses();
  }, []);

  const latestMyStatus = myStatuses[0];

  return (
    <div className="flex-1 bg-[#111b21] flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-[#222d34] flex items-center justify-between">
        <h1 className="font-bold text-xl text-white">Status Stories</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Status
        </button>
      </div>

      <div className="p-4 space-y-6 max-w-xl mx-auto w-full">
        {/* My Status Card */}
        <div
          onClick={() => {
            if (myStatuses.length > 0 && user) {
              openViewer({ user, statuses: myStatuses, allSeen: true, latestStatusAt: myStatuses[0].createdAt });
            } else {
              setShowCreateModal(true);
            }
          }}
          className="flex items-center gap-4 p-3 bg-[#202c33] rounded-2xl cursor-pointer hover:bg-[#2a3942] transition-colors"
        >
          <div className="relative">
            <div
              className={`w-14 h-14 rounded-full p-0.5 overflow-hidden border-2 ${
                myStatuses.length > 0 ? 'border-emerald-500' : 'border-dashed border-slate-600'
              }`}
            >
              <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-slate-400" />
                )}
              </div>
            </div>
            {myStatuses.length === 0 && (
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 font-bold border-2 border-[#111b21]">
                <Plus className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="font-bold text-sm text-white">My status</div>
            <div className="text-xs text-slate-400">
              {myStatuses.length > 0
                ? `${myStatuses.length} updates active • Tap to view`
                : 'Tap to add status update'}
            </div>
          </div>
        </div>

        {/* Recent Updates Section */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Recent Updates (24h)
          </div>

          {feed.length === 0 ? (
            <div className="p-8 text-center bg-[#202c33]/40 rounded-2xl border border-[#2e3b44]/40 text-slate-400 text-xs">
              No recent updates from your contacts.
            </div>
          ) : (
            <div className="space-y-2">
              {feed.map((group) => (
                <div
                  key={group.user._id}
                  onClick={() => openViewer(group)}
                  className="flex items-center gap-4 p-3 bg-[#202c33] rounded-2xl cursor-pointer hover:bg-[#2a3942] transition-colors"
                >
                  <div
                    className={`w-14 h-14 rounded-full p-0.5 border-2 ${
                      group.allSeen ? 'border-slate-600' : 'border-emerald-400'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                      {group.user.avatarUrl ? (
                        <img src={group.user.avatarUrl} alt={group.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="font-bold text-sm text-white">{group.user.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(group.latestStatusAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && <CreateStatusModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};
