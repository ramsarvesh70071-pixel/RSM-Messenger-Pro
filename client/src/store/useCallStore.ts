import { create } from 'zustand';
import { api } from '../services/api';
import { socketService } from '../services/socket.service';
import { startRingtone, stopRingtone } from '../services/ringtone';

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';

interface CallState {
  isCallModalOpen: boolean;
  callType: 'voice' | 'video';
  callStatus: CallStatus;
  caller: any | null;
  receiver: any | null;
  callId: string | null;
  durationSeconds: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connState: 'new' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  notice: string | null; // short message shown after a call ends ("Call declined", ...)
  callsVersion: number; // bumps after every call so the history screen refreshes

  startCall: (targetUser: any, type: 'voice' | 'video', chatId?: string) => Promise<void>;
  receiveIncomingCall: (data: any) => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  clearNotice: () => void;
  setupCallListeners: (currentUserId: string) => void;
  teardownCallListeners: () => void;
}

// ---- module level WebRTC state (not reactive) ----
let pc: RTCPeerConnection | null = null;
let timerInterval: any = null;
let pendingOffer: RTCSessionDescriptionInit | null = null;
let queuedIce: RTCIceCandidateInit[] = [];
let failTimer: any = null;
let incomingNotification: Notification | null = null;
let handlingOffer = false;

const CALL_EVENTS = [
  'call:incoming', 'call:ringing', 'call:offer', 'call:answered', 'call:ice', 'call:busy',
  'call:rejected', 'call:ended', 'call:missed', 'call:error', 'call:state'
];

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await api.get('/calls/ice-servers');
    const list = res.data?.data?.iceServers;
    if (Array.isArray(list) && list.length) return list;
  } catch (err) {
    console.warn('[WebRTC] ICE config fetch failed, using public STUN', err);
  }
  return FALLBACK_ICE;
}

/** Explains why the browser cannot access mic/camera (most common: plain HTTP on a phone). */
function mediaUnavailableReason(): string | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return window.isSecureContext === false
      ? 'Calls need HTTPS. Open the app over https:// (or http://localhost) to use the microphone and camera.'
      : 'This browser does not support calling.';
  }
  return null;
}

async function getLocalMedia(type: 'voice' | 'video'): Promise<MediaStream> {
  const reason = mediaUnavailableReason();
  if (reason) throw new Error(reason);
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
    });
  } catch (err: any) {
    // Video call but no camera: fall back to audio only instead of failing the whole call
    if (type === 'video') {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {}
    }
    if (err?.name === 'NotAllowedError') throw new Error('Microphone/camera permission was denied.');
    if (err?.name === 'NotFoundError') throw new Error('No microphone found on this device.');
    throw new Error('Could not access microphone or camera.');
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

function closePeer() {
  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    try {
      pc.close();
    } catch {}
    pc = null;
  }
  pendingOffer = null;
  handlingOffer = false;
  queuedIce = [];
  if (failTimer) clearTimeout(failTimer);
  failTimer = null;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

async function flushIce() {
  if (!pc || !pc.remoteDescription) return;
  while (queuedIce.length) {
    const c = queuedIce.shift()!;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    } catch (e) {
      console.warn('[WebRTC] addIceCandidate failed', e);
    }
  }
}

export const useCallStore = create<CallState>((set, get) => {
  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    set({ durationSeconds: 0 });
    timerInterval = setInterval(() => set((s) => ({ durationSeconds: s.durationSeconds + 1 })), 1000);
  };

  const otherUserId = (): string | undefined => {
    const { callStatus, caller, receiver } = get();
    return callStatus === 'incoming' ? caller?._id : receiver?._id || caller?._id;
  };

  /** Builds the RTCPeerConnection, attaches local tracks and wires remote media + ICE. */
  const createPeer = async (stream: MediaStream, callIdRef: () => string | null) => {
    const iceServers = await getIceServers();
    const peer = new RTCPeerConnection({ iceServers });
    pc = peer;
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));

    const remote = new MediaStream();
    peer.ontrack = (ev) => {
      if (ev.streams && ev.streams[0]) {
        set({ remoteStream: ev.streams[0] });
      } else {
        remote.addTrack(ev.track);
        set({ remoteStream: remote });
      }
    };

    peer.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketService.emit('call:ice', { callId: callIdRef(), targetUserId: otherUserId(), candidate: ev.candidate });
      }
    };

    peer.onconnectionstatechange = () => {
      const st = peer.connectionState;
      if (st === 'connected') {
        if (failTimer) clearTimeout(failTimer);
        failTimer = null;
        set({ connState: 'connected' });
      } else if (st === 'connecting') {
        set({ connState: 'connecting' });
      } else if (st === 'disconnected' || st === 'failed') {
        set({ connState: st === 'failed' ? 'failed' : 'reconnecting' });
        if (!failTimer) {
          // Give the network 15s to recover before giving up
          failTimer = setTimeout(() => {
            if (pc && pc.connectionState !== 'connected') {
              set({ notice: 'Call dropped: poor connection' });
              get().endCall();
            }
          }, 15000);
        }
      }
    };
    return peer;
  };

  const finishLocally = (notice?: string) => {
    stopRingtone();
    incomingNotification?.close();
    incomingNotification = null;
    stopStream(get().localStream);
    closePeer();
    set((s) => ({
      isCallModalOpen: false,
      callStatus: 'idle',
      caller: null,
      receiver: null,
      callId: null,
      localStream: null,
      remoteStream: null,
      durationSeconds: 0,
      isMuted: false,
      isCameraOff: false,
      connState: 'new',
      notice: notice ?? s.notice,
      callsVersion: s.callsVersion + 1
    }));
  };

  const failWith = (message: string) => {
    // Tell the server/peer (if a call already exists) then close the UI with a visible reason
    const { callId } = get();
    if (callId) socketService.emit('call:end', { callId });
    finishLocally(message);
  };

  return {
    isCallModalOpen: false,
    callType: 'voice',
    callStatus: 'idle',
    caller: null,
    receiver: null,
    callId: null,
    durationSeconds: 0,
    isMuted: false,
    isCameraOff: false,
    isSpeakerOn: true,
    localStream: null,
    remoteStream: null,
    connState: 'new',
    notice: null,
    callsVersion: 0,

    clearNotice: () => set({ notice: null }),

    startCall: async (targetUser, type, chatId) => {
      if (get().callStatus !== 'idle') return; // already in a call
      if (!socketService.isConnected()) {
        set({ notice: 'You are offline. Reconnecting…' });
        return;
      }

      set({
        isCallModalOpen: true,
        callType: type,
        callStatus: 'outgoing',
        receiver: targetUser,
        caller: null,
        callId: null,
        durationSeconds: 0,
        isMuted: false,
        isCameraOff: false,
        localStream: null,
        remoteStream: null,
        connState: 'new',
        notice: null
      });

      try {
        const stream = await getLocalMedia(type);
        // User may have hung up while the permission prompt was open
        if (get().callStatus !== 'outgoing') {
          stopStream(stream);
          return;
        }
        const hasVideo = stream.getVideoTracks().length > 0;
        set({ localStream: stream, callType: type === 'video' && hasVideo ? 'video' : 'voice' });
        startRingtone('outgoing');
        socketService.emit('call:initiate', {
          receiverId: targetUser._id,
          callType: type === 'video' && hasVideo ? 'video' : 'voice',
          chatId
        });
      } catch (err: any) {
        finishLocally(err?.message || 'Could not start the call');
      }
    },

    receiveIncomingCall: (data) => {
      // Already busy: the server enforces this, but guard duplicates (reconnect replays)
      const current = get();
      if (current.callStatus !== 'idle') {
        if (current.callId === data.callId) return;
        return;
      }
      closePeer();
      set({
        isCallModalOpen: true,
        callType: data.callType || 'voice',
        callStatus: 'incoming',
        caller: data.caller,
        receiver: null,
        callId: data.callId,
        durationSeconds: 0,
        localStream: null,
        remoteStream: null,
        connState: 'new',
        notice: null
      });
      startRingtone('incoming');

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
          incomingNotification = new Notification(`Incoming ${data.callType || 'voice'} call`, {
            body: data.caller?.name || 'Someone is calling you',
            requireInteraction: true,
            tag: 'rsm-call'
          });
          incomingNotification.onclick = () => window.focus();
        } catch {}
      }
    },

    acceptCall: async () => {
      const { callType, callId, callStatus } = get();
      if (callStatus !== 'incoming' || !callId) return;
      stopRingtone();
      incomingNotification?.close();

      try {
        const stream = await getLocalMedia(callType);
        // Call may have been cancelled while the permission prompt was open
        if (get().callId !== callId || get().callStatus !== 'incoming') {
          stopStream(stream);
          return;
        }
        const hasVideo = stream.getVideoTracks().length > 0;
        set({ localStream: stream, callType: callType === 'video' && !hasVideo ? 'voice' : callType });

        await createPeer(stream, () => get().callId);

        // Ask the server to replay the offer + ICE it buffered for us
        socketService.emit('call:join', { callId });

        if (pendingOffer) {
          const offer = pendingOffer;
          pendingOffer = null;
          await handleOffer(callId, offer);
        }
      } catch (err: any) {
        failWith(err?.message || 'Could not answer the call');
      }
    },

    rejectCall: async () => {
      const { callId } = get();
      if (callId) socketService.emit('call:reject', { callId, reason: 'declined' });
      finishLocally();
    },

    endCall: async () => {
      const { callId } = get();
      if (callId) socketService.emit('call:end', { callId });
      finishLocally();
    },

    toggleMute: () => {
      const { localStream, isMuted } = get();
      localStream?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
      set({ isMuted: !isMuted });
    },

    toggleCamera: () => {
      const { localStream, isCameraOff } = get();
      localStream?.getVideoTracks().forEach((t) => (t.enabled = isCameraOff));
      set({ isCameraOff: !isCameraOff });
    },

    toggleSpeaker: () => set((s) => ({ isSpeakerOn: !s.isSpeakerOn })),

    teardownCallListeners: () => {
      const socket = socketService.getSocket();
      if (!socket) return;
      CALL_EVENTS.forEach((e) => socket.off(e));
    },

    setupCallListeners: () => {
      const socket = socketService.getSocket();
      if (!socket) return;
      get().teardownCallListeners();

      socket.on('call:incoming', (data: any) => get().receiveIncomingCall(data));

      // Caller: server created the call -> now (and only now) build the peer and send the offer
      socket.on('call:ringing', async ({ callId }: any) => {
        const { callStatus, localStream } = get();
        if (callStatus !== 'outgoing' || !localStream) {
          // Caller already hung up before the server answered with a callId: cancel it so the
          // callee's phone does not keep ringing for 45 seconds.
          if (callId) socket.emit('call:end', { callId });
          return;
        }
        set({ callId });
        try {
          const peer = await createPeer(localStream, () => get().callId);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('call:offer', { callId, sdp: peer.localDescription || offer });
        } catch (err: any) {
          failWith('Could not start the call connection');
        }
      });

      // Callee: offer from the caller
      socket.on('call:offer', async ({ callId, sdp }: any) => {
        const cur = get();
        if (cur.callId && callId && cur.callId !== callId) return;
        if (!pc) {
          // Not accepted yet: keep it until the user taps accept
          pendingOffer = sdp;
          return;
        }
        await handleOffer(callId || cur.callId!, sdp);
      });

      // Caller: callee answered
      socket.on('call:answered', async ({ callId, sdp }: any) => {
        const cur = get();
        if (cur.callStatus !== 'outgoing' || (cur.callId && callId && cur.callId !== callId)) return;
        stopRingtone();
        if (pc && sdp && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushIce();
          } catch (err) {
            console.error('[WebRTC] setRemoteDescription(answer) failed', err);
            failWith('Could not connect the call');
            return;
          }
        }
        set({ callStatus: 'connected' });
        startTimer();
      });

      socket.on('call:ice', async ({ callId, candidate }: any) => {
        const cur = get();
        if (!candidate || (cur.callId && callId && cur.callId !== callId)) return;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('[WebRTC] ICE add failed', err);
          }
        } else {
          queuedIce.push(candidate);
        }
      });

      socket.on('call:busy', () => finishLocally('User is on another call'));

      socket.on('call:rejected', ({ callId }: any) => {
        const cur = get();
        if (cur.callId && callId && cur.callId !== callId) return;
        finishLocally('Call declined');
      });

      // Missed (callee side). call:ended follows right after and closes the UI.
      socket.on('call:missed', () => {});

      // Remote hang-up / timeout / server cleanup. LOCAL cleanup only (no re-emit => no ping-pong loop).
      socket.on('call:ended', ({ callId, reason }: any) => {
        const cur = get();
        if (cur.callStatus === 'idle') return;
        if (cur.callId && callId && cur.callId !== callId) return;
        const notice =
          cur.callStatus === 'outgoing' && reason === 'missed'
            ? 'No answer'
            : cur.callStatus === 'incoming'
            ? 'Missed call'
            : undefined;
        finishLocally(notice);
      });

      // Answered/declined on another device of mine
      socket.on('call:state', ({ callId, status }: any) => {
        const cur = get();
        if (cur.callStatus === 'incoming' && cur.callId === callId && status === 'connected') {
          finishLocally('Answered on another device');
        }
      });

      socket.on('call:error', ({ message }: any) => finishLocally(message || 'Could not complete the call'));

      // After a reconnect the server re-sends call:incoming if we are still being rung
    }
  };

  async function handleOffer(callId: string, sdp: RTCSessionDescriptionInit) {
    if (!pc || pc.remoteDescription || handlingOffer) return; // ignore replayed duplicates
    handlingOffer = true;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.emit('call:answer', { callId, sdp: pc.localDescription || answer });
      set({ callStatus: 'connected' });
      startTimer();
    } catch (err) {
      console.error('[WebRTC] handleOffer failed', err);
      failWith('Could not connect the call');
    }
  }
});
