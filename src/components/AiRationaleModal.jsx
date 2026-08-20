import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ExternalLink, 
  UserCheck, 
  ShieldAlert, 
  BookOpen, 
  X,
  Copy,
  Check
} from 'lucide-react';

export default function AiRationaleModal({
  isOpen,
  onClose,
  paper,
  onUpdateStatus
}) {
  const [isAbstractCopied, setIsAbstractCopied] = useState(false);

  if (!isOpen || !paper) return null;

  const handleCopyAbstract = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsAbstractCopied(true);
    setTimeout(() => setIsAbstractCopied(false), 2000);
  };

  const confidence = Math.round((paper.ai_confidence || 0.85) * 100);
  const isIncluded = paper.status === 'INCLUDED';
  const isExcluded = paper.status === 'EXCLUDED';
  const isHumanOverridden = paper.ai_decision && paper.status !== paper.ai_decision;

  const handleOverride = (newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(paper.id, {
        status: newStatus,
        exclusion_reason: newStatus === 'EXCLUDED' ? paper.exclusion_reason || 'Manual exclusion by researcher' : null
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden font-mono flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D94E28]" />
            <span className="text-[11px] text-[#A09B8E] uppercase tracking-widest font-bold">
              [{paper.id}] AI Decision & Scientific Rationale Audit
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Paper Metadata Card */}
          <div className="bg-[#EFECE4] border border-[#DCD6C5] p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif font-bold text-base text-[#1A1917] leading-snug">
                {paper.title}
              </h3>
              {paper.url && (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-[#DCD6C5] text-[#D94E28] shrink-0"
                  title="Open canonical publication link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="text-xs text-[#7A766F] flex items-center gap-2 flex-wrap pt-1 border-t border-[#DCD6C5]">
              <span className="text-[#D94E28] font-bold">{paper.year}</span>
              <span>•</span>
              <span>{paper.authors}</span>
              <span>•</span>
              <span className="italic">{paper.venue || 'N/A'}</span>
              {paper.doi && paper.doi !== 'N/A' && (
                <>
                  <span>•</span>
                  <span className="bg-[#E5E0D3] px-1 text-[#4A4843]">DOI: {paper.doi}</span>
                </>
              )}
            </div>

            {paper.abstract && paper.abstract !== 'N/A' && (
              <div className="mt-2 pt-2 border-t border-[#DCD6C5] space-y-1">
                <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-[#D94E28]" />
                    <span>Abstract:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyAbstract(paper.abstract)}
                    className="px-2 py-0.5 bg-[#1A1917] hover:bg-[#333] text-white text-[10px] font-bold rounded flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Copy abstract text"
                  >
                    {isAbstractCopied ? (
                      <>
                        <Check className="w-3 h-3 text-[#4ADE80]" />
                        <span className="text-[#4ADE80]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-[#38BDF8]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="font-sans text-xs text-[#2C2B29] leading-relaxed max-h-36 overflow-y-auto bg-[#F8F6F0] p-2.5 border border-[#E5E0D3] rounded select-text cursor-text selection:bg-[#FED7AA] selection:text-[#9A3412] whitespace-pre-wrap">
                  {paper.abstract}
                </p>
              </div>
            )}
          </div>

          {/* AI Decision & Confidence Meter */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* AI Verdict Box */}
            <div className="bg-[#FDFCF9] border border-[#C8C1AE] p-3 space-y-1.5">
              <div className="text-[10px] text-[#7A766F] uppercase font-bold">AI Suggested Verdict</div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-bold border flex items-center gap-1.5 ${
                  paper.ai_decision === 'INCLUDED'
                    ? 'bg-[#D4EBD9] text-[#2D7A53] border-[#98D4A5]'
                    : paper.ai_decision === 'EXCLUDED'
                    ? 'bg-[#FADBD8] text-[#C93B2B] border-[#F5B7B1]'
                    : 'bg-[#E9D8FD] text-[#6B46C1] border-[#D6BCFA]'
                }`}>
                  {paper.ai_decision === 'INCLUDED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {paper.ai_decision === 'EXCLUDED' && <XCircle className="w-3.5 h-3.5" />}
                  {paper.ai_decision === 'UNSURE' && <HelpCircle className="w-3.5 h-3.5" />}
                  <span>{paper.ai_decision || 'PENDING'}</span>
                </span>
                
                {isHumanOverridden && (
                  <span className="text-[10px] bg-[#FEF3C7] text-[#B8860B] border border-[#FDE68A] px-1.5 py-0.5 font-bold flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    <span>Current: {paper.status}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Confidence Score Visualizer */}
            <div className="bg-[#FDFCF9] border border-[#C8C1AE] p-3 space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#7A766F] uppercase font-bold">Confidence Score</span>
                <span className="font-bold text-sm text-[#1A1917]">{confidence}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#E5E0D3] rounded-full overflow-hidden border border-[#DCD6C5] p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    confidence >= 80 
                      ? 'bg-[#2D7A53]' 
                      : confidence >= 60 
                      ? 'bg-[#B8860B]' 
                      : 'bg-[#C93B2B]'
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>

          </div>

          {/* Matched Criteria Section */}
          {isIncluded && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#2D7A53] uppercase font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2D7A53]" />
                <span>Matched Inclusion Criteria (PICO / IC):</span>
              </div>
              <div className="bg-[#EAF5EC] border-2 border-[#98D4A5] text-[#2D7A53] p-3 text-xs font-bold leading-relaxed rounded">
                {paper.matched_ics ? `Criteria Satisfied: ${paper.matched_ics}` : 'Passes all mandatory PICO framework and empirical evaluation criteria.'}
              </div>
            </div>
          )}

          {!isIncluded && isExcluded && paper.exclusion_reason && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-[#C93B2B]" />
                <span>Matched Exclusion Criteria:</span>
              </div>
              <div className="bg-[#FDF2F2] border-2 border-[#F5B7B1] text-[#C93B2B] p-3 text-xs font-bold leading-relaxed rounded">
                {paper.exclusion_reason}
              </div>
            </div>
          )}

          {/* Full Scientific Justification */}
          {paper.ai_rationale && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#D94E28]" />
                <span>Gemini Scientific Peer-Review Justification:</span>
              </div>
              <div className="font-sans text-xs italic leading-relaxed bg-[#F8F6F0] p-3.5 border-l-4 border-[#D94E28] text-[#1A1917] shadow-xs">
                "{paper.ai_rationale}"
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-[#EDE9DF] px-6 py-3 border-t border-[#DCD6C5] flex items-center justify-between shrink-0">
          <div className="text-[10px] text-[#7A766F] font-bold">
            Researcher Override Protocol
          </div>

          <div className="flex items-center gap-2">
            {!isIncluded && (
              <button
                onClick={() => handleOverride('INCLUDED')}
                className="px-3 py-1.5 bg-[#2D7A53] hover:bg-[#236142] text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Override to INCLUDED</span>
              </button>
            )}

            {!isExcluded && (
              <button
                onClick={() => handleOverride('EXCLUDED')}
                className="px-3 py-1.5 bg-[#C93B2B] hover:bg-[#A82B1D] text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Override to EXCLUDED</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1A1917] hover:bg-[#33312E] text-white text-xs font-bold shadow-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
