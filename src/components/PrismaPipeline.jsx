import React from 'react';
import { ArrowRight, FileText, CheckCircle2, Check, AlertCircle } from 'lucide-react';

export default function PrismaPipeline({ papersCount = 0, includedCount = 0, pendingCount = 0, excludedCount = 0, extractedCount = 0 }) {
  return (
    <div className="bg-[#EAE6DC] border border-[#DCD6C5] p-2.5 font-mono select-none text-xs">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        
        {/* Stage 1: Identification & Dedup */}
        <div className="flex items-center gap-2 bg-[#F4F1EA] px-3 py-1.5 border border-[#C8C1AE] shrink-0">
          <div className="w-5 h-5 rounded-full bg-[#1A1917] text-white flex items-center justify-center text-[10px] font-bold">
            1
          </div>
          <div>
            <div className="font-bold text-[#1A1917] flex items-center gap-1 text-[11px]">
              <span>1. Identification & Dedup</span>
            </div>
            <div className="text-[10px] text-[#7A766F]">{papersCount} unique records</div>
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-[#7A766F] shrink-0" />

        {/* Stage 2: Title + Abstract Screening */}
        <div className="flex items-center gap-2 bg-[#D4EBD9] px-3 py-1.5 border border-[#98D4A5] shrink-0">
          <div className="w-5 h-5 rounded-full bg-[#2D7A53] text-white flex items-center justify-center text-[10px] font-bold">
            2
          </div>
          <div>
            <div className="font-bold text-[#2D7A53] flex items-center gap-1 text-[11px]">
              <span>2. Title + Abstract</span>
            </div>
            <div className="text-[10px] text-[#2D7A53] flex items-center gap-2">
              <span className="font-bold">✓ {includedCount}</span>
              <span className="text-[#B8860B]">⏳ {pendingCount}</span>
              <span className="text-[#C93B2B]">✕ {excludedCount}</span>
            </div>
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-[#7A766F] shrink-0" />

        {/* Stage 3: Full-Text Eligibility */}
        <div className="flex items-center gap-2 bg-[#E2EEF8] px-3 py-1.5 border border-[#A5CBEB] shrink-0">
          <div className="w-5 h-5 rounded-full bg-[#2B6CB0] text-white flex items-center justify-center text-[10px] font-bold">
            3
          </div>
          <div>
            <div className="font-bold text-[#2B6CB0] flex items-center gap-1 text-[11px]">
              <span>3. Full-Text Screening</span>
            </div>
            <div className="text-[10px] text-[#2B6CB0]">
              {includedCount} articles eligible
            </div>
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-[#7A766F] shrink-0" />

        {/* Stage 4: Evidence Extraction */}
        <div className="flex items-center gap-2 bg-[#FEF3C7] px-3 py-1.5 border border-[#FDE68A] shrink-0">
          <div className="w-5 h-5 rounded-full bg-[#B8860B] text-white flex items-center justify-center text-[10px] font-bold">
            4
          </div>
          <div>
            <div className="font-bold text-[#B8860B] flex items-center gap-1 text-[11px]">
              <span>4. Evidence Extraction</span>
            </div>
            <div className="text-[10px] text-[#B8860B] font-bold">
              {extractedCount} / {includedCount} extracted
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
