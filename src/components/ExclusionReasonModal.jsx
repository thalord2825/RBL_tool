import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';

const FALLBACK_EC_OPTIONS = [
  'EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.',
  'EC2: Papers dealing with acoustic voice/audio processing to detect fraudulent calls rather than processing text/scripts.',
  'EC3: Studies that do not utilize Machine Learning, LLMs, or PLMs (e.g., relying entirely on classical rule-based methods).',
  'EC4: Purely theoretical or vision papers lacking experimental datasets, practical implementations, or empirical evaluation.',
  'EC5: Papers not written in English, or where the full-text is inaccessible.'
];

export default function ExclusionReasonModal({ 
  isOpen, 
  onClose, 
  paper, 
  onConfirmExclusion,
  ecList = FALLBACK_EC_OPTIONS
}) {
  const activeEcs = (ecList && ecList.length > 0) ? ecList : FALLBACK_EC_OPTIONS;
  const [selectedEc, setSelectedEc] = useState(activeEcs[0]);
  const [customReason, setCustomReason] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    if (activeEcs.length > 0) {
      setSelectedEc(activeEcs[0]);
    }
  }, [ecList, isOpen]);

  if (!isOpen || !paper) return null;

  const handleConfirm = () => {
    const finalReason = useCustom && customReason.trim() ? customReason.trim() : selectedEc;
    onConfirmExclusion(paper.id, finalReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#FADBD8] px-6 py-3 border-b border-[#F5B7B1] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#C93B2B]">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest font-bold">
                PRISMA 2020 Protocol
              </div>
              <h2 className="font-serif text-lg font-bold text-[#1A1917]">
                Mandatory Exclusion Rationale
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#F5B7B1] text-[#1A1917] transition-colors border border-[#E6B0AA]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Paper Banner */}
        <div className="p-4 bg-[#EFECE4] border-b border-[#DCD6C5] font-mono text-xs">
          <div className="text-[#7A766F] text-[10px] uppercase font-bold">Excluding Paper:</div>
          <div className="font-bold text-[#1A1917] mt-0.5 line-clamp-2">{paper.title}</div>
          <div className="text-[10px] text-[#7A766F] mt-1">{paper.authors} ({paper.year})</div>
        </div>

        {/* Exclusion Criteria Options */}
        <div className="p-6 space-y-4 font-mono text-xs">
          <div className="text-[11px] font-bold uppercase text-[#1A1917] tracking-wider">
            Select Scientific Exclusion Criterion (EC):
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {activeEcs.map((ecText, idx) => (
              <label
                key={idx}
                onClick={() => { setSelectedEc(ecText); setUseCustom(false); }}
                className={`p-3 border flex items-start gap-2.5 cursor-pointer transition-all ${
                  !useCustom && selectedEc === ecText
                    ? 'bg-[#FDF2F2] border-[#C93B2B] text-[#C93B2B] font-bold shadow-xs'
                    : 'bg-[#F8F6F0] border-[#DCD6C5] text-[#4A4843] hover:bg-[#EAE6DC]'
                }`}
              >
                <input
                  type="radio"
                  name="ec_choice"
                  checked={!useCustom && selectedEc === ecText}
                  onChange={() => {}}
                  className="accent-[#C93B2B] mt-0.5"
                />
                <span className="leading-snug">{ecText}</span>
              </label>
            ))}

            {/* Custom Rationale */}
            <label
              onClick={() => setUseCustom(true)}
              className={`p-3 border flex items-start gap-2.5 cursor-pointer transition-all ${
                useCustom
                  ? 'bg-[#FDF2F2] border-[#C93B2B] text-[#C93B2B] font-bold shadow-xs'
                  : 'bg-[#F8F6F0] border-[#DCD6C5] text-[#4A4843] hover:bg-[#EAE6DC]'
              }`}
            >
              <input
                type="radio"
                name="ec_choice"
                checked={useCustom}
                onChange={() => {}}
                className="accent-[#C93B2B] mt-0.5"
              />
              <div className="w-full">
                <span className="leading-snug">Other Custom Exclusion Rationale:</span>
                {useCustom && (
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter specific methodological reason for exclusion..."
                    rows={2}
                    className="w-full mt-2 bg-[#F4F1EA] border border-[#C8C1AE] p-2 text-xs font-mono text-[#1A1917] focus:outline-none focus:border-[#C93B2B]"
                  />
                )}
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DCD6C5]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#DCD6C5] hover:bg-[#C8C1AE] text-[#1A1917] font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="bg-[#C93B2B] hover:bg-[#A93226] py-2 px-5 font-bold flex items-center gap-1.5 text-white text-xs shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Exclusion</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
