import React from 'react';
import { X, AlertTriangle, GitMerge, Check, ExternalLink } from 'lucide-react';

export default function DuplicateCompareModal({
  isOpen,
  onClose,
  paperA,
  paperB,
  onMerge,
  onDismiss
}) {
  if (!isOpen || !paperA || !paperB) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-4xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-[#FEF3C7] px-6 py-3 border-b border-[#FDE68A] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#B8860B]">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest font-bold">
                Duplicate Detection Engine
              </div>
              <h2 className="font-serif text-xl font-bold text-[#1A1917]">
                Side-by-Side Metadata Comparison
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#FDE68A] text-[#1A1917] transition-colors border border-[#F6E05E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flag Reason Banner */}
        <div className="p-3 bg-[#EDE9DF] border-b border-[#DCD6C5] font-mono text-xs text-[#1A1917]">
          <strong>Duplicate Flag Reason:</strong> <span className="text-[#D94E28] font-bold">{paperA.duplicate_reason || paperB.duplicate_reason}</span>
        </div>

        {/* Side-by-Side Columns */}
        <div className="p-6 grid grid-cols-2 gap-6 font-mono text-xs">
          
          {/* Paper A */}
          <div className="border border-[#C8C1AE] bg-[#F8F6F0] p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#DCD6C5] pb-2">
                <span className="font-bold text-[#D94E28] text-sm">PAPER A ({paperA.id})</span>
                <span className="bg-[#EAE6DC] px-2 py-0.5 text-[10px]">{paperA.source}</span>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Title:</div>
                <div className="font-bold text-[#1A1917] leading-snug">{paperA.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-[#7A766F] uppercase">Year:</span> <strong>{paperA.year}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#7A766F] uppercase">Citations:</span> <strong>{paperA.citations_count || 0}</strong>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Authors:</div>
                <div className="text-[#4A4843]">{paperA.authors}</div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Venue:</div>
                <div className="italic text-[#4A4843]">{paperA.venue || 'N/A'}</div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">DOI:</div>
                <div className="text-[#4A4843]">{paperA.doi || 'N/A'}</div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Abstract:</div>
                <p className="text-[10px] text-[#4A4843] line-clamp-4 font-sans leading-relaxed">
                  {paperA.abstract || 'N/A'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onMerge(paperA.id, paperB.id)}
              className="w-full btn-editorial bg-[#2D7A53] hover:bg-[#236142] py-2 text-white font-bold flex items-center justify-center gap-1.5"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Keep Paper A & Merge Metadata</span>
            </button>
          </div>

          {/* Paper B */}
          <div className="border border-[#C8C1AE] bg-[#F8F6F0] p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#DCD6C5] pb-2">
                <span className="font-bold text-[#2B6CB0] text-sm">PAPER B ({paperB.id})</span>
                <span className="bg-[#EAE6DC] px-2 py-0.5 text-[10px]">{paperB.source}</span>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Title:</div>
                <div className="font-bold text-[#1A1917] leading-snug">{paperB.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-[#7A766F] uppercase">Year:</span> <strong>{paperB.year}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#7A766F] uppercase">Citations:</span> <strong>{paperB.citations_count || 0}</strong>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Authors:</div>
                <div className="text-[#4A4843]">{paperB.authors}</div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Venue:</div>
                <div className="italic text-[#4A4843]">{paperB.venue || 'N/A'}</div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">DOI:</div>
                <div className="text-[#4A4843]">{paperB.doi || 'N/A'}</div>
              </div>

              <div>
                <div className="text-[10px] text-[#7A766F] uppercase font-bold">Abstract:</div>
                <p className="text-[10px] text-[#4A4843] line-clamp-4 font-sans leading-relaxed">
                  {paperB.abstract || 'N/A'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onMerge(paperB.id, paperA.id)}
              className="w-full btn-editorial bg-[#2B6CB0] hover:bg-[#1E4E8C] py-2 text-white font-bold flex items-center justify-center gap-1.5"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Keep Paper B & Merge Metadata</span>
            </button>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 bg-[#EDE9DF] border-t border-[#DCD6C5] flex items-center justify-between font-mono text-xs">
          <button
            onClick={() => onDismiss(paperA.id)}
            className="btn-editorial-outline text-[11px]"
          >
            Dismiss Flag (Not Duplicate)
          </button>
          <button
            onClick={onClose}
            className="btn-editorial-outline text-[11px]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
