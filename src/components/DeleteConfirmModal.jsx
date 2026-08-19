import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, FileText, Layers } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  paper = null,
  paperIds = [],
  title = null
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const isBulk = Array.isArray(paperIds) && paperIds.length > 0 && !paper;
  const count = isBulk ? paperIds.length : 1;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      if (onConfirm) {
        await onConfirm(isBulk ? paperIds : paper?.id);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-[#F4F1EA] border-2 border-[#C93B2B] text-[#1A1917] max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(201,59,43,0.35)] overflow-hidden font-mono flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-[#2D1212] text-[#FCA5A5] px-6 py-3.5 border-b-2 border-[#521E1E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-[#F87171]">
            <Trash2 className="w-5 h-5 animate-pulse" />
            <div>
              <span className="text-[10px] text-[#FCA5A5]/70 uppercase tracking-widest block font-bold">
                Permanent Corpus Modification
              </span>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                {isBulk ? `Delete ${count} Selected Papers?` : `Delete Paper Record?`}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-[#FCA5A5] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 bg-[#F4F1EA] text-xs">
          
          {/* Danger Warning Box */}
          <div className="bg-[#FADBD8] border border-[#F5B7B1] text-[#78281F] p-3 rounded flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#C93B2B] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Irreversible SQLite Deletion</span>
              <p className="text-[11px] leading-relaxed text-[#922B21]">
                {isBulk 
                  ? `You are about to permanently delete ${count} paper records from the local SQLite database. This action cannot be undone.`
                  : `You are about to permanently remove this literature record from your research corpus.`}
              </p>
            </div>
          </div>

          {/* Paper Details Card (Single Paper) */}
          {!isBulk && paper && (
            <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3 rounded space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#1A1917] text-white px-2 py-0.5 rounded font-bold text-[10px]">
                  {paper.id || 'P---'}
                </span>
                <span className="text-[10px] text-[#7A766F] uppercase font-bold">
                  {paper.year || 2024} • {paper.venue || paper.source || 'Academic Literature'}
                </span>
              </div>

              <h3 className="font-sans font-bold text-sm text-[#1A1917] leading-snug">
                {paper.title || 'Untitled Record'}
              </h3>

              {paper.authors && (
                <div className="text-[11px] text-[#55524B] truncate">
                  <strong className="text-[#1A1917]">Authors:</strong> {paper.authors}
                </div>
              )}
            </div>
          )}

          {/* Bulk Summary Card */}
          {isBulk && (
            <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3 rounded flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C93B2B]" />
                <span>Selected for deletion:</span>
              </div>
              <span className="bg-[#2D1212] text-[#FCA5A5] px-2.5 py-1 rounded border border-[#521E1E]">
                {count} Records
              </span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-[#EDE9DF] border-t border-[#DCD6C5] px-6 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-1.5 bg-[#E5E0D3] hover:bg-[#DDD7C8] text-[#4A4843] text-xs font-bold rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-5 py-1.5 bg-[#C93B2B] hover:bg-[#A93226] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{isDeleting ? 'Deleting...' : isBulk ? `Delete ${count} Papers` : 'Confirm Delete'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
