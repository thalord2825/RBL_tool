import React from 'react';
import { Sparkles, Maximize2, CheckCircle2, XCircle, HelpCircle, Loader2 } from 'lucide-react';

export default function AiScreenMiniDock({
  isScreening,
  progress,
  onExpand
}) {
  if (!isScreening || !progress) return null;

  const {
    total = 0,
    evaluated = 0,
    percent = 0,
    currentId = '',
    currentTitle = '',
    lastDecision = null,
    stats = { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 },
    isDone = false
  } = progress;

  if (isDone) return null;

  return (
    <div 
      onClick={onExpand}
      className="fixed bottom-5 right-5 z-50 bg-[#F4F1EA] border-2 border-[#1A1917] text-[#1A1917] shadow-[6px_6px_0px_0px_rgba(26,25,23,0.85)] px-4 py-2.5 flex items-center gap-3.5 font-mono text-xs cursor-pointer hover:bg-[#EFECE4] transition-all hover:-translate-y-0.5 select-none animate-in slide-in-from-bottom-5 duration-200"
      title="Click to expand full Gemini AI Screening Console"
    >
      {/* Pulsing Vermillion Indicator */}
      <div className="relative flex items-center justify-center">
        <span className="absolute w-6 h-6 rounded-full bg-[#D94E28]/30 animate-ping"></span>
        <Sparkles className="w-4 h-4 text-[#D94E28] relative animate-pulse" />
      </div>

      {/* Progress Information */}
      <div className="space-y-0.5 max-w-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#1A1917] uppercase text-[11px] tracking-wider">
            AI Screening: {percent}%
          </span>
          <span className="text-[#7A766F] text-[10px] font-semibold">
            ({evaluated}/{total})
          </span>
        </div>

        {/* Current Paper Ticker */}
        {currentTitle ? (
          <div className="text-[10px] text-[#4A4843] truncate max-w-[210px] font-sans italic">
            [{currentId}] "{currentTitle}"
          </div>
        ) : (
          <div className="text-[10px] text-[#7A766F] flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-[#D94E28]" />
            <span>Evaluating stream...</span>
          </div>
        )}
      </div>

      {/* Live High-Contrast Pastel Counters */}
      <div className="flex items-center gap-1.5 pl-2.5 border-l border-[#DCD6C5] text-[10px]">
        <span className="bg-[#D4EBD9] text-[#2D7A53] border border-[#98D4A5] px-1.5 py-0.5 font-bold" title="Included">
          ✓ {stats?.INCLUDED || 0}
        </span>
        <span className="bg-[#FADBD8] text-[#C93B2B] border border-[#F5B7B1] px-1.5 py-0.5 font-bold" title="Excluded">
          ✕ {stats?.EXCLUDED || 0}
        </span>
        <span className="bg-[#E9D8FD] text-[#6B46C1] border border-[#D6BCFA] px-1.5 py-0.5 font-bold" title="Unsure">
          ❓ {stats?.UNSURE || 0}
        </span>
      </div>

      {/* Expand Console Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); onExpand(); }}
        className="p-1 hover:bg-[#DCD6C5] text-[#4A4843] hover:text-[#1A1917] rounded ml-1 transition-colors"
        title="Maximize AI Screening Console"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
