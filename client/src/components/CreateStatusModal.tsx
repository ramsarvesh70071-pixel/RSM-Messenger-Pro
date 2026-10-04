import React, { useState } from 'react';
import { useStatusStore } from '../store/useStatusStore';
import { api } from '../services/api';
import { X, Send, Palette, Image as ImageIcon, Loader2 } from 'lucide-react';

interface CreateStatusModalProps {
  onClose: () => void;
}

const BG_COLORS = ['#075E54', '#128C7E', '#1f2937', '#7c2d12', '#4c1d95', '#1e3a5f'];

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({ onClose }) => {
  const { createStatus } = useStatusStore();
  const [type, setType] = useState<'text' | 'image'>('text');
  const [content, setContent] = useState('');
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setContent(res.data.data.url);
      setType('image');
    } catch {
      alert('Failed to upload status image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    await createStatus({
      type,
      content,
      caption: type === 'image' ? caption : undefined,
      backgroundColor: type === 'text' ? bgColor : undefined
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#222e35] border border-[#2e3b44] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
          <h2 className="font-bold text-base text-[#e9edef]">New Status Story</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {type === 'text' ? (
            <div
              style={{ backgroundColor: bgColor }}
              className="w-full h-56 rounded-2xl p-6 flex flex-col justify-between shadow-inner relative transition-colors"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type a status..."
                className="w-full h-full bg-transparent resize-none text-white text-xl font-bold placeholder-white/60 focus:outline-none text-center"
              />

              {/* Color Palette Switcher */}
              <div className="flex items-center justify-center gap-2 pt-2">
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      bgColor === color ? 'border-white scale-110' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-full h-56 bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                <img src={content} alt="Preview" className="w-full h-full object-contain" />
              </div>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2e3b44] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Switch to Image Upload */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer">
              <ImageIcon className="w-4 h-4" /> Upload Image
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </label>

            {type === 'image' && (
              <button
                type="button"
                onClick={() => {
                  setType('text');
                  setContent('');
                }}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Switch to Text
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-sm transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Share to Status <Send className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
};
