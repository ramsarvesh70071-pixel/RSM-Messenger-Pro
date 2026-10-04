import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { mediaUrl } from '../services/api';

interface VoiceMessagePlayerProps {
  url?: string;
  duration?: number;
  waveform?: number[];
  isOutgoing: boolean;
}

const DEFAULT_WAVE = [20, 45, 70, 90, 80, 60, 40, 65, 85, 95, 60, 30, 15, 50, 75, 40];

// Only one voice note plays at a time
let currentlyPlaying: HTMLAudioElement | null = null;

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ url, duration = 0, waveform, isOutgoing }) => {
  const bars = waveform && waveform.length > 0 ? waveform : DEFAULT_WAVE;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [current, setCurrent] = useState(0);
  const [realDuration, setRealDuration] = useState(duration);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (currentlyPlaying === audioRef.current) currentlyPlaying = null;
    };
  }, []);

  const ensureAudio = (): HTMLAudioElement | null => {
    if (!url) return null;
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(mediaUrl(url));
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      // MediaRecorder webm files report Infinity until fully read; keep the recorded duration then
      if (isFinite(audio.duration) && audio.duration > 0) setRealDuration(audio.duration);
    };
    audio.ontimeupdate = () => {
      const total = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : realDuration || duration || 1;
      setCurrent(audio.currentTime);
      setProgress(Math.min(100, (audio.currentTime / total) * 100));
    };
    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    audio.onpause = () => setIsPlaying(false);
    audio.onplay = () => setIsPlaying(true);
    audio.onerror = () => {
      setError(true);
      setIsPlaying(false);
    };
    audioRef.current = audio;
    return audio;
  };

  const toggle = async () => {
    const audio = ensureAudio();
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      return;
    }
    if (currentlyPlaying && currentlyPlaying !== audio) currentlyPlaying.pause();
    currentlyPlaying = audio;
    audio.playbackRate = speed;
    setError(false);
    try {
      await audio.play();
    } catch {
      setError(true);
    }
  };

  const toggleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = ensureAudio();
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const total = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : realDuration;
    if (total) audio.currentTime = ratio * total;
  };

  const formatTime = (secs: number) => {
    const s0 = Math.max(0, Math.floor(secs));
    const m = Math.floor(s0 / 60);
    const s = s0 % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 min-w-[200px] max-w-full">
      <button
        onClick={toggle}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
          isOutgoing ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-500 text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-0.5 h-7 cursor-pointer" onClick={seek}>
          {bars.map((amp, idx) => {
            const isPlayed = progress >= (idx / bars.length) * 100;
            return (
              <div
                key={idx}
                style={{ height: `${Math.max(15, (amp / 100) * 26)}px` }}
                className={`w-1 rounded-full transition-colors ${
                  isPlayed ? (isOutgoing ? 'bg-emerald-300' : 'bg-emerald-400') : isOutgoing ? 'bg-emerald-800' : 'bg-slate-600'
                }`}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-300">
          <span>{error ? 'Cannot play' : isPlaying || current > 0 ? formatTime(current) : formatTime(realDuration)}</span>
          <button onClick={toggleSpeed} className="px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/30 font-bold text-[10px]">
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
};
