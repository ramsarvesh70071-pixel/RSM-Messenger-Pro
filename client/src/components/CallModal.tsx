import React, { useRef, useEffect } from 'react';
import { useCallStore } from '../store/useCallStore';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, User as UserIcon, X } from 'lucide-react';

export const CallModal: React.FC = () => {
  const {
    isCallModalOpen,
    callType,
    callStatus,
    caller,
    receiver,
    durationSeconds,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    localStream,
    remoteStream,
    connState,
    notice,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    clearNotice
  } = useCallStore();

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Remote audio always plays through a dedicated <audio> element (works for voice AND video calls)
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    if (remoteStream) el.play().catch(() => {});
  }, [remoteStream, isCallModalOpen]);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (el) el.muted = !isSpeakerOn;
  }, [isSpeakerOn, isCallModalOpen]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el) {
      el.srcObject = remoteStream;
      el.play().catch(() => {});
    }
  }, [remoteStream, callStatus, callType]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    }
  }, [localStream, callStatus, isCameraOff]);

  // Notice toast (declined / no answer / permission problems) auto-hides
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 4500);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  const noticeToast = notice ? (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] px-4 py-3 rounded-2xl bg-[#233138] border border-[#2e3b44] text-sm text-[#e9edef] shadow-2xl flex items-center gap-3"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    >
      <span>{notice}</span>
      <button onClick={clearNotice} aria-label="Dismiss" className="p-1 rounded-full hover:bg-white/10">
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : null;

  if (!isCallModalOpen) return noticeToast;

  const targetPerson = callStatus === 'incoming' ? caller : receiver || caller;
  const targetName = targetPerson?.name || 'Contact';
  const targetAvatar = targetPerson?.avatarUrl;
  const showVideo = callType === 'video' && callStatus === 'connected';

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const statusText = () => {
    if (callStatus === 'incoming') return `Incoming ${callType} call…`;
    if (callStatus === 'outgoing') return 'Calling…';
    if (connState === 'reconnecting') return 'Reconnecting…';
    if (connState === 'failed') return 'Connection lost…';
    if (callStatus === 'connected') return formatDuration(durationSeconds);
    return '';
  };

  const ctrl = (active: boolean) =>
    `w-14 h-14 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
      active ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
    }`;

  return (
    <>
      {noticeToast}
      {/* Full-screen on phones, centered card on desktop */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xl sm:p-4">
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="w-full h-full sm:h-[90dvh] sm:max-h-[720px] sm:max-w-md bg-gradient-to-b from-[#111b21] to-[#0c1317] sm:border border-white/10 sm:rounded-3xl shadow-2xl flex flex-col justify-between relative overflow-hidden">
          {/* Remote video fills the screen for video calls */}
          {showVideo && (
            <video ref={remoteVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover bg-black" />
          )}
          {showVideo && <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />}

          {!showVideo && (
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          )}

          {/* Header */}
          <div
            className="relative z-10 text-center space-y-2 px-6"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              {callType === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              {callType} call
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight truncate">{targetName}</h2>
            <div className="text-sm font-medium text-slate-300 font-mono">{statusText()}</div>
          </div>

          {/* Center: avatar (voice / ringing) */}
          <div className="relative z-10 flex-1 flex items-center justify-center py-6">
            {!showVideo && (
              <div className="relative">
                <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/30 p-1 shadow-2xl mx-auto">
                  <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                    {targetAvatar ? (
                      <img src={targetAvatar} alt={targetName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-16 h-16 text-slate-400" />
                    )}
                  </div>
                </div>
                {(callStatus === 'outgoing' || callStatus === 'incoming') && (
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping pointer-events-none" />
                )}
              </div>
            )}
          </div>

          {/* Local preview (picture-in-picture) */}
          {callType === 'video' && localStream && !isCameraOff && (callStatus === 'connected' || callStatus === 'outgoing') && (
            <div
              className="absolute right-4 z-20 w-24 h-32 bg-slate-950 border border-white/20 rounded-xl overflow-hidden shadow-2xl"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 96px)' }}
            >
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            </div>
          )}

          {/* Controls */}
          <div className="relative z-10 px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
            {callStatus === 'incoming' ? (
              <div className="flex items-center justify-around">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={rejectCall}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-90"
                    aria-label="Decline call"
                  >
                    <PhoneOff className="w-7 h-7" />
                  </button>
                  <span className="text-xs text-slate-400">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 animate-bounce"
                    aria-label="Accept call"
                  >
                    {callType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
                  </button>
                  <span className="text-xs text-slate-400">Accept</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <button onClick={toggleMute} className={ctrl(isMuted)} aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}>
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {callType === 'video' && (
                  <button onClick={toggleCamera} className={ctrl(isCameraOff)} aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
                    {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </button>
                )}

                <button onClick={toggleSpeaker} className={ctrl(!isSpeakerOn)} aria-label={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}>
                  {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>

                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-90"
                  aria-label="End call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
