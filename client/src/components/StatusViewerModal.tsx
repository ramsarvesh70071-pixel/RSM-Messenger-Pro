import React, { useEffect, useState } from 'react';
import { useStatusStore } from '../store/useStatusStore';
import { useAuthStore } from '../store/useAuthStore';
import { X, ChevronLeft, ChevronRight, Eye, Send, Smile, User as UserIcon } from 'lucide-react';

export const StatusViewerModal: React.FC = () => {
  const { user } = useAuthStore();
  const { activeViewerGroup, activeViewerIndex, closeViewer, nextStatus, prevStatus } = useStatusStore();
  const [progress, setProgress] = useState(0);

  const statuses = activeViewerGroup?.statuses || [];
  const currentStatus = statuses[activeViewerIndex];
  const isMyStatus = currentStatus && user && (currentStatus.userId as any)._id === user._id;

  // Auto progression timer (5s per story)
  useEffect(() => {
    if (!currentStatus) return;
    setProgress(0);

    const step = 100 / (5 * 20); // 5 seconds, 50ms interval
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextStatus();
          return 0;
        }
        return prev + step;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [currentStatus, activeViewerIndex]);

  if (!activeViewerGroup || !currentStatus) return null;

  const author = activeViewerGroup.user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl select-none">
      {/* Top Close Button */}
      <button
        onClick={closeViewer}
        className="absolute top-6 right-6 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Container */}
      <div className="relative w-full max-w-md h-[95dvh] max-h-[850px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
        {/* Top Progress Bars */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5">
          {statuses.map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                style={{
                  width: idx < activeViewerIndex ? '100%' : idx === activeViewerIndex ? `${progress}%` : '0%'
                }}
                className="h-full bg-white rounded-full transition-all duration-75"
              />
            </div>
          ))}
        </div>

        {/* Header: User Avatar & Timestamp */}
        <div className="absolute top-7 inset-x-4 z-30 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border-2 border-emerald-400">
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 m-2 text-slate-400" />
              )}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{author.name}</div>
              <div className="text-xs text-slate-300">
                {new Date(currentStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Navigation Click Tap Zones */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer" onClick={prevStatus} />
          <div className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer" onClick={nextStatus} />

          {currentStatus.type === 'text' ? (
            <div
              style={{ backgroundColor: currentStatus.backgroundColor || '#075E54' }}
              className="w-full h-full flex items-center justify-center p-8 text-center"
            >
              <p className="text-2xl font-bold text-white tracking-wide leading-relaxed">
                {currentStatus.content}
              </p>
            </div>
          ) : (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <img
                src={currentStatus.content}
                alt="Story"
                className="w-full h-full object-contain"
              />
              {currentStatus.caption && (
                <div className="absolute bottom-16 inset-x-0 bg-black/60 backdrop-blur-md p-4 text-center text-white text-sm font-medium">
                  {currentStatus.caption}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar: Seen list (if own) OR Reply Input */}
        <div className="p-4 bg-gradient-to-t from-black via-black/70 to-transparent z-30">
          {isMyStatus ? (
            <div className="flex items-center justify-center gap-2 text-slate-300 text-xs font-semibold py-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>{currentStatus.views?.length || 0} views</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Reply to status..."
                className="flex-1 py-2 px-4 bg-white/10 border border-white/20 rounded-full text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button className="p-2 rounded-full bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
