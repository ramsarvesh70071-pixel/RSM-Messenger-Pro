import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { socketService } from '../services/socket.service';
import { api } from '../services/api';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  X,
  Image as ImageIcon,
  FileText,
  MapPin,
  Trash2
} from 'lucide-react';

interface ChatInputProps {
  chatId: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ chatId }) => {
  const { replyingTo, setReplyingTo, sendMessage } = useChatStore();
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);

  // Real MediaRecorder Web Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformSamplesRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    analyserRef.current = null;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Handle typing indicator
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    socketService.emitTyping(chatId, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.emitTyping(chatId, false);
    }, 2000);
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    socketService.emitTyping(chatId, false);
    const content = text.trim();
    setText('');
    await sendMessage({ type: 'text', content });
  };

  // Real MediaRecorder Voice Recording with Web Audio Waveform Metering
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      waveformSamplesRef.current = [];

      // Setup Web Audio API Analyser for real audio frequency waveforms
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const sampleWaveform = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = Math.round((sum / dataArray.length) * 0.4);
          waveformSamplesRef.current.push(Math.min(100, Math.max(15, avg)));
          animationFrameRef.current = requestAnimationFrame(sampleWaveform);
        };
        sampleWaveform();
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      socketService.emitRecording(chatId, true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record voice notes. Please grant permission.');
    }
  };

  const cancelRecording = () => {
    setIsRecording(false);
    socketService.emitRecording(chatId, false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
    audioChunksRef.current = [];
  };

  const sendRecording = async () => {
    if (!mediaRecorderRef.current) return;
    setIsRecording(false);
    socketService.emitRecording(chatId, false);

    const duration = recordingSeconds || 1;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const mime = recorder.mimeType || 'audio/webm';
        const baseMime = mime.split(';')[0] || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: baseMime });
        const ext = mime.includes('webm') ? 'webm' : 'mp3';
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.${ext}`, { type: baseMime });

        const formData = new FormData();
        formData.append('file', audioFile);

        // Upload to server media endpoint
        const uploadRes = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const uploadedMedia = uploadRes.data.data;

        // Sample down waveform to 16 clean bars
        const samples = waveformSamplesRef.current;
        const step = Math.max(1, Math.floor(samples.length / 16));
        const finalWaveform = Array.from({ length: 16 }, (_, i) => samples[i * step] || 25);

        await sendMessage({
          type: 'voice',
          content: 'Voice note',
          attachments: [
            {
              url: uploadedMedia.url,
              mimeType: baseMime,
              fileName: audioFile.name,
              fileSize: audioFile.size,
              duration,
              waveform: finalWaveform
            }
          ]
        });
      } catch (uploadErr) {
        console.error('Failed to upload voice note:', uploadErr);
        alert('Could not upload voice note. Please try again.');
      } finally {
        cleanupAudio();
      }
    };

    recorder.stop();
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setShowAttachMenu(false);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploaded = res.data.data;

      let msgType = 'document';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';

      await sendMessage({
        type: msgType,
        content: file.name,
        attachments: [uploaded]
      });
    } catch (err) {
      alert('Failed to upload file');
    }
  };

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <footer
      className="bg-[#202c33] border-t border-[#222d34] px-2 sm:px-4 pt-2 shrink-0 z-20"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between p-2 mb-2 bg-[#111b21] border-l-4 border-emerald-500 rounded-lg text-xs">
          <div>
            <div className="font-semibold text-emerald-400">
              Replying to {typeof replyingTo.senderId === 'object' ? (replyingTo.senderId as any).name : 'User'}
            </div>
            <div className="text-slate-300 line-clamp-1">{replyingTo.content || 'Media message'}</div>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-full" aria-label="Cancel reply">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* Main Input Row */}
      {isRecording ? (
        /* Recording UI Bar with live animated recording pulse */
        <div className="flex items-center justify-between h-11 px-2 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-sm font-mono text-white font-bold">{formatTimer(recordingSeconds)}</span>
            <span className="text-xs text-slate-400 italic">Recording voice note...</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={cancelRecording}
              className="p-2 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
              aria-label="Discard recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={sendRecording}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full transition-transform active:scale-95 shadow-md"
              aria-label="Send voice note"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* Standard Input Bar */
        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
          <input ref={mediaInputRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

          {/* Emoji Button */}
          <button
            onClick={() => setText((prev) => prev + '😊')}
            className="p-2 rounded-full text-[#8696a0] hover:text-[#d1d7db] transition-colors"
            aria-label="Insert emoji"
          >
            <Smile className="w-6 h-6" />
          </button>

          {/* Attachment Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 rounded-full text-[#8696a0] hover:text-[#d1d7db] transition-colors"
              aria-label="Open attachments menu"
            >
              <Paperclip className="w-6 h-6" />
            </button>

            {/* Attachment Flyout */}
            {showAttachMenu && <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />}
            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 w-52 bg-[#233138] border border-[#2e3b44] rounded-2xl p-2 shadow-2xl space-y-1 z-50 text-sm text-white">
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left font-medium"
                >
                  <div className="p-2 rounded-full bg-purple-500/20 text-purple-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  Photos & Videos
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left font-medium"
                >
                  <div className="p-2 rounded-full bg-blue-500/20 text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  Document
                </button>
                <button
                  onClick={async () => {
                    setShowAttachMenu(false);
                    if (!navigator.geolocation) {
                      alert('Location is not supported on this device.');
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      async (pos) => {
                        await sendMessage({
                          type: 'location',
                          location: {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            name: 'Current Location',
                            address: 'Shared location'
                          }
                        });
                      },
                      () => alert('Could not get your location. Allow location access (needs HTTPS on phones).'),
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left font-medium"
                >
                  <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  Location
                </button>
              </div>
            )}
          </div>

          {/* Text Input */}
          <form onSubmit={handleSendText} className="flex-1">
            <input
              type="text"
              value={text}
              onChange={handleTextChange}
              placeholder="Type a message"
              className="w-full py-2.5 px-4 bg-[#2a3942] rounded-xl text-base sm:text-sm text-[#d1d7db] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </form>

          {/* Mic / Send Button */}
          {text.trim() ? (
            <button
              onClick={() => handleSendText()}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full transition-transform active:scale-95 shadow-md shrink-0"
              aria-label="Send text message"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="p-2 rounded-full text-[#8696a0] hover:text-emerald-400 transition-colors shrink-0"
              aria-label="Record voice note"
            >
              <Mic className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </footer>
  );
};
