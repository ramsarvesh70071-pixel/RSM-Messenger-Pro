import React from 'react';
import { ALLOWED_REACTIONS } from '../constants';

interface ReactionPickerProps {
  onSelectReaction: (emoji: string) => void;
  onClose: () => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelectReaction, onClose }) => {
  return (
    <div className="absolute -top-12 left-2 z-30 flex items-center gap-1 bg-[#202c33] border border-[#2e3b44] rounded-full px-2 py-1.5 shadow-2xl animate-in fade-in zoom-in duration-150">
      {ALLOWED_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={(e) => {
            e.stopPropagation();
            onSelectReaction(emoji);
            onClose();
          }}
          className="text-xl hover:scale-125 transition-transform p-1 rounded-full hover:bg-white/10"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
